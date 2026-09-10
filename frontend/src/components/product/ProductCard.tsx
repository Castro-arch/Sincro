import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type StockTone = 'ok' | 'low' | 'out'

function stockTone(estoque: number): StockTone {
  if (estoque <= 0) return 'out'
  if (estoque <= 3) return 'low'
  return 'ok'
}

function stockLabel(estoque: number): string {
  return estoque <= 0 ? 'esgotado' : `${estoque} em estoque`
}

export interface ProductCardData {
  sku: string
  titulo: string
  precoFormatado: string
  estoque: number
  pictureId?: string
}

export function ProductCard({
  produto,
  onPublicar,
  onVerDetalhes,
}: {
  produto: ProductCardData
  onPublicar?: () => void
  onVerDetalhes?: () => void
}) {
  const tone = stockTone(produto.estoque)

  return (
    <div className="flex flex-col gap-2.5 bg-surface p-5">
      <div className="flex aspect-4/3 items-center justify-center rounded-sm border border-line bg-linear-to-br from-surface-raised to-base font-mono text-xs text-ink-faint">
        {produto.pictureId ?? produto.sku}
      </div>
      <p className="text-sm leading-snug text-ink">{produto.titulo}</p>
      <p className="font-mono text-lg font-semibold text-ink">{produto.precoFormatado}</p>
      <Badge tone={tone}>{stockLabel(produto.estoque)}</Badge>
      <div className="mt-1 flex items-center gap-3.5">
        <Button variant="primary" className="text-xs" onClick={onPublicar}>
          Publicar
        </Button>
        <button
          type="button"
          onClick={onVerDetalhes}
          className="text-xs text-blue-ink underline decoration-1 underline-offset-2"
        >
          ver detalhes
        </button>
      </div>
    </div>
  )
}
