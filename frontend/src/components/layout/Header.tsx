import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { StatusDot } from '@/components/ui/StatusDot'

const NAV_LINKS: Array<{ label: string; to: string }> = [
  { label: 'Anúncios', to: '/anuncios' },
  { label: 'Pedidos', to: '/pedidos' },
]

function StatusChip({ connected }: { connected: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-xs text-ink-soft">
      <StatusDot tone={connected ? 'ok' : 'danger'} />
      {connected ? 'ML conectado' : 'ML desconectado'}
    </div>
  )
}

export function Header({
  connected = true,
  right,
}: {
  connected?: boolean
  right?: ReactNode
}) {
  return (
    <header className="flex items-center gap-6 border-b border-line bg-base px-6 py-4">
      <Link to="/" className="font-display text-2xl font-extrabold text-ink">
        sincr<span className="text-yellow">o</span>
      </Link>

      <div className="flex-1 rounded-full border border-line bg-surface-raised px-4 py-2 text-sm text-ink-faint">
        Buscar por SKU, título ou categoria…
      </div>

      <nav className="flex gap-4.5 whitespace-nowrap text-sm text-ink-soft">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'text-ink' : 'hover:text-ink')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <StatusChip connected={connected} />
      {right}
    </header>
  )
}
