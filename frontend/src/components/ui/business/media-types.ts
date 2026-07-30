/** Presentation-only media metadata. Parent supplies `src`; never fetch/upload here. */
export interface StoredFileMeta {
  id: string
  fileName?: string
  mimeType?: string
  /** Resolved URL or data URL provided by the parent. */
  src?: string
  alt?: string
}
