// ============================================================
// Mezo · TrainWeekMozgasPage („Minden mozgásod") — Terhelés subpage (Train
// Titanium T12 Task 4). Source of truth: docs/design_2.0/prototypes/companion-
// titanium/load-pages.js (`movementScreen`) + load.css `.ld-move-*`, ported
// onto the `.ld-` house section (styles/prototype.css).
//
// The week's WHOLE movement, gym and sport drawn side by side but NEVER
// mixed into one number (`movementWeek`, loadWeek.ts): the gym side is an
// ESTIMATE (minutes from `estimateSessionMinutes` off the week's own plan,
// kcal from trainDayEnergy's MET math — both need a weight on file), the
// sport side is what was actually LOGGED this week (volleyball sessions +
// run logs, real minutes) with a kcal the app has no source for yet — so it
// stays honestly unknown rather than borrowing the gym side's MET formula.
// `known:false` on either side renders the honest sentence, never a
// fabricated number (the same rule trainDayEnergy's own callers follow).
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useRunning, useWeekMuscleLog, useGoal, useTimingProfile } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { weekZoneRows } from '@/features/train/logic/weekZone'
import { weekDateIso } from '@/features/train/logic/weekAgenda'
import { loadGroups, movementWeek } from '@/features/train/logic/loadWeek'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { budgetGroup } from '@/features/train/logic/setBudget'
import { muscleColor } from '@/features/train/logic/muscleColors'
import type { Block } from '@/features/train/logic/trainDayEnergy'
import type { RunPrescribedSession } from '@/data/train/runningApi'

/** done / planned as a bar width — never fabricated: no plan and no work is a 0% bar. */
function shareOf(row: { doneSets: number; plannedSets: number }): number {
  if (row.plannedSets > 0) return Math.round(Math.min(1, row.doneSets / row.plannedSets) * 100)
  return row.doneSets > 0 ? 100 : 0
}

function MozgasSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div style={{ position: 'relative', padding: '58px 24px 20px' }}>
        <Skeleton width={110} height={11} />
        <div style={{ marginTop: 10 }}><Skeleton width={140} height={38} /></div>
        <div style={{ marginTop: 10 }}><Skeleton width="88%" height={12} /></div>
      </div>
      <div style={{ padding: '0 24px 19px' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Skeleton width="50%" height={92} radius={18} />
          <Skeleton width="50%" height={92} radius={18} />
        </div>
        <div className="col gap-sm" style={{ marginTop: 20 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} style={{ height: 66, borderRadius: 18 }}>
              <Skeleton width="50%" height={12} />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TrainWeekMozgasPage() {
  const { sport, activeMeso, workoutPending } = useTrain()
  const { activeRunningBlock, runningPending, runSessions: loggedRunSessions } = useRunning()
  const weekLog = useWeekMuscleLog()
  const { goal, goalResponse, pending: goalPending } = useGoal()
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/week')

  if (workoutPending || runningPending || weekLog.pending || goalPending || timingProfilePending) {
    return <MozgasSkeleton />
  }

  if (!activeMeso) {
    return (
      <MozaikPage tone="gold">
        <PageBody>
          <GhostState lines={3} message="Minden mozgásod itt jelenik majd meg — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust" onCta={() => navigate('/train/mesocycles/new')} />
        </PageBody>
      </MozaikPage>
    )
  }

  const days = activeMeso.days ?? []
  const sportSlots = sport.schedule?.volleyball.sessions ?? []
  const plannedRunSessions: RunPrescribedSession[] = activeRunningBlock
    ? (activeRunningBlock.structure.weeks[activeRunningBlock.currentWeek - 1]?.sessions ?? [])
    : []

  const doneRows = weekZoneRows({ plannedDays: days, completed: weekLog.details })
  const groups = loadGroups(doneRows)

  // Which groups the week's sport/run TABLE reaches at all — the same estimate
  // TrainWeekPage's own sport card and the map's reach note read, at group
  // granularity (a "sport is" chip on the whole group, not per muscle head).
  const load = sportLoadForWeek(sportSlots, plannedRunSessions)
  const sportyGroups = new Set(
    Object.keys(load.perMuscle).map((m) => budgetGroup(m)).filter((g): g is string => g !== null),
  )

  // Gym side: an ESTIMATE off the week's own plan — one block per day that carries
  // exercises, timed the same way the prep/MesoEditor screens time a session.
  const gymBlocks: Block[] = days
    .filter((d) => d.exercises.length > 0)
    .map((d) => ({ kind: 'gym', minutes: estimateSessionMinutes(d.exercises, timingProfile ?? undefined), done: false }))

  // Sport side: what was actually LOGGED this Mon–Sun week — real minutes, no kcal
  // source yet (neither volleyball nor a run log carries one), so it stays honestly
  // unknown rather than borrowing the gym side's MET formula.
  const weekStart = weekDateIso(0)
  const weekEnd = weekDateIso(6)
  const loggedSport = sport.sessions.filter((s) => s.isoDate >= weekStart && s.isoDate <= weekEnd)
  const loggedRuns = loggedRunSessions.filter((r) => r.date >= weekStart && r.date <= weekEnd)
  const sportEntries = [
    ...loggedSport.map((s) => ({ minutes: s.duration, kcal: null as number | null })),
    ...loggedRuns.map((r) => ({ minutes: r.durationMin ?? 0, kcal: null as number | null })),
  ]

  const weightKg = goal?.currentWeight ?? goalResponse?.startWeightKg ?? 0
  const move = movementWeek(gymBlocks, sportEntries, weightKg || null)

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        <header className="ld-hero is-slim rise" style={{ '--d': '40ms', '--ld-accent': 'var(--tag-sport)' } as CSSProperties}>
          <span className="ld-hero-wash" />
          <button type="button" className="mz-backbtn ld-back" onClick={goBack}>‹ Terhelés</button>
          <span className="ld-eyebrow">Minden mozgásod</span>
          <div className="ld-hero-pct"><b>{move.totalMin}</b><em>perc</em></div>
          <p className="ld-hero-say">
            Gym és sport együtt — a kettő máshogy számít, ezért külön is mutatjuk.
          </p>
        </header>

        <PageBody>
          <div className="ld-move-split rise" style={{ '--d': '90ms' } as CSSProperties}>
            <div className="ld-move-box" style={{ '--mus-color': 'var(--tag-gym)' } as CSSProperties}>
              <ClayIcon name="i-edzes" size={26} />
              <strong>{move.gymMin} perc</strong>
              <small>gym{move.gymKcal !== null ? ` · ~${move.gymKcal} kcal` : ''}</small>
              <em>{move.gymKcal !== null ? 'becslés a szettjeidből' : 'nincs elég adat a kalóriához — adj meg testsúlyt'}</em>
            </div>
            <div className="ld-move-box" style={{ '--mus-color': 'var(--tag-sport)' } as CSSProperties}>
              <ClayIcon name="i-sport" size={26} />
              <strong>{move.sportMin} perc</strong>
              <small>sport{move.sportKcal !== null ? ` · ${move.sportKcal} kcal` : ''}</small>
              <em>{move.sportKcal !== null ? 'naplóztad' : 'naplóztad — a kalóriáját még nem tudjuk becsülni'}</em>
            </div>
          </div>

          <h3 className="ld-h3">Izomcsoportok, sporttal együtt</h3>
          <div className="ld-groups">
            {groups.map((g, i) => (
              <div
                key={g.group}
                className="ld-group is-flat rise"
                style={{ '--mus-color': muscleColor(g.colorMuscle).rail, '--d': `${120 + i * 40}ms` } as CSSProperties}
              >
                <span className="ld-group-head">
                  <strong>{g.label}</strong>
                  {sportyGroups.has(g.group) && (
                    <span className="ld-sport-chip"><ClayIcon name="i-sport" size={12} />sport is</span>
                  )}
                  <b>{g.doneSets} / {g.plannedSets} <small>szett</small></b>
                </span>
                <span className="ld-group-bar">
                  <i style={{ '--w': `${shareOf(g)}%` } as CSSProperties} />
                </span>
              </div>
            ))}
          </div>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
