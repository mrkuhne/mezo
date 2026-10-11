// The day orb's label is text: a mounted hook must re-label on a language switch (mezo-n4wf5.11).
// Same read mocks as the rest-day test; the hook is rendered plainly, with no remounting provider.
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'

// A mock-gyár hoistolva fut, tehát nem hivatkozhat a modul-szintű importokra — a mai nap
// ISO-ját itt kell előállítani. HELYI dátum, nem UTC: a `toISOString()` hajnalban az ELŐZŐ
// napot adná (Budapest +1/+2), és akkor a jelek nem a mai napra esnének. A lenti utolsó
// teszt őrzi, hogy ez a duplikátum együtt maradjon a `localDateString`-gel.
const h = vi.hoisted(() => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return { now: d, iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
})

// A hook a SAJÁT óráját olvassa (`useMinuteTick`), a jelek dátuma viszont a fenti, hoistolt
// olvasásból jön — két független fali-óra olvasás, ami helyi éjfélt átlépve MÁS napot ad, és
// akkor egyik jel sem esik a hook „mai" napjára (5/5 helyett 0/5).
//
// Miért a hook mockja, és nem `setSystemTime`: a `useMinuteTick` modul-szintű órája MOUNT UTÁN
// nem követi a fali órát — a `getSnapshot` önjavító ága (`useMinuteTick.ts:57-61`) csak akkor
// frissít, ha ÉPP NINCS feliratkozó. Mount ELŐTT tehát egy `setSystemTime` elér hozzá
// (`useMinuteTick.test.tsx:22-33`), mount után viszont már nem. A hookot ugyanarra az EGYETLEN
// olvasásra pinnelni (`NapHubPage.test.tsx:101` precedens) az időzítéstől függetlenül tart.
//
// Lefedettségi ár (tudatos): a valós `useMinuteTick` ezzel kikerül ennek a hooknak a
// lefedettségéből — ha a `useDayOrbFill` visszatérne renderenkénti `new Date()`-re (mezo-atry
// fáziscsúszás), az itt már nem bukna; azt a `useMinuteTick.test.tsx` őrzi. mezo-4jtz
vi.mock('@/features/today/logic/useMinuteTick', () => ({
  useMinuteTick: () => h.now,
}))

// STABLE references: a mock returning fresh arrays every render would recompute the hook's memo
// by itself and hide a stale-label bug.
const stable = vi.hoisted(() => {
  const iso = h.iso
  return {
    sleep: { sleepLog: [{ date: iso }], lastNight: null, logSleep: () => {} },
    weight: { weightLog: [{ date: iso, value: 78 }], weightTrends: null },
    fuel: { fuel: { meals: [{ id: 'm1' }] } },
    checkins: { checkins: [{ state: 'done' }] },
    journal: { data: [{ occurredOn: iso }] },
    train: {
      gymDoneDates: [], completedTodayWorkout: null,
      sport: { sessions: [], schedule: { volleyball: { sessions: [] } } },
      gymSchedule: { weeklyTimes: [{ today: true, active: false }, { today: false, active: true }] },
    },
    running: { runSessions: [], runningPending: false },
    evaluation: { data: undefined, isPending: false, error: null, refetch: () => {} },
  }
})

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useSleep: () => stable.sleep,
    useWeight: () => stable.weight,
    useFuelDay: () => stable.fuel,
    useCheckins: () => stable.checkins,
    useJournalNotes: () => stable.journal,
    useTrain: () => stable.train,
    useRunning: () => stable.running,
    useDayEvaluation: () => stable.evaluation,
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('a mounted orb follows a language switch (no remount, label is not cached across languages)', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.label).toBe('A mai napod · 5 a 5 jelből megvan')
  act(() => { setLang('en', { persist: false }) })
  expect(result.current.label).toBe('Your day today · 5 of 5 signals in')
  act(() => { setLang('hu', { persist: false }) })
  expect(result.current.label).toBe('A mai napod · 5 a 5 jelből megvan')
})
