import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../shared/types';
import { PasswordHasherService } from '../security/password-hasher.service';
import { PasswordPolicyService } from '../security/password-policy.service';
import { UsersRepository, type UserWithRole } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly hasher: PasswordHasherService,
    private readonly policy: PasswordPolicyService,
    private readonly config: ConfigService,
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
  }): Promise<UserWithRole> {
    const username = this.normalizeUsername(input.username);
    const policy = this.policy.validate(input.password, username);
    if (!policy.valid) {
      throw new Error(policy.errors.join('; '));
    }
    const passwordHash = await this.hasher.hash(input.password);
    return this.repo.create({
      username,
      passwordHash,
      fullName: input.fullName,
      roleId: input.roleId,
      mustChangePassword: input.mustChangePassword,
    }) as Promise<UserWithRole>;
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
    const attempts = user.failedLoginAttempts + 1;
    let isLocked = user.isLocked;
    let lockedUntil = user.lockedUntil;
    let lockedNow = false;

    if (attempts >= auth.maxFailedLoginAttempts) {
      isLocked = true;
      lockedNow = !user.isLocked;
      lockedUntil =
        auth.accountLockDurationMinutes > 0
          ? new Date(Date.now() + auth.accountLockDurationMinutes * 60_000)
          : null;
    }

    await this.repo.updateFailedAttempt({
      userId: user.id,
      failedLoginAttempts: attempts,
      isLocked,
      lockedUntil,
    });

    return { lockedNow };
  }

  recordSuccessfulLogin(userId: string) {
    return this.repo.updateLoginSuccess(userId);
  }
}
