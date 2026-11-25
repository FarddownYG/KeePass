import { useState, type FormEvent } from 'react'
import { FileKey, FilePlus2, FolderOpen, LockOpen, Trash2 } from 'lucide-react'
import { VaultError } from '../../core/errors'
import { pickKeyFile } from '../../core/files'
import { openVault } from '../../core/vault'
import { Button } from '../components/Button'
import { PasswordInput } from '../components/PasswordInput'
import { useSession } from '../state/session-context'
import type { UnlockTarget } from './Welcome'

interface UnlockFormProps {
  target: UnlockTarget
  onOpenOther: () => void
  onCreate: () => void
  onForget: () => void
  onBack: (() => void) | null
}

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

export function UnlockForm({ target, onOpenOther, onCreate, onForget, onBack }: UnlockFormProps) {
  const { openDb } = useSession()
  const [password, setPassword] = useState('')
  const [keyFile, setKeyFile] = useState<{ name: string; bytes: Uint8Array } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chooseKey = async (): Promise<void> => {
    try {
      const f = await pickKeyFile()
      if (f) setKeyFile({ name: f.name, bytes: new Uint8Array(f.bytes) })
    } catch {
      setError('Impossible de lire ce fichier clé.')
    }
  }

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const db = await openVault(target.bytes.slice(0), { password, keyFile: keyFile?.bytes ?? null })
      setPassword('')
      openDb(db, target.name, target.handle, target.fromDevice ? undefined : target.bytes, target.pending === true)
    } catch (err) {
      setError(err instanceof VaultError ? err.message : "Impossible d'ouvrir la base.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" aria-busy={busy}>
      <div>
        <h1 className="text-xl font-semibold">Déverrouiller</h1>
        <p className="mt-1 text-base font-medium break-all">{target.name}</p>
        {target.savedAt ? <p className="text-sm text-fg-muted">Dernier enregistrement : {DATE.format(target.savedAt)}</p> : null}
      </div>

      <PasswordInput
        label="Mot de passe maître"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        disabled={busy}
        autoFocus
      />

      <div className="flex flex-col gap-1">
        {keyFile ? (
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
            <FileKey className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm" title={keyFile.name}>
              {keyFile.name}
            </span>
            <Button variant="ghost" disabled={busy} onClick={() => setKeyFile(null)} icon={<Trash2 className="size-4" aria-hidden />}>
              Retirer
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="ghost" disabled={busy} onClick={() => void chooseKey()} icon={<FileKey className="size-4" aria-hidden />} className="-ml-4">
              Ajouter un fichier clé (facultatif)
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" loading={busy} icon={busy ? undefined : <LockOpen className="size-4" aria-hidden />}>
        {busy ? 'Déchiffrement…' : 'Déverrouiller'}
      </Button>
      {busy ? <p className="-mt-3 text-sm text-fg-muted">La dérivation de la clé peut prendre quelques secondes.</p> : null}

      <div className="flex flex-col items-start gap-1 border-t border-line pt-4">
        <Button variant="ghost" disabled={busy} onClick={onOpenOther} icon={<FolderOpen className="size-4" aria-hidden />} className="-ml-4">
          Ouvrir un autre fichier
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCreate} icon={<FilePlus2 className="size-4" aria-hidden />} className="-ml-4">
          Créer un coffre
        </Button>
        {target.fromDevice ? (
          <Button variant="ghost" disabled={busy} onClick={onForget} icon={<Trash2 className="size-4" aria-hidden />} className="-ml-4 text-danger hover:text-danger">
            Oublier ce coffre sur cet appareil
          </Button>
        ) : onBack ? (
          <Button variant="ghost" disabled={busy} onClick={onBack} className="-ml-4">
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  )
}
