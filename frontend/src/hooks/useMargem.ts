import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { definirImposto, getImposto, getMargem } from '@/api/margem'

const CHAVE = ['margem']

export function useMargem(dias: number) {
  return useQuery({ queryKey: [...CHAVE, dias], queryFn: () => getMargem(dias) })
}

export function useImposto() {
  return useQuery({ queryKey: ['imposto'], queryFn: getImposto })
}

export function useDefinirImposto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: definirImposto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imposto'] })
      // O relatório inteiro é recalculado com o novo percentual.
      queryClient.invalidateQueries({ queryKey: CHAVE })
    },
  })
}
