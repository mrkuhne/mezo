/**
 * Safe percentage `a/b * 100`, clamped to [_, 100] and guarded against a zero
 * denominator → 0 (never NaN/Infinity). Dual-mode `realEmpty` values can be zero
 * (e.g. useFuelDay returns zero targets during the real-mode cold-load window —
 * see docs/features/_platform-data-layer.md), so any consumer dividing by a target/
 * total must use this instead of a raw `(a / b) * 100`, which would render "NaN%".
 */
export const pct = (a: number, b: number): number => (b > 0 ? Math.min(100, (a / b) * 100) : 0)

/** Clamp an already-computed percentage into [0, 100] — for bar/fill widths driven
 * by a server-supplied progressPct that could over/undershoot the track. */
export const clampPct = (v: number): number => Math.min(100, Math.max(0, v))
