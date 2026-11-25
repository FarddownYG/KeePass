export const CLIPBOARD_CLEAR_MS = 30_000

let timer: ReturnType<typeof setTimeout> | null = null
let pendingClear = false

async function tryClear(): Promise<void> {
  try {
    await navigator.clipboard.writeText('')
    pendingClear = false
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
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void tryClear()
  }, clearAfterMs)
}

/** Immediate wipe (on lock) if a copy is still pending. */
export async function clearClipboardNow(): Promise<void> {
  if (!timer && !pendingClear) return
  if (timer) clearTimeout(timer)
  timer = null
  await tryClear()
}
