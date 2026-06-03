import type { FuelKind } from './types'
export const KIND_META: Record<FuelKind, { color: string; label: string }> = {
  wake:       { color: 'var(--text-secondary)', label: 'Wake' },
  meal:       { color: 'var(--brand-glow)',     label: 'Étkezés' },
  midday:     { color: 'var(--info)',           label: 'Stack' },
  snack:      { color: 'var(--brand-primary)',  label: 'Snack' },
  preworkout: { color: 'var(--warning)',        label: 'Pre-workout' },
  workout:    { color: 'var(--brand-glow)',     label: 'Gym' },
  sport:      { color: 'var(--cat-tendency)',   label: 'Sport' },
  evening:    { color: 'var(--cat-preference)', label: 'Esti stack' },
}
