import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowLeft, Plus, Wand2, X } from 'lucide-react'
import { createEntry, isInRecycleBin, moveEntry, readEntry, rootGroup, updateEntry, type EntryInput, type Kdbx, type KdbxEntry } from '../../core/vault'
import { Button, IconButton } from '../components/Button'
import { Checkbox, SelectField, TextArea, TextField } from '../components/Field'
import { GeneratorPanel } from '../components/GeneratorPanel'
import { PasswordFeedback } from '../components/PasswordFeedback'
import { PasswordInput } from '../components/PasswordInput'
import { useSession } from '../state/session-context'
import { usePasswordAnalysis } from '../state/usePasswordAnalysis'
import { flattenGroups, groupDisplayName } from './vault-utils'

interface CustomRow {
  uid: number
  key: string
  value: string
  protected: boolean
}

interface EntryFormProps {
  db: Kdbx
  /** null = new entry. */
  entry: KdbxEntry | null
  defaultGroupId: string
  onClose: (savedId: string | null) => void
}

function toDateInput(d: Date | null): string {
  if (!d) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fromDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0)
}

export function EntryForm({ db, entry, defaultGroupId, onClose }: EntryFormProps) {
  const { mutate } = useSession()
  const [initial] = useState<EntryInput>(() =>
    entry
      ? readEntry(entry)
      : { title: '', username: '', password: '', url: '', notes: '', tags: [], expiry: null, customFields: [] },
  )
  const [title, setTitle] = useState(initial.title)
  const [username, setUsername] = useState(initial.username)
  const [password, setPassword] = useState(initial.password)
  const [url, setUrl] = useState(initial.url)
  const [notes, setNotes] = useState(initial.notes)
  const [tags, setTags] = useState<string[]>(initial.tags)
  const [tagDraft, setTagDraft] = useState('')
  const [expires, setExpires] = useState(initial.expiry !== null)
  const [expiryDate, setExpiryDate] = useState(toDateInput(initial.expiry))
  const [custom, setCustom] = useState<CustomRow[]>(() => initial.customFields.map((f, i) => ({ uid: i, ...f })))
  const [nextUid, setNextUid] = useState(initial.customFields.length)
  const [groupId, setGroupId] = useState(entry?.parentGroup?.uuid.id ?? defaultGroupId)
  const [genOpen, setGenOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analysis = usePasswordAnalysis(password, [title, username])
  const rootId = rootGroup(db).uuid.id
  const groups = flattenGroups(db)
  const inBin = entry ? isInRecycleBin(db, entry) : false
  const groupOptions = [
    { value: rootId, label: groupDisplayName(rootGroup(db)) },
    ...groups.map(({ group, depth }) => ({ value: group.uuid.id, label: `${'  '.repeat(depth + 1)}${groupDisplayName(group)}` })),
  ]

  const addTag = (raw: string): void => {
    const t = raw.trim().replace(/,+$/, '').trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagDraft('')
  }

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagDraft)
    } else if (e.key === 'Backspace' && !tagDraft && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }

  const updateCustom = (uid: number, patch: Partial<CustomRow>): void =>
    setCustom((rows) => rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)))

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Le titre est obligatoire.')
      return
    }
    const finalTags = tagDraft.trim() && !tags.includes(tagDraft.trim()) ? [...tags, tagDraft.trim()] : tags
    const input: EntryInput = {
      title: title.trim(),
      username,
      password,
      url: url.trim(),
      notes,
      tags: finalTags,
      expiry: expires ? fromDateInput(expiryDate) : null,
      customFields: custom.filter((c) => c.key.trim()).map(({ key, value, protected: p }) => ({ key, value, protected: p })),
    }
    const savedId = mutate((d) => {
      if (entry) {
        updateEntry(d, entry, input)
        if (!inBin && entry.parentGroup?.uuid.id !== groupId) {
          const target = d.getGroup(groupId)
          if (target) moveEntry(d, entry, target)
        }
        return entry.uuid.id
      }
      const target = d.getGroup(groupId) ?? rootGroup(d)
      return createEntry(d, target, input).uuid.id
    })
    onClose(savedId ?? null)
  }

  return (
    <form onSubmit={submit} className="flex h-full min-h-0 flex-col bg-bg" noValidate>
      <header className="flex items-center gap-2 border-b border-line bg-surface p-3 pt-[max(12px,env(safe-area-inset-top))] lg:px-6 lg:py-4">
        <IconButton label="Annuler" onClick={() => onClose(null)} className="-ml-1 lg:hidden">
          <ArrowLeft className="size-5" aria-hidden />
        </IconButton>
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold">{entry ? 'Modifier l’entrée' : 'Nouvelle entrée'}</h2>
        <span className="hidden lg:inline-flex">
          <Button onClick={() => onClose(null)}>Annuler</Button>
        </span>
        <Button type="submit" variant="primary">
          Enregistrer
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(24px,env(safe-area-inset-bottom))] lg:px-6 lg:py-6">
        <div className="flex max-w-2xl flex-col gap-5">
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <TextField label="Titre" value={title} onChange={setTitle} autoComplete="off" autoFocus required />
          <TextField label="Nom d’utilisateur" value={username} onChange={setUsername} autoComplete="off" autoCapitalize="off" spellCheck={false} />

          <div className="flex flex-col gap-2">
            <PasswordInput
              label="Mot de passe"
              value={password}
              onChange={setPassword}
              onBlur={analysis.checkBreach}
              autoComplete="off"
              actions={
                <IconButton label="Générateur de mot de passe" variant="secondary" pressed={genOpen} onClick={() => setGenOpen((v) => !v)} className="lg:size-10">
                  <Wand2 className="size-4" aria-hidden />
                </IconButton>
              }
            />
            {genOpen ? (
              <div className="rounded-lg border border-line bg-surface p-4 shadow-md">
                <GeneratorPanel
                  onUse={(v) => {
                    setPassword(v)
                    // Complete value inserted: check it right away (never a partial password).
                    analysis.checkBreach(v)
                    setGenOpen(false)
                  }}
                />
              </div>
            ) : null}
            <PasswordFeedback analysis={analysis} />
          </div>

          <TextField label="Site web" value={url} onChange={setUrl} placeholder="https://example.com" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} />
          <TextArea label="Notes" value={notes} onChange={setNotes} autoComplete="off" />

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">Champs personnalisés</legend>
            {custom.map((row) => (
              <div key={row.uid} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <TextField label="Nom du champ" value={row.key} onChange={(v) => updateCustom(row.uid, { key: v })} autoComplete="off" />
                  <TextField
                    label="Valeur"
                    value={row.value}
                    onChange={(v) => updateCustom(row.uid, { value: v })}
                    type={row.protected ? 'password' : 'text'}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Checkbox label="Champ protégé (masqué)" checked={row.protected} onChange={(v) => updateCustom(row.uid, { protected: v })} />
                  <Button variant="ghost" onClick={() => setCustom((rows) => rows.filter((r) => r.uid !== row.uid))} icon={<X className="size-4" aria-hidden />}>
                    Retirer
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button
                onClick={() => {
                  setCustom([...custom, { uid: nextUid, key: '', value: '', protected: false }])
                  setNextUid(nextUid + 1)
                }}
                icon={<Plus className="size-4" aria-hidden />}
              >
                Ajouter un champ
              </Button>
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <TextField
              label="Étiquettes"
              value={tagDraft}
              onChange={setTagDraft}
              onKeyDown={onTagKey}
              onBlur={() => tagDraft.trim() && addTag(tagDraft)}
              hint="Entrée ou virgule pour ajouter une étiquette."
              autoComplete="off"
            />
            {tags.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Étiquettes de l’entrée">
                {tags.map((t) => (
                  <li key={t} className="inline-flex items-center gap-1 rounded-sm bg-sunken py-0.5 pr-0.5 pl-2 text-sm text-fg">
                    {t}
                    <button
                      type="button"
                      aria-label={`Retirer l’étiquette ${t}`}
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="inline-flex size-6 items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <Checkbox label="Cette entrée expire" checked={expires} onChange={setExpires} />
            {expires ? <TextField label="Date d’expiration" type="date" value={expiryDate} onChange={setExpiryDate} /> : null}
          </div>

          {!inBin ? <SelectField label="Groupe" value={groupId} onChange={setGroupId} options={groupOptions} /> : null}
        </div>
      </div>
    </form>
  )
}
