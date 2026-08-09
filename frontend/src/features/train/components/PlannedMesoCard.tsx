// ============================================================
// Mezo · PlannedMesoCard — dashed-border card for a queued mesocycle:
// Tervezett eyebrow + start date, Display title, goal, optional italic note,
// and {weeks} hét + first-split chips. Navigates to the builder.
// Ported from prototype mesocycles.jsx PlannedMesoCard.
// ============================================================
import { Chip } from '@/shared/ui/Chip'
import { Icon } from '@/shared/ui/Icon'
import type { Mesocycle } from '@/data/types'

interface PlannedMesoCardProps {
  meso: Mesocycle
  onOpen: () => void
}

export function PlannedMesoCard({ meso, onOpen }: PlannedMesoCardProps) {
  const splitHead = meso.split.split(' · ')[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card"
      style={{ padding: 'var(--sp-4)', width: '100%', textAlign: 'left', borderStyle: 'dashed' }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col flex-1">
          <div className="row gap-sm">
            <span className="eyebrow text-tertiary">Tervezett</span>
            <span className="label-mono text-tertiary">· {meso.startDate}</span>
          </div>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>
            {meso.title}
          </div>
          <span className="text-secondary mt-sm" style={{ fontSize: 14, lineHeight: 1.4 }}>
            {meso.goal}
          </span>
          {meso.notes ? (
            <p className="text-meta-sm text-tertiary mt-sm">
              "{meso.notes}"
            </p>
          ) : null}
          <div className="row gap-sm mt-md">
            <Chip>{meso.weeks} hét</Chip>
            <Chip>{splitHead}</Chip>
          </div>
        </div>
        <Icon name="chevron-right" size={16} color="var(--text-tertiary)" />
      </div>
    </button>
  )
}
