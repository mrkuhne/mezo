import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useFuelSettings, useFuelSettingsActions, FUEL_SETTINGS_GHOST } from '@/data/fuel/fuelSettingsHooks'

afterEach(() => vi.unstubAllEnvs())

describe('useFuelSettings (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the ghost synchronously and setSettings patches the cache', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useFuelSettings(), act: useFuelSettingsActions() }), { wrapper })
    expect(result.current.read.settings).toEqual(FUEL_SETTINGS_GHOST)
    await act(() => result.current.act.setSettings({ mealsPerDay: 5, caffeineCutoff: '13:00' }))
    await waitFor(() => expect(result.current.read.settings.mealsPerDay).toBe(5))
  })
})

describe('useFuelSettings (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts from the honest ghost, then loads the server value', async () => {
    server.use(http.get(`${API_BASE}/api/fuel/settings`, () =>
      HttpResponse.json({ mealsPerDay: 6, caffeineCutoff: '12:30' })))
    const { result } = renderHook(() => useFuelSettings(), { wrapper: makeHookWrapper() })
    expect(result.current.settings).toEqual(FUEL_SETTINGS_GHOST)
    await waitFor(() => expect(result.current.settings.mealsPerDay).toBe(6))
  })

  it('setSettings PUTs the exact body and refetches', async () => {
    let putBody: unknown
    server.use(
      http.put(`${API_BASE}/api/fuel/settings`, async ({ request }) => {
        putBody = await request.json()
        return HttpResponse.json(putBody as object)
      }),
      http.get(`${API_BASE}/api/fuel/settings`, () =>
        HttpResponse.json({ mealsPerDay: 3, caffeineCutoff: '15:30' })),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useFuelSettings(), act: useFuelSettingsActions() }), { wrapper })
    await act(() => result.current.act.setSettings({ mealsPerDay: 3, caffeineCutoff: '15:30' }))
    expect(putBody).toEqual({ mealsPerDay: 3, caffeineCutoff: '15:30' })
    await waitFor(() => expect(result.current.read.settings.caffeineCutoff).toBe('15:30'))
  })
})
