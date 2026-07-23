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

const MUSCLE_FAMILY: Record<string, keyof typeof FAMILIES> = {
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
