// ============================================================
// Mezo · ArchivedMesoCard — dimmed (opacity 0.7) card for a finished
// mesocycle: Archív + end date eyebrow, Display title, summary line.
// Navigates to the builder. Ported from prototype mesocycles.jsx ArchivedMesoCard.
// ============================================================
import { Icon } from '@/shared/ui/Icon'
import type { Mesocycle } from '@/data/types'

interface ArchivedMesoCardProps {
  meso: Mesocycle
  onOpen: () => void
}

export function ArchivedMesoCard({ meso, onOpen }: ArchivedMesoCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card"
      style={{ padding: 14, width: '100%', textAlign: 'left', opacity: 0.7 }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="col flex-1">
          <span className="eyebrow text-tertiary">
            Archív · {meso.endDate}
          </span>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, marginTop: 4 }}>{meso.title}</div>
          {meso.summary ? (
            <p className="text-secondary mt-sm" style={{ fontSize: 11, lineHeight: 1.4 }}>
              {meso.summary}
            </p>
          ) : null}
        </div>
        <Icon name="chevron-right" size={14} color="var(--text-tertiary)" />
      </div>
    </button>
  )
}
