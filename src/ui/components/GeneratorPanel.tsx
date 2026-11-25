import { useEffect, useMemo, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  generatePassphrase,
  generatePassword,
  passphraseEntropyBits,
  passwordEntropyBits,
  type PassphraseOptions,
  type PasswordOptions,
} from '../../core/generator'
import { useCopy } from '../state/useCopy'
import { usePasswordAnalysis } from '../state/usePasswordAnalysis'
import { Button } from './Button'
import { Checkbox, TextField } from './Field'
import { Segmented } from './Segmented'
import { StrengthMeter } from './StrengthMeter'

type Mode = 'password' | 'passphrase'

interface GeneratorPanelProps {
  /** When provided, an "Utiliser" button hands the result back (embedded in the entry form). */
  onUse?: (value: string) => void
}

export function GeneratorPanel({ onUse }: GeneratorPanelProps) {
  const [mode, setMode] = useState<Mode>('password')
  const [pw, setPw] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS)
  const [pp, setPp] = useState<PassphraseOptions>(DEFAULT_PASSPHRASE_OPTIONS)
  const [ppOutput, setPpOutput] = useState('')
  const copy = useCopy()
  const pwOutput = useMemo(() => {
    try {
      return generatePassword(pw)
    } catch {
      return ''
    }
  }, [pw])
  const output = mode === 'password' ? pwOutput : ppOutput
  const analysis = usePasswordAnalysis(output, [], false)

  useEffect(() => {
    if (mode !== 'passphrase') return
    let cancelled = false
    generatePassphrase(pp)
      .then((v) => {
        if (!cancelled) setPpOutput(v)
      })
      .catch(() => {
        if (!cancelled) setPpOutput('')
      })
    return () => {
      cancelled = true
    }
  }, [mode, pp])

  // New option objects trigger a fresh draw.
  const regenerate = (): void => {
    if (mode === 'password') setPw({ ...pw })
    else setPp({ ...pp })
  }
  const setPwKey = (key: 'lower' | 'upper' | 'digits' | 'symbols', value: boolean): void => {
    const next = { ...pw, [key]: value }
    if (!next.lower && !next.upper && !next.digits && !next.symbols) return
    setPw(next)
  }
  const bits = mode === 'password' ? passwordEntropyBits(pw) : passphraseEntropyBits(pp)

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Type de secret"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'password', label: 'Mot de passe' },
          { value: 'passphrase', label: 'Phrase de passe' },
        ]}
      />

      <div className="rounded-lg border border-line bg-sunken p-4">
        <p
          className="min-h-14 font-mono text-lg leading-7 font-medium break-all text-fg select-all lg:text-xl lg:leading-8"
          aria-label="Secret généré"
          data-testid="generator-output"
        >
          {output}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={regenerate} icon={<RefreshCw className="size-4" aria-hidden />}>
            Régénérer
          </Button>
          <Button onClick={() => copy(() => output)} icon={<Copy className="size-4" aria-hidden />} disabled={!output}>
            Copier
          </Button>
          {onUse ? (
            <Button variant="primary" onClick={() => onUse(output)} disabled={!output}>
              Utiliser
            </Button>
          ) : null}
        </div>
      </div>

      <StrengthMeter strength={analysis.strength} bits={bits} />

      {mode === 'password' ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Options du mot de passe</legend>
          <div className="flex items-end gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="gen-length" className="text-sm font-medium">
                Longueur
              </label>
              <input
                id="gen-length"
                type="range"
                min={8}
                max={64}
                value={pw.length}
                onChange={(e) => setPw({ ...pw, length: Number(e.target.value) })}
                className="h-11 w-full accent-accent lg:h-6"
              />
            </div>
            <div className="w-20">
              <TextField
                label="Longueur (valeur)"
                hideLabel
                type="number"
                inputMode="numeric"
                min={8}
                max={64}
                value={String(pw.length)}
                onChange={(v) => setPw({ ...pw, length: Math.min(64, Math.max(8, Number(v) || 8)) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <Checkbox label="Minuscules (a-z)" checked={pw.lower} onChange={(v) => setPwKey('lower', v)} />
            <Checkbox label="Majuscules (A-Z)" checked={pw.upper} onChange={(v) => setPwKey('upper', v)} />
            <Checkbox label="Chiffres (0-9)" checked={pw.digits} onChange={(v) => setPwKey('digits', v)} />
            <Checkbox label="Symboles (!@#…)" checked={pw.symbols} onChange={(v) => setPwKey('symbols', v)} />
          </div>
          <Checkbox
            label="Exclure les caractères ambigus"
            hint="Évite I, l, 1, O, 0, o…"
            checked={pw.excludeAmbiguous}
            onChange={(v) => setPw({ ...pw, excludeAmbiguous: v })}
          />
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Options de la phrase de passe</legend>
          <div className="flex items-end gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="gen-words" className="text-sm font-medium">
                Nombre de mots
              </label>
              <input
                id="gen-words"
                type="range"
                min={3}
                max={10}
                value={pp.words}
                onChange={(e) => setPp({ ...pp, words: Number(e.target.value) })}
                className="h-11 w-full accent-accent lg:h-6"
              />
            </div>
            <p className="w-20 pb-3 text-base font-medium text-fg tabular-nums lg:pb-2">{pp.words} mots</p>
          </div>
          <div className="w-32">
            <TextField
              label="Séparateur"
              value={pp.separator}
              maxLength={3}
              autoComplete="off"
              spellCheck={false}
              onChange={(v) => setPp({ ...pp, separator: v })}
            />
          </div>
          <Checkbox label="Majuscule à chaque mot" checked={pp.capitalize} onChange={(v) => setPp({ ...pp, capitalize: v })} />
          <Checkbox label="Ajouter un chiffre" checked={pp.includeNumber} onChange={(v) => setPp({ ...pp, includeNumber: v })} />
        </fieldset>
      )}
    </div>
  )
}

