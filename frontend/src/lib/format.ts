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
