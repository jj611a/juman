import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi, type ListItemsQuery, type CreateItemPayload, type UpdateItemPayload } from '../api/api'

export function useItemsList(query: ListItemsQuery) {
  return useQuery({
    queryKey: ['items', query],
    queryFn: () => inventoryApi.list(query),
    placeholderData: (prev) => prev
  })
}

export function useItemDetail(id: string) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: () => inventoryApi.getById(id),
    enabled: Boolean(id)
  })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateItemPayload) => inventoryApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    }
  })
}

export function useUpdateItem(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateItemPayload) => inventoryApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['item', id] })
    }
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['item', id] })
    }
  })
}

export function useRestoreItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inventoryApi.restore(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['item', id] })
    }
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => inventoryApi.getCategories()
  })
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: () => inventoryApi.getBrands()
  })
}

export function useColors() {
  return useQuery({
    queryKey: ['colors'],
    queryFn: () => inventoryApi.getColors()
  })
}

export function useSizes() {
  return useQuery({
    queryKey: ['sizes'],
    queryFn: () => inventoryApi.getSizes()
  })
}

export function useItemAvailability(id: string) {
  return useQuery({
    queryKey: ['itemAvailability', id],
    queryFn: () => inventoryApi.getItemAvailability(id),
    enabled: Boolean(id)
  })
}
