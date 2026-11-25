import { describe, expect, it } from 'vitest'
import {
  CHARSETS,
  generatePassphrase,
  generatePassword,
  loadWordlist,
  passwordEntropyBits,
  randomInt,
} from '../src/core/generator'
import { estimateStrength } from '../src/core/strength'

describe('generator', () => {
  it('respects length and includes every selected set', () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword({ length: 16, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false })
      expect(p).toHaveLength(16)
      for (const set of Object.values(CHARSETS)) expect([...p].some((c) => set.includes(c))).toBe(true)
    }
  })

  it('honours set exclusions and ambiguous filter', () => {
    const p = generatePassword({ length: 64, lower: false, upper: false, digits: true, symbols: false, excludeAmbiguous: true })
    expect(p).toMatch(/^[2-9]{64}$/)
    expect(() => generatePassword({ length: 10, lower: false, upper: false, digits: false, symbols: false, excludeAmbiguous: false })).toThrow()
  })

  it('randomInt is in range and roughly uniform', () => {
    const counts = new Array<number>(6).fill(0)
    for (let i = 0; i < 6000; i++) counts[randomInt(6)]++
    for (const c of counts) expect(c).toBeGreaterThan(800)
  })

  it('passphrase uses the EFF list (7776 words)', async () => {
    const list = await loadWordlist()
    expect(list).toHaveLength(7776)
    const phrase = await generatePassphrase({ words: 6, separator: ' ', capitalize: false, includeNumber: false })
    const words = phrase.split(' ')
    expect(words).toHaveLength(6)
    for (const w of words) expect(list).toContain(w)
  })

  it('entropy and strength meter', async () => {
    expect(passwordEntropyBits({ length: 20, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false })).toBeGreaterThan(120)
    expect((await estimateStrength('password')).score).toBe(0)
    expect((await estimateStrength(generatePassword({ length: 24, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false }))).score).toBe(4)
  })
})
