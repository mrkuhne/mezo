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

/** Always 2 — the map is an SVG scatter, never a 3D view. */
export const UMAP_N_COMPONENTS = 2
/** Epochs between `progress` messages from the worker — the map "unfolds" instead of appearing
 *  all at once (Slice 5, Step 5.3). */
export const UMAP_PROGRESS_EVERY = 25
