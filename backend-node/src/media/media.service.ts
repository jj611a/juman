import { Injectable, OnModuleInit } from '@nestjs/common';
import type { MediaFile, MediaReference, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import {
  AUDIT_ACTION,
  MEDIA_KIND,
  MEDIA_STORAGE_PROVIDER,
} from '../shared/constants/business.constants';
import { BusinessException } from '../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
  type Paginated,
} from '../shared/pagination/pagination';
import { normalizeSearchQuery } from '../shared/search/search';
import { normalizeSort } from '../shared/sorting/sorting';
import { newUuid } from '../shared/uuid/uuid';
import { assertNonEmptyString, assertInRange } from '../shared/validation/assert';
import { parseOptionalBoolean } from '../shared/validation/parse-boolean';
import type { AuthPrincipal } from '../shared/types';
import { calculateChecksum, checksumsMatch } from './media.checksum';
import {
  MEDIA_ALLOWED_EXTENSIONS,
  MEDIA_DEFAULT_MAX_UPLOAD_BYTES,
  MEDIA_ENTITY_FILE,
  MEDIA_EXTENSION_MIME,
  MEDIA_MODULE,
  MEDIA_SETTING,
  MEDIA_SORT_FIELDS,
  MEDIA_STORAGE_CATEGORY,
  type MediaStorageCategory,
} from './media.constants';
import { readImageMetadata } from './media.image-meta';
import { toPublicMedia } from './media.mapper';
import { MediaRepository } from './media.repository';
import type {
  AttachMediaInput,
  ListMediaInput,
  MediaFilePublic,
  RegisterMediaInput,
  SaveMediaInput,
} from './media.types';
import {
  assertAllowedExtension,
  assertContentMatchesExtension,
  assertMimeMatchesExtension,
  extractExtension,
  sanitizeOriginalFilename,
} from './media.validation';
import { LocalStorageProvider } from './providers/local-storage.provider';

/**
 * Single source of truth for Juman file storage.
 * Domain modules reference Media IDs via MediaReference ? never store blobs themselves.
 */
@Injectable()
export class MediaService implements OnModuleInit {
  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: LocalStorageProvider,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.storage.ensureCategoryDirectories();
  }

  calculateChecksum(buffer: Buffer): string {
    return calculateChecksum(buffer);
  }

  async save(input: SaveMediaInput, actor?: AuthPrincipal): Promise<MediaFile> {
    const originalFilename = sanitizeOriginalFilename(input.originalFilename);
    const extension = extractExtension(originalFilename);
    const mimeType = assertNonEmptyString(input.mimeType, 'mimeType').toLowerCase();
    const buffer = input.buffer;
    if (!buffer || buffer.length === 0) {
      throw BusinessException.validation('Empty file rejected');
    }

    const maxBytes = await this.settings.getInt(
      MEDIA_SETTING.MAX_UPLOAD_BYTES,
      MEDIA_DEFAULT_MAX_UPLOAD_BYTES,
    );
    assertInRange(buffer.length, 1, maxBytes, 'sizeBytes');

    const allowedExt = await this.resolveAllowedExtensions();
    const allowedMime = await this.resolveAllowedMimes();
    assertAllowedExtension(extension, allowedExt);
    assertMimeMatchesExtension(extension, mimeType, allowedMime);
    assertContentMatchesExtension(buffer, extension);

    const sha256Hash = this.calculateChecksum(buffer);
    const kind = this.inferKind(mimeType);
    const category = input.category ?? this.categoryForKind(kind);
    const storedFilename = `${newUuid()}.${extension}`;
    const relativePath = this.storage.buildRelativePath(category, storedFilename);
    const meta = kind === MEDIA_KIND.IMAGE ? readImageMetadata(buffer, extension) : {
      width: null,
      height: null,
      orientation: null,
    };

    this.storage.save(relativePath, buffer);

    try {
      const row = await this.repo.createFile({
        originalFilename,
        storedFilename,
        extension,
        mimeType,
        sizeBytes: buffer.length,
        sha256Hash,
        width: meta.width,
        height: meta.height,
        orientation: meta.orientation,
        storageProvider: MEDIA_STORAGE_PROVIDER.LOCAL,
        relativePath,
        kind,
        isPublic: false,
        uploadedBy: input.uploadedBy ?? actor?.userId ?? null,
        createdBy: input.createdBy ?? actor?.userId ?? null,
      });

      await this.audit.recordCreate(MEDIA_MODULE, MEDIA_ENTITY_FILE, row.id, this.snapshot(row), {
        userId: actor?.userId,
        username: actor?.username,
      });
      return row;
    } catch (err) {
      this.storage.hardDelete(relativePath);
      throw err;
    }
  }

  /** Metadata-only registration (legacy/internal). Prefer save() for uploads. */
  async registerFile(input: RegisterMediaInput): Promise<MediaFile> {
    const originalFilename = sanitizeOriginalFilename(input.originalFilename);
    const mimeType = assertNonEmptyString(input.mimeType, 'mimeType').toLowerCase();
    const sha256Hash = assertNonEmptyString(input.sha256Hash, 'sha256Hash').toLowerCase();
    const relativePath = assertNonEmptyString(input.relativePath, 'relativePath');
    assertInRange(input.sizeBytes, 0, Number.MAX_SAFE_INTEGER, 'sizeBytes');
    this.assertKind(input.kind);
    this.storage.absolutePath(relativePath);

    const extension = extractExtension(originalFilename);
    const storedFilename = `${newUuid()}.${extension}`;

    return this.repo.createFile({
      originalFilename,
      storedFilename,
      extension,
      mimeType,
      sizeBytes: input.sizeBytes,
      sha256Hash,
      width: input.width ?? null,
      height: input.height ?? null,
      orientation: input.orientation ?? null,
      storageProvider: input.storageProvider ?? MEDIA_STORAGE_PROVIDER.LOCAL,
      relativePath,
      kind: input.kind,
      isPublic: input.isPublic ?? false,
      uploadedBy: input.uploadedBy ?? null,
      createdBy: input.createdBy ?? null,
    });
  }

  async find(id: string): Promise<MediaFile> {
    return this.requireLive(id);
  }

  getFile(id: string): Promise<MediaFile> {
    return this.find(id);
  }

  async findPublic(id: string): Promise<MediaFilePublic> {
    return toPublicMedia(await this.find(id));
  }

  async findMany(query: ListMediaInput): Promise<Paginated<MediaFilePublic>> {
    const page = normalizePagination(query);
    const where = this.buildWhere(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(MEDIA_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const orderBy = {
      [sort.field]: sort.direction,
    } as Prisma.MediaFileOrderByWithRelationInput;
    const { rows, total } = await this.repo.listFiles({
      where,
      orderBy,
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows.map(toPublicMedia), total, page);
  }

  findDuplicatesByHash(sha256Hash: string): Promise<MediaFile[]> {
    return this.repo.findFilesByHash(sha256Hash.toLowerCase());
  }

  async delete(id: string, actor?: AuthPrincipal): Promise<MediaFile> {
    const existing = await this.requireLive(id);
    await this.repo.softDeleteReferencesForFile(id);
    const deleted = await this.repo.softDeleteFile(id, actor?.userId);
    await this.audit.recordSoftDelete(
      MEDIA_MODULE,
      MEDIA_ENTITY_FILE,
      id,
      this.snapshot(existing),
      { userId: actor?.userId, username: actor?.username },
    );
    return deleted;
  }

  softDeleteFile(id: string): Promise<MediaFile> {
    return this.delete(id);
  }

  async restore(id: string, actor?: AuthPrincipal): Promise<MediaFile> {
    const existing = await this.repo.findFileById(id, { includeDeleted: true });
    if (!existing) throw BusinessException.notFound('Media file not found');
    if (!existing.deletedAt) {
      throw BusinessException.conflict('Media file is not deleted');
    }
    if (!this.storage.exists(existing.relativePath)) {
      await this.audit.record({
        module: MEDIA_MODULE,
        entityType: MEDIA_ENTITY_FILE,
        entityId: id,
        action: AUDIT_ACTION.INTEGRITY_FAILURE,
        oldValues: this.snapshot(existing),
        message: 'Restore blocked: blob missing on disk',
        actor: { userId: actor?.userId, username: actor?.username },
      });
      throw BusinessException.conflict('Cannot restore: stored file blob is missing');
    }
    const restored = await this.repo.restoreFile(id, actor?.userId);
    await this.audit.record({
      module: MEDIA_MODULE,
      entityType: MEDIA_ENTITY_FILE,
      entityId: id,
      action: AUDIT_ACTION.RESTORE,
      oldValues: this.snapshot(existing),
      newValues: this.snapshot(restored),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return restored;
  }

  exists(id: string): Promise<boolean> {
    return this.repo.findFileById(id).then(async (row) => {
      if (!row) return false;
      return this.storage.exists(row.relativePath);
    });
  }

  async verifyIntegrity(id: string, actor?: AuthPrincipal): Promise<{
    ok: boolean;
    expectedChecksum: string;
    actualChecksum: string | null;
  }> {
    const file = await this.requireLive(id);
    if (!this.storage.exists(file.relativePath)) {
      await this.auditIntegrityFailure(file, 'Blob missing', actor);
      return { ok: false, expectedChecksum: file.sha256Hash, actualChecksum: null };
    }
    const actual = this.calculateChecksum(this.storage.read(file.relativePath));
    const ok = checksumsMatch(file.sha256Hash, actual);
    if (!ok) {
      await this.auditIntegrityFailure(file, 'Checksum mismatch', actor, actual);
    }
    return { ok, expectedChecksum: file.sha256Hash, actualChecksum: actual };
  }

  async attach(input: AttachMediaInput): Promise<MediaReference> {
    await this.find(input.mediaFileId);
    const ref = await this.repo.createReference({
      mediaFile: { connect: { id: input.mediaFileId } },
      moduleName: assertNonEmptyString(input.moduleName, 'moduleName').toLowerCase(),
      entityType: assertNonEmptyString(input.entityType, 'entityType').toLowerCase(),
      entityId: assertNonEmptyString(input.entityId, 'entityId'),
      purpose: assertNonEmptyString(input.purpose, 'purpose').toLowerCase(),
      displayOrder: input.displayOrder ?? 0,
      isPrimary: input.isPrimary ?? false,
      createdBy: input.createdBy ?? null,
    });
    return ref;
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

  /** @deprecated Prefer storage.buildRelativePath with category. Kept for tests/compat. */
  buildRelativePath(extension: string, now = new Date()): string {
    const ext = extension.replace(/^\./, '').toLowerCase() || 'bin';
    const stored = `${newUuid()}.${ext}`;
    const kind = MEDIA_EXTENSION_MIME[ext]?.[0]?.startsWith('image/')
      ? MEDIA_KIND.IMAGE
      : MEDIA_KIND.DOCUMENT;
    return this.storage.buildRelativePath(this.categoryForKind(kind), stored, now);
  }

  inferKind(mimeType: string): (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND] {
    if (mimeType.startsWith('image/')) return MEDIA_KIND.IMAGE;
    if (
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      mimeType.includes('document') ||
      mimeType.includes('sheet') ||
      mimeType === 'application/zip' ||
      mimeType === 'application/csv'
    ) {
      return MEDIA_KIND.DOCUMENT;
    }
    return MEDIA_KIND.OTHER;
  }

  private categoryForKind(kind: string): MediaStorageCategory {
    if (kind === MEDIA_KIND.IMAGE) return MEDIA_STORAGE_CATEGORY.IMAGES;
    return MEDIA_STORAGE_CATEGORY.DOCUMENTS;
  }

  private buildWhere(query: ListMediaInput): Prisma.MediaFileWhereInput {
    const deleted = parseOptionalBoolean(query.deleted) === true;
    const where: Prisma.MediaFileWhereInput = {
      deletedAt: deleted ? { not: null } : null,
    };
    if (query.kind) where.kind = query.kind.toLowerCase();
    if (query.extension) where.extension = query.extension.toLowerCase();
    if (query.mimeType) where.mimeType = query.mimeType.toLowerCase();
    const q = normalizeSearchQuery(query.q);
    if (q) {
      where.OR = [
        { originalFilename: { contains: q } },
        { storedFilename: { contains: q } },
        { sha256Hash: { contains: q.toLowerCase() } },
        { extension: { contains: q.toLowerCase() } },
        { mimeType: { contains: q.toLowerCase() } },
      ];
    }
    return where;
  }

  private async requireLive(id: string): Promise<MediaFile> {
    const file = await this.repo.findFileById(id);
    if (!file) throw BusinessException.notFound('Media file not found');
    return file;
  }

  private async resolveAllowedExtensions(): Promise<string[]> {
    const raw = await this.settings.getJson<string[]>(
      MEDIA_SETTING.ALLOWED_EXTENSIONS,
      [...MEDIA_ALLOWED_EXTENSIONS],
    );
    if (Array.isArray(raw) && raw.length > 0) return raw.map((e) => String(e).toLowerCase());
    return [...MEDIA_ALLOWED_EXTENSIONS];
  }

  private async resolveAllowedMimes(): Promise<string[]> {
    const defaults = Object.values(MEDIA_EXTENSION_MIME).flat().map((m) => m.toLowerCase());
    const raw = await this.settings.getJson<string[]>(MEDIA_SETTING.ALLOWED_MIME_TYPES, defaults);
    if (Array.isArray(raw) && raw.length > 0) return raw.map((m) => String(m).toLowerCase());
    return defaults;
  }

  private assertKind(kind: string): void {
    if (!Object.values(MEDIA_KIND).includes(kind as never)) {
      throw BusinessException.validation(`Unsupported media kind: ${kind}`);
    }
  }

  private async auditIntegrityFailure(
    file: MediaFile,
    message: string,
    actor?: AuthPrincipal,
    actual?: string,
  ): Promise<void> {
    await this.audit.record({
      module: MEDIA_MODULE,
      entityType: MEDIA_ENTITY_FILE,
      entityId: file.id,
      action: AUDIT_ACTION.INTEGRITY_FAILURE,
      oldValues: this.snapshot(file),
      newValues: actual ? { actualChecksum: actual } : undefined,
      message,
      actor: { userId: actor?.userId, username: actor?.username },
    });
  }

  private snapshot(row: MediaFile): Record<string, unknown> {
    return {
      id: row.id,
      originalFilename: row.originalFilename,
      storedFilename: row.storedFilename,
      extension: row.extension,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sha256Hash: row.sha256Hash,
      kind: row.kind,
      deletedAt: row.deletedAt,
    };
  }
}
