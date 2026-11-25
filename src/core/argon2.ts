import { CryptoEngine } from 'kdbxweb'
import { computeArgon2, type Argon2Request } from './argon2-compute'

type WorkerReply = { ok: true; hash: Uint8Array } | { ok: false; error: string }

/** Runs Argon2 in a dedicated worker (keeps the UI responsive). One worker per derivation, terminated after use. */
function computeInWorker(req: Argon2Request): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<WorkerReply>) => {
      worker.terminate()
      if (ev.data.ok) resolve(ev.data.hash)
      else reject(new Error(ev.data.error))
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error('argon2 worker failed'))
    }
    worker.postMessage(req, [req.password.buffer, req.salt.buffer])
  })
}

let installed = false

/** Registers the Argon2 implementation used by kdbxweb (KDBX 4 key derivation). Idempotent. */
export function installArgon2(): void {
  if (installed) return
  installed = true
  const useWorker = typeof Worker !== 'undefined' && typeof window !== 'undefined'
  CryptoEngine.setArgon2Impl(async (password, salt, memory, iterations, length, parallelism, type, version) => {
    const req: Argon2Request = {
      // copies: buffers are transferred to the worker
      password: new Uint8Array(password.slice(0)),
      salt: new Uint8Array(salt.slice(0)),
      memoryKiB: memory,
      iterations,
      length,
      parallelism,
      type,
      version,
    }
    const hash = useWorker ? await computeInWorker(req) : await computeArgon2(req)
    const out = new Uint8Array(hash.byteLength)
    out.set(hash)
    hash.fill(0)
    return out.buffer
  })
}
