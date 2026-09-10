import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useAtualizarEstoque } from '@/hooks/useAnuncios'
import { cn } from '@/lib/utils'

const CAMPO =
  'rounded-sm border bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink focus:outline-none'

/**
 * Estoque (e opcionalmente preço) de uma variação, salvos num único PUT.
 *
 * Um só componente para a linha da lista e para os detalhes: a regra de
 * "acompanhar o servidor quando o valor muda por fora" (baixa de pedido,
 * reversão após recusa do ML) vivia dentro da VariacaoLinha e teria que ser
 * copiada para a linha compacta -- e é o tipo de regra que diverge em silêncio.
 */
export function EditorEstoque({
  variationId,
  estoque,
  preco,
  comPreco = false,
  rotulo,
}: {
  variationId: string
  estoque: number
  preco: number
  comPreco?: boolean
  rotulo: string
}) {
  const [estoqueLocal, setEstoqueLocal] = useState(String(estoque))
  const [precoLocal, setPrecoLocal] = useState(preco.toFixed(2))
  const [ultimo, setUltimo] = useState({ estoque, preco })
  const atualizar = useAtualizarEstoque()

  // Ajuste durante o render (não em efeito): o servidor é a fonte de verdade.
  if (estoque !== ultimo.estoque || preco !== ultimo.preco) {
    setUltimo({ estoque, preco })
    setEstoqueLocal(String(estoque))
    setPrecoLocal(preco.toFixed(2))
  }

  const novoEstoque = Number(estoqueLocal)
  const novoPreco = Number(precoLocal)
  const estoqueInvalido = !Number.isInteger(novoEstoque) || novoEstoque < 0
  const precoInvalido = comPreco && !(novoPreco > 0)
  const mudou = novoEstoque !== estoque || (comPreco && novoPreco !== preco)
  const bloqueado = !mudou || estoqueInvalido || precoInvalido || atualizar.isPending

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {comPreco && (
          <span className="flex items-center gap-1 text-xs text-ink-faint">
            R$
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={precoLocal}
              onChange={(e) => setPrecoLocal(e.target.value)}
              aria-label={`Preço de ${rotulo}`}
              className={cn(CAMPO, 'w-24', precoInvalido ? 'border-danger' : 'border-line-strong focus:border-blue')}
            />
          </span>
        )}
        <input
          type="number"
          min={0}
          step={1}
          value={estoqueLocal}
          onChange={(e) => setEstoqueLocal(e.target.value)}
          aria-label={`Estoque de ${rotulo}`}
          className={cn(CAMPO, 'w-16', estoqueInvalido ? 'border-danger' : 'border-line-strong focus:border-blue')}
        />
        <Button
          variant="secondary"
          className="px-3 py-1 text-xs"
          disabled={bloqueado}
          onClick={() =>
            atualizar.mutate({
              variationId,
              estoque: novoEstoque,
              preco: comPreco ? novoPreco : undefined,
            })
          }
        >
          {atualizar.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
      {atualizar.isError && (
        <p className="text-xs text-danger-ink">
          {(atualizar.error as Error).message} — valor revertido no banco.
        </p>
      )}
    </div>
  )
}
