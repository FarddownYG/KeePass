/** Password / passphrase generator. Uses crypto.getRandomValues with rejection sampling (no modulo bias). */

export const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
} as const

const AMBIGUOUS = new Set('Il1O0o|`\'"')

export interface PasswordOptions {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
}

export interface PassphraseOptions {
  words: number
  separator: string
  capitalize: boolean
  includeNumber: boolean
}

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  words: 5,
  separator: '-',
  capitalize: true,
  includeNumber: true,
}

/** Uniform integer in [0, max). */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new RangeError('invalid max')
  const limit = 2 ** 32 - (2 ** 32 % max)
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

function pick(chars: string): string {
  return chars[randomInt(chars.length)]
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function activeSets(opts: PasswordOptions): string[] {
  const sets: string[] = []
  for (const key of ['lower', 'upper', 'digits', 'symbols'] as const) {
    if (!opts[key]) continue
    const chars = opts.excludeAmbiguous ? [...CHARSETS[key]].filter((c) => !AMBIGUOUS.has(c)).join('') : CHARSETS[key]
    sets.push(chars)
  }
  return sets
}

export function generatePassword(opts: PasswordOptions): string {
  const sets = activeSets(opts)
  if (sets.length === 0) throw new RangeError('Sélectionnez au moins un jeu de caractères')
  const length = Math.max(Math.min(Math.floor(opts.length), 128), sets.length, 4)
  const all = sets.join('')
  // Guarantee at least one char from each selected set, then fill and shuffle.
  const chars = sets.map(pick)
  while (chars.length < length) chars.push(pick(all))
  return shuffle(chars).join('')
}

export function passwordEntropyBits(opts: PasswordOptions): number {
  const size = activeSets(opts).join('').length
  return size > 0 ? Math.floor(opts.length * Math.log2(size)) : 0
}

let wordlist: readonly string[] | null = null

export async function loadWordlist(): Promise<readonly string[]> {
  if (!wordlist) {
    const mod = await import('./eff-wordlist.json')
    wordlist = mod.default
  }
  return wordlist
}

export async function generatePassphrase(opts: PassphraseOptions): Promise<string> {
  const list = await loadWordlist()
  const count = Math.max(3, Math.min(Math.floor(opts.words), 12))
  const words = Array.from({ length: count }, () => {
    const w = list[randomInt(list.length)]
    return opts.capitalize ? w[0].toUpperCase() + w.slice(1) : w
  })
  if (opts.includeNumber) {
    const i = randomInt(words.length)
    words[i] = words[i] + String(randomInt(10))
  }
  return words.join(opts.separator)
}

export function passphraseEntropyBits(opts: PassphraseOptions, listSize = 7776): number {
  const count = Math.max(3, Math.min(Math.floor(opts.words), 12))
  return Math.floor(count * Math.log2(listSize) + (opts.includeNumber ? Math.log2(10 * count) : 0))
}
