import { useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { createVault } from '../../core/vault'
import { Button } from '../components/Button'
import { CredentialsFields } from '../components/CredentialsFields'
import { EMPTY_CREDENTIALS, validateCredentials, type CredentialsValue } from '../components/credentials'
import { Checkbox, TextField } from '../components/Field'
import { useSession } from '../state/session-context'

function fileNameFor(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Mon coffre'
  return `${clean}.kdbx`
}

export function CreateForm({ onBack }: { onBack: () => void }) {
  const { adoptNewVault } = useSession()
  const [name, setName] = useState('Mon coffre')
  const [cred, setCred] = useState<CredentialsValue>(EMPTY_CREDENTIALS)
  const [saveNow, setSaveNow] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const problem = validateCredentials(cred)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const db = createVault(name.trim() || 'Mon coffre', { password: cred.password, keyFile: cred.keyFile?.bytes ?? null })
      await adoptNewVault(db, fileNameFor(name), saveNow)
    } catch {
      setError('La création du coffre a échoué.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" aria-busy={busy}>
      <div>
        <Button variant="ghost" onClick={onBack} disabled={busy} icon={<ArrowLeft className="size-4" aria-hidden />} className="-ml-4">
          Retour
        </Button>
        <h1 className="mt-2 text-xl font-semibold">Créer un coffre</h1>
        <p className="mt-1 text-sm text-fg-muted">Le fichier .kdbx produit s’ouvre aussi dans KeePassXC et KeePass.</p>
      </div>

      <TextField label="Nom du coffre" value={name} onChange={setName} disabled={busy} autoComplete="off" />
      <CredentialsFields value={cred} onChange={setCred} disabled={busy} baseName={name} userInputs={[name]} />
      <Checkbox label="Enregistrer le fichier tout de suite" checked={saveNow} onChange={setSaveNow} disabled={busy} />

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" loading={busy}>
        {busy ? 'Création…' : 'Créer le coffre'}
      </Button>
    </form>
  )
}
