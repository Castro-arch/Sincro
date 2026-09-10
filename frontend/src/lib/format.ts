import type { MlAttribute } from '@/api/types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatBRL(valor: number): string {
  return brl.format(valor)
}

export function formatSegundos(segundos: number): string {
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  if (horas > 0) return `${horas}h ${minutos}min`
  return `${minutos}min`
}

export function formatDataHora(iso: string | null): string {
  if (!iso) return '—'
  return dataHora.format(new Date(iso))
}

/**
 * "Cor: Azul / Tamanho: M" (ou "única" sem combinação) — replica
 * descreverAtributos() de dashboard.service.ts no backend. Duplicado de
 * propósito: nem todo endpoint devolve a versão já formatada.
 */
export function formatAtributos(atributos: MlAttribute[]): string {
  if (atributos.length === 0) return 'única'
  return atributos.map((a) => `${a.name ?? a.id}: ${a.value_name ?? ''}`).join(' / ')
}

/** "ha 12 min", "ha 3 h", "ha 2 d" -- idade de uma pergunta, curta. */
export function formatTempoDecorrido(iso: string, agora = Date.now()): string {
  const minutos = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000))
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 48) return `há ${horas} h`
  return `há ${Math.floor(horas / 24)} d`
}

/**
 * Severidade pela idade da pergunta. Criterio do SINCRO, nao prazo do ML:
 * a API nao expoe prazo por pergunta. Os limiares vem da unica referencia
 * que o ML da -- "responder em menos de 1 h aumenta as vendas".
 */
export function tomDoTempo(iso: string, agora = Date.now()): 'ok' | 'warning' | 'danger' {
  const horas = (agora - new Date(iso).getTime()) / 3_600_000
  if (horas >= 24) return 'danger'
  if (horas >= 1) return 'warning'
  return 'ok'
}
