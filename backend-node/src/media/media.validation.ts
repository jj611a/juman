import { basename } from 'node:path';
import { BusinessException } from '../shared/errors/business.exception';
import {
  MEDIA_DANGEROUS_EXTENSIONS,
  MEDIA_EXTENSION_MIME,
} from './media.constants';

const PATH_SEP = /[\\/]/;
const HIDDEN = /^\./;

export function sanitizeOriginalFilename(raw: string): string {
  const name = basename(raw.replace(/\\/g, '/')).trim();
  if (!name || name === '.' || name === '..') {
    throw BusinessException.validation('Invalid filename');
  }
  if (PATH_SEP.test(name) || name.includes('\0')) {
    throw BusinessException.validation('Filename must not contain path separators');
  }
  if (HIDDEN.test(name)) {
    throw BusinessException.validation('Hidden filenames are not allowed');
  }
  return name;
}

export function extractExtension(filename: string): string {
  const safe = sanitizeOriginalFilename(filename);
  const parts = safe.split('.');
  if (parts.length < 2) {
    throw BusinessException.validation('File extension is required');
  }
  // Double-extension attack: reject if any intermediate segment is dangerous.
  for (let i = 1; i < parts.length - 1; i += 1) {
    const mid = parts[i].toLowerCase();
    if ((MEDIA_DANGEROUS_EXTENSIONS as readonly string[]).includes(mid)) {
      throw BusinessException.validation('Dangerous double extension rejected');
    }
  }
  const ext = parts[parts.length - 1].toLowerCase();
  if (!ext || ext.length > 10 || !/^[a-z0-9]+$/.test(ext)) {
    throw BusinessException.validation('Invalid file extension');
  }
  if ((MEDIA_DANGEROUS_EXTENSIONS as readonly string[]).includes(ext)) {
    throw BusinessException.validation('Executable or dangerous file type rejected');
  }
  return ext;
}

export function assertAllowedExtension(
  extension: string,
  allowed: readonly string[],
): void {
  if (!allowed.map((e) => e.toLowerCase()).includes(extension.toLowerCase())) {
    throw BusinessException.validation(`Unsupported file extension: ${extension}`);
  }
}

export function assertMimeMatchesExtension(
  extension: string,
  mimeType: string,
  allowedMimes: readonly string[],
): void {
  const mime = mimeType.trim().toLowerCase();
  if (!mime || mime.includes('..') || mime.includes('\\')) {
    throw BusinessException.validation('Invalid MIME type');
  }
  if (!allowedMimes.map((m) => m.toLowerCase()).includes(mime)) {
    throw BusinessException.validation(`Unsupported MIME type: ${mime}`);
  }
  const expected = MEDIA_EXTENSION_MIME[extension.toLowerCase()];
  if (expected && !expected.includes(mime)) {
    // Allow declared office MIME vs zip container MIME already listed.
    throw BusinessException.validation('MIME type does not match file extension');
  }
}

/** Magic-byte / content sniffing to reduce MIME spoofing. */
export function assertContentMatchesExtension(buffer: Buffer, extension: string): void {
  const ext = extension.toLowerCase();
  const head = buffer.subarray(0, Math.min(buffer.length, 16));
  const ok = (() => {
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
      case 'png':
        return head[0] === 0x89 && head.toString('ascii', 1, 4) === 'PNG';
      case 'gif':
        return head.toString('ascii', 0, 3) === 'GIF';
      case 'webp':
        return head.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
      case 'bmp':
        return head.toString('ascii', 0, 2) === 'BM';
      case 'pdf':
        return head.toString('ascii', 0, 4) === '%PDF';
      case 'docx':
      case 'xlsx':
        return head[0] === 0x50 && head[1] === 0x4b;
      case 'txt':
      case 'csv':
        return !buffer.includes(0) && isMostlyText(buffer);
      default:
        return false;
    }
  })();
  if (!ok) {
    throw BusinessException.validation('File content does not match declared type');
  }
}

function isMostlyText(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;
  let printable = 0;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  for (const b of sample) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126) || b >= 128) {
      printable += 1;
    }
  }
  return printable / sample.length >= 0.85;
}
