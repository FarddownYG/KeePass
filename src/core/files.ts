const KDBX_TYPES = [{ description: 'Base KeePass', accept: { 'application/octet-stream': ['.kdbx'] } }]

export interface PickedFile {
  name: string
  bytes: ArrayBuffer
  handle: FileSystemFileHandle | null
  lastModified: number | null
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Fallback picker using a detached <input type=file>. Resolves null if cancelled. */
function pickWithInput(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}

export async function pickVaultFile(): Promise<PickedFile | null> {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: KDBX_TYPES, id: 'keyhold-vault' })
      const file = await handle.getFile()
      return { name: file.name, bytes: await file.arrayBuffer(), handle, lastModified: file.lastModified }
    } catch (err) {
      if (isAbort(err)) return null
      throw err
    }
  }
  const file = await pickWithInput('.kdbx')
  return file ? { name: file.name, bytes: await file.arrayBuffer(), handle: null, lastModified: null } : null
}

/**
 * Re-reads the file behind a stored handle (asks read permission; call from a user gesture).
 * Returns null when unavailable (permission denied, file moved, unsupported browser).
 */
export async function rereadHandle(handle: FileSystemFileHandle): Promise<{ bytes: ArrayBuffer; lastModified: number } | null> {
  try {
    let perm: PermissionState = handle.queryPermission ? await handle.queryPermission({ mode: 'read' }) : 'granted'
    if (perm !== 'granted' && handle.requestPermission) perm = await handle.requestPermission({ mode: 'read' })
    if (perm !== 'granted') return null
    const file = await handle.getFile()
    return { bytes: await file.arrayBuffer(), lastModified: file.lastModified }
  } catch {
    return null
  }
}

export async function pickKeyFile(): Promise<{ name: string; bytes: ArrayBuffer } | null> {
  const file = await pickWithInput('')
  return file ? { name: file.name, bytes: await file.arrayBuffer() } : null
}

export function downloadBytes(bytes: ArrayBuffer | Uint8Array, filename: string, mime = 'application/octet-stream'): void {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  const url = URL.createObjectURL(new Blob([copy], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type SaveResult =
  | { method: 'handle'; handle: FileSystemFileHandle; lastModified: number | null }
  | { method: 'download' }
  | { method: 'cancelled' }
  /** The file on disk changed since it was opened (another app / sync): nothing was written. */
  | { method: 'conflict' }

async function lastModifiedOf(handle: FileSystemFileHandle): Promise<number | null> {
  try {
    return (await handle.getFile()).lastModified
  } catch {
    return null
  }
}

async function ensureWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  if (handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    if (!handle.requestPermission || (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return false
  }
  return true
}

async function writeHandle(handle: FileSystemFileHandle, bytes: ArrayBuffer): Promise<boolean> {
  if (!(await ensureWritePermission(handle))) return false
  const writable = await handle.createWritable()
  await writable.write(bytes)
  await writable.close()
  return true
}

/** Saves encrypted bytes: existing handle → save picker → download fallback. */
export async function saveVaultFile(
  bytes: ArrayBuffer,
  opts: {
    handle: FileSystemFileHandle | null
    suggestedName: string
    forcePicker?: boolean
    /** lastModified observed when the vault was read/last written. Unknown (null) with a handle = conflict (fail closed). */
    expectedLastModified: number | null
  },
): Promise<SaveResult> {
  if (opts.handle && !opts.forcePicker) {
    const expected = opts.expectedLastModified
    // Permission first, so the file can be read for the conflict check.
    if (!(await ensureWritePermission(opts.handle))) return { method: 'cancelled' }
    const current = await lastModifiedOf(opts.handle)
    // Fail closed: unknown baseline, unreadable or changed file → never overwrite.
    if (expected === null || current === null || current !== expected) return { method: 'conflict' }
    if (await writeHandle(opts.handle, bytes)) {
      return { method: 'handle', handle: opts.handle, lastModified: await lastModifiedOf(opts.handle) }
    }
  }
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: opts.suggestedName, types: KDBX_TYPES, id: 'keyhold-vault' })
      if (await writeHandle(handle, bytes)) return { method: 'handle', handle, lastModified: await lastModifiedOf(handle) }
      return { method: 'cancelled' }
    } catch (err) {
      if (isAbort(err)) return { method: 'cancelled' }
      throw err
    }
  }
  downloadBytes(bytes, opts.suggestedName)
  return { method: 'download' }
}
