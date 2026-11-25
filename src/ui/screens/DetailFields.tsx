import { useState, type ReactNode } from 'react'
import { Copy, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { fieldText, isExpired, isProtectedField, STANDARD_FIELDS, type KdbxEntry } from '../../core/vault'
import { Badge } from '../components/Badge'
import { IconButton } from '../components/Button'
import { useCopy } from '../state/useCopy'
import { formatDate, formatDateTime, safeHref } from './vault-utils'

const MASK = '••••••••••••'

function Row({ label, children, actions }: { label: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-fg-muted">{label}</dt>
        <dd className="mt-0.5 text-base break-words text-fg">{children}</dd>
      </div>
      {actions ? <div className="-my-1 flex shrink-0 items-center">{actions}</div> : null}
    </div>
  )
}

function CopyButton({ label, getText, secret }: { label: string; getText: () => string; secret: boolean }) {
  const copy = useCopy()
  return (
    <IconButton label={`Copier : ${label}`} onClick={() => copy(getText, { secret, label })}>
      <Copy className="size-4" aria-hidden />
    </IconButton>
  )
}

function SecretRow({ label, getValue }: { label: string; getValue: () => string }) {
  const [shown, setShown] = useState(false)
  return (
    <Row
      label={label}
      actions={
        <>
          <IconButton label={shown ? `Masquer : ${label}` : `Afficher : ${label}`} pressed={shown} onClick={() => setShown((v) => !v)}>
            {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </IconButton>
          <CopyButton label={label} getText={getValue} secret />
        </>
      }
    >
      {shown ? <span className="font-mono break-all">{getValue()}</span> : <span className="tracking-widest text-fg-muted">{MASK}</span>}
    </Row>
  )
}

export function DetailFields({ entry, showDates = true }: { entry: KdbxEntry; showDates?: boolean }) {
  const username = fieldText(entry, 'UserName')
  const url = fieldText(entry, 'URL')
  const notes = fieldText(entry, 'Notes')
  const href = safeHref(url)
  const hasPassword = entry.fields.has('Password') && fieldText(entry, 'Password') !== ''
  const custom = [...entry.fields.keys()].filter((k) => !(STANDARD_FIELDS as readonly string[]).includes(k))
  const expires = entry.times.expires && entry.times.expiryTime ? entry.times.expiryTime : undefined

  return (
    <div className="flex flex-col gap-4">
      <dl className="rounded-lg border border-line bg-surface">
        <Row label="Nom d’utilisateur" actions={username ? <CopyButton label="Nom d’utilisateur" getText={() => username} secret={false} /> : null}>
          {username || <span className="text-fg-subtle">—</span>}
        </Row>
        {hasPassword ? <SecretRow label="Mot de passe" getValue={() => fieldText(entry, 'Password')} /> : (
          <Row label="Mot de passe"><span className="text-fg-subtle">—</span></Row>
        )}
        {url ? (
          <Row
            label="Site web"
            actions={
              href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ouvrir le site dans un nouvel onglet"
                  title="Ouvrir le site dans un nouvel onglet"
                  className="inline-flex size-11 items-center justify-center rounded-md text-fg-muted transition-colors duration-150 hover:bg-hover hover:text-fg lg:size-9"
                >
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              ) : null
            }
          >
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-text underline underline-offset-2">
                {url}
              </a>
            ) : (
              url
            )}
          </Row>
        ) : null}
        {custom.map((key) =>
          isProtectedField(entry, key) ? (
            <SecretRow key={key} label={key} getValue={() => fieldText(entry, key)} />
          ) : (
            <Row key={key} label={key} actions={<CopyButton label={key} getText={() => fieldText(entry, key)} secret={false} />}>
              {fieldText(entry, key) || <span className="text-fg-subtle">—</span>}
            </Row>
          ),
        )}
        {notes ? (
          <Row label="Notes">
            <span className="whitespace-pre-wrap">{notes}</span>
          </Row>
        ) : null}
        {entry.tags.length > 0 ? (
          <Row label="Étiquettes">
            <span className="flex flex-wrap gap-1.5">
              {entry.tags.map((t) => (
                <span key={t} className="rounded-sm bg-sunken px-2 py-0.5 text-sm text-fg-muted">
                  {t}
                </span>
              ))}
            </span>
          </Row>
        ) : null}
        {expires ? (
          <Row label="Expiration">
            <span className="flex items-center gap-2">
              {formatDate(expires)}
              {isExpired(entry) ? <Badge tone="danger">Expirée</Badge> : null}
            </span>
          </Row>
        ) : null}
      </dl>
      {showDates ? (
        <p className="px-1 text-sm text-fg-muted">
          Créée le {formatDateTime(entry.times.creationTime)} · Modifiée le {formatDateTime(entry.times.lastModTime)}
        </p>
      ) : null}
    </div>
  )
}
