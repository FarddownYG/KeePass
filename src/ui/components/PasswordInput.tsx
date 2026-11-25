import { useId, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { IconButton } from './Button'
import { controlClass, FieldShell } from './Field'

interface PasswordInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password' | 'off'
  disabled?: boolean
  error?: string | null
  hint?: ReactNode
  /** Extra buttons placed after the reveal toggle (e.g. generator). */
  actions?: ReactNode
  autoFocus?: boolean
  required?: boolean
  onBlur?: () => void
}

export function PasswordInput({ label, value, onChange, autoComplete, disabled, error, hint, actions, autoFocus, required, onBlur }: PasswordInputProps) {
  const id = useId()
  const [shown, setShown] = useState(false)
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <div className="flex items-center gap-1">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={`${controlClass} h-11 min-w-0 flex-1 lg:h-10 ${shown ? 'font-mono' : ''}`}
        />
        <IconButton
          label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          variant="secondary"
          pressed={shown}
          disabled={disabled}
          onClick={() => setShown((v) => !v)}
          className="lg:size-10"
        >
          {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </IconButton>
        {actions}
      </div>
    </FieldShell>
  )
}
