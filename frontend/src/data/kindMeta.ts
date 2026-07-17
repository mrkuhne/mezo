import type { FuelKind } from '@/data/types'
import type { IconName } from '@/shared/ui/Icon'
export const KIND_META: Record<FuelKind, { color: string; icon: IconName; label: string }> = {
  wake:       { color: 'var(--text-secondary)', icon: 'today', label: 'Wake' },
  meal:       { color: 'var(--coral)',     icon: 'fuel',  label: 'Étkezés' },
  midday:     { color: 'var(--info)',           icon: 'pill',  label: 'Stack' },
  snack:      { color: 'var(--coral)',  icon: 'fuel',  label: 'Snack' },
  preworkout: { color: 'var(--warning)',        icon: 'pill',  label: 'Pre-workout' },
  workout:    { color: 'var(--coral)',     icon: 'train', label: 'Gym' },
  sport:      { color: 'var(--cat-tendency)',   icon: 'today', label: 'Sport' },
  evening:    { color: 'var(--cat-preference)', icon: 'pill',  label: 'Esti stack' },
}
