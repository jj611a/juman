import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { MediaService } from '../src/media/media.service';
import { MEDIA_KIND } from '../src/shared/constants/business.constants';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('MediaService', () => {
  it('registers attaches and soft-deletes media', async () => {
    const repo = {
      createFile: vi.fn().mockResolvedValue({ id: 'f1' }),
      findFileById: vi.fn().mockResolvedValue({ id: 'f1' }),
      findFilesByHash: vi.fn().mockResolvedValue([{ id: 'f1' }]),
      softDeleteFile: vi.fn().mockResolvedValue({ id: 'f1', deletedAt: new Date() }),
      createReference: vi.fn().mockResolvedValue({ id: 'r1' }),
      listReferences: vi.fn().mockResolvedValue([{ id: 'r1' }]),
      softDeleteReference: vi.fn().mockResolvedValue({ id: 'r1' }),
    };
    const service = new MediaService(repo as never);

    const file = await service.registerFile({
      originalFilename: 'photo.JPG',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      sha256Hash: 'abc',
      relativePath: '2026/08/x.jpg',
      kind: MEDIA_KIND.IMAGE,
      uploadedBy: 'u1',
    });
    expect(file.id).toBe('f1');
    expect(repo.createFile).toHaveBeenCalledWith(
      expect.objectContaining({ extension: 'jpg', kind: 'image' }),
    );

    expect(await service.getFile('f1')).toEqual({ id: 'f1' });
    expect(await service.findDuplicatesByHash('abc')).toHaveLength(1);
    await service.softDeleteFile('f1');

    await service.attach({
      mediaFileId: 'f1',
      moduleName: 'Inventory',
      entityType: 'Dress',
      entityId: 'd1',
      purpose: 'Primary',
    });
    expect(repo.createReference).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleName: 'inventory',
        entityType: 'dress',
        purpose: 'primary',
      }),
    );
    expect(await service.listAttachments('inventory', 'dress', 'd1')).toHaveLength(1);
    await service.softDeleteAttachment('r1');

    expect(service.inferKind('image/png')).toBe('image');
    expect(service.inferKind('application/pdf')).toBe('document');
    expect(service.inferKind('application/octet-stream')).toBe('other');
    expect(service.buildRelativePath('png')).toMatch(/^\d{4}\/\d{2}\/.+\.png$/);

    repo.findFileById.mockResolvedValue(null);
    await expect(service.getFile('missing')).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.registerFile({
        originalFilename: 'x.bin',
        mimeType: 'x',
        sizeBytes: 1,
        sha256Hash: 'h',
        relativePath: 'p',
        kind: 'nope' as never,
      }),
    ).rejects.toBeInstanceOf(BusinessException);
  });
});