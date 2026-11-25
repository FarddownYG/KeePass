import type { PasswordAnalysis } from '../state/usePasswordAnalysis'
import { BreachStatus } from './BreachStatus'
import { StrengthMeter } from './StrengthMeter'

export function PasswordFeedback({ analysis }: { analysis: PasswordAnalysis }) {
  if (!analysis.strength && analysis.breach.status === 'idle') return null
  return (
    <div className="flex flex-col gap-1">
      <StrengthMeter strength={analysis.strength} />
      <BreachStatus state={analysis.breach} />
    </div>
  )
}
