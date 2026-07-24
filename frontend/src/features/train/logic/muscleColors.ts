// ============================================================
// Mezo · muscleColors — muscle key → color-family tokens for the Train
// exercise cards (mezo-kaui PR-card redesign). 13 live catalog muscles
// (ck_exercise_catalog_muscle) + legacy 'back' → 6 existing token families;
// unknown keys get a neutral fallback. Values are CSS custom-property
// references so both themes work with zero new tokens.
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
  chest: 'coral',
  'back-mid': 'sky', lats: 'sky', traps: 'sky', back: 'sky',
  shoulder: 'lav', 'rear-delt': 'lav',
  biceps: 'rose', triceps: 'rose',
  quad: 'sage', ham: 'sage', glute: 'sage', calf: 'sage',
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

/** Color tokens of a region — the family itself (region == family). */
export function regionColor(region: RegionKey): MuscleColorFamily {
  return FAMILIES[region]
}
