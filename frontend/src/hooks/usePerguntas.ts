import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPendentes, getPerguntas, responderPergunta, sincronizarPerguntas } from '@/api/questions'

const CHAVE = ['perguntas']

export function usePerguntas(apenasPendentes: boolean) {
  return useQuery({
    queryKey: [...CHAVE, apenasPendentes ? 'pendentes' : 'todas'],
    queryFn: () => getPerguntas(apenasPendentes),
    // O polling do backend e de 2 min; a tela acompanha em 1 min.
    refetchInterval: 60_000,
  })
}

/** Contagem leve para o selo da sidebar -- mesmo padrao do useStatusMl. */
export function usePerguntasPendentes() {
  return useQuery({
    queryKey: [...CHAVE, 'contagem'],
    queryFn: getPendentes,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useResponderPergunta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) => responderPergunta(id, texto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useSincronizarPerguntas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sincronizarPerguntas,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  })
}
