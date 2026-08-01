import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH_FLOOR,
} from '../core/auth.constants';
import type { AppConfig } from '../shared/types';

export interface PasswordPolicyResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly config: ConfigService) {}

  validate(password: string, username?: string): PasswordPolicyResult {
    const auth = this.config.getOrThrow<AppConfig>('app').auth;
    const errors: string[] = [];
    const minLength = Math.max(PASSWORD_MIN_LENGTH_FLOOR, auth.passwordMinLength);

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters`);
    }
    if (password.length > DEFAULT_PASSWORD_MAX_LENGTH) {
      errors.push(`Password must be at most ${DEFAULT_PASSWORD_MAX_LENGTH} characters`);
    }

    if (auth.passwordRequireComplexity) {
      const classes = [
        /[a-z]/.test(password),
        /[A-Z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password),
      ].filter(Boolean).length;
      if (classes < 3) {
        errors.push(
          'Password must include at least 3 of: lowercase, uppercase, digit, symbol',
        );
      }
    }

    if (username && password.toLowerCase().includes(username.toLowerCase())) {
      errors.push('Password must not contain the username');
    }

    return { valid: errors.length === 0, errors };
  }
}
