import type { AtributoDaCategoria } from '@/api/categories'
import { Campo, Entrada, Selecao } from '@/components/ui/Campo'
import { useAtributosDaCategoria } from '@/hooks/useCategorias'

export function PassoAtributos({
  categoriaId,
  valores,
  eixosDeVariacao,
  onMudar,
}: {
  categoriaId: string | null
  valores: Record<string, string>
  /** Atributos que viram variação — o valor deles vai na combinação, não aqui. */
  eixosDeVariacao: string[]
  onMudar: (id: string, valor: string) => void
}) {
  const { data, isLoading, isError, error } = useAtributosDaCategoria(categoriaId)

  const obrigatorios = (data ?? []).filter(
    (a) => a.obrigatorio && !eixosDeVariacao.includes(a.id),
  )

  return (
    <section className="flex flex-col gap-4 border border-line bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">3. Atributos exigidos pela categoria</h2>
        <p className="mt-1 text-xs text-ink-faint">
          O Sincro confere estes antes de publicar. Mesmo assim o ML pode recusar por exigência
          condicional (que depende do valor de outro atributo) — essas não aparecem nesta lista.
        </p>
      </div>

      {!categoriaId && (
        <p className="text-xs text-ink-faint">Escolha a categoria para ver o que ela exige.</p>
      )}

      {isLoading && <p className="text-xs text-ink-soft">Consultando o Mercado Livre…</p>}

      {isError && <p className="text-xs text-danger">{(error as Error).message}</p>}

      {obrigatorios.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {obrigatorios.map((attr) => (
            <AtributoCampo
              key={attr.id}
              atributo={attr}
              valor={valores[attr.id] ?? ''}
              onMudar={(v) => onMudar(attr.id, v)}
            />
          ))}
        </div>
      )}

      {data && obrigatorios.length === 0 && categoriaId && (
        <p className="text-xs text-ink-soft">
          Nenhum atributo obrigatório além dos que você definiu como variação.
        </p>
      )}
    </section>
  )
}

function AtributoCampo({
  atributo,
  valor,
  onMudar,
}: {
  atributo: AtributoDaCategoria
  valor: string
  onMudar: (valor: string) => void
}) {
  const temLista = atributo.valoresPermitidos && atributo.valoresPermitidos.length > 0

  return (
    <Campo label={atributo.nome} obrigatorio dica={atributo.dica}>
      {temLista ? (
        <Selecao value={valor} onChange={(e) => onMudar(e.target.value)}>
          <option value="">Selecione…</option>
          {atributo.valoresPermitidos?.map((v) => (
            <option key={v.id} value={v.nome}>
              {v.nome}
            </option>
          ))}
        </Selecao>
      ) : (
        <Entrada
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          placeholder="texto livre"
        />
      )}
    </Campo>
  )
}
