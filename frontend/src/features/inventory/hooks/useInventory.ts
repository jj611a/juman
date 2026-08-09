import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  inventoryApi,
  type ListItemsQuery,
  type CreateItemPayload,
  type UpdateItemPayload,
  type CreateTaxonomyPayload,
  type TransitionItemPayload,
  type AttachItemMediaPayload,
  type GenerateBarcodePayload,
  type ListTaxonomyQuery,
} from '../api/api'

export const itemKeys = {
  all: ['items'] as const,
  list: (query: ListItemsQuery) => ['items', 'list', query] as const,
  detail: (id: string) => ['items', 'detail', id] as const,
  lifecycle: (id: string) => ['items', 'lifecycle', id] as const,
  history: (id: string) => ['items', 'history', id] as const,
}

export function useItemsList(query: ListItemsQuery) {
  return useQuery({
    queryKey: itemKeys.list(query),
    queryFn: () => inventoryApi.list(query),
    placeholderData: (prev) => prev,
  })
}

export function useItemDetail(id: string) {
  return useQuery({
    queryKey: itemKeys.detail(id),
    queryFn: () => inventoryApi.getById(id),
    enabled: Boolean(id),
  })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateItemPayload) => inventoryApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}

export function useUpdateItem(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateItemPayload) => inventoryApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.all })
      void queryClient.invalidateQueries({ queryKey: itemKeys.lifecycle(id) })
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.all })
      void queryClient.invalidateQueries({ queryKey: itemKeys.detail(id) })
    },
  })
}

export function useRestoreItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inventoryApi.restore(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.all })
      void queryClient.invalidateQueries({ queryKey: itemKeys.detail(id) })
    },
  })
}

// Lifecycle
export function useItemLifecycleState(id: string) {
  return useQuery({
    queryKey: itemKeys.lifecycle(id),
    queryFn: () => inventoryApi.lifecycleState(id),
    enabled: Boolean(id),
  })
}

export function useItemHistory(id: string, limit = 50) {
  return useQuery({
    queryKey: itemKeys.history(id),
    queryFn: () => inventoryApi.lifecycleHistory(id, { limit }),
    enabled: Boolean(id),
  })
}

export function useTransitionItem(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: TransitionItemPayload) =>
      inventoryApi.transition(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.lifecycle(id) })
      void queryClient.invalidateQueries({ queryKey: itemKeys.history(id) })
      void queryClient.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}

// Taxonomy
export function useCategories(query?: ListTaxonomyQuery) {
  return useQuery({
    queryKey: ['taxonomy', 'categories', query],
    queryFn: () => inventoryApi.getCategories(query),
  })
}

export function useBrands(query?: ListTaxonomyQuery) {
  return useQuery({
    queryKey: ['taxonomy', 'brands', query],
    queryFn: () => inventoryApi.getBrands(query),
  })
}

export function useColors(query?: ListTaxonomyQuery) {
  return useQuery({
    queryKey: ['taxonomy', 'colors', query],
    queryFn: () => inventoryApi.getColors(query),
  })
}

export function useSizes(query?: ListTaxonomyQuery) {
  return useQuery({
    queryKey: ['taxonomy', 'sizes', query],
    queryFn: () => inventoryApi.getSizes(query),
  })
}

const taxonomyCreators = {
  category: inventoryApi.createCategory,
  brand: inventoryApi.createBrand,
  color: inventoryApi.createColor,
  size: inventoryApi.createSize,
} as const

export type TaxonomyKind = keyof typeof taxonomyCreators

export function useCreateTaxonomy(kind: TaxonomyKind) {
  const queryClient = useQueryClient()
  const queryKey = ['taxonomy', `${kind}s`]
  return useMutation({
    mutationFn: (payload: CreateTaxonomyPayload) => taxonomyCreators[kind](payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateTaxonomyPayload }) =>
      inventoryApi.updateCategory(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['taxonomy', 'categories'] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inventoryApi.deleteCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['taxonomy', 'categories'] })
    },
  })
}

export function useRestoreCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inventoryApi.restoreCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['taxonomy', 'categories'] })
    },
  })
}

// Barcode
export function useBarcodes() {
  return useQuery({
    queryKey: ['barcodes', 'list'],
    queryFn: () => inventoryApi.listBarcodes({ limit: 200 }),
  })
}

export function useGenerateBarcode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: GenerateBarcodePayload) =>
      inventoryApi.generateBarcode(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['barcodes'] })
    },
  })
}

// Media
export function useMediaUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: { name: string; mimeType: string; buffer: ArrayBuffer }) =>
      inventoryApi.uploadMedia(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })
}

export function useAttachItemMedia(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AttachItemMediaPayload) =>
      inventoryApi.attachMedia(itemId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.all })
      void queryClient.invalidateQueries({ queryKey: itemKeys.detail(itemId) })
    },
  })
}

// Availability
export function useItemAvailability(id: string) {
  return useQuery({
    queryKey: ['availability', 'item', id],
    queryFn: () => inventoryApi.getItemAvailability(id),
    enabled: Boolean(id),
  })
}
