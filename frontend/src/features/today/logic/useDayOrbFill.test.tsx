import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import type { DayEvaluationResponse } from '@/data/hooks'
import { NEUTRAL_INTENSITY } from '@/features/today/logic/dayOrbFill'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'

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
describe.skipIf(import.meta.env.VITE_USE_MOCK !== 'false')('real-módú hidegindítás — pontos érték', () => {
  test('nincs adat: present=0, denominator=5, pct=0, label „még nincs adat"', () => {
    const { result } = renderHook(() => useDayOrbFill(), { wrapper })
    expect(result.current.present).toBe(0)
    expect(result.current.denominator).toBe(5)
    expect(result.current.pct).toBe(0)
    expect(result.current.label).toBe('A mai napod · még nincs adat')
  })
})
