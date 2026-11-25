import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { KdfSettings } from '../src/core/vault'

/** Cheap KDF for fast tests (format/semantics identical, only cost differs). */
export const FAST_KDF: KdfSettings = { memoryKiB: 1024, iterations: 2, parallelism: 1 }

export function fixture(name: string): ArrayBuffer {
  const buf = readFileSync(join(process.cwd(), 'tests', 'fixtures', name))
  const out = new ArrayBuffer(buf.byteLength)
  new Uint8Array(out).set(buf)
  return out
}
