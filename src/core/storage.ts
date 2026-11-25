/**
 * IndexedDB persistence. ONLY the encrypted .kdbx bytes (and the optional file handle) are stored.
 * Never the master password, key file, or any decrypted data.
 */

const DB_NAME = 'keyhold'
const STORE = 'vaults'
/** One record per vault (keyed by file name), so a recovery copy never overwrites another vault's. */
const keyOf = (name: string): string => `vault:${name}`

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
  await tx('readwrite', (s) => s.put(v, keyOf(v.name)))
}

const LEGACY_KEY = 'recent'

/** One-time migration of the single-record layout (key 'recent') to per-vault records. */
async function migrateLegacy(): Promise<void> {
  const legacy = await tx<StoredVault | undefined>('readonly', (s) => s.get(LEGACY_KEY) as IDBRequest<StoredVault | undefined>)
  if (!legacy) return
  const current = await getRememberedVault(legacy.name)
  // Keep whichever matters more: a pending copy wins, then the most recent.
  const keepLegacy = !current || (legacy.pendingChanges === true && current.pendingChanges !== true) || (current.pendingChanges === legacy.pendingChanges && legacy.savedAt > current.savedAt)
  if (keepLegacy) await tx('readwrite', (s) => s.put(legacy, keyOf(legacy.name)))
  await tx('readwrite', (s) => s.delete(LEGACY_KEY))
}

export async function getRememberedVault(name: string): Promise<StoredVault | null> {
  try {
    const v = await tx<StoredVault | undefined>('readonly', (s) => s.get(keyOf(name)) as IDBRequest<StoredVault | undefined>)
    return v ?? null
  } catch {
    return null
  }
}

export async function loadRememberedVault(): Promise<StoredVault | null> {
  try {
    await migrateLegacy()
    const all = await tx<StoredVault[]>('readonly', (s) => s.getAll() as IDBRequest<StoredVault[]>)
    if (all.length === 0) return null
    // Unsaved recovery copies first (most recent), then the most recently used vault.
    const sorted = [...all].sort((a, b) => Number(b.pendingChanges === true) - Number(a.pendingChanges === true) || b.savedAt - a.savedAt)
    return sorted[0]
  } catch {
    return null
  }
}

/** Forgets every normal copy but keeps unsaved recovery copies (used when "remember" is switched off). */
export async function forgetNonPendingVaults(): Promise<void> {
  const all = await tx<StoredVault[]>('readonly', (s) => s.getAll() as IDBRequest<StoredVault[]>)
  for (const v of all) {
    if (v.pendingChanges !== true) await forgetVault(v.name)
  }
}

/** Forgets one vault (by name), or every vault stored on this device when no name is given. */
export async function forgetVault(name?: string): Promise<void> {
  await tx('readwrite', (s) => (name === undefined ? s.clear() : s.delete(keyOf(name))))
}
