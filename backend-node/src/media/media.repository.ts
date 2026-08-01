import { Injectable } from '@nestjs/common';
import type { MediaFile, MediaReference } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { liveWhere, softDeleteData } from '../shared/soft-delete/soft-delete';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  createFile(data: {
    originalFilename: string;
    storedFilename: string;
    extension: string;
    mimeType: string;
    sizeBytes: number;
    sha256Hash: string;
    storageProvider: string;
    relativePath: string;
    kind: string;
    isPublic: boolean;
    uploadedBy: string | null;
    createdBy: string | null;
  }): Promise<MediaFile> {
    return this.prisma.mediaFile.create({ data });
  }

  findFileById(id: string): Promise<MediaFile | null> {
    return this.prisma.mediaFile.findFirst({ where: liveWhere({ id }) });
  }

  findFilesByHash(sha256Hash: string): Promise<MediaFile[]> {
    return this.prisma.mediaFile.findMany({ where: liveWhere({ sha256Hash }) });
  }

  softDeleteFile(id: string): Promise<MediaFile> {
    return this.prisma.mediaFile.update({
      where: { id },
      data: softDeleteData(),
    });
  }

  createReference(data: {
    mediaFileId: string;
    moduleName: string;
    entityType: string;
    entityId: string;
    purpose: string;
    displayOrder: number;
    isPrimary: boolean;
    createdBy: string | null;
  }): Promise<MediaReference> {
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