import { useState } from 'react'
import { FileKey, KeyRound, Trash2 } from 'lucide-react'
import { downloadBytes, pickKeyFile } from '../../core/files'
import { generateKeyFile } from '../../core/vault'
import { usePasswordAnalysis } from '../state/usePasswordAnalysis'
import { Button } from './Button'
import { PasswordFeedback } from './PasswordFeedback'
import { PasswordInput } from './PasswordInput'
import type { CredentialsValue } from './credentials'

interface CredentialsFieldsProps {
  value: CredentialsValue
  onChange: (value: CredentialsValue) => void
  disabled?: boolean
  /** Used to name a generated key file. */
  baseName: string
  userInputs?: string[]
}

export function CredentialsFields({ value, onChange, disabled, baseName, userInputs = [] }: CredentialsFieldsProps) {
  const analysis = usePasswordAnalysis(value.password, userInputs)
  const [keyError, setKeyError] = useState<string | null>(null)
  const mismatch = value.confirm.length > 0 && value.password !== value.confirm

  const generate = async (): Promise<void> => {
    setKeyError(null)
    try {
      const bytes = await generateKeyFile()
      const name = `${baseName.trim() || 'coffre'}.keyx`
      downloadBytes(bytes, name)
      onChange({ ...value, keyFile: { name, bytes } })
    } catch {
      setKeyError('Impossible de générer le fichier clé.')
    }
  }

  const choose = async (): Promise<void> => {
    setKeyError(null)
    try {
      const f = await pickKeyFile()
      if (f) onChange({ ...value, keyFile: { name: f.name, bytes: new Uint8Array(f.bytes) } })
    } catch {
      setKeyError('Impossible de lire ce fichier.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <PasswordInput
          label="Mot de passe maître"
          autoComplete="new-password"
          value={value.password}
          onChange={(password) => onChange({ ...value, password })}
          disabled={disabled}
        />
        <PasswordFeedback analysis={analysis} />
      </div>
      <PasswordInput
        label="Confirmer le mot de passe"
        autoComplete="new-password"
        value={value.confirm}
        onChange={(confirm) => onChange({ ...value, confirm })}
        disabled={disabled}
        error={mismatch ? 'Les deux mots de passe ne correspondent pas.' : null}
      />

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-4">
        <p className="text-sm font-medium">Fichier clé (facultatif)</p>
        {value.keyFile ? (
          <div className="flex items-center gap-2">
            <FileKey className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm" title={value.keyFile.name}>
              {value.keyFile.name}
            </span>
            <Button variant="ghost" disabled={disabled} onClick={() => onChange({ ...value, keyFile: null })} icon={<Trash2 className="size-4" aria-hidden />}>
              Retirer
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button disabled={disabled} onClick={() => void generate()} icon={<KeyRound className="size-4" aria-hidden />}>
              Générer un fichier clé
            </Button>
            <Button disabled={disabled} onClick={() => void choose()}>
              Utiliser un fichier existant
            </Button>
          </div>
        )}
        <p className="text-sm text-fg-muted">
          Un fichier clé s’ajoute au mot de passe. Conservez-le en lieu sûr : sans lui, le coffre est définitivement inaccessible.
        </p>
        {keyError ? <p className="text-sm text-danger">{keyError}</p> : null}
      </div>
    </div>
  )
}
