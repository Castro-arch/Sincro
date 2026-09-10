import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { StatusDot } from '@/components/ui/StatusDot'
import { useStatusMl } from '@/hooks/useStatusMl'

const NAV_LINKS: Array<{ label: string; to: string }> = [
  { label: 'Anúncios', to: '/anuncios' },
  { label: 'Pedidos', to: '/pedidos' },
]

function StatusChip() {
  const { data, isLoading } = useStatusMl()

  // Enquanto não se sabe, o chip não afirma nada -- dizer "conectado" por
  // omissão é pior do que dizer que ainda está checando.
  if (isLoading) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-xs text-ink-faint">
        <StatusDot tone="warning" />
        verificando ML…
      </div>
    )
  }

  const conectado = data?.conectado === true && data?.expirado === false

  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-xs text-ink-soft">
      <StatusDot tone={conectado ? 'ok' : 'danger'} />
      {conectado ? 'ML conectado' : 'ML desconectado'}
    </div>
  )
}

export function Header({ right }: { right?: ReactNode }) {
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

      <StatusChip />
      {right}
    </header>
  )
}
