// Decode + normalise the server's PCA-50 projection block (mezo-4qyt.5, Step 5.2). The block is
// little-endian Float32, `items.length x dims`, row-major, base64-encoded
// (AdminMemoryVectorsResponse.projection). Kept in its own module (no React, no umap-js) so it
// can be unit-tested without a DOM and imported from both the worker and the main thread.

/**
 * Decodes a base64 Float32 block into `count` rows of `dims` floats.
 *
 * `atob` -> Uint8Array -> Float32Array over the SAME buffer works only because the Uint8Array is
 * freshly allocated at offset 0 (a view into a larger buffer would be mis-aligned); this builds
 * it that way and never slices a shared buffer into here.
 */
export function decodeProjection(base64: string, count: number, dims: number): Float32Array[] {
  if (count === 0) return []
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const expected = count * dims * 4
  if (bytes.byteLength !== expected) {
    throw new Error(
      `admin memory projection block is ${bytes.byteLength} bytes, expected count(${count}) * dims(${dims}) * 4 = ${expected}`,
    )
  }
  const floats = new Float32Array(bytes.buffer)
  const rows: Float32Array[] = []
  for (let i = 0; i < count; i++) {
    rows.push(floats.subarray(i * dims, (i + 1) * dims))
  }
  return rows
}

/**
 * L2-normalises every row. umap-js's default euclidean metric on normalised vectors is
 * monotonically equivalent to cosine — the metric the backend's pgvector neighbours use — so the
 * map's visual neighbourhoods and the inspector's real neighbours tell the same story instead of
 * two. A zero row (degenerate, e.g. an all-zero PCA output) is left untouched rather than
 * divided by zero, so it never turns into a row of `NaN`.
 */
export function l2Normalise(rows: Float32Array[] | number[][]): number[][] {
  return rows.map((row) => {
    let sumSquares = 0
    for (let i = 0; i < row.length; i++) sumSquares += row[i] * row[i]
    const norm = Math.sqrt(sumSquares)
    if (norm === 0) return Array.from(row)
    const out = new Array<number>(row.length)
    for (let i = 0; i < row.length; i++) out[i] = row[i] / norm
    return out
  })
}
