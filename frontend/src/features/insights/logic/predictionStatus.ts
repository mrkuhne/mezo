import type { PredictionStatus } from '@/data/types'

/** Hungarian status chips (prototype .stch) — localizing the shipped English ones.
 *  `missed` has no prototype card; it wears the muted chip, never red (guardrail). */
export const PREDICTION_STATUS: Record<PredictionStatus, { label: string; chip: string; wash?: string }> = {
  pending: { label: '◐ Folyamatban', chip: 'pend', wash: 'lav' },
  validated: { label: '✓ Bevált', chip: 'ok', wash: 'sage' },
  missed: { label: '◯ Nem jött be', chip: 'mut' },
}

