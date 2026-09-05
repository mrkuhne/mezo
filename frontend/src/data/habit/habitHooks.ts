import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { habitApi, type HabitDay } from '@/data/habit/habitApi'
import { mockHabitDay, mockHabitSummary } from '@/data/habit/habitMock'
import type { HabitItem, HabitSummary } from '@/data/types'
import type { LevelUpResult } from '@/data/train/trainApi'
import { useDualQuery } from '@/data/useDualQuery'
import { addDays, localDateString } from '@/shared/lib/dates'

const key = (d: string) => ['habitDay', d]

// Backfill window (mezo-x9c2): mirrors `mezo.habit.backfill-days` in application.yml, the
// backend's source of truth (HabitProperties.backfillDays, gated by HabitService's
// requireManualWithinBackfillWindow). Keep in sync if that config value ever changes.
const MOCK_BACKFILL_DAYS = 1

const MOCK_DAY: HabitDay = { habits: mockHabitDay, levelUps: [] }
const EMPTY_DAY: HabitDay = { habits: [], levelUps: [] }

/**
 * Past-day mock seed (mezo-x9c2): the nightly close already ran for any past date, so open
 * seeds read `missed` — the static MOCK_DAY leaking into yesterday made the mock arm lie.
 * MANUAL missed rows are exactly the backfill targets the yesterday surface offers.
 */
const mockDayFor = (date: string): HabitDay =>
  date >= localDateString()
    ? MOCK_DAY
    : {
        habits: mockHabitDay.map((h) =>
          h.status === 'pending' ? { ...h, status: 'missed' as const } : h),
        levelUps: [],
      }

export interface HabitDayView extends HabitDay {
  mode: 'mock' | 'live'
}

/**
 * Mock-mode mirror of a server-side DERIVED completion (real mode re-derives the row on the
 * next habitDay read; the mock has no evaluator, so the owning surface's mutation flips the
 * chain row here — mezo-o5hx). Seeds the day from the mock seed when no surface mounted it
 * yet. Returns whether the row actually flipped, so callers can gate a one-time XP award.
 */
export function completeMockDerivedHabit(qc: QueryClient, date: string, habitKey: string): boolean {
  const day = qc.getQueryData<HabitDay>(key(date)) ?? MOCK_DAY
  const target = day.habits.find((h) => h.key === habitKey)
  if (!target || target.status !== 'pending') {
    return false
  }
  qc.setQueryData<HabitDay>(key(date), {
    ...day,
    habits: day.habits.map((h) =>
      h.key === habitKey
        // a csík valódi értéket animál itt is, ugyanúgy mint a MANUAL patchMock ágon
        // (mezo-3zue.5) — máskülönben egy DERIVED sor csíkja mock módban befagy.
        ? { ...h, status: 'done', doneAt: new Date().toISOString(), strengthPct: bumpStrength(habitKey, h.strengthPct) }
        : h),
  })
  return true
}

/**
 * The day's habit chains. Real mode: GET lazily creates + evaluates today's rows and derived
 * completion server-side, so it deliberately re-reads on every mount/focus (staleTime 0) — the
 * READ is the domain's lazy-evaluation heartbeat. While unresolved returns the empty day, never
 * the seed (no-static-fallback rule). levelUps carries payloads produced by THAT read only.
 */
export function useHabitDay(date: string): HabitDayView {
  const mock = isMockMode()
  const q = useQuery<HabitDay>({
    queryKey: key(date),
    queryFn: mock ? async () => mockDayFor(date) : () => habitApi.day(date),
    initialData: mock ? mockDayFor(date) : undefined,
    staleTime: mock ? Infinity : 0, // real mode re-reads every mount (READ-triggered server eval)
    retry: false,
  })
  const data = q.data ?? (mock ? mockDayFor(date) : EMPTY_DAY)
  return { ...data, mode: mock ? 'mock' : 'live' }
}

/**
 * A backend erő-képletének mock tükre (HabitService.strengthByKey: done / (done + missed) a
 * 28 napos ablakon). A ma-kész nap hozzáadása a sor SAJÁT arányához: a megjelenített
 * százalékot arányként véve `round((p * C / 100 + 1) * 100 / (C + 1))`, ahol C a lezárt napok
 * száma. Kicsi, monoton, 100 felé konvergál — nem talál ki új számformát (mezo-3zue.5).
 *
 * `null` marad `null`: a szerver is null-t ad `minSample` alatt.
 */
function bumpStrength(habitKey: string, pct: number | null | undefined): number | null {
  if (pct == null) return null
  const s = mockHabitSummary.habits.find((h) => h.key === habitKey)
  const closed = s ? s.done28 + s.missed28 : 0
  if (closed <= 0) return pct
  return Math.round(((pct * closed) / 100 + 1) * (100 / (closed + 1)))
}

/**
 * `bumpStrength` ARITMETIKAI INVERZE — egy kész nap eltávolítása az arányból — nem a statikus
 * seed-értékre visszaállítás. Egy MÁR `status: 'done'`-nak seedelt sor (pl. `morning_sunlight`,
 * 64%) seed-értéke MAGÁBAN FOGLALJA a kész napot, tehát a visszavonásnak arról az értékről kell
 * csökkennie, nem a seedbe visszaugrania — különben egy ilyen sor visszapipálása sosem térne
 * vissza a seed-értékre (mezo-3zue.5, F5). `bumpStrength(pct, C) = round((pct·C/100 + 1)·100/(C+1))`
 * inverze: `pct = (y·(C+1) - 100) / C`, kerekítve és 0..100-ra szorítva. Kerekítés mellett is
 * kör-stabil (lásd `habitHooks.test.tsx`): pipa → visszavonás → pipa ugyanoda ér vissza, akár
 * pending-, akár done-seedelt sorról indul.
 */
function unbumpStrength(habitKey: string, pct: number | null | undefined): number | null {
  if (pct == null) return null
  const s = mockHabitSummary.habits.find((h) => h.key === habitKey)
  const closed = s ? s.done28 + s.missed28 : 0
  if (closed <= 0) return pct
  const raw = (pct * (closed + 1) - 100) / closed
  return Math.min(100, Math.max(0, Math.round(raw)))
}

export function useHabitActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const patchMock = (habitKey: string, status: HabitItem['status']) => {
    qc.setQueryData<HabitDay>(key(date), (d) =>
      d && {
        ...d,
        habits: d.habits.map((h) =>
          h.key === habitKey
            ? {
                ...h,
                status,
                doneAt: status === 'done' ? new Date().toISOString() : null,
                // a csík valódi értéket animál, mock módban is (mezo-3zue.5)
                strengthPct: status === 'done'
                  ? bumpStrength(habitKey, h.strengthPct)
                  : unbumpStrength(habitKey, h.strengthPct),
              }
            : h),
      })
  }

  const checkM = useMutation({
    mutationFn: async (habitKey: string) => {
      if (mock) {
        if (date < addDays(localDateString(), -MOCK_BACKFILL_DAYS) || date > localDateString()) {
          throw new Error('HABIT_TOO_OLD')
        }
        patchMock(habitKey, 'done')
        const xp = mockHabitDay.find((h) => h.key === habitKey)?.xp ?? 0
        // The call site emits its own DS reward toast for the check (mezo-k5sa), so the
        // generic „+N XP" line would be a duplicate — the level/streak notices still fire.
        // A backfill credits the REQUEST date's ledger (mezo-x9c2), same as the backend's
        // occurredOn = habit_date attribution.
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: xp, silentXp: true, date })
        return undefined
      }
      return habitApi.check(habitKey, date).then((r) => r.levelUps)
    },
    onSuccess: mock
      ? undefined
      : () => {
          qc.invalidateQueries({ queryKey: key(date) })
          qc.invalidateQueries({ queryKey: ['habitSummary'] })
          qc.invalidateQueries({ queryKey: ['progressionProfile'] })
        },
  })
  // NOTE: check() resolves the write's levelUps — the caller builds a reward toast via
  // @/features/progression/logic/rewardToast and emits it on the toastBus (mezo-k5sa).
  // Callers today: NapRutinPage.tickAction and NapHubPage.tileTick (every habit row on all
  // three daypart faces). RoutineCard, the original caller, was retired by the daypart-faces
  // re-composition (mezo-j7u4).

  const uncheckM = useMutation({
    mutationFn: async (habitKey: string) => {
      if (mock) {
        if (date < addDays(localDateString(), -MOCK_BACKFILL_DAYS) || date > localDateString()) {
          throw new Error('HABIT_TOO_OLD')
        }
        patchMock(habitKey, 'pending')
        return undefined
      }
      return habitApi.uncheck(habitKey, date).then(() => undefined)
    },
    onSuccess: mock
      ? undefined
      : () => {
          qc.invalidateQueries({ queryKey: key(date) })
          qc.invalidateQueries({ queryKey: ['habitSummary'] })
          qc.invalidateQueries({ queryKey: ['progressionProfile'] })
        },
  })

  return {
    check: (habitKey: string) => checkM.mutateAsync(habitKey),
    uncheck: (habitKey: string) => uncheckM.mutateAsync(habitKey),
    pending: checkM.isPending || uncheckM.isPending,
    consumeLevelUps: () =>
      qc.setQueryData<HabitDay>(key(date), (d) => d && { ...d, levelUps: [] as LevelUpResult[] }),
  }
}

export function useHabitSummary() {
  return useDualQuery<HabitSummary>({
    queryKey: ['habitSummary'],
    mockData: mockHabitSummary,
    realFetch: habitApi.summary,
    realEmpty: { perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] },
  })
}
