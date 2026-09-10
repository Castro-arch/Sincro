import { useState } from 'react'
import type { AnuncioResumo } from '@/api/listings'
import { StatusAnuncio } from '@/components/anuncio/StatusAnuncio'
import { VariacaoLinha } from '@/components/anuncio/VariacaoLinha'
import { Button } from '@/components/ui/Button'
import { useAlterarStatusListing, usePublicarListing } from '@/hooks/useAnuncios'
import { formatBRL, formatDataHora } from '@/lib/format'
import { urlDaImagemMl } from '@/lib/imagem'
import { cn } from '@/lib/utils'

/** Colunas da lista — a mesma grade é usada pelo cabeçalho na página. */
export const GRADE_ANUNCIO =
  'grid grid-cols-[56px_minmax(0,1fr)_120px_110px_110px_auto] items-center gap-4 px-5'

export function AnuncioLinha({ anuncio }: { anuncio: AnuncioResumo }) {
  const [aberto, setAberto] = useState(false)
  const publicar = usePublicarListing()
  const alterarStatus = useAlterarStatusListing()

  const publicado = Boolean(anuncio.mlItemId)
  const ocupado = publicar.isPending || alterarStatus.isPending
  const erro = (publicar.error ?? alterarStatus.error) as Error | null

  return (
    <li className="border-t border-line">
      <div className={cn(GRADE_ANUNCIO, 'py-3.5')}>
        <Miniatura anuncio={anuncio} />

        <div className="min-w-0">
          <p className="truncate text-sm text-ink" title={anuncio.titulo}>
            {anuncio.titulo}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-faint">
            {anuncio.sku}
            {anuncio.mlItemId && <> · {anuncio.mlItemId}</>}
            {' · '}sincronizado {formatDataHora(anuncio.sincronizadoEm)}
          </p>
        </div>

        <span className="text-sm font-semibold text-ink">
          {anuncio.precoMinimo === null ? '—' : formatBRL(anuncio.precoMinimo)}
        </span>

        <span
          className={cn(
            'text-sm',
            anuncio.semEstoque
              ? 'font-semibold text-danger-ink'
              : anuncio.temEstoqueBaixo
                ? 'font-semibold text-warning-ink'
                : 'text-ink-soft',
          )}
        >
          {anuncio.estoqueTotal} un.
        </span>

        <StatusAnuncio status={anuncio.status} />

        <div className="flex items-center justify-end gap-2">
          {!publicado && (
            <Button
              className="px-3.5 py-1.5 text-xs"
              disabled={ocupado}
              onClick={() => publicar.mutate(anuncio.listingId)}
            >
              {publicar.isPending ? 'Publicando…' : 'Publicar'}
            </Button>
          )}
          {publicado && anuncio.status === 'ativo' && (
            <Button
              variant="secondary"
              className="px-3.5 py-1.5 text-xs"
              disabled={ocupado}
              onClick={() => alterarStatus.mutate({ listingId: anuncio.listingId, status: 'paused' })}
            >
              Pausar
            </Button>
          )}
          {publicado && anuncio.status === 'pausado' && (
            <Button
              className="px-3.5 py-1.5 text-xs"
              disabled={ocupado}
              onClick={() => alterarStatus.mutate({ listingId: anuncio.listingId, status: 'active' })}
            >
              Reativar
            </Button>
          )}
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="rounded-sm px-2 py-1.5 text-xs text-blue-ink hover:bg-blue-tint"
          >
            {aberto ? 'menos' : 'detalhes'}
          </button>
        </div>
      </div>

      {anuncio.ultimoErro && (
        <p className="bg-danger-tint px-5 py-2.5 text-xs text-danger-ink">
          Última tentativa falhou: {anuncio.ultimoErro}
        </p>
      )}
      {erro && <p className="px-5 py-2.5 text-xs text-danger-ink">{erro.message}</p>}

      {aberto && (
        <div className="bg-surface-raised">
          {anuncio.variacoes.map((v) => (
            <VariacaoLinha key={v.variationId} variacao={v} editavel={publicado} />
          ))}
          <div className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3">
            {anuncio.permalink && (
              <a
                href={anuncio.permalink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-ink underline decoration-1 underline-offset-2"
              >
                ver no Mercado Livre
              </a>
            )}
            {publicado && anuncio.status !== 'encerrado' && (
              <button
                type="button"
                disabled={ocupado}
                className="text-xs text-danger-ink underline decoration-1 underline-offset-2 disabled:opacity-50"
                // Encerrar não tem volta: o ML não reabre item fechado. Fica
                // escondido nos detalhes e pede confirmação, de propósito.
                onClick={() => {
                  if (window.confirm(`Encerrar "${anuncio.titulo}"? Isso não tem volta no ML.`)) {
                    alterarStatus.mutate({ listingId: anuncio.listingId, status: 'closed' })
                  }
                }}
              >
                encerrar anúncio
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function Miniatura({ anuncio }: { anuncio: AnuncioResumo }) {
  const [quebrou, setQuebrou] = useState(false)
  const temImagem = anuncio.imagemId && !quebrou

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface-raised">
      {temImagem ? (
        <img
          src={urlDaImagemMl(anuncio.imagemId as string)}
          alt=""
          loading="lazy"
          onError={() => setQuebrou(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-xs font-semibold text-ink-faint">
          {anuncio.sku.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  )
}
