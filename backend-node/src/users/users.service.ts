import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { AppConfig } from '../shared/types';
import { PasswordHasherService } from '../security/password-hasher.service';
import { PasswordPolicyService } from '../security/password-policy.service';
import { UsersRepository, type UserWithRole } from './users.repository';
import { BusinessException } from '../shared/errors/business.exception';
import { normalizePagination, paginated, type Paginated, type PaginationInput } from '../shared/pagination/pagination';
import { normalizeSearchQuery } from '../shared/search/search';
import { normalizeSort } from '../shared/sorting/sorting';
import { parseOptionalBoolean } from '../shared/validation/parse-boolean';
import { USER_MODULE, USER_ENTITY, USER_STATUS, USER_SORT_FIELDS } from './users.constants';
import { AUDIT_ACTION } from '../shared/constants/business.constants';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../shared/types';

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly hasher: PasswordHasherService,
    private readonly policy: PasswordPolicyService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  findByUsername(username: string) {
    return this.repo.findByUsername(this.normalizeUsername(username));
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  async createUser(input: {
    username: string;
    password: string;
    fullName: string;
    roleId: string;
    mustChangePassword?: boolean;
    isActive?: boolean;
    createdBy?: string;
  }): Promise<UserWithRole> {
    const username = this.normalizeUsername(input.username);
    const policy = this.policy.validate(input.password, username);
    if (!policy.valid) {
      throw new Error(policy.errors.join('; '));
    }
    const passwordHash = await this.hasher.hash(input.password);
    const created = await this.repo.create({
      username,
      passwordHash,
      fullName: input.fullName,
      roleId: input.roleId,
      mustChangePassword: input.mustChangePassword,
      isActive: input.isActive,
      createdBy: input.createdBy,
    });

    await this.audit.recordCreate(
      USER_MODULE,
      USER_ENTITY,
      created.id,
      this.snapshot(created),
      { userId: input.createdBy, username: undefined },
    );

    return created;
  }

  async verifyPassword(user: UserWithRole, password: string): Promise<boolean> {
    return this.hasher.verify(user.passwordHash, password);
  }

  isCurrentlyLocked(user: UserWithRole, now = new Date()): boolean {
    if (!user.isLocked) return false;
    if (user.lockedUntil && user.lockedUntil.getTime() <= now.getTime()) {
      return false;
    }
    return true;
  }

  async clearLockIfExpired(user: UserWithRole, now = new Date()): Promise<UserWithRole> {
    if (
      user.isLocked &&
      user.lockedUntil &&
      user.lockedUntil.getTime() <= now.getTime()
    ) {
      await this.repo.clearExpiredLock(user.id);
      const refreshed = await this.repo.findById(user.id);
      return refreshed ?? user;
    }
    return user;
  }

  async recordFailedLogin(user: UserWithRole): Promise<{ lockedNow: boolean }> {
    const auth = this.config.getOrThrow<AppConfig>('app').auth;
    const updated = await this.repo.incrementFailedAttempt(user.id);
    const attempts = updated.failedLoginAttempts;
    let lockedNow = false;

    if (attempts >= auth.maxFailedLoginAttempts && !updated.isLocked) {
      lockedNow = true;
      await this.repo.updateFailedAttempt({
        userId: user.id,
        failedLoginAttempts: attempts,
        isLocked: true,
        lockedUntil:
          auth.accountLockDurationMinutes > 0
            ? new Date(Date.now() + auth.accountLockDurationMinutes * 60_000)
            : null,
      });
    }

    return { lockedNow };
  }

  recordSuccessfulLogin(userId: string) {
    return this.repo.updateLoginSuccess(userId);
  }

  async setActive(userId: string, isActive: boolean) {
    if (!isActive) {
      return this.disableAccount(userId);
    }
    return this.repo.setActive(userId, true);
  }

  enableAccount(userId: string) {
    return this.repo.setActive(userId, true);
  }

  /**
   * Disable account and immediately revoke every session + refresh token.
   * Existing JWTs fail on next principal resolve (session revoked).
   */
  async disableAccount(userId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
      await tx.loginSession.updateMany({
        where: { userId, revokedAt: null, deletedAt: null },
        data: { revokedAt: now, revokedBy: userId },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return user;
    });
  }

  /**
   * Administrator recovery: clear lockout state without changing password.
   */
  async unlockAccount(userId: string) {
    return this.repo.clearExpiredLock(userId);
  }

  changePassword(input: { userId: string; previousHash: string; newHash: string }) {
    return this.repo.changePassword(input);
  }

  listPasswordHistory(userId: string, take: number) {
    return this.repo.listPasswordHistory(userId, take);
  }

  // New methods for admin user management

  private toPublic(user: UserWithRole): Omit<UserWithRole, 'passwordHash'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async list(query: {
    q?: string;
    status?: string;
    roleId?: string;
    deleted?: boolean | string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    offset?: number;
    limit?: number;
  }): Promise<Paginated<Omit<UserWithRole, 'passwordHash'>>> {
    const page = normalizePagination(query as PaginationInput);
    const deleted = parseOptionalBoolean(query.deleted) === true;

    const where: Prisma.UserWhereInput = {
      deletedAt: deleted ? { not: null } : null,
    };

    if (query.status) {
      switch (query.status) {
        case USER_STATUS.ACTIVE:
          where.isActive = true;
          break;
        case USER_STATUS.INACTIVE:
          where.isActive = false;
          break;
        case USER_STATUS.LOCKED:
          where.isLocked = true;
          break;
      }
    }
    if (query.roleId) where.roleId = query.roleId;

    const q = normalizeSearchQuery(query.q);
    if (q) {
      where.OR = [
        { username: { contains: q } },
        { fullName: { contains: q } },
      ];
    }

    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(USER_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const orderBy: Prisma.UserOrderByWithRelationInput = { [sort.field]: sort.direction };

    const { rows, total } = await this.repo.list({ where, orderBy, offset: page.offset, limit: page.limit });
    const items = rows.map((u) => this.toPublic(u));
    return paginated(items, total, page);
  }

  async getById(id: string): Promise<Omit<UserWithRole, 'passwordHash'> | null> {
    const user = await this.repo.findById(id);
    return user ? this.toPublic(user) : null;
  }

  async getByIdWithDeleted(id: string): Promise<UserWithRole | null> {
    return this.repo.findById(id, { includeDeleted: true });
  }

  async updateProfile(id: string, input: { fullName?: string; roleId?: string }, actor?: AuthPrincipal): Promise<Omit<UserWithRole, 'passwordHash'>> {
    const existing = await this.repo.findById(id);
    if (!existing) throw BusinessException.notFound('User not found');

    const updated = await this.repo.update({
      id,
      fullName: input.fullName,
      roleId: input.roleId,
      updatedBy: actor?.userId,
    });

    await this.audit.recordUpdate(
      USER_MODULE,
      USER_ENTITY,
      id,
      this.snapshot(existing),
      this.snapshot(updated),
      { userId: actor?.userId, username: actor?.username },
    );

    return this.toPublic(updated);
  }

  async setActiveState(id: string, isActive: boolean, actor?: AuthPrincipal): Promise<Omit<UserWithRole, 'passwordHash'>> {
    const existing = await this.repo.findById(id);
    if (!existing) throw BusinessException.notFound('User not found');

    if (isActive) {
      const updated = await this.repo.setActive(id, true);
      await this.audit.recordUpdate(
        USER_MODULE,
        USER_ENTITY,
        id,
        this.snapshot(existing),
        this.snapshot(updated),
        { userId: actor?.userId, username: actor?.username },
      );
      return this.toPublic(updated);
    } else {
      // deactivate: revoke sessions
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { isActive: false } });
        await tx.loginSession.updateMany({
          where: { userId: id, revokedAt: null, deletedAt: null },
          data: { revokedAt: now, revokedBy: actor?.userId ?? id },
        });
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now },
        });
      });
      const updated = await this.repo.findById(id);
      await this.audit.recordUpdate(
        USER_MODULE,
        USER_ENTITY,
        id,
        this.snapshot(existing),
        this.snapshot(updated!),
        { userId: actor?.userId, username: actor?.username },
      );
      return this.toPublic(updated!);
    }
  }

  async unlock(id: string, actor?: AuthPrincipal): Promise<Omit<UserWithRole, 'passwordHash'>> {
    const existing = await this.repo.findById(id);
    if (!existing) throw BusinessException.notFound('User not found');
    const updated = await this.repo.clearExpiredLock(id);
    await this.audit.recordUpdate(
      USER_MODULE,
      USER_ENTITY,
      id,
      this.snapshot(existing),
      this.snapshot(updated),
      { userId: actor?.userId, username: actor?.username },
    );
    return this.toPublic(updated);
  }

  async resetPassword(id: string, newPassword: string, actor?: AuthPrincipal): Promise<Omit<UserWithRole, 'passwordHash'>> {
    const existing = await this.repo.findById(id);
    if (!existing) throw BusinessException.notFound('User not found');
    const policy = this.policy.validate(newPassword, existing.username);
    if (!policy.valid) throw BusinessException.validation(policy.errors.join('; '));
    const passwordHash = await this.hasher.hash(newPassword);
    const updated = await this.repo.resetPassword({ userId: id, newHash: passwordHash, updatedBy: actor?.userId });
    await this.audit.recordUpdate(
      USER_MODULE,
      USER_ENTITY,
      id,
      this.snapshot(existing),
      this.snapshot(updated),
      { userId: actor?.userId, username: actor?.username },
    );
    return this.toPublic(updated);
  }

  async softDelete(id: string, actor?: AuthPrincipal): Promise<Omit<UserWithRole, 'passwordHash'>> {
    const existing = await this.repo.findById(id);
    if (!existing) throw BusinessException.notFound('User not found');
    const deleted = await this.repo.softDelete(id, actor?.userId ?? id);
    await this.audit.recordSoftDelete(
      USER_MODULE,
      USER_ENTITY,
      id,
      this.snapshot(existing),
      { userId: actor?.userId, username: actor?.username },
    );
    return this.toPublic(deleted);
  }

  async restore(id: string, actor?: AuthPrincipal): Promise<Omit<UserWithRole, 'passwordHash'>> {
    const existing = await this.repo.findById(id, { includeDeleted: true });
    if (!existing) throw BusinessException.notFound('User not found');
    if (!existing.deletedAt) throw BusinessException.conflict('User is not deleted');
    const restored = await this.repo.restore(id, actor?.userId ?? id);
    await this.audit.record({
      module: USER_MODULE,
      entityType: USER_ENTITY,
      entityId: id,
      action: AUDIT_ACTION.RESTORE,
      oldValues: this.snapshot(existing),
      newValues: this.snapshot(restored),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return this.toPublic(restored);
  }

  async countActiveByRole(roleId: string): Promise<number> {
    return this.repo.countActiveByRole(roleId);
  }

  private snapshot(user: UserWithRole): Record<string, unknown> {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roleId: user.roleId,
      roleName: user.role?.name,
      isActive: user.isActive,
      isLocked: user.isLocked,
      mustChangePassword: user.mustChangePassword,
      deletedAt: user.deletedAt,
    };
  }
}