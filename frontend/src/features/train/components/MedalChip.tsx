// ============================================================
// Mezo · MedalChip — the set-row medal mark (mezo-wp6n). RECORD tier gets a
// tiny gold disc; TARGET tier renders nothing — a TARGET_HIT is carried by
// the row's own done-tick turning sage instead (the double-tick fix, see
// ActiveWorkoutPage.tsx's prescribed-set rows).
// ============================================================
import type { Medal } from '@/data/train/medalTypes'

// Exported so other medal-rendering surfaces (WorkoutSummary.tsx) reuse this
// table instead of declaring a third copy of the same Hungarian labels.
export const RECORD_LABEL: Record<string, string> = {
  WEIGHT: 'Súly-rekord',
  REPS_AT_WEIGHT: 'Rep-rekord',
  E1RM: '1RM-rekord',
  SESSION_VOLUME: 'Volumen-rekord',
}

export function MedalChip({ medal }: { medal: Medal }) {
  if (medal.tier !== 'RECORD') return null
  const label = RECORD_LABEL[medal.type] ?? 'Rekord'
  return (
    <span
      role="img"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'var(--amber)',
        color: 'var(--text-primary)',
        fontSize: 10,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      🏅
    </span>
  )
}
