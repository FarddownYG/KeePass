/**
 * Have I Been Pwned — Pwned Passwords range API (k-anonymity).
 * The SHA-1 is computed locally; only the first 5 hex characters leave the browser.
 * This module is the ONLY place in the app allowed to perform network requests.
 */

export const HIBP_ENDPOINT = 'https://api.pwnedpasswords.com/range/'

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

/** In-memory only (prefix → suffix → count, or the in-flight request). Cleared on lock. */
const cache = new Map<string, Promise<Map<string, number>>>()

export function clearHibpCache(): void {
  cache.clear()
}

export async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export function parseRangeResponse(body: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const line of body.split('\n')) {
    const [suffix, count] = line.trim().split(':')
    if (!suffix || !count) continue
    const n = Number.parseInt(count, 10)
    // Padding entries (Add-Padding) have a count of 0 and must be ignored.
    if (n > 0) out.set(suffix.toUpperCase(), n)
  }
  return out
}

/** Lets one caller stop waiting without cancelling a request shared with other callers. */
function withAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(e instanceof Error ? e : new Error('HIBP request failed'))
      },
    )
  })
}

function fetchRange(prefix: string, fetchFn: FetchLike): Promise<Map<string, number>> {
  const cached = cache.get(prefix)
  if (cached) return cached
  const request = (async () => {
    const res = await fetchFn(HIBP_ENDPOINT + prefix, {
      method: 'GET',
      headers: { 'Add-Padding': 'true' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      mode: 'cors',
    })
    if (!res.ok) throw new Error(`HIBP: HTTP ${res.status}`)
    return parseRangeResponse(await res.text())
  })()
  cache.set(prefix, request)
  // In-flight requests are cached too (dedupe); a lock clears the map, so a response arriving
  // afterwards is never re-inserted. Failed requests are dropped so they can be retried.
  request.catch(() => {
    if (cache.get(prefix) === request) cache.delete(prefix)
  })
  return request
}

/** Returns how many times the password appears in known breaches (0 = not found). */
export async function pwnedCount(
  password: string,
  opts: { fetchFn?: FetchLike; signal?: AbortSignal } = {},
): Promise<number> {
  if (!password) return 0
  const hash = await sha1Hex(password)
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  const fetchFn: FetchLike = opts.fetchFn ?? ((input, init) => fetch(input, init))
  const range = await withAbort(fetchRange(prefix, fetchFn), opts.signal)
  return range.get(suffix) ?? 0
}

export interface AuditItem {
  id: string
  password: string
}

/** Checks many passwords with bounded concurrency. Results are returned, never persisted. */
export async function auditPasswords(
  items: AuditItem[],
  opts: {
    fetchFn?: FetchLike
    signal?: AbortSignal
    concurrency?: number
    onProgress?: (done: number, total: number) => void
  } = {},
): Promise<Map<string, number>> {
  const results = new Map<string, number>()
  const queue = items.filter((i) => i.password.length > 0)
  const total = queue.length
  let done = 0
  let index = 0
  const worker = async (): Promise<void> => {
    while (index < queue.length) {
      if (opts.signal?.aborted) return
      const item = queue[index++]
      results.set(item.id, await pwnedCount(item.password, opts))
      done++
      opts.onProgress?.(done, total)
    }
  }
  const n = Math.max(1, Math.min(opts.concurrency ?? 4, total))
  await Promise.all(Array.from({ length: n }, worker))
  return results
}
