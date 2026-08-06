import type { AxiosInstance, AxiosRequestConfig, Method } from 'axios'
import type { ApiBinaryResult, ApiInvokeRequest } from '../../shared/apiInvoke'
import type { AppError } from '../../shared/errors'
import { mapAxiosError, messageFromNestBody } from '../http/errors'

interface EnvelopeLike {
  success?: boolean
  error?: { code?: string; message?: string; details?: unknown }
  detail?: string
  statusCode?: number
  message?: string | string[]
}

function buildQuery(query?: ApiInvokeRequest['query']): Record<string, string> | undefined {
  if (!query) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = String(value)
  }
  return Object.keys(out).length ? out : undefined
}

function raiseFromBody(status: number, data: unknown): never {
  const body = data as EnvelopeLike | undefined
  if (body?.error?.code && body.error.message) {
    const err: AppError = {
      code: body.error.code,
      message: body.error.message,
      details: body.error.details
    }
    throw err
  }
  const nestMessage = messageFromNestBody(data)
  if (nestMessage) {
    throw {
      code: status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR',
      message: nestMessage
    } satisfies AppError
  }
  if (typeof body?.detail === 'string') {
    throw { code: 'HTTP_ERROR', message: body.detail } satisfies AppError
  }
  throw {
    code: status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR',
    message: 'فشل الطلب'
  } satisfies AppError
}

export async function executeApiInvoke(
  http: AxiosInstance,
  request: ApiInvokeRequest
): Promise<unknown> {
  const path = request.path.startsWith('/') ? request.path : `/${request.path}`
  const params = buildQuery(request.query)
  const method = request.method.toLowerCase() as Method

  try {
    if (request.multipart) {
      const bytes = new Uint8Array(Buffer.from(request.multipart.base64, 'base64'))
      const form = new FormData()
      const fieldName = request.multipart.fieldName ?? 'file'
      const blob = new Blob([bytes], { type: request.multipart.mimeType })
      form.append(fieldName, blob, request.multipart.fileName)
      if (request.multipart.fields) {
        for (const [k, v] of Object.entries(request.multipart.fields)) {
          form.append(k, v)
        }
      }
      const response = await http.request({
        method,
        url: path,
        params,
        data: form,
        validateStatus: () => true
      })
      if (response.status >= 400) {
        raiseFromBody(response.status, response.data)
      }
      return response.data
    }

    if (request.responseType === 'binary') {
      const response = await http.request<ArrayBuffer>({
        method,
        url: path,
        params,
        responseType: 'arraybuffer',
        validateStatus: () => true
      })
      if (response.status >= 400) {
        let parsed: unknown = undefined
        try {
          const text = Buffer.from(response.data as ArrayBuffer).toString('utf8')
          parsed = JSON.parse(text)
        } catch {
          parsed = undefined
        }
        raiseFromBody(response.status, parsed)
      }
      const mime =
        (response.headers['content-type'] as string | undefined)?.split(';')[0]?.trim() ||
        'application/octet-stream'
      const b64 = Buffer.from(response.data as ArrayBuffer).toString('base64')
      const result: ApiBinaryResult = {
        dataUrl: `data:${mime};base64,${b64}`,
        mimeType: mime
      }
      return result
    }

    const config: AxiosRequestConfig = {
      method,
      url: path,
      params,
      data: request.body,
      validateStatus: () => true
    }
    const response = await http.request(config)
    if (response.status >= 400) {
      raiseFromBody(response.status, response.data)
    }
    return response.data
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      typeof (error as AppError).code === 'string'
    ) {
      throw error
    }
    throw mapAxiosError(error)
  }
}
