import { HttpException, HttpStatus } from '@nestjs/common';
import { DOMAIN_ERROR_CODE, type DomainErrorCode, type DomainErrorPayload } from './domain.errors';

export class BusinessException extends HttpException {
  readonly domainCode: DomainErrorCode;
  readonly details: readonly string[];

  constructor(
    code: DomainErrorCode,
    message: string,
    options?: { status?: HttpStatus; details?: readonly string[] },
  ) {
    const status = options?.status ?? HttpStatus.BAD_REQUEST;
    const details = options?.details ?? [];
    const body: DomainErrorPayload & { success: false } = {
      success: false,
      code,
      message,
      details,
    };
    super(body, status);
    this.domainCode = code;
    this.details = details;
  }

  static notFound(message: string, details?: readonly string[]): BusinessException {
    return new BusinessException(DOMAIN_ERROR_CODE.NOT_FOUND, message, {
      status: HttpStatus.NOT_FOUND,
      details,
    });
  }

  static conflict(message: string, details?: readonly string[]): BusinessException {
    return new BusinessException(DOMAIN_ERROR_CODE.CONFLICT, message, {
      status: HttpStatus.CONFLICT,
      details,
    });
  }

  static validation(message: string, details?: readonly string[]): BusinessException {
    return new BusinessException(DOMAIN_ERROR_CODE.VALIDATION, message, { details });
  }

  static invariant(message: string, details?: readonly string[]): BusinessException {
    return new BusinessException(DOMAIN_ERROR_CODE.INVARIANT, message, {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    });
  }
}