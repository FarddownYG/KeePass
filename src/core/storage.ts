/**
 * IndexedDB persistence. ONLY encrypted .kdbx bytes (and the optional file handle) are stored.
 * Never the master password, key file, or any decrypted data.
 *
 * Two kinds of records, in separate key spaces so they can never overwrite each other:
 * - `vault:<file name>`  normal copy of the last opened/saved state (only if "remember" is on);
 * - `pending:<uuid>`     recovery copy written by auto-lock with UNSAVED changes. Unique key per copy:
 *                         removed only by a save of the session unlocked from it, or an explicit "forget".
 */

const DB_NAME = 'keyhold'
const STORE = 'vaults'
const LEGACY_KEY = 'recent'
const normalKey = (name: string): string => `vault:${name}`
const newPendingKey = (): string => `pending:${crypto.randomUUID()}`

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
  /** Storage key (filled in when loaded). */
  key?: string
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

/** Visits every record inside ONE transaction (atomic read-modify-write). */
async function eachRecord(mode: IDBTransactionMode, visit: (key: string, value: StoredVault, cursor: IDBCursorWithValue) => void): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = t.objectStore(STORE).openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        visit(String(cursor.key), cursor.value as StoredVault, cursor)
        cursor.continue()
      }
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error ?? new Error('IndexedDB error'))
      t.onabort = () => reject(t.error ?? new Error('IndexedDB transaction aborted'))
    })
  } finally {
    db.close()
  }
}

const KDBX_SIGNATURE = [0x03, 0xd9, 0xa2, 0x9a]

function assertEncrypted(bytes: ArrayBuffer): void {
  const head = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength))
  // Defensive guard: refuse anything that is not a KDBX container.
  if (!KDBX_SIGNATURE.every((b, i) => head[i] === b)) throw new Error('refusing to store non-KDBX data')
}

function strip(v: StoredVault): StoredVault {
  const { key: _key, ...rest } = v
  return rest
}

/** Normal copy of a vault (last opened/saved state). Never a recovery copy. */
export async function rememberVault(v: StoredVault): Promise<void> {
  assertEncrypted(v.encrypted)
  await tx('readwrite', (s) => s.put({ ...strip(v), pendingChanges: false }, normalKey(v.name)))
}

/** Writes an auto-lock recovery copy. Reuses `key` (the copy this session came from) or creates a new unique one. */
export async function saveRecoveryCopy(v: StoredVault, key?: string | null): Promise<string> {
  assertEncrypted(v.encrypted)
  const k = key && key.startsWith('pending:') ? key : newPendingKey()
  await tx('readwrite', (s) => s.put({ ...strip(v), pendingChanges: true }, k))
  return k
}

/** One-time migration of the single-record layout (key 'recent'). */
async function migrateLegacy(): Promise<void> {
  const legacy = await tx<StoredVault | undefined>('readonly', (s) => s.get(LEGACY_KEY) as IDBRequest<StoredVault | undefined>)
  if (!legacy) return
  const target = legacy.pendingChanges === true ? newPendingKey() : normalKey(legacy.name)
  // Move in ONE transaction: no duplicate copy if the deletion failed.
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite')
      const store = t.objectStore(STORE)
      store.put(legacy, target)
      store.delete(LEGACY_KEY)
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error ?? new Error('IndexedDB error'))
      t.onabort = () => reject(t.error ?? new Error('IndexedDB transaction aborted'))
    })
  } finally {
    db.close()
  }
}

/** Unsaved recovery copies first (most recent), then the most recently used vault. */
export async function loadRememberedVault(): Promise<StoredVault | null> {
  try {
    await migrateLegacy()
    const all: StoredVault[] = []
    await eachRecord('readonly', (key, value) => all.push({ ...value, key }))
    if (all.length === 0) return null
    all.sort((a, b) => Number(b.pendingChanges === true) - Number(a.pendingChanges === true) || b.savedAt - a.savedAt)
    return all[0]
  } catch {
    return null
  }
}

/** Forgets one record (by storage key). */
export async function forgetVault(key: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(key))
}

/** Erases EVERYTHING this app stored on the device (explicit user action only). */
export async function clearAllVaults(): Promise<void> {
  await tx('readwrite', (s) => s.clear())
}

/** Forgets the normal copy of a vault (its recovery copies are untouched). */
export async function forgetNormalCopy(name: string): Promise<void> {
  await forgetVault(normalKey(name))
}

/** Forgets every normal copy, atomically, keeping unsaved recovery copies ("remember" switched off). */
export async function forgetNonPendingVaults(): Promise<void> {
  await eachRecord('readwrite', (key, _value, cursor) => {
    if (!key.startsWith('pending:')) cursor.delete()
  })
}
