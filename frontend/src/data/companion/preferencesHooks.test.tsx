import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper, makeHookWrapperWithClient } from '@/test/queryWrapper'
import { useCompanionPreferences, usePersonalContext, useAccountSettings } from '@/data/companion/preferencesHooks'

afterEach(() => vi.unstubAllEnvs())
const prefs = { aboutMe: 'Fejlesztő vagyok', customInstructions: 'Röviden válaszolj', useLearnedProfile: false }
test('real preferences persist all fields, including deliberate clearing', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let saved = prefs
  server.use(
    http.get(`${API_BASE}/api/companion/preferences`, () => HttpResponse.json(saved)),
    http.put(`${API_BASE}/api/companion/preferences`, async ({ request }) => {
      saved = await request.json() as typeof prefs
      return HttpResponse.json(saved)
    }),
  )
  const { result } = renderHook(() => useCompanionPreferences(), { wrapper: makeHookWrapper() })
  expect(result.current.data).toBeNull()
  await waitFor(() => expect(result.current.data).toEqual(prefs))
  await act(() => result.current.save({ ...prefs, aboutMe: '' }))
  expect(saved.aboutMe).toBe('')
  await waitFor(() => expect(result.current.data?.aboutMe).toBe(''))
})
test('mock edits survive remount in the same session and drive the preview', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const wrapper = makeHookWrapper()
  const first = renderHook(() => useCompanionPreferences(), { wrapper })
  await act(() => first.result.current.save(prefs))
  first.unmount()
  const second = renderHook(() => ({ preferences: useCompanionPreferences(), context: usePersonalContext() }), { wrapper })
  expect(second.result.current.preferences.data).toEqual(prefs)
  expect(second.result.current.context.data?.renderedText).toContain(prefs.aboutMe)
  expect(second.result.current.context.data?.renderedText).toContain(prefs.customInstructions)
  expect(second.result.current.context.data?.sections.find(s => s.id === 'learned')?.included).toBe(false)
})
test('real context displays the exact server text without a demo fallback', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/companion/personal-context`, () => HttpResponse.json({ renderedText: 'Pontos szerverblokk', sections: [] })))
  const { result } = renderHook(() => usePersonalContext(), { wrapper: makeHookWrapper() })
  expect(result.current.data).toBeNull()
  await waitFor(() => expect(result.current.data?.renderedText).toBe('Pontos szerverblokk'))
})

test('account source correction sends PUT and refreshes canonical account cache', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { wrapper, client } = makeHookWrapperWithClient()
  const me = { id: 'u1', name: 'Régi név', email: 'old@example.com', role: 'OWNER', status: 'ACTIVE', onboardingCompleted: true }
  client.setQueryData(ME_QUERY_KEY, me)
  let body: unknown
  server.use(http.put(`${API_BASE}/api/auth/me`, async ({ request }) => {
    body = await request.json()
    return HttpResponse.json({ ...me, ...(body as object) })
  }))
  const { result } = renderHook(() => useAccountSettings(), { wrapper })
  await act(() => result.current.save({ name: 'Dani', email: 'new@example.com' }))
  await waitFor(() => expect(result.current.data?.name).toBe('Dani'))
  expect(body).toEqual({ name: 'Dani', email: 'new@example.com' })
  expect(client.getQueryData(ME_QUERY_KEY)).toMatchObject({ id: 'u1', role: 'OWNER', name: 'Dani' })
})
