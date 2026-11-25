const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

export interface AutoLockOptions {
  timeoutMs: number
  lockOnHidden: boolean
  onLock: () => void
}

/** Locks after inactivity, and immediately when the tab becomes hidden. Returns a disposer. */
export function startAutoLock(opts: AutoLockOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const lock = (): void => {
    if (disposed) return
    dispose()
    opts.onLock()
  }
  const arm = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(lock, opts.timeoutMs)
  }
  const onVisibility = (): void => {
    if (opts.lockOnHidden && document.visibilityState === 'hidden') lock()
  }
  const dispose = (): void => {
    disposed = true
    if (timer) clearTimeout(timer)
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, arm)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', lock)
  }

  for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, arm, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', lock)
  arm()
  return dispose
}
