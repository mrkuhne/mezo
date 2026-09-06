import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { DayEvaluationResponse } from '@/data/hooks'
import { NEUTRAL_INTENSITY } from '@/features/today/logic/dayOrbFill'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { todayIdx } from '@/data/train/runningAgenda'
import { localDateString } from '@/shared/lib/dates'

// EGYETLEN fali-óra olvasás az egész fájlra (mezo-4jtz). A lenti tesztek kiolvassák a mai nap
// hétköznap-indexét és ISO dátumát, a hook pedig a SAJÁTJÁT vezeti le a `useMinuteTick`-ből —
// két független olvasás, ami helyi éjfélt átlépve MÁS napot ad, és a sport-slot skip nem talál
// (a nevező 5 helyett 6).
//
// Miért a hook mockja, és nem `setSystemTime`: a `useMinuteTick` modul-szintű órája MOUNT UTÁN
// nem követi a fali órát. A `getSnapshot` önjavító ága (`useMinuteTick.ts:57-61`) csak akkor
// frissít, ha ÉPP NINCS feliratkozó — mount előtt tehát egy `setSystemTime` ELÉR hozzá
// (`useMinuteTick.test.tsx:22-33` pont ezt állítja), mount után viszont már nem. Egy fájl-szintű
// `Date`-fagyasztás így vagy a render elé kényszerítené az egészet, vagy elrontaná a lenti,
// mock-seedhez kötött describe-ot (az a TÉNYLEGES mai naphoz van horgonyozva) — ezért inkább
// magát a hookot pinneljük UGYANARRA az egy olvasásra (a `NapHubPage.test.tsx:101` precedens),
// valós `new Date()`-tel, nem fix literállal. Ez az időzítéstől függetlenül tart.
//
// Lefedettségi ár (tudatos): ezzel a valós `useMinuteTick` kikerül ENNEK a hooknak a
// lefedettségéből, tehát ha a `useDayOrbFill` valaha visszatérne renderenkénti `new Date()`-re
// (a mezo-atry fáziscsúszás), az itt már nem bukna — azt a `useMinuteTick.test.tsx` őrzi.
const clock = vi.hoisted(() => ({ now: new Date() }))
vi.mock('@/features/today/logic/useMinuteTick', () => ({
  useMinuteTick: () => clock.now,
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// A tónus-tengelyt (mezo-x5va) a mai nap `useDayEvaluation` válaszából számoljuk — ezeket a
// teszteket a hook mockolásával, mindkét módtól FÜGGETLENÜL futtatjuk (a `vi.mock` ugyanúgy
// felülírja a valós és a mock ágat is), hogy a vezetékezést önmagában, a dual-mode olvasás
// részletei nélkül ellenőrizzük. A többi `@/data/hooks` export valós marad (`importOriginal`).
const hoisted = vi.hoisted(() => ({ evaluation: undefined as DayEvaluationResponse | undefined }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useDayEvaluation: () => ({
      data: hoisted.evaluation, isPending: false, error: null, refetch: () => {},
    }),
  }
})

function evaluation(dimensions: DayEvaluationResponse['dimensions'], score: number | null = null): DayEvaluationResponse {
  return {
    date: '2026-09-04', state: score === null ? 'in_progress' : 'scored', score, base: null,
    adjustment: null, narrative: [], highlights: [], context: [], dimensions,
  }
}

describe('tónus-tengely (mezo-x5va) — a napi értékelésből', () => {
  afterEach(() => { hoisted.evaluation = undefined })

  test('2+ KÉSZ dimenzióval nem-semleges intenzitást ad', () => {
    hoisted.evaluation = evaluation([
      { id: 'training', label: 'Edzés', weight: 0.6, score: 90, status: 'DONE', facts: [], note: null },
      { id: 'sleep', label: 'Alvás', weight: 0.4, score: 90, status: 'DONE', facts: [], note: null },
    ])
    const { result } = renderHook(() => useDayOrbFill(), { wrapper })
    expect(result.current.intensity).not.toBe(NEUTRAL_INTENSITY)
    expect(result.current.intensity).toBeGreaterThan(0.9)
  })

  test('2 KÉSZ dimenzió alatt semleges marad az intenzitás', () => {
    hoisted.evaluation = evaluation([
      { id: 'training', label: 'Edzés', weight: 1, score: 90, status: 'DONE', facts: [], note: null },
      { id: 'sleep', label: 'Alvás', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null },
    ])
    const { result } = renderHook(() => useDayOrbFill(), { wrapper })
    expect(result.current.intensity).toBe(NEUTRAL_INTENSITY)
  })

  test('válasz hiányában (még nem érkezett meg) semleges marad az intenzitás', () => {
    hoisted.evaluation = undefined
    const { result } = renderHook(() => useDayOrbFill(), { wrapper })
    expect(result.current.intensity).toBe(NEUTRAL_INTENSITY)
  })
})

// Real módban hálózat nélkül minden lekérdezés `realEmpty`-re old fel az első renderben, tehát
// `present` 0 marad — ezek az asszerciók a mock-seedhez kötöttek (Task 3), real módban nem
// állíthatók. NEM lazítjuk az assertet: a brief pre-autorizált fallbackja szerint mock-only-vá
// tesszük őket, és a dual-mode fegyelmet a lenti, mindkét módban futó tesztek tartják.
describe.skipIf(import.meta.env.VITE_USE_MOCK === 'false')('mock-seedhez kötött asszerciók', () => {
  test('mock módban a mai nap jelei megvannak — a nevező legalább 5, a töltöttség pozitív', () => {
    const { result } = renderHook(() => useDayOrbFill(), { wrapper })
    expect(result.current.denominator).toBeGreaterThanOrEqual(5)
    expect(result.current.present).toBeGreaterThan(0)
    expect(result.current.pct).toBeGreaterThan(0)
  })

  // A denominátum a mock-seedben a jelek számát mondja ki a labelben — real módban
  // (present === 0) a label a „még nincs adat" ágra vált, tehát nem tartalmazza a
  // nevezőt. Ez az assert is mock-only, lásd a fenti megjegyzést.
  test('a label a jelek számát mondja ki, nem csak színben közöl', () => {
    const { result } = renderHook(() => useDayOrbFill(), { wrapper })
    expect(result.current.label).toContain(String(result.current.denominator))
  })
})

test('a label mindkét módban „A mai napod"-dal kezdődik', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.label).toMatch(/^A mai napod/)
})

// Real módban hálózat nélkül minden adat-hook szinkron, üres alapértékre old fel az
// első renderben (nincs seed, nincs terv) — tehát a hidegindítási kimenet DETERMINISZTIKUS:
// present=0, denominator=5 (nincs terv → gym/sport nem tartozik a naphoz), pct=0, és a
// label a „még nincs adat" ágon. Ez pontosan az az érték-vezetékezés, amit a fenti,
// mindkét módban futó tesztek NEM tudnak ellenőrizni (azok a dayOrbFill saját invariánsait
// ismétlik meg) — ha a hook véletlenül present-et hardcode-olná, vagy elrontaná a
// `present === 0` ági feltételt a labelben, ez a teszt buktatná.
// mezo-cq06 — a skip_sport_slot advice action hides one dated occurrence of a recurring sport
// slot; `sportPlanned` used to stay lit for it regardless, contradicting the backend's own
// `hasScheduledTrainingOn`. A weekday + date pár a fájl-szintű `clock.now`-ból jön — UGYANABBÓL
// az egyetlen olvasásból, amit a hook is lát (lásd a fenti `useMinuteTick` mockot), tehát a
// nap-váltás nem tudja szétcsúsztatni a kettőt.
describe.skipIf(import.meta.env.VITE_USE_MOCK !== 'false')('sportPlanned honours a sport-slot skip (mezo-cq06)', () => {
  const dow = todayIdx(clock.now)
  const todayIso = localDateString(clock.now)

  // Cold-start denominator is already 5 before the sport-schedule fetch resolves (no data yet →
  // sportPlanned false), so a naive `waitFor(() => denominator === 5)` would pass trivially
  // without ever observing the fetch. Wait for the ['train','sportSchedule'] query to actually
  // SETTLE first, so both tests genuinely exercise the post-fetch filter.
  function wrapperWithClient() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    return { Wrapper, qc }
  }

  test('a skip matching today\'s weekday + time + date drops the sport slot from the denominator', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () =>
        HttpResponse.json([{ id: 's1', dayOfWeek: dow, time: '17:00', durationMin: 90, kind: 'training', location: 'BVSC', intensityLabel: 'közepes' }]),
      ),
      http.get(`${API_BASE}/api/train/sport-slot-skips`, () =>
        HttpResponse.json([{ dayOfWeek: dow, time: '17:00', date: todayIso }]),
      ),
    )
    const { Wrapper, qc } = wrapperWithClient()
    const { result } = renderHook(() => useDayOrbFill(), { wrapper: Wrapper })
    await waitFor(() => expect(qc.getQueryState(['train', 'sportSchedule'])?.status).toBe('success'))
    await waitFor(() => expect(result.current.denominator).toBe(5))
  })

  test('a skip for a different date leaves the sport slot in the denominator', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () =>
        HttpResponse.json([{ id: 's1', dayOfWeek: dow, time: '17:00', durationMin: 90, kind: 'training', location: 'BVSC', intensityLabel: 'közepes' }]),
      ),
      http.get(`${API_BASE}/api/train/sport-slot-skips`, () =>
        HttpResponse.json([{ dayOfWeek: dow, time: '17:00', date: '1999-01-01' }]),
      ),
    )
    const { Wrapper, qc } = wrapperWithClient()
    const { result } = renderHook(() => useDayOrbFill(), { wrapper: Wrapper })
    await waitFor(() => expect(qc.getQueryState(['train', 'sportSchedule'])?.status).toBe('success'))
    await waitFor(() => expect(result.current.denominator).toBe(6))
  })
})

describe.skipIf(import.meta.env.VITE_USE_MOCK !== 'false')('real-módú hidegindítás — pontos érték', () => {
  test('nincs adat: present=0, denominator=5, pct=0, label „még nincs adat"', () => {
    const { result } = renderHook(() => useDayOrbFill(), { wrapper })
    expect(result.current.present).toBe(0)
    expect(result.current.denominator).toBe(5)
    expect(result.current.pct).toBe(0)
    expect(result.current.label).toBe('A mai napod · még nincs adat')
  })
})
