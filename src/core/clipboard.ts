export const CLIPBOARD_CLEAR_MS = 30_000

let timer: ReturnType<typeof setTimeout> | null = null
let pendingClear = false
/** SHA-256 of the last copied secret (never the secret itself), to wipe only if it is still there. */
let lastDigest: string | null = null

async function digest(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** True only if reading the clipboard is already granted (never triggers a permission prompt). */
async function canReadSilently(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName })
    return status.state === 'granted'
  } catch {
    return false
  }
}

async function tryClear(): Promise<void> {
  try {
    if (lastDigest !== null && (await canReadSilently())) {
      const current = await navigator.clipboard.readText()
      if ((await digest(current)) !== lastDigest) {
        // The user copied something else since: leave it alone.
        lastDigest = null
        pendingClear = false
        return
      }
    }
    await navigator.clipboard.writeText('')
    pendingClear = false
    lastDigest = null
  } catch {
    // Document not focused: retry when the window regains focus.
    pendingClear = true
  }
}

function onFocus(): void {
  if (pendingClear) void tryClear()
}

if (typeof window !== 'undefined') window.addEventListener('focus', onFocus)

/** Copies a secret and schedules clipboard wipe after 30 s. */
export async function copySecret(text: string, clearAfterMs = CLIPBOARD_CLEAR_MS): Promise<void> {
  await navigator.clipboard.writeText(text)
  lastDigest = await digest(text)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void tryClear()
  }, clearAfterMs)
}

/** Copies a non-secret value. It replaces any pending secret, so the scheduled wipe is cancelled
 * (it would otherwise erase what the user just copied). */
export async function copyPlain(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
  if (timer) clearTimeout(timer)
  timer = null
  pendingClear = false
  lastDigest = null
}

/** Immediate wipe (on lock) if a copy is still pending. */
export async function clearClipboardNow(): Promise<void> {
  if (!timer && !pendingClear) return
  if (timer) clearTimeout(timer)
  timer = null
  await tryClear()
}
