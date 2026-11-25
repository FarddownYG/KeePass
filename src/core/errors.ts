export type VaultErrorCode =
  | 'wrong-credentials'
  | 'not-kdbx'
  | 'corrupt'
  | 'unsupported'
  | 'kdf-failed'
  | 'save-verify-failed'
  | 'unknown'

const MESSAGES: Record<VaultErrorCode, string> = {
  'wrong-credentials': 'Mot de passe maître ou fichier clé incorrect.',
  'not-kdbx': "Ce fichier n'est pas une base KeePass (.kdbx).",
  corrupt: 'Le fichier est endommagé et ne peut pas être lu.',
  unsupported: "Cette base utilise une option non prise en charge.",
  'kdf-failed': 'La dérivation de clé a échoué (mémoire insuffisante ?).',
  'save-verify-failed': "Échec de la vérification du fichier chiffré : rien n'a été écrit.",
  unknown: "Impossible d'ouvrir la base.",
}

export class VaultError extends Error {
  readonly code: VaultErrorCode
  constructor(code: VaultErrorCode) {
    super(MESSAGES[code])
    this.name = 'VaultError'
    this.code = code
  }
}
