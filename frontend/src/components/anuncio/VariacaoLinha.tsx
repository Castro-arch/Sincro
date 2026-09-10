import type { VariacaoResumo } from '@/api/listings'
import { EditorEstoque } from '@/components/anuncio/EditorEstoque'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

export function VariacaoLinha({
  variacao,
  editavel,
}: {
  variacao: VariacaoResumo
  editavel: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
      <span className="min-w-40 flex-1 text-sm text-ink">{variacao.descricaoAtributos}</span>
      <span className="text-xs text-ink-faint">{variacao.sku ?? '—'}</span>

      {editavel ? (
        <EditorEstoque
          variationId={variacao.variationId}
          estoque={variacao.estoque}
          preco={variacao.preco}
          comPreco
          rotulo={variacao.descricaoAtributos}
        />
      ) : (
        <>
          <span className="text-sm font-semibold text-ink">{formatBRL(variacao.preco)}</span>
          <span
            className={cn(
              'text-sm tabular-nums',
              variacao.estoque === 0
                ? 'text-danger-ink'
                : variacao.estoqueBaixo
                  ? 'text-warning-ink'
                  : 'text-ink',
            )}
          >
            {variacao.estoque} un.
          </span>
        </>
      )}
    </div>
  )
}
