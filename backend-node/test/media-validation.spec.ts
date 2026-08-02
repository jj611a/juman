import { describe, expect, it } from 'vitest';
import { calculateChecksum } from '../src/media/media.checksum';
import { readImageMetadata } from '../src/media/media.image-meta';
import {
  assertAllowedExtension,
  assertContentMatchesExtension,
  assertMimeMatchesExtension,
  extractExtension,
  sanitizeOriginalFilename,
} from '../src/media/media.validation';
import { BusinessException } from '../src/shared/errors/business.exception';
import { LocalStorageProvider } from '../src/media/providers/local-storage.provider';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('media validation and checksum', () => {
  it('sanitizes names and rejects path tricks', () => {
    expect(sanitizeOriginalFilename('C:\\tmp\\a.PNG')).toBe('a.PNG');
    expect(extractExtension('a.b.png')).toBe('png');
    expect(() => extractExtension('x.exe')).toThrow(BusinessException);
    expect(() => extractExtension('x.pdf.exe')).toThrow(BusinessException);
    expect(() => sanitizeOriginalFilename('.env')).toThrow(BusinessException);
    expect(() => extractExtension('noext')).toThrow(BusinessException);
    expect(() => extractExtension('a.toolongextensionx')).toThrow(BusinessException);
    expect(() => sanitizeOriginalFilename('..')).toThrow(BusinessException);
  });

  it('checksums and content sniffing', () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    expect(calculateChecksum(png)).toHaveLength(64);
    const meta = readImageMetadata(png, 'png');
    expect(meta.width).toBe(1);
    expect(meta.height).toBe(1);
    assertContentMatchesExtension(png, 'png');
    assertContentMatchesExtension(Buffer.from('%PDF-1.4'), 'pdf');
    assertContentMatchesExtension(Buffer.from('hello,world'), 'csv');
    expect(() => assertContentMatchesExtension(Buffer.from('nope'), 'png')).toThrow(
      BusinessException,
    );

    expect(() => assertAllowedExtension('xyz', ['png'])).toThrow(BusinessException);
    expect(() =>
      assertMimeMatchesExtension('png', 'image/jpeg', ['image/jpeg', 'image/png']),
    ).toThrow(BusinessException);
    expect(() => assertMimeMatchesExtension('png', '', ['image/png'])).toThrow(BusinessException);
    expect(() => assertMimeMatchesExtension('png', 'image\\png', ['image/png'])).toThrow(
      BusinessException,
    );
    expect(() => assertMimeMatchesExtension('png', 'image/gif', ['image/png'])).toThrow(
      BusinessException,
    );
    assertMimeMatchesExtension('png', 'image/png', ['image/png']);

    assertContentMatchesExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'jpg');
    assertContentMatchesExtension(Buffer.from('GIF89a........'), 'gif');
    assertContentMatchesExtension(Buffer.from('BM........'), 'bmp');
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0);
    webp.write('WEBP', 8);
    assertContentMatchesExtension(webp, 'webp');
    assertContentMatchesExtension(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'docx');
    assertContentMatchesExtension(Buffer.from('plain'), 'txt');
    expect(() => assertContentMatchesExtension(Buffer.from([0, 1, 2]), 'txt')).toThrow(
      BusinessException,
    );
    expect(() => assertContentMatchesExtension(Buffer.from('x'), 'bin')).toThrow(BusinessException);
  });
});

describe('LocalStorageProvider filesystem', () => {
  it('writes reads and blocks traversal', async () => {
    const root = mkdtempSync(join(tmpdir(), 'juman-media-'));
    mkdirSync(join(root, 'images'), { recursive: true });
    const config = { getOrThrow: () => ({ storageDir: root }) };
    const provider = new LocalStorageProvider(config as never);
    provider.ensureCategoryDirectories();
    const rel = provider.buildRelativePath('images', 'abc.png');
    provider.save(rel, Buffer.from('hi'));
    expect(provider.exists(rel)).toBe(true);
    expect(provider.read(rel).toString()).toBe('hi');
    expect(() => provider.absolutePath('../etc/passwd')).toThrow(BusinessException);
    expect(() => provider.absolutePath('images/../../secret')).toThrow(BusinessException);
    expect(() => provider.absolutePath('/abs')).toThrow(BusinessException);
    expect(() => provider.buildRelativePath('nope' as never, 'a.png')).toThrow(BusinessException);
    expect(() => provider.read('images/missing.png')).toThrow(BusinessException);
    expect(() => provider.buildRelativePath('images', '../x.png')).toThrow(BusinessException);
    const streamRel = provider.buildRelativePath('images', 'stream.png');
    provider.save(streamRel, Buffer.from('stream-data'));
    const stream = provider.openReadStream(streamRel);
    expect(stream).toBeTruthy();
    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      stream.on('readable', () => {
        stream.read();
      });
      stream.on('end', () => resolve());
      stream.resume();
    });
    provider.hardDelete(rel);
    expect(provider.exists(rel)).toBe(false);
    provider.hardDelete(streamRel);
    rmSync(root, { recursive: true, force: true });
  });
});
