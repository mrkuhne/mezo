// ============================================================
// Mezo · ArchivedMesoCard — dimmed (opacity 0.7) card for a finished
// mesocycle: Archív + end date eyebrow, Display title, summary line.
// The body opens the run's FROZEN report (mezo-meyc.2 — a closed run has no
// builder); the footer's „Újrafuttatás" action
// (mezo-meyc.1) reruns the closed block — the parent resolves its template
// (materializing one for a legacy run) and opens MesoStartSheet on it.
// Ported from prototype mesocycles.jsx ArchivedMesoCard.
// ============================================================
import { Icon } from '@/shared/ui/Icon'
import type { Mesocycle } from '@/data/types'

interface ArchivedMesoCardProps {
  meso: Mesocycle
  onOpen: () => void
  onRerun: () => void
}

export function ArchivedMesoCard({ meso, onOpen, onRerun }: ArchivedMesoCardProps) {
  return (
    // A plain card, not a <button>: the rerun action is a button of its own and
    // buttons cannot nest.
    <div className="card col" style={{ padding: 'var(--sp-4)', width: '100%', opacity: 0.7 }}>
      <button type="button" onClick={onOpen} className="row" style={{ width: '100%', textAlign: 'left', justifyContent: 'space-between' }}>
        <div className="col flex-1">
          <span className="eyebrow text-tertiary">
            Archív · {meso.endDate}
          </span>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600, marginTop: 4 }}>{meso.title}</div>
          {meso.summary ? (
            <p className="text-secondary mt-sm" style={{ fontSize: 14, lineHeight: 1.4 }}>
              {meso.summary}
            </p>
          ) : null}
        </div>
        <Icon name="chevron-right" size={16} color="var(--text-tertiary)" />
      </button>
      <div className="row mt-md" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="chip tapchip" onClick={onRerun}>
          <Icon name="sparkle" size={10} /> Újrafuttatás
        </button>
      </div>
    </div>
  )
}
