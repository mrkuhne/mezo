// ============================================================
// Mezo · DayDetailSheet — tapping a Heti terv day row in the builder's
// MesoOverview opens this sheet: brand eyebrow `{day} · {meso.title}`,
// the day type as the title, the muscle group, and a one-line summary.
// Training days show the planned-exercise count + a `Szerkesztés →` action;
// rest days show the rest-day copy with only a `Bezár` button.
// Ported from prototype mesocycles.jsx DayDetailSheet. The English fragment
// "Open the day to edit." is intentional (verbatim parity with the prototype).
// ============================================================
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Display } from '@/components/ui/Display'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import type { MesoDay, Mesocycle } from '@/data/types'

interface DayDetailSheetProps {
  day: MesoDay
  meso: Mesocycle
  onClose: () => void
  // Inert for now — Task 9/10 wire the Gyakorlatok editing flow.
  onEdit?: () => void
}

export function DayDetailSheet({ day, meso, onClose, onEdit }: DayDetailSheetProps) {
  const isTraining = day.exerciseCount > 0
  return (
    <Sheet onClose={onClose} labelledBy="day-detail-title">
      {(close) => (
        <>
          {/* Header */}
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}
          >
            <div className="col">
              <span className="eyebrow brand">
                {day.day} · {meso.title}
              </span>
              <div id="day-detail-title" style={{ marginTop: 4 }}>
                <Display size="md">{day.type}</Display>
              </div>
              {day.muscle && (
                <span className="text-secondary mt-sm" style={{ fontSize: 12 }}>
                  {day.muscle}
                </span>
              )}
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Body */}
          <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
            {isTraining
              ? `${day.exerciseCount} gyakorlat tervezve. Open the day to edit.`
              : 'Rest day · vagy sport. Nincs gym session.'}
          </p>

          {/* Footer */}
          <div className="row gap-sm mt-lg">
            <CtaGhost className="notch-4 flex-1" onClick={close}>
              Bezár
            </CtaGhost>
            {isTraining && (
              <CtaPrimary
                className="notch-4 flex-1"
                onClick={() => {
                  onEdit?.()
                  close()
                }}
              >
                Szerkesztés →
              </CtaPrimary>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}
