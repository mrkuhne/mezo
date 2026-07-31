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
 * The achieving value as rendered copy: the set's load (`80 kg × 8`) for
 * WEIGHT / E1RM / REPS_AT_WEIGHT / TARGET_HIT, else the raw value + unit.
 *
 * SESSION_VOLUME is deliberately excluded from the set-shaped branch even
 * though it DOES carry weightKg/reps on the wire — the backend's `toMedal`
 * (MedalService.java) always populates them from the session's top set, so
 * the row still names a concrete lift. But the medal's headline is the
 * session volume (`value`, in kg), not that one set's load — rendering
 * `weightKg × reps` here would show an unrelated number next to a
 * "previous" that is itself a volume, and make the row indistinguishable
 * from a WEIGHT medal on the same exercise.
 */
export function medalValueLabel(medal: Medal): string {
  if (medal.type !== 'SESSION_VOLUME' && medal.weightKg != null && medal.reps != null) {
    return `${formatMedalNumber(medal.weightKg)} kg × ${medal.reps}`
  }
  return `${formatMedalNumber(medal.value)} ${MEDAL_UNIT_LABEL[medal.unit] ?? ''}`.trim()
}
