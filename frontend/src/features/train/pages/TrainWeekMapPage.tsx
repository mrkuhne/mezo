// ============================================================
// Mezo · TrainWeekMapPage („Izomtérkép") — Terhelés subpage (Train Titanium
// T12 Task 4). Source of truth: docs/design_2.0/prototypes/companion-titanium
// /load-pages.js (`mapScreen`, `mapFigure`) + load.css `.ld-map-page`/`.ld-legend`
// /`.ld-wait`, ported onto the `.ld-` house section (styles/prototype.css).
//
// The doorway from TrainWeekPage lands here with the SAME `doneRows`/`heatRows`
// split it itself reads (loadWeek.ts header note) — this page just draws more of
// it: the full front+back BodyMap, a mode toggle that re-renders the SAME heat
// (never re-derives it from scratch), the untouched-muscle list, and the sport-
// reach note. The mode toggle re-renders heat ONLY:
//   · „Eddig megvolt" — mapWeekHeat(doneRows, heatRows), the Task-3 honesty cut
//     (an 'over' status must come from LOGGED work, never tonight's unlogged plan).
//   · „A heti terv" — mapHeat(heatRows, 'planned'), the plan's own bucket per group.
// The legend speaks WORDS, not a status enum: 'entering' rides, unlabeled,
// between „elkezdted" and „jó úton" (BodyMap.tsx's own OPACITY comment — it is an
// interpolated, transient state, not a fourth named bucket).
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useRunning, useWeekMuscleLog } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { BodyMap, type BodyHeat } from '@/features/train/components/BodyMap'
import { weekZoneRows } from '@/features/train/logic/weekZone'
import { mapHeat, mapWeekHeat, sportReach, untouchedMuscles } from '@/features/train/logic/loadWeek'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import type { RunPrescribedSession } from '@/data/train/runningApi'

type MapMode = 'done' | 'planned'

const LEGEND: Array<{ level: BodyHeat['level']; word: string }> = [
  { level: 'none', word: 'még vár' },
  { level: 'below', word: 'elkezdted' },
  { level: 'in', word: 'jó úton' },
  { level: 'over', word: 'megvan' },
]

function MapSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div style={{ position: 'relative', padding: '58px 24px 20px' }}>
        <Skeleton width={90} height={11} />
        <div style={{ marginTop: 10 }}><Skeleton width={200} height={26} /></div>
        <div style={{ marginTop: 10 }}><Skeleton width="88%" height={12} /></div>
      </div>
      <div style={{ padding: '0 24px 19px' }}>
        <Skeleton width={140} height={30} radius={999} />
        <div style={{ marginTop: 16 }}><Skeleton width="70%" height={220} /></div>
        <div className="col gap-sm" style={{ marginTop: 20 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} style={{ height: 48, borderRadius: 14 }}>
              <Skeleton width="60%" height={12} />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TrainWeekMapPage() {
  const { sport, activeMeso, workoutPending, workout, completedTodayWorkout } = useTrain()
  const { activeRunningBlock, runningPending } = useRunning()
  const weekLog = useWeekMuscleLog()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/week')
  const [mode, setMode] = useState<MapMode>('done')

  if (workoutPending || runningPending || weekLog.pending) return <MapSkeleton />

  if (!activeMeso) {
    return (
      <MozaikPage tone="gold">
        <PageBody>
          <GhostState lines={3} message="Az izomtérkép itt jelenik majd meg — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust" onCta={() => navigate('/train/mesocycles/new')} />
        </PageBody>
      </MozaikPage>
    )
  }

  const days = activeMeso.days ?? []
  const sportSlots = sport.schedule?.volleyball.sessions ?? []
  const runSessions: RunPrescribedSession[] = activeRunningBlock
    ? (activeRunningBlock.structure.weeks[activeRunningBlock.currentWeek - 1]?.sessions ?? [])
    : []

  // Same two row sets TrainWeekPage itself reads (loadWeek.ts header note): `doneRows` is
  // the week as LOGGED, `heatRows` adds tonight's plan so 'entering' is reachable.
  const doneRows = weekZoneRows({ plannedDays: days, completed: weekLog.details })
  const todayPlan = !completedTodayWorkout && workout
    ? workout.exercises.map((e) => ({
      muscle: e.muscle, type: e.type, workingSets: e.workingSets, targetRIR: e.targetRIR,
    }))
    : null
  const heatRows = weekZoneRows({ plannedDays: days, completed: weekLog.details, todayPlan })

  const heat = mode === 'done' ? mapWeekHeat(doneRows, heatRows) : mapHeat(heatRows, 'planned')
  const waiting = untouchedMuscles(doneRows)
  const plannedSets = doneRows.reduce((t, r) => t + r.plannedSets, 0)
  const reach = sportReach(sportLoadForWeek(sportSlots, runSessions))

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        <header className="ld-hero is-slim rise" style={{ '--d': '40ms' } as CSSProperties}>
          <span className="ld-hero-wash" />
          <button type="button" className="mz-backbtn ld-back" onClick={goBack}>‹ Terhelés</button>
          <span className="ld-eyebrow">Izomtérkép</span>
          <p className="ld-hero-say" style={{ fontSize: 17, fontWeight: 400, color: 'var(--text-primary)', marginTop: 8 }}>
            Hol tart a tested?
          </p>
          <p className="ld-hero-say">
            Amit már megmozgattál, erősebben világít — ami még vár, az csak körvonal.
          </p>
        </header>

        {/* `.pl-sub` only re-widths the quiet `.pl-row` doorway below (prototype.css:15215)
            — the prototype's own subpage container carries it for exactly that reason. */}
        <PageBody className="pl-sub">
          <div className="segtabs ld-modes" role="group" aria-label="Nézet">
            <button type="button" className="segtab" aria-pressed={mode === 'done'} onClick={() => setMode('done')}>
              Eddig megvolt
            </button>
            <button type="button" className="segtab" aria-pressed={mode === 'planned'} onClick={() => setMode('planned')}>
              A heti terv
            </button>
          </div>

          <div className="ld-map-stage rise" style={{ '--d': '90ms' } as CSSProperties}>
            <BodyMap heat={heat} views="both" className="ld-map-big" ariaLabel="Elöl és hátul: a heti terhelésed" />
            <div className="ld-map-sides"><span>elölről</span><span>hátulról</span></div>
            {mode === 'done' ? (
              <div className="ld-legend">
                {LEGEND.map((l) => (
                  <span key={l.level} className={`is-${l.level}`}><i />{l.word}</span>
                ))}
              </div>
            ) : (
              <div className="ld-legend">
                <span className="is-planned"><i />minél többet kér a hét, annál erősebb a szín</span>
              </div>
            )}
          </div>

          {plannedSets === 0 ? null : waiting.length > 0 ? (
            <>
              <h3 className="ld-h3">Még munkára vár</h3>
              <div className="ld-wait rise" style={{ '--d': '130ms' } as CSSProperties}>
                {waiting.map((r) => (
                  <span key={r.label} className="ld-wait-row" style={{ '--mus-color': muscleColor(r.colorMuscle).rail } as CSSProperties}>
                    <strong>{r.label}</strong>
                    <small>{r.plannedSets} szett vár a héten</small>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="ld-wait-done rise" style={{ '--d': '130ms' } as CSSProperties}>
              Minden izomcsoportod sorra került ezen a héten.
            </p>
          )}

          {reach.length > 0 && (
            <p className="ld-sport-note rise" style={{ '--d': '150ms' } as CSSProperties}>
              <ClayIcon name="i-sport" size={20} />
              <span>
                A sport ezeket is dolgoztatta: {reach.join(', ')}.
                <em>Becslés, nem mérés — a szettszámokba nem számít bele.</em>
              </span>
            </p>
          )}

          {/* The doorway to „Minden izomjel" — the prototype's own quiet row at the foot of
              `mapScreen()` (load-pages.js:140-141), BELOW the sport footnote (line 139 runs
              first). Copy verbatim (parity P2 Task 1, matrix §13). */}
          <button
            type="button"
            className="pl-row is-quiet rise"
            style={{ '--d': '160ms' } as CSSProperties}
            onClick={() => navigate('/train/week/jelek')}
          >
            <span>
              <strong>Minden izomjel</strong>
              <small>A 21 izom, saját jellel, régiónként</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
