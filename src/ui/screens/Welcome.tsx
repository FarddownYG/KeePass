import { useState } from 'react'
import { FilePlus2, FolderOpen, KeyRound, Lock, ShieldCheck, FileCheck2 } from 'lucide-react'
import { pickVaultFile } from '../../core/files'
import { Button } from '../components/Button'
import { useSession } from '../state/session-context'
import { CreateForm } from './CreateForm'
import { UnlockForm } from './UnlockForm'

export interface UnlockTarget {
  name: string
  bytes: ArrayBuffer
  handle: FileSystemFileHandle | null
  savedAt: number | null
  /** True when the vault comes from this device's remembered copy. */
  fromDevice: boolean
  /** Remembered copy holds changes not yet saved to the file (auto-lock recovery). */
  pending?: boolean
}

const POINTS = [
  { icon: Lock, title: 'Chiffré localement', text: 'Le déchiffrement se fait dans votre navigateur. Le mot de passe maître ne quitte jamais cet appareil.' },
  { icon: FileCheck2, title: 'Compatible KeePassXC', text: 'Vos coffres restent de simples fichiers .kdbx (KDBX 4), lisibles par KeePass et KeePassXC.' },
  { icon: ShieldCheck, title: 'Aucun compte, aucun serveur', text: 'Seule la vérification optionnelle des fuites contacte Have I Been Pwned, avec un préfixe d’empreinte uniquement.' },
]

export function Welcome() {
  const { remembered, forgetDevice } = useSession()
  const [picked, setPicked] = useState<UnlockTarget | null>(null)
  const [creating, setCreating] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)

  const target: UnlockTarget | null =
    picked ??
    (remembered
      ? { name: remembered.name, bytes: remembered.encrypted, handle: remembered.handle, savedAt: remembered.savedAt, fromDevice: true, pending: remembered.pendingChanges === true }
      : null)

  const openFile = async (): Promise<void> => {
    setPickError(null)
    try {
      const f = await pickVaultFile()
      if (f) {
        setCreating(false)
        setPicked({ name: f.name, bytes: f.bytes, handle: f.handle, savedAt: null, fromDevice: false })
      }
    } catch {
      setPickError('Impossible de lire ce fichier.')
    }
  }

  const forget = async (): Promise<void> => {
    try {
      await forgetDevice()
    } finally {
      setPicked(null)
    }
  }

  let content
  if (creating) {
    content = <CreateForm onBack={() => setCreating(false)} />
  } else if (remembered === undefined && !picked) {
    content = <div className="h-40" aria-hidden />
  } else if (target) {
    content = (
      <UnlockForm
        key={`${target.name}-${target.savedAt ?? 'file'}`}
        target={target}
        onOpenOther={() => void openFile()}
        onCreate={() => setCreating(true)}
        onForget={() => void forget()}
        onBack={picked ? () => setPicked(null) : null}
      />
    )
  } else {
    content = (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Ouvrir un coffre</h1>
        <p className="text-base text-fg-muted">Choisissez un fichier KeePass existant, ou créez un nouveau coffre chiffré.</p>
        <div className="mt-2 flex flex-col gap-2">
          <Button variant="primary" onClick={() => void openFile()} icon={<FolderOpen className="size-4" aria-hidden />}>
            Ouvrir un fichier .kdbx
          </Button>
          <Button onClick={() => setCreating(true)} icon={<FilePlus2 className="size-4" aria-hidden />}>
            Créer un coffre
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <main className="flex flex-col px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))] lg:px-20 lg:pt-28">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-fg">
              <KeyRound className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight">Keyhold</span>
          </div>
          <p className="mt-3 mb-8 text-base text-fg-muted">Vos mots de passe, chiffrés dans votre navigateur, dans un fichier KeePass qui vous appartient.</p>
          {content}
          {pickError ? (
            <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {pickError}
            </p>
          ) : null}
        </div>
      </main>
      <aside className="hidden border-l border-line bg-sunken lg:flex lg:flex-col lg:px-20 lg:pt-28" aria-label="À propos">
        <ul className="flex max-w-md flex-col gap-8">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <Icon className="mt-0.5 size-5 shrink-0 text-fg-muted" aria-hidden />
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-fg-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <p className="px-4 pb-8 text-sm text-fg-muted lg:hidden">Chiffré localement · compatible KeePassXC</p>
    </div>
  )
}
