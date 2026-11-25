import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { IconButton } from './Button'

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  onSelect: () => void
}

interface MenuProps {
  label: string
  icon: ReactNode
  items: MenuItem[]
  className?: string
}

export function Menu({ label, icon, items, className = '' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    list.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setOpen(false)
      root.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return (
    <div ref={root} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <IconButton label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)}>
        {icon}
      </IconButton>
      {open ? (
        <div
          id={id}
          ref={list}
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-md"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={`flex h-11 w-full items-center gap-2 rounded-md px-3 text-left text-base transition-colors duration-150 hover:bg-hover lg:h-9 lg:text-sm ${
                item.danger ? 'text-danger' : 'text-fg'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
