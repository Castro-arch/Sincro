import type { SVGProps } from 'react'

/**
 * Ícones em SVG inline, sem biblioteca.
 *
 * Mesma escolha das fontes: nada de CDN nem dependência nova para meia dúzia
 * de traços. Todos herdam `currentColor`, então respondem aos tokens de texto
 * como qualquer outro conteúdo.
 */
type Props = SVGProps<SVGSVGElement>

function Base({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconePainel(props: Props) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Base>
  )
}

export function IconeEtiqueta(props: Props) {
  return (
    <Base {...props}>
      <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </Base>
  )
}

export function IconePedido(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
    </Base>
  )
}

export function IconeMais(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  )
}

export function IconeLupa(props: Props) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Base>
  )
}

/** Painel com a barra lateral marcada — o mesmo gesto de recolher/expandir. */
export function IconeRecolher(props: Props) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Base>
  )
}

export function IconePergunta(props: Props) {
  return (
    <Base {...props}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />
      <path d="M9.6 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.3-1 .8-1 1.5" />
      <path d="M12 16.2h.01" />
    </Base>
  )
}
