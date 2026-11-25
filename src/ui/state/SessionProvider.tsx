import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { startAutoLock } from '../../core/autolock'
import { clearClipboardNow } from '../../core/clipboard'
import { saveVaultFile } from '../../core/files'
import { clearHibpCache } from '../../core/hibp'
import { loadSettings, saveSettings, type Settings } from '../../core/settings'
import { forgetNonPendingVaults, forgetNormalCopy, forgetVault, loadRememberedVault, rememberVault, saveRecoveryCopy, type StoredVault } from '../../core/storage'
import { saveVault, type Kdbx } from '../../core/vault'
import { SessionContext, type SessionApi, type SessionState } from './session-context'
import { useToast } from './toast-context'

const EMPTY: SessionState = { db: null, fileName: '', handle: null, fileLastModified: null, dirty: false, rev: 0 }

const vaultIds = new WeakMap<Kdbx, number>()
let nextVaultId = 1
function vaultId(db: Kdbx): number {
  let id = vaultIds.get(db)
  if (id === undefined) {
    id = nextVaultId++
    vaultIds.set(db, id)
  }
  return id
}

function applyTheme(pref: Settings['theme']): void {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [state, setState] = useState<SessionState>(EMPTY)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [remembered, setRemembered] = useState<StoredVault | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [recovering, setRecovering] = useState(false)

  const stateRef = useRef(state)
  const inFlightRef = useRef<Promise<boolean> | null>(null)
  /** Storage key of the recovery copy this session was unlocked from (only it may be cleared by a save). */
  const recoveredKeyRef = useRef<string | null>(null)
  /** Identity token only (no strong reference to the decrypted vault after lock). */
  const lastPersistedRef = useRef<{ id: number; rev: number; lastModified: number | null } | null>(null)
  const settingsRef = useRef(settings)
  useEffect(() => {
    stateRef.current = state
    settingsRef.current = settings
  }, [state, settings])

  // Theme
  useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const refreshRemembered = useCallback((): void => {
    void loadRememberedVault().then(setRemembered)
  }, [])

  useEffect(() => {
    let alive = true
    void loadRememberedVault().then((v) => {
      if (alive) setRemembered(v)
    })
    return () => {
      alive = false
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>): void => {
    // Updated synchronously so in-flight storage writes see the new value (e.g. "remember" switched off).
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    saveSettings(next)
    setSettings(next)
  }, [])

  const lock = useCallback((): void => {
    setState(EMPTY)
    recoveredKeyRef.current = null
    clearHibpCache()
    void clearClipboardNow()
    refreshRemembered()
  }, [refreshRemembered])

  /**
   * Updates this device's encrypted copies after an open or a successful save.
   * A save of the session unlocked from a recovery copy removes THAT copy (and only that one).
   */
  const remember = useCallback(
    async (
      mode: 'open' | 'save',
      name: string,
      encrypted: ArrayBuffer,
      handle: FileSystemFileHandle | null,
      fileLastModified: number | null,
      recoveryKey: string | null = null,
    ): Promise<void> => {
      try {
        if (mode === 'save' && recoveryKey) {
          await forgetVault(recoveryKey)
          if (recoveredKeyRef.current === recoveryKey) recoveredKeyRef.current = null
        }
        if (settingsRef.current.rememberVault) {
          await rememberVault({ name, encrypted, handle, savedAt: Date.now(), fileLastModified })
          // The setting may have been switched off meanwhile: honour it.
          if (!settingsRef.current.rememberVault) await forgetNormalCopy(name)
        }
        setRemembered(await loadRememberedVault())
      } catch {
        // IndexedDB unavailable (private window…): the vault simply is not remembered.
      }
    },
    [],
  )

  const openDb = useCallback(
    (db: Kdbx, fileName: string, handle: FileSystemFileHandle | null, encrypted?: ArrayBuffer, recoveryKey: string | null = null, fileLastModified: number | null = null): void => {
      const pending = recoveryKey !== null
      setState({ db, fileName, handle, fileLastModified, dirty: pending, rev: pending ? 1 : 0 })
      recoveredKeyRef.current = recoveryKey
      if (pending) toast('Modifications non enregistrées récupérées — pensez à enregistrer')
      if (encrypted && !pending) void remember('open', fileName, encrypted, handle, fileLastModified)
    },
    [remember, toast],
  )

  /**
   * Auto-lock: the decrypted vault is dropped immediately. If it had unsaved changes, an ENCRYPTED
   * recovery copy (same KDBX, same credentials) is kept in IndexedDB so nothing is lost.
   */
  const autoLock = useCallback((): void => {
    const s = stateRef.current
    const recoveryKey = recoveredKeyRef.current
    lock()
    if (!s.db || !s.dirty) return
    const db = s.db
    const name = s.fileName || `${db.meta.name || 'coffre'}.kdbx`
    setRecovering(true)
    const run = async (): Promise<void> => {
      // A save may be in flight (Ctrl+S then tab switch): wait for it, then skip the recovery copy if
      // it persisted this revision; otherwise use the file's post-write mtime to avoid a false conflict.
      await inFlightRef.current
      const last = lastPersistedRef.current
      const sameVault = last !== null && last.id === vaultId(db)
      if (sameVault && last.rev >= s.rev) return
      const fileLastModified = sameVault ? last.lastModified : s.fileLastModified
      const encrypted = await saveVault(db)
      // Unique key: replaces only the copy this session came from, never another vault's.
      await saveRecoveryCopy({ name, encrypted, handle: s.handle, savedAt: Date.now(), fileLastModified }, recoveryKey)
    }
    void run()
      .then(refreshRemembered)
      .catch(() => toast('Verrouillé : les modifications non enregistrées n’ont pas pu être conservées', 'error'))
      .finally(() => setRecovering(false))
  }, [lock, refreshRemembered, toast])

  const persist = useCallback(
    async (db: Kdbx, handle: FileSystemFileHandle | null, fileName: string, forcePicker: boolean, startRev?: number): Promise<boolean> => {
      setSaving(true)
      const revAtStart = startRev ?? stateRef.current.rev
      // Captured synchronously: a lock during the (multi-second) save must not erase it.
      const openedLastModified = stateRef.current.db === db ? stateRef.current.fileLastModified : null
      const recoveryKey = stateRef.current.db === db ? recoveredKeyRef.current : null
      const previous = inFlightRef.current
      let done: (v: boolean) => void = () => undefined
      const mine = new Promise<boolean>((r) => {
        done = r
      })
      inFlightRef.current = mine
      let ok = false
      try {
        // Saves of the session run one after another, so each sees the file date written by the previous one.
        if (previous) await previous
        const bytes = await saveVault(db)
        const last = lastPersistedRef.current
        const expectedLastModified = last !== null && last.id === vaultId(db) ? last.lastModified : openedLastModified
        const res = await saveVaultFile(bytes, { handle, suggestedName: fileName, forcePicker, expectedLastModified })
        if (res.method === 'cancelled') return false
        if (res.method === 'conflict') {
          toast(
            res.reason === 'changed'
              ? 'Le fichier a été modifié ailleurs depuis son ouverture. Rien n’a été écrasé : utilisez « Enregistrer sous… ».'
              : 'Impossible de vérifier que le fichier n’a pas changé (accès refusé ?). Rien n’a été écrasé : utilisez « Enregistrer sous… ».',
            'error',
          )
          return false
        }
        const newLastModified = res.method === 'handle' ? res.lastModified : null
        const newHandle = res.method === 'handle' ? res.handle : handle
        const newName = res.method === 'handle' && res.handle.name ? res.handle.name : fileName
        setState((s) =>
          s.db === db ? { ...s, handle: newHandle, fileName: newName, fileLastModified: newLastModified, dirty: s.rev !== revAtStart } : s,
        )
        lastPersistedRef.current = { id: vaultId(db), rev: revAtStart, lastModified: newLastModified }
        await remember('save', newName, bytes, newHandle, newLastModified, recoveryKey)
        toast(res.method === 'download' ? 'Fichier téléchargé' : 'Enregistré')
        ok = true
        return true
      } catch (err) {
        toast(err instanceof Error ? err.message : "Échec de l'enregistrement", 'error')
        return false
      } finally {
        setSaving(false)
        done(ok)
        if (inFlightRef.current === mine) inFlightRef.current = null
      }
    },
    [remember, toast],
  )

  const save = useCallback(
    async (forcePicker = false): Promise<boolean> => {
      const s = stateRef.current
      if (!s.db) return false
      const name = s.fileName || `${s.db.meta.name || 'coffre'}.kdbx`
      return persist(s.db, s.handle, name, forcePicker)
    },
    [persist],
  )

  const adoptNewVault = useCallback(
    async (db: Kdbx, fileName: string, saveNow: boolean): Promise<void> => {
      setState({ db, fileName, handle: null, fileLastModified: null, dirty: true, rev: 1 })
      recoveredKeyRef.current = null
      if (saveNow) await persist(db, null, fileName, false, 1)
    },
    [persist],
  )

  const mutate = useCallback(<T,>(fn: (db: Kdbx) => T): T | undefined => {
    const db = stateRef.current.db
    if (!db) return undefined
    const result = fn(db)
    setState((s) => ({ ...s, dirty: true, rev: s.rev + 1 }))
    return result
  }, [])

  const forgetDevice = useCallback(async (key?: string, keepPending = false): Promise<void> => {
    try {
      if (keepPending) await forgetNonPendingVaults()
      else await forgetVault(key)
    } finally {
      setRemembered(await loadRememberedVault())
    }
  }, [])

  // Auto-lock while unlocked.
  const unlocked = state.db !== null
  useEffect(() => {
    if (!unlocked) return
    return startAutoLock({ timeoutMs: settings.lockAfterMinutes * 60_000, lockOnHidden: settings.lockOnHidden, onLock: autoLock })
  }, [unlocked, settings.lockAfterMinutes, settings.lockOnHidden, autoLock])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!state.dirty) return
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.dirty])

  const api = useMemo<SessionApi>(
    () => ({ ...state, settings, updateSettings, remembered, saving, recovering, openDb, adoptNewVault, mutate, save, lock, forgetDevice }),
    [state, settings, updateSettings, remembered, saving, recovering, openDb, adoptNewVault, mutate, save, lock, forgetDevice],
  )

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>
}
