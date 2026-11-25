import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { ToastContext, type ToastKind } from './toast-context'

interface Item {
  id: number
  message: string
  kind: ToastKind
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const nextId = useRef(1)

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++
    setItems((prev) => [...prev.slice(-2), { id, message, kind }])
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const api = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex max-w-md items-start gap-2 rounded-md border border-line-strong bg-surface px-4 py-3 text-sm text-fg shadow-md"
          >
            {item.kind === 'error' ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            )}
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
