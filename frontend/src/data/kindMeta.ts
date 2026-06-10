import type { FuelKind } from './types'
import type { IconName } from '@/components/ui/Icon'
export const KIND_META: Record<FuelKind, { color: string; icon: IconName; label: string }> = {
  wake:       { color: 'var(--text-secondary)', icon: 'today', label: 'Wake' },
  meal:       { color: 'var(--brand-glow)',     icon: 'fuel',  label: 'Étkezés' },
  midday:     { color: 'var(--info)',           icon: 'pill',  label: 'Stack' },
  snack:      { color: 'var(--brand-primary)',  icon: 'fuel',  label: 'Snack' },
  preworkout: { color: 'var(--warning)',        icon: 'pill',  label: 'Pre-workout' },
  workout:    { color: 'var(--brand-glow)',     icon: 'train', label: 'Gym' },
  sport:      { color: 'var(--cat-tendency)',   icon: 'today', label: 'Sport' },
  evening:    { color: 'var(--cat-preference)', icon: 'pill',  label: 'Esti stack' },
}
