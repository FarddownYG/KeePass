import { argon2d, argon2id } from '@noble/hashes/argon2.js'

export interface Argon2Request {
  password: Uint8Array
  salt: Uint8Array
  memoryKiB: number
  iterations: number
  length: number
  parallelism: number
  /** 0 = Argon2d, 2 = Argon2id (kdbxweb convention) */
  type: 0 | 2
  version: 0x10 | 0x13
}

/** Refuse absurd KDF costs from a (possibly malicious) file instead of letting the tab run out of memory. */
export const MAX_ARGON2_MEMORY_KIB = 2 * 1024 * 1024 // 2 GiB

/**
 * Raw Argon2 computation with @noble/hashes (audited, pure JavaScript).
 * Pure JS on purpose: no WebAssembly, so the CSP needs no 'wasm-unsafe-eval'.
 * Used directly in tests and inside the dedicated worker in the browser.
 */
export async function computeArgon2(req: Argon2Request): Promise<Uint8Array> {
  if (!(req.memoryKiB > 0) || req.memoryKiB > MAX_ARGON2_MEMORY_KIB) throw new Error('argon2 memory cost out of supported range')
  // maxmem raised from noble's 1 GiB default: KeePass allows larger memory costs (the browser may still refuse).
  const opts = { m: req.memoryKiB, t: req.iterations, p: req.parallelism, dkLen: req.length, version: req.version, maxmem: MAX_ARGON2_MEMORY_KIB * 1024 + 1024 * 1024 }
  return req.type === 2 ? argon2id(req.password, req.salt, opts) : argon2d(req.password, req.salt, opts)
}
