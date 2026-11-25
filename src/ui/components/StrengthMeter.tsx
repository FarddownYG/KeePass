import type { Strength } from '../../core/strength'

const FILL_CLASS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'] as const

export function StrengthMeter({ strength, bits }: { strength: Strength | null; bits?: number }) {
  const filled = strength ? Math.max(1, strength.score) : 0
  const cls = strength ? FILL_CLASS[strength.score] : ''
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex gap-1"
        role="img"
        aria-label={strength ? `Robustesse : ${strength.label}` : 'Robustesse : non évaluée'}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-sm transition-colors duration-150 ${i < filled ? cls : 'bg-line-strong'}`} />
        ))}
      </div>
      <p className="min-h-5 text-sm text-fg-muted" aria-live="polite">
        {strength ? (
          <>
            <span className="font-medium text-fg">{strength.label}</span>
            {` · temps de craquage estimé : ${strength.crackTime}`}
            {bits !== undefined ? ` · ${bits} bits` : ''}
          </>
        ) : bits !== undefined ? (
          `${bits} bits d’entropie`
        ) : null}
      </p>
    </div>
  )
}
