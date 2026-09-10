type StatTone = 'default' | 'success' | 'warning' | 'danger'

const TONE_CLASSES: Record<StatTone, string> = {
  default: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

export function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: StatTone
}) {
  return (
    <div className="flex flex-col gap-1.5 border border-line bg-surface p-5">
      <span className="font-mono text-xs tracking-wide text-ink-faint uppercase">{label}</span>
      <span className={`font-mono text-2xl font-medium tabular-nums ${TONE_CLASSES[tone]}`}>
        {value}
      </span>
    </div>
  )
}
