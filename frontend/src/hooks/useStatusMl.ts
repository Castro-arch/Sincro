import { useQuery } from '@tanstack/react-query'
import { getStatusMl } from '@/api/auth'

/**
 * Estado da conexão com o ML, usado pelo header em todas as telas.
 *
 * Vive num hook próprio (e não numa prop que cada página passa) porque o
 * header aparecia afirmando "ML conectado" por causa de um default, sem
 * ninguém ter checado: só o Dashboard passava o valor real.
 */
export function useStatusMl() {
  return useQuery({
    queryKey: ['ml-status'],
    queryFn: getStatusMl,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
