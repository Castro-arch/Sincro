import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  atualizarCusto,
  atualizarProduto,
  getAnuncio,
  validarNoMl,
  type AtualizacaoProduto,
} from '@/api/listings'

export function useAnuncio(listingId: string | undefined) {
  return useQuery({
    queryKey: ['anuncio', listingId],
    queryFn: () => getAnuncio(listingId as string),
    enabled: Boolean(listingId),
  })
}

export function useAtualizarProduto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ listingId, dados }: { listingId: string; dados: AtualizacaoProduto }) =>
      atualizarProduto(listingId, dados),
    onSuccess: (_, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ['anuncio', listingId] })
      queryClient.invalidateQueries({ queryKey: ['anuncios'] })
      // Custo entra no cálculo de margem.
      queryClient.invalidateQueries({ queryKey: ['margem'] })
    },
  })
}

export function useAtualizarCusto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, custo }: { productId: string; custo: number | null }) =>
      atualizarCusto(productId, custo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anuncios'] })
      queryClient.invalidateQueries({ queryKey: ['margem'] })
    },
  })
}

/** Validação sob demanda: o usuário pergunta antes de publicar. */
export function useValidarNoMl() {
  return useMutation({
    mutationFn: ({ listingId, rascunho }: { listingId: string; rascunho: AtualizacaoProduto }) =>
      validarNoMl(listingId, rascunho),
  })
}
