import type { Pergunta } from '@/api/questions'
import { RespostaRapida } from '@/components/pergunta/RespostaRapida'
import { Badge } from '@/components/ui/Badge'
import { formatDataHora, formatTempoDecorrido, tomDoTempo } from '@/lib/format'
import { urlDaImagemMl } from '@/lib/imagem'
import { cn } from '@/lib/utils'

const TOM_TEXTO = {
  ok: 'text-ink-soft',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
} as const

export function PerguntaLinha({ pergunta }: { pergunta: Pergunta }) {
  const pendente = pergunta.status === 'UNANSWERED'
  const tom = tomDoTempo(pergunta.dataPergunta)
  const imagem = pergunta.listing?.pictureIds?.[0]

  return (
    <li className="flex gap-4 border-t border-line px-5 py-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface-raised">
        {imagem ? (
          <img
            src={urlDaImagemMl(imagem)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs text-ink-faint">ML</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-ink-faint">
          {pergunta.listing?.titulo ?? `Anúncio fora do Sincro (${pergunta.mlItemId})`}
          {' · '}
          <span className={cn('font-semibold', TOM_TEXTO[pendente ? tom : 'ok'])}>
            {formatTempoDecorrido(pergunta.dataPergunta)}
          </span>
        </p>

        <p className="mt-1 text-sm text-ink">
          {pergunta.texto || (
            <em className="text-ink-faint">(texto removido pelo Mercado Livre)</em>
          )}
        </p>

        {pendente ? (
          <RespostaRapida pergunta={pergunta} />
        ) : (
          <div className="mt-2 rounded-sm bg-surface-raised px-3 py-2 text-sm">
            {pergunta.respostaTexto ? (
              <p className="text-ink">{pergunta.respostaTexto}</p>
            ) : (
              <p className="text-ink-faint">sem resposta</p>
            )}
            <p className="mt-1 text-xs text-ink-faint">
              {pergunta.status === 'ANSWERED'
                ? `respondida ${formatDataHora(pergunta.respondidaEm)} ${
                    pergunta.respondidaPeloSincro ? 'pelo Sincro' : 'pelo painel do ML'
                  }`
                : pergunta.status.toLowerCase().replace(/_/g, ' ')}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <Badge tone={pendente ? (tom === 'ok' ? 'low' : 'out') : 'neutral'}>
          {pendente
            ? 'pendente'
            : pergunta.status === 'ANSWERED'
              ? 'respondida'
              : pergunta.status.toLowerCase()}
        </Badge>
      </div>
    </li>
  )
}
