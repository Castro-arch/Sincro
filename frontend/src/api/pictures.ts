import { apiPostForm } from '@/api/client'

// Espelha ImagemEnviada de src/mercado-livre/pictures/ml-picture.service.ts.
// O backend é só proxy: o arquivo vai direto pro ML e o que fica é o `id`.

export interface ImagemEnviada {
  /** É este id que entra em pictureIds do anúncio. */
  id: string
  url: string | null
  tamanhoOriginal: number
  nomeArquivo: string
}

/** O ML aceita apenas estes formatos — recusar antes evita erro tardio. */
export const FORMATOS_ACEITOS = ['image/jpeg', 'image/jpg', 'image/png']
export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024

export function enviarImagem(arquivo: File): Promise<ImagemEnviada> {
  const form = new FormData()
  form.append('file', arquivo)
  return apiPostForm<ImagemEnviada>('/ml/pictures/upload', form)
}
