// ============================================================
// Mezo · GymDaySheet — day-detail bottom sheet for the GymPage split.
// Header (day label · gym / Antonio type / mono meta), an exercise
// list (GymExRow), and a four-state footer (cross-day start, mezo-p7rp):
// resume (this day's workout is open) / blocked (another day's workout
// is open) / review (day completed this Mon–Sun week, any date) / start
// ("Indítsuk · most" today, "Indítsuk · ma" for any other day of the
// week — past catch-up gets an amber "Elmaradt" header chip).
// Ported from prototype train-views.jsx GymDaySheet.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary } from '@/shared/ui/Cta'
import { DAY_LABELS, DAY_ORDER, MUSCLE_LABELS } from '@/data/train/train'
import type { MesoDay } from '@/data/types'
import { GymExRow } from '@/features/train/components/GymExRow'

interface GymDaySheetProps {
  day: MesoDay
  /** This template day's COMPLETED instance of the current Mon–Sun week (null when none) — flips the footer to review (D5). */
  completedThisWeek?: { id: string; date: string } | null
  /** The user's open workout instance's template-day id, any day (null when none) — one open workout at a time (D6). */
  openTemplateSessionId?: string | null
  /** The open workout's day title for the blocked-footer note (e.g. "Pull Day"). */
  openWorkoutTitle?: string | null
  onClose: () => void
}

/** 'Hét'..'Vas' for an ISO date — mirrors the server's HU day-label ring. */
function dowLabel(isoDate: string): string {
  return DAY_ORDER[(new Date(`${isoDate}T00:00:00`).getDay() + 6) % 7]
}

export function GymDaySheet({ day, completedThisWeek, openTemplateSessionId, openWorkoutTitle, onClose }: GymDaySheetProps) {
  const navigate = useNavigate()
  const totalSets = day.exercises.reduce((acc, e) => acc + e.workingSets, 0)
  const hasExercises = day.exercises.length > 0
  // Past = earlier weekday than today (catch-up); future days pull forward without a chip.
  const todayIdx = (new Date().getDay() + 6) % 7
  const dayIdx = DAY_ORDER.indexOf(day.day as (typeof DAY_ORDER)[number])
  const missed = hasExercises && !day.current && dayIdx >= 0 && dayIdx < todayIdx && !completedThisWeek
  const resumable = Boolean(openTemplateSessionId && day.id && openTemplateSessionId === day.id)
  const blocked = Boolean(openTemplateSessionId) && !resumable

  const goSession = (close: () => void) => {
    // Non-today days pin the template via ?day= (real mode; mock days carry no id).
    navigate(day.current || !day.id ? '/train/session' : `/train/session?day=${day.id}`)
    close()
  }

  return (
    <Sheet onClose={onClose} labelledBy="gym-day-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="col flex-1" style={{ minWidth: 0 }}>
              <div className="row gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="eyebrow brand">{DAY_LABELS[day.day] ?? day.day} · gym</span>
                {missed && (
                  <span className="chip warning" style={{ padding: '3px 8px', fontSize: 9 }}>
                    <Icon name="warning" size={9} /> Elmaradt
                  </span>
                )}
                {completedThisWeek && (
                  <span
                    className="chip"
                    style={{
                      padding: '3px 8px', fontSize: 9, color: 'var(--success)',
                      borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
                      background: 'color-mix(in srgb, var(--success) 8%, transparent)',
                    }}
                  >
                    ✓ Lenyomva · {dowLabel(completedThisWeek.date)}
                  </span>
                )}
              </div>
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

          {/* Footer — resume > blocked > review > start (see the header comment). */}
          {resumable ? (
            <CtaPrimary onClick={() => goSession(close)}>
              <Icon name="train" size={14} /> Folytassuk →
            </CtaPrimary>
          ) : blocked ? (
            <div className="card notch-4" style={{ padding: 12, textAlign: 'center', background: 'var(--surface-1)' }}>
              <span style={{ fontSize: 11, color: 'var(--brand-glow)', fontWeight: 700 }}>
                ● Folyamatban: {openWorkoutTitle ?? 'másik edzés'}
              </span>
              <br />
              <span className="text-tertiary" style={{ fontSize: 11 }}>
                Fejezd be, mielőtt másik napot indítasz
              </span>
            </div>
          ) : completedThisWeek ? (
            <CtaPrimary
              onClick={() => {
                navigate(`/train/review/${completedThisWeek.id}`)
                close()
              }}
            >
              <Icon name="check" size={14} /> Kész · Megnézem →
            </CtaPrimary>
          ) : hasExercises && day.current ? (
            <CtaPrimary onClick={() => goSession(close)}>
              <Icon name="train" size={14} /> Indítsuk · most
            </CtaPrimary>
          ) : hasExercises ? (
            <>
              <CtaPrimary onClick={() => goSession(close)}>
                <Icon name="train" size={14} /> Indítsuk · ma
              </CtaPrimary>
              <div className="label-mono text-tertiary" style={{ fontSize: 9, textAlign: 'center', marginTop: 9 }}>
                {DAY_LABELS[day.day] ?? day.day} terv → ma indul
              </div>
            </>
          ) : (
            <div className="card notch-4" style={{ padding: 12, textAlign: 'center', background: 'var(--surface-1)' }}>
              <span className="text-tertiary" style={{ fontSize: 11 }}>Pihenőnap</span>
            </div>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
