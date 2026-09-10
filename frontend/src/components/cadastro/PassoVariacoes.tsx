import type { AtributoDaCategoria } from '@/api/categories'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada, Selecao } from '@/components/ui/Campo'
import { useAtributosDaCategoria } from '@/hooks/useCategorias'

export interface VariacaoForm {
  chave: string
  sku: string
  /** id do atributo -> value_name escolhido. */
  valores: Record<string, string>
  preco: string
  estoque: string
}

export function PassoVariacoes({
  categoriaId,
  eixos,
  variacoes,
  onMudarEixos,
  onMudarVariacoes,
}: {
  categoriaId: string | null
  eixos: string[]
  variacoes: VariacaoForm[]
  onMudarEixos: (eixos: string[]) => void
  onMudarVariacoes: (variacoes: VariacaoForm[]) => void
}) {
  const { data } = useAtributosDaCategoria(categoriaId)
  const disponiveis = (data ?? []).filter((a) => a.usadoEmVariacoes)
  const escolhidos = disponiveis.filter((a) => eixos.includes(a.id))

  function alternarEixo(id: string) {
    const novos = eixos.includes(id) ? eixos.filter((e) => e !== id) : [...eixos, id]
    onMudarEixos(novos)
    // Limpa valores de eixos que saíram, senão viajam escondidos no payload.
    onMudarVariacoes(
      variacoes.map((v) => ({
        ...v,
        valores: Object.fromEntries(novos.map((e) => [e, v.valores[e] ?? ''])),
      })),
    )
  }

  function atualizar(chave: string, campo: Partial<VariacaoForm>) {
    onMudarVariacoes(variacoes.map((v) => (v.chave === chave ? { ...v, ...campo } : v)))
  }

  // O ML recusa duas variações com a mesma combinação, e no banco isso viraria
  // estoque ambíguo — melhor avisar aqui do que descobrir na publicação.
  const assinaturas = variacoes.map((v) =>
    eixos
      .map((e) => v.valores[e] ?? '')
      .join('|')
      .toLowerCase(),
  )
  const duplicadas = new Set(assinaturas.filter((a, i) => a && assinaturas.indexOf(a) !== i))

  return (
    <section className="flex flex-col gap-4 border border-line bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">5. Variações, preço e estoque</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Sem nenhum eixo marcado, o anúncio sai como item único. Preço e estoque são sempre por
          variação.
        </p>
      </div>

      {disponiveis.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {disponiveis.map((attr) => (
            <button
              key={attr.id}
              type="button"
              onClick={() => alternarEixo(attr.id)}
              className={
                eixos.includes(attr.id)
                  ? 'rounded-full border border-yellow bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink'
                  : 'rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink'
              }
            >
              {attr.nome}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {variacoes.map((v, indice) => (
          <div
            key={v.chave}
            className="grid grid-cols-1 gap-3 border border-line bg-surface-raised p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {escolhidos.map((attr) => (
              <ValorDoEixo
                key={attr.id}
                atributo={attr}
                valor={v.valores[attr.id] ?? ''}
                onMudar={(valor) =>
                  atualizar(v.chave, { valores: { ...v.valores, [attr.id]: valor } })
                }
              />
            ))}

            <Campo label="SKU da variação">
              <Entrada
                value={v.sku}
                onChange={(e) => atualizar(v.chave, { sku: e.target.value })}
                placeholder="opcional"
              />
            </Campo>

            <Campo label="Preço (R$)" obrigatorio>
              <Entrada
                type="number"
                min="0.01"
                step="0.01"
                value={v.preco}
                onChange={(e) => atualizar(v.chave, { preco: e.target.value })}
              />
            </Campo>

            <Campo label="Estoque" obrigatorio>
              <Entrada
                type="number"
                min="0"
                step="1"
                value={v.estoque}
                onChange={(e) => atualizar(v.chave, { estoque: e.target.value })}
              />
            </Campo>

            {variacoes.length > 1 && (
              <button
                type="button"
                onClick={() => onMudarVariacoes(variacoes.filter((x) => x.chave !== v.chave))}
                className="self-end text-xs text-blue underline decoration-1 underline-offset-2"
              >
                remover variação {indice + 1}
              </button>
            )}
          </div>
        ))}
      </div>

      {duplicadas.size > 0 && (
        <p className="text-xs text-danger">
          Há variações com a mesma combinação de atributos — o Mercado Livre recusa isso.
        </p>
      )}

      {eixos.length > 0 && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() =>
            onMudarVariacoes([
              ...variacoes,
              {
                chave: crypto.randomUUID(),
                sku: '',
                valores: Object.fromEntries(eixos.map((e) => [e, ''])),
                preco: '',
                estoque: '',
              },
            ])
          }
        >
          Adicionar variação
        </Button>
      )}
    </section>
  )
}

function ValorDoEixo({
  atributo,
  valor,
  onMudar,
}: {
  atributo: AtributoDaCategoria
  valor: string
  onMudar: (valor: string) => void
}) {
  const lista = atributo.valoresPermitidos

  return (
    <Campo label={atributo.nome} obrigatorio>
      {lista && lista.length > 0 ? (
        <Selecao value={valor} onChange={(e) => onMudar(e.target.value)}>
          <option value="">Selecione…</option>
          {lista.map((v) => (
            <option key={v.id} value={v.nome}>
              {v.nome}
            </option>
          ))}
        </Selecao>
      ) : (
        <Entrada value={valor} onChange={(e) => onMudar(e.target.value)} />
      )}
    </Campo>
  )
}
