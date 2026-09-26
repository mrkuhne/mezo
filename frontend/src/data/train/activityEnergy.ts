// ============================================================
// Mezo · activityEnergy — the frontend MIRROR of backend ActivityEnergyModel (mezo-32m82).
// Net-of-rest kcal from the 2024 Adult Compendium: (MET − 1) × BMR/24 × hours. Used ONLY for
// planned previews (Train today, the gym ceremony, the weekly movement summary, Fuel day zones);
// a LOGGED session always shows the backend-persisted kcal. Bound to the backend by the shared
// golden vectors in api/fixtures/activity-energy-vectors.json — change both or neither.
// ============================================================

export type Band = 'light' | 'moderate' | 'hard'

export const DEFAULT_RUN_MIN = 45
export const DEFAULT_GYM_MIN = 60

const MET: Record<string, Record<Band, number>> = {
  gym: { light: 3.5, moderate: 3.5, hard: 5.0 },
  volleyball: { light: 3.0, moderate: 4.0, hard: 6.0 },
  football: { light: 5.0, moderate: 7.0, hard: 9.5 },
  basketball: { light: 4.5, moderate: 6.5, hard: 8.0 },
  tennis: { light: 5.0, moderate: 7.0, hard: 8.0 },
  trx: { light: 3.0, moderate: 4.5, hard: 6.5 },
  cross: { light: 4.0, moderate: 5.8, hard: 8.0 },
  swim: { light: 5.8, moderate: 8.3, hard: 9.8 },
  bike: { light: 5.8, moderate: 6.8, hard: 8.0 },
  hike: { light: 5.3, moderate: 6.0, hard: 7.8 },
  run: { light: 7.5, moderate: 9.3, hard: 10.5 },
  other: { light: 3.0, moderate: 4.0, hard: 6.0 },
}

/** RPE 1–4 light, 5–7 moderate, 8–10 hard; no RPE (every planned block) = moderate. */
export function band(rpe?: number | null): Band {
  if (rpe == null) return 'moderate'
  if (rpe <= 4) return 'light'
  return rpe <= 7 ? 'moderate' : 'hard'
}

/** BMR/24 when known, else 1 kcal per kg per hour, else null (honest unknown). */
export function restKcalPerHour(bmr?: number | null, weightKg?: number | null): number | null {
  if (bmr != null && bmr > 0) return bmr / 24
  if (weightKg != null && weightKg > 0) return weightKg
  return null
}

export function metFor(kind: string | null | undefined, rpe?: number | null): number {
  const row = (kind != null && MET[kind]) || MET.other
  return row[band(rpe)]
}

/** Net kcal of one session, rounded half-up; null when rest energy or a positive duration is unknown. */
export function netKcal(kind: string | null | undefined, rpe: number | null | undefined, minutes: number, restPerHour: number | null): number | null {
  if (restPerHour == null || !(minutes > 0)) return null
  const kcal = (metFor(kind, rpe) - 1) * restPerHour * (minutes / 60)
  return Math.floor(kcal + 0.5)
}

/** A planner/train block's model kind: gym → gym, run → run, sport → its sport id (else other). */
export function blockEnergyKind(block: { kind: 'gym' | 'sport' | 'run'; sport?: string | null }): string {
  return block.kind === 'sport' ? (block.sport ?? 'other') : block.kind
}
