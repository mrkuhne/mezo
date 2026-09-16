// ============================================================
// Mezo · TrainTodayPage (Mai) — a one-day view (mezo-9bbc).
// A DayStrip navigator over the Mon–Sun agenda picks which day's sessions
// render below it (default: today; `?day={0..6}` — the Heti drill-in — names
// another day). The URL is the single source of truth for that selection, so
// a reload, a back/forward step and the `Mai` sub-nav entry all agree with what
// the page renders. The weekly list + load tiles + provenance note now
// live on TrainWeekPage (/train/week, "Heti").
// Titanium face (mezo-88iwa.6, T5): the today-gym hero is the `.tr-day` poster —
// status pill (BETERVEZVE/FOLYAMATBAN/KÉSZ), the session title, the meso sub-line, a
// muscle constellation, the chip row and the in-poster three-state CTA — with the
// energy card and the muscle-impact card below it, and the „Vagy inkább” `.tr-alt`
// pair after those two. The legacy `.page-header` (Eyebrow + „Mai nap”
// h1 + „← Ma”) is GONE: the poster names the session and the DayStrip names the day, so
// the strip is the page's first element. Today's own chip took over „← Ma”'s job — it
// CLEARS `?day=` instead of pinning today's index (see `selectDay`).
// ============================================================
import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useQueryClient } from '@tanstack/react-query'
import { useTrain, useRunning, useWeekWorkouts, useSleepGoal, useTimingProfile, useGoal } from '@/data/hooks'
import { isMockMode } from '@/data/_client/mode'
import { MorningTrainingCard } from '@/features/train/components/MorningTrainingCard'
import {
  isSnoozed,
  morningWindow,
  offendingSlots,
  rescheduledSlots,
  snooze,
  snoozeHash,
} from '@/features/train/logic/morningWindow'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { DAY_ORDER } from '@/data/train/train'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { CtaGhost } from '@/shared/ui/Cta'
import { GhostState } from '@/shared/ui/GhostState'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { RunLogSheet } from '@/features/train/sheets/RunLogSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { DayStrip } from '@/features/train/components/DayStrip'
import { TodaySessionCard } from '@/features/train/components/TodaySessionCard'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { daySessions } from '@/features/train/logic/agenda'
import { dayImpact, regionRepresentativeToken, type DayImpactRow } from '@/features/train/logic/dayImpact'
import { trainDayEnergy, type Block } from '@/features/train/logic/trainDayEnergy'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { regionColor, type RegionKey } from '@/features/train/logic/muscleColors'
import { dayStripItems } from '@/features/train/logic/dayStripItems'
import { buildWeekAgenda } from '@/features/train/logic/weekAgenda'
import { gymDayTarget } from '@/features/train/logic/gymDayTarget'
import TrainTodaySkeleton from '@/features/train/pages/TrainTodaySkeleton'
import { SPORT_TONE, sportOf, SPORT_TAGS, SPORT_TITLES, type SportKind } from '@/features/train/logic/sportKinds'
import { SESSION_STATE_LABEL, sessionState } from '@/features/train/logic/sessionState'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'

type RunLogCtx = { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }

export function TrainTodayPage() {
  const { workout, gymSchedule, sport, activeMeso, logSportSession, gymDoneDates, workoutPending, todaySession, completedTodayWorkout, gymSlots, saveGymSchedule, sportSlotSkips } = useTrain()
  const { activeRunningBlock, runSessions, logRunSession, runningPending } = useRunning()
  // Completed workout summaries for this Mon–Sun week — maps each done day's ISO
  // date to its instance id so a weekly gym row can open the review (real mode).
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const navigate = useNavigate()
  const { showLevelUp } = useLevelUp()
  const [sportLogSport, setSportLogSport] = useState<SportKind | null>(null)
  const [runLogCtx, setRunLogCtx] = useState<RunLogCtx | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const { goal: sleepGoal } = useSleepGoal()
  // Calibrated pacing (Task 12, mezo-dzbm): only the today chip's workoutMinutes reads this —
  // structureLint/peakWeekFit/programFit/prepBriefing deliberately stay on the static estimate.
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()
  // Same weight source `deriveDailyBudget` reads for Fuel's calorie budget
  // (`frontend/src/data/fuel/timelineHooks.ts:92-110`) — Mai's energy card must never
  // drift from the number Fuel already shows for the day (Task 5, mezo-88iwa.6).
  const { goal, goalResponse } = useGoal()
  const qc = useQueryClient()
  // Morning-training reschedule (mezo-67rb): wake-anchored window over the raw gym slots.
  const mtrWindow = morningWindow(sleepGoal.wakeTime)
  const mtrOffending = offendingSlots(gymSlots, mtrWindow)
  const mtrHash = snoozeHash(sleepGoal.wakeTime, mtrOffending)
  const [mtrSnoozed, setMtrSnoozed] = useState(false)
  useEffect(() => setMtrSnoozed(false), [mtrHash])
  const showMtr = mtrOffending.length > 0 && !mtrSnoozed && !isSnoozed(mtrHash)
  const applyMtr = () => {
    const moved = rescheduledSlots(gymSlots, mtrWindow)
    saveGymSchedule(moved)
    if (isMockMode()) qc.setQueryData(['train', 'gymSchedule'], moved) // mock parity: the mock mutation no-ops
  }
  const snoozeMtr = () => {
    snooze(mtrHash)
    setMtrSnoozed(true)
  }
  const [params, setSearchParams] = useSearchParams()
  // Mai always opens on today; `?day={0..6}` (the Heti drill-in, or a chip tap) names
  // another day. The selection is DERIVED from the URL — never mirrored into state —
  // so a reload, a back step and the `Mai` sub-nav entry (which drops the param
  // without remounting this element) can never disagree with what renders.
  // `params.get('day')` is `null` when absent — NOT coerced through `Number()` first
  // (`Number(null) === 0`, which would silently pin every plain `/train` visit to
  // Monday instead of today).
  // `''` coerces the same way (`Number('') === 0`) when the param key is present but
  // empty (e.g. a stray `?day=`), so both absence and blankness must skip `Number()`.
  const rawDay = params.get('day')
  const dayIdx = rawDay === null || rawDay === '' ? NaN : Number(rawDay)
  const selectedDay = Number.isInteger(dayIdx) && dayIdx >= 0 && dayIdx <= 6 ? DAY_ORDER[dayIdx] : null
  // Both writers replace the history entry: day-hopping inside Mai is a view switch,
  // not a navigation step the back button should have to unwind chip by chip.
  const writeDay = (index: number | null) => {
    const next = new URLSearchParams(params)
    if (index === null) next.delete('day')
    else next.set('day', String(index))
    setSearchParams(next, { replace: true })
  }

  // Loading skeleton (real mode): while the meso/today queries (workoutPending) or
  // the running block query are unresolved, render the layout-matched skeleton
  // before the empty-state — placed after all hooks so the hook order is stable.
  if (workoutPending || runningPending) return <TrainTodaySkeleton />

  // T0/T2: without an active meso the whole view ghosts. With one, the agenda
  // derives from the meso (gymSchedule) and /today drives the hero card;
  // volleyball columns stay empty until T3 (sport.schedule is null until then).
  if (!activeMeso) {
    return (
      <>
        <div className="pghead-np">
          <div>
            <div className="over">Edzés</div>
            <h1>Mai nap</h1>
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
        {/* No „Heti terv” ghost here — that whole list lives on the Heti tab now
            (mezo-9bbc); promising a section Mai no longer owns was a leftover. */}
        <div style={{ padding: '0 24px 16px' }}>
          {/* Caption role at 14 (the sentence-case floor), 48dp target — it was a
              10px uppercase strip, below both. */}
          <button type="button" onClick={() => setCustomOpen(true)} className="card" style={{
            width: '100%', minHeight: 48, padding: '12px 16px', background: 'transparent',
            borderStyle: 'dashed', borderColor: 'var(--divider)', color: 'var(--tag-gym)',
            fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="plus" size={14} /> Saját edzés
          </button>
        </div>
        {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      </>
    )
  }

  // Combine gym schedule + volleyball sessions into a unified weekly map. Each row carries
  // its calendar ISO date (this week's Monday + index) so done-state can be matched per day.
  const agenda = buildWeekAgenda({
    gymTimes: gymSchedule?.weeklyTimes ?? [],
    sportSlots: sport.schedule?.volleyball.sessions ?? [],
    runningBlock: activeRunningBlock,
    weekWorkouts,
    skips: sportSlotSkips,
  })

  // The agenda's `isToday` is flag-based (gym/volleyball only); running blocks
  // are mesocycle-independent, so a day may have ONLY a prescribed run today —
  // and a genuine rest day flags no row at all. The flag still WINS (mock mode
  // pins "today" to a fixture day, see `todayIso` below), but when nothing carries
  // it we fall back to the row whose calendar date is actually today, so today's
  // own row (its custom instances, its rest copy) is never simply missing.
  const clockIso = localDateString()
  const todayRow = agenda.find((a) => a.isToday) ?? agenda.find((a) => a.date === clockIso)
  // "Today" for ALL date math on this page is the flagged agenda row's own date,
  // falling back to the wall clock when no row carries the flag (real mode's rest
  // days, and every real-mode day where flag and clock agree anyway). Mock mode's
  // "today" is a fixture flag on Csü while the clock is whatever day it really is;
  // reading the clock here made every card on the flagged row compute against the
  // WRONG calendar day — a mock run card rendered as TERVEZETT/ELMARADT and lost
  // its log CTA on any real weekday but Thursday (mezo-9bbc final review, C2).
  const todayIso = todayRow?.date ?? clockIso
  // The DayStrip's selection (`selectedDay === null` ⇒ today); falls back to
  // today if a stale/invalid selection no longer matches an agenda day.
  const shownDay = selectedDay ? (agenda.find((a) => a.day === selectedDay) ?? todayRow) : todayRow
  // Date-based, not flag-based: the flag is only ever set on a day carrying a
  // gym/sport slot, so a flag test read "not today" on today's own rest day or
  // run-only day — which silently dropped the `+ Saját edzés` CTA, the in-progress
  // resume card and the „Mai nap” heading (mezo-9bbc final review, I2). An absent
  // `shownDay` means today by definition (nothing selected, or a stale selection
  // that fell back to an undefined `todayRow` on a rest day).
  const isTodayShown = selectedDay === null || (shownDay?.date ?? todayIso) === todayIso
  // The day key today's own DayStrip chip carries — the same fallback the strip's
  // `selected` prop uses below (a real-mode rest day flags no agenda row at all).
  const todayDayKey = todayRow?.day ?? DAY_ORDER[todayIdx()]
  const selectDay = (day: string) => {
    // Tapping today's own chip is the way back to today now that the page-header's
    // „← Ma” is gone — so it CLEARS `?day=` rather than pinning today's index. Pinning
    // it would mean a reload tomorrow re-opened on *this* weekday, the exact guarantee
    // „← Ma” carried (mezo-88iwa.6, T5).
    if (day === todayDayKey) return writeDay(null)
    const index = DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number])
    writeDay(index >= 0 ? index : null)
  }

  // Pull today's runs separately (date-based) and merge them with the flag-based
  // today row into a synthetic day, so a run-only-today still shows its hero — but
  // only while today itself is shown; a non-today selection uses the agenda's own
  // (day-of-week-matched) running list instead.
  const todayRuns = runSessionsForDay(activeRunningBlock, todayIdx())
  // The shown day's hero cards, rendered in time-of-day order (a morning run hero
  // above an evening gym hero); same ordering as Heti's weekly rows via daySessions.
  // `custom` carries this day's COMPLETED saját instances — without it a day whose
  // only session was a custom workout read as a rest day on Mai while Heti showed
  // the finished row (mezo-9bbc final review, I6).
  const orderedToday = daySessions({
    day: shownDay?.day ?? '',
    gym: shownDay?.gym ?? null,
    sport: shownDay?.sport ?? [],
    running: isTodayShown ? todayRuns : (shownDay?.running ?? []),
    custom: shownDay?.custom ?? [],
    isToday: isTodayShown,
  })

  // Active meso phase for the current week (Week 3 ⇒ MAV).
  const currentPhase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const openSession = () => navigate('/train/session')

  // "Logged" signals drive the hero/weekly done-state. Volleyball has no
  // schedule↔log link, so we match the logged SportSession by date (the mapped
  // session carries the HU display date). Running carries the prescribed tuple
  // back, so we match on block + week + sessionKey (already day-scoped by
  // construction — a prescribed session's key is unique to its own weekday).
  // (`todayIso` is derived above, next to `todayRow`.)
  // The shown day's ISO date — sport done-state and state-labels must match THIS
  // day, not always today, now that these cards render for any selected day
  // (mezo-9bbc review fix). Falls back to todayIso when the shown day carries no
  // date (defensive only; every real agenda day has one).
  const shownIso = shownDay?.date ?? todayIso
  // Rest-day card gate — shared with the Saját edzés footer below so exactly one
  // of the two carries the CTA and it is never duplicated (mezo-eahv).
  const restDayCard =
    !shownDay?.gym && !shownDay?.sport.length && orderedToday.length === 0 && !(isTodayShown && todaySession?.openWorkout)
  // The today-gym poster's own render condition, hoisted: the `.tr-alt` quick pair follows
  // the energy and muscle-impact cards in render order, and the dashed „Saját edzés”
  // footer stands down while the pair is there so exactly ONE one-off-workout entry exists
  // (the same mutual exclusion the rest-day card already had with the footer, mezo-eahv).
  const gymPosterShown = isTodayShown && Boolean(workout) && orderedToday.some((it) => it.kind === 'gym')
  // A slot's done-state matches a logged session by DATE **and** SPORT — a mixed day
  // (TRX noon + volleyball evening) must flip each slot independently.
  const loggedSportOn = (iso: string, k: SportKind) =>
    sport.sessions.find((s) => s.sport === k && s.date === huMonthDayDow(iso)) ?? null
  const sportDoneOn = (iso: string | undefined, k: SportKind) =>
    Boolean(iso) && sport.sessions.some((s) => s.sport === k && s.date === huMonthDayDow(iso!))
  const runLoggedFor = (key: string) =>
    runSessions.find(
      (r) => r.blockId === activeRunningBlock?.id && r.weekNumber === activeRunningBlock?.currentWeek && r.sessionKey === key,
    ) ?? null

  // ── Task 5 (mezo-88iwa.6): the energy + muscle-impact cards, today-only ──
  // Weight source: the SAME hook `deriveDailyBudget` reads for the Fuel calorie budget
  // (`frontend/src/data/fuel/timelineHooks.ts:92-110`) — `useGoal()`, read above. Falling
  // back to 0 (not a static default) keeps the "no weight on file" honest state identical
  // to Fuel's own fallback chain.
  const weightKg = goal?.currentWeight ?? goalResponse?.startWeightKg ?? 0
  // A run block carries no plan-level duration (`RunPrescribedSession` has none) — the
  // same 40-minute stand-in `buildEnergyBreakdown` (Fuel's own energy-explain sheet) uses
  // for a duration-less block, so the two surfaces never quote different run burns.
  const DEFAULT_RUN_MIN = 40
  // Held at 0 while the timing profile is still pending — same "never a numeric
  // flash-then-swap" rule the poster's own `workoutMinutes` follows above.
  const gymMinutesToday = gymPosterShown && workout && !timingProfilePending
    ? estimateSessionMinutes(workout.exercises, timingProfile ?? undefined)
    : 0
  // Today's training blocks, in the exact shape `trainDayEnergy` wants — built from
  // the SAME ordered-today list the hero cards above already render, so the energy
  // card can never disagree with what's on-screen just above it.
  const energyBlocks: Block[] = isTodayShown
    ? orderedToday.reduce<Block[]>((acc, item) => {
        if (item.kind === 'gym') {
          if (gymPosterShown) acc.push({ kind: 'gym', minutes: gymMinutesToday, done: Boolean(completedTodayWorkout) })
        } else if (item.kind === 'sport') {
          acc.push({ kind: 'sport', minutes: item.sport.duration, done: sportDoneOn(shownIso, sportOf(item.sport)) })
        } else if (item.kind === 'running') {
          acc.push({ kind: 'run', minutes: DEFAULT_RUN_MIN, done: Boolean(runLoggedFor(item.running.key)) })
        }
        return acc
      }, [])
    : []
  const dayEnergy = trainDayEnergy(energyBlocks, weightKg || null)
  // Fix round 1 (finding 1, ship-blocking): a day whose blocks include gym must hold the
  // WHOLE card while the timing profile is pending — not just the gym block's own minutes.
  // `gymMinutesToday` above is already held at 0 while pending, but the card doesn't gate
  // on that, so real mode's first paint (no timing profile fetched yet) briefly rendered
  // "+0 kcal" from the still-empty gym block instead of the poster's own no-flash rule.
  const energyCardPendingGym = gymPosterShown && timingProfilePending

  // The muscle-impact rows: a gym day reads `dayImpact` off today's plan (Task 1) +
  // today's logged working sets (`doneByMuscle`, joined by exercise id — see below); a
  // rest day carrying a sport slot instead reads the sport's static heuristic table
  // (`sportMuscleLoad.ts:62`) so a röplabda-only rest day is never a blank card.
  // doneByMuscle: the open (in-progress) or just-completed instance's LOGGED working
  // sets, mapped from exerciseId back to the day plan's muscle token. Both
  // `todaySession.openWorkout` and `completedTodayWorkout` are already on this page
  // (no speculative new fetch) — a plain three-state resume/review CTA is what
  // Mai already reads them for above.
  const exerciseMuscleById = new Map((workout?.exercises ?? []).map((e) => [e.id, e.muscle] as const))
  const loggedInstance = completedTodayWorkout ?? todaySession?.openWorkout ?? null
  const doneByMuscle: Record<string, number> = {}
  if (gymPosterShown && loggedInstance) {
    for (const s of loggedInstance.sets) {
      if (s.kind !== 'working' || s.skipped) continue
      const muscle = exerciseMuscleById.get(s.exerciseId)
      if (!muscle) continue
      doneByMuscle[muscle] = (doneByMuscle[muscle] ?? 0) + 1
    }
  }
  const wordFromLoad = (load: number): DayImpactRow['word'] => (load <= 1 ? 'enyhe' : load === 2 ? 'közepes' : 'erős')
  const sportSlotsToday = shownDay?.sport ?? []
  let impactRows: DayImpactRow[] = []
  if (gymPosterShown && workout) {
    impactRows = dayImpact(workout.exercises.map((e) => ({ muscle: e.muscle, workingSets: e.workingSets })), doneByMuscle)
  } else if (isTodayShown && sportSlotsToday.length > 0) {
    // Rest-day-with-sport: aggregate every today sport slot's static heuristic load,
    // max per region across slots (mirrors `sportMuscleLoad.ts`'s own per-event
    // aggregation) — no set counts exist here, so `load` (1–3) stands in for
    // `plannedSets` purely to drive the track's relative width.
    // `events` is index-aligned with `sportSlotsToday` — `sportLoadForWeek` pushes
    // exactly one event per input slot, in the same order, with no filtering — so
    // `events[i]` is slot `sportSlotsToday[i]`'s own load (fix round 1, finding 2:
    // per-event attribution, not a single `anySportDone` flag that lit EVERY region
    // once any one sport was logged).
    const { events } = sportLoadForWeek(sportSlotsToday, [])
    const byRegion = new Map<RegionKey, { label: string; load: number }>()
    const doneByRegion = new Map<RegionKey, number>()
    events.forEach((ev, idx) => {
      const slot = sportSlotsToday[idx]
      const slotDone = Boolean(slot) && sportDoneOn(shownIso, sportOf(slot))
      for (const rl of ev.regionLoads) {
        const cur = byRegion.get(rl.region)
        if (!cur || rl.load > cur.load) byRegion.set(rl.region, { label: rl.label, load: rl.load })
        if (slotDone) {
          const curDone = doneByRegion.get(rl.region) ?? 0
          if (rl.load > curDone) doneByRegion.set(rl.region, rl.load)
        }
      }
    })
    impactRows = Array.from(byRegion.entries())
      .map(([region, { label, load }]) => ({
        region,
        label,
        // Zero-planned-row fallback token doesn't apply here (this branch never emits
        // a zero-planned row), but the representative-token helper is still the right
        // draw source — the sport heuristic carries no per-exercise muscle, only a
        // region-level load (fix round 1, finding 3).
        token: regionRepresentativeToken(region),
        plannedSets: load,
        doneSets: doneByRegion.get(region) ?? 0,
        word: wordFromLoad(load),
      }))
      .sort((a, b) => b.plannedSets - a.plannedSets)
  }
  const impactIsSportEstimate = !(gymPosterShown && workout) && impactRows.length > 0
  // Honest-state footer (mezo-88iwa.6 sweep, finding f): a gym day that ALSO carries a
  // sport slot only ever feeds the gym plan into `dayImpact` above (the sport branch is
  // `else if`) — the heading "Mit terhel a mai mozgásod" would otherwise silently claim
  // to cover movement it never counted. One appended sentence, only in this combo.
  const gymAndSportToday = Boolean(gymPosterShown && workout) && sportSlotsToday.length > 0
  const hasImpact = impactRows.some((r) => r.plannedSets > 0)
  const maxPlannedImpact = Math.max(1, ...impactRows.map((r) => r.plannedSets))

  return (
    <>
      {/* One-shot entrance choreography (mezo-d20.11 — `/train/mai` shipped with
          NONE). The replayKey is the shown day, so a DayStrip tap re-stages the
          swapped day's cards instead of snapping them in. The prototype does not
          draw a standalone Mai PAGE (its main panel is the hub), so the FACE is
          left alone here — only the missing motion is restored. */}
      <EntranceGroup replayKey={shownDay?.day ?? 'ma'}>

      {/* DayStrip — the Mon–Sun navigator; tapping a chip swaps the shown day below
          without any refetch (the agenda is already fully loaded). */}
      <DayStrip
        kalauzAnchor="mai-napsav"
        items={dayStripItems(agenda, (d, item) => {
          if (item.kind === 'gym') return Boolean(d.date) && gymDoneDates.includes(d.date!)
          if (item.kind === 'sport') return sportDoneOn(d.date, sportOf(item.sport))
          // A `custom` item only ever exists for a COMPLETED saját instance.
          if (item.kind === 'custom') return true
          return Boolean(runLoggedFor(item.running.key))
        })}
        // A real-mode rest day (no gym/sport slot matches today at all) leaves
        // `shownDay` undefined even while today is shown (§ isTodayShown above) —
        // fall back to the real weekday label so the strip still highlights a chip
        // instead of selecting none (review fix, mezo-9bbc). `shownDay` is only ever
        // undefined when today is what's shown, so no non-today special case is needed.
        selected={shownDay?.day ?? DAY_ORDER[todayIdx()]}
        onSelect={selectDay}
      />

      {/* The shown day's hero cards, ordered by time-of-day (gym / volleyball / running).
          A morning run hero appears above an evening gym hero. Each hero keeps
          its bespoke markup; the today gym hero additionally requires the /today workout. */}
      {orderedToday.map((item, i) => (
        // Entrance stagger (mezo-d20.11): the day's heroes ride the app's one-shot
        // `.rise` cadence inside the EntranceGroup above. Each branch keeps its own
        // bespoke markup — the wrapper only carries the delay.
        <div key={`hero-${i}`} className="rise" style={{ '--d': `${120 + i * 45}ms` } as CSSProperties}>
        {(() => {
        if (item.kind === 'gym') {
          const gym = item.gym
          if (isTodayShown) {
            if (!workout) return null
            const gymEyebrow = `MA ${gym.time ?? ''} · ${currentPhase} · GYM`
            // Three-state gating (spec 2026-07-15): a completed instance wins (KÉSZ ·
            // Eredmény review), else an open instance (FOLYAMATBAN · Folytassuk),
            // else the fresh start CTA. `completedTodayWorkout`/`todaySession` are real-
            // mode only (both null in mock → Indítsuk, byte-identical to Phase 1).
            // ONE condition drives BOTH the status pill and the CTA — no second state.
            const gymInProgress = Boolean(todaySession?.openWorkout && !completedTodayWorkout)
            // The constellation: one small MuscleChip per region today's plan actually
            // loads (silent regions carry plannedSets 0 and drop out). Reuses `impactRows`
            // (computed once above, outside this map, off the SAME `workout.exercises`
            // mapping) rather than calling `dayImpact` a second time with identical
            // exercise input — `doneByMuscle` only changes `doneSets`, which this filter
            // never reads, so the result is byte-identical either way (final-review fix
            // wave, mezo-88iwa.6).
            const constellation = impactRows.filter((r) => r.plannedSets > 0 && r.token)
            // Held at 0 (the chip's existing "no minutes" treatment, `workoutMinutes > 0 &&`
            // below) while the profile fetch is pending — never the static fallback, which
            // would render then swap to the calibrated number the instant the fetch lands.
            const workoutMinutes = timingProfilePending
              ? 0
              : estimateSessionMinutes(workout.exercises, timingProfile ?? undefined)
            return (
              <section
                key="hero-gym"
                className={cn('tr-day', completedTodayWorkout ? 'is-done' : gymInProgress && 'is-live')}
              >
                <span className="tr-day-status">
                  {completedTodayWorkout ? 'KÉSZ' : gymInProgress ? 'FOLYAMATBAN' : 'BETERVEZVE'}
                </span>
                {/* Inline flex (not a new class) for the icon+text layout only — `.tr-eyebrow`
                    (final-review fix wave) still carries the eyebrow's own typography; a
                    second layout-only class for one row is not worth a token. */}
                <span className="tr-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* The gym glyph is a clay symbol now — the eyebrow keeps the spoken „GYM”. */}
                  <ClayIcon name="i-edzes" size={18} />
                  <span>{gymEyebrow}</span>
                </span>
                <h2>{workout.title}</h2>
                <p>{activeMeso.shortTitle} · {activeMeso.currentWeek}. hét / {activeMeso.weeks}</p>
                {constellation.length > 0 && (
                  <div className="tr-day-constellation">
                    {constellation.map((r) => (
                      <MuscleChip key={r.region} token={r.token} size={28} />
                    ))}
                  </div>
                )}
                <div className="tr-pills">
                  <span>{workout.exercises.length} gyakorlat</span>
                  <span>{workout.exercises.reduce((acc, e) => acc + e.sets, 0)} szett</span>
                  {workoutMinutes > 0 && <span>~{workoutMinutes} perc</span>}
                  {gym.type && <span>{gym.type}</span>}
                </div>
                {completedTodayWorkout ? (
                  // Done-state: the workout is over (no restart until next week) — the CTA
                  // opens the read-only review of the completed instance (mezo-9bbc).
                  <button type="button" className="tr-start is-review" onClick={() => navigate(`/train/review/${completedTodayWorkout.id}`)}>
                    <span className="tr-start-art"><ClayIcon name="i-erme" size={26} /></span>
                    <span>
                      <strong>Eredmény</strong>
                      <small>{completedTodayWorkout.sets.filter((s) => !s.skipped).length} szett · megnézem</small>
                    </span>
                  </button>
                ) : todaySession?.openWorkout ? (
                  // In-progress: an open instance exists — resume it (count the logged sets).
                  <button type="button" className="tr-start is-resume" onClick={openSession}>
                    <span className="tr-start-art"><ClayIcon name="i-edzes" size={26} /></span>
                    <span>
                      <strong>Folytassuk</strong>
                      <small>{todaySession.openWorkout.sets.filter((s) => !s.skipped).length} szett kész</small>
                    </span>
                  </button>
                ) : (
                  <button type="button" className="tr-start is-go" onClick={openSession}>
                    <span className="tr-start-art"><ClayIcon name="i-edzes" size={26} /></span>
                    <span>
                      <strong>Indítsuk</strong>
                      <small>A mai tervezett edzésed</small>
                    </span>
                  </button>
                )}
              </section>
            )
          }

          // Non-today gym day: the /today endpoint only describes today, so title +
          // exercise count come from the meso template (mezo-9bbc).
          const md = activeMeso.days?.find((d) => d.day === shownDay!.day)
          const target = md ? gymDayTarget(md, weekWorkouts) : null
          const done = Boolean(shownDay?.date && gymDoneDates.includes(shownDay.date))
          return (
            <TodaySessionCard
              key="hero-gym"
              tone="gym"
              emoji={<ClayIcon name="i-edzes" size={26} />}
              tag="GYM"
              time={gym.time}
              title={gym.type ?? md?.type ?? 'Gym'}
              facts={[md ? `${md.exerciseCount} gyakorlat` : null, gym.duration ? `${gym.duration} perc` : null]}
              logged={done}
              loggedSummary={done ? 'Kész' : undefined}
              stateLabel={SESSION_STATE_LABEL[sessionState({ dayIso: shownDay!.date!, todayIso, timeOfDay: gym.time })]}
              ctaLabel={target ? 'Kezdjük el' : undefined}
              onLog={target ? () => navigate(target) : undefined}
            />
          )
        }

        if (item.kind === 'sport') {
          const vb = item.sport
          const k = sportOf(vb)
          const logged = loggedSportOn(shownIso, k)
          const state = sessionState({ dayIso: shownIso, todayIso, timeOfDay: vb.time })
          return (
            <TodaySessionCard
              key={`hero-sport-${k}-${vb.time}-${i}`}
              tone={SPORT_TONE[k]}
              emoji={<ClayIcon name="i-sport" size={26} />}
              tag={SPORT_TAGS[k]}
              time={vb.time}
              title={SPORT_TITLES[k]}
              facts={[`${vb.duration} perc`, vb.role, vb.court]}
              logged={Boolean(logged)}
              loggedSummary={
                logged
                  ? // Em dash rule: kcal is absent from the summary entirely when the wire
                    // carries none (an old session, or an unknown athlete weight) — never a
                    // fabricated 0 (T8 Task 6, mirrors movementWeek's own honesty guard).
                    (k === 'volleyball'
                      ? `RPE ${logged.rpe} · ${logged.duration}p · váll ${logged.shoulderStrain ?? '–'}`
                      : `RPE ${logged.rpe} · ${logged.duration}p`) +
                    (logged.kcal != null ? ` · ${logged.kcal} kcal` : '')
                  : undefined
              }
              loggedDetail={logged?.time ? `${logged.time}-kor logolva` : null}
              stateLabel={SESSION_STATE_LABEL[state]}
              // Three-way CTA (mezo-9bbc, Task 9): a future day (`planned`) stays
              // read-only; a past unlogged day (`missed`) offers Pótold, writing the
              // log against the shown day's date (SportLogSheet's `date` prop, wired
              // below); today keeps its original copy.
              ctaLabel={state === 'planned' ? undefined : state === 'missed' ? 'Pótold' : 'Logold a session-t'}
              onLog={state === 'planned' ? undefined : () => setSportLogSport(k)}
            />
          )
        }

        if (item.kind === 'custom') {
          // A completed saját (custom) workout of the shown day. It has no schedule
          // slot and no state chip — it is done by construction — so it renders as a
          // permanently-logged gym-tone card whose DoneBar opens its review, exactly
          // like Heti's SAJÁT/kész row (mezo-9bbc final review, I6).
          const c = item.custom
          return (
            <TodaySessionCard
              key={`hero-custom-${c.id}`}
              tone="gym"
              emoji={<ClayIcon name="i-edzes" size={26} />}
              tag="SAJÁT"
              title={c.title}
              facts={[]}
              logged
              loggedSummary="Kész"
              loggedDetail="Megnézem az összegzést"
              ctaLabel="Megnézem"
              onLog={() => navigate(`/train/review/${c.id}`)}
            />
          )
        }

        const s = item.running
        const rl = runLoggedFor(s.key)
        const runState = sessionState({ dayIso: shownIso, todayIso, timeOfDay: s.timeOfDay })
        const openRunLog = () => setRunLogCtx({
          blockId: activeRunningBlock!.id,
          weekNumber: activeRunningBlock!.currentWeek,
          sessionKey: s.key,
          label: s.label,
          isSprint: s.kind === 'sprint',
          defaultRounds: s.rounds ?? undefined,
        })
        return (
          <TodaySessionCard
            key={s.key}
            tone="run"
            emoji={<ClayIcon name="i-futas" size={26} />}
            tag="FUTÁS"
            time={s.timeOfDay}
            title={s.label}
            facts={[`RPE ${s.rpeTarget.min}–${s.rpeTarget.max}`, s.rounds ? `${s.rounds} kör` : null]}
            logged={Boolean(rl)}
            loggedSummary={rl ? `RPE ${rl.rpeActual ?? '–'}${rl.completedRounds != null ? ` · ${rl.completedRounds} kör` : ''}` : undefined}
            loggedDetail={null}
            stateLabel={SESSION_STATE_LABEL[runState]}
            // Same three-way CTA rule as sport (mezo-9bbc, Task 9) — `rl` itself is
            // already day-scoped by session key, so `logged` needs no change.
            ctaLabel={runState === 'planned' ? undefined : runState === 'missed' ? 'Pótold' : 'Naplózd a futást'}
            onLog={runState === 'planned' ? undefined : openRunLog}
          />
        )
        })()}
        </div>
      ))}

      {/* Energy card (Task 5, mezo-88iwa.6): today's movement kcal, split honestly into
          already-earned vs. still-in-the-plan. Absent whenever today carries no
          training block at all — an empty rest day gets no "add your weight" pitch
          for movement that does not exist. */}
      {isTodayShown && !energyCardPendingGym && energyBlocks.length > 0 && (
        <div className="rise" style={{ padding: '0 6px', '--d': '220ms' } as CSSProperties}>
          <section className="tr-energy">
            <span className="tr-eyebrow">A MAI KERETEDHEZ</span>
            <h3>Amit a mozgásod hozzáad</h3>
            {dayEnergy.known ? (
              <>
                <div className="tr-energy-main">
                  <b>+</b><strong>{dayEnergy.plannedKcal}</strong><small>kcal</small>
                </div>
                <div className="tr-energy-split">
                  <span><i className="done" />{dayEnergy.earnedKcal} kcal már megszolgálva</span>
                  <span><i className="plan" />{dayEnergy.plannedKcal - dayEnergy.earnedKcal} kcal a tervben</span>
                </div>
              </>
            ) : (
              <p className="tr-energy-empty">Ha megadod a súlyod, kiszámoljuk, mennyit ad a mai mozgásod a keretedhez.</p>
            )}
            <p className="tr-energy-note">Becslés, nem mérés.</p>
          </section>
        </div>
      )}

      {/* Muscle-impact card (Task 5, mezo-88iwa.6): what today's movement loads, region
          by region, in words — never an all-zero table when nothing is actually
          planned (a real rest day with no sport gets no card at all). */}
      {isTodayShown && hasImpact && (
        <div className="rise" style={{ padding: '0 6px', '--d': '230ms' } as CSSProperties}>
          <section className="tr-mus">
            <span className="tr-eyebrow">HATÁS AZ IZOMZATODRA</span>
            <h3>Mit terhel a mai mozgásod</h3>
            {impactRows.map((row) => {
              const planPct = (row.plannedSets / maxPlannedImpact) * 100
              const donePct = (Math.min(row.doneSets, row.plannedSets) / maxPlannedImpact) * 100
              return (
                <div className="tr-mus-row" key={row.region}>
                  <span className="tr-mus-art"><MuscleChip token={row.token} size={28} /></span>
                  <span className="tr-mus-name">{row.label}</span>
                  <span className="tr-mus-track" style={{ '--mus-color': regionColor(row.region as RegionKey).rail } as CSSProperties}>
                    <i className="plan" style={{ '--w': `${planPct}%` } as CSSProperties} />
                    <i className="done" style={{ '--w': `${donePct}%` } as CSSProperties} />
                  </span>
                  <span className="tr-mus-word">{row.word}</span>
                </div>
              )
            })}
            <p className="tr-mus-note">
              {impactIsSportEstimate
                ? 'A sáv a sport becsült terhelése — nem mért adat. Becslés, nem mérés.'
                : 'A halvány sáv a tervezett terhelés, a világos a már megszolgált. Becslés, nem mérés.'}
              {gymAndSportToday && ' A mai gym terved látod itt — a sportod terhelését külön, becsléssel számoljuk.'}
            </p>
          </section>
        </div>
      )}

      {/* „Vagy inkább” — the two other doors (Custom Workout and Sport Log), rendered
          below the energy and muscle-impact cards in the cascade. They open the SAME
          two sheets this page already mounts (CustomWorkoutSheet / SportLogSheet), no
          new surface. Aligned to the poster's own inner gutter (the scroller's
          --screen-gutter + 6px). */}
      {gymPosterShown && (
        // Fix round 1 (finding 4): rebalanced from 200ms — the .tr-alt pair sits BELOW
        // the energy (220ms) / muscle-impact (230ms) cards in document order, so its own
        // delay must be >= 230ms too (document order = delay order), not earlier than
        // both.
        <div className="rise" style={{ padding: '0 6px', '--d': '235ms' } as CSSProperties}>
          <div className="tr-alt">
            <button type="button" onClick={() => setCustomOpen(true)}>
              <ClayIcon name="i-edzes" size={22} />
              <span><small>Gyors indítás</small><strong>Egyedi edzés</strong></span>
            </button>
            {/* The Sport door opens the full-screen sport flow (mezo-88iwa.9, T8 Task 4):
                pick a sport, then only the fields that sport actually asks. The day-card
                CTAs below still open the sheet — they log against a PAST day (Pótold), a
                date the new flow does not take yet. */}
            <button type="button" onClick={() => navigate('/train/sport/log')}>
              <ClayIcon name="i-sport" size={22} />
              <span><small>Gyors indítás</small><strong>Sport naplózása</strong></span>
            </button>
          </div>
        </div>
      )}

      {/* Mezociklus + Sport entry rows — secondary navigation, so they sit BELOW the
          poster and its quick pair now that the page-header is gone and the DayStrip →
          poster pairing owns the top of the face (mezo-88iwa.6, T5). Their markup is
          unchanged; only their place in the cascade moved. */}
      {/* Mezociklus overview entry card (active meso only) */}
      {/* Gutter aligned to the poster's own 18px inset (mezo-88iwa.6 sweep): the
          screen scroller already contributes --screen-gutter (12px), so +6px here
          matches the `.tr-alt` wrapper below, not a bare 24px literal. */}
      <div className="rise" style={{ padding: '0 6px 12px', '--d': '240ms' } as CSSProperties}>
        {/* The DS canonical row: a 56px nav row at body size with a trailing chevron. */}
        <button
          type="button"
          className="card mesorow"
          onClick={() => navigate(`/train/mesocycles/${activeMeso.id}/overview`)}
          aria-label={`Mezociklus áttekintő · ${activeMeso.shortTitle}`}
        >
          <ClayIcon name="i-meso" size={28} />
          <span className="mesorow-tx">
            {activeMeso.shortTitle} · {currentPhase} · W{activeMeso.currentWeek}/{activeMeso.weeks}
          </span>
          <Icon name="chevron-right" size={16} color="var(--text-tertiary)" />
        </button>
      </div>

      {/* Sport entry row (final-review fix wave, mezo-88iwa.5): the hub retirement left
          Sport (and its szezon nézet) with no entry point of its own — Mai owns
          `/train/sport` (navModel.ts) but nothing on this face pointed at it. Same
          `.mesorow` idiom as the Mezociklus row above. */}
      <div className="rise" style={{ padding: '0 6px 12px', '--d': '260ms' } as CSSProperties}>
        <button
          type="button"
          className="card mesorow"
          onClick={() => navigate('/train/sport')}
        >
          <ClayIcon name="i-sport" size={28} />
          <span className="mesorow-tx">Sportjaid és szezonod</span>
          <Icon name="chevron-right" size={16} color="var(--text-tertiary)" />
        </button>
      </div>

      {/* Open custom (saját) instance on a rest day (real mode, today only): the gym hero
          above only renders when today has a gym schedule slot, so an open instance
          started on a non-gym day (e.g. a meso-less custom workout) otherwise has no
          resume affordance anywhere on Mai (final-review fix, mezo-ws2x — Finding 4).
          getToday's open-wins day resolution means `workout` already IS the open
          instance's day plan here. */}
      {isTodayShown && !shownDay?.gym && todaySession?.openWorkout && workout && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card" style={{ padding: 'var(--sp-4)' }}>
            <span className="eyebrow" style={{ color: 'var(--warning-hover)' }}>● Folyamatban</span>
            <p style={{ fontSize: 16, fontWeight: 600, marginTop: 8, color: 'var(--text-primary)' }}>{workout.title}</p>
            <div className="np-ctarow mt-md">
              <button type="button" className="np-cta np-press" onClick={openSession}>
                Folytassuk → · {todaySession.openWorkout.sets.filter((s) => !s.skipped).length} szett kész
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest day: nothing scheduled on the shown day. Today's copy offers a Saját edzés
          CTA (the heti rended pointer moved to Heti); a non-today rest day is read-only.
          Gated off a today open instance above — an in-progress resume card and the
          rest-day card must never render together (mezo-ws2x — Finding 4). */}
      {restDayCard && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card" style={{ padding: 'var(--sp-4)' }}>
            <span className="eyebrow">{isTodayShown ? 'Ma pihenőnap' : 'Nincs tervezett edzés'}</span>
            <p style={{ fontSize: 16, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isTodayShown
                ? 'Nincs tervezett edzés mára — a heti rended a Heti fülön találod.'
                : 'Ezen a napon nincs tervezett edzés.'}
            </p>
            {isTodayShown && (
              <CtaGhost
                className="mt-md"
                onClick={() => setCustomOpen(true)}
                style={{ borderColor: 'color-mix(in srgb, var(--tag-gym) 40%, transparent)', color: 'var(--tag-gym)' }}
              >
                <Icon name="plus" size={14} /> Saját edzés
              </CtaGhost>
            )}
          </div>
        </div>
      )}

      {/* Saját edzés footer — a one-off workout for TODAY must stay reachable even
          when the day already carries scheduled sessions; the mezo-9bbc one-day
          rework dropped this unconditional entry and left it rest-day-only
          (mezo-eahv). The rest-day card above carries its own copy, and so does the
          poster's `.tr-alt` pair, so the footer renders exactly when NEITHER does.
          Non-today selections are read-only — no entry there. */}
      {isTodayShown && !restDayCard && !gymPosterShown && (
        <div className="rise" style={{ padding: '0 24px 16px', '--d': '340ms' } as CSSProperties}>
          <button type="button" onClick={() => setCustomOpen(true)} className="card" style={{
            width: '100%', minHeight: 48, padding: '12px 16px', background: 'transparent',
            borderStyle: 'dashed', borderColor: 'var(--divider)', color: 'var(--tag-gym)',
            fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="plus" size={14} /> Saját edzés
          </button>
        </div>
      )}

      {isTodayShown && showMtr && (
        <MorningTrainingCard
          offending={mtrOffending}
          windowStart={mtrWindow.start}
          windowEnd={mtrWindow.end}
          onApply={applyMtr}
          onSnooze={snoozeMtr}
        />
      )}
      </EntranceGroup>

      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      {sportLogSport && (
        <SportLogSheet
          initialSport={sportLogSport}
          // Today logs with no date (server defaults to now); a past-day "Pótold"
          // open passes the shown day's ISO date instead (mezo-9bbc, Task 9).
          date={shownIso === todayIso ? undefined : shownIso}
          onClose={() => setSportLogSport(null)}
          onSave={(body, done) => logSportSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
      {runLogCtx && (
        <RunLogSheet
          ctx={runLogCtx}
          date={shownIso}
          onClose={() => setRunLogCtx(null)}
          onSave={(body, done) => logRunSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
    </>
  )
}
