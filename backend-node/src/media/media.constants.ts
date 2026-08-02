export const MEDIA_MODULE = 'media';
export const MEDIA_ENTITY_FILE = 'media_file';
export const MEDIA_ENTITY_REFERENCE = 'media_reference';

export const MEDIA_PERMISSION = {
  VIEW: 'media.view',
  UPLOAD: 'media.upload',
  DELETE: 'media.delete',
  MANAGE: 'media.manage',
  RESTORE: 'media.restore',
} as const;

/** Top-level folders under the configured storage root. */
export const MEDIA_STORAGE_CATEGORY = {
  IMAGES: 'images',
  DOCUMENTS: 'documents',
  TEMP: 'temp',
  THUMBNAILS: 'thumbnails',
  IMPORTS: 'imports',
  EXPORTS: 'exports',
} as const;

export type MediaStorageCategory =
  (typeof MEDIA_STORAGE_CATEGORY)[keyof typeof MEDIA_STORAGE_CATEGORY];

export const MEDIA_STORAGE_CATEGORIES = Object.values(MEDIA_STORAGE_CATEGORY);

export const MEDIA_SETTING = {
  MAX_UPLOAD_BYTES: 'media.max_upload_bytes',
  ALLOWED_EXTENSIONS: 'media.allowed_extensions',
  ALLOWED_MIME_TYPES: 'media.allowed_mime_types',
} as const;

export const MEDIA_DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MEDIA_ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'pdf',
  'docx',
  'xlsx',
  'txt',
  'csv',
] as const;

export const MEDIA_EXTENSION_MIME: Readonly<Record<string, readonly string[]>> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  bmp: ['image/bmp'],
  pdf: ['application/pdf'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain', 'application/csv'],
};

export const MEDIA_DANGEROUS_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'com',
  'cpl',
  'scr',
  'msi',
  'dll',
  'js',
  'jse',
  'vbs',
  'vbe',
  'wsf',
  'wsh',
  'ps1',
  'psm1',
  'sh',
  'bash',
  'php',
  'asp',
  'aspx',
  'jar',
  'apk',
  'bin',
] as const;

export const MEDIA_SORT_FIELDS = ['createdAt', 'updatedAt', 'originalFilename', 'sizeBytes'] as const;
export type MediaSortField = (typeof MEDIA_SORT_FIELDS)[number];
