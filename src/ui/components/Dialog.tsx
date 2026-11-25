import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  variant?: 'modal' | 'drawer'
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' }

/** Native <dialog>: focus trap, Escape and inert background come from the platform. */
export function Dialog({ open, onClose, title, children, footer, variant = 'modal', size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const shape =
    variant === 'drawer'
      ? 'fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(320px,86vw)] max-w-none rounded-none border-r'
      : `m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] rounded-lg border shadow-lg ${SIZES[size]}`

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={`overflow-hidden border-line bg-surface p-0 text-fg backdrop:bg-[rgb(var(--shadow-color)/0.45)] ${shape}`}
    >
      {open ? (
        <div className={`flex flex-col ${variant === 'drawer' ? 'h-full' : 'max-h-[calc(100dvh-32px)]'}`}>
          {variant === 'modal' ? (
            <div className="flex items-center justify-between gap-4 border-b border-line py-2 pr-2 pl-5">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              <IconButton label="Fermer" onClick={onClose}>
                <X className="size-5" aria-hidden />
              </IconButton>
            </div>
          ) : (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          )}
          <div className={`min-h-0 flex-1 overflow-y-auto ${variant === 'modal' ? 'p-5' : ''}`}>{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
  extra?: ReactNode
}

export function ConfirmDialog({ open, title, children, confirmLabel, danger = false, onConfirm, onClose, extra }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          {extra}
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-base text-fg-muted">{children}</div>
    </Dialog>
  )
}
