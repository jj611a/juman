import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reservationsApi, type ListReservationsQuery, type CreateReservationPayload } from '../api/api'

export function useReservationsList(query: ListReservationsQuery) {
  return useQuery({
    queryKey: ['reservations', query],
    queryFn: () => reservationsApi.list(query),
    placeholderData: (prev) => prev
  })
}

export function useReservationDetail(id: string) {
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: () => reservationsApi.getById(id),
    enabled: Boolean(id)
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateReservationPayload) => reservationsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations'] })
    }
  })
}

export function useCheckoutReservation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { reason?: string; depositAmountFils?: number }) => 
      reservationsApi.checkout(id, args.reason, args.depositAmountFils),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations'] })
      void queryClient.invalidateQueries({ queryKey: ['reservation', id] })
    }
  })
}

export function useCancelReservation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) => reservationsApi.cancel(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations'] })
      void queryClient.invalidateQueries({ queryKey: ['reservation', id] })
    }
  })
}

export function useExpireReservation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) => reservationsApi.expire(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations'] })
      void queryClient.invalidateQueries({ queryKey: ['reservation', id] })
    }
  })
}
