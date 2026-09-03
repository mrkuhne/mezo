import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

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

test('a present sosem nagyobb a nevezőnél', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.present).toBeLessThanOrEqual(result.current.denominator)
})

test('az intenzitás a 0…1 tartományban van', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.intensity).toBeGreaterThanOrEqual(0)
  expect(result.current.intensity).toBeLessThanOrEqual(1)
})

test('a label mindkét módban „A mai napod"-dal kezdődik', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.label).toMatch(/^A mai napod/)
})
