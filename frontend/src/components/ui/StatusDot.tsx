type StatusTone = 'ok' | 'warning' | 'danger'

const TONE_CLASSES: Record<StatusTone, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export function StatusDot({ tone }: { tone: StatusTone }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_CLASSES[tone]}`} />
}
