// ============================================================
// Mezo · useMinuteTick — ébredés felfüggesztett fülből (mezo-1d46).
//
// A modul-szintű óra 60 s-os intervallumról lép, és `getSnapshot` a gyorsítótárazott `now`-t
// csak akkor frissíti, ha ÉPP NINCS feliratkozó. A futó appban viszont mindig van, tehát egy
// felfüggesztett/throttle-olt fül ébredéskor ELAVULT tickkel indul, amíg a következő ütem le
// nem esik. A `MezoThreadProvider` ebből képzi a nap kulcsát (`localDateString(tick)`), így a
// legrosszabb esetben az ELŐZŐ nap kulcsa alatt bélyegzi az olvasott-vízjelet vagy olvassa a
// nudge-logot. Egy percen belül magától gyógyul, de a napváltás pillanatában rossz napra ír.
//
// A javítás a láthatóság-váltásra frissít, tehát MINDEN fogyasztó gyógyul, nem csak a szál.
// Spec: bd mezo-1d46
// ============================================================
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { localDateString } from '@/shared/lib/dates'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

test('ébredéskor a fül FRISS órát lát, nem az elalvás előttit', () => {
  vi.setSystemTime(new Date(2026, 8, 4, 23, 59, 0))
  const { result } = renderHook(() => useMinuteTick())
  const before = localDateString(result.current)

  // A fül felfüggesztve: a fali óra átlép a következő napba, DE az intervallum nem futott le
  // (pontosan ez történik egy throttle-olt tabban).
  vi.setSystemTime(new Date(2026, 8, 5, 8, 30, 0))
  expect(localDateString(result.current)).toBe(before) // még mindig az elavult tick

  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(localDateString(result.current)).toBe('2026-09-05')
})

test('a láthatóság-váltás nem rendereltet feleslegesen, ha ugyanabban a percben vagyunk', () => {
  vi.setSystemTime(new Date(2026, 8, 4, 12, 0, 0))
  const { result } = renderHook(() => useMinuteTick())
  const first = result.current
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(result.current).toBe(first) // ugyanaz a PÉLDÁNY — nincs felesleges újrarenderelés
})
