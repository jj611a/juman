/** Generic REST invoke payload (renderer → Main Axios). */
export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiInvokeMultipart {
  /** Form field name for the file (default: file). */
  fieldName?: string
  fileName: string
  mimeType: string
  /** Raw file bytes as base64 (no data-URL prefix). */
  base64: string
  /** Extra multipart text fields. */
  fields?: Record<string, string>
}

export interface ApiInvokeRequest {
  method: ApiHttpMethod
  /** Path relative to API base, e.g. "/categories". */
  path: string
  query?: Record<string, string | number | boolean | null | undefined> | object
  body?: unknown
  multipart?: ApiInvokeMultipart
  /** When "binary", Main returns a data URL instead of JSON. */
  responseType?: 'json' | 'binary'
}

export interface ApiBinaryResult {
  dataUrl: string
  mimeType: string
  fileName?: string
}
