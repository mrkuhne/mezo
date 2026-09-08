import { UMAP } from 'umap-js'
import { UMAP_N_COMPONENTS, UMAP_PROGRESS_EVERY } from '@/features/admin/memory/umapConstants'

// The Térkép view's UMAP worker (mezo-4qyt.5, Step 5.3). A plain Vite module worker, spawned by
// MapView.tsx as `new Worker(new URL('./umap.worker.ts', import.meta.url), { type: 'module' })`.
//
// Protocol — deliberately tiny and one-directional-per-message, so the main thread can be tested
// against a hand-written fake worker with no umap-js involved (umapWorker.protocol.test.ts).
export type UmapRequest =
  | { type: 'fit'; data: number[][]; nNeighbors: number; minDist: number; seed: number }
  | { type: 'transform'; vector: number[] }

export type UmapResponse =
  | { type: 'progress'; epoch: number; total: number; coords: number[][] }
  | { type: 'done'; coords: number[][] }
  | { type: 'transformed'; coord: number[] }
  | { type: 'error'; message: string }

/**
 * Deterministic PRNG (mulberry32) so a fixed seed produces the same layout across runs and in
 * tests — `umap-js` accepts a `random` function, so the seed is honoured through that rather than
 * by patching globals.
 */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return function random() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The fitted instance is kept around after `fit` finishes so a later `transform` message (used to
// place a replayed query's projection onto the SAME map) can reuse its trained KNN index. Never
// dies silently: any throw becomes an `error` message instead of an uncaught worker error.
let fitted: UMAP | null = null

function post(message: UmapResponse): void {
  ;(self as unknown as { postMessage: (m: UmapResponse) => void }).postMessage(message)
}

self.onmessage = (event: MessageEvent<UmapRequest>) => {
  const msg = event.data
  try {
    if (msg.type === 'fit') {
      const n = msg.data.length
      // umap-js throws when nNeighbors >= n; a user with fewer memories than the default 15 is a
      // completely normal beta case, so this is clamped rather than allowed to throw.
      const nNeighbors = Math.max(1, Math.min(msg.nNeighbors, n - 1))
      const umap = new UMAP({
        nComponents: UMAP_N_COMPONENTS,
        nNeighbors,
        minDist: msg.minDist,
        random: mulberry32(msg.seed),
      })
      const nEpochs = umap.initializeFit(msg.data)
      for (let epoch = 0; epoch < nEpochs; epoch++) {
        umap.step()
        if (epoch % UMAP_PROGRESS_EVERY === 0 || epoch === nEpochs - 1) {
          post({ type: 'progress', epoch, total: nEpochs, coords: umap.getEmbedding() })
        }
      }
      fitted = umap
      post({ type: 'done', coords: umap.getEmbedding() })
    } else if (msg.type === 'transform') {
      if (!fitted) throw new Error('no fitted UMAP instance to transform against — fit must run first')
      const [coord] = fitted.transform([msg.vector])
      post({ type: 'transformed', coord })
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
