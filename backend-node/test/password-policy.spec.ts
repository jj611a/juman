import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PasswordPolicyService } from '../src/security/password-policy.service';
import type { AppConfig } from '../src/shared/types';

describe('PasswordPolicyService', () => {
  const app = {
    auth: {
      passwordMinLength: 10,
      passwordRequireComplexity: true,
    },
  } as AppConfig;

  const service = new PasswordPolicyService({
    getOrThrow: () => app,
  } as unknown as ConfigService);

  it('rejects short or simple passwords', () => {
    expect(service.validate('short').valid).toBe(false);
    expect(service.validate('alllowercase1').valid).toBe(false);
  });

  it('accepts complex passwords and rejects username inclusion', () => {
    expect(service.validate('GoodPass1!').valid).toBe(true);
    expect(service.validate('AdminPass1!', 'admin').valid).toBe(false);
  });
});
