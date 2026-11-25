import { useState, type ReactNode } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import { changeCredentials, allEntries, describeKdf, type Kdbx } from '../../core/vault'
import type { ThemePref } from '../../core/settings'
import { Button } from '../components/Button'
import { CredentialsFields } from '../components/CredentialsFields'
import { EMPTY_CREDENTIALS, validateCredentials, type CredentialsValue } from '../components/credentials'
import { Checkbox, SelectField } from '../components/Field'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { Segmented } from '../components/Segmented'
import { ToolHeader } from '../components/ToolHeader'
import { useSession } from '../state/session-context'
import { useToast } from '../state/toast-context'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-3 text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  )
}

const DELAYS = [1, 2, 5, 10, 15, 30].map((m) => ({ value: String(m), label: `${m} minute${m > 1 ? 's' : ''}` }))

export function SettingsScreen({ db, onBack }: { db: Kdbx; onBack: () => void }) {
  const { settings, updateSettings, forgetDevice, mutate, remembered } = useSession()
  const toast = useToast()
  const [credOpen, setCredOpen] = useState(false)
  const [cred, setCred] = useState<CredentialsValue>(EMPTY_CREDENTIALS)
  const [credError, setCredError] = useState<string | null>(null)
  const [credBusy, setCredBusy] = useState(false)
  const [confirmForget, setConfirmForget] = useState(false)

  const closeCred = (): void => {
    setCredOpen(false)
    setCred(EMPTY_CREDENTIALS)
    setCredError(null)
  }

  const applyCred = async (): Promise<void> => {
    const problem = validateCredentials(cred)
    if (problem) {
      setCredError(problem)
      return
    }
    setCredBusy(true)
    try {
      await changeCredentials(db, { password: cred.password, keyFile: cred.keyFile?.bytes ?? null })
      mutate(() => undefined)
      closeCred()
      toast('Identifiants modifiés : enregistrez le coffre pour les appliquer')
    } catch {
      setCredError('Impossible de modifier les identifiants.')
    } finally {
      setCredBusy(false)
    }
  }

  const setRemember = (value: boolean): void => {
    updateSettings({ rememberVault: value })
    if (!value) void forgetDevice().then(() => toast('Copie chiffrée supprimée de cet appareil'))
  }

  const forget = (): void => {
    setConfirmForget(false)
    void forgetDevice().then(() => toast('Données de cet appareil supprimées'))
  }

  const kdf = describeKdf(db)

  return (
    <ToolHeader title="Réglages" onBack={onBack}>
      <div className="flex flex-col gap-6">
        <Card title="Apparence">
          <div>
            <Segmented<ThemePref>
            label="Thème"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: 'Système' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
            ]}
            />
          </div>
        </Card>

        <Card title="Verrouillage">
          <SelectField
            label="Verrouiller après inactivité"
            value={String(settings.lockAfterMinutes)}
            onChange={(v) => updateSettings({ lockAfterMinutes: Number(v) })}
            options={DELAYS}
            className="max-w-xs"
          />
          <Checkbox
            label="Verrouiller quand l’onglet est masqué"
            hint="Recommandé : le coffre se ferme dès que vous changez d’onglet ou d’application."
            checked={settings.lockOnHidden}
            onChange={(lockOnHidden) => updateSettings({ lockOnHidden })}
          />
        </Card>

        <Card title="Cet appareil">
          <Checkbox
            label="Mémoriser le coffre sur cet appareil"
            hint="Garde une copie chiffrée (jamais le mot de passe) pour déverrouiller plus vite. Désactiver supprime cette copie."
            checked={settings.rememberVault}
            onChange={setRemember}
          />
          <div>
            <Button variant="danger-quiet" disabled={remembered === null} onClick={() => setConfirmForget(true)} icon={<Trash2 className="size-4" aria-hidden />}>
              Oublier les données de cet appareil
            </Button>
          </div>
        </Card>

        <Card title="Identifiants du coffre">
          <p className="text-sm text-fg-muted">Changez le mot de passe maître ou le fichier clé. La modification s’applique à l’enregistrement suivant.</p>
          <div>
            <Button onClick={() => setCredOpen(true)} icon={<KeyRound className="size-4" aria-hidden />}>
              Changer le mot de passe ou le fichier clé
            </Button>
          </div>
        </Card>

        <Card title="Informations">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-fg-muted">Format</dt>
            <dd>
              KDBX {db.versionMajor}.{db.versionMinor}
            </dd>
            <dt className="text-fg-muted">Dérivation de clé</dt>
            <dd>{kdf}</dd>
            <dt className="text-fg-muted">Entrées</dt>
            <dd>{allEntries(db).length}</dd>
          </dl>
        </Card>
      </div>

      <Dialog
        open={credOpen}
        onClose={closeCred}
        title="Changer les identifiants"
        footer={
          <>
            <Button onClick={closeCred} disabled={credBusy}>
              Annuler
            </Button>
            <Button variant="primary" loading={credBusy} onClick={() => void applyCred()}>
              Appliquer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <CredentialsFields value={cred} onChange={setCred} disabled={credBusy} baseName={db.meta.name || 'coffre'} />
          {credError ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {credError}
            </p>
          ) : null}
        </div>
      </Dialog>

      <ConfirmDialog open={confirmForget} title="Oublier cet appareil ?" confirmLabel="Oublier" danger onConfirm={forget} onClose={() => setConfirmForget(false)}>
        <p>La copie chiffrée du coffre enregistrée dans ce navigateur sera supprimée. Votre fichier .kdbx n’est pas touché.</p>
      </ConfirmDialog>
    </ToolHeader>
  )
}
