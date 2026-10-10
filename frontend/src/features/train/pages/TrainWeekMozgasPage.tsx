// ============================================================
// Mezo · TrainWeekMozgasPage („Minden mozgásod") — Terhelés subpage, Folyadék face
// (mezo-n4wf5.3, slice F3). Prototype: docs/design_2.0/prototypes/vilagos/edzes.js `mozgas()`
// (route `#w-edzes-mozgas`, args `nulla` / `kcal-nincs` / `rend-nincs` / `ures` / `tolt`),
// sheet `info` (args `becsles`, `olvasd`).
//
// What has moved SO FAR this week, gym and sport drawn side by side — two tubes on one
// scale — but NEVER mixed into one kcal number (`movementWeek`, loadWeek.ts): the gym side
// is an ESTIMATE (minutes from `estimateSessionMinutes`, kcal from trainDayEnergy's
// net-of-rest math — the activityEnergy mirror, mezo-32m82 — which needs a BMR or a weight
// on file for the rest energy) over DONE days only, the sport side is what was actually
// LOGGED this week (volleyball sessions + run logs, real minutes). The sport side's kcal
// comes off the wire (SportSessionResponse/RunSessionLogResponse both carry a BE-owned
// estimate, or the athlete's own override) — the FE never re-derives it. `movementWeek`'s
// all-or-null gate stays honest: the sum only shows once EVERY sport/run entry logged this
// week carries a kcal; a single old session without one hides the whole sum rather than
// under-reporting it. A side without a known kcal says the honest sentence under its tube,
// never a fabricated number.
//
// Both sides are the same tense: gymBlocks only covers days the week has ALREADY DONE
// (weekLog.details' dayLabel), so the hero's minutes are "eddig a héten" (so far this week),
// never plan + log mixed.
// ============================================================
import { useTrain, useRunning, useWeekMuscleLog, useGoal, useTimingProfile } from '@/data/hooks'
import type { Icon3DName } from '@/shared/ui/clay'
import {
  Acts, Card, DropsMeter, FrameBack, Hero, LevelMarks, Note, Page, Row, Section, St, Tubes, Txt, useFrameTitle,
} from '@/shared/ui/folyadek'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { InfoButton } from '@/features/train/components/InfoButton'
import { weekZoneRows } from '@/features/train/logic/weekZone'
import { weekDateIso } from '@/features/train/logic/weekAgenda'
import { loadGroups, movementWeek } from '@/features/train/logic/loadWeek'
import { deepRegion, sharePct } from '@/features/train/logic/loadLiquid'
import { sportLoadForWeek, type SportLoadKind } from '@/features/train/logic/sportMuscleLoad'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { budgetGroup } from '@/features/train/logic/setBudget'
import { SPORT_LABELS } from '@/features/train/logic/sportKinds'
import { DAY_LABELS } from '@/data/train/train'
import type { Block } from '@/features/train/logic/trainDayEnergy'
import { restKcalPerHour } from '@/data/train/activityEnergy'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import TrainWeekSkeleton, { TerhelesNoPlan } from '@/features/train/pages/TrainWeekSkeleton'

/** The glyph and the short name of a sport/run event of the weekly order. */
const EVENT_ICON: Record<SportLoadKind, Icon3DName> = {
  volleyball: 't-volley', cross: 't-crossfit', trx: 't-trx', 'run-steady': 't-run', 'run-sprint': 't-run',
}
const EVENT_TAG: Record<SportLoadKind, string> = {
  volleyball: SPORT_LABELS.volleyball, cross: SPORT_LABELS.cross, trx: SPORT_LABELS.trx, 'run-steady': 'Futás', 'run-sprint': 'Futás',
}

/** The two tubes share one scale: 200 minutes fills a tube, a bigger week stretches it. */
const TUBE_FULL_MIN = 200

export function TrainWeekMozgasPage() {
  const { sport, activeMeso, workoutPending } = useTrain()
  const { activeRunningBlock, runningPending, runSessions: loggedRunSessions } = useRunning()
  const weekLog = useWeekMuscleLog()
  const { goal, goalResponse } = useGoal()
  const { data: timingProfile } = useTimingProfile()
  useFrameTitle({ title: 'Minden mozgásod', eyebrow: 'Terhelés' })

  const back = <FrameBack history fallback="/train/week" label="Vissza: Terhelés" className="et-back">‹ Terhelés</FrameBack>

  if (workoutPending || runningPending || weekLog.pending) {
    return <TrainWeekSkeleton blocks={[330, 260, 300]} />
  }

  if (!activeMeso) {
    return <TerhelesNoPlan label="Minden mozgásod" verdict="Minden mozgásod itt jelenik majd meg." back={back} />
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
  const restPerHour = restKcalPerHour(goalResponse?.tdeeBootstrap?.bmr, weightKg || null)
  const move = movementWeek(gymBlocks, sportEntries, restPerHour)

  const full = Math.max(TUBE_FULL_MIN, move.gymMin, move.sportMin)
  const gymFact = move.gymMin === 0
    ? 'még nincs lezárt edzésnap ezen a héten'
    : move.gymKcal !== null ? 'becslés a szettjeidből' : 'nincs elég adat a kalóriához — adj meg testsúlyt'
  const sportFact = move.sportMin === 0
    ? 'nincs naplózott sport ezen a héten'
    : move.sportKcal !== null ? 'naplóztad' : 'naplóztad — a kalóriáját még nem tudjuk becsülni'

  return (
    <Page className="et-page">
      {back}
      <Hero
        label="Minden mozgásod eddig a héten"
        verdict={move.totalMin > 0
          ? `${move.totalMin} perc mozgás van mögötted ezen a héten.`
          : 'Ezen a héten még nincs lezárt mozgásod.'}
        sub="A terem és a sport együtt, eddig a héten — a kettő máshogy számít, ezért külön is mutatjuk."
        actions={(
          <InfoButton
            link
            eyebrow="Minden mozgásod"
            title="Miért becslés?"
            copy="A gym percei a szettjeidből becsültek, a röplabdát te naplóztad. A kalória mindkettőnél becslés a mozgás jellegéből — nem mérés."
          />
        )}
      >
        <Tubes
          className="et-vs"
          height={132}
          aria-label="Terem és sport percei eddig a héten"
          items={[
            {
              label: 'Terem', icon: 't-dumbbell', color: 'var(--dom)', pct: (move.gymMin / full) * 94,
              value: <>{move.gymMin}<u> perc</u></>,
              note: <span data-side="gym">{move.gymKcal !== null ? `~${move.gymKcal} kcal · ` : ''}{gymFact}</span>,
            },
            {
              label: 'Sport', icon: 't-volley', color: 'var(--fo-ok)', pct: (move.sportMin / full) * 94,
              value: <>{move.sportMin}<u> perc</u></>,
              note: <span data-side="sport">{move.sportKcal !== null ? `${move.sportKcal} kcal · ` : ''}{sportFact}</span>,
            },
          ]}
        />
      </Hero>

      <Section n={1} title="Izomcsoportok, sporttal együtt" />
      <Card className="et-groups">
        {groups.map((g) => (
          <Row
            key={g.group}
            className="et-grp"
            data-group={g.group}
            left={<Mchp muscle={g.colorMuscle} sm />}
            title={<>{g.label}{sportyGroups.has(g.group) && <> <St tone="plan">sport is</St></>}</>}
            more={<LevelMarks pct={sharePct(g)} color={deepMuscle(g.colorMuscle)} height={14} />}
            value={<>{g.doneSets} / {g.plannedSets} <small>szett</small></>}
          />
        ))}
        <Acts>
          <InfoButton
            link
            eyebrow="Izomcsoportok, sporttal együtt"
            title="Hogyan olvasd?"
            copy="A sáv a gym szettjeidet mutatja a heti tervhez képest. A „sport is” jel azt jelzi, hogy a sport is dolgoztatta a csoportot — ez becslés, és nem adódik hozzá a szettekhez."
          />
        </Acts>
      </Card>

      <Section n={2} title="Sport és futás a heti rendben" />
      <Card className="et-events">
        {load.events.length === 0 ? (
          <Txt>Nincs tervezett sport/futás esemény ezen a héten.</Txt>
        ) : load.events.map((e, i) => (
          <Row
            key={`${e.kind}-${e.day}-${i}`}
            className="et-event"
            icon={EVENT_ICON[e.kind]}
            title={<><span className="et-event-title">{e.title}</span> <St>{EVENT_TAG[e.kind]}</St></>}
            sub={<span className="et-event-when">{DAY_LABELS[e.day] ?? e.day}{e.time ? ` · ${e.time}` : ''}</span>}
            more={(
              <span className="et-evc">
                {e.regionLoads.map((rl) => (
                  <em key={rl.region}>
                    {rl.label}
                    <DropsMeter n={rl.load} color={deepRegion(rl.region)} label={`${rl.load} / 3 terhelés`} />
                  </em>
                ))}
              </span>
            )}
          />
        ))}
        <Note>
          Becslés, nem mérés. Ha egyetlen sport-alkalomnál hiányzik a kalória, az egész összeget elrejtjük — inkább
          semmit, mint kevesebbet.
        </Note>
      </Card>
    </Page>
  )
}
