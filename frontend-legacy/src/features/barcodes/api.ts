import { apiClient } from '@/services/apiClient'
import type {
  BarcodeGenerateBody,
  BarcodeListParams,
  BarcodeReserveBody,
  BarcodeValidateBody,
  BarcodeValueBody
} from '@/services/domainTypes'

export const barcodeKeys = {
  all: ['barcodes'] as const,
  lists: () => [...barcodeKeys.all, 'list'] as const,
  list: (params: BarcodeListParams) => [...barcodeKeys.lists(), params] as const
}

export const barcodesApi = {
  list: (params?: BarcodeListParams) => apiClient.barcodes.list(params),
  generate: (body?: BarcodeGenerateBody) => apiClient.barcodes.generate(body),
  validate: (body: BarcodeValidateBody) => apiClient.barcodes.validate(body),
  reserve: (body?: BarcodeReserveBody) => apiClient.barcodes.reserve(body),
  release: (body: BarcodeValueBody) => apiClient.barcodes.release(body),
  retire: (body: BarcodeValueBody) => apiClient.barcodes.retire(body)
}
