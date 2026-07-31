// ============================================================
// Mezo · medalLabels — the Hungarian medal vocabulary + value formatting
// shared by every medal surface (mezo-wp6n): the set-row chip (MedalChip),
// the celebration toast (MedalToast) and the workout summary's medal block
// (WorkoutSummary). Pure data + pure functions, so it lives in logic/ rather
// than being re-exported from whichever component happened to declare it
// first — same shape as logic/muscleColors.ts.
//
// NOT here: MedalToast's own `TYPE_LABEL` (SÚLY / REP / 1RM / VOLUMEN) — the
// toast eyebrow uses deliberately different, uppercase short forms, so it is
// separate copy rather than a duplicate of this table.
// ============================================================
import type { Medal, MedalType } from '@/data/train/medalTypes'

type MedalUnit = NonNullable<Medal['unit']>

/**
 * Type → Hungarian label. Covers all five types including `TARGET_HIT`: the
 * RECORD-only consumers (MedalChip) can never reach that entry, because both
 * the backend (MedalService.toMedal) and the mock evaluator derive `tier`
 * from `type` — TARGET_HIT is always TARGET tier, everything else RECORD.
 */
export const MEDAL_TYPE_LABEL: Record<MedalType, string> = {
  WEIGHT: 'Súly-rekord',
  REPS_AT_WEIGHT: 'Rep-rekord',
  E1RM: '1RM-rekord',
  SESSION_VOLUME: 'Volumen-rekord',
  TARGET_HIT: 'Cél teljesítve',
}

export const MEDAL_UNIT_LABEL: Record<MedalUnit, string> = { KG: 'kg', REPS: 'rep' }

/**
 * Tier → glyph + color, the two-tier split every medal row surface uses (mezo-wp6n):
 * RECORD reads as an achievement (amber, 🏅), TARGET_HIT stays quiet (sage, ✓). Was
 * duplicated byte-for-byte in MedalsPage.tsx and WorkoutSummary.tsx; hoisted here
 * alongside the rest of the shared medal vocabulary (Finding 3 of the final review).
 */
export const MEDAL_TIER_COPY: Record<Medal['tier'], { glyph: string; color: string }> = {
  RECORD: { glyph: '🏅', color: 'var(--amber-deep)' },
  TARGET: { glyph: '✓', color: 'var(--sage-deep)' },
}

/** Hungarian number formatting — the single `toLocaleString('hu-HU')` for medals. */
export const formatMedalNumber = (n: number) => n.toLocaleString('hu-HU')

/**
 * Medal types whose headline is a DERIVED quantity rather than the achieving
 * set's own load, so the set-shaped form would print a number that cannot be
 * compared against the medal's own `previousValue`.
 *
 * Every medal carries `weightKg`/`reps` on the wire — the backend's `toMedal`
 * (MedalService.java) populates them for all five types, so a row can always
 * name a concrete lift. But for these two the headline lives in `value`:
 *  - E1RM: `value` is the estimated 1RM (22 kg × 12 → 30.7) and
 *    `previousValue` is the prior *estimate*. Printing the set put
 *    "22 kg × 12" next to "Előző: 28 kg", which reads as a REGRESSION on a
 *    row that is in fact a record (mezo-je3u).
 *  - SESSION_VOLUME: `value` is the session's Σ(w×reps); the set is one lift
 *    inside it, and printing it makes the row indistinguishable from a WEIGHT
 *    medal on the same exercise (mezo-wp6n, whole-branch review).
 *
 * WEIGHT / REPS_AT_WEIGHT / TARGET_HIT keep the set form: their headline IS
 * the set (its load, or its reps at that load), so it stays comparable.
 */
const DERIVED_HEADLINE_TYPES: readonly MedalType[] = ['E1RM', 'SESSION_VOLUME']

/** The achieving value as rendered copy — see {@link DERIVED_HEADLINE_TYPES}. */
export function medalValueLabel(medal: Medal): string {
  const derived = DERIVED_HEADLINE_TYPES.includes(medal.type)
  if (!derived && medal.weightKg != null && medal.reps != null) {
    return `${formatMedalNumber(medal.weightKg)} kg × ${medal.reps}`
  }
  return `${formatMedalNumber(medal.value)} ${MEDAL_UNIT_LABEL[medal.unit] ?? ''}`.trim()
}
