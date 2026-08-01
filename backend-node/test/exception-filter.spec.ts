import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GlobalHttpExceptionFilter } from '../src/exceptions/http-exception.filter';

describe('GlobalHttpExceptionFilter', () => {
  it('returns JSON without stack traces', () => {
    const logger = {
      error: vi.fn(),
      request: vi.fn(),
    };
    const filter = new GlobalHttpExceptionFilter(logger as never);
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/health', method: 'GET' }),
      }),
    };

    filter.catch(new HttpException('Nope', HttpStatus.BAD_REQUEST), host as never);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.stack).toBeUndefined();
    expect(body.message).toBe('Nope');
    expect(body.statusCode).toBe(400);
  });
});
