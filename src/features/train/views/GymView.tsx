// ============================================================
// Mezo · GymView (GYM) — mesocycle week-by-week gym breakdown.
// Viewable per day; today's day is startable. Thin TrainScreen shell
// ⇒ this view owns its own .page-header.
// Ported from prototype train-views.jsx (GymView + sub-components).
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import type { MesoDay } from '@/data/types'
import { GymStat } from '../components/GymStat'
import { PhaseDots } from '../components/PhaseDots'
import { GymDayCard } from '../components/GymDayCard'
import { GymDaySheet } from '../components/GymDaySheet'

export function GymView() {
  const { activeMeso } = useTrain()
  const [openDay, setOpenDay] = useState<MesoDay | null>(null)

  const days = activeMeso.days ?? []
  const gymDays = days.filter((d) => d.exerciseCount > 0)
  const totalSets = gymDays.reduce((acc, d) => acc + d.exercises.reduce((b, e) => b + e.sets, 0), 0)

  // Current phase for the active week (Week 3 ⇒ phaseCurve[2] ⇒ MAV).
  const currentPhase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const [splitHead, splitTail] = activeMeso.split.split(' · ')

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Train · GYM</Eyebrow>
          <PageTitle>{activeMeso.shortTitle}</PageTitle>
        </div>
        <span className="label-mono brand" style={{ fontSize: 9 }}>
          W{activeMeso.currentWeek} / {activeMeso.weeks}
        </span>
      </div>

      {/* Meso meta */}
      <div style={{ padding: '0 24px 12px' }}>
        <div className="card notch-12" style={{ padding: 16 }}>
          <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
            <GymStat label="Fázis" val={currentPhase} sub={`hét ${activeMeso.currentWeek}`} color="var(--brand-glow)" />
            <GymStat label="Split" val={splitHead} sub={splitTail ?? ''} color="var(--text-primary)" />
            <GymStat label="Szetek" val={totalSets} sub="heti összesen" color="var(--cat-physiology)" />
            <GymStat label="Gym napok" val={gymDays.length} sub="hét" color="var(--cat-preference)" />
          </div>
          <div
            className="row gap-md mt-md"
            style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', alignItems: 'center' }}
          >
            <Icon name="train" size={11} color="var(--brand-glow)" />
            <span className="label-mono text-tertiary" style={{ fontSize: 10, flex: 1 }}>
              {activeMeso.startDate} → {activeMeso.endDate} · {activeMeso.style}
            </span>
            <PhaseDots phases={activeMeso.phaseCurve} current={activeMeso.currentWeek - 1} />
          </div>
        </div>
      </div>

      {/* Day-by-day */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="eyebrow">Heti split</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>tap → részletek</span>
        </div>
        <div className="col gap-sm">
          {days.map((d) => (
            <GymDayCard key={d.day} day={d} onOpen={() => setOpenDay(d)} />
          ))}
        </div>
      </div>

      {openDay && <GymDaySheet day={openDay} onClose={() => setOpenDay(null)} />}
    </>
  )
}
