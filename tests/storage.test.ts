import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { forgetVault, loadRememberedVault, rememberVault } from '../src/core/storage'

const kdbx = (n: number) => new Uint8Array([0x03, 0xd9, 0xa2, 0x9a, n]).buffer

describe('IndexedDB storage', () => {
  it('refuses anything that is not a KDBX container', async () => {
    await expect(rememberVault({ name: 'x', encrypted: new TextEncoder().encode('plain secret').buffer, handle: null, savedAt: 1 })).rejects.toThrow()
  })

  it("a recovery copy of vault B never overwrites vault A's, and pending copies are offered first", async () => {
    await forgetVault()
    await rememberVault({ name: 'A.kdbx', encrypted: kdbx(1), handle: null, savedAt: 1, pendingChanges: true })
    await rememberVault({ name: 'B.kdbx', encrypted: kdbx(2), handle: null, savedAt: 3 })
    expect((await loadRememberedVault())?.name).toBe('A.kdbx')
    await rememberVault({ name: 'B.kdbx', encrypted: kdbx(3), handle: null, savedAt: 4, pendingChanges: true })
    await rememberVault({ name: 'A.kdbx', encrypted: kdbx(4), handle: null, savedAt: 5 }) // A saved
    expect((await loadRememberedVault())?.name).toBe('B.kdbx')
    await forgetVault('B.kdbx')
    expect((await loadRememberedVault())?.name).toBe('A.kdbx')
    await forgetVault()
    expect(await loadRememberedVault()).toBeNull()
  })
})

describe('legacy single-record layout', () => {
  it("migrates the old 'recent' record to a per-vault record", async () => {
    await forgetVault()
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('keyhold', 1)
      r.onsuccess = () => resolve(r.result)
    })
    await new Promise<void>((resolve) => {
      const t = db.transaction('vaults', 'readwrite')
      t.objectStore('vaults').put({ name: 'Old.kdbx', encrypted: kdbx(9), handle: null, savedAt: 9, pendingChanges: true }, 'recent')
      t.oncomplete = () => resolve()
    })
    db.close()
    expect((await loadRememberedVault())?.name).toBe('Old.kdbx')
    await forgetVault('Old.kdbx')
    expect(await loadRememberedVault()).toBeNull()
  })
})

describe('forgetNonPendingVaults', () => {
  it('keeps unsaved recovery copies', async () => {
    const { forgetNonPendingVaults } = await import('../src/core/storage')
    await forgetVault()
    await rememberVault({ name: 'P.kdbx', encrypted: kdbx(1), handle: null, savedAt: 1, pendingChanges: true })
    await rememberVault({ name: 'N.kdbx', encrypted: kdbx(2), handle: null, savedAt: 2 })
    await forgetNonPendingVaults()
    expect((await loadRememberedVault())?.name).toBe('P.kdbx')
    await forgetVault('P.kdbx')
    expect(await loadRememberedVault()).toBeNull()
  })
})
