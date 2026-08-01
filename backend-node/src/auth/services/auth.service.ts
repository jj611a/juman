import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  LOGIN_FAILURE_REASON,
  PASSWORD_CHANGE_ALLOWED_PATHS,
} from '../../core/auth.constants';
import { RolesService } from '../../roles/roles.service';
import { JwtTokenService } from '../../security/jwt-token.service';
import type { AuthPrincipal } from '../../shared/types';
import { UsersService } from '../../users/users.service';
import { LoginHistoryService } from './login-history.service';
import { RefreshTokenService } from './refresh-token.service';
import { SessionService } from './session.service';

export interface LoginCommand {
  readonly username: string;
  readonly password: string;
  readonly rememberMe?: boolean;
  readonly deviceName?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface AuthTokensResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: 'bearer';
  readonly accessExpiresAt: Date;
  readonly refreshExpiresAt: Date;
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly username: string;
    readonly fullName: string;
    readonly roleId: string;
    readonly roleName: string;
    readonly mustChangePassword: boolean;
    readonly permissions: readonly string[];
  };
}

const GENERIC_AUTH_ERROR = 'اسم المستخدم أو كلمة المرور غير صحيحة';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly sessions: SessionService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly history: LoginHistoryService,
    private readonly jwt: JwtTokenService,
  ) {}

  async login(command: LoginCommand): Promise<AuthTokensResult> {
    const username = this.users.normalizeUsername(command.username);
    const user = await this.users.findByUsername(username);

    if (!user) {
      await this.history.recordLoginFailure({
        username,
        failureReason: LOGIN_FAILURE_REASON.USER_NOT_FOUND,
        ipAddress: command.ipAddress,
        deviceName: command.deviceName,
        userAgent: command.userAgent,
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (user.deletedAt) {
      await this.history.recordLoginFailure({
        userId: user.id,
        username,
        failureReason: LOGIN_FAILURE_REASON.DELETED,
        ipAddress: command.ipAddress,
        deviceName: command.deviceName,
        userAgent: command.userAgent,
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (!user.isActive) {
      await this.history.recordLoginFailure({
        userId: user.id,
        username,
        failureReason: LOGIN_FAILURE_REASON.INACTIVE,
        ipAddress: command.ipAddress,
        deviceName: command.deviceName,
        userAgent: command.userAgent,
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const unlocked = await this.users.clearLockIfExpired(user);
    if (this.users.isCurrentlyLocked(unlocked)) {
      await this.history.recordLoginFailure({
        userId: unlocked.id,
        username,
        failureReason: LOGIN_FAILURE_REASON.LOCKED,
        ipAddress: command.ipAddress,
        deviceName: command.deviceName,
        userAgent: command.userAgent,
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const passwordOk = await this.users.verifyPassword(unlocked, command.password);
    if (!passwordOk) {
      const { lockedNow } = await this.users.recordFailedLogin(unlocked);
      await this.history.recordLoginFailure({
        userId: unlocked.id,
        username,
        failureReason: LOGIN_FAILURE_REASON.BAD_PASSWORD,
        ipAddress: command.ipAddress,
        deviceName: command.deviceName,
        userAgent: command.userAgent,
      });
      if (lockedNow) {
        await this.history.recordAccountLocked({
          userId: unlocked.id,
          username,
          ipAddress: command.ipAddress,
          deviceName: command.deviceName,
        });
      }
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    await this.users.recordSuccessfulLogin(unlocked.id);

    const rememberMe = command.rememberMe === true;
    const session = await this.sessions.create({
      userId: unlocked.id,
      deviceName: command.deviceName,
      ipAddress: command.ipAddress,
      rememberMe,
    });

    const refresh = await this.refreshTokens.issue({
      userId: unlocked.id,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    });

    const access = await this.jwt.createAccessToken({
      userId: unlocked.id,
      sessionId: session.id,
    });

    const permissions = await this.roles.listPermissionKeys(unlocked.roleId);

    await this.history.recordLoginSuccess({
      userId: unlocked.id,
      username: unlocked.username,
      sessionId: session.id,
      ipAddress: command.ipAddress,
      deviceName: command.deviceName,
      userAgent: command.userAgent,
    });

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      tokenType: 'bearer',
      accessExpiresAt: access.expiresAt,
      refreshExpiresAt: session.expiresAt,
      sessionId: session.id,
      user: {
        id: unlocked.id,
        username: unlocked.username,
        fullName: unlocked.fullName,
        roleId: unlocked.roleId,
        roleName: unlocked.role.name,
        mustChangePassword: unlocked.mustChangePassword,
        permissions,
      },
    };
  }

  async logout(principal: AuthPrincipal): Promise<void> {
    await this.sessions.revoke(principal.sessionId, principal.userId);
    await this.refreshTokens.revokeSessionFamily(principal.sessionId);
    await this.history.recordLogout({
      userId: principal.userId,
      username: principal.username,
      sessionId: principal.sessionId,
    });
  }

  async logoutAll(principal: AuthPrincipal): Promise<void> {
    await this.sessions.revokeAllForUser(principal.userId, principal.userId);
    await this.refreshTokens.revokeAllForUser(principal.userId);
    await this.history.recordLogout({
      userId: principal.userId,
      username: principal.username,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokensResult> {
    const current = await this.refreshTokens.assertNotReuse(refreshToken);
    const session = await this.sessions.getActive(current.sessionId, current.userId);
    if (!session) {
      await this.refreshTokens.revokeSessionFamily(current.sessionId);
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.users.findById(current.userId);
    if (!user || !user.isActive) {
      await this.refreshTokens.revokeAllForUser(current.userId);
      throw new UnauthorizedException('User inactive');
    }

    const unlocked = await this.users.clearLockIfExpired(user);
    if (this.users.isCurrentlyLocked(unlocked)) {
      throw new UnauthorizedException('User locked');
    }

    await this.sessions.touch(session.id);
    const rotated = await this.refreshTokens.rotate({
      current,
      expiresAt: session.expiresAt,
    });
    const access = await this.jwt.createAccessToken({
      userId: unlocked.id,
      sessionId: session.id,
    });
    const permissions = await this.roles.listPermissionKeys(unlocked.roleId);

    return {
      accessToken: access.token,
      refreshToken: rotated.token,
      tokenType: 'bearer',
      accessExpiresAt: access.expiresAt,
      refreshExpiresAt: session.expiresAt,
      sessionId: session.id,
      user: {
        id: unlocked.id,
        username: unlocked.username,
        fullName: unlocked.fullName,
        roleId: unlocked.roleId,
        roleName: unlocked.role.name,
        mustChangePassword: unlocked.mustChangePassword,
        permissions,
      },
    };
  }

  async resolvePrincipalFromAccessToken(token: string): Promise<AuthPrincipal> {
    const claims = await this.jwt.verifyAccessToken(token);
    return this.resolvePrincipalFromClaims(claims);
  }

  async resolvePrincipalFromClaims(claims: {
    sub: string;
    sid: string;
    type: string;
  }): Promise<AuthPrincipal> {
    if (claims.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.sessions.getActive(claims.sid, claims.sub);
    if (!session) {
      throw new UnauthorizedException('Session inactive');
    }

    let user = await this.users.findById(claims.sub);
    if (!user || !user.isActive || user.role.deletedAt || !user.role.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    user = await this.users.clearLockIfExpired(user);
    if (this.users.isCurrentlyLocked(user)) {
      throw new UnauthorizedException('User locked');
    }

    const permissions = await this.roles.listPermissionKeys(user.roleId);

    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      roleId: user.roleId,
      roleName: user.role.name,
      sessionId: session.id,
      permissions,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive,
    };
  }

  assertPasswordChangeAllowed(principal: AuthPrincipal, path: string): void {
    if (!principal.mustChangePassword) return;
    const allowed = PASSWORD_CHANGE_ALLOWED_PATHS.some(
      (p) => path === p || path.startsWith(`${p}/`),
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: 'Password change required',
        code: 'password_change_required',
      });
    }
  }
}
