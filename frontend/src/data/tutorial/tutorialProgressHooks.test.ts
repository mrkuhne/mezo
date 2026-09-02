import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'
import { isMockMode } from '@/data/_client/mode'
import { useTutorialProgress, useTutorialProgressActions } from '@/data/tutorial/tutorialProgressHooks'

const ENTRY = { version: 1, seenAt: '2026-09-02T12:00:00.000Z', completedAt: null, dismissedAtStep: null }

test('üres ghost-tal indul, és a PUT után a mentett map jön vissza', async () => {
  const wrapper = makeHookWrapper()
  const { result } = renderHook(() => ({ q: useTutorialProgress(), a: useTutorialProgressActions() }), { wrapper })
  expect(result.current.q.progress).toEqual({})

  await act(async () => { await result.current.a.setProgress({ fuel: ENTRY }) })
  await waitFor(() => expect(result.current.q.progress).toEqual({ fuel: ENTRY }))
})

test('a fenti PUT nem szivárog át — friss render üres ghost-ot lát (MSW state reset tesztek közt)', async () => {
  if (isMockMode()) return // mock módban a QueryClient (nem az MSW state) hordozza az állapotot
  // Szándékosan nincs itt sem PUT, sem DELETE: az előző teszt PUT-olt egy nem-üres map-et; ha az
  // `afterEach(() => resetTutorialProgressState())` (src/test/setup.ts) nem futna le, ez a GET a
  // maradék { fuel: ENTRY } state-et látná `server.resetHandlers()` ellenére is (ami csak a
  // handler-listát regisztrálja újra, a modul-szintű `tutorialProgressState`-et nem törli).
  const { result } = renderHook(() => useTutorialProgress(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.progress).toEqual({})
})

test('reset után újra üres', async () => {
  const wrapper = makeHookWrapper()
  const { result } = renderHook(() => ({ q: useTutorialProgress(), a: useTutorialProgressActions() }), { wrapper })
  await act(async () => { await result.current.a.setProgress({ fuel: ENTRY }) })
  await waitFor(() => expect(result.current.q.progress).toEqual({ fuel: ENTRY }))
  await act(async () => { await result.current.a.resetProgress() })
  await waitFor(() => expect(result.current.q.progress).toEqual({}))
})

test('valós módban a GET-hiba isError-t ad, a progress marad az üres ghost (sosem dob)', async () => {
  if (isMockMode()) return // mock módban nincs hálózat
  server.use(http.get(`${API_BASE}/api/tutorial/progress`, () => HttpResponse.json([], { status: 500 })))
  const { result } = renderHook(() => useTutorialProgress(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.progress).toEqual({})
})
