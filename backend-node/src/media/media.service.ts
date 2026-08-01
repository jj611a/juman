import { extname } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { MediaFile, MediaReference } from '@prisma/client';
import { MEDIA_KIND, MEDIA_STORAGE_PROVIDER } from '../shared/constants/business.constants';
import { BusinessException } from '../shared/errors/business.exception';
import { newUuid } from '../shared/uuid/uuid';
import { assertNonEmptyString, assertInRange } from '../shared/validation/assert';
import { MediaRepository } from './media.repository';
import type { AttachMediaInput, RegisterMediaInput } from './media.types';

/**
 * Media abstraction for images/documents.
 * No HTTP upload APIs yet — future Electron IPC / camera will call these methods.
 */
@Injectable()
export class MediaService {
  constructor(private readonly repo: MediaRepository) {}

  async registerFile(input: RegisterMediaInput): Promise<MediaFile> {
    const originalFilename = assertNonEmptyString(input.originalFilename, 'originalFilename');
    const mimeType = assertNonEmptyString(input.mimeType, 'mimeType');
    const sha256Hash = assertNonEmptyString(input.sha256Hash, 'sha256Hash');
    const relativePath = assertNonEmptyString(input.relativePath, 'relativePath');
    assertInRange(input.sizeBytes, 0, Number.MAX_SAFE_INTEGER, 'sizeBytes');
    this.assertKind(input.kind);

    const extension = (extname(originalFilename).replace(/^\./, '') || 'bin').toLowerCase();
    const storedFilename = `${newUuid()}.${extension}`;

    return this.repo.createFile({
      originalFilename,
      storedFilename,
      extension,
      mimeType,
      sizeBytes: input.sizeBytes,
      sha256Hash,
      storageProvider: input.storageProvider ?? MEDIA_STORAGE_PROVIDER.LOCAL,
      relativePath,
      kind: input.kind,
      isPublic: input.isPublic ?? false,
      uploadedBy: input.uploadedBy ?? null,
      createdBy: input.createdBy ?? null,
    });
  }

  async getFile(id: string): Promise<MediaFile> {
    const file = await this.repo.findFileById(id);
    if (!file) throw BusinessException.notFound('Media file not found');
    return file;
  }

  findDuplicatesByHash(sha256Hash: string): Promise<MediaFile[]> {
    return this.repo.findFilesByHash(sha256Hash);
  }

  softDeleteFile(id: string): Promise<MediaFile> {
    return this.repo.softDeleteFile(id);
  }

  async attach(input: AttachMediaInput): Promise<MediaReference> {
    await this.getFile(input.mediaFileId);
    return this.repo.createReference({
      mediaFileId: input.mediaFileId,
      moduleName: assertNonEmptyString(input.moduleName, 'moduleName').toLowerCase(),
      entityType: assertNonEmptyString(input.entityType, 'entityType').toLowerCase(),
      entityId: assertNonEmptyString(input.entityId, 'entityId'),
      purpose: assertNonEmptyString(input.purpose, 'purpose').toLowerCase(),
      displayOrder: input.displayOrder ?? 0,
      isPrimary: input.isPrimary ?? false,
      createdBy: input.createdBy ?? null,
    });
  }

  listAttachments(moduleName: string, entityType: string, entityId: string): Promise<MediaReference[]> {
    return this.repo.listReferences({
      moduleName: moduleName.toLowerCase(),
      entityType: entityType.toLowerCase(),
      entityId,
    });
  }

  softDeleteAttachment(id: string): Promise<MediaReference> {
    return this.repo.softDeleteReference(id);
  }

  /** Build a relative storage path for future Electron/local providers. */
  buildRelativePath(extension: string, now = new Date()): string {
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = extension.replace(/^\./, '').toLowerCase() || 'bin';
    return `${yyyy}/${mm}/${newUuid()}.${ext}`;
  }

  inferKind(mimeType: string): (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND] {
    if (mimeType.startsWith('image/')) return MEDIA_KIND.IMAGE;
    if (
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      mimeType.includes('document')
    ) {
      return MEDIA_KIND.DOCUMENT;
    }
    return MEDIA_KIND.OTHER;
  }

  private assertKind(kind: string): void {
    if (!Object.values(MEDIA_KIND).includes(kind as never)) {
      throw BusinessException.validation(`Unsupported media kind: ${kind}`);
    }
  }
}