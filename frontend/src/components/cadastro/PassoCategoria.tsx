import type { CategoriaSugerida } from '@/api/categories'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada } from '@/components/ui/Campo'
import { usePreverCategoria } from '@/hooks/useCategorias'

export function PassoCategoria({
  titulo,
  categoriaId,
  categoriaNome,
  onEscolher,
}: {
  titulo: string
  categoriaId: string | null
  categoriaNome: string | null
  onEscolher: (categoria: CategoriaSugerida | null) => void
}) {
  const prever = usePreverCategoria()
  const sugestoes = prever.data ?? []

  return (
    <section className="flex flex-col gap-4 border border-line bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">2. Categoria no Mercado Livre</h2>
        <p className="mt-1 text-xs text-ink-faint">
          A categoria decide quais atributos são obrigatórios, então ela vem antes do resto do
          formulário.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Campo label="Sugerir a partir do título">
            <Entrada value={titulo} readOnly placeholder="Preencha o título no passo 1" />
          </Campo>
        </div>
        <Button
          variant="secondary"
          disabled={titulo.trim().length < 3 || prever.isPending}
          onClick={() => prever.mutate(titulo.trim())}
        >
          {prever.isPending ? 'Consultando…' : 'Sugerir'}
        </Button>
      </div>

      {prever.isError && (
        <p className="text-xs text-danger">{(prever.error as Error).message}</p>
      )}

      {sugestoes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sugestoes.map((s) => (
            <li key={s.category_id}>
              <button
                type="button"
                onClick={() => onEscolher(s)}
                className={
                  categoriaId === s.category_id
                    ? 'flex w-full items-center justify-between rounded-sm border border-yellow bg-surface-raised px-3.5 py-2.5 text-left'
                    : 'flex w-full items-center justify-between rounded-sm border border-line px-3.5 py-2.5 text-left hover:border-line-strong'
                }
              >
                <span className="text-sm text-ink">{s.category_name}</span>
                <span className="font-mono text-xs text-ink-faint">{s.category_id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {categoriaId && (
        <p className="text-xs text-ink-soft">
          Escolhida: <span className="text-ink">{categoriaNome}</span>{' '}
          <span className="font-mono text-ink-faint">({categoriaId})</span>{' '}
          <button
            type="button"
            onClick={() => onEscolher(null)}
            className="text-blue underline decoration-1 underline-offset-2"
          >
            trocar
          </button>
        </p>
      )}
    </section>
  )
}
