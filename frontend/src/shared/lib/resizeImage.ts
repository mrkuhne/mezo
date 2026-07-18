/** Fit (width x height) inside a maxDim square, preserving aspect ratio (no upscale). */
export function fitWithin(width: number, height: number, maxDim: number): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width, height }
  }
  const scale = maxDim / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Downscale a photo to ~maxDim px JPEG before upload (the photo is ephemeral — extraction
 * only, never stored server-side). DOM-dependent; excluded from jsdom tests, proven in live smoke.
 */
export async function resizeImage(file: File, maxDim = 1024, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDim)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality),
  )
}
