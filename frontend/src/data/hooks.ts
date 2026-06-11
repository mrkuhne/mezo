import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/lib/mode'
import { localDateString, huMonthDay, huMonthDayDow } from '@/lib/dates'
import { weightApi, sleepApi, checkinApi } from '@/lib/biometricsApi'
import { trainApi, type MesocycleResponse, type SportSessionResponse } from '@/lib/trainApi'
import { today, user, briefing, briefingVariants, workout, volleyballSessions, fuelToday } from './today'
import { initialCheckins } from './checkins'
import { identityGoal, areas, quickSettings, notifSettings, appVersion } from './me'
import { goal, weightLog as initialWeightLog, weightTrends, linkedMesocycles } from './goals'
import { sleepLog as initialSleepLog, sleepTrends } from './sleep'
import { peopleSummary, people, mentions as initialMentions, relationPatterns } from './people'
import { facts, edges } from './knowledge'
import { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments } from './insights'
import { initialChat } from './chat'
import { fuelDay, fuelPlan, supplementsStash, protocol, getScoredMeal } from './fuel'
import { ingredients, recipes, pantrySources, pantryCategoryMeta, pantryImports, pantrySuggestions } from './pantry'
import { retaWeek, gymSchedule, weeklySupplements, recurringPatterns, weeklyStats, replanScenarios, stackRecommendations } from './fuelWeek'
import { mesocycles, activeMeso, workout as trainWorkout, gymSchedule as trainGymSchedule, sport, exerciseLibrary } from './train'
import type { Briefing, CheckinSlot, DayState, FuelSlot, TodayScenario, WeightEntry, WeightLogInput, SleepEntry, SleepLogInput, Mention, MentionLogInput, Mesocycle, SportSession, WorkoutPlan, GymSchedule, Sport, ExerciseLibraryItem } from './types'

export function useTodayScenario(): TodayScenario {
  const [params] = useSearchParams()
  const day = params.get('day')
  const dayState: DayState = day === 'good' || day === 'rough' ? day : 'medium'
  const retaRaw = parseInt(params.get('retaDay') ?? '', 10)
  const retaDay = Number.isFinite(retaRaw) ? Math.min(7, Math.max(1, retaRaw)) : today.retaDay
  const niggle = params.get('niggle') !== 'off'
  const vulnerable = params.get('vulnerable') === 'on'
  return { dayState, retaDay, niggle, vulnerable, anchorMode: dayState === 'rough' }
}

export function resolveBriefing(dayState: DayState): Briefing {
  const variant = briefingVariants[dayState]
  return variant ? { ...briefing, ...variant } : briefing
}

export function useToday() {
  return { today, user, briefing, workout, volleyballSessions, fuelToday }
}

export function useCheckins() {
  const [checkins, setCheckins] = useState<CheckinSlot[]>(initialCheckins)
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: checkinApi.save,
    onError: (err) => console.error('Check-in sync failed', err),
  })
  const saveCheckIn = useCallback((idx: number, data: Partial<CheckinSlot>) => {
    setCheckins(prev => {
      const next = prev.map((c, i) => (i === idx ? { ...c, ...data } : c))
      if (!mock) {
        const slot = next[idx]
        const v = slot.values
        const today = localDateString()
        mutation.mutate({
          date: today, slotTime: slot.time, state: slot.state ?? 'done',
          energy: v?.energy, stress: v?.stress, body: v?.body, mental: v?.mental,
          note: slot.note ?? undefined,
        })
      }
      return next
    })
  }, [mock, mutation])
  return { checkins, saveCheckIn }
}

export function useFuelPreview() {
  const slots = fuelToday.slots
  const nowIdx = slots.findIndex(s => s.state === 'now')
  const start = Math.max(0, nowIdx)
  const visible = slots.slice(start, start + 3)
  const nextStack = slots.find(s => s.state !== 'done' && (s.items ?? []).some(it => !it.done))
  return { visible, nextStack }
}

export function useProfile() {
  return { user, identityGoal, areas, quickSettings, notifSettings, version: appVersion }
}

export function useGoals() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { data: weightLog = [] } = useQuery({
    queryKey: ['weightLog'],
    queryFn: mock ? async () => initialWeightLog : weightApi.list,
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // useState behavior exactly (parity + component tests). Real mode loads.
    initialData: mock ? initialWeightLog : undefined,
  })
  const mutation = useMutation({
    mutationFn: mock
      ? async (input: WeightLogInput): Promise<WeightEntry> =>
          ({ date: input.date, value: input.weightKg, note: input.note })
      : weightApi.log,
    onSuccess: (entry) => {
      if (mock) qc.setQueryData<WeightEntry[]>(['weightLog'], prev => [...(prev ?? []), entry])
      else qc.invalidateQueries({ queryKey: ['weightLog'] })
    },
  })
  const logWeight = useCallback((input: WeightLogInput) => mutation.mutate(input), [mutation])
  return { goal, weightLog, weightTrends, linkedMesocycles, logWeight }
}

export function useSleep() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { data: sleepLog = [] } = useQuery({
    queryKey: ['sleepLog'],
    queryFn: mock ? async () => initialSleepLog : sleepApi.list,
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // useState behavior exactly (parity + component tests). Real mode loads.
    initialData: mock ? initialSleepLog : undefined,
  })
  const mutation = useMutation({
    mutationFn: mock
      ? async (input: SleepLogInput): Promise<SleepEntry> => ({
          date: input.date, bedtime: input.bedtime, wakeup: input.wakeup,
          duration: input.durationH, quality: input.quality, awakenings: input.awakenings,
          mealToSleep: 0, notes: input.note ?? null,
        })
      : sleepApi.log,
    onSuccess: (entry) => {
      if (mock) qc.setQueryData<SleepEntry[]>(['sleepLog'], prev => [...(prev ?? []), entry])
      else qc.invalidateQueries({ queryKey: ['sleepLog'] })
    },
  })
  const logSleep = useCallback((input: SleepLogInput) => mutation.mutate(input), [mutation])
  return { sleepLog, sleepTrends, lastNight: sleepLog[sleepLog.length - 1], logSleep }
}

export function usePeople() {
  const [mentions, setMentions] = useState<Mention[]>(initialMentions)
  const logMention = useCallback((input: MentionLogInput) => {
    const now = new Date()
    const person = people.find(p => p.id === input.personId)
    const newMention: Mention = {
      id: crypto.randomUUID(),
      ts: now.toISOString(),
      dayLabel: 'Ma',
      timeLabel: now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
      person_id: input.personId,
      personName: person?.name ?? '',
      source: 'chip',
      excerpt: input.text ?? '',
      tone: input.tone,
    }
    setMentions(prev => [newMention, ...prev])
  }, [])
  return { summary: peopleSummary, people, mentions, patterns: relationPatterns, logMention }
}

export function useKnowledge() {
  return { facts, edges, activeCount: facts.filter(f => f.active).length }
}

export function useInsights() {
  return { patterns, recentlyConfirmed, weekly, weeklySuggestion, memoir, anniversaryNote, predictions, experiments }
}

export function useChat() {
  return { initialChat }
}

export function useFuelDay() {
  return { fuel: fuelDay }
}

export function useFuelTimeline() {
  return { plan: fuelPlan.today, getScoredMeal: (s: FuelSlot) => getScoredMeal(s, fuelDay.meals) }
}

export function useStack() {
  return { stash: supplementsStash }
}

export function useProtocol() {
  return { protocol }
}

export function usePantry() {
  return { ingredients, stash: supplementsStash, sources: pantrySources, categoryMeta: pantryCategoryMeta, imports: pantryImports, suggestions: pantrySuggestions }
}

export function useRecipes() {
  return { recipes, ingredients, sources: pantrySources, categoryMeta: pantryCategoryMeta }
}

export function useFuelWeek() {
  return { retaWeek, gymSchedule, weeklySupplements, patterns: recurringPatterns, weeklyStats, volleyball: volleyballSessions }
}

export function useReplanScenarios() {
  return { scenarios: replanScenarios }
}

export function useStackRecommendations() {
  return { recommendations: stackRecommendations }
}

// Backend serves ISO dates (`2026-05-01`); the UI expects HU display strings.
// The generated MesocycleResponse is structurally close to the domain Mesocycle
// (goal is optional in the contract, delta keys are a looser string map) — the
// boundary cast mirrors the Slice A biometrics-api idiom.
function toMesocycle(r: MesocycleResponse): Mesocycle {
  return {
    ...r,
    startDate: huMonthDay(r.startDate),
    endDate: huMonthDay(r.endDate),
    goal: r.goal ?? '',
  } as Mesocycle
}

function toSportSession(r: SportSessionResponse): SportSession {
  return {
    id: r.id, sport: r.sport, date: huMonthDayDow(r.date), time: r.time,
    duration: r.duration, setsPlayed: r.setsPlayed, intensity: r.intensity,
    rpe: r.rpe, shoulderStrain: r.shoulderStrain, jumpCount: r.jumpCount,
    notes: r.notes ?? null,
  }
}

// Real mode has no static fallback (T0 "tiszta lap"): an empty backend must
// surface as null, not silently render Phase-1 demo data. Components ghost-guard
// these in T3-T5. `sport.sessions` always loads from the API; the other sport
// facets (schedule/week/crossLoad) are derived data that lands in T2, so they're
// null until then. `exerciseLibrary` stays static — it's a content catalog, not
// user data (spec decision). Mock mode returns the byte-identical Phase-1 statics.
type TrainData = {
  mesocycles: Mesocycle[]
  activeMeso: Mesocycle | null
  workout: WorkoutPlan | null
  gymSchedule: GymSchedule | null
  sport: { [K in keyof Sport]: K extends 'sessions' ? SportSession[] : Sport[K] | null }
  exerciseLibrary: ExerciseLibraryItem[]
}

export function useTrain(): TrainData {
  const mock = isMockMode()
  const { data: mesoData } = useQuery({
    queryKey: ['train', 'mesocycles'],
    queryFn: mock ? async () => mesocycles : () => trainApi.mesocycles().then(rs => rs.map(toMesocycle)),
    // Mock mode seeds synchronously so the first render matches the Phase-1
    // static return exactly (parity + component tests). Real mode loads.
    initialData: mock ? mesocycles : undefined,
  })
  const { data: sportSessions } = useQuery({
    queryKey: ['train', 'sportSessions'],
    queryFn: mock ? async () => sport.sessions : () => trainApi.sportSessions().then(rs => rs.map(toSportSession)),
    initialData: mock ? sport.sessions : undefined,
  })
  const mesos = mesoData ?? []
  return {
    mesocycles: mesos,
    // real mode: no static fallback — empty backend means null, components ghost-guard (T0)
    activeMeso: mesos.find(m => m.status === 'active') ?? (mock ? activeMeso : null),
    workout: mock ? trainWorkout : null,          // real value arrives in T2 (/today endpoint)
    gymSchedule: mock ? trainGymSchedule : null,  // real derivation arrives in T2
    sport: mock
      ? { ...sport, sessions: sportSessions ?? [] }
      : { ...sport, schedule: null, week: null, crossLoad: null, sessions: sportSessions ?? [] },
    exerciseLibrary, // static catalog — content, not user data (spec decision)
  }
}
