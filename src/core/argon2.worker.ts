import { computeArgon2, type Argon2Request } from './argon2-compute'

interface WorkerScope {
  onmessage: ((ev: MessageEvent<Argon2Request>) => void) | null
  postMessage: (msg: unknown, transfer?: Transferable[]) => void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (ev) => {
  computeArgon2(ev.data).then(
    (hash) => scope.postMessage({ ok: true, hash }, [hash.buffer]),
    (err: unknown) => scope.postMessage({ ok: false, error: err instanceof Error ? err.message : 'argon2 failed' }),
  )
}
