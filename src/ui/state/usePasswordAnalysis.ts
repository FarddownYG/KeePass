import { useEffect, useState } from 'react'
import { pwnedCount } from '../../core/hibp'
import { estimateStrength, type Strength } from '../../core/strength'

export type BreachState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'clean' }
  | { status: 'found'; count: number }
  | { status: 'error' }

export interface PasswordAnalysis {
  strength: Strength | null
  breach: BreachState
}

const STRENGTH_DELAY_MS = 200
const BREACH_DELAY_MS = 700

/** Debounced local strength estimate + HIBP range lookup (k-anonymity, see core/hibp). */
export function usePasswordAnalysis(password: string, userInputs: string[] = [], checkBreach = true): PasswordAnalysis {
  const [strength, setStrength] = useState<Strength | null>(null)
  const [breachRes, setBreachRes] = useState<{ for: string; state: BreachState } | null>(null)
  const inputsKey = userInputs.join('\u0000')

  useEffect(() => {
    if (!password) return
    let cancelled = false
    const t = window.setTimeout(() => {
      estimateStrength(password, inputsKey ? inputsKey.split('\u0000') : [])
        .then((s) => {
          if (!cancelled) setStrength(s)
        })
        .catch(() => {
          if (!cancelled) setStrength(null)
        })
    }, STRENGTH_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [password, inputsKey])

  useEffect(() => {
    if (!password || !checkBreach) return
    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      pwnedCount(password, { signal: ctrl.signal })
        .then((count) => {
          if (!ctrl.signal.aborted) setBreachRes({ for: password, state: count > 0 ? { status: 'found', count } : { status: 'clean' } })
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setBreachRes({ for: password, state: { status: 'error' } })
        })
    }, BREACH_DELAY_MS)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [password, checkBreach])

  let breach: BreachState = { status: 'idle' }
  if (password && checkBreach) breach = breachRes?.for === password ? breachRes.state : { status: 'loading' }
  return { strength: password ? strength : null, breach }
}
