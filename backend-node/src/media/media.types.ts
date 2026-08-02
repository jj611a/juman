import type { MediaKind } from '../shared/constants/business.constants';
import type { MediaStorageCategory } from './media.constants';

export interface RegisterMediaInput {
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256Hash: string;
  readonly relativePath: string;
  readonly kind: MediaKind;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly orientation?: number | null;
  readonly storageProvider?: string;
  readonly isPublic?: boolean;
  readonly uploadedBy?: string | null;
  readonly createdBy?: string | null;
}

export interface SaveMediaInput {
  readonly buffer: Buffer;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly category?: MediaStorageCategory;
  readonly uploadedBy?: string | null;
  readonly createdBy?: string | null;
}

export interface AttachMediaInput {
  readonly mediaFileId: string;
  readonly moduleName: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly purpose: string;
  readonly displayOrder?: number;
  readonly isPrimary?: boolean;
  readonly createdBy?: string | null;
}

export interface ListMediaInput {
  readonly kind?: string;
  readonly extension?: string;
  readonly mimeType?: string;
  readonly q?: string;
  readonly deleted?: boolean | string;
  readonly sortBy?: string;
  readonly sortDir?: 'asc' | 'desc';
  readonly offset?: number;
  readonly limit?: number;
}

/** Public media DTO ? never includes absolute filesystem paths. */
export interface MediaFilePublic {
  readonly id: string;
  readonly originalFilename: string;
  readonly storedFilename: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly orientation: number | null;
  readonly kind: string;
  readonly isPublic: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly uploadedBy: string | null;
}
