import { describe, expect, it } from 'vitest'
import { createEntry, createVault, openVault, rootGroup, saveVault } from '../src/core/vault'
import { FAST_KDF } from './helpers'

describe('concurrent saves', () => {
  it('parallel saves of the same vault all produce openable files', async () => {
    const db = createVault('C', { password: 'pw' }, FAST_KDF)
    createEntry(db, rootGroup(db), { title: 't', username: 'u', password: 'p', url: '', notes: '', tags: [], expiry: null, customFields: [] })
    const results = await Promise.all([saveVault(db), saveVault(db), saveVault(db)])
    for (const bytes of results) {
      const re = await openVault(bytes, { password: 'pw' })
      expect(re.meta.name).toBe('C')
    }
  })
})
