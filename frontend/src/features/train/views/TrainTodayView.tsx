// ============================================================
// Mezo · TrainTodayView (Mai)
// Today's gym block + today's volleyball block (conditional) +
// combined weekly gym/sport timeline + provenance note.
// Thin TrainScreen shell ⇒ this view owns its own .page-header.
// Ported from prototype train-views.jsx (TrainTodayView + buildWeeklyAgenda).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { DAY_LABELS, DAY_ORDER } from '@/data/train'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Display } from '@/components/ui/Display'
import { Icon } from '@/components/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/components/ui/Cta'
import { GhostState } from '@/components/ui/GhostState'
import { SportLogSheet } from '../components/SportLogSheet'
import { WeeklyDayRow, type WeeklyAgendaDay } from '../components/WeeklyDayRow'

export function TrainTodayView() {
  const { workout, gymSchedule, sport, activeMeso, logSportSession } = useTrain()
  const navigate = useNavigate()
  const [vbLogOpen, setVbLogOpen] = useState(false)

  // T0/T2: without an active meso the whole view ghosts. With one, the agenda
  // derives from the meso (gymSchedule) and /today drives the hero card;
  // volleyball columns stay empty until T3 (sport.schedule is null until then).
  if (!activeMeso) {
    return (
      <>
        <div className="page-header">
          <div className="col gap-xs">
            <Eyebrow brand>Train · Mai</Eyebrow>
            <PageTitle>Edzés</PageTitle>
          </div>
        </div>
        <div style={{ padding: '0 24px 12px' }}>
          <GhostState
            lines={4}
            message="Itt fog élni a mai edzésed — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust"
            onCta={() => navigate('/train/mesocycles/new')}
          />
        </div>
        <div style={{ padding: '0 24px 16px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="eyebrow">Heti terv · gym + sport</span>
          </div>
          <GhostState lines={2} message="A heti rended itt jelenik majd meg." />
        </div>
      </>
    )
  }

  // Combine gym schedule + volleyball sessions into a unified weekly map.
  const gymTimes = gymSchedule?.weeklyTimes ?? []
  const vbSessions = sport.schedule?.volleyball.sessions ?? []
  const agenda: WeeklyAgendaDay[] = DAY_ORDER.map((d) => {
    const g = gymTimes.find((x) => x.day === d)
    const v = vbSessions.find((x) => x.day === d)
    return {
      day: d,
      gym: g && g.active ? g : null,
      volleyball: v ?? null,
      isToday: Boolean(g?.today || v?.today),
    }
  })

  const today = agenda.find((a) => a.isToday)
  const todayHasGym = today?.gym ?? null
  const todayHasVb = today?.volleyball ?? null
  const sessionCount = agenda.filter((a) => a.gym || a.volleyball).length

  // Active meso phase for the current week (Week 3 ⇒ MAV).
  const currentPhase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const openSession = () => navigate('/train/session')

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Train · Mai</Eyebrow>
          <PageTitle>Edzés</PageTitle>
        </div>
        <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
          {today ? DAY_LABELS[today.day] : ''} · W{activeMeso.currentWeek}
        </span>
      </div>

      {/* Today's main gym block — needs both the agenda slot and the /today workout */}
      {todayHasGym && workout && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card notch-12" style={{ padding: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="col">
                <span className="eyebrow brand">Week {activeMeso.currentWeek} · {currentPhase}</span>
                <div style={{ marginTop: 8 }}>
                  <Display size="lg">{workout.title}</Display>
                </div>
                {(todayHasGym.time || todayHasGym.duration) && (
                  <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                    {[todayHasGym.time, todayHasGym.duration ? `${todayHasGym.duration}p` : null]
                      .filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <span className="chip brand notch-4" style={{ fontSize: 9 }}>MA</span>
            </div>
            <div className="row gap-sm mt-md">
              <span className="chip notch-4">{workout.exercises.length} gyakorlat</span>
              <span className="chip notch-4">{workout.exercises.reduce((acc, e) => acc + e.sets, 0)} szet</span>
              {workout.durationEst > 0 && <span className="chip notch-4">~{workout.durationEst}p</span>}
            </div>
            <CtaPrimary className="mt-md" onClick={openSession}>
              <span>Indítsuk</span>
              <span style={{ opacity: 0.5, fontWeight: 400 }}>·</span>
              <span>{workout.title}</span>
            </CtaPrimary>
          </div>
        </div>
      )}

      {/* Rest day (real mode): no gym slot and no volleyball today */}
      {!todayHasGym && !todayHasVb && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card notch-12" style={{ padding: 18 }}>
            <span className="eyebrow">Ma pihenőnap</span>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Nincs tervezett edzés mára — a heti rended lent találod.
            </p>
          </div>
        </div>
      )}

      {/* Today's volleyball block (only if a volleyball session is today) */}
      {todayHasVb && (
        <div style={{ padding: '0 24px 12px' }}>
          <div
            className="card notch-12"
            style={{
              padding: 16,
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--cat-tendency) 6%, transparent) 0%, var(--surface-1) 100%)',
              borderColor: 'color-mix(in srgb, var(--cat-tendency) 30%, transparent)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--cat-tendency)' }} />
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 6 }}>
              <div className="col">
                <span className="eyebrow" style={{ color: 'var(--cat-tendency)' }}>Sport · ma</span>
                <div style={{ marginTop: 6 }}>
                  <Display size="md">Volleyball · {todayHasVb.time}</Display>
                </div>
                <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                  {[todayHasVb.court, `${todayHasVb.duration}p`, todayHasVb.role].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span
                className="chip notch-4"
                style={{ fontSize: 9, color: 'var(--cat-tendency)', borderColor: 'color-mix(in srgb, var(--cat-tendency) 40%, transparent)' }}
              >
                MA
              </span>
            </div>
            <CtaGhost
              className="notch-4 mt-md"
              onClick={() => setVbLogOpen(true)}
              style={{ borderColor: 'color-mix(in srgb, var(--cat-tendency) 40%, transparent)', color: 'var(--cat-tendency)' }}
            >
              <Icon name="plus" size={12} /> Logold a session-t
            </CtaGhost>
          </div>
        </div>
      )}

      {/* Weekly combined timeline */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow">Heti terv · gym + sport</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{sessionCount} session</span>
        </div>
        <div className="col gap-sm">
          {agenda.map((a) => (
            <WeeklyDayRow
              key={a.day}
              agenda={a}
              onStartGym={openSession}
              onLogVolleyball={() => setVbLogOpen(true)}
            />
          ))}
        </div>
      </div>

      {/* Note */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="card notch-4" style={{ padding: 12, background: 'rgba(94, 234, 212, 0.03)' }}>
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={12} color="var(--brand-glow)" />
            <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', flex: 1 }}>
              A gym a mesociklus szerint, a volleyball recurring · független. A két ütemterv együtt-mozgatja a
              pacing-et, alvás-onsetet és a vacsora-időt.
            </p>
          </div>
        </div>
      </div>

      {vbLogOpen && <SportLogSheet onClose={() => setVbLogOpen(false)} onSave={logSportSession} />}
    </>
  )
}
