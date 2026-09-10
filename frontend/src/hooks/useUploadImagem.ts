import { useMutation } from '@tanstack/react-query'
import { enviarImagem } from '@/api/pictures'

/**
 * Cada arquivo sobe numa chamada própria. Sequencial no chamador, de
 * propósito: o volume é baixo e evita rate limit no ML.
 */
export function useUploadImagem() {
  return useMutation({ mutationFn: (arquivo: File) => enviarImagem(arquivo) })
}
