import { createContext, useContext } from 'react'
import type { Kdbx } from '../../core/vault'
import type { Settings } from '../../core/settings'
import type { StoredVault } from '../../core/storage'

export interface SessionState {
  db: Kdbx | null
  fileName: string
  handle: FileSystemFileHandle | null
  /** lastModified of the file on disk when last read/written (conflict detection). */
  fileLastModified: number | null
  dirty: boolean
  /** Bumped after every mutation: kdbxweb objects are mutable, React needs a nudge. */
  rev: number
}

export interface SessionApi extends SessionState {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  /** undefined = still loading, null = nothing remembered. */
  remembered: StoredVault | null | undefined
  saving: boolean
  /** An encrypted auto-lock recovery copy is being written: unlocking must wait. */
  recovering: boolean
  /** Opens an already-decrypted vault (after unlock). */
  openDb: (db: Kdbx, fileName: string, handle: FileSystemFileHandle | null, encrypted?: ArrayBuffer, pending?: boolean, fileLastModified?: number | null) => void
  /** Registers a freshly created vault; optionally writes it to disk right away. */
  adoptNewVault: (db: Kdbx, fileName: string, saveNow: boolean) => Promise<void>
  /** Runs a mutation on the vault, then flags it dirty and re-renders. */
  mutate: <T>(fn: (db: Kdbx) => T) => T | undefined
  /** Resolves true when the file was written (or downloaded). */
  save: (forcePicker?: boolean) => Promise<boolean>
  lock: () => void
  forgetDevice: () => Promise<void>
}

export const SessionContext = createContext<SessionApi | null>(null)

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('SessionProvider manquant')
  return ctx
}

/** The unlocked vault. Only call below the unlock gate. */
export function useDb(): Kdbx {
  const { db } = useSession()
  if (!db) throw new Error('Coffre verrouillé')
  return db
}
