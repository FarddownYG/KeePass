import { useState, type FormEvent } from 'react'
import { createGroup, deleteGroup, entriesIn, renameGroup, type Kdbx } from '../../core/vault'
import { Button } from '../components/Button'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { TextField } from '../components/Field'
import { useSession } from '../state/session-context'
import { groupDisplayName } from './vault-utils'
import type { GroupAction } from './view'

interface GroupDialogsProps {
  db: Kdbx
  action: GroupAction | null
  onClose: () => void
}

export function GroupDialogs({ db, action, onClose }: GroupDialogsProps) {
  const { mutate } = useSession()
  const target = action && action.kind !== 'create' ? db.getGroup(action.id) : undefined
  const parent = action && action.kind === 'create' ? db.getGroup(action.parentId) : undefined

  return (
    <>
      <NameDialog
        key={action ? `${action.kind}-${action.kind === 'create' ? action.parentId : action.id}` : 'none'}
        open={action?.kind === 'create' || action?.kind === 'rename'}
        title={action?.kind === 'rename' ? 'Renommer le groupe' : parent && parent !== db.getDefaultGroup() ? `Nouveau sous-groupe de « ${groupDisplayName(parent)} »` : 'Nouveau groupe'}
        initial={action?.kind === 'rename' && target ? groupDisplayName(target) : ''}
        confirmLabel={action?.kind === 'rename' ? 'Renommer' : 'Créer'}
        onClose={onClose}
        onSubmit={(name) => {
          if (action?.kind === 'create' && parent) mutate((d) => createGroup(d, parent, name))
          if (action?.kind === 'rename' && target) mutate(() => renameGroup(target, name))
          onClose()
        }}
      />
      <ConfirmDialog
        open={action?.kind === 'delete'}
        title="Supprimer ce groupe ?"
        confirmLabel="Mettre à la corbeille"
        danger
        onClose={onClose}
        onConfirm={() => {
          if (target) mutate((d) => deleteGroup(d, target))
          onClose()
        }}
      >
        {target ? (
          <p>
            Le groupe « {groupDisplayName(target)} » et ses {entriesIn(db, target).length} entrée{entriesIn(db, target).length > 1 ? 's' : ''} seront déplacés dans la corbeille.
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  )
}

interface NameDialogProps {
  open: boolean
  title: string
  initial: string
  confirmLabel: string
  onClose: () => void
  onSubmit: (name: string) => void
}

function NameDialog({ open, title, initial, confirmLabel, onClose, onSubmit }: NameDialogProps) {
  const [name, setName] = useState(initial)
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (name.trim()) onSubmit(name)
  }
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Nom du groupe" value={name} onChange={setName} autoComplete="off" autoFocus />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
