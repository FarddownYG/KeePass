import {
  allEntries,
  entriesIn,
  fieldText,
  isInRecycleBin,
  recycleBin,
  rootGroup,
  searchEntries,
  type Kdbx,
  type KdbxEntry,
  type KdbxGroup,
} from '../../core/vault'

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

export function sortEntries(entries: KdbxEntry[]): KdbxEntry[] {
  return [...entries].sort((a, b) => collator.compare(fieldText(a, 'Title'), fieldText(b, 'Title')))
}

export function findEntry(db: Kdbx, id: string): KdbxEntry | undefined {
  for (const e of rootGroup(db).allEntries()) if (e.uuid.id === id) return e
  return undefined
}

export function findGroup(db: Kdbx, id: string): KdbxGroup | undefined {
  return db.getGroup(id)
}

export function selectionEntries(db: Kdbx, sel: string, query: string): KdbxEntry[] {
  if (query.trim()) return sortEntries(searchEntries(db, query))
  if (sel === 'all') return sortEntries(allEntries(db))
  if (sel === 'bin') {
    const bin = recycleBin(db)
    return bin ? sortEntries(entriesIn(db, bin)) : []
  }
  const group = findGroup(db, sel)
  return group ? sortEntries(entriesIn(db, group)) : []
}

export function groupDisplayName(group: KdbxGroup): string {
  return group.name || 'Sans nom'
}

/** Groups below the root, depth-first, without the recycle bin. */
export function flattenGroups(db: Kdbx): { group: KdbxGroup; depth: number }[] {
  const out: { group: KdbxGroup; depth: number }[] = []
  const bin = recycleBin(db)
  const walk = (g: KdbxGroup, depth: number): void => {
    for (const child of g.groups) {
      if (child === bin) continue
      out.push({ group: child, depth })
      walk(child, depth + 1)
    }
  }
  walk(rootGroup(db), 0)
  return out
}

export function entryInBin(db: Kdbx, entry: KdbxEntry): boolean {
  return isInRecycleBin(db, entry)
}

export function groupPath(entry: KdbxEntry): string {
  const names: string[] = []
  let g = entry.parentGroup
  while (g && g.parentGroup) {
    names.unshift(groupDisplayName(g))
    g = g.parentGroup
  }
  return names.join(' / ')
}

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
const DATE_ONLY = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })

export function formatDateTime(d: Date | undefined): string {
  return d ? DATE_TIME.format(d) : '—'
}

export function formatDate(d: Date | undefined): string {
  return d ? DATE_ONLY.format(d) : '—'
}

/** Returns a clickable URL only for http(s); everything else stays plain text. */
export function safeHref(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  try {
    const u = new URL(candidate)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}
