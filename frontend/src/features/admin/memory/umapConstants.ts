// UMAP parameters for the Térkép view (mezo-4qyt, binding decision D4). Kept in one FE
// constants module rather than inline in the worker so a test can import the exact numbers the
// worker uses, and so a future tuning pass touches one file. `seed` is fixed (not time-based) so
// the projection is deterministic across runs, which the map view's tests rely on.
//
// This slice (3) only declares the constants — the actual `umap-js` worker that consumes them
// (`umap.worker.ts`) is slice 5's target (Térkép), which is where the `umap-js` dependency
// itself gets added, per the plan's "add only what THIS slice's code imports" rule.
export const UMAP_PARAMS = {
  nNeighbors: 15,
  minDist: 0.1,
  seed: 20260907,
} as const
