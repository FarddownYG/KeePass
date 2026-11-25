import { describe, expect, it } from 'vitest'
import { computeArgon2 } from '../src/core/argon2-compute'

// Known answers produced by the PHC reference implementation (`argon2` CLI 20190702):
// printf 'keyhold-password' | argon2 'keyhold-salt-16b' -{d,id} -v {10,13} -t 2 -m 8 -p 1 -l 32 -r
const KAT: [0 | 2, 0x10 | 0x13, string][] = [
  [0, 0x10, 'caff18bc8e89ee407773d609a65a4b410bab6187e9cab6af5da1fcf71f8c3553'],
  [0, 0x13, '4d9a08607db925ec135c6091b78abfe5cd8787faa89d8bb232fa106021ea0b99'],
  [2, 0x10, '9cbc6949bca6125ab317cca20759860aab361efe15f5e7d26de4fc9dd5538ef1'],
  [2, 0x13, '769fa301987cec7d5109cef3b086b951a4b968e83136bcd1fec21a6b93679c72'],
]

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

describe('Argon2 known-answer tests (reference implementation)', () => {
  for (const [type, version, expected] of KAT) {
    it(`Argon2${type === 2 ? 'id' : 'd'} v0x${version.toString(16)}`, async () => {
      const out = await computeArgon2({
        password: new TextEncoder().encode('keyhold-password'),
        salt: new TextEncoder().encode('keyhold-salt-16b'),
        memoryKiB: 256,
        iterations: 2,
        parallelism: 1,
        length: 32,
        type,
        version,
      })
      expect(hex(out)).toBe(expected)
    })
  }
})

describe('Argon2 cost guard', () => {
  it('refuses a memory cost above 2 GiB (malicious file) with a kdf-failed error', async () => {
    const { createVault, openVault, saveVault } = await import('../src/core/vault')
    const db = createVault('Big', { password: 'pw' }, { memoryKiB: 3 * 1024 * 1024, iterations: 1, parallelism: 1 })
    await expect(saveVault(db)).rejects.toMatchObject({ code: 'kdf-failed' })
    const ok = createVault('Ok', { password: 'pw' }, { memoryKiB: 1024, iterations: 1, parallelism: 1 })
    await expect(openVault(await saveVault(ok), { password: 'pw' })).resolves.toBeDefined()
  })
})
