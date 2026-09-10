import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPedidos, sincronizarPedidos } from '@/api/orders'

const QUERY_KEY = ['pedidos']

export function usePedidos(limite = 100) {
  return useQuery({
    queryKey: [...QUERY_KEY, limite],
    queryFn: () => getPedidos(limite),
    // O polling do backend roda a cada 5min; recarregar de minuto em minuto
    // mantém a tela próxima sem martelar a API.
    refetchInterval: 60_000,
  })
}

export function useSincronizarPedidos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sincronizarPedidos,
    onSuccess: () => {
      // A baixa de estoque muda anúncios e dashboard também.
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['anuncios'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
