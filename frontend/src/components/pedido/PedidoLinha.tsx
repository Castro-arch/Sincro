import type { Pedido } from '@/api/orders'
import { Badge } from '@/components/ui/Badge'
import { formatBRL, formatDataHora } from '@/lib/format'

const TOM_STATUS: Record<Pedido['status'], 'ok' | 'low' | 'out' | 'neutral'> = {
  pago: 'ok',
  pendente: 'low',
  cancelado: 'neutral',
}

export function PedidoLinha({ pedido }: { pedido: Pedido }) {
  /**
   * Pedido pago sem baixa aplicada é o sinal de que o anúncio vendido não
   * existe no Sincro (ou a variação não casou): o estoque local não foi
   * debitado e vai divergir do ML até alguém agir.
   */
  const baixaPendente = pedido.status === 'pago' && !pedido.estoqueBaixado

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-5 py-3.5">
      <span className="font-mono text-xs text-ink-faint">
        {formatDataHora(pedido.dataPedido)}
      </span>

      <span className="font-mono text-xs text-ink-faint">#{pedido.mlOrderId}</span>

      <div className="min-w-56 flex-1">
        <p className="text-sm leading-snug text-ink">
          {pedido.listing?.titulo ?? (
            <span className="text-ink-faint">
              Anúncio fora do Sincro ({pedido.mlItemId})
            </span>
          )}
        </p>
        {pedido.variation?.sku && (
          <p className="font-mono text-xs text-ink-faint">{pedido.variation.sku}</p>
        )}
      </div>

      <span className="font-mono text-sm tabular-nums text-ink-soft">
        {pedido.quantidade}x
      </span>

      <span className="font-mono text-sm tabular-nums text-ink">{formatBRL(pedido.valor)}</span>

      <Badge tone={TOM_STATUS[pedido.status]}>{pedido.status}</Badge>

      {baixaPendente && (
        <span className="font-mono text-xs text-warning-ink" title={`status no ML: ${pedido.statusMl}`}>
          estoque não baixado
        </span>
      )}
    </div>
  )
}
