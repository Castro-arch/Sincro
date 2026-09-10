import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeTone = 'ok' | 'low' | 'out' | 'neutral'

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: 'bg-success text-success-ink',
  low: 'bg-warning text-warning-ink',
  out: 'bg-danger text-danger-ink',
  // Sem cor semântica própria — reaproveita os neutros de superfície pra
  // estados que não são "bom/atenção/ruim" (ex.: rascunho, encerrado).
  neutral: 'bg-surface-raised text-ink-soft border border-line',
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
