// ============================================================
// Mezo · muscleColors — muscle key → color-family tokens for the Train
// exercise cards (mezo-kaui PR-card redesign). 21 live catalog muscles
// (mezo-wu1s head/zone-specific taxonomy) + legacy coarse keys (back, chest,
// shoulder, lats, rear-delt, biceps, triceps — still emitted by the volume
// log) → 6 existing token families; unknown keys get a neutral fallback.
// Values are CSS custom-property references so both themes work with zero
// new tokens.
// ============================================================

export interface MuscleColorFamily {
  rail: string // 5px card rail + STIM ticks
  wash: string // pill / rank-plaque / play-roundel background
  deep: string // pill / rank-plaque / play-roundel text
}

const FAMILIES = {
  coral: { rail: 'var(--coral)', wash: 'var(--wash-gym)', deep: 'var(--tag-gym)' },
  sky: { rail: 'var(--sky)', wash: 'var(--wash-run)', deep: 'var(--tag-run)' },
  lav: { rail: 'var(--lav)', wash: 'var(--wash-lav)', deep: 'var(--lav-deep)' },
  rose: { rail: 'var(--rose)', wash: 'var(--wash-sport)', deep: 'var(--tag-sport)' },
  sage: { rail: 'var(--sage)', wash: 'var(--wash-sage)', deep: 'var(--sage-deep)' },
  amber: { rail: 'var(--amber)', wash: 'var(--wash-amber)', deep: 'var(--amber-deep)' },
  neutral: { rail: 'var(--text-tertiary)', wash: 'var(--surface-2)', deep: 'var(--text-secondary)' },
} as const satisfies Record<string, MuscleColorFamily>

// Values are non-neutral families only (RegionKey) — muscleRegion() relies on this.
const MUSCLE_FAMILY: Record<string, RegionKey> = {
  // Mell → coral
  'chest-upper': 'coral', 'chest-mid': 'coral', 'chest-lower': 'coral', chest: 'coral',
  // Hát → sky
  'back-wide': 'sky', 'back-mid': 'sky', 'back-lower': 'sky', traps: 'sky', lats: 'sky', back: 'sky',
  // Váll → lav
  'shoulder-front': 'lav', 'shoulder-side': 'lav', 'shoulder-rear': 'lav', shoulder: 'lav', 'rear-delt': 'lav',
  // Kar → rose
  'biceps-long': 'rose', 'biceps-short': 'rose', 'biceps-brachialis': 'rose',
  'triceps-long': 'rose', 'triceps-lateral': 'rose', 'triceps-medial': 'rose', biceps: 'rose', triceps: 'rose',
  // Láb → sage
  quad: 'sage', ham: 'sage', glute: 'sage', calf: 'sage',
  // Core → amber
  core: 'amber',
}

export function muscleColor(muscle: string): MuscleColorFamily {
  return FAMILIES[MUSCLE_FAMILY[muscle] ?? 'neutral']
}

// --- Region vocabulary (mezo-ly27 muscle-week) — region == color family. ---
export type RegionKey = Exclude<keyof typeof FAMILIES, 'neutral'>

export const REGION_ORDER = ['coral', 'sky', 'lav', 'rose', 'sage', 'amber'] as const satisfies readonly RegionKey[]

/** HU region label per color family (card grid row labels + event-load chips). */
export const REGION_LABELS: Record<RegionKey, string> = {
  coral: 'Mell', sky: 'Hát', lav: 'Váll', rose: 'Kar', sage: 'Láb', amber: 'Core',
}

/** Region (== color family) of a muscle key; null for unknown/off-day keys. */
export function muscleRegion(muscle: string): RegionKey | null {
  return MUSCLE_FAMILY[muscle] ?? null
}

/** Region (== color family) → Mozaik tone, the one mapping the week mosaic's tile wash
 *  (`mz-w-*`) and the muscle page's whole-page tone both read. `amber` (Core) has no tone
 *  of its own, so it lands on `gold` — the closest neutral-warm family. Typed structurally
 *  (not as `PageTone`) so this pure logic module keeps its zero UI imports; it is assignable
 *  to `PageTone` because the union is identical. */
export const REGION_TONE: Record<RegionKey, 'coral' | 'gold' | 'lav' | 'rose' | 'sage' | 'sky'> = {
  coral: 'coral', sky: 'sky', lav: 'lav', rose: 'rose', sage: 'sage', amber: 'gold',
}

/** Color tokens of a region — the family itself (region == family). */
export function regionColor(region: RegionKey): MuscleColorFamily {
  return FAMILIES[region]
}

// --- Live taxonomy grouped by region (mezo-wu1s) --------------------------------------------
// The 21 head/zone-specific tokens a user can pick/filter, in display order, grouped under
// their region. Single source for the two-level ExercisePickerSheet filter and the region-
// grouped CatalogExerciseSheet picker. Legacy coarse keys (chest, back, …) are deliberately
// absent — they render on read (labels/colors) but are never offered for authoring/filtering.
export const REGION_MUSCLES: { region: RegionKey; muscles: string[] }[] = [
  { region: 'coral', muscles: ['chest-upper', 'chest-mid', 'chest-lower'] },
  { region: 'sky', muscles: ['back-wide', 'back-mid', 'back-lower', 'traps'] },
  { region: 'lav', muscles: ['shoulder-front', 'shoulder-side', 'shoulder-rear'] },
  { region: 'rose', muscles: ['biceps-long', 'biceps-short', 'biceps-brachialis', 'triceps-long', 'triceps-lateral', 'triceps-medial'] },
  { region: 'sage', muscles: ['quad', 'ham', 'glute', 'calf'] },
  { region: 'amber', muscles: ['core'] },
]

/** Flat list of the 21 live tokens in region display order. */
export const LIVE_MUSCLES: string[] = REGION_MUSCLES.flatMap((g) => g.muscles)
