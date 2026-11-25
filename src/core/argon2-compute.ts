import { argon2d, argon2id } from 'hash-wasm'

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

/** Raw Argon2 computation (hash-wasm). Used directly in tests and inside the worker. */
export async function computeArgon2(req: Argon2Request): Promise<Uint8Array> {
  if (req.version !== 0x13) {
    throw new Error('Argon2 version 0x10 is not supported')
  }
  const options = {
    password: req.password,
    salt: req.salt,
    memorySize: req.memoryKiB,
    iterations: req.iterations,
    hashLength: req.length,
    parallelism: req.parallelism,
    outputType: 'binary' as const,
  }
  return req.type === 2 ? argon2id(options) : argon2d(options)
}
