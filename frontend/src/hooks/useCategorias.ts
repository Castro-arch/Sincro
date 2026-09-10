import { useMutation, useQuery } from '@tanstack/react-query'
import { getAtributosDaCategoria, preverCategoria } from '@/api/categories'

/**
 * O predictor é sob demanda (o usuário digita o título e pede a sugestão),
 * então vale mais como mutation do que como query automática.
 */
export function usePreverCategoria() {
  return useMutation({ mutationFn: (titulo: string) => preverCategoria(titulo) })
}

/**
 * Atributos mudam pouco por categoria e o backend já tem cache de 1h;
 * aqui basta não refazer a chamada a cada re-render do formulário.
 */
export function useAtributosDaCategoria(categoriaId: string | null) {
  return useQuery({
    queryKey: ['categoria-atributos', categoriaId],
    queryFn: () => getAtributosDaCategoria(categoriaId as string),
    enabled: Boolean(categoriaId),
    staleTime: 60 * 60 * 1000,
  })
}
