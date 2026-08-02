import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaService } from '../src/media/media.service';
import { MEDIA_KIND } from '../src/shared/constants/business.constants';
import { BusinessException } from '../src/shared/errors/business.exception';

function png1x1(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

describe('MediaService', () => {
  const repo = {
    createFile: vi.fn(),
    updateFile: vi.fn(),
    findFileById: vi.fn(),
    findFilesByHash: vi.fn(),
    softDeleteFile: vi.fn(),
    restoreFile: vi.fn(),
    softDeleteReferencesForFile: vi.fn(),
    listFiles: vi.fn(),
    createReference: vi.fn(),
    listReferences: vi.fn(),
    softDeleteReference: vi.fn(),
  };
  const storage = {
    ensureCategoryDirectories: vi.fn(),
    save: vi.fn(),
    read: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
    absolutePath: vi.fn((p: string) => p),
    buildRelativePath: vi.fn(
      (cat: string, name: string) => `${cat}/2026/08/${name}`,
    ),
  };
  const settings = {
    getInt: vi.fn(async () => 10 * 1024 * 1024),
    getJson: vi.fn(async (_k: string, fb: unknown) => fb),
  };
  const audit = {
    recordCreate: vi.fn(),
    recordSoftDelete: vi.fn(),
    record: vi.fn(),
  };
  let service: MediaService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MediaService(
      repo as never,
      storage as never,
      settings as never,
      audit as never,
    );
    repo.createFile.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'f1',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      width: null,
      height: null,
      orientation: null,
      isPublic: false,
      uploadedBy: null,
      createdBy: null,
      ...data,
    }));
    repo.findFilesByHash.mockResolvedValue([]);
    repo.listFiles.mockResolvedValue({ rows: [], total: 0 });
  });

  it('saves image with checksum metadata and audits', async () => {
    const buf = png1x1();
    const row = await service.save(
      { buffer: buf, originalFilename: 'photo.PNG', mimeType: 'image/png' },
      { userId: 'u1', username: 'admin' } as never,
    );
    expect(row.extension).toBe('png');
    expect(row.sha256Hash).toHaveLength(64);
    expect(storage.save).toHaveBeenCalled();
    expect(audit.recordCreate).toHaveBeenCalled();
    expect(service.calculateChecksum(buf)).toBe(row.sha256Hash);
  });

  it('rejects dangerous and spoofed uploads', async () => {
    await expect(
      service.save({
        buffer: Buffer.from('MZ'),
        originalFilename: 'x.exe',
        mimeType: 'application/octet-stream',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.save({
        buffer: Buffer.from('not-a-png'),
        originalFilename: 'x.png',
        mimeType: 'image/png',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.save({
        buffer: png1x1(),
        originalFilename: 'invoice.pdf.exe',
        mimeType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.save({
        buffer: png1x1(),
        originalFilename: '.hidden.png',
        mimeType: 'image/png',
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.save({ buffer: Buffer.alloc(0), originalFilename: 'a.png', mimeType: 'image/png' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('supports duplicate uploads by hash', async () => {
    const buf = png1x1();
    const a = await service.save({
      buffer: buf,
      originalFilename: 'a.png',
      mimeType: 'image/png',
    });
    repo.createFile.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'f2',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    const b = await service.save({
      buffer: buf,
      originalFilename: 'b.png',
      mimeType: 'image/png',
    });
    expect(a.sha256Hash).toBe(b.sha256Hash);
    expect(a.id).not.toBe(b.id);
  });

  it('finds lists deletes restores and verifies integrity', async () => {
    const live = {
      id: 'f1',
      originalFilename: 'a.png',
      storedFilename: 'u.png',
      extension: 'png',
      mimeType: 'image/png',
      sizeBytes: 10,
      sha256Hash: service.calculateChecksum(png1x1()),
      relativePath: 'images/2026/08/u.png',
      kind: MEDIA_KIND.IMAGE,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      width: 1,
      height: 1,
      orientation: null,
      isPublic: false,
      uploadedBy: null,
      createdBy: null,
    };
    repo.findFileById.mockResolvedValue(live);
    storage.exists.mockReturnValue(true);
    storage.read.mockReturnValue(png1x1());

    expect(await service.find('f1')).toEqual(live);
    expect((await service.findPublic('f1')).checksum).toBe(live.sha256Hash);
    expect((await service.findPublic('f1'))).not.toHaveProperty('relativePath');

    const integrity = await service.verifyIntegrity('f1');
    expect(integrity.ok).toBe(true);

    storage.read.mockReturnValue(Buffer.from('tampered'));
    const bad = await service.verifyIntegrity('f1', { userId: 'u1' } as never);
    expect(bad.ok).toBe(false);
    expect(audit.record).toHaveBeenCalled();

    repo.softDeleteFile.mockResolvedValue({ ...live, deletedAt: new Date() });
    await service.delete('f1', { userId: 'u1' } as never);
    expect(repo.softDeleteReferencesForFile).toHaveBeenCalledWith('f1');

    repo.findFileById.mockResolvedValue({ ...live, deletedAt: new Date() });
    repo.restoreFile.mockResolvedValue({ ...live, deletedAt: null });
    await service.restore('f1', { userId: 'u1' } as never);

    repo.findFileById.mockResolvedValue({ ...live, deletedAt: new Date() });
    storage.exists.mockReturnValue(false);
    await expect(service.restore('f1')).rejects.toBeInstanceOf(BusinessException);

    repo.findFileById.mockResolvedValue(live);
    storage.exists.mockReturnValue(true);
    expect(await service.exists('f1')).toBe(true);

    repo.listFiles.mockResolvedValue({ rows: [live], total: 1 });
    const page = await service.findMany({ q: 'a.png', offset: 0, limit: 10 });
    expect(page.meta.total).toBe(1);
  });

  it('registers attaches and soft-deletes references', async () => {
    repo.createFile.mockResolvedValue({ id: 'f1' });
    repo.findFileById.mockResolvedValue({ id: 'f1' });
    repo.findFilesByHash.mockResolvedValue([{ id: 'f1' }]);
    repo.createReference.mockResolvedValue({ id: 'r1' });
    repo.listReferences.mockResolvedValue([{ id: 'r1' }]);
    repo.softDeleteReference.mockResolvedValue({ id: 'r1' });

    await service.registerFile({
      originalFilename: 'doc.txt',
      mimeType: 'text/plain',
      sizeBytes: 3,
      sha256Hash: 'abc',
      relativePath: 'documents/2026/08/x.txt',
      kind: MEDIA_KIND.DOCUMENT,
    });
    expect(storage.absolutePath).toHaveBeenCalled();

    await service.attach({
      mediaFileId: 'f1',
      moduleName: 'Customers',
      entityType: 'Customer',
      entityId: 'c1',
      purpose: 'IdScan',
    });
    expect(repo.createReference).toHaveBeenCalled();
    expect(await service.listAttachments('customers', 'customer', 'c1')).toHaveLength(1);
    await service.softDeleteAttachment('r1');

    expect(service.inferKind('image/jpeg')).toBe('image');
    expect(service.buildRelativePath('pdf')).toMatch(/^documents\/\d{4}\/\d{2}\/.+\.pdf$/);

    repo.findFileById.mockResolvedValue(null);
    await expect(service.find('missing')).rejects.toBeInstanceOf(BusinessException);
  });

  it('covers aliases and softDeleteFile', async () => {
    repo.findFileById.mockResolvedValue({ id: 'f1', deletedAt: null, relativePath: 'images/a.png' });
    expect(await service.getFile('f1')).toEqual(expect.objectContaining({ id: 'f1' }));
    repo.softDeleteFile.mockResolvedValue({ id: 'f1', deletedAt: new Date() });
    repo.softDeleteReferencesForFile.mockResolvedValue({ count: 0 });
    await service.softDeleteFile('f1');
    expect(await service.findDuplicatesByHash('abc')).toEqual([]);
  });

  it('covers more service branches', async () => {
    service.onModuleInit();
    expect(storage.ensureCategoryDirectories).toHaveBeenCalled();

    await expect(
      service.save({
        buffer: png1x1(),
        originalFilename: 'a.png',
        mimeType: 'image/png',
        category: 'temp',
      }),
    ).resolves.toBeTruthy();

    storage.save.mockImplementationOnce(() => undefined);
    repo.createFile.mockRejectedValueOnce(new Error('db fail'));
    await expect(
      service.save({ buffer: png1x1(), originalFilename: 'a.png', mimeType: 'image/png' }),
    ).rejects.toThrow(/db fail/);
    expect(storage.hardDelete).toHaveBeenCalled();

    repo.findFileById.mockResolvedValue({
      id: 'f1',
      deletedAt: null,
      relativePath: 'images/x.png',
      sha256Hash: 'abc',
      originalFilename: 'a.png',
      storedFilename: 'x.png',
      extension: 'png',
      mimeType: 'image/png',
      sizeBytes: 1,
      kind: 'image',
    });
    storage.exists.mockReturnValue(false);
    const missingBlob = await service.verifyIntegrity('f1');
    expect(missingBlob.ok).toBe(false);
    expect(missingBlob.actualChecksum).toBeNull();

    repo.findFileById.mockResolvedValue({ id: 'f1', deletedAt: null });
    await expect(service.restore('f1')).rejects.toBeInstanceOf(BusinessException);

    repo.findFileById.mockResolvedValue(null);
    await expect(service.restore('missing')).rejects.toBeInstanceOf(BusinessException);
    expect(await service.exists('missing')).toBe(false);

    await expect(
      service.registerFile({
        originalFilename: 'x.bin',
        mimeType: 'x',
        sizeBytes: 1,
        sha256Hash: 'h',
        relativePath: 'documents/2026/08/x.bin',
        kind: 'nope' as never,
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    expect(service.inferKind('text/plain')).toBe('document');
    expect(service.inferKind('application/octet-stream')).toBe('other');

    repo.listFiles.mockResolvedValue({ rows: [], total: 0 });
    settings.getJson.mockResolvedValueOnce([]);
    await service.save({
      buffer: png1x1(),
      originalFilename: 'fallback.png',
      mimeType: 'image/png',
    });

    await service.findMany({
      kind: 'image',
      extension: 'png',
      mimeType: 'image/png',
      deleted: true,
      sortBy: 'sizeBytes',
      sortDir: 'asc',
      q: 'abc',
    });
  });
});
