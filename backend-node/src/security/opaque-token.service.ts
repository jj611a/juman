import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class OpaqueTokenService {
  generate(byteLength = 48): string {
    return randomBytes(byteLength).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  matches(token: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }
}
