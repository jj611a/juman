import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { AppConfig } from '../shared/types';

@Injectable()
export class PasswordHasherService {
  constructor(private readonly config: ConfigService) {}

  private options() {
    const auth = this.config.getOrThrow<AppConfig>('app').auth;
    return {
      type: argon2.argon2id,
      timeCost: auth.argon2.timeCost,
      memoryCost: auth.argon2.memoryCost,
      parallelism: auth.argon2.parallelism,
    } as const;
  }

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options());
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
