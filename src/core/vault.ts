import * as kdbxweb from 'kdbxweb'
import { installArgon2 } from './argon2'
import { VaultError } from './errors'

export type Kdbx = kdbxweb.Kdbx
export type KdbxEntry = kdbxweb.KdbxEntry
export type KdbxGroup = kdbxweb.KdbxGroup

const { ProtectedValue, Consts } = kdbxweb
const ValueType = kdbxweb.VarDictionary.ValueType

export const STANDARD_FIELDS = ['Title', 'UserName', 'Password', 'URL', 'Notes'] as const

export interface KdfSettings {
  memoryKiB: number
  iterations: number
  parallelism: number
}

/** Argon2id defaults for new vaults (≈ KeePassXC order of magnitude, tuned for browsers). */
export const DEFAULT_KDF: KdfSettings = { memoryKiB: 64 * 1024, iterations: 3, parallelism: 2 }

export interface CredentialsInput {
  password: string
  keyFile?: ArrayBuffer | Uint8Array | null
}

/**
 * Empty password + key file = key-file-only vault (no password component), as KeePassXC does.
 * Empty password without key file = "empty password" component (KeePass semantics).
 */
function makeCredentials({ password, keyFile }: CredentialsInput, emptyAsNull = true): kdbxweb.KdbxCredentials {
  const pw = password === '' && keyFile && emptyAsNull ? null : ProtectedValue.fromString(password)
  return new kdbxweb.KdbxCredentials(pw, keyFile ?? null)
}

function mapError(err: unknown): VaultError {
  if (err instanceof VaultError) return err
  if (err instanceof kdbxweb.KdbxError) {
    switch (err.code) {
      case Consts.ErrorCodes.InvalidKey:
        return new VaultError('wrong-credentials')
      case Consts.ErrorCodes.BadSignature:
      case Consts.ErrorCodes.InvalidVersion:
        return new VaultError('not-kdbx')
      case Consts.ErrorCodes.FileCorrupt:
        return new VaultError('corrupt')
      case Consts.ErrorCodes.Unsupported:
      case Consts.ErrorCodes.NotImplemented:
        return new VaultError('unsupported')
      default:
        return new VaultError('corrupt')
    }
  }
  if (err instanceof Error && /argon2|memory|maxmem|allocation|"m"/i.test(err.message)) return new VaultError('kdf-failed')
  if (err instanceof RangeError || err instanceof TypeError) return new VaultError('corrupt')
  return new VaultError('unknown')
}

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy.buffer
}

export function createVault(name: string, creds: CredentialsInput, kdf: KdfSettings = DEFAULT_KDF): Kdbx {
  installArgon2()
  const db = kdbxweb.Kdbx.create(makeCredentials(creds), name)
  db.setVersion(4)
  db.setKdf(Consts.KdfId.Argon2id)
  const params = db.header.kdfParameters
  if (!params) throw new VaultError('unknown')
  params.set('M', ValueType.UInt64, kdbxweb.Int64.from(kdf.memoryKiB * 1024))
  params.set('I', ValueType.UInt64, kdbxweb.Int64.from(kdf.iterations))
  params.set('P', ValueType.UInt32, kdf.parallelism)
  db.getDefaultGroup().name = name
  return db
}

export async function openVault(data: ArrayBuffer | Uint8Array, creds: CredentialsInput): Promise<Kdbx> {
  installArgon2()
  const bytes = toArrayBuffer(data)
  const attempt = async (emptyAsNull: boolean): Promise<Kdbx> => {
    const credentials = makeCredentials(creds, emptyAsNull)
    await credentials.ready
    return kdbxweb.Kdbx.load(bytes, credentials)
  }
  try {
    return await attempt(true)
  } catch (err) {
    const mapped = mapError(err)
    // Key file + empty password is ambiguous: retry with an explicit empty-password component.
    if (mapped.code === 'wrong-credentials' && creds.password === '' && creds.keyFile) {
      try {
        return await attempt(false)
      } catch (err2) {
        throw mapError(err2)
      }
    }
    throw mapped
  }
}

/** kdbxweb's save() is not re-entrant: every save of a given vault is serialised through this chain. */
const saveChains = new WeakMap<Kdbx, Promise<unknown>>()

/**
 * Serialises, encrypts and VERIFIES the vault: the produced bytes are decrypted again with the same
 * credentials before being returned, so a corrupt file can never be written over the user's data.
 */
export function saveVault(db: Kdbx): Promise<ArrayBuffer> {
  installArgon2()
  const run = async (): Promise<ArrayBuffer> => {
    let bytes: ArrayBuffer
    try {
      bytes = await db.save()
    } catch (err) {
      throw mapError(err)
    }
    try {
      await kdbxweb.Kdbx.load(bytes.slice(0), db.credentials)
    } catch {
      throw new VaultError('save-verify-failed')
    }
    return bytes
  }
  const prev = saveChains.get(db) ?? Promise.resolve()
  const next = prev.then(run, run)
  saveChains.set(db, next.catch(() => undefined))
  return next
}

/** Changes master password and/or key file. Takes effect on next save. */
export async function changeCredentials(db: Kdbx, creds: CredentialsInput): Promise<void> {
  await db.credentials.setPassword(creds.password === '' && creds.keyFile ? null : ProtectedValue.fromString(creds.password))
  await db.credentials.setKeyFile(creds.keyFile ?? null)
  db.meta.keyChanged = new Date()
}

/** Generates a KeePass XML key file (v2.0), compatible with KeePass/KeePassXC. */
export async function generateKeyFile(): Promise<Uint8Array> {
  return kdbxweb.KdbxCredentials.createRandomKeyFile(2)
}

export function describeKdf(db: Kdbx): string {
  const params = db.header.kdfParameters
  const uuid = params?.get('$UUID')
  if (!(uuid instanceof ArrayBuffer)) return db.versionMajor >= 4 ? 'Inconnu' : 'AES-KDF (KDBX 3)'
  const id = kdbxweb.ByteUtils.bytesToBase64(uuid)
  if (id === Consts.KdfId.Argon2id) return 'Argon2id'
  if (id === Consts.KdfId.Argon2d) return 'Argon2d'
  if (id === Consts.KdfId.Aes) return 'AES-KDF'
  return 'Inconnu'
}

// ---------- Read helpers ----------

export function fieldText(entry: KdbxEntry, key: string): string {
  const v = entry.fields.get(key)
  if (v === undefined) return ''
  return v instanceof ProtectedValue ? v.getText() : v
}

export function isProtectedField(entry: KdbxEntry, key: string): boolean {
  return entry.fields.get(key) instanceof ProtectedValue
}

export interface CustomField {
  key: string
  value: string
  protected: boolean
}

export function customFields(entry: KdbxEntry): CustomField[] {
  const out: CustomField[] = []
  for (const [key, value] of entry.fields) {
    if ((STANDARD_FIELDS as readonly string[]).includes(key)) continue
    out.push({
      key,
      value: value instanceof ProtectedValue ? value.getText() : value,
      protected: value instanceof ProtectedValue,
    })
  }
  return out
}

export function entryId(entry: KdbxEntry): string {
  return entry.uuid.id
}

export function groupId(group: KdbxGroup): string {
  return group.uuid.id
}

export function isExpired(entry: KdbxEntry, now = new Date()): boolean {
  return Boolean(entry.times.expires && entry.times.expiryTime && entry.times.expiryTime.getTime() <= now.getTime())
}

export function recycleBin(db: Kdbx): KdbxGroup | undefined {
  const id = db.meta.recycleBinUuid
  return id && db.meta.recycleBinEnabled ? db.getGroup(id) : undefined
}

export function isInRecycleBin(db: Kdbx, item: KdbxEntry | KdbxGroup): boolean {
  const bin = recycleBin(db)
  if (!bin) return false
  let g: KdbxGroup | undefined = item.parentGroup
  if (item === bin) return true
  while (g) {
    if (g === bin) return true
    g = g.parentGroup
  }
  return false
}

export function rootGroup(db: Kdbx): KdbxGroup {
  return db.getDefaultGroup()
}

/** All entries below a group (recursive). Excludes recycle bin unless the group is the bin itself. */
export function entriesIn(db: Kdbx, group: KdbxGroup, recursive = true): KdbxEntry[] {
  const bin = recycleBin(db)
  const out: KdbxEntry[] = []
  const walk = (g: KdbxGroup): void => {
    out.push(...g.entries)
    if (!recursive) return
    for (const child of g.groups) {
      if (child === bin && g !== bin && group !== bin) continue
      walk(child)
    }
  }
  walk(group)
  return out
}

export function allEntries(db: Kdbx): KdbxEntry[] {
  return entriesIn(db, rootGroup(db), true)
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Searches non-secret fields only (title, username, URL, notes, tags, non-protected custom fields). */
export function searchEntries(db: Kdbx, query: string): KdbxEntry[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return allEntries(db)
  return allEntries(db).filter((entry) => {
    const hay: string[] = [...entry.tags]
    for (const [key, value] of entry.fields) {
      if (value instanceof ProtectedValue || key === 'Password') continue
      hay.push(value)
    }
    const text = normalize(hay.join('\n'))
    return terms.every((t) => text.includes(t))
  })
}

// ---------- Mutations ----------

export interface EntryInput {
  title: string
  username: string
  password: string
  url: string
  notes: string
  tags: string[]
  expiry: Date | null
  customFields: CustomField[]
}

export function readEntry(entry: KdbxEntry): EntryInput {
  return {
    title: fieldText(entry, 'Title'),
    username: fieldText(entry, 'UserName'),
    password: fieldText(entry, 'Password'),
    url: fieldText(entry, 'URL'),
    notes: fieldText(entry, 'Notes'),
    tags: [...entry.tags],
    expiry: entry.times.expires && entry.times.expiryTime ? new Date(entry.times.expiryTime) : null,
    customFields: customFields(entry),
  }
}

function applyInput(db: Kdbx, entry: KdbxEntry, input: EntryInput): void {
  const mp = db.meta.memoryProtection
  const put = (key: string, value: string, protect: boolean | undefined): void => {
    entry.fields.set(key, protect ? ProtectedValue.fromString(value) : value)
  }
  put('Title', input.title, mp.title)
  put('UserName', input.username, mp.userName)
  put('Password', input.password, mp.password ?? true)
  put('URL', input.url, mp.url)
  put('Notes', input.notes, mp.notes)
  for (const key of [...entry.fields.keys()]) {
    if (!(STANDARD_FIELDS as readonly string[]).includes(key)) entry.fields.delete(key)
  }
  for (const f of input.customFields) {
    const key = f.key.trim()
    if (!key || (STANDARD_FIELDS as readonly string[]).includes(key)) continue
    put(key, f.value, f.protected)
  }
  entry.tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))]
  entry.times.expires = input.expiry !== null
  entry.times.expiryTime = input.expiry ?? undefined
}

export function createEntry(db: Kdbx, group: KdbxGroup, input: EntryInput): KdbxEntry {
  const entry = db.createEntry(group)
  applyInput(db, entry, input)
  entry.times.update()
  return entry
}

/** Updates an entry, pushing the previous state into its history (KeePass semantics). */
export function updateEntry(db: Kdbx, entry: KdbxEntry, input: EntryInput): void {
  entry.pushHistory()
  applyInput(db, entry, input)
  entry.times.update()
  enforceHistoryLimit(db, entry)
}

function enforceHistoryLimit(db: Kdbx, entry: KdbxEntry): void {
  const max = db.meta.historyMaxItems
  if (typeof max === 'number' && max >= 0 && entry.history.length > max) {
    entry.removeHistory(0, entry.history.length - max)
  }
}

/** Restores a history state: current state goes to history first. */
export function restoreHistory(db: Kdbx, entry: KdbxEntry, index: number): void {
  const snapshot = entry.history[index]
  if (!snapshot) return
  updateEntry(db, entry, readEntry(snapshot))
}

/** Moves to recycle bin, or deletes permanently if already there / bin disabled. */
export function deleteEntry(db: Kdbx, entry: KdbxEntry): void {
  db.remove(entry)
}

export function createGroup(db: Kdbx, parent: KdbxGroup, name: string): KdbxGroup {
  return db.createGroup(parent, name.trim() || 'Nouveau groupe')
}

export function renameGroup(group: KdbxGroup, name: string): void {
  group.name = name.trim() || group.name
  group.times.update()
}

export function deleteGroup(db: Kdbx, group: KdbxGroup): void {
  if (group === rootGroup(db)) return
  db.remove(group)
}

export function moveEntry(db: Kdbx, entry: KdbxEntry, target: KdbxGroup): void {
  db.move(entry, target)
}
