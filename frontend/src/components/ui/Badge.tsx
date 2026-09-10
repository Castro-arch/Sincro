import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeTone = 'ok' | 'low' | 'out' | 'neutral'

/**
 * Feedback do Andes: texto na cor forte sobre a mesma cor a 10%. Fundo
 * saturado com texto escuro era o desenho do tema antigo; no claro, a
 * versão tingida é o que o painel do ML usa.
 */
const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: 'bg-success-tint text-success-ink',
  low: 'bg-warning-tint text-warning-ink',
  out: 'bg-danger-tint text-danger-ink',
  neutral: 'bg-surface-raised text-ink-soft',
}

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center self-start rounded-full px-2.5 py-1 text-xs font-semibold',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  )
}
