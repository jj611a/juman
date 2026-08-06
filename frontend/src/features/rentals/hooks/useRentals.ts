import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rentalsApi, type ListRentalsQuery, type CreateRentalPayload, type UpdateRentalPayload } from '../api/api'

export function useRentalsList(query: ListRentalsQuery) {
  return useQuery({
    queryKey: ['rentals', query],
    queryFn: () => rentalsApi.list(query),
    placeholderData: (prev) => prev
  })
}

export function useRentalDetail(id: string) {
  return useQuery({
    queryKey: ['rental', id],
    queryFn: () => rentalsApi.getById(id),
    enabled: Boolean(id)
  })
}

export function useCreateRental() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRentalPayload) => rentalsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
    }
  })
}

export function useUpdateRental(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateRentalPayload) => rentalsApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['rental', id] })
    }
  })
}

export function useCheckoutRental(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { reason?: string; depositAmountFils?: number }) => 
      rentalsApi.checkout(id, args.reason, args.depositAmountFils),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['rental', id] })
    }
  })
}

export function useReturnRental(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) => rentalsApi.return(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['rental', id] })
    }
  })
}

export function useCompleteRental(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) => rentalsApi.complete(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['rental', id] })
    }
  })
}

export function useCancelRental(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) => rentalsApi.cancel(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['rental', id] })
    }
  })
}
