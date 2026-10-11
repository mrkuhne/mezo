// ============================================================
// Mezo · TrainTodayPage (Mai) — a one-day view (mezo-9bbc).
// A DayStrip navigator over the Mon–Sun agenda picks which day's sessions
// render below it (default: today; `?day={0..6}` — the Heti drill-in — names
// another day). The URL is the single source of truth for that selection, so
// a reload, a back/forward step and the `Mai` sub-nav entry all agree with what
// the page renders. The weekly list + load tiles + provenance note now
// live on TrainWeekPage (/train/week, "Heti").
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `mai()` and its helpers `dstrip()`,
// `thero()`, `readyCard()`, `sessStep()` / `sessHero()` / `gymDayHero()`, `restWeek()`,
// `energyCard()`, `impactCard()`, `navRows()`, `mtrCard()`): the day strip, then ONE hero — today's
// gym session as the body silhouette filled muscle by muscle (light = what the plan asks, deep =
// the sets already logged; owner decision: the body, not the dumbbell), three facts beside it, the
// muscle tags, and on the liquid row the one three-state button (Indítsuk / Folytassuk / Eredmény)
// with „Kihagyom". The other sessions of the day are steps in one card („Ma még"); a day without
// a today-gym poster promotes its first session to the hero; a rest day shows the week as tubes
// (full = done gym days, dashed line = the days still planned). Numbered sections follow:
// „Mielőtt elkezded" (the readiness hero), „A mai keretedhez" (the served Fuel energy as one split
// vessel), „Hatás az izomzatodra" (one split vessel per region), „Vagy inkább" (the two quick doors
// + the two nav rows) or „Innen tovább" (the nav rows alone), and the morning-window card.
// Behaviour is unchanged: markup and presentational derivations only.
// ============================================================
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useQueryClient } from '@tanstack/react-query'
import { useTrain, useRunning, useWeekWorkouts, useSleepGoal, useTimingProfile, useFuelDay, useTodayReadiness } from '@/data/hooks'
import { isMockMode } from '@/data/_client/mode'
import { MorningTrainingCard } from '@/features/train/components/MorningTrainingCard'
import { TodayReadiness } from '@/features/train/components/ReadinessCard'
import {
  isSnoozed,
  morningWindow,
  offendingSlots,
  rescheduledSlots,
  snooze,
  snoozeHash,
} from '@/features/train/logic/morningWindow'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { huMonthDay, huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { cn } from '@/shared/lib/cn'
import { outOf } from '@/shared/lib/huText'
import type { Icon3DName } from '@/shared/ui/clay'
import { Acts, Big, Box, Btn, Bub, Card, Head, Hero, Legend, Lk, Note, Page, Pair, Row, Section, Split, Tubes, useFrameTitle, type VialItem } from '@/shared/ui/folyadek'
import { BodyLiq, MuscleRow, MuscleTags, deepMuscle, type BodyLiqEntry } from '@/features/train/components/folyadek'
import { shapesFor } from '@/features/train/logic/bodyMapShapes'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { RunLogSheet } from '@/features/train/sheets/RunLogSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { DayStrip } from '@/features/train/components/DayStrip'
import { TodaySessionCard } from '@/features/train/components/TodaySessionCard'
import { daySessions } from '@/features/train/logic/agenda'
import { dayImpact, regionRepresentativeToken, type DayImpactRow } from '@/features/train/logic/dayImpact'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import type { RegionKey } from '@/features/train/logic/muscleColors'
import type { MesoDay } from '@/data/types'
import { dayStripItems } from '@/features/train/logic/dayStripItems'
import { buildWeekAgenda, weekDateIso } from '@/features/train/logic/weekAgenda'
import { gymDayTarget } from '@/features/train/logic/gymDayTarget'
import TrainTodaySkeleton from '@/features/train/pages/TrainTodaySkeleton'
import { SPORT_KINDS, SPORT_TONE, sportOf, SPORT_TAGS, SPORT_TITLES, type SportKind } from '@/features/train/logic/sportKinds'
import { SESSION_STATE_LABEL, sessionState } from '@/features/train/logic/sessionState'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { usePlannedSkips } from '@/data/train/skipHooks'
import { findSkip, skipWindow, type PlannedSkip, type PlannedSkipKey } from '@/features/train/logic/plannedSkips'
import { RecoveryActs, RecoveryBox, SkippedActs, SkippedBox } from '@/features/train/components/SkippedBlock'
import { SkipReasonSheet } from '@/features/train/components/SkipReasonSheet'
import { ComebackPill, comebackPillLabel } from '@/features/train/components/ComebackPill'
import { WelcomeBackSheet } from '@/features/train/components/WelcomeBackSheet'
import { useRecoveryBetter } from '@/features/train/logic/useRecoveryBetter'
import { KIMELO, notYetToast } from '@/features/train/logic/skipCopy'
import {
  useDiscardRecovery,
  useOpenRecovery,
  useRecovery,
  useRecoveryCheckIn,
  useReleaseDay,
  useUndoBetter,
  useUnreleaseDay,
  useWaiveComeback,
} from '@/data/train/recoveryHooks'
import { useToast } from '@/shared/ui/ToastProvider'

/** Each sport's own 3D art (the sprite carries one per wire sport); volleyball is t-volley. */
const SPORT_ART: Record<SportKind, Icon3DName> = {
  volleyball: 't-volley', cross: 't-crossfit', trx: 't-trx', bike: 't-bike', swim: 't-swim',
  football: 't-football', basketball: 't-basket', tennis: 't-tennis', hike: 't-hike', other: 't-other',
}

/** A planned set load on one muscle — what the body graphic and the tubes are drawn from. */
type MuscleSets = { muscle: string; sets: number }

/** Which side of the body a day's work shows on: the side that carries more of its sets (a pull day reads from the back). */
function bodyView(plan: MuscleSets[]): 'front' | 'back' {
  let front = 0, back = 0
  for (const e of plan) {
    const views = new Set(shapesFor(e.muscle).map(([v]) => v))
    if (views.has('front')) front += e.sets
    if (views.has('back')) back += e.sets
  }
  return back > front ? 'back' : 'front'
}

/** The muscle that carries the most sets of a day (the tube's colour). */
function topMuscle(plan: MuscleSets[]): string | null {
  const by = new Map<string, number>()
  for (const e of plan) by.set(e.muscle, (by.get(e.muscle) ?? 0) + e.sets)
  return [...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/** The hero's caption under the body: whose turn it is today, by the day's heaviest region. */
const REGION_ASKS: Record<string, string> = {
  coral: 'a mellkasodtól', sky: 'a hátadtól', lav: 'a válladtól', rose: 'a karodtól', sage: 'a lábadtól', amber: 'a törzsedtől',
}

/** The body + the fact column of a gym hero (prototype `.vs-h2`: `.vs-hb` + `.vs-hf`). */
function GymGraphic({ view, entries, caption, off, facts }: {
  view: 'front' | 'back'; entries: BodyLiqEntry[]; caption: string; off?: boolean; facts: [ReactNode, string][]
}) {
  return (
    <div className="em-h2">
      <BodyLiq view={view} entries={entries} width={112} caption={caption} off={off} />
      <div className="em-hf">
        {facts.map(([big, small]) => <span key={small}><b>{big}</b><small>{small}</small></span>)}
      </div>
    </div>
  )
}

type RunLogCtx = { blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }

export function TrainTodayPage() {
  const { workout, gymSchedule, sport, activeMeso, logSportSession, gymDoneDates, workoutPending, todaySession, completedTodayWorkout, gymSlots, saveGymSchedule } = useTrain()
  const { activeRunningBlock, runSessions, logRunSession, runningPending } = useRunning()
  // Completed workout summaries for this Mon–Sun week — maps each done day's ISO
  // date to its instance id so a weekly gym row can open the review (real mode).
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const navigate = useNavigate()
  const { showLevelUp } = useLevelUp()
  const [sportLogSport, setSportLogSport] = useState<SportKind | null>(null)
  const [runLogCtx, setRunLogCtx] = useState<RunLogCtx | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  // Kihagyás S1 (mezo-q4xt2.1, prototype elo/edzes.html): one-tap skip of a planned occurrence +
  // the optional „Miért marad ki?" sheet. `why` names the occurrence the sheet is about; its live
  // row is re-read from `skips` every render so the sheet follows each saved reason.
  const { skips, skip, setReason, undo } = usePlannedSkips()
  const [why, setWhy] = useState<{ target: PlannedSkipKey; title: string } | null>(null)
  const toast = useToast()
  // Kímélő mód S2 (mezo-q4xt2.2, prototype elo/edzes.html `kmHero`/`thero`/`udvSheet`): the
  // recovery state (protected dates, the open period, the comeback ramp) and its writes. Every
  // failed write is toasted by the global MutationCache; the UI only moves on success.
  const { recovery } = useRecovery()
  const openRecovery = useOpenRecovery()
  const recoveryCheckIn = useRecoveryCheckIn()
  const undoBetter = useUndoBetter()
  const discardRecovery = useDiscardRecovery()
  const releaseDay = useReleaseDay()
  const unreleaseDay = useUnreleaseDay()
  const waiveComeback = useWaiveComeback()
  const { better: endRecovery, welcome, closeWelcome } = useRecoveryBetter({ checkIn: recoveryCheckIn, discard: discardRecovery })
  const { goal: sleepGoal } = useSleepGoal()
  // Calibrated pacing (Task 12, mezo-dzbm): only the today chip's workoutMinutes reads this —
  // structureLint/peakWeekFit/programFit deliberately stay on the static estimate.
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()
  // Task 8 (mezo-tb3s2): the energy card mirrors the SAME served Fuel energy Fuel's own
  // Mai page reads (`useFuelDay()`) — never a client-side weight/MET estimate, so the
  // two surfaces can never drift apart.
  const { fuel: fuelToday, isPending: fuelDayPending } = useFuelDay()
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
  // The title bar's context line (prototype `T0.sub`): the mesocycle and its week; another day of the
  // week names that day instead; without a mesocycle it is just „Mai nap".
  // (Today's own key as the agenda will flag it: the gym schedule's `today` row, else the clock.)
  const flaggedToday = gymSchedule?.weeklyTimes?.find((g) => g.today)?.day ?? DAY_ORDER[todayIdx()]
  useFrameTitle({
    eyebrow: !activeMeso
      ? (workoutPending || runningPending ? undefined : 'Mai nap')
      : selectedDay && selectedDay !== flaggedToday
        ? `${DAY_LABELS[selectedDay] ?? selectedDay} · ${huMonthDay(weekDateIso(dayIdx)).toLocaleLowerCase('hu')}.`
        : `${activeMeso.shortTitle} · ${activeMeso.currentWeek}. hét / ${activeMeso.weeks}`,
  })
  // „Mielőtt elkezded" is a numbered section only while the readiness card really shows (the card
  // itself reads the same hook — one query, two observers).
  const { readiness } = useTodayReadiness()
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
      <Page className="em-page em-nomeso">
        {/* prototype `mai('ures')`: the page's hero is the invitation itself — the peak (the
            mesocycle's meaning) beside the sentence, the two doors on the liquid row. */}
        <Hero art="t-peak" label="Mai nap" verdict="Itt fog élni a mai edzésed."
          sub="Előbb tervezz egy mesociklust."
          actions={(
            <>
              <Btn onClick={() => navigate('/train/mesocycles/new')}>+ Tervezz mesociklust</Btn>
              <Lk onClick={() => setCustomOpen(true)}>+ Saját edzés</Lk>
            </>
          )} />
        {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      </Page>
    )
  }

  // Combine gym schedule + volleyball sessions into a unified weekly map. Each row carries
  // its calendar ISO date (this week's Monday + index) so done-state can be matched per day.
  const agenda = buildWeekAgenda({
    gymTimes: gymSchedule?.weeklyTimes ?? [],
    sportSlots: sport.schedule?.volleyball.sessions ?? [],
    runningBlock: activeRunningBlock,
    weekWorkouts,
    // Mai keeps a skipped occurrence ON the page (it renders as skipped, with its undo) — so the
    // agenda is built unfiltered here; every planning surface filters it out instead.
    skips: [],
    // Kímélő mód S2: protected days stay listed too — flagged, so the strip and cards mute them.
    protectedDates: recovery.protectedDates,
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
  // The today-gym poster's own render condition, hoisted: the „Vagy inkább” quick pair follows
  // the energy and muscle-impact cards in render order, and the dashed „Saját edzés”
  // footer stands down while the pair is there so exactly ONE one-off-workout entry exists
  // (the same mutual exclusion the rest-day card already had with the footer, mezo-eahv).
  const gymPosterShown = isTodayShown && Boolean(workout) && orderedToday.some((it) => it.kind === 'gym')
  // A gym DAY's done-state is keyed by its TEMPLATE, not by the date a workout was
  // performed (mezo-z9kft): yesterday's plan finished today is stamped with today's
  // date, so the date-keyed `gymDoneDates` left the planned day ELMARADT and flipped
  // today's chip to done instead. `weekWorkouts` (this week's completed instances)
  // carries the template id — the same key `gymDayTarget` already routes by. Mock mode
  // has no persisted instances, so it keeps its date-keyed Phase-1 signal.
  const gymDayDone = (dayLabel: string, iso: string | undefined) => {
    if (isMockMode()) return Boolean(iso) && gymDoneDates.includes(iso!)
    const md = activeMeso.days?.find((d) => d.day === dayLabel)
    return Boolean(md?.id) && weekWorkouts.some((w) => w.templateSessionId === md!.id)
  }
  // A slot's done-state matches a logged session by DATE **and** SPORT — a mixed day
  // (TRX noon + volleyball evening) must flip each slot independently.
  const loggedSportOn = (iso: string, k: SportKind) =>
    sport.sessions.find((s) => s.sport === k && s.date === huMonthDayDow(iso)) ?? null
  const sportDoneOn = (iso: string | undefined, k: SportKind) =>
    Boolean(iso) && sport.sessions.some((s) => s.sport === k && s.date === huMonthDayDow(iso!))
  // Logged sports the shown day's SCHEDULE never knew about (T8 Task 4 final review,
  // mezo-88iwa.9). `orderedToday` is built purely from agenda SLOTS, and the schedule's own
  // CHECK is still three ids wide — so a Kerékpár / Úszás / Túra session logged from the
  // full-screen ten-sport flow (`/train/sport/log`) appeared NOWHERE on Mai: the athlete did
  // the work and the day still looked empty. These render below the slot-driven heroes as
  // their own compact done-state rows (there is no CTA — they are done by construction,
  // exactly like the `custom` branch's completed saját workout).
  const slotSportKinds = new Set<SportKind>(
    orderedToday.filter((it) => it.kind === 'sport').map((it) => sportOf(it.sport) as SportKind),
  )
  // `SportSession.sport` is a plain string off the wire — a row carrying an id this build
  // has no label for is dropped rather than rendered as `undefined`.
  const unscheduledLoggedSports = sport.sessions
    .filter((s) => s.date === huMonthDayDow(shownIso))
    .map((s) => ({ session: s, kind: (s.sport ?? 'volleyball') as SportKind }))
    .filter(({ kind }) => SPORT_KINDS.includes(kind) && !slotSportKinds.has(kind))
  // Rest-day card gate — shared with the Saját edzés footer below so exactly one
  // of the two carries the CTA and it is never duplicated (mezo-eahv). An unscheduled
  // logged sport also stands the card down: „nincs mai mozgás” directly above a done-state
  // row saying otherwise is the exact dishonesty this fix wave removed.
  const restDayCard =
    !shownDay?.gym && !shownDay?.sport.length && orderedToday.length === 0
    && unscheduledLoggedSports.length === 0 && !(isTodayShown && todaySession?.openWorkout)
  const runLoggedFor = (key: string) =>
    runSessions.find(
      (r) => r.blockId === activeRunningBlock?.id && r.weekNumber === activeRunningBlock?.currentWeek && r.sessionKey === key,
    ) ?? null

  // ── Kihagyás S1 (mezo-q4xt2.1): the skip identity of each shown occurrence ──
  // SPORT uses the 0=Hét..6=Vas weekday index of the day + the slot's own unnormalised time; RUN
  // the prescribed session key; GYM the date alone — the backend's own identity match.
  const { fromIso: skipFrom, toIso: skipTo } = skipWindow()
  const inSkipWindow = (iso: string) => iso >= skipFrom && iso <= skipTo
  const dayIdxOf = (day: string) => DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number])
  const gymKey = (iso: string): PlannedSkipKey => ({ kind: 'GYM', date: iso })
  const sportKey = (iso: string, day: string, time: string): PlannedSkipKey =>
    ({ kind: 'SPORT', date: iso, dayOfWeek: dayIdxOf(day), time })
  const runKey = (iso: string, key: string): PlannedSkipKey => ({ kind: 'RUN', date: iso, sessionKey: key })
  const startSkip = (target: PlannedSkipKey, title: string) =>
    skip(target, () => {
      setWhy({ target, title })
      toast.show({ kind: 'info', text: 'Kihagyva — bármikor visszavonhatod' })
    })
  const undoSkip = (s: PlannedSkip) => undo(s.id, () => toast.show({ kind: 'info', text: 'Visszavonva — újra a tervben' }))
  // Today's gym poster in its plan state (not started, not finished) — the only state a skip applies to.
  const gymHeroPlan = !completedTodayWorkout && !todaySession?.openWorkout
  const todayGymSkip = gymHeroPlan ? findSkip(skips, gymKey(shownIso)) : undefined

  // ── Kímélő mód S2 (mezo-q4xt2.2): protected days, the open period and its actions ──
  // A protected date (the server's own list, releases already removed) mutes every planned session
  // on it; a real skip row on that date reads as kímélő too while the period is open.
  const protectedSet = new Set(recovery.protectedDates)
  const isProtected = (iso: string | undefined) => Boolean(iso) && protectedSet.has(iso!)
  const period = recovery.period ?? null
  const openPeriod = period && !period.endedOn ? period : null
  const recoveryBusy = openRecovery.isPending || recoveryCheckIn.isPending || undoBetter.isPending
    || discardRecovery.isPending || releaseDay.isPending || unreleaseDay.isPending || waiveComeback.isPending
  // „Ma mégis edzek" trains the GYM session on a protected date; a real gym skip row there would
  // still hide it, so that one row goes too. Sport/run skips the user made on purpose stay.
  const onRelease = (iso: string) => releaseDay.mutate({ date: iso }, {
    onSuccess: () => {
      const gymSkipRow = findSkip(skips, gymKey(iso))
      if (gymSkipRow) undo(gymSkipRow.id)
      toast.show({ kind: 'info', text: KIMELO.toastReleased })
    },
  })
  const onUnrelease = (iso: string) => unreleaseDay.mutate(iso, {
    onSuccess: () => toast.show({ kind: 'info', text: KIMELO.toastUnreleased }),
  })
  const onFullLoad = (iso: string) => releaseDay.mutate({ date: iso, lighten: false }, {
    onSuccess: () => toast.show({ kind: 'info', text: KIMELO.toastWaived }),
  })
  // „Jobban vagyok": day 1 discards (the server has no same-day return), later BETTER → „Üdv újra!"
  // — the shared rule in `useRecoveryBetter` (the Nap hub's card uses it too).
  const onBetter = () => endRecovery(openPeriod)
  const onNotYet = () => {
    if (!openPeriod) return
    const cat = openPeriod.category
    recoveryCheckIn.mutate('NOT_YET', { onSuccess: () => toast.show({ kind: 'info', text: notYetToast(cat) }) })
  }
  const onUndoBetter = (fromSheet: boolean) => undoBetter.mutate(undefined, {
    onSuccess: () => {
      closeWelcome()
      toast.show({ kind: 'info', text: fromSheet ? KIMELO.toastStay : KIMELO.toastUndone })
    },
  })
  const onWaive = () => waiveComeback.mutate(undefined, {
    onSuccess: () => toast.show({ kind: 'info', text: KIMELO.toastWaived }),
  })
  // The return can be taken back only on the day it ended (the server's undo window).
  const canUndoBetter = Boolean(period?.endedOn && period.endedOn === clockIso)
  // The first run after the return is half as long (prototype `rCb`): the next planned, not yet
  // logged, not protected run from today on carries the note while the ramp is on.
  const comebackOn = Boolean(recovery.comeback && !recovery.comeback.waived && recovery.comeback.total > 0)
  const nextRun = (() => {
    if (!comebackOn) return null
    for (const d of agenda) {
      if (!d.date || d.date < todayIso || isProtected(d.date)) continue
      const runs = d.date === todayIso ? todayRuns : d.running
      const r = runs.find((x) => !runLoggedFor(x.key))
      if (r) return { iso: d.date, key: r.key }
    }
    return null
  })()

  // ── Task 8 (mezo-tb3s2): the energy card, today-only — reads the SERVED Fuel energy ──
  // (never a client-side weight/MET estimate; the old `trainDayEnergy` path is gone from
  // this page). `earned` mirrors the exact equation Fuel's own budget hero shows for the
  // day's logged movement; `pending` previews today's still-unlogged planned sessions.
  const served = isTodayShown ? fuelToday.energy : null
  const earned = served ? served.plannedMovementKcal + served.extraMovementKcal : 0
  const pending = served?.pendingMovementKcal ?? 0

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

  // ── Folyadék (mezo-n4wf5.3): presentational derivations for the page's graphics ──
  const rise = (ms: number) => ({ '--d': `${ms}ms` } as CSSProperties)
  const dayFull = DAY_LABELS[shownDay?.day ?? ''] ?? shownDay?.day ?? ''
  const heroEyebrow = isTodayShown ? 'Ma' : dayFull
  const mesoDay = (day: string | undefined): MesoDay | undefined => activeMeso.days?.find((d) => d.day === day)
  const planOf = (md: MesoDay | undefined): MuscleSets[] =>
    (md?.exercises ?? []).map((e) => ({ muscle: e.muscle, sets: e.workingSets }))
  /** One body entry per muscle: the planned sets as the light liquid, the logged ones as the deep
   *  one. `full` sets fill a muscle to the brim (today 4 — a muscle's usual dose in one session;
   *  another day's whole-session drawing 7, as in the prototype). */
  const bodyEntries = (plan: MuscleSets[], done: Record<string, number>, full: number): BodyLiqEntry[] => {
    const by = new Map<string, number>()
    for (const e of plan) by.set(e.muscle, (by.get(e.muscle) ?? 0) + e.sets)
    return [...by.entries()].map(([muscle, sets]) => ({
      muscle, planned: sets / full, done: Math.min(done[muscle] ?? 0, sets) / full,
    }))
  }
  const navRows = (
    <>
      <Row icon="t-layers" onClick={() => navigate(`/train/mesocycles/${activeMeso.id}/overview`)}
        aria-label={`Mezociklus áttekintő · ${activeMeso.shortTitle}`}
        title={`${activeMeso.shortTitle} · ${currentPhase} · ${activeMeso.currentWeek}. hét / ${activeMeso.weeks}`}
        sub="Mezociklus áttekintő" />
      {/* Sport entry row (mezo-88iwa.5): Mai owns `/train/sport` (navModel.ts). */}
      <Row icon="t-volley" title="Sportjaid és szezonod" onClick={() => navigate('/train/sport')} />
    </>
  )

  // The shown day's sessions (prototype `dayItems()`): each can render as the day's hero or as a
  // step of the „Ma még" card. Today's own gym session is the poster (`gymHero`) and never a step.
  type Sess = { key: string; gym?: boolean; render: (hero: boolean) => ReactNode }
  const sessions: Sess[] = []
  let gymHero: ReactNode = null
  let readyShown = false
  let heroSkipped = false

  orderedToday.forEach((item, i) => {
    if (item.kind === 'gym') {
      const gym = item.gym
      if (isTodayShown) {
        // Kímélő mód S2 (prototype `thero()` km): a protected, not-started day. The server serves
        // no plan on a protected day, so the title, the body and the counts fall back to the meso
        // template; the readiness card is not shown (nothing to adjust).
        const protectedPlan = Boolean(openPeriod && isProtected(shownIso) && !completedTodayWorkout && !todaySession?.openWorkout)
        if (!protectedPlan && !workout) return
        const md = mesoDay(shownDay?.day)
        const title = workout?.title ?? md?.type ?? gym.type ?? 'Gym'
        const plan: MuscleSets[] = workout
          ? workout.exercises.map((e) => ({ muscle: e.muscle, sets: e.workingSets }))
          : planOf(md)
        const exerciseCount = workout?.exercises.length ?? md?.exerciseCount ?? 0
        const totalSets = workout ? workout.exercises.reduce((acc, e) => acc + e.sets, 0) : plan.reduce((acc, e) => acc + e.sets, 0)
        // Three-state gating (spec 2026-07-15): a completed instance wins (Kész · Eredmény
        // review), else an open instance (Folyamatban · Folytassuk), else the fresh start.
        // ONE condition drives BOTH the state line and the button — no second state.
        const gymInProgress = Boolean(todaySession?.openWorkout && !completedTodayWorkout)
        // Held at 0 (no minutes fact) while the profile fetch is pending — never the static
        // fallback, which would render then swap to the calibrated number.
        const workoutMinutes = !workout || timingProfilePending
          ? 0
          : estimateSessionMinutes(workout.exercises, timingProfile ?? undefined)
        const heroState = protectedPlan ? 'plan' : completedTodayWorkout ? 'done' : gymInProgress ? 'live' : 'plan'
        // Kihagyás S1 (prototype `thero()`): only the plan state can be skipped.
        const heroSkip = !protectedPlan && heroState === 'plan' ? todayGymSkip : undefined
        // Kímélő mód S2: the comeback ramp session, and a released protected day („Ma mégis edzek").
        const comeback = !protectedPlan && heroState === 'plan' && !heroSkip && workout?.comeback?.mode === 'RAMP' ? workout.comeback : null
        const released = !protectedPlan && heroState === 'plan' && !heroSkip && Boolean(openPeriod?.releasedDates.includes(shownIso))
        const releasedLight = released && !openPeriod!.releasedUnlightened.includes(shownIso)
        const loggedCount = (completedTodayWorkout ?? todaySession?.openWorkout)?.sets.filter((s) => !s.skipped).length ?? 0
        // The muscle tags and the caption: one per region today's plan loads (silent regions drop
        // out). On a gym day with a served plan these are `impactRows` (computed once above).
        const tagRows = (workout ? impactRows : dayImpact(plan.map((e) => ({ muscle: e.muscle, workingSets: e.sets })), {}))
          .filter((r) => r.plannedSets > 0 && r.token)
        const topRegion = [...tagRows].sort((a, b) => b.plannedSets - a.plannedSets)[0]?.region
        const state = protectedPlan ? `${KIMELO.innerTitle} · ${openPeriod!.dayIndex}. nap`
          : heroSkip ? 'Kihagyva'
            : comeback ? comebackPillLabel(comeback)
              : heroState === 'done' ? `Kész · ${loggedCount} szett a ${outOf(totalSets)}`
                : heroState === 'live' ? `Folyamatban · ${loggedCount} szett kész a ${outOf(totalSets)}`
                  : 'Betervezve'
        const caption = protectedPlan ? 'kímélő mód · ma pihen'
          : heroSkip ? 'ma kimarad'
            : heroState === 'plan' ? `ennyit kér ma ${(topRegion && REGION_ASKS[topRegion]) || 'a testedtől'}`
              : 'sötét = már megvan'
        const [relTitle, relBody] = KIMELO.released.split(': ')
        heroSkipped = Boolean(heroSkip)
        readyShown = !protectedPlan && !heroSkip && !completedTodayWorkout
          && (readiness.state === 'OFFER' || readiness.state === 'LIGHTENED')
        gymHero = (
          <Hero
            key="hero-gym"
            big
            className={cn('em-hero rise', heroState === 'done' ? 'is-done' : heroState === 'live' && 'is-live',
              (heroSkip || protectedPlan) && 'is-skip', protectedPlan && 'is-km', comeback && 'is-cbk')}
            style={rise(120)}
            label={`Ma ${gym.time ?? ''} · ${currentPhase} · Gym${gym.type ? ` · ${gym.type}` : ''}`}
            verdict={<span className="em-hero-title">{title}</span>}
            sub={<span className="em-hero-state">{state}</span>}
            actions={protectedPlan ? (
              <RecoveryActs period={openPeriod!} busy={recoveryBusy}
                onRelease={() => onRelease(shownIso)} onBetter={onBetter} onNotYet={onNotYet} />
            ) : heroSkip ? (
              <SkippedActs skip={heroSkip}
                onReason={() => setWhy({ target: gymKey(shownIso), title })}
                onUndo={() => undoSkip(heroSkip)} />
            ) : completedTodayWorkout ? (
              // Done: the workout is over (no restart until next week) — the button opens the
              // read-only review of the completed instance (mezo-9bbc).
              <Btn grow className="em-start is-review" onClick={() => navigate(`/train/review/${completedTodayWorkout.id}`)}>
                Eredmény · {loggedCount} szett
              </Btn>
            ) : todaySession?.openWorkout ? (
              // In progress: an open instance exists — resume it (count the logged sets).
              <Btn grow className="em-start is-resume" onClick={openSession}>
                Folytassuk · {loggedCount} szett kész
              </Btn>
            ) : (
              <>
                <Btn grow className="em-start is-go" onClick={openSession}>Indítsuk</Btn>
                {!released && inSkipWindow(shownIso) && (
                  <Lk className="em-skipbtn" onClick={() => startSkip(gymKey(shownIso), title)}>Kihagyom</Lk>
                )}
              </>
            )}
          >
            <GymGraphic
              view={bodyView(plan)}
              entries={bodyEntries(plan, doneByMuscle, 4)}
              caption={caption}
              off={protectedPlan || Boolean(heroSkip)}
              facts={[
                ...(exerciseCount > 0 ? [[exerciseCount, 'gyakorlat'] as [ReactNode, string]] : []),
                ...(totalSets > 0 ? [[totalSets, 'szett'] as [ReactNode, string]] : []),
                ...(workoutMinutes > 0 ? [[`~${workoutMinutes}`, 'perc'] as [ReactNode, string]] : []),
              ]}
            />
            {tagRows.length > 0 && (
              <MuscleTags className="em-mchips" items={tagRows.map((r) => ({ muscle: r.token, label: r.label }))} />
            )}
            {protectedPlan && <RecoveryBox period={openPeriod!} />}
            {heroSkip && <SkippedBox skip={heroSkip} />}
            {comeback && workout && (
              <ComebackPill comeback={comeback} busy={recoveryBusy}
                exercises={workout.exercises.map((e) => ({ id: e.id, name: e.name, sets: e.sets, muscle: e.muscle }))}
                onWaive={onWaive} onUndo={canUndoBetter ? () => onUndoBetter(false) : undefined} />
            )}
            {/* Kímélő mód S2 (prototype `rel`): a released protected day says so, with „Mégse"
                (protected again) and — while lightened — the full-load switch. */}
            {released && (
              <>
                <Box icon="t-kimelo" className="em-kmrel" title={releasedLight ? relTitle : KIMELO.releasedFull}>
                  {releasedLight && relBody ? <p>{relBody.charAt(0).toLocaleUpperCase('hu') + relBody.slice(1)}.</p> : null}
                </Box>
                <div className="fo-under em-kmrel-acts">
                  <Lk disabled={recoveryBusy} onClick={() => onUnrelease(shownIso)}>Mégse</Lk>
                  {releasedLight && (
                    <Lk disabled={recoveryBusy} onClick={() => onFullLoad(shownIso)}>Kikapcsolom a könnyítést</Lk>
                  )}
                </div>
              </>
            )}
          </Hero>
        )
        return
      }

      // Non-today gym day: the /today endpoint only describes today, so the title, the body and
      // the counts come from the meso template (mezo-9bbc; prototype `gymDayHero()`).
      const md = mesoDay(shownDay!.day)
      const done = gymDayDone(shownDay!.day, shownDay?.date)
      // The open instance belongs to THIS day's template (started from here, then
      // left): resume it instead of offering a fresh start (mezo-z9kft). The plain
      // /today resolves to the open instance's template, so `todaySession` names it.
      const resumable = !done && Boolean(md?.id && todaySession?.openWorkout && todaySession.templateSessionId === md.id)
      const target = resumable ? `/train/session?day=${md!.id}` : md ? gymDayTarget(md, weekWorkouts) : null
      const gymState = sessionState({ dayIso: shownDay!.date!, todayIso, timeOfDay: gym.time })
      const gymTitle = gym.type ?? md?.type ?? 'Gym'
      // Kihagyás S1: a not-done, not-started day in the window can be skipped (past ⇒ „Kihagytam").
      const gymSkip = done || resumable ? undefined : findSkip(skips, gymKey(shownIso))
      // Kímélő mód S2: a protected day's session is muted, with no skip (it already kimarad).
      const gymKm = !done && !resumable && isProtected(shownIso)
      const gymCanSkip = !done && !resumable && !gymSkip && !gymKm && inSkipWindow(shownIso)
      const plan = planOf(md)
      const planSets = plan.reduce((acc, e) => acc + e.sets, 0)
      const facts = [md ? `${md.exerciseCount} gyakorlat` : null, gym.duration ? `${gym.duration} perc` : null]
      sessions.push({
        key: 'hero-gym',
        gym: true,
        render: (hero) => (
          <TodaySessionCard
            key="hero-gym"
            hero={hero}
            eyebrow={heroEyebrow}
            tone="gym"
            art="t-dumbbell"
            tag="GYM"
            time={gym.time}
            title={gymTitle}
            facts={hero && plan.length > 0 ? [] : facts}
            graphic={hero && plan.length > 0 ? (
              <GymGraphic
                view={bodyView(plan)}
                entries={bodyEntries(plan, done ? Object.fromEntries(plan.map((e) => [e.muscle, Infinity])) : {}, 7)}
                caption={done ? 'ez dolgozott aznap' : 'ezt kéri aznap a terv'}
                off={!done}
                facts={[
                  [md!.exerciseCount, 'gyakorlat'],
                  [planSets, 'szett'],
                  ...(gym.duration ? [[`~${gym.duration}`, 'perc'] as [ReactNode, string]] : []),
                ]}
              />
            ) : undefined}
            logged={done}
            loggedSummary={done ? 'Kész' : undefined}
            doneCta="Kész · megnézem"
            stateLabel={resumable ? 'FOLYAMATBAN' : SESSION_STATE_LABEL[gymState]}
            ctaLabel={target ? (resumable ? 'Folytassuk' : 'Kezdjük el') : undefined}
            onLog={target ? () => navigate(target) : undefined}
            skipped={gymSkip}
            onSkip={gymCanSkip ? () => startSkip(gymKey(shownIso), gymTitle) : undefined}
            skipLabel={gymState === 'missed' ? 'Kihagytam' : 'Kihagyom'}
            onSkipReason={() => setWhy({ target: gymKey(shownIso), title: gymTitle })}
            onSkipUndo={() => gymSkip && undoSkip(gymSkip)}
            kimelo={gymKm}
          />
        ),
      })
      return
    }

    if (item.kind === 'sport') {
      const vb = item.sport
      const k = sportOf(vb)
      const logged = loggedSportOn(shownIso, k)
      const state = sessionState({ dayIso: shownIso, todayIso, timeOfDay: vb.time })
      // Kihagyás S1: only a recurring slot can be skipped (a one-off event is out of scope).
      const vbKey = sportKey(shownIso, shownDay?.day ?? '', vb.time)
      const vbSkip = logged || vb.oneOff ? undefined : findSkip(skips, vbKey)
      const vbKm = !logged && isProtected(shownIso)
      const vbCanSkip = !logged && !vb.oneOff && !vbSkip && !vbKm && inSkipWindow(shownIso)
      const key = `hero-sport-${k}-${vb.time}-${i}`
      sessions.push({
        key,
        render: (hero) => (
          <TodaySessionCard
            key={key}
            hero={hero}
            eyebrow={heroEyebrow}
            tone={SPORT_TONE[k]}
            art={SPORT_ART[k]}
            tag={SPORT_TAGS[k]}
            time={vb.time}
            title={SPORT_TITLES[k]}
            facts={[`${vb.duration} perc`, vb.role, vb.court]}
            oneOff={Boolean(vb.oneOff)}
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
            skipped={vbSkip}
            onSkip={vbCanSkip ? () => startSkip(vbKey, SPORT_TITLES[k]) : undefined}
            skipLabel={state === 'missed' ? 'Kihagytam' : 'Kihagyom'}
            onSkipReason={() => setWhy({ target: vbKey, title: SPORT_TITLES[k] })}
            onSkipUndo={() => vbSkip && undoSkip(vbSkip)}
            kimelo={vbKm}
          />
        ),
      })
      return
    }

    if (item.kind === 'custom') {
      // A completed saját (custom) workout of the shown day. It has no schedule
      // slot and no state of its own — it is done by construction — so it renders
      // permanently logged, and its done line opens its review, exactly
      // like Heti's SAJÁT/kész row (mezo-9bbc final review, I6).
      const c = item.custom
      const key = `hero-custom-${c.id}`
      sessions.push({
        key,
        render: (hero) => (
          <TodaySessionCard
            key={key}
            hero={hero}
            eyebrow={heroEyebrow}
            tone="gym"
            art="t-dumbbell"
            tag="SAJÁT"
            title={c.title}
            facts={[]}
            logged
            loggedSummary="Kész"
            loggedDetail="Megnézem az összegzést"
            ctaLabel="Megnézem"
            onLog={() => navigate(`/train/review/${c.id}`)}
          />
        ),
      })
      return
    }

    const s = item.running
    const rl = runLoggedFor(s.key)
    const runState = sessionState({ dayIso: shownIso, todayIso, timeOfDay: s.timeOfDay })
    const rKey = runKey(shownIso, s.key)
    const runSkip = rl ? undefined : findSkip(skips, rKey)
    const runKm = !rl && isProtected(shownIso)
    const runCanSkip = !rl && !runSkip && !runKm && inSkipWindow(shownIso)
    const openRunLog = () => setRunLogCtx({
      blockId: activeRunningBlock!.id,
      weekNumber: activeRunningBlock!.currentWeek,
      sessionKey: s.key,
      label: s.label,
      isSprint: s.kind === 'sprint',
      defaultRounds: s.rounds ?? undefined,
    })
    sessions.push({
      key: s.key,
      render: (hero) => (
        <TodaySessionCard
          key={s.key}
          hero={hero}
          eyebrow={heroEyebrow}
          tone="run"
          art="t-run"
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
          skipped={runSkip}
          onSkip={runCanSkip ? () => startSkip(rKey, s.label) : undefined}
          skipLabel={runState === 'missed' ? 'Kihagytam' : 'Kihagyom'}
          onSkipReason={() => setWhy({ target: rKey, title: s.label })}
          onSkipUndo={() => runSkip && undoSkip(runSkip)}
          kimelo={runKm}
          rampNote={nextRun?.iso === shownIso && nextRun.key === s.key}
        />
      ),
    })
  })

  // Sports logged OUTSIDE the schedule (T8 Task 4 final review, mezo-88iwa.9) — the
  // ten-sport flow can log a Kerékpár/Úszás/Túra session on a day whose 3-id schedule
  // has no matching slot. Done by construction, so no state of their own and no action.
  unscheduledLoggedSports.forEach(({ session: ls, kind: k }) => {
    const key = `hero-logged-${ls.id}`
    sessions.push({
      key,
      render: (hero) => (
        <TodaySessionCard
          key={key}
          hero={hero}
          eyebrow={heroEyebrow}
          tone={SPORT_TONE[k]}
          art={SPORT_ART[k]}
          tag={SPORT_TAGS[k]}
          time={ls.time}
          title={SPORT_TITLES[k]}
          facts={[`${ls.duration} perc`]}
          logged
          // Same em-dash honesty rule as the slot-driven session above: kcal is absent
          // from the summary entirely when the wire carries none, never a fake 0.
          loggedSummary={`RPE ${ls.rpe} · ${ls.duration}p` + (ls.kcal != null ? ` · ${ls.kcal} kcal` : '')}
          loggedDetail={ls.time ? `${ls.time}-kor logolva` : null}
        />
      ),
    })
  })

  // Which one is the hero (prototype `mai()`): today's gym poster; else an open custom (saját)
  // instance on a day without a gym slot (real mode, today only — getToday's open-wins day
  // resolution means `workout` already IS the open instance's day plan; mezo-ws2x Finding 4);
  // else the day's gym session, else its first session; else the rest day itself. The resume hero
  // and the rest-day hero never render together (`restDayCard` is gated off an open instance).
  const gymAt = sessions.findIndex((x) => x.gym)
  if (gymAt > 0) sessions.unshift(...sessions.splice(gymAt, 1))
  const resumeOpen = isTodayShown && !shownDay?.gym && todaySession?.openWorkout && workout
  let hero: ReactNode = gymHero
  let others = sessions
  if (!hero && resumeOpen) {
    const n = todaySession!.openWorkout!.sets.filter((s) => !s.skipped).length
    hero = (
      <Hero big className="em-resume rise" style={rise(120)} label="Saját edzés · folyamatban"
        verdict={<span className="em-hero-title">{workout!.title}</span>}
        sub={<span className="em-hero-state">Folyamatban · {n} szett kész</span>}
        left={<Bub icon="t-dumbbell" size={60} />}
        actions={<Btn grow onClick={openSession}>Folytassuk · {n} szett kész</Btn>} />
    )
  } else if (!hero && sessions.length > 0) {
    hero = <div className="em-herowrap rise" style={rise(120)}>{sessions[0].render(true)}</div>
    others = sessions.slice(1)
  } else if (!hero && restDayCard) {
    // Rest day: nothing scheduled on the shown day. Today's hero draws the week (the plan from
    // the meso's days, the done days from this week's workouts — both already loaded) and
    // offers a Saját edzés; a non-today rest day is read-only.
    const gymDays = agenda.map((d) => (d.gym ? planOf(mesoDay(d.day)) : []))
    const maxSets = Math.max(1, ...gymDays.map((p) => p.reduce((acc, e) => acc + e.sets, 0)))
    const weekTubes: VialItem[] = agenda.map((d, i) => {
      const plan = gymDays[i]
      const sets = plan.reduce((acc, e) => acc + e.sets, 0)
      if (d.day === shownDay?.day || d.date === shownIso || sets === 0) {
        return {
          label: d.day, value: '–', pct: 0, hatch: true, mark: '',
          icon: d.sport.length > 0 ? SPORT_ART[sportOf(d.sport[0])] : d.running.length > 0 ? 't-run' : 't-moon',
        }
      }
      const done = gymDayDone(d.day, d.date)
      const top = topMuscle(plan)
      const level = (sets / maxSets) * 96
      return {
        label: d.day, value: sets, pct: done ? level : 0, wl: done ? undefined : level, ghost: !done,
        color: top ? deepMuscle(top) : undefined, mark: (mesoDay(d.day)?.type ?? '').split(' ')[0],
        onClick: () => selectDay(d.day),
        ariaLabel: `${DAY_LABELS[d.day] ?? d.day} · ${mesoDay(d.day)?.type ?? 'Gym'} · ${sets} szett · ${done ? 'megvolt' : 'tervezett'}`,
      }
    })
    hero = isTodayShown ? (
      <Hero className="em-rest rise" style={rise(120)} label="Ma pihenőnap" verdict="Ma pihenőnap van."
        sub="Nincs tervezett edzés mára — a heti rended a Terv fülön találod."
        left={<Bub icon="t-moon" size={56} />}
        actions={<Btn onClick={() => setCustomOpen(true)}>+ Saját edzés</Btn>}>
        <div className="fo-hero-g"><Tubes items={weekTubes} height={96} size="wk" gap={6} aria-label="A heted" /></div>
        <Note>A heted: a teli edények megvoltak, a szaggatott vonal a még hátralévő napok terve.</Note>
      </Hero>
    ) : (
      <Hero className="em-rest rise" style={rise(120)} art="t-moon"
        label={`${dayFull}${shownDay?.date ? ` · ${huMonthDay(shownDay.date).toLocaleLowerCase('hu')}.` : ''}`}
        verdict="Ezen a napon nincs tervezett edzés." />
    )
  }

  const showEnergy = isTodayShown && !fuelDayPending && Boolean(served) && (earned > 0 || pending > 0)
  const showImpact = isTodayShown && hasImpact
  const showPastNote = !isTodayShown && shownIso < todayIso && inSkipWindow(shownIso)
    && orderedToday.some((it) => it.kind === 'gym' || it.kind === 'sport' || it.kind === 'running')
  const showFooterAdd = isTodayShown && !restDayCard && !gymPosterShown
  let n = 0

  return (
    <>
      {/* One-shot entrance choreography (mezo-d20.11). The replayKey is the shown day, so a
          DayStrip tap re-stages the swapped day's cards instead of snapping them in. The group IS
          the page root (`.fo-page`), so the kit's page rhythm applies to its children. */}
      <EntranceGroup replayKey={shownDay?.day ?? 'ma'} className="fo-page em-page">

      {/* DayStrip — the Mon–Sun navigator; tapping a chip swaps the shown day below
          without any refetch (the agenda is already fully loaded). */}
      <DayStrip
        kalauzAnchor="mai-napsav"
        items={dayStripItems(agenda, (d, item) => {
          if (item.kind === 'gym') return gymDayDone(d.day, d.date)
          if (item.kind === 'sport') return sportDoneOn(d.date, sportOf(item.sport))
          // A `custom` item only ever exists for a COMPLETED saját instance.
          if (item.kind === 'custom') return true
          return Boolean(runLoggedFor(item.running.key))
        }, (d, item) => {
          // Kihagyás S1 (prototype `dstrip()`): a skipped session marks its day with the skip glyph.
          if (!d.date) return false
          if (item.kind === 'gym') return Boolean(findSkip(skips, gymKey(d.date)))
          if (item.kind === 'sport') return Boolean(findSkip(skips, sportKey(d.date, d.day, item.sport.time)))
          if (item.kind === 'running') return Boolean(findSkip(skips, runKey(d.date, item.running.key)))
          return false
        })}
        // A real-mode rest day (no gym/sport slot matches today at all) leaves
        // `shownDay` undefined even while today is shown (§ isTodayShown above) —
        // fall back to the real weekday label so the strip still highlights a chip
        // instead of selecting none (review fix, mezo-9bbc).
        selected={shownDay?.day ?? DAY_ORDER[todayIdx()]}
        onSelect={selectDay}
      />

      {hero}

      {/* Check-in 2.0 (mezo-ck2): „Mai állapot" right below the gym hero, as the prototype's
          readyCard() follows thero(); hidden once today's workout is done, on a skipped or a
          protected day. */}
      {gymHero && readyShown && <Section n={++n} title="Mielőtt elkezded" />}
      {gymHero && !heroSkipped && !(openPeriod && isProtected(shownIso) && !completedTodayWorkout && !todaySession?.openWorkout) && (
        <TodayReadiness done={Boolean(completedTodayWorkout)} />
      )}

      {/* The day's other sessions, as steps of one card (prototype `sessStep()`). */}
      {others.length > 0 && (
        <>
          <Section n={++n} title={isTodayShown ? 'Ma még' : 'Ezen a napon még'} />
          <Card className="em-steps rise" style={rise(165)}>
            {others.map((x) => x.render(false))}
          </Card>
        </>
      )}

      {/* Kihagyás S1 (prototype `mai()` past-day note): a past day in the skip window says the
          missed sessions can still get a reason. */}
      {showPastNote && (
        <Card className="em-skwhen">
          <Note>Az elmúlt 7 nap kimaradt alkalmaihoz utólag is megadhatod, miért maradtak ki.</Note>
        </Card>
      )}

      {/* Energy card (Task 8, mezo-tb3s2): the SERVED Fuel energy for today's logged movement
          (planned + extra), plus today's still-pending planned sessions as a preview — never a
          client-side estimate, and never a numeric flash-then-swap while `useFuelDay` is still
          pending. Absent whenever there is nothing to show (no logged movement, nothing pending).
          One vessel, two liquids: what is already in the budget, and what still comes. */}
      {showEnergy && (
        <>
          <Section n={++n} title="A mai keretedhez" />
          <Card className="em-energy rise" aria-label="Amit a mozgásod hozzáad" style={rise(220)}>
            <Head icon="t-flame" title="Amit a mozgásod hozzáad" />
            <Big className="em-energy-main" value={`+${earned}`} unit="kcal" />
            <Split big color="var(--fo-gold)"
              a={earned + pending > 0 ? (earned / (earned + pending)) * 100 : 0}
              b={earned + pending > 0 ? (pending / (earned + pending)) * 100 : 0} />
            <Legend className="em-energy-split" items={[
              { color: 'var(--fo-gold)', label: <><b>{earned} kcal</b> már a keretedben</> },
              ...(pending > 0 ? [{ color: 'var(--fo-gold)', kind: 'hatch' as const, label: <><b>+{pending} kcal</b> még jön, ha megcsinálod</> }] : []),
            ]} />
            <Note className="em-energy-note">
              {todaySession?.openWorkout ? 'A folyamatban lévő edzés a befejezéskor kerül a keretedbe. ' : ''}
              Ugyanez a szám áll a Fuel keretében. Becslés, nem mérés.
            </Note>
          </Card>
        </>
      )}

      {/* Muscle-impact card (Task 5, mezo-88iwa.6): what today's movement loads, region
          by region, in words — never an all-zero table when nothing is actually
          planned (a real rest day with no sport gets no card at all). Each region is one split
          vessel in its own colour: deep = already done, hatched = still planned. */}
      {showImpact && (
        <>
          <Section n={++n} title="Hatás az izomzatodra" />
          <Card className="em-mus rise" style={rise(230)}>
            <Head icon="t-muscle" title="Mit terhel a mai mozgásod" />
            {impactRows.map((row) => {
              const done = Math.min(row.doneSets, row.plannedSets)
              return (
                <MuscleRow key={row.region} className="em-mus-row" muscle={row.token}
                  label={<span className="em-mus-name">{row.label}</span>}
                  sub={<span className="em-mus-word">{row.word}</span>}
                  value={impactIsSportEstimate || row.plannedSets === 0 ? undefined : `${done} / ${row.plannedSets} szett`}
                  split={{ a: (done / maxPlannedImpact) * 100, b: ((row.plannedSets - done) / maxPlannedImpact) * 100 }} />
              )
            })}
            <Note className="em-mus-note">
              {impactIsSportEstimate
                ? 'A folyadék a sport becsült terhelése — nem mért adat. Becslés, nem mérés.'
                : 'A halvány folyadék a tervezett terhelés, a sötét a már megszolgált. Becslés, nem mérés.'}
              {gymAndSportToday && ' A mai gym terved látod itt — a sportod terhelését külön, becsléssel számoljuk.'}
            </Note>
          </Card>
        </>
      )}

      {/* „Vagy inkább” — the two other doors (Custom Workout and Sport Log) with the two
          navigation rows under them; without the gym poster the rows stand alone as „Innen
          tovább”, with the today-only „+ Saját edzés" link (the rest-day hero carries its own
          button, so exactly ONE one-off-workout entry exists — mezo-eahv). The Sport door opens
          the full-screen sport flow (mezo-88iwa.9); the session rows still open the sheet — they
          can log against a PAST day (Pótold), a date the flow does not take. */}
      <Section n={++n} title={gymPosterShown ? 'Vagy inkább' : 'Innen tovább'} />
      <Card className="em-nav rise" style={rise(240)}>
        {gymPosterShown && (
          <Pair className="em-alt" items={[
            { icon: 't-dumbbell', small: 'Gyors indítás', label: 'Egyedi edzés', onClick: () => setCustomOpen(true) },
            { icon: 't-volley', small: 'Gyors indítás', label: 'Sport naplózása', onClick: () => navigate('/train/sport/log') },
          ]} />
        )}
        <div className="em-navrows">{navRows}</div>
        {showFooterAdd && <Acts><Lk className="em-add" onClick={() => setCustomOpen(true)}>+ Saját edzés</Lk></Acts>}
      </Card>

      {isTodayShown && showMtr && (
        <>
          <Section n={++n} title="Reggeli edzés-ablak" />
          <MorningTrainingCard
            offending={mtrOffending}
            windowStart={mtrWindow.start}
            windowEnd={mtrWindow.end}
            onApply={applyMtr}
            onSnooze={snoozeMtr}
          />
        </>
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
      <SkipReasonSheet
        open={Boolean(why)}
        skip={why ? findSkip(skips, why.target) : undefined}
        title={why?.title ?? ''}
        onClose={() => setWhy(null)}
        onReason={(reason, text) => why && setReason(why.target, reason, text)}
        // Kímélő mód S2: a serious reason offers „Meddig tarthat?" while no period is open. The
        // period starts on the skipped day — never later than today (the server's window).
        canOpenRecovery={!openPeriod}
        onOpenRecovery={(estimate) => {
          const cur = why ? findSkip(skips, why.target) : undefined
          if (!cur) return Promise.reject(new Error('no skip row'))
          return openRecovery.mutateAsync({
            category: cur.reasonCategory, estimate, startDate: cur.date < clockIso ? cur.date : clockIso,
          })
        }}
        onRecoveryOpened={() => {
          // Today's (or a later) skip is replaced by the period (prototype: the retro rows stay).
          const cur = why ? findSkip(skips, why.target) : undefined
          if (cur && (cur.date >= clockIso || cur.date === todayIso)) undo(cur.id)
          // The undone row unmounts the sheet mid-exit (its onClose never runs) — clear it here.
          setWhy(null)
        }}
        onDone={(text) => {
          // The sheet already toasts „Megjegyeztem · …"; only an Egyéb text still needs saving.
          const cur = why ? findSkip(skips, why.target) : undefined
          if (why && cur?.reasonCategory === 'OTHER' && (text ?? null) !== (cur.reasonText ?? null)) {
            setReason(why.target, 'OTHER', text)
          }
        }}
      />
      {/* „Üdv újra!" (Kímélő mód S2): after „Jobban vagyok" the server's return rule, with the
          active meso's (possibly shifted) current week for the calendar line. */}
      {welcome && period?.return && (
        <WelcomeBackSheet ret={period.return} week={activeMeso.currentWeek} showRun={Boolean(activeRunningBlock)}
          busy={recoveryBusy}
          onClose={closeWelcome}
          onOk={() => toast.show({ kind: 'success', text: KIMELO.toastWelcome })}
          onUndo={() => onUndoBetter(true)} />
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
