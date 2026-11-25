import { useCallback, useEffect, useRef, useState } from 'react'
import { pwnedCount } from '../../core/hibp'
import { estimateStrength, type Strength } from '../../core/strength'
import { useSession } from './session-context'

export type BreachState =
  | { status: 'idle' }
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'clean' }
  | { status: 'found'; count: number }
  | { status: 'error' }

export interface PasswordAnalysis {
  strength: Strength | null
  breach: BreachState
  /** Runs the HIBP lookup for a COMPLETE password: the current one (on blur) or `value` (e.g. just generated). */
  checkBreach: (value?: string) => void
}

const STRENGTH_DELAY_MS = 200

/**
 * Local strength estimate (debounced) + HIBP range lookup.
 * The HIBP lookup is NEVER triggered while typing: only on an explicit call (field blur / "Vérifier"),
 * so partial passwords are never hashed and sent (each request reveals a 5-hex-char prefix).
 */
export function usePasswordAnalysis(password: string, userInputs: string[] = [], allowBreach = true): PasswordAnalysis {
  const { settings } = useSession()
  const enabled = allowBreach && settings.hibpEnabled
  const [strength, setStrength] = useState<Strength | null>(null)
  const [breachRes, setBreachRes] = useState<{ for: string; state: BreachState } | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)
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

  useEffect(() => () => ctrlRef.current?.abort(), [])

  const checkBreach = useCallback((value?: string): void => {
    const target = typeof value === 'string' ? value : password
    if (!enabled || !target) return
    if (breachRes?.for === target && breachRes.state.status !== 'error') return
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setBreachRes({ for: target, state: { status: 'loading' } })
    pwnedCount(target, { signal: ctrl.signal })
      .then((count) => {
        if (!ctrl.signal.aborted) setBreachRes({ for: target, state: count > 0 ? { status: 'found', count } : { status: 'clean' } })
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setBreachRes({ for: target, state: { status: 'error' } })
      })
  }, [enabled, password, breachRes])

  let breach: BreachState = { status: 'idle' }
  if (!allowBreach || !password) breach = { status: 'idle' }
  else if (!settings.hibpEnabled) breach = { status: 'disabled' }
  else if (breachRes?.for === password) breach = breachRes.state
  return { strength: password ? strength : null, breach, checkBreach }
}
