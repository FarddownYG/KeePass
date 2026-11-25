import { useState } from 'react'
import { ArrowLeft, History, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { deleteEntry, fieldText, isInRecycleBin, moveEntry, restoreHistory, rootGroup, type Kdbx, type KdbxEntry } from '../../core/vault'
import { Badge } from '../components/Badge'
import { Button, IconButton } from '../components/Button'
import { ConfirmDialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { useSession } from '../state/session-context'
import { useToast } from '../state/toast-context'
import { DetailFields } from './DetailFields'
import { formatDateTime, groupPath } from './vault-utils'

interface EntryDetailProps {
  db: Kdbx
  entry: KdbxEntry
  onBack: () => void
  onEdit: () => void
  onGone: () => void
}

type Tab = 'details' | 'history'

export function EntryDetail({ db, entry, onBack, onEdit, onGone }: EntryDetailProps) {
  const { mutate } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('details')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [version, setVersion] = useState<number | null>(null)
  const inBin = isInRecycleBin(db, entry)
  const history = entry.history
  const path = groupPath(entry)

  const remove = (): void => {
    setConfirmDelete(false)
    mutate((d) => deleteEntry(d, entry))
    toast(inBin ? 'Entrée supprimée définitivement' : 'Entrée déplacée dans la corbeille')
    onGone()
  }

  const putBack = (): void => {
    mutate((d) => {
      const prev = entry.previousParentGroup ? d.getGroup(entry.previousParentGroup) : undefined
      moveEntry(d, entry, prev && !isInRecycleBin(d, prev) ? prev : rootGroup(d))
    })
    toast('Entrée remise dans le coffre')
    onGone()
  }

  const restore = (index: number): void => {
    mutate((d) => restoreHistory(d, entry, index))
    setVersion(null)
    setTab('details')
    toast('Version restaurée')
  }

  const snapshot = version !== null ? history[version] : undefined

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line bg-surface p-3 pt-[max(12px,env(safe-area-inset-top))] lg:px-6 lg:py-4">
        <IconButton label="Retour à la liste" onClick={onBack} className="-ml-1 lg:hidden">
          <ArrowLeft className="size-5" aria-hidden />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{fieldText(entry, 'Title') || 'Sans titre'}</h2>
          <p className="truncate text-sm text-fg-muted">{path || 'Racine'}</p>
        </div>
        {inBin ? (
          <>
            <span className="hidden sm:inline-flex">
              <Button onClick={putBack} icon={<Undo2 className="size-4" aria-hidden />}>
                Remettre
              </Button>
            </span>
            <span className="sm:hidden">
              <IconButton label="Remettre dans le coffre" onClick={putBack}>
                <Undo2 className="size-5" aria-hidden />
              </IconButton>
            </span>
          </>
        ) : (
          <>
            <span className="hidden sm:inline-flex">
              <Button onClick={onEdit} icon={<Pencil className="size-4" aria-hidden />}>
                Modifier
              </Button>
            </span>
            <span className="sm:hidden">
              <IconButton label="Modifier" onClick={onEdit}>
                <Pencil className="size-5" aria-hidden />
              </IconButton>
            </span>
          </>
        )}
        <IconButton label={inBin ? 'Supprimer définitivement' : 'Supprimer'} onClick={() => setConfirmDelete(true)} className="text-danger hover:text-danger">
          <Trash2 className="size-5 lg:size-4" aria-hidden />
        </IconButton>
      </header>

      <div className="border-b border-line bg-surface px-4 lg:px-6" role="tablist" aria-label="Sections de l’entrée">
        {(
          [
            ['details', 'Détails'],
            ['history', `Historique (${history.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              setVersion(null)
            }}
            className={`-mb-px h-11 border-b-2 px-3 text-base font-medium transition-colors duration-150 lg:h-10 lg:text-sm ${
              tab === id ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:px-6 lg:py-6">
        <div className="max-w-2xl">
          {tab === 'details' ? (
            <DetailFields entry={entry} />
          ) : snapshot ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => setVersion(null)} icon={<ArrowLeft className="size-4" aria-hidden />} className="-ml-4">
                  Versions
                </Button>
                <p className="flex-1 text-base font-medium">Version du {formatDateTime(snapshot.times.lastModTime)}</p>
                {!inBin ? (
                  <Button onClick={() => restore(version ?? 0)} icon={<RotateCcw className="size-4" aria-hidden />}>
                    Restaurer
                  </Button>
                ) : null}
              </div>
              <DetailFields entry={snapshot} showDates={false} key={version} />
            </div>
          ) : history.length === 0 ? (
            <EmptyState icon={<History className="size-6" aria-hidden />} title="Aucune version précédente">
              L’historique se remplit à chaque modification de l’entrée.
            </EmptyState>
          ) : (
            <ul className="rounded-lg border border-line bg-surface">
              {history
                .map((h, i) => ({ h, i }))
                .reverse()
                .map(({ h, i }) => (
                  <li key={i} className="border-b border-line last:border-b-0">
                    <button type="button" onClick={() => setVersion(i)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 hover:bg-hover">
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium">{formatDateTime(h.times.lastModTime)}</span>
                        <span className="block truncate text-sm text-fg-muted">{fieldText(h, 'Title') || 'Sans titre'}</span>
                      </span>
                      {i === history.length - 1 ? <Badge>Précédente</Badge> : null}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={inBin ? 'Supprimer définitivement ?' : 'Supprimer cette entrée ?'}
        confirmLabel={inBin ? 'Supprimer définitivement' : 'Mettre à la corbeille'}
        danger
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      >
        {inBin ? (
          <p>« {fieldText(entry, 'Title') || 'Sans titre'} » sera effacée pour de bon. Cette action est irréversible.</p>
        ) : (
          <p>« {fieldText(entry, 'Title') || 'Sans titre'} » sera déplacée dans la corbeille. Vous pourrez la remettre dans le coffre.</p>
        )}
      </ConfirmDialog>
    </div>
  )
}
