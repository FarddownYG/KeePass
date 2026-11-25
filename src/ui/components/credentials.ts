export interface KeyFileValue {
  name: string
  bytes: Uint8Array
}

export interface CredentialsValue {
  password: string
  confirm: string
  keyFile: KeyFileValue | null
}

export const EMPTY_CREDENTIALS: CredentialsValue = { password: '', confirm: '', keyFile: null }

/** Returns an error message, or null when the credentials can be used. */
export function validateCredentials(v: CredentialsValue): string | null {
  if (!v.password && !v.keyFile) return 'Choisissez un mot de passe maître ou un fichier clé.'
  if (v.password !== v.confirm) return 'Les deux mots de passe ne correspondent pas.'
  return null
}
