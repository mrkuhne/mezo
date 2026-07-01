// ============================================================
// Mezo · GymDaySheet — day-detail bottom sheet for the GymView split.
// Header (day label · gym / Antonio type / mono meta), an exercise
// list (GymExRow), and a footer that is either a "start now" CTA
// (today only) or a view-mode info card.
// Ported from prototype train-views.jsx GymDaySheet.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { CtaPrimary } from '@/components/ui/Cta'
import { DAY_LABELS, MUSCLE_LABELS } from '@/data/train'
import type { MesoDay } from '@/data/types'
import { GymExRow } from '@/features/train/components/GymExRow'

interface GymDaySheetProps {
  day: MesoDay
  onClose: () => void
}

export function GymDaySheet({ day, onClose }: GymDaySheetProps) {
  const navigate = useNavigate()
  const totalSets = day.exercises.reduce((acc, e) => acc + e.sets, 0)
  const canStart = Boolean(day.current)

  return (
    <Sheet onClose={onClose} labelledBy="gym-day-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="col flex-1" style={{ minWidth: 0 }}>
              <span className="eyebrow brand">{DAY_LABELS[day.day] ?? day.day} · gym</span>
              <div
                id="gym-day-title"
                style={{
                  fontFamily: 'var(--ff-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginTop: 4,
                  lineHeight: 1.15,
                }}
              >
                {day.type}
              </div>
              <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                {day.exerciseCount} gyakorlat · {totalSets} szet · {MUSCLE_LABELS[day.muscle] ?? day.muscle}
              </span>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Exercises */}
          <div className="col gap-sm" style={{ marginBottom: 16 }}>
            {day.exercises.map((ex, i) => (
              <GymExRow key={ex.id} ex={ex} idx={i + 1} />
            ))}
          </div>

          {/* Footer: start today, else view-mode note */}
          {canStart ? (
            <CtaPrimary
              onClick={() => {
                navigate('/train/session')
                close()
              }}
            >
              <Icon name="train" size={14} /> Indítsuk · most
            </CtaPrimary>
          ) : (
            <div className="card notch-4" style={{ padding: 12, textAlign: 'center', background: 'var(--surface-1)' }}>
              <span className="text-tertiary" style={{ fontSize: 11 }}>
                Nézet-mód · csak a mai napot lehet indítani
              </span>
            </div>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
