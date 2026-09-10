import { Badge } from '@/components/ui/Badge'
import type { AlertaEstoque } from '@/api/dashboard'

export function AlertRow({ alerta }: { alerta: AlertaEstoque }) {
  const tone = alerta.severidade === 'sem-estoque' ? 'out' : 'low'
  const label = alerta.severidade === 'sem-estoque' ? 'esgotado' : `${alerta.estoque} em estoque`

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-ink">{alerta.titulo}</span>
        <span className="font-mono text-xs text-ink-faint">
          {alerta.sku ?? alerta.variationId} · {alerta.descricaoAtributos}
        </span>
      </div>
      <Badge tone={tone}>{label}</Badge>
    </div>
  )
}
