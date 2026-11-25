import type { ReactNode } from 'react'

const TONES = {
  neutral: 'bg-sunken text-fg-muted',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-fg',
  accent: 'bg-accent-soft text-accent-text',
} as const

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>
  )
}
