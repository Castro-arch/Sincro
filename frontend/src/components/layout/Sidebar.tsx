import type { ComponentType, SVGProps } from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconeEtiqueta,
  IconeMais,
  IconePainel,
  IconePedido,
  IconePergunta,
  IconeRecolher,
} from '@/components/ui/Icone'
import { StatusDot } from '@/components/ui/StatusDot'
import { usePerguntasPendentes } from '@/hooks/usePerguntas'
import { useStatusMl } from '@/hooks/useStatusMl'
import { tomDaConexao } from '@/lib/conexao'
import { formatSegundos } from '@/lib/format'
import { cn } from '@/lib/utils'

type Icone = ComponentType<SVGProps<SVGSVGElement>>

const ITENS: Array<{ rotulo: string; para: string; icone: Icone; exato?: boolean; selo?: 'perguntas' }> = [
  { rotulo: 'Dashboard', para: '/', icone: IconePainel, exato: true },
  { rotulo: 'Anúncios', para: '/anuncios', icone: IconeEtiqueta },
  { rotulo: 'Pedidos', para: '/pedidos', icone: IconePedido },
  { rotulo: 'Perguntas', para: '/perguntas', icone: IconePergunta, selo: 'perguntas' },
  { rotulo: 'Cadastrar produto', para: '/produtos/novo', icone: IconeMais },
]

export function Sidebar({
  recolhida,
  onAlternar,
}: {
  recolhida: boolean
  onAlternar: () => void
}) {
  const { data: pendentes } = usePerguntasPendentes()
  const seloPerguntas = pendentes?.pendentes ?? 0

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-150',
        recolhida ? 'w-16' : 'w-60',
      )}
    >
      <div className={cn('flex py-3', recolhida ? 'justify-center px-2' : 'justify-end px-3')}>
        <button
          type="button"
          onClick={onAlternar}
          aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!recolhida}
          className="rounded-sm p-2 text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <IconeRecolher />
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {ITENS.map((item) => (
          <NavLink
            key={item.para}
            to={item.para}
            end={item.exato}
            title={recolhida ? item.rotulo : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-sm py-2.5 text-sm transition-colors',
                recolhida ? 'justify-center px-2' : 'px-3',
                isActive
                  ? 'bg-blue-tint font-semibold text-blue-ink'
                  : 'text-ink-soft hover:bg-surface-raised hover:text-ink',
              )
            }
          >
            <span className="relative shrink-0">
              <item.icone />
              {/* Recolhida, o selo vai sobre o icone: e o unico lugar que sobra. */}
              {item.selo === 'perguntas' && seloPerguntas > 0 && recolhida && (
                <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-semibold text-ink-on-blue">
                  {seloPerguntas > 99 ? '99+' : seloPerguntas}
                </span>
              )}
            </span>
            {!recolhida && <span className="truncate">{item.rotulo}</span>}
            {item.selo === 'perguntas' && seloPerguntas > 0 && !recolhida && (
              <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-ink-on-blue">
                {seloPerguntas > 99 ? '99+' : seloPerguntas}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-line p-3">
        <StatusDaConexao recolhida={recolhida} />
      </div>
    </aside>
  )
}

/**
 * Único indicador de conexão da app: a sidebar está sempre visível, então
 * o cartão que existia no Dashboard dizia a mesma coisa duas vezes na mesma
 * tela e foi removido. A severidade vem de tomDaConexao().
 */
function StatusDaConexao({ recolhida }: { recolhida: boolean }) {
  const { data, isLoading } = useStatusMl()

  const tom = isLoading ? 'warning' : data ? tomDaConexao(data) : 'danger'
  const titulo = isLoading
    ? 'Verificando conexão com o Mercado Livre'
    : data?.conectado
      ? `Conectado como ${data.nickname ?? data.mlUserId}`
      : 'Sem autorização ativa no Mercado Livre'

  if (recolhida) {
    return (
      <div className="flex justify-center py-1" title={titulo}>
        <StatusDot tone={tom} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink">
        <StatusDot tone={tom} />
        Mercado Livre
      </div>

      {isLoading && <p className="text-xs text-ink-faint">verificando…</p>}

      {data?.conectado && (
        <p className="truncate text-xs text-ink-soft" title={titulo}>
          {data.nickname ?? data.mlUserId}
        </p>
      )}

      {data?.conectado && data.segundosParaExpirar !== null && (
        <p className="font-mono text-xs text-ink-faint">
          token renova em {formatSegundos(data.segundosParaExpirar)}
        </p>
      )}

      {data && !data.conectado && (
        <p className="text-xs text-danger-ink">sem autorização — reconecte em /ml/auth/login</p>
      )}
    </div>
  )
}
