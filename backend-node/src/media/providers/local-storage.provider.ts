import { createReadStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/types';
import { BusinessException } from '../../shared/errors/business.exception';
import {
  MEDIA_STORAGE_CATEGORIES,
  type MediaStorageCategory,
} from '../media.constants';

/**
 * Local filesystem storage under the configured storage root.
 * Never accepts absolute client paths; all keys are relative to storageDir.
 */
@Injectable()
export class LocalStorageProvider {
  constructor(private readonly config: ConfigService) {}

  get storageRoot(): string {
    const paths = this.config.getOrThrow<AppConfig['paths']>('app.paths');
    return paths.storageDir;
  }

  ensureCategoryDirectories(): void {
    for (const category of MEDIA_STORAGE_CATEGORIES) {
      mkdirSync(resolve(this.storageRoot, category), { recursive: true });
    }
  }

  absolutePath(relativePath: string): string {
    const safeRel = this.assertSafeRelativePath(relativePath);
    const abs = resolve(this.storageRoot, safeRel);
    this.assertInsideRoot(abs);
    return abs;
  }

  exists(relativePath: string): boolean {
    return existsSync(this.absolutePath(relativePath));
  }

  save(relativePath: string, buffer: Buffer): void {
    const abs = this.absolutePath(relativePath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, buffer);
  }

  read(relativePath: string): Buffer {
    const abs = this.absolutePath(relativePath);
    if (!existsSync(abs)) {
      throw BusinessException.notFound('Stored media blob not found');
    }
    return readFileSync(abs);
  }

  openReadStream(relativePath: string) {
    return createReadStream(this.absolutePath(relativePath));
  }

  /** Soft-delete keeps blobs for restore; hardDelete removes bytes permanently. */
  hardDelete(relativePath: string): void {
    const abs = this.absolutePath(relativePath);
    if (existsSync(abs)) unlinkSync(abs);
  }

  buildRelativePath(
    category: MediaStorageCategory,
    storedFilename: string,
    now = new Date(),
  ): string {
    this.assertCategory(category);
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const normalized = storedFilename.replace(/\\/g, '/');
    if (!normalized || normalized.includes('..') || normalized.includes('/')) {
      throw BusinessException.validation('Invalid stored filename');
    }
    const name = normalized;
    return [category, yyyy, mm, name].join('/');
  }

  private assertCategory(category: string): void {
    if (!(MEDIA_STORAGE_CATEGORIES as readonly string[]).includes(category)) {
      throw BusinessException.validation(`Unknown storage category: ${category}`);
    }
  }

  private assertSafeRelativePath(relativePath: string): string {
    const trimmed = relativePath.trim().replace(/\\/g, '/');
    if (!trimmed || isAbsolute(trimmed) || trimmed.startsWith('/') || /^[a-zA-Z]:/.test(trimmed)) {
      throw BusinessException.validation('Invalid storage path');
    }
    if (trimmed.includes('\0') || trimmed.split('/').some((p) => p === '..' || p === '')) {
      throw BusinessException.validation('Path traversal rejected');
    }
    const top = trimmed.split('/')[0];
    this.assertCategory(top);
    return trimmed;
  }

  private assertInsideRoot(absolutePath: string): void {
    const root = resolve(this.storageRoot);
    const normalized = normalize(absolutePath);
    const rel = relative(root, normalized);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw BusinessException.validation('Path escapes storage root');
    }
    // Windows drive mismatch
    if (normalized.split(sep)[0] !== root.split(sep)[0] && process.platform === 'win32') {
      if (!normalized.toLowerCase().startsWith(root.toLowerCase())) {
        throw BusinessException.validation('Path escapes storage root');
      }
    }
  }
}
