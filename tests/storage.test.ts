import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllVaults, forgetNonPendingVaults, forgetNormalCopy, forgetVault, loadRememberedVault, rememberVault, saveRecoveryCopy } from '../src/core/storage'

const kdbx = (n: number) => new Uint8Array([0x03, 0xd9, 0xa2, 0x9a, n]).buffer
const base = (name: string, savedAt: number, n = savedAt) => ({ name, encrypted: kdbx(n), handle: null, savedAt })

beforeEach(async () => {
  await clearAllVaults()
})

describe('IndexedDB storage', () => {
  it('refuses anything that is not a KDBX container', async () => {
    await expect(rememberVault({ ...base('x', 1), encrypted: new TextEncoder().encode('plain secret').buffer })).rejects.toThrow()
    await expect(saveRecoveryCopy({ ...base('x', 1), encrypted: new TextEncoder().encode('plain secret').buffer })).rejects.toThrow()
  })

  it('recovery copies have unique keys: same-named vaults never overwrite each other', async () => {
    const a = await saveRecoveryCopy(base('X.kdbx', 1))
    const b = await saveRecoveryCopy(base('X.kdbx', 2)) // another vault with the same file name
    expect(a).not.toBe(b)
    await rememberVault(base('X.kdbx', 3)) // normal copy of a same-named file opened from disk
    const first = await loadRememberedVault()
    expect(first?.pendingChanges).toBe(true)
    expect(first?.key).toBe(b)
    await forgetVault(b)
    expect((await loadRememberedVault())?.key).toBe(a) // A's recovery copy survived everything
  })

  it('re-saving a recovery copy with its own key replaces only that copy', async () => {
    const a = await saveRecoveryCopy(base('A.kdbx', 1))
    const other = await saveRecoveryCopy(base('B.kdbx', 2))
    expect(await saveRecoveryCopy(base('A.kdbx', 5), a)).toBe(a)
    await forgetVault(a)
    expect((await loadRememberedVault())?.key).toBe(other)
  })

  it('remember OFF (forgetNonPendingVaults) keeps recovery copies; forgetNormalCopy keeps them too', async () => {
    const p = await saveRecoveryCopy(base('P.kdbx', 1))
    await rememberVault(base('N.kdbx', 2))
    await rememberVault(base('P.kdbx', 3))
    await forgetNormalCopy('P.kdbx')
    await forgetNonPendingVaults()
    const left = await loadRememberedVault()
    expect(left?.key).toBe(p)
    await forgetVault(p)
    expect(await loadRememberedVault()).toBeNull()
  })

  it("migrates the legacy 'recent' record", async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('keyhold', 1)
      r.onsuccess = () => resolve(r.result)
    })
    await new Promise<void>((resolve) => {
      const t = db.transaction('vaults', 'readwrite')
      t.objectStore('vaults').put({ ...base('Old.kdbx', 9), pendingChanges: true }, 'recent')
      t.oncomplete = () => resolve()
    })
    db.close()
    const v = await loadRememberedVault()
    expect(v?.name).toBe('Old.kdbx')
    expect(v?.key?.startsWith('pending:')).toBe(true)
    await forgetVault(v?.key ?? '')
    expect(await loadRememberedVault()).toBeNull()
  })
})
