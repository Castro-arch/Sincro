/**
 * URL pública de uma imagem hospedada no Mercado Livre a partir do id.
 *
 * Padrão observado na resposta real do upload (2026-09-09):
 *   id  944089-MLB115956017250_092026
 *   url https://http2.mlstatic.com/D_NQ_NP_944089-MLB115956017250_092026-F.jpg
 * O sufixo é o tamanho: F = 1920px, O = 500px, C = 400px. Para miniatura,
 * O basta e pesa menos.
 */
export function urlDaImagemMl(id: string, tamanho: 'F' | 'O' | 'C' = 'O'): string {
  return `https://http2.mlstatic.com/D_NQ_NP_${id}-${tamanho}.jpg`
}
