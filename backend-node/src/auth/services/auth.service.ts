import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LOGIN_FAILURE_REASON,
  PASSWORD_CHANGE_ALLOWED_PATHS,
} from '../../core/auth.constants';
import { RolesService } from '../../roles/roles.service';
import { JwtTokenService } from '../../security/jwt-token.service';
import { PasswordHasherService } from '../../security/password-hasher.service';
import { PasswordPolicyService } from '../../security/password-policy.service';
import type { AppConfig, AuthPrincipal } from '../../shared/types';
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
  readonly rememberMe: boolean;
  readonly user: {
    readonly id: string;
    readonly username: string;
    readonly fullName: string;
    readonly roleId: string;
    readonly roleName: string;
    readonly mustChangePassword: boolean;
    readonly isActive: boolean;
    readonly permissions: readonly string[];
  };
}

export interface SessionView {
  readonly sessionId: string;
  readonly rememberMe: boolean;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly deviceName: string | null;
  readonly user: AuthTokensResult['user'];
}

const GENERIC_AUTH_ERROR = 'Invalid username or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly sessions: SessionService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly history: LoginHistoryService,
    private readonly jwt: JwtTokenService,
    private readonly hasher: PasswordHasherService,
    private readonly policy: PasswordPolicyService,
    private readonly config: ConfigService,
  ) {}

  async login(command: LoginCommand): Promise<AuthTokensResult> {
    const username = this.users.normalizeUsername(command.username);
    const user = await this.users.findByUsername(username);

    if (!user) {
      await this.history.recordLoginFailed({
        username,
        failureReason: LOGIN_FAILURE_REASON.USER_NOT_FOUND,
        ipAddress: command.ipAddress,
        deviceName: command.deviceName,
        userAgent: command.userAgent,
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (user.deletedAt) {
      await this.history.recordLoginFailed({
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
      await this.history.recordLoginFailed({
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
      await this.history.recordLoginFailed({
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
      await this.history.recordLoginFailed({
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

    await this.history.recordLogin({
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
      rememberMe,
      user: {
        id: unlocked.id,
        username: unlocked.username,
        fullName: unlocked.fullName,
        roleId: unlocked.roleId,
        roleName: unlocked.role.name,
        mustChangePassword: unlocked.mustChangePassword,
        isActive: unlocked.isActive,
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

  /**
   * Session restore for Electron Main.
   * Prefer Bearer access token. If expired/missing, supply refreshToken to rotate.
   */
  async restoreSession(input: {
    accessToken?: string;
    refreshToken?: string;
  }): Promise<{ tokens?: AuthTokensResult; session: SessionView }> {
    if (input.accessToken) {
      try {
        const principal = await this.resolvePrincipalFromAccessToken(input.accessToken);
        const session = await this.sessions.getActive(principal.sessionId, principal.userId);
        if (!session) throw new UnauthorizedException('Session inactive');
        return {
          session: {
            sessionId: session.id,
            rememberMe: session.rememberMe,
            expiresAt: session.expiresAt,
            lastActivityAt: session.lastActivityAt,
            deviceName: session.deviceName,
            user: {
              id: principal.userId,
              username: principal.username,
              fullName: principal.fullName,
              roleId: principal.roleId,
              roleName: principal.roleName,
              mustChangePassword: principal.mustChangePassword,
              isActive: principal.isActive,
              permissions: principal.permissions,
            },
          },
        };
      } catch {
        if (!input.refreshToken) throw new UnauthorizedException('Session expired');
      }
    }

    if (!input.refreshToken) {
      throw new UnauthorizedException('Session required');
    }

    const tokens = await this.refresh(input.refreshToken);
    return {
      tokens,
      session: {
        sessionId: tokens.sessionId,
        rememberMe: tokens.rememberMe,
        expiresAt: tokens.refreshExpiresAt,
        lastActivityAt: new Date(),
        deviceName: null,
        user: tokens.user,
      },
    };
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
      rememberMe: session.rememberMe,
      user: {
        id: unlocked.id,
        username: unlocked.username,
        fullName: unlocked.fullName,
        roleId: unlocked.roleId,
        roleName: unlocked.role.name,
        mustChangePassword: unlocked.mustChangePassword,
        isActive: unlocked.isActive,
        permissions,
      },
    };
  }

  async changePassword(
    principal: AuthPrincipal,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(principal.userId);
    if (!user) throw new UnauthorizedException('User inactive');

    const ok = await this.users.verifyPassword(user, currentPassword);
    if (!ok) {
      throw new BadRequestException('Current password is incorrect');
    }

    const policy = this.policy.validate(newPassword, user.username);
    if (!policy.valid) {
      throw new BadRequestException(policy.errors.join('; '));
    }

    const historyCount = this.config.getOrThrow<AppConfig>('app').auth.passwordHistoryCount;
    const recent = await this.users.listPasswordHistory(user.id, historyCount);
    const hashes = [user.passwordHash, ...recent.map((h) => h.passwordHash)];
    for (const hash of hashes) {
      if (await this.hasher.verify(hash, newPassword)) {
        throw new BadRequestException('Password was used recently');
      }
    }

    const newHash = await this.hasher.hash(newPassword);
    await this.users.changePassword({
      userId: user.id,
      previousHash: user.passwordHash,
      newHash,
    });

    // Invalidate other sessions; keep the current session (Python parity).
    await this.sessions.revokeAllForUser(user.id, user.id, principal.sessionId);
    await this.refreshTokens.revokeSessionFamilyExcept(
      user.id,
      principal.sessionId,
    );

    await this.history.recordPasswordChanged({
      userId: user.id,
      username: user.username,
      sessionId: principal.sessionId,
    });
  }

  async getMe(principal: AuthPrincipal) {
    return {
      id: principal.userId,
      username: principal.username,
      fullName: principal.fullName,
      roleId: principal.roleId,
      roleName: principal.roleName,
      mustChangePassword: principal.mustChangePassword,
      isActive: principal.isActive,
      permissions: principal.permissions,
      sessionId: principal.sessionId,
    };
  }

  async getSession(principal: AuthPrincipal): Promise<SessionView> {
    const session = await this.sessions.getActive(principal.sessionId, principal.userId);
    if (!session) throw new UnauthorizedException('Session inactive');
    const me = await this.getMe(principal);
    return {
      sessionId: session.id,
      rememberMe: session.rememberMe,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      deviceName: session.deviceName,
      user: {
        id: me.id,
        username: me.username,
        fullName: me.fullName,
        roleId: me.roleId,
        roleName: me.roleName,
        mustChangePassword: me.mustChangePassword,
        isActive: me.isActive,
        permissions: me.permissions,
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
