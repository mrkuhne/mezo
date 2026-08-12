// ============================================================
// Mezo · TodayPage — the Mai screen's composition root (mezo-puci,
// daypart-tabs re-composition over the mezo-euze wiring).
// The screen is a SCROLLING page in three fixed bands: the daypart
// switcher (DaypartTabs), the companion's voice as a single 44px chip
// (MezoChip, the same on every daypart — the full thread lives in
// MezoMessagesSheet, opened on tap) and the SELECTED daypart's complete
// content — hero, facts, CTA and every row, with no card frame and
// nothing folded away but the day's finished items. `?dp=` stays the
// single source of truth for which daypart is shown, derived from the
// URL and never mirrored into state — the TrainTodayPage `?day=`
// precedent, including its two traps: `params.get()` returns `null`
// when absent and `''` when blank, and both must mean "the current
// face". Every source is normalized by todayItems.ts; this file only
// wires hooks to the daypart views and dispatches row actions.
//
// This page is also the sheet host the retired cards were: `act()`
// serves every habitAction kind and every questAction kind it can
// reach a surface for.
//
// The ItemRow doctrine — "no control that does nothing" — is NOT
// guaranteed by `act()` alone: the guarantee is enforced in the
// `items` useMemo, which STRIPS the action from any row this screen
// cannot serve (see `servableAction`). Any future action kind must be
// handled in BOTH places or the row will show a pill that does nothing.
//
// It likewise carries the consume-once level-up dance.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useActivities, useCheckins, useCompanionNote, useDailyQuests, useFuelPreview, useGoal,
  useHabitActions, useHabitCatalog, useHabitDay, useIntentionActions, useIntentionDay,
  useQuestActions, useQuickStats, useRitualDay, useSleep, useSleepGoal, useToday,
  useTodayScenario, useWaterActions, useWeight, resolveBriefing,
} from '@/data/hooks'
import { AppHero } from '@/features/progression/components/AppHero'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { AnchorIsland } from '@/features/today/components/AnchorIsland'
import { DaypartDay, type DayHero } from '@/features/today/components/DaypartDay'
import { DaypartEvening } from '@/features/today/components/DaypartEvening'
import { DaypartMorning } from '@/features/today/components/DaypartMorning'
import { DaypartPanel } from '@/features/today/components/DaypartPanel'
import { DaypartTabs } from '@/features/today/components/DaypartTabs'
import { MezoChip } from '@/features/today/components/MezoChip'
import { MezoMessagesSheet } from '@/features/today/components/MezoMessagesSheet'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'
import TodaySkeleton from '@/features/today/pages/TodaySkeleton'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import { ReflectSheet } from '@/features/today/sheets/ReflectSheet'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { questAction } from '@/features/today/logic/questAction'
import { habitAction, habitHint } from '@/features/today/logic/habitAction'
import { growthTodaySummary } from '@/features/today/logic/growthToday'
import {
  dayBalance, fallbackHero, hrvFact, kcalFact, morningHero, proteinFact, sleepOutlook, weightFact,
  type IslandFact,
} from '@/features/today/logic/islandFacts'
import { DAY_FACES, dayFace, type DayFace as Face } from '@/features/today/logic/dayFace'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import {
  buildTodayItems, isFillableSlot, itemsForFace,
  type SessionItemInput, type TodayItem,
} from '@/features/today/logic/todayItems'
import { sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, SPORT_TONE } from '@/features/train/logic/sportKinds'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { localDateString } from '@/shared/lib/dates'
import { lastSeenMessage, markMessagesSeen } from '@/shared/lib/seenMessages'
import { Icon } from '@/shared/ui/Icon'
import type { DailyQuest, HabitChainInfo, HabitDaypart, MealSlot } from '@/data/types'

const isFace = (v: string | null): v is Face => v !== null && (DAY_FACES as readonly string[]).includes(v)

/**
 * Can THIS screen actually serve the item's action? The ItemRow doctrine's enforcement point:
 * `buildTodayItems` labels every habit and every offered quest, but three families have no
 * surface here, and a labelled row with nowhere to go is a dead button.
 *  • habit → `habitAction` is `'none'`: a pending DERIVED habit with no log surface of its own.
 *  • quest → `questAction` is `null`: a metric with no Today surface (`growth_intention` ships).
 *  • quest → a `checkin` CTA on a day where every slot is already recorded, so `act()` has no
 *    index to open. A `skipped` slot does NOT close this: it is still fillable (`isFillableSlot`).
 */
function servableAction(item: TodayItem, hasFillableCheckin: boolean): boolean {
  const a = item.action
  if (!a) return false
  if (a.kind === 'habit') return habitAction(a.habit).kind !== 'none'
  if (a.kind !== 'quest') return true
  const qa = questAction(a.quest)
  if (!qa) return false
  return qa.kind !== 'checkin' || hasFillableCheckin
}

/**
 * One session of the day, shaped so a SINGLE object serves both of its roles: the normalizer's
 * `SessionItemInput` (the row) and the day view's `DayHero` (the hero), keyed by the id the
 * item carries. Authored once (`sessions` below) and never re-derived.
 */
type DaySession = SessionItemInput & { ctaLabel: string }

/** A session's hero: the same object, minus the item identity, plus the CTA's handler. */
const heroCardOf = (s: DaySession, onLog: () => void): DayHero => {
  const { id: _itemId, ...card } = s
  return { ...card, onLog }
}

export function TodayPage() {
  const date = localDateString()
  const scenario = useTodayScenario()
  const { user, workout, volleyballSessions, workoutTime, prediction, briefing, briefingDemo } = useToday()
  const { checkins, saveCheckIn } = useCheckins()
  const { goal: sleepGoal, isPending: sleepGoalPending } = useSleepGoal()
  const { quests, levelUps: questLevelUps } = useDailyQuests(date)
  const { consumeLevelUps: consumeQuestLevelUps } = useQuestActions(date)
  const { data: activities } = useActivities(date)
  const { habits, levelUps: habitLevelUps } = useHabitDay(date)
  // The routine editor's live catalog (mezo-n5e9.2) — `buildTodayItems` looks up each habit's
  // chain here (title/daypart) instead of a hardcoded MORNING/EVENING map.
  const { catalog: habitCatalog } = useHabitCatalog()
  const { check, pending: habitPending, consumeLevelUps: consumeHabitLevelUps } = useHabitActions(date)
  const { data: ritualDay } = useRitualDay(date)
  const { visible: fuelSlots, plan: fuelPlan } = useFuelPreview()
  const { logWater } = useWaterActions(date)
  const { sleepLog, lastNight, logSleep } = useSleep()
  const { weightLog } = useWeight()
  const { goal: userGoal } = useGoal()
  const { data: intention } = useIntentionDay(date)
  const { addFocus, reflect } = useIntentionActions(date)
  const stats = useQuickStats()
  const companionNote = useCompanionNote()
  const { showLevelUp } = useLevelUp()
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)
  const [activityQuest, setActivityQuest] = useState<DailyQuest | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [mealOpen, setMealOpen] = useState<{ slot?: MealSlot } | null>(null)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [reflectOpen, setReflectOpen] = useState(false)
  const [msgsOpen, setMsgsOpen] = useState(false)
  const [seenId, setSeenId] = useState<string | null>(() => lastSeenMessage(date))

  // Consume-once level-ups: quest and habit completions are evaluated SERVER-side on a day
  // read, so their celebration arrives on the cached day rather than from a mutation's
  // resolution. Without the consume the payload replays on every remount within gcTime.
  useEffect(() => {
    if (questLevelUps.length > 0) {
      showLevelUp(questLevelUps[0])
      consumeQuestLevelUps()
    }
  }, [questLevelUps, showLevelUp, consumeQuestLevelUps])
  useEffect(() => {
    if (habitLevelUps.length > 0) {
      showLevelUp(habitLevelUps[0])
      consumeHabitLevelUps()
    }
  }, [habitLevelUps, showLevelUp, consumeHabitLevelUps])

  const sportToday = volleyballSessions.find((s) => s.today)
  // The day's sessions, authored EXACTLY ONCE (mezo-mvb4.1): the row and the hero are the same
  // object, so tag/facts/CTA drift is structurally impossible.
  // Array order IS hero precedence: the gym session wins, a sport session heroes on a rest day.
  const gymMinutes = workout ? estimateSessionMinutes(workout.exercises) : 0
  const sessions = useMemo<DaySession[]>(() => [
    ...(workout ? [{
      id: 'gym', tone: 'gym' as const, emoji: '🏋️',
      tag: `GYM${workout.tag ? ` · ${workout.tag}` : ''}`, title: workout.title,
      time: workoutTime ?? null,
      facts: [`${workout.exercises.length} gyakorlat`, gymMinutes > 0 ? `~${gymMinutes} perc` : null, prediction?.label],
      logged: false, ctaLabel: 'Indítsuk',
    }] : []),
    ...(sportToday ? [{
      id: 'sport', tone: SPORT_TONE[sportOf(sportToday)], emoji: SPORT_EMOJI[sportOf(sportToday)],
      tag: SPORT_TAGS[sportOf(sportToday)], title: SPORT_TITLES[sportOf(sportToday)],
      time: sportToday.time, facts: [`${sportToday.duration} perc`, sportToday.court, sportToday.role],
      logged: false, ctaLabel: 'Logold',
    }] : []),
  ], [workout, workoutTime, prediction, sportToday, gymMinutes])
  const heroSession = sessions[0] ?? null
  const heroItemId = heroSession ? `session:${heroSession.id}` : null

  const items = useMemo(() => {
    const built = buildTodayItems({
      quests, habits, checkins, fuelSlots, ritual: ritualDay, goal: sleepGoal, sessions,
      chains: habitCatalog.chains,
    })
    // The ItemRow doctrine, enforced for EVERY source in one place: a row keeps its action
    // only when this screen can serve it (`servableAction`), otherwise the row survives and
    // the pill goes. A stripped habit picks up `habitHint`'s explainer.
    const hasFillableCheckin = checkins.some(isFillableSlot)
    return built.map((i) => {
      // The promoted session's face follows its HERO: the day view is where it renders,
      // so the item belongs to `nap` whatever the session's start.
      const faced = i.id === heroItemId ? { ...i, face: 'nap' as const } : i
      if (servableAction(faced, hasFillableCheckin)) return faced
      const hint = faced.action?.kind === 'habit' ? habitHint(faced.action.habit) : null
      return { ...faced, action: null, subtitle: hint ?? faced.subtitle }
    })
  }, [quests, habits, checkins, fuelSlots, ritualDay, sleepGoal, sessions, heroItemId, habitCatalog.chains])

  // The current face comes from the clock; `?dp=` overrides it. Absent (`null`) and
  // blank (`''`) both mean "current" — neither may fall through to a parsed value.
  const current = dayFace(new Date(), sleepGoal)
  const raw = params.get('dp')
  const selected: Face = isFace(raw) ? raw : current
  const selectFace = (face: Face) => {
    const next = new URLSearchParams(params)
    if (face === current) next.delete('dp')
    else next.set('dp', face)
    setSearchParams(next, { replace: true })
    // The app's single scroller. `?dp=` is a search-param change, so ScreenContent's
    // pathname-keyed reset does NOT fire — a tab switch must land at the top itself.
    // scrollTop assignment (not scrollTo) — works in every engine incl. jsdom.
    const scroller = document.querySelector('.screen-content')
    if (scroller instanceof HTMLElement) scroller.scrollTop = 0
  }

  // The identity header is rendered ONCE, above every branch (mezo-mvb4.1): `.apphero` is a
  // sticky row, and it must be the same element in the same position in all trees so React
  // keeps the DOM node across the pending → resolved transition.
  const appHero = (
    <AppHero
      utilities={<Link to="/insights" aria-label="Insights" className="icon-btn"><Icon name="sparkle" size={18} /></Link>}
    />
  )

  // `anchorMode` derives SYNCHRONOUSLY from `?day=` — checked FIRST, before the pending gate,
  // so a real-mode `/today?day=rough` visit never flashes the skeleton before the calm view.
  // The melt REPLACES the day: no tabs, no message band, no daypart — one warm island.
  // It still sits in `DaypartPanel`, which is the page's margin, not a card: AnchorIsland's
  // own elements used to take their horizontal inset from the retired island shell
  // (`.isl-bigview`), and `.dayview`'s padding is what gives it back.
  if (scenario.anchorMode) {
    return (
      <>
        {appHero}
        {/* The tone is a CONSTANT here, never `current` — `DaypartPanel` puts `key={tone}` on
            its root to cross-fade a tab switch, and `current` is re-derived from `new Date()`
            on every render. A clock-derived tone would flip the key the first time a render
            (a focus refetch, or just the ghost → real sleep-anchor re-render) landed on the far
            side of a daypart boundary, remounting the melt and silently discarding
            AnchorIsland's local tick state, which is persisted nowhere. The melt is not a
            daypart, so it has no tone of its own to be right about. Keep it constant. */}
        <DaypartPanel tone="reggel"><AnchorIsland /></DaypartPanel>
      </>
    )
  }
  // The face selection depends on the sleep anchor; rendering before it resolves would
  // flash the wrong daypart in real mode. The skeleton mirrors the page layout.
  if (sleepGoalPending) return <>{appHero}<TodaySkeleton /></>

  // A daypart never renders its hero twice: the promoted session leaves the row lists by ID.
  const faceItems = itemsForFace(items, selected)
  const open = faceItems.open.filter((i) => i.id !== heroItemId)
  const done = faceItems.done.filter((i) => i.id !== heroItemId)
  const doneXp = done.reduce((s, i) => s + (i.xp ?? 0), 0)
  const dayXp = items.filter((i) => i.status === 'done').reduce((s, i) => s + (i.xp ?? 0), 0)
    + (activities ?? []).reduce((s, e) => s + e.xpAwarded, 0)

  // A row's action is dispatched through the SAME mappings the old cards used —
  // ADR 0010: nothing here ever self-completes a quest or a DERIVED habit.
  const act = (item: TodayItem) => {
    const a = item.action
    if (!a) return
    if (a.kind === 'checkin') return setCheckInIdx(a.slotIdx)
    if (a.kind === 'nav') {
      // A fuel row logs IN PLACE — the retired FuelTimelinePreview's `+ Log` chip.
      return item.source === 'fuel' ? setMealOpen({}) : navigate(a.to)
    }
    if (a.kind === 'quest') {
      const qa = questAction(a.quest)
      if (!qa) return
      if (qa.kind === 'water') return logWater(qa.amountMl)
      if (qa.kind === 'checkin') {
        const idx = checkins.findIndex(isFillableSlot)
        return idx >= 0 ? setCheckInIdx(idx) : undefined
      }
      if (qa.kind === 'activity') return setActivityQuest(a.quest)
      return navigate(qa.to)
    }
    const ha = habitAction(a.habit)
    switch (ha.kind) {
      case 'check':
        check(a.habit.key).then((lu) => lu?.[0] && showLevelUp(lu[0]))
        return
      case 'nav': return navigate(ha.to)
      case 'meal-sheet': return setMealOpen({ slot: 'breakfast' })
      case 'sleep-sheet': return setSleepOpen(true)
      case 'intention-sheet': return setFocusOpen(true)
      case 'intention-reflect': return setReflectOpen(true)
      case 'none': return
    }
  }

  // Per-chain progress + celebrations, keyed by the catalog's own `chainKey` (mezo-n5e9.4).
  const chainProgress = (chainKey: string) => {
    const steps = habits.filter((h) => h.chain === chainKey)
    return { done: steps.filter((h) => h.status === 'done').length, total: steps.length }
  }
  const activeChains = [...habitCatalog.chains].filter((c) => c.isActive).sort((a, b) => a.position - b.position)
  const chainCelebrationText = (c: HabitChainInfo): string => {
    if (c.chainKey === 'MORNING') return '🌅 Tökéletes reggel'
    if (c.chainKey === 'EVENING') return '🌙 Tökéletes este'
    return `✨ ${c.title} kész`
  }
  const celebrationsFor = (daypart: HabitDaypart) =>
    activeChains
      .filter((c) => c.daypart === daypart)
      .map((c) => ({ id: c.id, text: chainCelebrationText(c), ...chainProgress(c.chainKey) }))

  const growth = growthTodaySummary(quests, activities ?? [])

  // A mezo hangja: a nap üzenet-szála a MÁR MEGLÉVŐ két hookból — nincs új adatforrás.
  // Az olvasatlan-jelzés a szál UTOLSÓ elemének id-jét hasonlítja a napra mentett
  // `localStorage` értékhez; a napváltás magától elavulttá teszi a kulcsot.
  const messages = buildMezoMessages({
    briefing: briefing ?? resolveBriefing(scenario.dayState),
    note: companionNote,
    briefingDemo,
  })
  const latestId = messages.length > 0 ? messages[messages.length - 1].id : null
  const msgsUnread = latestId != null && latestId !== seenId
  const openMessages = () => {
    setMsgsOpen(true)
    if (latestId) {
      markMessagesSeen(date, latestId)
      setSeenId(latestId)
    }
  }

  // ── Daypart facts (pure derivations; a missing source means a missing cell, never `—`) ──
  const morningFacts = [weightFact(weightLog, userGoal?.targetWeight ?? null), hrvFact(stats)]
    .filter((f): f is IslandFact => f != null)
  const dayFacts = [proteinFact(fuelPlan?.slots ?? []), kcalFact(fuelPlan?.energy)]
    .filter((f): f is IslandFact => f != null)
  const eveningFacts = [dayBalance(growth, dayXp), sleepOutlook(sleepGoal)]
  const mHero = morningHero(lastNight, sleepLog, sleepGoal)
    ?? fallbackHero(itemsForFace(items, 'reggel').open.length)

  const dayHero: DayHero | null = heroSession ? heroCardOf(heroSession, () => navigate('/train')) : null

  return (
    <>
      {appHero}
      {scenario.vulnerable && <VulnerabilityCard />}
      <DaypartTabs selected={selected} current={current} onSelect={selectFace} />
      <MezoChip messages={messages} unread={msgsUnread} onOpen={openMessages} />
      {selected === 'reggel' && (
        <DaypartMorning
          hero={mHero} facts={morningFacts}
          open={open} done={done} doneXp={doneXp}
          celebrations={celebrationsFor('MORNING')} growth={growth}
          habitPending={habitPending} onAct={act}
        />
      )}
      {selected === 'nap' && (
        <DaypartDay
          hero={dayHero}
          heroWarn={scenario.niggle ? workout?.niggleWarning?.detail ?? null : null}
          facts={dayFacts}
          mesoLine={user.weekInMeso ? `${user.weekInMeso}. mezóhét` : null}
          open={open} done={done} doneXp={doneXp}
          note={companionNote} celebrations={celebrationsFor('DAY')} growth={growth}
          habitPending={habitPending} onAct={act} onCustom={() => setCustomOpen(true)}
        />
      )}
      {selected === 'este' && (
        <DaypartEvening
          open={open} done={done} dayXp={dayXp} facts={eveningFacts}
          note={companionNote} celebrations={celebrationsFor('EVENING')} growth={growth}
          habitPending={habitPending} onAct={act}
        />
      )}

      {checkInIdx !== null && (
        <CheckInSheet
          slot={checkins[checkInIdx]} slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)}
          onSave={(data) => saveCheckIn(checkInIdx, data)}
        />
      )}
      {activityQuest && <ActivityLogSheet quest={activityQuest} onClose={() => setActivityQuest(null)} />}
      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      {mealOpen && <LogMealSheet initialSlot={mealOpen.slot} onClose={() => setMealOpen(null)} />}
      {sleepOpen && <SleepLogSheet onClose={() => setSleepOpen(false)} onSave={logSleep} />}
      {focusOpen && <IntentionSheet creed={intention.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {reflectOpen && <ReflectSheet onReflect={reflect} onClose={() => setReflectOpen(false)} />}
      {msgsOpen && <MezoMessagesSheet messages={messages} onClose={() => setMsgsOpen(false)} />}
    </>
  )
}
