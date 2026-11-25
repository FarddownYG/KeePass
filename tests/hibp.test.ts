import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { auditPasswords, clearHibpCache, HIBP_ENDPOINT, parseRangeResponse, pwnedCount, sha1Hex, type FetchLike } from '../src/core/hibp'

// Known vector: SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
// Test secret chosen so that it cannot appear by accident in the HIBP URL ("pwnedpasswords").
const PASSWORD = 'Tr0ub4dor&3-keyhold'
let FULL = ''
let PREFIX = ''
let SUFFIX = ''
beforeAll(async () => {
  FULL = await sha1Hex(PASSWORD)
  PREFIX = FULL.slice(0, 5)
  SUFFIX = FULL.slice(5)
})

function mockFetch(body: string) {
  return vi.fn<FetchLike>(async () => new Response(body, { status: 200 }))
}

afterEach(() => clearHibpCache())

describe('HIBP k-anonymity', () => {
  it('computes SHA-1 locally', async () => {
    expect(await sha1Hex('password')).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
    expect(FULL).toMatch(/^[0-9A-F]{40}$/)
  })

  it('sends ONLY the 5-char prefix, with Add-Padding, never the password/hash/suffix', async () => {
    const fetchFn = mockFetch(`${SUFFIX}:3861493\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0\r\n`)
    const count = await pwnedCount(PASSWORD, { fetchFn })
    expect(count).toBe(3861493)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(HIBP_ENDPOINT + PREFIX)
    expect(new URL(url).pathname.split('/').pop()).toHaveLength(5)
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.credentials).toBe('omit')
    expect(init.referrerPolicy).toBe('no-referrer')
    expect(new Headers(init.headers).get('Add-Padding')).toBe('true')

    // Everything that leaves the process, serialized: must not contain secrets.
    const wire = JSON.stringify([url, init])
    expect(wire).not.toContain(PASSWORD)
    expect(wire).not.toContain(SUFFIX)
    expect(wire).not.toContain(FULL)
    expect(wire.toLowerCase()).not.toContain(FULL.toLowerCase())
  })

  it('returns 0 when the suffix is absent, and ignores padding rows (count 0)', async () => {
    const fetchFn = mockFetch(`${SUFFIX}:0\nABCDEF:12\n`)
    expect(await pwnedCount(PASSWORD, { fetchFn })).toBe(0)
    expect(parseRangeResponse('AAA:0\nBBB:5').size).toBe(1)
  })

  it('audit: one request per distinct prefix, prefixes only', async () => {
    const fetchFn = mockFetch(`${SUFFIX}:10\n`)
    const items = [
      { id: 'a', password: PASSWORD },
      { id: 'b', password: PASSWORD },
      { id: 'c', password: 'another-secret-value' },
      { id: 'd', password: '' },
    ]
    const res = await auditPasswords(items, { fetchFn, concurrency: 1 })
    expect(res.get('a')).toBe(10)
    expect(res.get('b')).toBe(10)
    expect(res.has('d')).toBe(false)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    for (const [url, init] of fetchFn.mock.calls) {
      expect(url).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/)
      expect(init.body).toBeUndefined()
      const wire = JSON.stringify([url, init])
      expect(wire).not.toContain('another-secret-value')
      expect(wire).not.toContain(PASSWORD)
      expect(wire).not.toContain(SUFFIX)
    }
  })

  it('propagates HTTP errors without leaking', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => new Response('', { status: 429 }))
    await expect(pwnedCount(PASSWORD, { fetchFn })).rejects.toThrow('HIBP: HTTP 429')
  })
})
