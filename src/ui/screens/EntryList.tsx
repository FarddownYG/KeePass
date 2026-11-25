import { Lock, Menu as MenuIcon, Plus, Save, Search, SearchX, Tag, Trash2, Vault, X } from 'lucide-react'
import { fieldText, isExpired, type KdbxEntry } from '../../core/vault'
import { Badge } from '../components/Badge'
import { Button, IconButton } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { controlClass } from '../components/Field'

interface EntryListProps {
  title: string
  entries: KdbxEntry[]
  totalInVault: number
  query: string
  onQuery: (q: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  canAdd: boolean
  isBin: boolean
  dirty: boolean
  onSave: () => void
  onLock: () => void
  onOpenMenu: () => void
}

export function EntryList(props: EntryListProps) {
  const { title, entries, totalInVault, query, onQuery, selectedId, onSelect, onNew, canAdd, isBin, dirty, onSave, onLock, onOpenMenu } = props
  const searching = query.trim().length > 0

  let empty = null
  if (entries.length === 0) {
    if (searching) {
      empty = (
        <EmptyState icon={<SearchX className="size-6" aria-hidden />} title="Aucun résultat">
          Aucune entrée ne correspond à « {query.trim()} ». La recherche porte sur les titres, identifiants, sites, notes et étiquettes.
        </EmptyState>
      )
    } else if (isBin) {
      empty = (
        <EmptyState icon={<Trash2 className="size-6" aria-hidden />} title="La corbeille est vide">
          Les entrées supprimées apparaissent ici avant d’être effacées définitivement.
        </EmptyState>
      )
    } else if (totalInVault === 0) {
      empty = (
        <EmptyState
          icon={<Vault className="size-6" aria-hidden />}
          title="Votre coffre est vide"
          action={
            <Button variant="primary" onClick={onNew} icon={<Plus className="size-4" aria-hidden />}>
              Nouvelle entrée
            </Button>
          }
        >
          Ajoutez votre première entrée : identifiant, mot de passe, site web.
        </EmptyState>
      )
    } else {
      empty = (
        <EmptyState
          icon={<Vault className="size-6" aria-hidden />}
          title="Aucune entrée ici"
          action={
            canAdd ? (
              <Button onClick={onNew} icon={<Plus className="size-4" aria-hidden />}>
                Nouvelle entrée
              </Button>
            ) : undefined
          }
        >
          Ce groupe ne contient pas encore d’entrée.
        </EmptyState>
      )
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex flex-col gap-2 border-b border-line p-3 pt-[max(12px,env(safe-area-inset-top))] lg:p-4">
        <div className="flex items-center gap-1">
          <IconButton label="Ouvrir le menu" onClick={onOpenMenu} className="-ml-1 lg:hidden">
            <MenuIcon className="size-5" aria-hidden />
          </IconButton>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
            {searching ? 'Résultats' : title}
            <span className="ml-2 text-sm font-normal text-fg-muted tabular-nums">{entries.length}</span>
          </h1>
          {dirty ? (
            <IconButton label="Enregistrer" onClick={onSave} className="lg:hidden">
              <Save className="size-5 text-accent-text" aria-hidden />
            </IconButton>
          ) : null}
          <IconButton label="Verrouiller" onClick={onLock} className="lg:hidden">
            <Lock className="size-5" aria-hidden />
          </IconButton>
          {canAdd ? (
            <IconButton label="Nouvelle entrée" variant="secondary" onClick={onNew}>
              <Plus className="size-5 lg:size-4" aria-hidden />
            </IconButton>
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            type="search"
            aria-label="Rechercher dans le coffre"
            placeholder="Rechercher dans le coffre"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            className={`${controlClass} h-11 pr-10 pl-9 lg:h-10 [&::-webkit-search-cancel-button]:hidden`}
          />
          {query ? (
            <IconButton label="Effacer la recherche" onClick={() => onQuery('')} className="absolute top-0 right-0">
              <X className="size-4" aria-hidden />
            </IconButton>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {empty}
        <ul>
          {entries.map((entry) => {
            const id = entry.uuid.id
            const active = id === selectedId
            const expired = isExpired(entry)
            const user = fieldText(entry, 'UserName')
            return (
              <li key={id} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-current={active ? 'true' : undefined}
                  className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 ${active ? 'bg-selected' : 'hover:bg-hover'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-fg">{fieldText(entry, 'Title') || 'Sans titre'}</span>
                    <span className="block truncate text-sm text-fg-muted">{user || 'Pas d’identifiant'}</span>
                  </span>
                  {expired ? <Badge tone="danger">Expirée</Badge> : null}
                  {entry.tags.length > 0 ? <Tag className="size-3.5 shrink-0 text-fg-subtle" aria-label={`Étiquettes : ${entry.tags.join(', ')}`} /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
