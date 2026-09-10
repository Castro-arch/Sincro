import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AnuncioResumo, ListingStatus } from '@/api/listings'
import { AnuncioLinha, GRADE_ANUNCIO } from '@/components/anuncio/AnuncioLinha'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Entrada, Selecao } from '@/components/ui/Campo'
import { IconeLupa } from '@/components/ui/Icone'
import { useAnuncios } from '@/hooks/useAnuncios'
import { cn } from '@/lib/utils'

type Aba = 'todos' | ListingStatus
type Ordem = 'recentes' | 'preco' | 'estoque' | 'titulo'

const ABAS: Array<{ valor: Aba; rotulo: string }> = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'pausado', rotulo: 'Pausados' },
  { valor: 'rascunho', rotulo: 'Rascunhos' },
  { valor: 'erro', rotulo: 'Com erro' },
  { valor: 'encerrado', rotulo: 'Encerrados' },
]

const ORDENS: Array<{ valor: Ordem; rotulo: string }> = [
  { valor: 'recentes', rotulo: 'Mais recentes' },
  { valor: 'estoque', rotulo: 'Menor estoque' },
  { valor: 'preco', rotulo: 'Menor preço' },
  { valor: 'titulo', rotulo: 'Título (A–Z)' },
]

function ordenar(lista: AnuncioResumo[], ordem: Ordem): AnuncioResumo[] {
  const copia = [...lista]
  switch (ordem) {
    case 'estoque':
      return copia.sort((a, b) => a.estoqueTotal - b.estoqueTotal)
    case 'preco':
      return copia.sort((a, b) => (a.precoMinimo ?? Infinity) - (b.precoMinimo ?? Infinity))
    case 'titulo':
      return copia.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
    default:
      // A API já devolve do mais recente para o mais antigo.
      return copia
  }
}

export function Anuncios() {
  const [params, setParams] = useSearchParams()
  const abaDaUrl = params.get('status') as Aba | null
  const aba: Aba = abaDaUrl && ABAS.some((a) => a.valor === abaDaUrl) ? abaDaUrl : 'todos'
  const setAba = (valor: Aba) =>
    setParams(valor === 'todos' ? {} : { status: valor }, { replace: true })
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('recentes')
  const { data, isLoading, isError, error, refetch, isFetching } = useAnuncios()

  const anuncios = data ?? []

  // Depende de `data`, não de `anuncios`: o `?? []` cria um array novo a cada
  // render enquanto carrega, o que invalidaria o memo sempre.
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const filtrados = (data ?? []).filter(
      (a) =>
        (aba === 'todos' || a.status === aba) &&
        (termo === '' ||
          a.titulo.toLowerCase().includes(termo) ||
          a.sku.toLowerCase().includes(termo) ||
          (a.mlItemId ?? '').toLowerCase().includes(termo)),
    )
    return ordenar(filtrados, ordem)
  }, [data, aba, busca, ordem])

  const contagem = (valor: Aba) =>
    valor === 'todos' ? anuncios.length : anuncios.filter((a) => a.status === valor).length

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
        <h1 className="font-display text-2xl font-extrabold text-ink">Anúncios</h1>

        <section className="cartao">
          {/* Abas com sublinhado, como as da lista de anúncios do painel. */}
          <nav className="flex gap-1 overflow-x-auto border-b border-line px-3">
            {ABAS.map((a) => (
              <button
                key={a.valor}
                type="button"
                onClick={() => setAba(a.valor)}
                className={cn(
                  '-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors',
                  aba === a.valor
                    ? 'border-blue font-semibold text-blue-ink'
                    : 'border-transparent text-ink-soft hover:text-ink',
                )}
              >
                {a.rotulo} <span className="text-ink-faint">{contagem(a.valor)}</span>
              </button>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="relative min-w-64 flex-1">
              <IconeLupa className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Entrada
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nesta lista por título, SKU ou ID do ML"
                aria-label="Buscar anúncios"
                className="pl-9"
              />
            </div>
            <Selecao
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              aria-label="Ordenar por"
              className="w-auto"
            >
              {ORDENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
            <span className="text-xs text-ink-faint">
              {visiveis.length} de {anuncios.length}
            </span>
          </div>

          {isLoading && (
            <ul aria-busy="true" aria-label="Carregando anúncios">
              {[0, 1, 2].map((i) => (
                <li key={i} className={cn(GRADE_ANUNCIO, 'animate-pulse border-t border-line py-4')}>
                  <span className="h-14 w-14 rounded-sm bg-surface-raised" />
                  <span className="flex flex-col gap-2">
                    <span className="h-3.5 w-2/3 rounded-sm bg-surface-raised" />
                    <span className="h-3 w-1/3 rounded-sm bg-surface-raised" />
                  </span>
                  <span className="h-3.5 w-16 rounded-sm bg-surface-raised" />
                  <span className="h-3.5 w-10 rounded-sm bg-surface-raised" />
                  <span className="h-5 w-16 rounded-full bg-surface-raised" />
                  <span />
                </li>
              ))}
            </ul>
          )}
          {isError && (
            <p className="border-t border-line px-5 py-6 text-sm text-danger-ink">
              Não deu pra carregar os anúncios: {(error as Error).message}
            </p>
          )}

          {data && visiveis.length === 0 && (
            <div className="flex flex-col items-center gap-3 border-t border-line px-5 py-10 text-center">
              <p className="text-sm text-ink-soft">
                {anuncios.length === 0
                  ? 'Nenhum anúncio ainda.'
                  : 'Nada aqui com esse filtro ou busca.'}
              </p>
              {anuncios.length === 0 ? (
                <Link
                  to="/produtos/novo"
                  className="rounded-sm bg-blue px-6 py-2.5 text-sm font-semibold text-ink-on-blue hover:bg-blue-pressed"
                >
                  Cadastrar o primeiro produto
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAba('todos')
                    setBusca('')
                  }}
                  className="text-sm text-blue-ink underline decoration-1 underline-offset-2"
                >
                  limpar filtro e busca
                </button>
              )}
            </div>
          )}

          {visiveis.length > 0 && (
            <>
              <div className={cn(GRADE_ANUNCIO, 'border-t border-line py-2 text-xs font-semibold tracking-wide text-ink-faint uppercase')}>
                <span />
                <span>Anúncio</span>
                <span>Preço</span>
                <span>Estoque</span>
                <span>Status</span>
                <span />
              </div>
              <ul>
                {visiveis.map((anuncio) => (
                  <AnuncioLinha key={anuncio.listingId} anuncio={anuncio} />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}
