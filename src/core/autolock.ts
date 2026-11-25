const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
/** Wall-clock re-check period: setTimeout pauses during OS sleep, Date.now() does not. */
const CHECK_INTERVAL_MS = 15_000

export interface AutoLockOptions {
  timeoutMs: number
  lockOnHidden: boolean
  onLock: () => void
}

/**
 * Locks after inactivity (deadline checked against the wall clock, so it survives sleep/suspend),
 * immediately when the tab is or becomes hidden, and on pagehide. Returns a disposer.
 */
export function startAutoLock(opts: AutoLockOptions): () => void {
  let deadline = Date.now() + opts.timeoutMs
  let disposed = false

  const lock = (): void => {
    if (disposed) return
    dispose()
    opts.onLock()
  }
  const check = (): void => {
    if (opts.lockOnHidden && document.visibilityState === 'hidden') lock()
    else if (Date.now() >= deadline) lock()
  }
  const activity = (): void => {
    if (Date.now() >= deadline) lock()
    else deadline = Date.now() + opts.timeoutMs
  }
  const interval = setInterval(check, Math.min(CHECK_INTERVAL_MS, opts.timeoutMs))
  const dispose = (): void => {
    disposed = true
    clearInterval(interval)
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, activity)
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('focus', check)
    window.removeEventListener('pagehide', lock)
  }

  for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, activity, { passive: true })
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
  window.addEventListener('pagehide', lock)
  // The tab may already be hidden (e.g. unlock finished after switching away).
  check()
  return dispose
}
