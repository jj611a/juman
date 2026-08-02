import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { MediaRepository } from '../src/media/media.repository';

describe('MediaRepository', () => {
  it('covers file and reference operations', async () => {
    const prisma = {
      mediaFile: {
        create: vi.fn().mockResolvedValue({ id: 'f1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'f1' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'f1', deletedAt: new Date() }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 'f1' }),
        count: vi.fn().mockResolvedValue(0),
      },
      mediaReference: {
        create: vi.fn().mockResolvedValue({ id: 'r1' }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 'r1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
      relativePath: 'images/2026/08/s.jpg',
      kind: 'image',
      isPublic: false,
      uploadedBy: null,
      createdBy: null,
    } as never);
    await repo.updateFile('f1', { updatedBy: 'u1' });
    await repo.findFileById('f1');
    await repo.findFileById('f1', { includeDeleted: true });
    await repo.findFilesByHash('h');
    await repo.softDeleteFile('f1', 'u1');
    await repo.restoreFile('f1', 'u1');
    await repo.softDeleteReferencesForFile('f1');
    await repo.listFiles({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });
    await repo.createReference({
      mediaFile: { connect: { id: 'f1' } },
      moduleName: 'inventory',
      entityType: 'dress',
      entityId: 'd1',
      purpose: 'primary',
      displayOrder: 0,
      isPrimary: true,
      createdBy: null,
    } as never);
    await repo.listReferences({ moduleName: 'inventory', entityType: 'dress', entityId: 'd1' });
    await repo.softDeleteReference('r1');
    expect(prisma.mediaFile.create).toHaveBeenCalled();
    expect(prisma.mediaReference.updateMany).toHaveBeenCalled();
  });
});
