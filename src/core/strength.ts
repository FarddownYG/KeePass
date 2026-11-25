import type { ZxcvbnFactory } from '@zxcvbn-ts/core'

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  crackTime: string
  warning: string | null
  suggestions: string[]
}

const LABELS = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent'] as const

let factory: Promise<ZxcvbnFactory> | null = null

function load(): Promise<ZxcvbnFactory> {
  factory ??= (async () => {
    const [core, common, fr, en] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-fr'),
      import('@zxcvbn-ts/language-en'),
    ])
    return new core.ZxcvbnFactory({
      translations: fr.translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary, ...fr.dictionary },
    })
  })()
  return factory
}

/** Local-only strength estimation (no network: the pwned matcher is NOT used). */
export async function estimateStrength(password: string, userInputs: string[] = []): Promise<Strength> {
  const z = await load()
  const r = z.check(password.slice(0, 256), userInputs)
  return {
    score: r.score,
    label: LABELS[r.score],
    crackTime: String(r.crackTimes.offlineSlowHashingXPerSecond.display),
    warning: r.feedback.warning,
    suggestions: r.feedback.suggestions,
  }
}
