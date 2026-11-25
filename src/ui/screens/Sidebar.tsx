import { ChevronDown, ChevronRight, FolderPlus, Folder, KeyRound, Library, Lock, MoreHorizontal, Pencil, Save, ScanSearch, Settings as SettingsIcon, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { allEntries, entriesIn, groupId, recycleBin, rootGroup, type Kdbx, type KdbxGroup } from '../../core/vault'
import { Button, IconButton } from '../components/Button'
import { Menu } from '../components/Menu'
import { groupDisplayName } from './vault-utils'
import type { GroupAction, GroupSel, Tool } from './view'

interface SidebarProps {
  db: Kdbx
  /** Only here to re-render when the vault is mutated. */
  rev: number
  vaultName: string
  fileName: string
  dirty: boolean
  saving: boolean
  sel: GroupSel
  tool: Tool | null
  onSelectGroup: (sel: GroupSel) => void
  onSelectTool: (tool: Tool) => void
  onGroupAction: (action: GroupAction) => void
  onSave: () => void
  onSaveAs: () => void
  onLock: () => void
}

const ROW =
  'flex h-11 w-full min-w-0 items-center gap-2 rounded-md px-3 text-left text-base transition-colors duration-150 lg:h-9 lg:text-sm'

function rowState(active: boolean): string {
  return active ? 'bg-selected font-semibold text-fg' : 'text-fg-muted hover:bg-hover hover:text-fg'
}

export function Sidebar(props: SidebarProps) {
  const { db, vaultName, fileName, dirty, saving, sel, tool, onSelectGroup, onSelectTool, onGroupAction, onSave, onSaveAs, onLock } = props
  const bin = recycleBin(db)
  const root = rootGroup(db)
  const topGroups = root.groups.filter((g) => g !== bin)
  const vaultActive = tool === null

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-2">
      <div className="flex flex-col gap-3 border-b border-line p-4 pt-[max(16px,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold" title={vaultName}>
            {vaultName}
          </p>
          <p className="truncate text-sm text-fg-muted" title={fileName}>
            {fileName || 'Non enregistré'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={dirty ? 'primary' : 'secondary'}
            loading={saving}
            onClick={onSave}
            icon={dirty ? <span className="size-2 rounded-full bg-accent-fg" aria-hidden /> : <Save className="size-4" aria-hidden />}
            className="flex-1"
            title="Enregistrer (Ctrl+S)"
          >
            Enregistrer
          </Button>
          <Menu label="Plus d’options d’enregistrement" icon={<MoreHorizontal className="size-4" aria-hidden />} items={[{ label: 'Enregistrer sous…', icon: <Save className="size-4" aria-hidden />, onSelect: onSaveAs }]} />
          <IconButton label="Verrouiller (Ctrl+L)" onClick={onLock}>
            <Lock className="size-4" aria-hidden />
          </IconButton>
        </div>
        {dirty ? <p className="-mt-1 text-sm text-fg-muted">Modifications non enregistrées</p> : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Coffre">
        <button type="button" onClick={() => onSelectGroup('all')} aria-current={vaultActive && sel === 'all' ? 'page' : undefined} className={`${ROW} ${rowState(vaultActive && sel === 'all')}`}>
          <Library className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate">Toutes les entrées</span>
          <span className="text-sm text-fg-subtle tabular-nums">{allEntries(db).length}</span>
        </button>

        <div className="mt-4 mb-1 flex items-center justify-between pr-1 pl-3">
          <h2 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Groupes</h2>
          <IconButton label="Nouveau groupe" onClick={() => onGroupAction({ kind: 'create', parentId: groupId(root) })} className="lg:size-7">
            <FolderPlus className="size-4" aria-hidden />
          </IconButton>
        </div>
        {topGroups.length === 0 ? <p className="px-3 py-2 text-sm text-fg-muted">Aucun groupe pour l’instant.</p> : null}
        <ul>
          {topGroups.map((g) => (
            <GroupNode key={groupId(g)} db={db} group={g} depth={0} sel={vaultActive ? sel : ''} onSelect={onSelectGroup} onAction={onGroupAction} />
          ))}
        </ul>

        {bin ? (
          <button type="button" onClick={() => onSelectGroup('bin')} aria-current={vaultActive && sel === 'bin' ? 'page' : undefined} className={`${ROW} mt-2 ${rowState(vaultActive && sel === 'bin')}`}>
            <Trash2 className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">Corbeille</span>
            <span className="text-sm text-fg-subtle tabular-nums">{entriesIn(db, bin).length}</span>
          </button>
        ) : null}

        <h2 className="mt-6 mb-1 pl-3 text-xs font-semibold tracking-wide text-fg-muted uppercase">Outils</h2>
        {(
          [
            ['generator', 'Générateur', Wand2],
            ['audit', 'Audit des mots de passe', ScanSearch],
            ['settings', 'Réglages', SettingsIcon],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => onSelectTool(id)} aria-current={tool === id ? 'page' : undefined} className={`${ROW} ${rowState(tool === id)}`}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </nav>
      <p className="flex items-center gap-2 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] text-xs text-fg-subtle">
        <KeyRound className="size-3.5" aria-hidden />
        Keyhold · chiffré localement
      </p>
    </div>
  )
}

interface GroupNodeProps {
  db: Kdbx
  group: KdbxGroup
  depth: number
  sel: GroupSel
  onSelect: (sel: GroupSel) => void
  onAction: (action: GroupAction) => void
}

const PAD = ['pl-8', 'pl-12', 'pl-16', 'pl-20', 'pl-24'] as const
const CHEVRON_LEFT = ['left-1.5', 'left-5.5', 'left-9.5', 'left-13.5', 'left-17.5'] as const

function GroupNode({ db, group, depth, sel, onSelect, onAction }: GroupNodeProps) {
  const [open, setOpen] = useState(true)
  const id = groupId(group)
  const children = group.groups.filter((g) => g !== recycleBin(db))
  const active = sel === id
  const count = entriesIn(db, group).length
  const level = Math.min(depth, PAD.length - 1)
  return (
    <li>
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => onSelect(id)}
          aria-current={active ? 'page' : undefined}
          className={`${ROW} ${PAD[level]} pr-20 ${rowState(active)}`}
        >
          <Folder className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate">{groupDisplayName(group)}</span>
        </button>
        {children.length ? (
          <button
            type="button"
            aria-label={open ? `Replier ${groupDisplayName(group)}` : `Déplier ${groupDisplayName(group)}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`absolute ${CHEVRON_LEFT[level]} flex size-6 items-center justify-center rounded-sm text-fg-muted hover:bg-hover`}
          >
            {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
          </button>
        ) : null}
        <span className="pointer-events-none absolute right-11 text-sm text-fg-subtle tabular-nums lg:right-9">{count}</span>
        <Menu
          className="absolute right-0"
          label={`Actions du groupe ${groupDisplayName(group)}`}
          icon={<MoreHorizontal className="size-4" aria-hidden />}
          items={[
            { label: 'Nouveau sous-groupe', icon: <FolderPlus className="size-4" aria-hidden />, onSelect: () => onAction({ kind: 'create', parentId: id }) },
            { label: 'Renommer', icon: <Pencil className="size-4" aria-hidden />, onSelect: () => onAction({ kind: 'rename', id }) },
            { label: 'Supprimer', icon: <Trash2 className="size-4" aria-hidden />, danger: true, onSelect: () => onAction({ kind: 'delete', id }) },
          ]}
        />
      </div>
      {open && children.length ? (
        <ul>
          {children.map((c) => (
            <GroupNode key={groupId(c)} db={db} group={c} depth={depth + 1} sel={sel} onSelect={onSelect} onAction={onAction} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
