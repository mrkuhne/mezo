// ============================================================
// Mezo · useDayOrbFill — a PIHENŐNAPI 100% end-to-end (mezo-7vdm #5).
//
// A `dayOrbFill.test.ts` unit szinten már állítja, hogy pihenőnapon 5 a nevező. Amit NEM
// állított senki: hogy a HOOK a valós olvasásokból tényleg pihenőnapot SZÁRMAZTAT, és hogy
// az öt feltétlen jellel az orb tényleg TELE megy. A `plan` ága (gymWeeklyTimes `today &&
// active`, sportScheduleSessions `today`) eddig csak kódolvasással volt igazolva — egy
// elrontott mezőnév vagy egy megfordított feltétel csendben 6-os vagy 7-es nevezőt adna,
// és az orb sosem érne 100%-ra egy tökéletes pihenőnapon.
//
// Minden olvasás mockolva, tehát a teszt MINDKÉT módban azonosan fut (nem a mock-seedhez
// kötött). Spec: bd mezo-7vdm
// ============================================================
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { localDateString } from '@/shared/lib/dates'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'

// A mock-gyár hoistolva fut, tehát nem hivatkozhat a modul-szintű importokra — a mai nap
// ISO-ját itt kell előállítani. HELYI dátum, nem UTC: a `toISOString()` hajnalban az ELŐZŐ
// napot adná (Budapest +1/+2), és akkor a jelek nem a mai napra esnének. A lenti utolsó
// teszt őrzi, hogy ez a duplikátum együtt maradjon a `localDateString`-gel.
const h = vi.hoisted(() => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return { iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
})

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const iso = h.iso
  return {
    ...actual,
    // Az öt FELTÉTLEN jel mind megvan.
    useSleep: () => ({ sleepLog: [{ date: iso }], lastNight: null, logSleep: vi.fn() }),
    useWeight: () => ({ weightLog: [{ date: iso, value: 78 }], weightTrends: null }),
    useFuelDay: () => ({ fuel: { meals: [{ id: 'm1' }] } }),
    useCheckins: () => ({ checkins: [{ state: 'done' }] }),
    useJournalNotes: () => ({ data: [{ occurredOn: iso }] }),
    // PIHENŐNAP: a terv szerint nincs edzés és nincs sport, és nem is logoltunk ilyet.
    useTrain: () => ({
      gymDoneDates: [], completedTodayWorkout: null,
      sport: { sessions: [], schedule: { volleyball: { sessions: [] } } },
      gymSchedule: { weeklyTimes: [{ today: true, active: false }, { today: false, active: true }] },
    }),
    useRunning: () => ({ runSessions: [], runningPending: false }),
    useDayEvaluation: () => ({ data: undefined, isPending: false, error: null, refetch: () => {} }),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('pihenőnapon az öt feltétlen jellel az orb TELE megy — 5/5, 100%', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.denominator).toBe(5)
  expect(result.current.present).toBe(5)
  expect(result.current.pct).toBe(100)
})

test('a pihenőnapi label az 5-ös nevezőt mondja ki', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.label).toBe('A mai napod · 5 a 5 jelből megvan')
})

// A hoistolt `h.iso` a `localDateString` kézzel másolt párja (a mock-gyár nem importálhat).
// Ha a `localDateString` valaha mást ad — más időzóna-kezelést, más formátumot —, ez a
// teszt bukik, mielőtt a fenti kettő rejtélyes okból elkezdene sodródni.
test('a hoistolt mai-nap ISO egyezik a localDateString-gel', () => {
  expect(h.iso).toBe(localDateString())
})
