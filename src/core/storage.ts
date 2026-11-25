/**
 * IndexedDB persistence. ONLY the encrypted .kdbx bytes (and the optional file handle) are stored.
 * Never the master password, key file, or any decrypted data.
 */

const DB_NAME = 'keyhold'
const STORE = 'vaults'
const RECENT_KEY = 'recent'

export interface StoredVault {
  name: string
  /** Encrypted KDBX bytes, exactly as written to disk. */
  encrypted: ArrayBuffer
  handle: FileSystemFileHandle | null
  savedAt: number
  /** Encrypted copy written by auto-lock with changes not yet saved to the file. */
  pendingChanges?: boolean
  /** lastModified of the file behind `handle` when these bytes were read/written (conflict detection). */
  fileLastModified?: number | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB error'))
    })
  } finally {
    db.close()
  }
}

const KDBX_SIGNATURE = [0x03, 0xd9, 0xa2, 0x9a]

function looksEncrypted(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength))
  return KDBX_SIGNATURE.every((b, i) => head[i] === b)
}

export async function rememberVault(v: StoredVault): Promise<void> {
  // Defensive guard: refuse anything that is not a KDBX container.
  if (!looksEncrypted(v.encrypted)) throw new Error('refusing to store non-KDBX data')
  await tx('readwrite', (s) => s.put(v, RECENT_KEY))
}

export async function loadRememberedVault(): Promise<StoredVault | null> {
  try {
    const v = await tx<StoredVault | undefined>('readonly', (s) => s.get(RECENT_KEY) as IDBRequest<StoredVault | undefined>)
    return v ?? null
  } catch {
    return null
  }
}

export async function forgetVault(): Promise<void> {
  await tx('readwrite', (s) => s.delete(RECENT_KEY))
}
