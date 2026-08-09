import { Injectable } from '@nestjs/common';
import type { PasswordHistory, User, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type UserWithRole = User & {
  role: { id: string; name: string; isActive: boolean; deletedAt: Date | null };
};

export type UserPublic = Omit<User, 'passwordHash'> & {
  role: { id: string; name: string; isActive: boolean } | null;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string): Promise<UserWithRole | null> {
    return this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      include: { role: true },
    }) as Promise<UserWithRole | null>;
  }

  findById(id: string, opts?: { includeDeleted?: boolean }): Promise<UserWithRole | null> {
    const where: Prisma.UserWhereInput = { id };
    if (!opts?.includeDeleted) where.deletedAt = null;
    return this.prisma.user.findFirst({
      where,
      include: { role: true },
    }) as Promise<UserWithRole | null>;
  }

  create(input: {
    username: string;
    passwordHash: string;
    fullName: string;
    roleId: string;
    mustChangePassword?: boolean;
    isActive?: boolean;
    createdBy?: string;
  }) {
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        roleId: input.roleId,
        mustChangePassword: input.mustChangePassword ?? true,
        isActive: input.isActive ?? true,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      },
      include: { role: true },
    });
  }

update(input: {
    id: string;
    fullName?: string;
    roleId?: string;
    isActive?: boolean;
    mustChangePassword?: boolean;
    updatedBy?: string;
  }) {
    return this.prisma.user.update({
      where: { id: input.id },
      data: {
        fullName: input.fullName,
        roleId: input.roleId,
        isActive: input.isActive,
        mustChangePassword: input.mustChangePassword,
        updatedBy: input.updatedBy,
      },
      include: { role: true },
    });
  }

  updateLoginSuccess(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        isLocked: false,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }

  updateFailedAttempt(input: {
    userId: string;
    failedLoginAttempts: number;
    isLocked: boolean;
    lockedUntil: Date | null;
  }): Promise<User> {
    return this.prisma.user.update({
      where: { id: input.userId },
      data: {
        failedLoginAttempts: input.failedLoginAttempts,
        isLocked: input.isLocked,
        lockedUntil: input.lockedUntil,
      },
    });
  }

  /**
   * Atomically increments the failed-attempt counter so concurrent failed
   * logins cannot undercount and delay lockout.
   */
  async incrementFailedAttempt(userId: string): Promise<User> {
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  clearExpiredLock(userId: string): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        lockedUntil: null,
        failedLoginAttempts: 0,
      },
      include: { role: true },
    });
  }

  setActive(userId: string, isActive: boolean): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      include: { role: true },
    });
  }

  async changePassword(input: {
    userId: string;
    previousHash: string;
    newHash: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordHistory.create({
        data: { userId: input.userId, passwordHash: input.previousHash },
      });
      await tx.user.update({
        where: { id: input.userId },
        data: {
          passwordHash: input.newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          isLocked: false,
          lockedUntil: null,
        },
      });
    });
  }

  async resetPassword(input: {
    userId: string;
    newHash: string;
    updatedBy?: string;
  }): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id: input.userId },
      data: {
        passwordHash: input.newHash,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        isLocked: false,
        lockedUntil: null,
        updatedBy: input.updatedBy,
      },
      include: { role: true },
    });
  }

  listPasswordHistory(userId: string, take: number): Promise<PasswordHistory[]> {
    return this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async list(input: {
    where: Prisma.UserWhereInput;
    orderBy: Prisma.UserOrderByWithRelationInput;
    offset: number;
    limit: number;
  }): Promise<{ rows: UserWithRole[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        include: { role: true },
      }),
      this.prisma.user.count({ where: input.where }),
    ]);
    return { rows: rows as UserWithRole[], total };
  }

  softDelete(userId: string, deletedBy: string): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), updatedBy: deletedBy, isActive: false },
      include: { role: true },
    });
  }

  restore(userId: string, restoredBy: string): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null, updatedBy: restoredBy, isActive: true },
      include: { role: true },
    });
  }

  async countActiveByRole(roleId: string): Promise<number> {
    return this.prisma.user.count({
      where: { roleId, isActive: true, deletedAt: null },
    });
  }

  async findActiveByRoleId(roleId: string): Promise<UserWithRole[]> {
    return this.prisma.user.findMany({
      where: { roleId, isActive: true, deletedAt: null },
      include: { role: true },
    }) as Promise<UserWithRole[]>;
  }
}
