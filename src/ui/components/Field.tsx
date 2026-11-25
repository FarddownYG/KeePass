import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export const controlClass =
  'w-full rounded-md border border-line-strong bg-surface px-3 text-[1rem] text-fg placeholder:text-fg-subtle transition-colors duration-150 hover:border-fg-subtle disabled:opacity-60 lg:text-base aria-[invalid=true]:border-danger'

interface FieldShellProps {
  id: string
  label: string
  hint?: ReactNode
  error?: string | null
  hideLabel?: boolean
  children: ReactNode
}

export function FieldShell({ id, label, hint, error, hideLabel, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-fg'}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <div id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  error?: string | null
  hideLabel?: boolean
}

export function TextField({ label, value, onChange, hint, error, hideLabel, className = '', ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={`${controlClass} h-11 lg:h-10 ${className}`}
        {...rest}
      />
    </FieldShell>
  )
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
}

export function TextArea({ label, value, onChange, hint, className = '', ...rest }: TextAreaProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} min-h-24 resize-y py-2 ${className}`}
        {...rest}
      />
    </FieldShell>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  hint?: ReactNode
  hideLabel?: boolean
}

export function SelectField({ label, value, onChange, options, hint, hideLabel, className = '', ...rest }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} hideLabel={hideLabel}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${controlClass} h-11 lg:h-10 ${className}`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

interface CheckboxProps {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  hint?: ReactNode
}

export function Checkbox({ label, checked, onChange, disabled, hint }: CheckboxProps) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-start gap-3 py-2.5 lg:min-h-9 lg:py-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-accent lg:size-4"
      />
      <label htmlFor={id} className="text-base text-fg lg:text-sm">
        {label}
        {hint ? <span className="mt-0.5 block text-sm text-fg-muted">{hint}</span> : null}
      </label>
    </div>
  )
}
