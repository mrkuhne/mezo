import { useId, type AriaAttributes, type AriaRole } from 'react'

export const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a))

/** A per-instance id that is safe inside `url(#…)` (React ids contain colons / guillemets). Bible trap 2. */
export function useSvgId(prefix = 'fo'): string {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/** What every kit piece hands on to its root element: `id`, `role`, `aria-*`, `data-*` (test ids, kalauz anchors). */
export type PassProps = AriaAttributes & { id?: string; role?: AriaRole } & { [K in `data-${string}`]?: string | number | boolean | undefined }

/** Splits pass-through props: `aria-*` (for the interactive element) and the rest (`id`, `role`, `data-*`, for the root). */
export function splitAria<T extends object>(rest: T): [aria: Partial<T>, other: Partial<T>] {
  const aria: Record<string, unknown> = {}
  const other: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rest)) (k.startsWith('aria-') ? aria : other)[k] = v
  return [aria as Partial<T>, other as Partial<T>]
}
