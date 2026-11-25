import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Copy as CopyIcon, ScanSearch, ShieldAlert, Square } from 'lucide-react'
import { auditPasswords, type AuditItem } from '../../core/hibp'
import { estimateStrength } from '../../core/strength'
import { allEntries, fieldText, isExpired, type Kdbx } from '../../core/vault'
import { Button } from '../components/Button'
import { ToolHeader } from '../components/ToolHeader'
import { findEntry } from './vault-utils'

export interface AuditResult {
  ranAt: number
  weak: { id: string; label: string }[]
  reused: string[][]
  expired: string[]
  pwned: { id: string; count: number }[]
  /** 'done' | 'cancelled' | 'unavailable' | 'skipped' (no password to check) */
  breachStatus: 'done' | 'cancelled' | 'unavailable' | 'skipped'
  checked: number
}

interface AuditProps {
  db: Kdbx
  rev: number
  result: AuditResult | null
  onResult: (r: AuditResult | null) => void
  onOpenEntry: (id: string) => void
  onBack: () => void
}

export function Audit({ db, result, onResult, onOpenEntry, onBack }: AuditProps) {
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<'local' | 'breach'>('local')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => () => ctrl.current?.abort(), [])

  const run = async (): Promise<void> => {
    const controller = new AbortController()
    ctrl.current = controller
    setRunning(true)
    setPhase('local')
    setProgress({ done: 0, total: 0 })
    onResult(null)

    const entries = allEntries(db)
    const items: AuditItem[] = []
    const byPassword = new Map<string, string[]>()
    const weak: AuditResult['weak'] = []

    for (const entry of entries) {
      const password = fieldText(entry, 'Password')
      if (!password) continue
      const id = entry.uuid.id
      items.push({ id, password })
      byPassword.set(password, [...(byPassword.get(password) ?? []), id])
      const s = await estimateStrength(password, [fieldText(entry, 'Title'), fieldText(entry, 'UserName')])
      if (s.score <= 2) weak.push({ id, label: s.label })
      if (controller.signal.aborted) break
    }
    const reused = [...byPassword.values()].filter((ids) => ids.length > 1)
    const expired = entries.filter((e) => isExpired(e)).map((e) => e.uuid.id)
    byPassword.clear()

    const base: AuditResult = { ranAt: Date.now(), weak, reused, expired, pwned: [], breachStatus: 'skipped', checked: items.length }
    onResult(base)

    if (items.length > 0 && !controller.signal.aborted) {
      setPhase('breach')
      setProgress({ done: 0, total: items.length })
      try {
        const counts = await auditPasswords(items, {
          signal: controller.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        })
        const pwned = [...counts].filter(([, n]) => n > 0).map(([id, count]) => ({ id, count }))
        onResult({ ...base, pwned, breachStatus: controller.signal.aborted ? 'cancelled' : 'done' })
      } catch {
        onResult({ ...base, breachStatus: controller.signal.aborted ? 'cancelled' : 'unavailable' })
      }
    } else if (controller.signal.aborted) {
      onResult({ ...base, breachStatus: 'cancelled' })
    }
    items.length = 0
    ctrl.current = null
    setRunning(false)
  }

  const nothing =
    result !== null && result.pwned.length === 0 && result.weak.length === 0 && result.reused.length === 0 && result.expired.length === 0
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <ToolHeader title="Audit des mots de passe" subtitle="Compromis, faibles, réutilisés et expirés." onBack={onBack}>
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-fg-muted">
            La robustesse et la réutilisation sont analysées localement. Seuls les 5 premiers caractères de l’empreinte SHA-1 sont envoyés à Have I Been Pwned.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {running ? (
              <Button onClick={() => ctrl.current?.abort()} icon={<Square className="size-4" aria-hidden />}>
                Annuler
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void run()} icon={<ScanSearch className="size-4" aria-hidden />}>
                Lancer l’audit
              </Button>
            )}
            {result && !running ? <p className="text-sm text-fg-muted">{result.checked} mot{result.checked > 1 ? 's' : ''} de passe analysé{result.checked > 1 ? 's' : ''}</p> : null}
          </div>
          {running ? (
            <div className="mt-4" aria-live="polite">
              <progress
                aria-label="Progression de l’audit"
                max={100}
                value={phase === 'breach' ? pct : undefined}
                className="h-1.5 w-full appearance-none overflow-hidden rounded-sm [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-line-strong [&::-webkit-progress-value]:bg-accent"
              />
              <p className="mt-2 text-sm text-fg-muted">
                {phase === 'local' ? 'Analyse locale…' : `Recherche dans les fuites : ${progress.done} / ${progress.total}`}
              </p>
            </div>
          ) : null}
        </div>

        {result && !running ? (
          <>
            {result.breachStatus === 'unavailable' ? (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-sm">La recherche de fuites est indisponible (hors ligne ?). Les contrôles locaux restent valables.</p>
            ) : null}
            {result.breachStatus === 'cancelled' ? <p className="rounded-md bg-warning-soft px-3 py-2 text-sm">Audit annulé : les résultats sont partiels.</p> : null}
            {nothing && result.breachStatus === 'done' ? (
              <p className="flex items-center gap-2 rounded-md bg-accent-soft px-3 py-3 text-base text-accent-text">
                <CheckCircle2 className="size-5 shrink-0" aria-hidden /> Aucun problème détecté.
              </p>
            ) : null}
            <Section
              icon={<ShieldAlert className="size-4 text-danger" aria-hidden />}
              title="Mots de passe compromis"
              rows={result.pwned.map((p) => ({ ids: [p.id], note: `Trouvé ${p.count.toLocaleString('fr-FR')} fois dans des fuites` }))}
              db={db}
              onOpen={onOpenEntry}
            />
            <Section
              icon={<AlertTriangle className="size-4 text-warning" aria-hidden />}
              title="Mots de passe faibles"
              rows={result.weak.map((w) => ({ ids: [w.id], note: w.label }))}
              db={db}
              onOpen={onOpenEntry}
            />
            <Section
              icon={<CopyIcon className="size-4 text-warning" aria-hidden />}
              title="Mots de passe réutilisés"
              rows={result.reused.map((ids) => ({ ids, note: `Même mot de passe dans ${ids.length} entrées` }))}
              db={db}
              onOpen={onOpenEntry}
            />
            <Section
              icon={<Clock className="size-4 text-danger" aria-hidden />}
              title="Entrées expirées"
              rows={result.expired.map((id) => ({ ids: [id], note: 'Expirée' }))}
              db={db}
              onOpen={onOpenEntry}
            />
          </>
        ) : null}
      </div>
    </ToolHeader>
  )
}

interface SectionProps {
  icon: ReactNode
  title: string
  rows: { ids: string[]; note: string }[]
  db: Kdbx
  onOpen: (id: string) => void
}

function Section({ icon, title, rows, db, onOpen }: SectionProps) {
  if (rows.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
        {icon}
        {title}
        <span className="text-sm font-normal text-fg-muted">{rows.length}</span>
      </h2>
      <ul className="rounded-lg border border-line bg-surface">
        {rows.map((row) => (
          <li key={row.ids.join('-')} className="border-b border-line last:border-b-0">
            <p className="px-4 pt-2 text-sm text-fg-muted">{row.note}</p>
            <div className="flex flex-col pb-1">
              {row.ids.map((id) => {
                const entry = findEntry(db, id)
                if (!entry) return null
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpen(id)}
                    className="flex min-h-11 w-full flex-col justify-center px-4 py-1 text-left transition-colors duration-150 hover:bg-hover"
                  >
                    <span className="truncate text-base font-semibold">{fieldText(entry, 'Title') || 'Sans titre'}</span>
                    <span className="truncate text-sm text-fg-muted">{fieldText(entry, 'UserName') || 'Pas d’identifiant'}</span>
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
