// ============================================================
// Mezo · MedalChip — the set-row medal mark (mezo-wp6n). RECORD tier gets a
// tiny gold disc; TARGET tier renders nothing — a TARGET_HIT is carried by
// the row's own done-tick turning sage instead (the double-tick fix, see
// ActiveWorkoutPage.tsx's prescribed-set rows).
// ============================================================
import type { Medal } from '@/data/train/medalTypes'
import { MEDAL_TYPE_LABEL } from '@/features/train/logic/medalLabels'

export function MedalChip({ medal }: { medal: Medal }) {
  if (medal.tier !== 'RECORD') return null
  const label = MEDAL_TYPE_LABEL[medal.type] ?? 'Rekord'
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
