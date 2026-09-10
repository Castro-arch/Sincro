import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconeLupa } from '@/components/ui/Icone'

/**
 * Cabeçalho do painel de vendas: faixa amarela com o logo à esquerda, busca
 * branca ao centro e ações à direita. A busca segue decorativa.
 */
export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-6 bg-yellow px-6 shadow-header">
      <Link to="/" className="shrink-0 font-display text-2xl font-extrabold text-ink-on-yellow">
        sincro
      </Link>

      <div className="flex max-w-2xl flex-1 items-center gap-2.5 rounded-sm bg-surface px-4 py-2 text-sm text-ink-faint shadow-card">
        <IconeLupa className="h-4 w-4 shrink-0" />
        <span className="truncate">Buscar por SKU, título ou categoria…</span>
      </div>

      <div className="flex shrink-0 items-center gap-3">{right}</div>
    </header>
  )
}
