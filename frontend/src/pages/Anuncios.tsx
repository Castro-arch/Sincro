import { AppShell } from '@/components/layout/AppShell'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ListingStatus } from '@/api/listings'
import { AnuncioCard } from '@/components/anuncio/AnuncioCard'
import { Button } from '@/components/ui/Button'
import { useAnuncios } from '@/hooks/useAnuncios'

type Filtro = 'todos' | ListingStatus

const FILTROS: Array<{ valor: Filtro; rotulo: string }> = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'rascunho', rotulo: 'Rascunhos' },
  { valor: 'pausado', rotulo: 'Pausados' },
  { valor: 'erro', rotulo: 'Com erro' },
  { valor: 'encerrado', rotulo: 'Encerrados' },
]

export function Anuncios() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const { data, isLoading, isError, error, refetch, isFetching } = useAnuncios()

  const anuncios = data ?? []
  const visiveis = filtro === 'todos' ? anuncios : anuncios.filter((a) => a.status === filtro)

  return (
    <AppShell
      acoes={
        <>
          <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Atualizando…' : 'Atualizar'}
          </Button>
          <Link
            to="/produtos/novo"
            className="rounded-sm bg-blue px-6 py-2.5 text-sm font-semibold text-ink-on-blue hover:bg-blue-pressed"
          >
            Novo produto
          </Link>
        </>
      }
    >

      <div className="flex flex-col gap-5 p-6">
        <nav className="flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const quantos =
              f.valor === 'todos'
                ? anuncios.length
                : anuncios.filter((a) => a.status === f.valor).length
            return (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltro(f.valor)}
                className={
                  filtro === f.valor
                    ? 'rounded-full border border-line-strong bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink'
                    : 'rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft hover:text-ink'
                }
              >
                {f.rotulo} <span className="font-mono text-ink-faint">{quantos}</span>
              </button>
            )
          })}
        </nav>

        {isLoading && <p className="text-sm text-ink-soft">Carregando anúncios…</p>}

        {isError && (
          <p className="text-sm text-danger-ink">
            Não deu pra carregar os anúncios: {(error as Error).message}
          </p>
        )}

        {data && visiveis.length === 0 && (
          <p className="cartao px-5 py-8 text-center text-sm text-ink-faint">
            {anuncios.length === 0
              ? 'Nenhum anúncio ainda. Comece cadastrando um produto.'
              : 'Nenhum anúncio neste filtro.'}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {visiveis.map((anuncio) => (
            <AnuncioCard key={anuncio.listingId} anuncio={anuncio} />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
