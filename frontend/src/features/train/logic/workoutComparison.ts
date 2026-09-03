// ============================================================
// Mezo · workoutComparison — the review page's "Mihez képest" derivation
// (mezo-d20.8.2.1, spec 2026-08-31 §3.1). Pure and table-tested: the tone rule
// is the part that must never drift, so it lives here rather than in JSX.
// ============================================================
import type { SummaryStats } from '@/features/train/logic/summaryStats'

/**
 * ADR 0010 in one type. The number is always signed and honest; the COLOUR only ever
 * rewards. There is deliberately no `down` tone — a lighter week is not a failure, and the
 * report has no vocabulary for punishing one.
 */
export type DeltaTone = 'up' | 'neutral'

export interface ComparisonCell {
  key: 'volume' | 'target' | 'rir'
  label: string
  /** Signed and formatted for hu-HU (`−0,9 t`, `+2`, `±0,0`). */
  value: string
  /** The reference's own raw value, so reading the delta never demands mental arithmetic. */
  was: string
  tone: DeltaTone
}

export interface WorkoutComparison {
  /** Rendered as `Előző <title> · <refDateLabel>`. */
  refDateLabel: string
  /** The distance between the two sessions — NOT the reference's age from today. Stepping back
   *  onto the reference must not turn "2 hete" into a statement about a different pair. */
  gapLabel: string
  cells: ComparisonCell[]
}

/** Fixed one decimal: `hu1` strips a trailing ",0", which reads as a typo next to `2,7 volt`. */
const fixed1 = (v: number): string => v.toFixed(1).replace('.', ',')
const signed1 = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '±') + fixed1(Math.abs(v))
const signedInt = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v)

/** Whole days between two ISO dates, positive when `a` is later. */
export function dayGap(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000)
}

export function gapLabel(currentDate: string, refDate: string): string {
  const d = dayGap(currentDate, refDate)
  if (d < 7) return `${d} nappal korábban`
  return `${Math.round(d / 7)} héttel korábban`
}

/**
 * Three deltas mirroring the stat strip's own cells, so the eye can hop between them.
 *
 * The Ø RIR cell is hard-wired to `neutral`: there LESS is harder, so an automatic
 * green/grey tone would say the opposite of what happened. It is the one cell whose
 * direction cannot be read without knowing the intent, so the design refuses to guess.
 */
export function deriveComparison(
  current: SummaryStats,
  ref: SummaryStats,
  currentDate: string,
  refDateLabel: string,
  refDate: string,
): WorkoutComparison {
  const dVol = current.volumeT - ref.volumeT
  const dTarget = current.targetCount - ref.targetCount
  const dRir = current.avgRir != null && ref.avgRir != null ? current.avgRir - ref.avgRir : null

  return {
    refDateLabel,
    gapLabel: gapLabel(currentDate, refDate),
    cells: [
      { key: 'volume', label: 'volumen', value: `${signed1(dVol)} t`, was: `${fixed1(ref.volumeT)} t volt`, tone: dVol > 0 ? 'up' : 'neutral' },
      { key: 'target', label: 'célszett', value: signedInt(dTarget), was: `${ref.targetCount} volt`, tone: dTarget > 0 ? 'up' : 'neutral' },
      { key: 'rir', label: 'Ø RIR', value: dRir == null ? '–' : signed1(dRir), was: ref.avgRir == null ? '' : `${fixed1(ref.avgRir)} volt`, tone: 'neutral' },
    ],
  }
}
