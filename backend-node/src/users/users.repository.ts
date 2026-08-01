import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type UserWithRole = User & {
  role: { id: string; name: string; isActive: boolean; deletedAt: Date | null };
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

  findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    }) as Promise<UserWithRole | null>;
  }

  create(input: {
    username: string;
    passwordHash: string;
    fullName: string;
    roleId: string;
    mustChangePassword?: boolean;
  }) {
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        roleId: input.roleId,
        mustChangePassword: input.mustChangePassword ?? true,
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

  clearExpiredLock(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        lockedUntil: null,
        failedLoginAttempts: 0,
      },
    });
  }
}
