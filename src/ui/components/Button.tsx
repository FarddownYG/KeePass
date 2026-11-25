import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-quiet'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-hover',
  ghost: 'text-fg-muted hover:bg-hover hover:text-fg',
  danger: 'bg-danger text-accent-fg hover:bg-danger-hover',
  'danger-quiet': 'border border-line-strong bg-surface text-danger hover:bg-danger-soft',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'secondary', loading = false, icon, children, className = '', disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 lg:h-9 lg:text-sm ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  variant?: 'ghost' | 'secondary'
  pressed?: boolean
}

export function IconButton({ label, variant = 'ghost', pressed, className = '', type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 lg:size-9 ${
        variant === 'secondary' ? 'border border-line-strong bg-surface text-fg hover:bg-hover' : 'text-fg-muted hover:bg-hover hover:text-fg'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
