import { Injectable } from '@nestjs/common';
import type { MediaFile, MediaReference, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  liveWhere,
  restoreSoftDeleteData,
  softDeleteData,
} from '../shared/soft-delete/soft-delete';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  createFile(data: Prisma.MediaFileCreateInput): Promise<MediaFile> {
    return this.prisma.mediaFile.create({ data });
  }

  updateFile(id: string, data: Prisma.MediaFileUpdateInput): Promise<MediaFile> {
    return this.prisma.mediaFile.update({ where: { id }, data });
  }

  findFileById(id: string, opts?: { includeDeleted?: boolean }): Promise<MediaFile | null> {
    if (opts?.includeDeleted) {
      return this.prisma.mediaFile.findUnique({ where: { id } });
    }
    return this.prisma.mediaFile.findFirst({ where: liveWhere({ id }) });
  }

  findFilesByHash(sha256Hash: string): Promise<MediaFile[]> {
    return this.prisma.mediaFile.findMany({ where: liveWhere({ sha256Hash }) });
  }

  softDeleteFile(id: string, updatedBy?: string | null): Promise<MediaFile> {
    return this.prisma.mediaFile.update({
      where: { id },
      data: { ...softDeleteData(), updatedBy: updatedBy ?? null },
    });
  }

  restoreFile(id: string, updatedBy?: string | null): Promise<MediaFile> {
    return this.prisma.mediaFile.update({
      where: { id },
      data: { ...restoreSoftDeleteData(), updatedBy: updatedBy ?? null },
    });
  }

  softDeleteReferencesForFile(mediaFileId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.mediaReference.updateMany({
      where: { mediaFileId, deletedAt: null },
      data: softDeleteData(),
    });
  }

  async listFiles(input: {
    where: Prisma.MediaFileWhereInput;
    orderBy: Prisma.MediaFileOrderByWithRelationInput;
    offset: number;
    limit: number;
  }): Promise<{ rows: MediaFile[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.mediaFile.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  createReference(data: Prisma.MediaReferenceCreateInput): Promise<MediaReference> {
    return this.prisma.mediaReference.create({ data });
  }

  listReferences(input: {
    moduleName: string;
    entityType: string;
    entityId: string;
  }): Promise<MediaReference[]> {
    return this.prisma.mediaReference.findMany({
      where: liveWhere(input),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  softDeleteReference(id: string): Promise<MediaReference> {
    return this.prisma.mediaReference.update({
      where: { id },
      data: softDeleteData(),
    });
  }
}
