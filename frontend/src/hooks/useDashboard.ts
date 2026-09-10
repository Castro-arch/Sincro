import { useQuery } from '@tanstack/react-query'
import { getVisaoGeral } from '@/api/dashboard'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'visao-geral'],
    queryFn: getVisaoGeral,
    refetchInterval: 60_000,
  })
}
