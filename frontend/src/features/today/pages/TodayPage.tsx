// ============================================================
// Mezo · TodayPage — the Mai screen's composition root (mezo-j7u4).
// The screen has three sleep-anchored daypart faces (dayFace.ts); `?dp=` is the
// single source of truth for which one renders, derived from the URL and never
// mirrored into state — the TrainTodayPage `?day=` precedent, including its two
// traps: `params.get()` returns `null` when absent and `''` when blank, and both
// must mean "the current face" rather than falling through to a parsed value.
// Every source is normalized by todayItems.ts, so this file only wires hooks to
// faces and dispatches row actions; it holds no per-domain branching.
//
// This page is also the sheet host the retired cards were: `act()` serves every
// habitAction kind (the four sheet-bearing ones came from RoutineCard) and every
// questAction kind it can reach a surface for.
//
// The ItemRow doctrine — "no control that does nothing" — is NOT guaranteed by
// `act()` alone: `buildTodayItems` labels every habit and every offered quest, so
// the guarantee is enforced one step earlier, in the `items` useMemo, which STRIPS
// the action from any row this screen cannot serve (see `servableAction` below).
// `act()`'s own early returns are therefore belt-and-braces, not the guard. Any
// future action kind must be handled in BOTH places or the row will show a pill
// that does nothing.
//
// It likewise carries the consume-once level-up dance that TodayQuestsCard and
// RoutineCard each used to run.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useActivities, useCheckins, useCompanionNote, useDailyQuests, useFuelPreview, useHabitActions,
  useHabitCatalog, useHabitDay, useIntentionActions, useIntentionDay, useQuestActions,
  useQuickStats, useRitualDay, useSleep, useSleepGoal, useToday, useTodayScenario, useWaterActions,
  resolveBriefing,
} from '@/data/hooks'
import { AppHero } from '@/features/progression/components/AppHero'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { GreetingHeader } from '@/features/today/components/GreetingHeader'
import { DayFaceStrip } from '@/features/today/components/DayFaceStrip'
import { FaceMorning } from '@/features/today/components/FaceMorning'
import { FaceDay, type DayHero } from '@/features/today/components/FaceDay'
import { FaceEvening } from '@/features/today/components/FaceEvening'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'
import { AnchorModeView } from '@/features/today/pages/AnchorModeView'
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
import { DAY_FACES, dayFace, type DayFace as Face } from '@/features/today/logic/dayFace'
import {
  buildTodayItems, isFillableSlot, itemsForFace, openCountByFace,
  type SessionItemInput, type TodayItem,
} from '@/features/today/logic/todayItems'
import { sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, SPORT_TONE } from '@/features/train/logic/sportKinds'
import { localDateString } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import type { DailyQuest, HabitChainInfo, HabitDaypart, MealSlot } from '@/data/types'

const isFace = (v: string | null): v is Face => v !== null && (DAY_FACES as readonly string[]).includes(v)

/** Which way the face-swap should read spatially: forward through Reggel → Nap → Este
 *  enters from the left, backward from the right (mezo-1khu, `.faceswap[data-dir]`). */
const dirOf = (from: Face, to: Face): 'fwd' | 'back' =>
  DAY_FACES.indexOf(to) >= DAY_FACES.indexOf(from) ? 'fwd' : 'back'

/**
 * Can THIS screen actually serve the item's action? The ItemRow doctrine's enforcement point:
 * `buildTodayItems` labels every habit and every offered quest, but three families have no
 * surface here, and a labelled row with nowhere to go is a dead button.
 *  • habit → `habitAction` is `'none'`: a pending DERIVED habit with no log surface of its own
 *    (`bed_on_time`, which TOMORROW's sleep log decides).
 *  • quest → `questAction` is `null`: a metric with no Today surface. This is live production
 *    data, not a hypothetical — the quest catalogue ships `growth_intention`
 *    (`metric: intention_focus_set`, `dayTypes: ["ANY"]`), which questAction.ts does not map.
 *  • quest → a `checkin` CTA on a day where every slot is already recorded, so `act()` has no
 *    index to open (the retired TodayQuestsCard guarded exactly this with
 *    `showCta = action !== null && (kind !== 'checkin' || onCheckIn !== undefined)`). A
 *    `skipped` slot does NOT close this: it is still fillable (`isFillableSlot`), so the CTA
 *    survives as long as any slot is unrecorded.
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
 * `SessionItemInput` (the row) and `FaceDay`'s `DayHero` (the card), keyed by the id the item
 * carries. Authored once (`sessions` below) and never re-derived — that duplication is what let
 * the hero and the row disagree about tag, facts and CTA.
 */
type DaySession = SessionItemInput & { ctaLabel: string }

/** A session's hero card: the same object, minus the item identity, plus the CTA's handler. */
const heroCardOf = (s: DaySession, onLog: () => void): DayHero => {
  const { id: _itemId, ...card } = s
  return { ...card, onLog }
}

export function TodayPage() {
  const date = localDateString()
  const scenario = useTodayScenario()
  const {
    today, user, workout, volleyballSessions, workoutTime, prediction,
    briefing, briefingDemo, volleyballNote,
  } = useToday()
  const { checkins, saveCheckIn } = useCheckins()
  const { goal: sleepGoal, isPending: sleepGoalPending } = useSleepGoal()
  const { quests, levelUps: questLevelUps } = useDailyQuests(date)
  const { consumeLevelUps: consumeQuestLevelUps } = useQuestActions(date)
  const { data: activities } = useActivities(date)
  const { habits, levelUps: habitLevelUps } = useHabitDay(date)
  // The routine editor's live catalog (mezo-n5e9.2) — `buildTodayItems` looks up each habit's
  // chain here (title/daypart) instead of a hardcoded MORNING/EVENING map. Unresolved in real
  // mode (`{chains: []}`) means every habit is skipped below, never a crash — see todayItems.ts.
  const { catalog: habitCatalog } = useHabitCatalog()
  const { check, pending: habitPending, consumeLevelUps: consumeHabitLevelUps } = useHabitActions(date)
  const { data: ritualDay } = useRitualDay(date)
  const { visible: fuelSlots, nextStack } = useFuelPreview()
  const { logWater } = useWaterActions(date)
  const { logSleep } = useSleep()
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
  // The face-swap's spatial direction (mezo-1khu) — read by `.faceswap[data-dir]`. Set
  // alongside the `?dp=` write in `selectFace`, from the OUTGOING face to the incoming one.
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')

  // Consume-once level-ups. Quest and habit completions are evaluated SERVER-side on a day
  // read, so their celebration arrives on the cached day rather than from a mutation's
  // resolution — exactly what TodayQuestsCard and RoutineCard each did before they retired.
  // Without the consume the payload replays on every remount within gcTime.
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
  // The day's sessions, authored EXACTLY ONCE (mezo-mvb4.1). Before this, the row (here) and the
  // Nap face's hero (below) were two independent computations over the same data built from
  // near-duplicate literals — so they could disagree, and did: a real early gym slot (07:30)
  // bucketed onto `reggel` as an inert `GYM` row while the SAME session was also the Nap hero
  // with a `GYM · {tag}` eyebrow and an `Indítsuk` CTA. Now the hero is a reference to the very
  // object the item is built from, so drift is structurally impossible.
  // Array order IS hero precedence: the gym session wins, a sport session heroes on a rest day.
  const sessions = useMemo<DaySession[]>(() => [
    ...(workout ? [{
      id: 'gym', tone: 'gym' as const, emoji: '🏋️',
      tag: `GYM${workout.tag ? ` · ${workout.tag}` : ''}`, title: workout.title,
      time: workoutTime ?? null,
      facts: [`${workout.exercises.length} gyakorlat`, `~${workout.durationEst} perc`, prediction?.label],
      logged: false, ctaLabel: 'Indítsuk',
    }] : []),
    ...(sportToday ? [{
      id: 'sport', tone: SPORT_TONE[sportOf(sportToday)], emoji: SPORT_EMOJI[sportOf(sportToday)],
      tag: SPORT_TAGS[sportOf(sportToday)], title: SPORT_TITLES[sportOf(sportToday)],
      time: sportToday.time, facts: [`${sportToday.duration} perc`, sportToday.court, sportToday.role],
      logged: false, ctaLabel: 'Logold',
    }] : []),
  ], [workout, workoutTime, prediction, sportToday])
  // The one session the Nap face promotes to its hero, and the id of its item. Everything
  // downstream keys off THIS id — never off `source === 'session'`, which also swept away the
  // sessions that are NOT the hero (a 17:00 sport session next to a gym day rendered nowhere).
  const heroSession = sessions[0] ?? null
  const heroItemId = heroSession ? `session:${heroSession.id}` : null

  const items = useMemo(() => {
    const built = buildTodayItems({
      quests, habits, checkins, fuelSlots, ritual: ritualDay, goal: sleepGoal, sessions,
      chains: habitCatalog.chains,
    })
    // The ItemRow doctrine, enforced for EVERY source in one place: a row keeps its action
    // only when this screen can serve it (`servableAction`), otherwise the row survives and
    // the pill goes — never a control that does nothing. A stripped habit also picks up
    // `habitHint`'s explainer, so a button-less row reads as "this ticks by itself" rather
    // than as broken (the retired RoutineCard's quiet hint line).
    // Done HERE, not in todayItems.ts — the normalizer's action data is right; it is this
    // screen that decides what it can serve.
    const hasFillableCheckin = checkins.some(isFillableSlot)
    return built.map((i) => {
      // The promoted session's face follows its HERO, not its clock time: FaceDay is where the
      // hero renders, so the item belongs to `nap` whatever the session's start. Without this an
      // early gym slot would bucket onto `reggel`, be filtered off that face as the hero, and
      // vanish — instead it is previewed there as a „Ma még vár rád" row that jumps to Nap.
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
    setDir(dirOf(selected, face))
    const next = new URLSearchParams(params)
    if (face === current) next.delete('dp')
    else next.set('dp', face)
    setSearchParams(next, { replace: true })
  }

  // `anchorMode` is derived SYNCHRONOUSLY from the `?day=` URL param (useTodayScenario →
  // todayHooks.ts) — it never waits on `useSleepGoal`, so it is checked FIRST. Checking the
  // pending gate first would flash the generic TodaySkeleton before swapping to
  // AnchorModeView on a real-mode `/today?day=rough` visit — a jarring detour into a screen
  // whose entire purpose is a calm, low-demand recovery moment. (Train's own `!activeMeso`
  // branch has no such ordering choice to make: it IS gated by the same async data as its
  // pending check, so pending-first there is forced, not merely conventional — the two
  // situations only look alike.)
  // The identity header is rendered ONCE, above both the pending gate and the faces
  // (mezo-mvb4.1). `.apphero` is a 65 px `position: sticky` row, so returning the skeleton
  // *instead of* it made a cold real-mode load paint headerless and then shove the whole page
  // down 65 px the moment the anchor resolved — the exact reflow the skeleton exists to
  // prevent, and larger than the ~150–160 px content shrink the team measured and accepted.
  // (`TrainSection` gets this for free by rendering `AppHero` above its `<Outlet>`; TodayPage
  // is a leaf page with no such shell, so it must do it itself.) Because it is the same element
  // in the same position in both trees, React keeps the DOM node across the transition.
  const appHero = (
    <AppHero
      utilities={<Link to="/insights" aria-label="Insights" className="icon-btn"><Icon name="sparkle" size={18} /></Link>}
    />
  )

  if (scenario.anchorMode) return <AnchorModeView />
  // The face selection depends on the sleep anchor; rendering before it resolves would
  // flash the wrong face in real mode. The skeleton is layout-matched (TrainTodaySkeleton
  // precedent) so the swap does not shift the page.
  if (sleepGoalPending) return <>{appHero}<TodaySkeleton /></>

  // A face never renders the hero twice: the promoted session leaves the row lists by ID
  // (mezo-mvb4.1). This replaced `FaceDay`'s `source !== 'session'` filter, which threw out
  // EVERY session — so on a stacked day the non-hero one (a 17:00 sport session inside the nap
  // window) had no surface at all. The pill counters still count it on its face: it IS an open
  // item there, just rendered as a hero rather than as a row.
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
      // A fuel row logs IN PLACE — the retired FuelTimelinePreview's `+ Log` chip. Every
      // other nav row follows its route; the normalizer keeps `/fuel` as the honest fallback
      // for a host without the sheet.
      return item.source === 'fuel' ? setMealOpen({}) : navigate(a.to)
    }
    if (a.kind === 'quest') {
      const qa = questAction(a.quest)
      if (!qa) return
      if (qa.kind === 'water') return logWater(qa.amountMl)
      if (qa.kind === 'checkin') {
        // The first slot that is still fillable — the same predicate `servableAction` gated the
        // pill on, so the CTA can never appear without an index to open (and a `skipped` morning
        // slot is a legitimate target: the sheet backfills it).
        const idx = checkins.findIndex(isFillableSlot)
        return idx >= 0 ? setCheckInIdx(idx) : undefined
      }
      if (qa.kind === 'activity') return setActivityQuest(a.quest)
      return navigate(qa.to)
    }
    // EVERY habitAction kind is served here — the four sheet-bearing ones are the ones
    // RoutineCard hosted before it retired. `none` never reaches this point in practice:
    // those items lost their action above, so they render no button at all.
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

  // Per-chain progress, keyed by the catalog's own `chainKey` (mezo-n5e9.4 — the Task 2 review
  // carry-over): this used to literal-filter `h.chain === 'MORNING'/'EVENING'`, so a second
  // morning-daypart chain or a custom chain created via the routine editor would get Today rows
  // but no progress/celebration surface. `chainKey` is generic now — the CALLER decides which
  // chain(s) it means, sourced from `habitCatalog.chains` below, never a hardcoded literal.
  const chainProgress = (chainKey: string) => {
    const steps = habits.filter((h) => h.chain === chainKey)
    return { done: steps.filter((h) => h.status === 'done').length, total: steps.length }
  }
  // Active chains, editor order (RoutinesTab.tsx's own "ONE source of which cards render" —
  // generalized here to drive hero selection + celebrations instead of chain cards).
  const activeChains = [...habitCatalog.chains].filter((c) => c.isActive).sort((a, b) => a.position - b.position)
  // Fixed copy for the two seed chains (byte-parity, mezo-n5e9.4 REQUIRED); any other chain
  // (a custom one created via the routine editor) celebrates with its own title.
  const chainCelebrationText = (c: HabitChainInfo): string => {
    if (c.chainKey === 'MORNING') return '🌅 Tökéletes reggel'
    if (c.chainKey === 'EVENING') return '🌙 Tökéletes este'
    return `✨ ${c.title} kész`
  }
  // Every active chain of a daypart gets its own celebration — not just the daypart's hero
  // chain (only the morning face has one; a second chain of any daypart still completes and
  // toasts on its own).
  const celebrationsFor = (daypart: HabitDaypart) =>
    activeChains
      .filter((c) => c.daypart === daypart)
      .map((c) => ({ id: c.id, text: chainCelebrationText(c), ...chainProgress(c.chainKey) }))
  // The morning face has exactly one hero slot — promoted from the first ACTIVE MORNING-daypart
  // chain by position (was a hardcoded 'MORNING' chainKey literal). Falls back to the literal
  // key when no MORNING chain exists (catalog not yet resolved in real mode) — chainProgress on
  // an unknown key is just 0/0, never a crash.
  const heroMorningChain = activeChains.find((c) => c.daypart === 'MORNING') ?? null
  // Only the chain's FIRST open step is promoted into the hero; the rest stay ordinary
  // TodoCard rows so every pending step is actionable, in order or out of it.
  const chain = {
    ...chainProgress(heroMorningChain?.chainKey ?? 'MORNING'),
    next: open.find((i) => i.source === 'habit' && i.face === 'reggel') ?? null,
  }
  // The preview rows of the OTHER faces. The predicate narrows the type, so `face` is a real
  // `DayFace` by the time `FaceMorning` jumps to it — the `'all' ? 'nap'` fallback that used to
  // sit there was unreachable, and now it is unrepresentable.
  const later = items.filter((i): i is TodayItem & { face: Face } =>
    i.face !== selected && i.face !== 'all' && i.status === 'open')

  // The retired TodayQuestsCard header's job: the quest+activity summary AND the only route
  // from Today into quest management (reroll + the why-lines live on /me/growth).
  const growth = growthTodaySummary(quests, activities ?? [])
  // The retired FuelTimelinePreview's companion line — first sentence only, as before.
  const fuelNote = nextStack?.mezoNote
    ? { time: nextStack.time, text: `${nextStack.mezoNote.split('.')[0]}.` }
    : null

  // The hero is a REFERENCE to the promoted session, not a second rendering of `workout` —
  // its card content is that object verbatim. Only `id` (the item's identity, not card content)
  // stays behind, and only the CTA's handler is hero-only.
  const dayHero: DayHero | null = heroSession ? heroCardOf(heroSession, () => navigate('/train')) : null

  return (
    <>
      {appHero}
      <GreetingHeader today={today} user={user} retaDay={scenario.retaDay} />
      <DayFaceStrip
        selected={selected}
        current={current}
        counts={openCountByFace(items)}
        doneCounts={Object.fromEntries(DAY_FACES.map((f) => [f, itemsForFace(items, f).done.length])) as Record<Face, number>}
        onSelect={selectFace}
      />
      {scenario.vulnerable && <VulnerabilityCard />}

      {/* `key={selected}` remounts this div on every face change, so the np-* motion
          re-runs each time; `data-dir` (from `selectFace`) carries which way it reads. */}
      <div className="faceswap" data-dir={dir} key={selected}>
        {selected === 'reggel' && (
          <FaceMorning
            open={open} done={done} doneXp={doneXp} chain={chain} celebrations={celebrationsFor('MORNING')}
            briefing={briefing ?? resolveBriefing(scenario.dayState)}
            briefingDemo={briefingDemo}
            stats={stats}
            later={later} growth={growth} fuelNote={fuelNote} habitPending={habitPending}
            onAct={act} onFace={selectFace}
          />
        )}
        {selected === 'nap' && (
          <FaceDay
            open={open} done={done} doneXp={doneXp} hero={dayHero} note={companionNote}
            heroWarn={scenario.niggle ? workout?.niggleWarning?.detail ?? null : null}
            heroNote={sportToday ? volleyballNote : null}
            celebrations={celebrationsFor('DAY')}
            later={later.filter((i) => i.face === 'este')} growth={growth} fuelNote={fuelNote}
            habitPending={habitPending} onAct={act} onFace={selectFace} onCustom={() => setCustomOpen(true)}
          />
        )}
        {selected === 'este' && (
          <FaceEvening
            open={open} done={done} doneXp={doneXp} dayXp={dayXp} celebrations={celebrationsFor('EVENING')}
            note={companionNote} growth={growth} fuelNote={fuelNote} habitPending={habitPending} onAct={act}
          />
        )}
      </div>

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
    </>
  )
}
