import { createHash } from 'node:crypto';

export function calculateChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function checksumsMatch(expected: string, actual: string): boolean {
  return expected.toLowerCase() === actual.toLowerCase();
}
