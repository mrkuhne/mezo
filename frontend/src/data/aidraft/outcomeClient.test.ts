import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { API_BASE, setToken } from '@/data/_client/api'
import { reportDraftOutcome } from '@/data/aidraft/outcomeClient'
import { server } from '@/test/msw/server'

/** Flush pending microtasks so "no request was made" / "the promise settled" are real
 *  assertions, not a race against the fire-and-forget `void apiFetch(...).catch()`. */
async function flush() {
  await new Promise((r) => setTimeout(r, 0))
}

beforeEach(() => setToken('t'))
afterEach(() => {
  vi.unstubAllEnvs()
  setToken(null)
})

test('mock mode: no-op — no request at all', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  reportDraftOutcome('draft-1', 'meal_draft', 'accepted')
  await flush()
  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
})

test('a blank draftId is a no-op — nothing to report against', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  reportDraftOutcome('', 'meal_draft', 'accepted')
  await flush()
  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
})

test('real mode happy path: posts once, exactly the feature+outcome body', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: { url: string; body: unknown }[] = []
  server.use(
    http.post(`${API_BASE}/api/ai-drafts/:draftId/outcome`, async ({ request, params }) => {
      calls.push({ url: `${params.draftId}`, body: await request.json() })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  reportDraftOutcome('draft-42', 'meal_draft', 'edited')
  await flush()
  expect(calls).toEqual([{ url: 'draft-42', body: { feature: 'meal_draft', outcome: 'edited' } }])
})

test('a failing request is swallowed — never rejects, never throws synchronously', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.post(`${API_BASE}/api/ai-drafts/:draftId/outcome`, () =>
      HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'boom', type: 'REQUEST' }], { status: 500 }),
    ),
  )
  expect(() => reportDraftOutcome('draft-1', 'meal_draft', 'discarded')).not.toThrow()
  await flush()
})

test('a network-level failure (offline, DNS) is swallowed the same way', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.post(`${API_BASE}/api/ai-drafts/:draftId/outcome`, () => HttpResponse.error()),
  )
  expect(() => reportDraftOutcome('draft-1', 'meal_draft', 'discarded')).not.toThrow()
  await flush()
})

test('a 401 (session-death race) is swallowed too, even though apiFetch also signs the user out', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.post(`${API_BASE}/api/ai-drafts/:draftId/outcome`, () =>
      HttpResponse.json([{ code: 'AUTH_UNAUTHORIZED', message: 'expired', type: 'REQUEST' }], { status: 401 }),
    ),
  )
  expect(() => reportDraftOutcome('draft-1', 'meal_draft', 'accepted')).not.toThrow()
  await flush()
})
