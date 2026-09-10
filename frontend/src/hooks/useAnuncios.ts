import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alterarStatusListing, getAnuncios, publicarListing } from '@/api/listings'
import type { StatusMl } from '@/api/types'

const QUERY_KEY = ['anuncios']

export function useAnuncios() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: () => getAnuncios() })
}

export function usePublicarListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: publicarListing,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useAlterarStatusListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ listingId, status }: { listingId: string; status: StatusMl }) =>
      alterarStatusListing(listingId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
