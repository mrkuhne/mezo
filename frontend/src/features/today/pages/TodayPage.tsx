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
// This page is also the sheet host the retired cards were: `act()` covers EVERY
// habitAction kind (the four sheet-bearing ones came from RoutineCard) and every
// questAction kind, so no row can offer a control that does nothing — the
// ItemRow doctrine. It likewise carries the consume-once level-up dance that
// TodayQuestsCard and RoutineCard each used to run.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useActivities, useCheckins, useCompanionNote, useDailyQuests, useFuelPreview, useHabitActions,
  useHabitDay, useIntentionActions, useIntentionDay, useQuestActions, useQuickStats, useRitualDay,
  useSleep, useSleepGoal, useToday, useTodayScenario, useWaterActions, resolveBriefing,
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
import { buildTodayItems, itemsForFace, openCountByFace, type TodayItem } from '@/features/today/logic/todayItems'
import { sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, SPORT_TONE } from '@/features/train/logic/sportKinds'
import { localDateString } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import type { DailyQuest, MealSlot } from '@/data/types'

const isFace = (v: string | null): v is Face => v !== null && (DAY_FACES as readonly string[]).includes(v)

export function TodayPage() {
  const date = localDateString()
  const scenario = useTodayScenario()
  const {
    today, user, workout, volleyballSessions, workoutTime, prediction,
    briefing, briefingDemo, volleyballNote,
  } = useToday()
  const { checkins, saveCheckIn } = useCheckins()
  const { goal: sleepGoal } = useSleepGoal()
  const { quests, levelUps: questLevelUps } = useDailyQuests(date)
  const { consumeLevelUps: consumeQuestLevelUps } = useQuestActions(date)
  const { data: activities } = useActivities(date)
  const { habits, levelUps: habitLevelUps } = useHabitDay(date)
  const { check, consumeLevelUps: consumeHabitLevelUps } = useHabitActions(date)
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
  const items = useMemo(() => {
    const built = buildTodayItems({
      quests, habits, checkins, fuelSlots, ritual: ritualDay, goal: sleepGoal,
      sessions: [
        ...(workout ? [{
          id: 'gym', tone: 'gym' as const, emoji: '🏋️', tag: 'GYM', title: workout.title,
          time: workoutTime ?? null,
          facts: [`${workout.exercises.length} gyakorlat`, `~${workout.durationEst} perc`, prediction?.label],
          logged: false,
        }] : []),
        ...(sportToday ? [{
          id: 'sport', tone: SPORT_TONE[sportOf(sportToday)], emoji: SPORT_EMOJI[sportOf(sportToday)],
          tag: SPORT_TAGS[sportOf(sportToday)], title: SPORT_TITLES[sportOf(sportToday)],
          time: sportToday.time, facts: [`${sportToday.duration} perc`, sportToday.court, sportToday.role],
          logged: false,
        }] : []),
      ],
    })
    // The ItemRow doctrine: a row carries a control ONLY when `act` can serve it. A pending
    // DERIVED habit with no log surface of its own (habitAction → 'none', e.g. `bed_on_time`,
    // which TOMORROW's sleep log decides) keeps its row and loses its pill instead of inviting
    // a tap that does nothing — and picks up `habitHint`'s explainer so a button-less row
    // reads as "this ticks by itself", not as broken (the retired RoutineCard's `.hab-note`).
    // Done HERE, not in todayItems.ts — the normalizer's action data is right; it is this
    // screen's dispatcher that decides what it can serve.
    return built.map((i) => {
      if (i.action?.kind !== 'habit' || habitAction(i.action.habit).kind !== 'none') return i
      const hint = habitHint(i.action.habit)
      return { ...i, action: null, subtitle: hint ?? i.subtitle }
    })
  }, [quests, habits, checkins, fuelSlots, ritualDay, sleepGoal, workout, workoutTime, prediction, sportToday])

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
  }

  if (scenario.anchorMode) return <AnchorModeView />

  const { open, done } = itemsForFace(items, selected)
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
        const idx = checkins.findIndex((c) => c.state === 'now' || c.state === 'pending')
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

  const chainProgress = (which: 'MORNING' | 'EVENING') => {
    const steps = habits.filter((h) => h.chain === which)
    return { done: steps.filter((h) => h.status === 'done').length, total: steps.length }
  }
  // Only the chain's FIRST open step is promoted into the hero; the rest stay ordinary
  // TodoCard rows so every pending step is actionable, in order or out of it.
  const chain = {
    ...chainProgress('MORNING'),
    next: open.find((i) => i.source === 'habit' && i.face === 'reggel') ?? null,
  }
  const later = items.filter((i) => i.face !== selected && i.face !== 'all' && i.status === 'open')

  // The retired TodayQuestsCard header's job: the quest+activity summary AND the only route
  // from Today into quest management (reroll + the why-lines live on /me/growth).
  const growth = growthTodaySummary(quests, activities ?? [])
  // The retired FuelTimelinePreview's companion line — first sentence only, as before.
  const fuelNote = nextStack?.mezoNote
    ? { time: nextStack.time, text: `${nextStack.mezoNote.split('.')[0]}.` }
    : null

  const dayHero: DayHero | null = workout
    ? {
        tone: 'gym', emoji: '🏋️', tag: `GYM${workout.tag ? ` · ${workout.tag}` : ''}`, time: workoutTime ?? null,
        title: workout.title,
        facts: [`${workout.exercises.length} gyakorlat`, `~${workout.durationEst} perc`, prediction?.label],
        logged: false, ctaLabel: 'Indítsuk', onLog: () => navigate('/train'),
      }
    : sportToday
      ? {
          tone: SPORT_TONE[sportOf(sportToday)], emoji: SPORT_EMOJI[sportOf(sportToday)],
          tag: SPORT_TAGS[sportOf(sportToday)], time: sportToday.time,
          title: SPORT_TITLES[sportOf(sportToday)],
          facts: [`${sportToday.duration} perc`, sportToday.court, sportToday.role],
          logged: false, ctaLabel: 'Logold', onLog: () => navigate('/train'),
        }
      : null

  return (
    <>
      <AppHero
        utilities={<Link to="/insights" aria-label="Insights" className="icon-btn"><Icon name="sparkle" size={18} /></Link>}
      />
      <GreetingHeader today={today} user={user} retaDay={scenario.retaDay} />
      <DayFaceStrip
        selected={selected}
        current={current}
        counts={openCountByFace(items)}
        doneCounts={Object.fromEntries(DAY_FACES.map((f) => [f, itemsForFace(items, f).done.length])) as Record<Face, number>}
        onSelect={selectFace}
      />
      {scenario.vulnerable && <VulnerabilityCard />}

      {selected === 'reggel' && (
        <FaceMorning
          open={open} done={done} doneXp={doneXp} chain={chain}
          briefing={briefing ?? resolveBriefing(scenario.dayState)}
          briefingDemo={briefingDemo}
          briefingFacts={stats.map((s) => `${s.label} ${s.value}${s.unit ?? ''}`)}
          later={later} growth={growth} fuelNote={fuelNote} onAct={act} onFace={selectFace}
        />
      )}
      {selected === 'nap' && (
        <FaceDay
          open={open} done={done} doneXp={doneXp} hero={dayHero} note={companionNote}
          heroWarn={scenario.niggle ? workout?.niggleWarning?.detail ?? null : null}
          heroNote={sportToday ? volleyballNote : null}
          later={later.filter((i) => i.face === 'este')} growth={growth} fuelNote={fuelNote}
          onAct={act} onFace={selectFace} onCustom={() => setCustomOpen(true)}
        />
      )}
      {selected === 'este' && (
        <FaceEvening
          open={open} done={done} doneXp={doneXp} dayXp={dayXp} chain={chainProgress('EVENING')}
          note={companionNote} growth={growth} fuelNote={fuelNote} onAct={act}
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
    </>
  )
}
