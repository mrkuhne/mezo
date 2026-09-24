// ============================================================
// Mezo · TrainWeekMozgasPage („Minden mozgásod") — Terhelés subpage (Train
// Titanium T12 Task 4). Source of truth: docs/design_2.0/prototypes/companion-
// titanium/load-pages.js (`movementScreen`) + load.css `.ld-move-*`, ported
// onto the `.ld-` house section (styles/prototype.css).
//
// What has moved SO FAR this week, gym and sport drawn side by side but NEVER
// mixed into one number (`movementWeek`, loadWeek.ts): the gym side is an
// ESTIMATE (minutes from `estimateSessionMinutes`, kcal from trainDayEnergy's
// MET math — both need a weight on file) over DONE days only, the sport side
// is what was actually LOGGED this week (volleyball sessions + run logs, real
// minutes). The sport side's kcal now comes off the wire (T8 Task 6):
// SportSessionResponse/RunSessionLogResponse both carry a BE-owned estimate
// (or the athlete's own override, sport only) — the FE never re-derives it.
// `movementWeek`'s all-or-null gate still stays honest: the sum only shows
// once EVERY sport/run entry logged this week carries a kcal; a single old
// session without one (logged before this wiring, or a weight-less athlete)
// hides the whole sum rather than under-reporting it.
// `known:false` on either side renders the honest sentence, never a
// fabricated number (the same rule trainDayEnergy's own callers follow).
//
// Fix round 2 (mezo-88iwa.13 review): the hero used to sum the WHOLE-WEEK
// gym PLAN (every day with exercises, done or not) against logged-only sport
// — an apples-to-oranges total ("460 perc" = 370 planned + 90 logged) that
// read as "this week's total" while actually being plan+log. gymBlocks now
// only covers days the week has ALREADY DONE (weekLog.details' dayLabel,
// mirroring the approved prototype's `movementWeek` over `log.doneDays` —
// load-state.js), so both sides are the same tense: "eddig a héten" (so far
// this week), never "this week" as a whole.
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
import { InfoButton } from '@/features/train/components/InfoButton'
import { weekZoneRows } from '@/features/train/logic/weekZone'
import { weekDateIso } from '@/features/train/logic/weekAgenda'
import { loadGroups, movementWeek } from '@/features/train/logic/loadWeek'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { budgetGroup } from '@/features/train/logic/setBudget'
import { muscleColor, regionColor } from '@/features/train/logic/muscleColors'
import { DAY_LABELS } from '@/data/train/train'
import type { Block } from '@/features/train/logic/trainDayEnergy'
import type { RunPrescribedSession } from '@/data/train/runningApi'

const tri = (n: number) => '▲'.repeat(n)

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
  const { goal, goalResponse } = useGoal()
  const { data: timingProfile } = useTimingProfile()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/week')

  if (workoutPending || runningPending || weekLog.pending) {
    return <MozgasSkeleton />
  }

  if (!activeMeso) {
    return (
      <MozaikPage tone="gold">
        <PageBody className="tw-move">
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

  // Gym side: an ESTIMATE, but only over days ALREADY DONE this week — never the
  // whole-week plan (fix round 2, mezo-88iwa.13 review: the hero previously mixed the
  // WHOLE-WEEK gym plan with logged-only sport, e.g. "460 perc" = 370 planned + 90
  // logged, an apples-to-oranges total). The approved prototype's own movementWeek
  // (load-state.js) sums `log.doneDays` only — mirrored here via `weekLog.details`
  // (WorkoutDetailResponse[], already in scope for `doneRows` above), whose
  // `dayLabel` ('Hét'..'Vas') is the same token MesoDay.day carries.
  const doneDayLabels = new Set(weekLog.details.map((w) => w.dayLabel))
  const gymBlocks: Block[] = days
    .filter((d) => d.exercises.length > 0 && doneDayLabels.has(d.day))
    .map((d) => ({ kind: 'gym', minutes: estimateSessionMinutes(d.exercises, timingProfile ?? undefined), done: true }))

  // Sport side: what was actually LOGGED this Mon–Sun week — real minutes, and now a
  // kcal the wire actually carries (T8 Task 6): SportSessionResponse's kcal is the
  // BE-owned estimate/override, RunSessionLogResponse's kcal is the same estimator via
  // the run service. movementWeek's all-or-null gate (loadWeek.ts) is the display guard
  // that still stays honest — old sessions logged before this wiring carry NULL, so the
  // sum only lights up once EVERY session in the week has a kcal, self-healing as weeks
  // roll (never a partial/fabricated total).
  const weekStart = weekDateIso(0)
  const weekEnd = weekDateIso(6)
  const loggedSport = sport.sessions.filter((s) => s.isoDate >= weekStart && s.isoDate <= weekEnd)
  const loggedRuns = loggedRunSessions.filter((r) => r.date >= weekStart && r.date <= weekEnd)
  const sportEntries = [
    ...loggedSport.map((s) => ({ minutes: s.duration, kcal: s.kcal ?? null })),
    ...loggedRuns.map((r) => ({ minutes: r.durationMin ?? 0, kcal: r.kcal ?? null })),
  ]

  const weightKg = goal?.currentWeight ?? goalResponse?.startWeightKg ?? 0
  const move = movementWeek(gymBlocks, sportEntries, weightKg || null)

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        <header className="ld-hero is-slim rise" style={{ '--d': '40ms', '--ld-accent': 'var(--tag-sport)' } as CSSProperties}>
          <span className="ld-hero-wash" />
          <button type="button" className="mz-backbtn ld-back" onClick={goBack}>‹ Terhelés</button>
          <span className="ld-eyebrow">Minden mozgásod eddig a héten</span>
          <div className="ld-hero-pct"><b>{move.totalMin}</b><em>perc</em></div>
          <p className="ld-hero-say">
            Gym és sport együtt, eddig a héten — a kettő máshogy számít, ezért külön is mutatjuk.{' '}
            <InfoButton
              title="Miért becslés?"
              copy="A gym percei a szettjeidből becsültek, a röplabdát te naplóztad. A kalória mindkettőnél becslés a mozgás jellegéből — nem mérés."
            />
          </p>
        </header>

        <PageBody className="tw-move">
          <div className="ld-move-split rise" style={{ '--d': '90ms' } as CSSProperties}>
            <div className="ld-move-box" style={{ '--mus-color': 'var(--tag-gym)' } as CSSProperties}>
              <ClayIcon name="i-edzes" size={26} />
              <strong>{move.gymMin} perc</strong>
              <small>gym{move.gymKcal !== null ? ` · ~${move.gymKcal} kcal` : ''}</small>
              <em>
                {move.gymMin === 0
                  ? 'még nincs lezárt edzésnap ezen a héten'
                  : move.gymKcal !== null ? 'becslés a szettjeidből' : 'nincs elég adat a kalóriához — adj meg testsúlyt'}
              </em>
            </div>
            <div className="ld-move-box" style={{ '--mus-color': 'var(--tag-sport)' } as CSSProperties}>
              <ClayIcon name="i-sport" size={26} />
              <strong>{move.sportMin} perc</strong>
              <small>sport{move.sportKcal !== null ? ` · ${move.sportKcal} kcal` : ''}</small>
              <em>
                {move.sportMin === 0
                  ? 'nincs naplózott sport ezen a héten'
                  : move.sportKcal !== null ? 'naplóztad' : 'naplóztad — a kalóriáját még nem tudjuk becsülni'}
              </em>
            </div>
          </div>

          <h3 className="ld-h3">
            Izomcsoportok, sporttal együtt
            <InfoButton
              title="Hogyan olvasd?"
              copy="A sáv a gym szettjeidet mutatja a heti tervhez képest. A kék jel azt jelzi, hogy a sport is dolgoztatta a csoportot — ez becslés, és nem adódik hozzá a szettekhez."
            />
          </h3>
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

          <h3 className="ld-h3">Sport és futás a heti rendben</h3>
          {load.events.length === 0 ? (
            <p className="ld-events-empty rise" style={{ '--d': '160ms' } as CSSProperties}>
              Nincs tervezett sport/futás esemény ezen a héten.
            </p>
          ) : (
            <div className="ld-events rise" style={{ '--d': '160ms' } as CSSProperties}>
              {load.events.map((e, i) => (
                <div key={`${e.kind}-${e.day}-${i}`} className="ld-event">
                  <span className="ld-event-head">
                    <span className="ld-event-tag" style={{ '--mus-color': e.tag === 'FUTÁS' ? 'var(--tag-run)' : 'var(--tag-sport)' } as CSSProperties}>
                      {e.tag}
                    </span>
                    <strong className="ld-event-title">{e.title}</strong>
                    <span className="ld-event-when">{DAY_LABELS[e.day] ?? e.day}{e.time ? ` · ${e.time}` : ''}</span>
                  </span>
                  <span className="ld-event-chips">
                    {e.regionLoads.map((rl) => {
                      const fam = regionColor(rl.region)
                      return (
                        <span key={rl.region} className="ld-event-chip" style={{ background: fam.wash, color: fam.deep }}>
                          {rl.label} {tri(rl.load)}
                        </span>
                      )
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="ld-events-note">Becslés, nem mérés.</p>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
