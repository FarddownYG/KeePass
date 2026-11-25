const KDBX_TYPES = [{ description: 'Base KeePass', accept: { 'application/octet-stream': ['.kdbx'] } }]

export interface PickedFile {
  name: string
  bytes: ArrayBuffer
  handle: FileSystemFileHandle | null
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
      return { name: file.name, bytes: await file.arrayBuffer(), handle }
    } catch (err) {
      if (isAbort(err)) return null
      throw err
    }
  }
  const file = await pickWithInput('.kdbx')
  return file ? { name: file.name, bytes: await file.arrayBuffer(), handle: null } : null
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

export type SaveResult = { method: 'handle'; handle: FileSystemFileHandle } | { method: 'download' } | { method: 'cancelled' }

async function writeHandle(handle: FileSystemFileHandle, bytes: ArrayBuffer): Promise<boolean> {
  if (handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    if (!handle.requestPermission || (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return false
  }
  const writable = await handle.createWritable()
  await writable.write(bytes)
  await writable.close()
  return true
}

/** Saves encrypted bytes: existing handle → save picker → download fallback. */
export async function saveVaultFile(
  bytes: ArrayBuffer,
  opts: { handle: FileSystemFileHandle | null; suggestedName: string; forcePicker?: boolean },
): Promise<SaveResult> {
  if (opts.handle && !opts.forcePicker && (await writeHandle(opts.handle, bytes))) {
    return { method: 'handle', handle: opts.handle }
  }
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: opts.suggestedName, types: KDBX_TYPES, id: 'keyhold-vault' })
      if (await writeHandle(handle, bytes)) return { method: 'handle', handle }
      return { method: 'cancelled' }
    } catch (err) {
      if (isAbort(err)) return { method: 'cancelled' }
      throw err
    }
  }
  downloadBytes(bytes, opts.suggestedName)
  return { method: 'download' }
}
