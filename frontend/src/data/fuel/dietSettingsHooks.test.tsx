// ============================================================
// Fuel Titanium S5 (mezo-qt5q) — manifest E1 · E7 · E8, ÚJ teszt.
//
// Ez a hook eddig teszt nélkül élt, pedig a manifeszt HÁROM háttér-sora fut rajta át, és
// mindhárom LÁTHATATLAN: ha elnémul, a felületen semmi nem jelzi.
//   • E1 — a diétamentés újraszámolja az AKTÍV CÉLT (a backend 7. recompute-triggere,
//     `DietSettingsService.setSettings`). A frontend oldala egyetlen dolog: a mentés tényleg
//     a `PUT /api/diet/settings`-re megy, a beállítás-lap átépítése után is.
//   • E7 — a mentés ÉRVÉNYTELENÍTI a `['goals']` cache-t, mert a backend épp most írta át a
//     célt. E nélkül a Cél-lap a mentés utáni ELŐZŐ receptet mutatná, amíg valami más nem
//     kényszerít refetchet — a legcsúnyább fajta csendes hiba: a szám ott van, csak hamis.
//     A `['fuelDay']` ugyanezért kell: a napi célok a splittel változtak.
//   • E8 — dual-mód paritás: mock módban a mentés a cache-t írja (nincs hálózat), real módban a
//     szervert; a NYILVÁNOS viselkedés (`settings` visszaolvasható) ugyanaz.
//
// Az őszinte ghost (`DIET_SETTINGS_GHOST`) mindkét módban a mentés előtti igazság: a backend
// config-alapértéke, nem kitalált nulla.
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import {
  DIET_SETTINGS_GHOST, useDietSettings, useDietSettingsActions,
} from '@/data/fuel/dietSettingsHooks'
import type { DietSettings } from '@/data/types'

afterEach(() => vi.unstubAllEnvs())

const EDITED: DietSettings = {
  ...DIET_SETTINGS_GHOST, splitPreset: 'low_carb', proteinTier: 'high',
  waterMl: 3500, fiberG: 35, dayTypeShiftKcal: 250,
}

describe('useDietSettings (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the honest ghost synchronously, and setSettings patches the cache', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ read: useDietSettings(), act: useDietSettingsActions() }), { wrapper })
    expect(result.current.read.settings).toEqual(DIET_SETTINGS_GHOST)
    await act(() => result.current.act.setSettings(EDITED))
    await waitFor(() => expect(result.current.read.settings).toEqual(EDITED))
  })
})

describe('useDietSettings (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts from the ghost, then loads the server value', async () => {
    server.use(http.get(`${API_BASE}/api/diet/settings`, () => HttpResponse.json({
      splitPreset: 'highprotein', proteinTier: 'high', waterMl: 3000, fiberG: 32,
      dayTypeShiftKcal: 300,
    })))
    const { result } = renderHook(() => useDietSettings(), { wrapper: makeHookWrapper() })
    expect(result.current.settings).toEqual(DIET_SETTINGS_GHOST)
    await waitFor(() => expect(result.current.settings.splitPreset).toBe('highprotein'))
    // Az el nem küldött százalékok őszinte nullok, nem 0-k.
    expect(result.current.settings.proteinPctX10).toBeNull()
  })

  // E1: a mentés ÚTJA a goal-recompute triggere. Ha ez az egy PUT elmarad vagy máshová megy, a
  // cél soha nem íródik újra — és a felületen semmi nem jelzi.
  it('setSettings PUTs the edited settings to /api/diet/settings (the goal-recompute trigger)', async () => {
    let putBody: unknown
    let puts = 0
    server.use(
      http.put(`${API_BASE}/api/diet/settings`, async ({ request }) => {
        puts += 1
        putBody = await request.json()
        return HttpResponse.json(putBody as object)
      }),
      http.get(`${API_BASE}/api/diet/settings`, () => HttpResponse.json(EDITED)),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ read: useDietSettings(), act: useDietSettingsActions() }), { wrapper })
    await act(() => result.current.act.setSettings(EDITED))
    expect(puts).toBe(1)
    expect(putBody).toMatchObject({
      splitPreset: 'low_carb', proteinTier: 'high', waterMl: 3500, fiberG: 35,
      dayTypeShiftKcal: 250,
    })
    await waitFor(() => expect(result.current.read.settings.splitPreset).toBe('low_carb'))
  })

  // E7: a kereszt-domain érvénytelenítés. A backend a mentéssel ÚJRA ÍRTA a célt, tehát a
  // `['goals']` (+ a napi `['fuelDay']`) olvasás elavult — ha nem ürítjük, a Cél-lap a mentés
  // utáni ELŐZŐ receptet mutatja.
  it('setSettings invalidates ["dietSettings"], ["goals"] AND ["fuelDay"]', async () => {
    server.use(
      http.put(`${API_BASE}/api/diet/settings`, () => HttpResponse.json(EDITED)),
      http.get(`${API_BASE}/api/diet/settings`, () => HttpResponse.json(EDITED)),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => useDietSettingsActions(), { wrapper })
    // A QueryClientet a wrapper adja, ezért a spyt a prototípusra tesszük: minden
    // invalidateQueries hívás kulcsa begyűjtődik, bármelyik kliensen fut.
    const { QueryClient } = await import('@tanstack/react-query')
    const keys: unknown[] = []
    const spy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
      .mockImplementation(function (this: InstanceType<typeof QueryClient>, filters) {
        keys.push(filters?.queryKey)
        return Promise.resolve()
      })
    try {
      await act(() => result.current.setSettings(EDITED))
    } finally {
      spy.mockRestore()
    }
    const flat = keys.map(k => JSON.stringify(k))
    expect(flat).toContain(JSON.stringify(['dietSettings']))
    expect(flat).toContain(JSON.stringify(['goals']))
    expect(flat).toContain(JSON.stringify(['fuelDay']))
  })
})
