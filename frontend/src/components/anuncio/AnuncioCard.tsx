import { useState } from 'react'
import type { AnuncioResumo } from '@/api/listings'
import { StatusAnuncio } from '@/components/anuncio/StatusAnuncio'
import { VariacaoLinha } from '@/components/anuncio/VariacaoLinha'
import { Button } from '@/components/ui/Button'
import { useAlterarStatusListing, usePublicarListing } from '@/hooks/useAnuncios'
import { formatBRL, formatDataHora } from '@/lib/format'

export function AnuncioCard({ anuncio }: { anuncio: AnuncioResumo }) {
  const [aberto, setAberto] = useState(false)
  const publicar = usePublicarListing()
  const alterarStatus = useAlterarStatusListing()

  const publicado = Boolean(anuncio.mlItemId)
  const ocupado = publicar.isPending || alterarStatus.isPending
  const erro = (publicar.error ?? alterarStatus.error) as Error | null

  return (
    <article className="cartao">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <div className="min-w-60 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusAnuncio status={anuncio.status} />
            <span className="font-mono text-xs text-ink-faint">{anuncio.sku}</span>
            {anuncio.mlItemId && (
              <span className="font-mono text-xs text-ink-faint">{anuncio.mlItemId}</span>
            )}
          </div>
          <h3 className="mt-2 text-sm leading-snug text-ink">{anuncio.titulo}</h3>
          <p className="mt-1 text-xs text-ink-faint">
            Sincronizado {formatDataHora(anuncio.sincronizadoEm)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-lg font-semibold text-ink">
            {anuncio.precoMinimo === null ? '—' : formatBRL(anuncio.precoMinimo)}
          </span>
          <span
            className={
              anuncio.semEstoque
                ? 'font-mono text-xs text-danger-ink'
                : anuncio.temEstoqueBaixo
                  ? 'font-mono text-xs text-warning-ink'
                  : 'font-mono text-xs text-ink-soft'
            }
          >
            {anuncio.estoqueTotal} em estoque
          </span>
        </div>
      </div>

      {anuncio.ultimoErro && (
        <p className="border-t border-line bg-surface-raised px-5 py-3 text-xs text-danger-ink">
          Última tentativa falhou: {anuncio.ultimoErro}
        </p>
      )}

      {erro && (
        <p className="border-t border-line px-5 py-3 text-xs text-danger-ink">{erro.message}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
        {!publicado && (
          <Button
            disabled={ocupado}
            onClick={() => publicar.mutate(anuncio.listingId)}
            className="text-xs"
          >
            {publicar.isPending ? 'Publicando…' : 'Publicar no ML'}
          </Button>
        )}

        {publicado && anuncio.status === 'ativo' && (
          <Button
            variant="secondary"
            disabled={ocupado}
            className="text-xs"
            onClick={() =>
              alterarStatus.mutate({ listingId: anuncio.listingId, status: 'paused' })
            }
          >
            Pausar
          </Button>
        )}

        {publicado && anuncio.status === 'pausado' && (
          <Button
            variant="secondary"
            disabled={ocupado}
            className="text-xs"
            onClick={() =>
              alterarStatus.mutate({ listingId: anuncio.listingId, status: 'active' })
            }
          >
            Reativar
          </Button>
        )}

        {publicado && anuncio.status !== 'encerrado' && (
          <Button
            variant="secondary"
            disabled={ocupado}
            className="text-xs"
            // Encerrar não tem volta no mesmo anúncio: o ML não reabre item
            // fechado, então confirmamos antes em vez de desfazer depois.
            onClick={() => {
              if (window.confirm(`Encerrar "${anuncio.titulo}"? Isso não tem volta no ML.`)) {
                alterarStatus.mutate({ listingId: anuncio.listingId, status: 'closed' })
              }
            }}
          >
            Encerrar
          </Button>
        )}

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

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="ml-auto text-xs text-ink-soft hover:text-ink"
        >
          {aberto ? 'ocultar' : `${anuncio.variacoes.length} variação(ões)`}
        </button>
      </div>

      {aberto &&
        anuncio.variacoes.map((v) => (
          <VariacaoLinha key={v.variationId} variacao={v} editavel={publicado} />
        ))}
    </article>
  )
}
