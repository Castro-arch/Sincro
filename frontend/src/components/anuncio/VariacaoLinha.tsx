import { useState } from 'react'
import type { VariacaoResumo } from '@/api/listings'
import { Button } from '@/components/ui/Button'
import { useAtualizarEstoque } from '@/hooks/useAnuncios'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

export function VariacaoLinha({
  variacao,
  editavel,
}: {
  variacao: VariacaoResumo
  editavel: boolean
}) {
  const [estoque, setEstoque] = useState(String(variacao.estoque))
  const [ultimoDoServidor, setUltimoDoServidor] = useState(variacao.estoque)
  const atualizar = useAtualizarEstoque()

  // O servidor é a fonte de verdade: quando o valor volta diferente (baixa por
  // pedido, ou reversão porque o ML recusou), o campo acompanha.
  //
  // Ajuste durante o render em vez de useEffect: sincronizar estado com prop
  // dentro de efeito dispara um segundo render em cascata, e o React
  // recomenda este padrão justamente para o caso "prop mudou, reinicia o
  // campo". Também evita apagar o que o usuário está digitando.
  if (variacao.estoque !== ultimoDoServidor) {
    setUltimoDoServidor(variacao.estoque)
    setEstoque(String(variacao.estoque))
  }

  const numero = Number(estoque)
  const invalido = !Number.isInteger(numero) || numero < 0
  const mudou = numero !== variacao.estoque

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
      <span className="min-w-40 flex-1 text-sm text-ink-soft">{variacao.descricaoAtributos}</span>

      <span className="font-mono text-xs text-ink-faint">{variacao.sku ?? '—'}</span>

      <span className="font-mono text-sm tabular-nums text-ink">{formatBRL(variacao.preco)}</span>

      {editavel ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={estoque}
            onChange={(e) => setEstoque(e.target.value)}
            aria-label={`Estoque de ${variacao.descricaoAtributos}`}
            className={cn(
              'w-20 rounded-sm border bg-surface-raised px-2 py-1 text-right font-mono text-sm tabular-nums text-ink',
              invalido ? 'border-danger' : 'border-line-strong focus:border-blue',
            )}
          />
          <Button
            variant="secondary"
            className="text-xs"
            disabled={!mudou || invalido || atualizar.isPending}
            onClick={() =>
              atualizar.mutate({ variationId: variacao.variationId, estoque: numero })
            }
          >
            {atualizar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      ) : (
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            variacao.estoque === 0
              ? 'text-danger-ink'
              : variacao.estoqueBaixo
                ? 'text-warning-ink'
                : 'text-ink',
          )}
        >
          {variacao.estoque} un.
        </span>
      )}

      {atualizar.isError && (
        <p className="w-full text-xs text-danger-ink">
          {(atualizar.error as Error).message} — o estoque foi revertido no banco.
        </p>
      )}
    </div>
  )
}
