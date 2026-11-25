import { describe, expect, it } from 'vitest'
import { VaultError } from '../src/core/errors'
import {
  allEntries,
  createEntry,
  createGroup,
  createVault,
  describeKdf,
  entriesIn,
  generateKeyFile,
  openVault,
  readEntry,
  rootGroup,
  saveVault,
  searchEntries,
  updateEntry,
  type EntryInput,
  type Kdbx,
} from '../src/core/vault'
import { FAST_KDF } from './helpers'

const PASSWORD = 'correct horse battery staple'

const sample: EntryInput = {
  title: 'Banque — compte joint',
  username: 'alice@example.org',
  password: 'S3cr3t!ÉtéÇa✓',
  url: 'https://banque.example',
  notes: 'Ligne 1\nLigne 2 — accents éàü',
  tags: ['finance', 'perso'],
  expiry: new Date('2031-01-02T03:04:05Z'),
  customFields: [
    { key: 'PIN', value: '4242', protected: true },
    { key: 'Agence', value: 'Paris 11', protected: false },
  ],
}

function snapshot(db: Kdbx) {
  const groupPath = (e: ReturnType<typeof allEntries>[number]) => {
    const names: string[] = []
    for (let g = e.parentGroup; g; g = g.parentGroup) names.unshift(g.name ?? '')
    return names.join('/')
  }
  return {
    name: db.meta.name,
    groups: rootGroup(db).groups.map((g) => g.name),
    entries: allEntries(db)
      .map((e) => ({
        uuid: e.uuid.id,
        path: groupPath(e),
        data: readEntry(e),
        history: e.history.map((h) => readEntry(h)),
      }))
      .sort((a, b) => a.uuid.localeCompare(b.uuid)),
  }
}

describe('KDBX round-trip', () => {
  it('create → save → reopen yields an identical vault (KDBX 4 + Argon2id)', async () => {
    const db = createVault('Coffre test', { password: PASSWORD }, FAST_KDF)
    const work = createGroup(db, rootGroup(db), 'Travail')
    const sub = createGroup(db, work, 'Serveurs')
    const e1 = createEntry(db, work, sample)
    createEntry(db, sub, { ...sample, title: 'SSH prod', tags: ['infra'], expiry: null, customFields: [] })
    updateEntry(db, e1, { ...sample, password: 'nouveau-mdp-#2' }) // creates history

    const bytes = await saveVault(db)
    const reopened = await openVault(bytes, { password: PASSWORD })

    expect(reopened.versionMajor).toBe(4)
    expect(describeKdf(reopened)).toBe('Argon2id')
    expect(snapshot(reopened)).toEqual(snapshot(db))

    const reE1 = allEntries(reopened).find((e) => e.uuid.id === e1.uuid.id)
    expect(reE1).toBeDefined()
    expect(readEntry(reE1!).password).toBe('nouveau-mdp-#2')
    expect(reE1!.history).toHaveLength(1)
    expect(readEntry(reE1!.history[0]).password).toBe(sample.password)
    expect(entriesIn(reopened, rootGroup(reopened))).toHaveLength(2)
  })

  it('round-trips with password + key file, and requires the key file', async () => {
    const keyFile = await generateKeyFile()
    const db = createVault('Avec clé', { password: PASSWORD, keyFile }, FAST_KDF)
    createEntry(db, rootGroup(db), sample)
    const bytes = await saveVault(db)

    const ok = await openVault(bytes, { password: PASSWORD, keyFile })
    expect(snapshot(ok)).toEqual(snapshot(db))

    await expect(openVault(bytes, { password: PASSWORD })).rejects.toMatchObject({ code: 'wrong-credentials' })
  })

  it('wrong password → clean VaultError, no crash', async () => {
    const db = createVault('X', { password: PASSWORD }, FAST_KDF)
    const bytes = await saveVault(db)
    const err = await openVault(bytes, { password: 'wrong' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(VaultError)
    expect((err as VaultError).code).toBe('wrong-credentials')
    expect((err as VaultError).message).not.toMatch(/wrong|correct horse/i)
  })

  it('garbage / truncated files → clean VaultError', async () => {
    const random = crypto.getRandomValues(new Uint8Array(512))
    await expect(openVault(random, { password: 'x' })).rejects.toBeInstanceOf(VaultError)
    await expect(openVault(new Uint8Array(0), { password: 'x' })).rejects.toBeInstanceOf(VaultError)

    const db = createVault('X', { password: PASSWORD }, FAST_KDF)
    const bytes = new Uint8Array(await saveVault(db))
    await expect(openVault(bytes.slice(0, 200), { password: PASSWORD })).rejects.toBeInstanceOf(VaultError)
  })

  it('search covers title/username/url/notes/tags but never passwords', async () => {
    const db = createVault('S', { password: PASSWORD }, FAST_KDF)
    createEntry(db, rootGroup(db), sample)
    expect(searchEntries(db, 'banque')).toHaveLength(1)
    expect(searchEntries(db, 'EAU accents')).toHaveLength(1) // accent-insensitive notes
    expect(searchEntries(db, 'finance')).toHaveLength(1)
    expect(searchEntries(db, 'S3cr3t')).toHaveLength(0)
    expect(searchEntries(db, '4242')).toHaveLength(0) // protected custom field
  })
})
