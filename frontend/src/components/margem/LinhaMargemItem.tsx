import type { LinhaMargem } from '@/api/margem'
import { Badge } from '@/components/ui/Badge'
import { formatBRL } from '@/lib/format'
import { urlDaImagemMl } from '@/lib/imagem'
import { cn } from '@/lib/utils'

/** Colunas da tabela — compartilhada com o cabeçalho da página. */
export const GRADE_MARGEM =
  'grid grid-cols-[44px_minmax(0,1fr)_90px_110px_110px_110px_120px] items-center gap-3 px-5'

export function LinhaMargemItem({ linha }: { linha: LinhaMargem }) {
  const margem = linha.margemPercentual
  const tomMargem =
    margem === null
      ? 'text-ink-faint'
      : margem < 0
        ? 'text-danger-ink'
        : margem < 15
          ? 'text-warning-ink'
          : 'text-success-ink'

  return (
    <li className="border-t border-line">
      <div className={cn(GRADE_MARGEM, 'py-3')}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface-raised">
          {linha.imagemId ? (
            <img
              src={urlDaImagemMl(linha.imagemId)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-ink-faint">—</span>
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm text-ink" title={linha.titulo}>
            {linha.titulo}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-faint">
            {linha.sku} · {linha.unidadesVendidas} un. vendida(s)
          </p>
        </div>

        <span className="text-sm text-ink-soft">{formatBRL(linha.receitaBruta)}</span>

        {/* O rótulo da estimativa fica na célula da taxa, onde a dúvida nasce. */}
        <span className="flex flex-col text-sm text-ink-soft">
          −{formatBRL(linha.taxaMl)}
          {!linha.taxaReal && (
            <span className="text-xs font-semibold text-warning-ink">estimada</span>
          )}
        </span>

        <span className="text-sm text-ink-soft">−{formatBRL(linha.imposto)}</span>

        <span className="flex flex-col text-sm text-ink-soft">
          {linha.custoInformado ? (
            <>−{formatBRL(linha.custoTotal)}</>
          ) : (
            <span className="text-xs font-semibold text-danger-ink">sem custo</span>
          )}
        </span>

        <span className="flex flex-col items-end">
          <span className={cn('text-sm font-semibold', tomMargem)}>{formatBRL(linha.lucro)}</span>
          {margem !== null && (
            <span className={cn('text-xs', tomMargem)}>{margem.toFixed(1)}%</span>
          )}
        </span>
      </div>

      {!linha.custoInformado && (
        <p className="bg-danger-tint px-5 py-2 text-xs text-danger-ink">
          Sem custo de aquisição cadastrado para <strong>{linha.sku}</strong> — este lucro é
          receita menos taxa e imposto, e está <strong>superestimado</strong>.
        </p>
      )}

      {!linha.taxaReal && (
        <p className="bg-warning-tint px-5 py-2 text-xs text-warning-ink">
          A comissão desta linha é <strong>estimativa</strong>: o Mercado Livre ainda não creditou
          o valor real (a comissão só é calculada na acreditação do pagamento).
        </p>
      )}
    </li>
  )
}

export function CelulaTotal({
  rotulo,
  valor,
  tom = 'ink',
  sufixo,
}: {
  rotulo: string
  valor: string
  tom?: 'ink' | 'success' | 'danger'
  sufixo?: string
}) {
  const cor =
    tom === 'success' ? 'text-success-ink' : tom === 'danger' ? 'text-danger-ink' : 'text-ink'
  return (
    <div className="flex flex-col gap-1 border border-line bg-surface p-4">
      <span className="text-xs tracking-wide text-ink-faint uppercase">{rotulo}</span>
      <span className={cn('text-xl font-semibold', cor)}>{valor}</span>
      {sufixo && <span className="text-xs text-ink-faint">{sufixo}</span>}
    </div>
  )
}

export function SeloMargem({ linha }: { linha: LinhaMargem }) {
  if (!linha.custoInformado) return <Badge tone="out">sem custo</Badge>
  if (!linha.taxaReal) return <Badge tone="low">estimada</Badge>
  return <Badge tone="ok">real</Badge>
}
