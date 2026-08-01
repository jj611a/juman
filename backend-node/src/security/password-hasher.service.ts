import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { AppConfig } from '../shared/types';

/** Dummy Argon2id hash used only to equalize timing on unknown usernames. */
const TIMING_DUMMY_PLAIN = 'juman-timing-dummy-not-a-real-credential';

@Injectable()
export class PasswordHasherService {
  private dummyHashPromise: Promise<string> | null = null;

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

  /**
   * Run a full Argon2 verify against a dummy hash so unknown-user login
   * timing closely matches known-user bad-password timing.
   */
  async verifyDummy(plain: string): Promise<void> {
    const hash = await this.getDummyHash();
    try {
      await argon2.verify(hash, plain);
    } catch {
      /* ignore */
    }
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = argon2.hash(TIMING_DUMMY_PLAIN, this.options());
    }
    return this.dummyHashPromise;
  }
}