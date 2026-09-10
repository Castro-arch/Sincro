import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

/**
 * Classes compartilhadas pelos controles de formulário. Ficam num só lugar
 * porque input, select e textarea precisam parecer o mesmo campo — repetir a
 * string em cada um é como eles começam a divergir.
 */
const CONTROLE =
  'w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-blue focus:outline-none disabled:opacity-50'

export function Campo({
  label,
  obrigatorio,
  dica,
  erro,
  children,
}: {
  label: string
  obrigatorio?: boolean
  dica?: string | null
  erro?: string | null
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-soft">
        {label}
        {obrigatorio && <span className="ml-1 text-danger-ink">*</span>}
      </span>
      {children}
      {dica && <span className="text-xs text-ink-faint">{dica}</span>}
      {erro && <span className="text-xs text-danger-ink">{erro}</span>}
    </label>
  )
}

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROLE, className)} {...props} />
}

export function AreaTexto({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROLE, 'min-h-24 resize-y', className)} {...props} />
}

export function Selecao({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROLE, className)} {...props} />
}
