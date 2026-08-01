import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { MediaRepository } from '../src/media/media.repository';

describe('MediaRepository', () => {
  it('covers file and reference operations', async () => {
    const prisma = {
      mediaFile: {
        create: vi.fn().mockResolvedValue({ id: 'f1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'f1' }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 'f1' }),
      },
      mediaReference: {
        create: vi.fn().mockResolvedValue({ id: 'r1' }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 'r1' }),
      },
    };
    const repo = new MediaRepository(prisma as never);
    await repo.createFile({
      originalFilename: 'a.jpg',
      storedFilename: 's.jpg',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
      sha256Hash: 'h',
      storageProvider: 'local',
      relativePath: 'p',
      kind: 'image',
      isPublic: false,
      uploadedBy: null,
      createdBy: null,
    });
    await repo.findFileById('f1');
    await repo.findFilesByHash('h');
    await repo.softDeleteFile('f1');
    await repo.createReference({
      mediaFileId: 'f1',
      moduleName: 'inventory',
      entityType: 'dress',
      entityId: 'd1',
      purpose: 'primary',
      displayOrder: 0,
      isPrimary: true,
      createdBy: null,
    });
    await repo.listReferences({ moduleName: 'inventory', entityType: 'dress', entityId: 'd1' });
    await repo.softDeleteReference('r1');
    expect(prisma.mediaFile.create).toHaveBeenCalled();
  });
});