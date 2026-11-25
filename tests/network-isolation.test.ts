import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePassphrase, generatePassword, DEFAULT_PASSWORD_OPTIONS, DEFAULT_PASSPHRASE_OPTIONS } from '../src/core/generator'
import { estimateStrength } from '../src/core/strength'
import { createEntry, createVault, generateKeyFile, openVault, rootGroup, saveVault, updateEntry } from '../src/core/vault'
import { pwnedCount } from '../src/core/hibp'
import { FAST_KDF } from './helpers'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}

const NETWORK_APIS = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection|importScripts|new\s+Image\s*\(/

describe('no network calls outside HIBP', () => {
  it('static: only src/core/hibp.ts uses a network API', () => {
    const offenders = sourceFiles('src').filter((f) => NETWORK_APIS.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => f.replaceAll('\\', '/'))).toEqual(['src/core/hibp.ts'])
  })

  it('static: the only remote origin in the source is api.pwnedpasswords.com', () => {
    const origins = new Set<string>()
    for (const f of sourceFiles('src')) {
      for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) origins.add(m[1].toLowerCase())
    }
    // example.* hosts are placeholders in UI copy only
    const real = [...origins].filter((o) => !/(^|\.)example\.(com|org|net)$/.test(o))
    expect(real).toEqual(['api.pwnedpasswords.com'])
  })

  it('static: CSP connect-src allows only self + HIBP; no inline; frame-ancestors none', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[]
    }
    const all = vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []
    const get = (k: string) => all.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value ?? ''
    const csp = get('Content-Security-Policy')
    const dir = (name: string) => csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + ' ')) ?? ''
    expect(dir('default-src')).toBe("default-src 'self'")
    expect(dir('connect-src')).toBe("connect-src 'self' https://api.pwnedpasswords.com")
    expect(dir('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(csp).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*|'strict-dynamic'|blob:/)
    expect(get('Strict-Transport-Security')).toMatch(/max-age=\d{8,}/)
    expect(get('X-Content-Type-Options')).toBe('nosniff')
    expect(get('Referrer-Policy')).toBe('no-referrer')
  })

  describe('runtime', () => {
    const calls: unknown[] = []
    beforeEach(() => {
      calls.length = 0
      vi.stubGlobal('fetch', vi.fn((...args: unknown[]) => {
        calls.push(args)
        return Promise.reject(new Error('network forbidden in test'))
      }))
    })
    afterEach(() => vi.unstubAllGlobals())

    it('vault lifecycle, generator and strength meter make zero network calls', async () => {
      const keyFile = await generateKeyFile()
      const db = createVault('N', { password: 'pw', keyFile }, FAST_KDF)
      const pwd = generatePassword(DEFAULT_PASSWORD_OPTIONS)
      const e = createEntry(db, rootGroup(db), {
        title: 't', username: 'u', password: pwd, url: '', notes: '', tags: [], expiry: null, customFields: [],
      })
      updateEntry(db, e, { title: 't2', username: 'u', password: await generatePassphrase(DEFAULT_PASSPHRASE_OPTIONS), url: '', notes: '', tags: [], expiry: null, customFields: [] })
      await openVault(await saveVault(db), { password: 'pw', keyFile })
      await estimateStrength(pwd)
      expect(calls).toHaveLength(0)
    })

    it('HIBP uses the global fetch only towards api.pwnedpasswords.com', async () => {
      await pwnedCount('x').catch(() => undefined)
      expect(calls).toHaveLength(1)
      expect(String((calls[0] as unknown[])[0])).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/)
    })
  })
})
