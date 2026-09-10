import { apiGet, apiPost } from '@/api/client'

// Espelha Order de src/orders/entities/order.entity.ts e ResultadoSincronizacao
// de src/orders/orders.service.ts no backend. Datas chegam como string (JSON).

export type OrderStatus = 'pago' | 'pendente' | 'cancelado'

/** Relations que GET /orders traz junto (podem vir nulas). */
interface VariacaoDoPedido {
  id: string
  sku: string | null
  estoque: number
}

interface AnuncioDoPedido {
  id: string
  titulo: string
  mlItemId: string | null
  permalink: string | null
}

export interface Pedido {
  id: string
  mlOrderId: string
  mlItemId: string
  mlVariationId: string
  variationId: string | null
  listingId: string | null
  quantidade: number
  valor: number
  status: OrderStatus
  statusMl: string | null
  /** Falso quando o pedido chegou mas o estoque ainda não foi debitado. */
  estoqueBaixado: boolean
  dataPedido: string | null
  criadoEm: string
  variation: VariacaoDoPedido | null
  listing: AnuncioDoPedido | null
}

export interface ResultadoSincronizacao {
  pedidosLidos: number
  itensNovos: number
  baixasAplicadas: number
  estornosAplicados: number
  anunciosSincronizados: number
  /** Itens de pedido cujo anúncio não existe no Sincro — estoque não mexido. */
  ignorados: number
}

export function getPedidos(limite = 100): Promise<Pedido[]> {
  return apiGet<Pedido[]>(`/orders?limite=${limite}`)
}

export function sincronizarPedidos(): Promise<ResultadoSincronizacao> {
  return apiPost<ResultadoSincronizacao>('/orders/sync')
}
