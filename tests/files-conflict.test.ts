import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveVaultFile } from '../src/core/files'

function fakeHandle(opts: { lastModified: number; readable?: boolean }) {
  const written: ArrayBuffer[] = []
  let mtime = opts.lastModified
  const handle = {
    name: 'v.kdbx',
    queryPermission: async () => 'granted' as PermissionState,
    requestPermission: async () => 'granted' as PermissionState,
    getFile: async () => {
      if (opts.readable === false) throw new DOMException('denied', 'NotAllowedError')
      return { lastModified: mtime } as File
    },
    createWritable: async () => ({
      write: async (b: ArrayBuffer) => {
        written.push(b)
      },
      close: async () => {
        mtime += 1000
      },
    }),
  }
  return { handle: handle as unknown as FileSystemFileHandle, written }
}

afterEach(() => vi.unstubAllGlobals())

describe('save conflict detection', () => {
  const bytes = new Uint8Array([3, 0xd9, 0xa2, 0x9a]).buffer

  it('writes when the file is unchanged and returns the new mtime', async () => {
    const { handle, written } = fakeHandle({ lastModified: 100 })
    const res = await saveVaultFile(bytes, { handle, suggestedName: 'v.kdbx', expectedLastModified: 100 })
    expect(res).toMatchObject({ method: 'handle', lastModified: 1100 })
    expect(written).toHaveLength(1)
  })

  it('refuses to overwrite a file modified elsewhere', async () => {
    const { handle, written } = fakeHandle({ lastModified: 200 })
    const res = await saveVaultFile(bytes, { handle, suggestedName: 'v.kdbx', expectedLastModified: 100 })
    expect(res).toEqual({ method: 'conflict', reason: 'changed' })
    expect(written).toHaveLength(0)
  })

  it('fails closed when the baseline date is unknown', async () => {
    const { handle, written } = fakeHandle({ lastModified: 100 })
    const res = await saveVaultFile(bytes, { handle, suggestedName: 'v.kdbx', expectedLastModified: null })
    expect(res).toEqual({ method: 'conflict', reason: 'unverifiable' })
    expect(written).toHaveLength(0)
  })

  it('fails closed when the file cannot be read', async () => {
    const { handle, written } = fakeHandle({ lastModified: 100, readable: false })
    const res = await saveVaultFile(bytes, { handle, suggestedName: 'v.kdbx', expectedLastModified: 100 })
    expect(res.method).toBe('conflict')
    expect(written).toHaveLength(0)
  })
})
