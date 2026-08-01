import type { MediaKind } from '../shared/constants/business.constants';

export interface RegisterMediaInput {
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256Hash: string;
  readonly relativePath: string;
  readonly kind: MediaKind;
  readonly storageProvider?: string;
  readonly isPublic?: boolean;
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