import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi, type ListCustomersQuery, type CreateCustomerPayload, type UpdateCustomerPayload } from '../api/api'

export function useCustomersList(query: ListCustomersQuery) {
  return useQuery({
    queryKey: ['customers', query],
    queryFn: () => customersApi.list(query),
    placeholderData: (prev) => prev
  })
}

export function useCustomerDetail(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getById(id),
    enabled: Boolean(id)
  })
}

export function useCustomerRentals(id: string) {
  return useQuery({
    queryKey: ['customerRentals', id],
    queryFn: () => customersApi.getRentals(id),
    enabled: Boolean(id)
  })
}

export function useCustomerReservations(id: string) {
  return useQuery({
    queryKey: ['customerReservations', id],
    queryFn: () => customersApi.getReservations(id),
    enabled: Boolean(id)
  })
}

export function useCustomerOutstanding(id: string) {
  return useQuery({
    queryKey: ['customerOutstanding', id],
    queryFn: () => customersApi.getOutstanding(id),
    enabled: Boolean(id)
  })
}

export function useCustomerPayments(id: string) {
  return useQuery({
    queryKey: ['customerPayments', id],
    queryFn: () => customersApi.getPayments(id),
    enabled: Boolean(id)
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCustomerPayload) => customersApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    }
  })
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateCustomerPayload) => customersApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      void queryClient.invalidateQueries({ queryKey: ['customer', id] })
    }
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      void queryClient.invalidateQueries({ queryKey: ['customer', id] })
    }
  })
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customersApi.restore(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      void queryClient.invalidateQueries({ queryKey: ['customer', id] })
    }
  })
}
