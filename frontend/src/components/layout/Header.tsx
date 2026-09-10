import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconeLupa } from '@/components/ui/Icone'

/**
 * Estrutura do painel de vendas do ML: logo à esquerda, busca ocupando o
 * centro, ações à direita. Só o arranjo é emprestado — as cores continuam
 * sendo as do tema escuro do Sincro.
 */
export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-6 border-b border-line bg-base px-6">
      <Link to="/" className="shrink-0 font-display text-2xl font-extrabold text-ink">
        sincr<span className="text-yellow">o</span>
      </Link>

      {/* Decorativa por enquanto: nenhuma rota de busca existe ainda. */}
      <div className="flex max-w-2xl flex-1 items-center gap-2.5 rounded-full border border-line bg-surface-raised px-4 py-2 text-sm text-ink-faint">
        <IconeLupa className="h-4 w-4 shrink-0" />
        <span className="truncate">Buscar por SKU, título ou categoria…</span>
      </div>

      <div className="flex shrink-0 items-center gap-3">{right}</div>
    </header>
  )
}
