import { describe, expect, it } from 'vitest'
import { allEntries, openVault, readEntry, saveVault, updateEntry } from '../src/core/vault'
import { fixture } from './helpers'

describe('preservation on re-save', () => {
  it('keeps attachments of entries, even after editing them', async () => {
    const creds = { password: 'demo', keyFile: fixture('demo.key') }
    const db = await openVault(fixture('Argon2id.kdbx'), creds)
    const withBin = allEntries(db).filter((e) => e.binaries.size > 0)
    expect(withBin.length).toBeGreaterThan(0)
    const target = withBin[0]
    const names = [...target.binaries.keys()]
    updateEntry(db, target, { ...readEntry(target), notes: 'edited' })
    const again = await openVault(await saveVault(db), creds)
    const reTarget = allEntries(again).find((e) => e.uuid.id === target.uuid.id)
    expect(reTarget && [...reTarget.binaries.keys()]).toEqual(names)
  })

  it('re-saves a KDBX 3.1 file in its original format', async () => {
    const creds = { password: 'keyhold-fixture' }
    const db = await openVault(fixture('keepassxc-2.7.6-native.kdbx'), creds)
    const again = await openVault(await saveVault(db), creds)
    expect(again.versionMajor).toBe(3)
  })
})
