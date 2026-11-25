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

/**
 * Raw Argon2 computation with @noble/hashes (audited, pure JavaScript).
 * Pure JS on purpose: no WebAssembly, so the CSP needs no 'wasm-unsafe-eval'.
 * Used directly in tests and inside the dedicated worker in the browser.
 */
export async function computeArgon2(req: Argon2Request): Promise<Uint8Array> {
  const opts = { m: req.memoryKiB, t: req.iterations, p: req.parallelism, dkLen: req.length, version: req.version }
  return req.type === 2 ? argon2id(req.password, req.salt, opts) : argon2d(req.password, req.salt, opts)
}
