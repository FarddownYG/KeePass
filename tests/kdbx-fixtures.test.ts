import { describe, expect, it } from 'vitest'
import { allEntries, describeKdf, fieldText, openVault, readEntry, saveVault } from '../src/core/vault'
import { fixture } from './helpers'

const byTitle = (db: Awaited<ReturnType<typeof openVault>>, title: string) =>
  allEntries(db).find((e) => fieldText(e, 'Title') === title)

describe('KeePassXC compatibility', () => {
  it('opens a KDBX 4 / Argon2id vault written by KeePassXC 2.7.6', async () => {
    const db = await openVault(fixture('keepassxc-2.7.6-kdbx4-argon2id.kdbx'), { password: 'keyhold-fixture' })
    // KeePassXC preserves the original Generator field; its writes are proven by the content below.
    expect(db.versionMajor).toBe(4)
    expect(describeKdf(db)).toBe('Argon2id')

    const bank = byTitle(db, 'Banque')
    expect(bank && readEntry(bank)).toMatchObject({
      username: 'alice@example.org',
      password: 'KpXC-Pässwörd!',
      url: 'https://bank.example.org',
      notes: 'Ajoutée par KeePassXC',
    })
    expect(bank?.parentGroup?.name).toBe('Travail')

    const edited = byTitle(db, 'Créée par Keyhold')
    expect(edited && readEntry(edited).username).toBe('edited-by-kpxc')
    expect(edited && readEntry(edited).password).toBe('from-keyhold')
    expect(edited?.history.length).toBeGreaterThan(0) // KeePassXC kept the previous state
  })

  it('opens a native KeePassXC database with history', async () => {
    const db = await openVault(fixture('keepassxc-2.7.6-native.kdbx'), { password: 'keyhold-fixture' })
    expect(db.meta.generator).toBe('KeePassXC')
    const bank = byTitle(db, 'Banque')
    expect(bank && readEntry(bank).password).toBe('S3cr3t-É!')
    expect(bank?.history).toHaveLength(1)
  })

  it('opens a key-file-only KeePassXC database (no password component)', async () => {
    const db = await openVault(fixture('keepassxc-2.7.6-keyfile-only.kdbx'), {
      password: '',
      keyFile: fixture('keepassxc-2.7.6.keyx'),
    })
    expect(byTitle(db, 'KeyOnly')).toBeDefined()
  })

  it('rejects the KeePassXC file with a wrong password', async () => {
    await expect(openVault(fixture('keepassxc-2.7.6-kdbx4-argon2id.kdbx'), { password: 'nope' })).rejects.toMatchObject({
      code: 'wrong-credentials',
    })
  })
})

describe('kdbxweb reference files (KeePass 2.x)', () => {
  it('opens KDBX 4.1 with tags', async () => {
    const db = await openVault(fixture('KDBX4.1.kdbx'), { password: 'test' })
    expect(db.versionMajor).toBe(4)
    expect(db.versionMinor).toBe(1)
    expect(allEntries(db).length).toBeGreaterThan(0)
    expect(db.groups[0].groups[0].groups[0].tags.length).toBeGreaterThan(0) // KDBX 4.1 group tags
  })

  it('opens an Argon2id vault with password + key file, and re-saves it', async () => {
    const creds = { password: 'demo', keyFile: fixture('demo.key') }
    const db = await openVault(fixture('Argon2id.kdbx'), creds)
    expect(describeKdf(db)).toBe('Argon2id')
    const titles = allEntries(db).map((e) => fieldText(e, 'Title'))
    expect(titles.length).toBeGreaterThan(0)
    const again = await openVault(await saveVault(db), creds)
    expect(allEntries(again).map((e) => fieldText(e, 'Title'))).toEqual(titles)
  })
})
