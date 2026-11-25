import { AlertTriangle, Check, Loader2, WifiOff } from 'lucide-react'
import type { BreachState } from '../state/usePasswordAnalysis'

export function BreachStatus({ state }: { state: BreachState }) {
  let body = null
  switch (state.status) {
    case 'loading':
      body = (
        <span className="flex items-center gap-1.5 text-fg-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Vérification dans les fuites connues…
        </span>
      )
      break
    case 'found':
      body = (
        <span className="flex items-center gap-1.5 font-medium text-danger">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          Trouvé {state.count.toLocaleString('fr-FR')} fois dans des fuites
        </span>
      )
      break
    case 'clean':
      body = (
        <span className="flex items-center gap-1.5 text-fg-muted">
          <Check className="size-3.5 shrink-0 text-success" aria-hidden />
          Non trouvé dans les fuites connues
        </span>
      )
      break
    case 'error':
      body = (
        <span className="flex items-center gap-1.5 text-fg-muted">
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
          Vérification indisponible
        </span>
      )
      break
    default:
      body = null
  }
  return (
    <p className="min-h-5 text-sm" aria-live="polite">
      {body}
    </p>
  )
}
