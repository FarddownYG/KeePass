import { useCallback } from 'react'
import { copySecret } from '../../core/clipboard'
import { useToast } from './toast-context'

/** Copies a secret (auto-wiped after 30 s) or a plain value, and confirms with a toast. */
export function useCopy(): (getText: () => string, opts?: { secret?: boolean; label?: string }) => void {
  const toast = useToast()
  return useCallback(
    (getText, opts) => {
      const secret = opts?.secret ?? true
      const run = async (): Promise<void> => {
        const text = getText()
        if (secret) {
          await copySecret(text)
          toast('Copié — effacé du presse-papiers dans 30 s')
        } else {
          await navigator.clipboard.writeText(text)
          toast('Copié')
        }
      }
      run().catch(() => toast('Copie impossible : autorisez l’accès au presse-papiers.', 'error'))
    },
    [toast],
  )
}
