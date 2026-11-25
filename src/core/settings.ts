/** Non-secret UI preferences only. Never store secrets here. */
export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  theme: ThemePref
  lockAfterMinutes: number
  lockOnHidden: boolean
  rememberVault: boolean
  /** Have I Been Pwned range lookups (k-anonymity). */
  hibpEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', lockAfterMinutes: 5, lockOnHidden: true, rememberVault: true, hibpEnabled: true }

const KEY = 'keyhold.settings.v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS
    const p = parsed as Partial<Record<keyof Settings, unknown>>
    return {
      theme: p.theme === 'light' || p.theme === 'dark' || p.theme === 'system' ? p.theme : DEFAULT_SETTINGS.theme,
      lockAfterMinutes:
        typeof p.lockAfterMinutes === 'number' && p.lockAfterMinutes >= 1 && p.lockAfterMinutes <= 60
          ? p.lockAfterMinutes
          : DEFAULT_SETTINGS.lockAfterMinutes,
      lockOnHidden: typeof p.lockOnHidden === 'boolean' ? p.lockOnHidden : DEFAULT_SETTINGS.lockOnHidden,
      rememberVault: typeof p.rememberVault === 'boolean' ? p.rememberVault : DEFAULT_SETTINGS.rememberVault,
      hibpEnabled: typeof p.hibpEnabled === 'boolean' ? p.hibpEnabled : DEFAULT_SETTINGS.hibpEnabled,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage unavailable: preferences are simply not persisted
  }
}
