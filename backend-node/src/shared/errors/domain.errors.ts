/** Stable English error codes for domain failures (operator message separate). */
export const DOMAIN_ERROR_CODE = {
  VALIDATION: 'domain.validation',
  NOT_FOUND: 'domain.not_found',
  CONFLICT: 'domain.conflict',
  FORBIDDEN: 'domain.forbidden',
  INVARIANT: 'domain.invariant',
  MONEY_INVALID: 'domain.money_invalid',
  BARCODE_INVALID: 'domain.barcode_invalid',
  BARCODE_TAKEN: 'domain.barcode_taken',
  SETTING_READONLY: 'domain.setting_readonly',
} as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODE)[keyof typeof DOMAIN_ERROR_CODE];

export interface DomainErrorPayload {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details?: readonly string[];
}