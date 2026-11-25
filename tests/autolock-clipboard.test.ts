import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Minimal browser globals for the auto-lock and clipboard modules (node test env). */
function installDom() {
  const win = new EventTarget()
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
  let clip = ''
  const clipboard = {
    writeText: vi.fn(async (t: string) => {
      clip = t
    }),
    readText: vi.fn(async () => clip),
  }
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('navigator', { clipboard, permissions: { query: async () => ({ state: 'denied' }) } })
  return { win, doc, clipboard, read: () => clip }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('auto-lock', () => {
  it('locks after inactivity', async () => {
    installDom()
    const { startAutoLock } = await import('../src/core/autolock')
    const onLock = vi.fn()
    startAutoLock({ timeoutMs: 60_000, lockOnHidden: true, onLock })
    vi.advanceTimersByTime(59_000)
    expect(onLock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(16_000)
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it('activity postpones the deadline', async () => {
    const { win } = installDom()
    const { startAutoLock } = await import('../src/core/autolock')
    const onLock = vi.fn()
    startAutoLock({ timeoutMs: 60_000, lockOnHidden: true, onLock })
    vi.advanceTimersByTime(50_000)
    win.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(50_000)
    expect(onLock).not.toHaveBeenCalled()
  })

  it('locks when the tab becomes hidden, and when it is already hidden at start', async () => {
    const { doc } = installDom()
    const { startAutoLock } = await import('../src/core/autolock')
    const a = vi.fn()
    startAutoLock({ timeoutMs: 600_000, lockOnHidden: true, onLock: a })
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(a).toHaveBeenCalledTimes(1)
    const b = vi.fn()
    startAutoLock({ timeoutMs: 600_000, lockOnHidden: true, onLock: b })
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('uses the wall clock (survives a suspended timer, e.g. OS sleep)', async () => {
    installDom()
    const { startAutoLock } = await import('../src/core/autolock')
    const onLock = vi.fn()
    startAutoLock({ timeoutMs: 60_000, lockOnHidden: true, onLock })
    vi.setSystemTime(Date.now() + 3_600_000) // clock jumps, no timer fired
    window.dispatchEvent(new Event('focus'))
    expect(onLock).toHaveBeenCalledTimes(1)
  })
})

describe('clipboard', () => {
  it('wipes a copied secret after 30 s', async () => {
    const dom = installDom()
    const { copySecret } = await import('../src/core/clipboard')
    await copySecret('s3cret')
    expect(dom.read()).toBe('s3cret')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(dom.read()).toBe('')
  })

  it('a later non-secret copy cancels the wipe', async () => {
    const dom = installDom()
    const { copySecret, copyPlain } = await import('../src/core/clipboard')
    await copySecret('s3cret')
    await copyPlain('octocat')
    await vi.advanceTimersByTimeAsync(31_000)
    expect(dom.read()).toBe('octocat')
  })

  it('clearClipboardNow wipes immediately (lock)', async () => {
    const dom = installDom()
    const { copySecret, clearClipboardNow } = await import('../src/core/clipboard')
    await copySecret('s3cret')
    await clearClipboardNow()
    expect(dom.read()).toBe('')
  })
})
