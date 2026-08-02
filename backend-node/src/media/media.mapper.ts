import type { MediaFile } from '@prisma/client';
import type { MediaFilePublic } from './media.types';

export function toPublicMedia(file: MediaFile): MediaFilePublic {
  return {
    id: file.id,
    originalFilename: file.originalFilename,
    storedFilename: file.storedFilename,
    extension: file.extension,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    checksum: file.sha256Hash,
    width: file.width,
    height: file.height,
    orientation: file.orientation,
    kind: file.kind,
    isPublic: file.isPublic,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    deletedAt: file.deletedAt,
    createdBy: file.createdBy,
    uploadedBy: file.uploadedBy,
  };
}
