import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test, vi } from 'vitest'
import { useCheckins } from '@/data/hooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('useCheckins (real mode) updates the slot locally AND POSTs exactly once with the slot body', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')

  let postCount = 0
  let lastBody: Record<string, unknown> | null = null
  server.use(
    http.post(`${API_BASE}/api/biometrics/checkin`, async ({ request }) => {
      postCount += 1
      lastBody = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 'c1', ...lastBody, savedAt: '2026-06-01T09:00:00Z' }, { status: 200 })
    }),
  )

  const { result } = renderHook(() => useCheckins(), { wrapper: makeHookWrapper() })

  // Slot 2 is the '14:00' "now" slot in initialCheckins.
  act(() => {
    result.current.saveCheckIn(2, {
      state: 'done',
      values: { energy: 8, stress: 3, body: 7, mental: 8 },
      note: 'délutáni',
    })
  })

  // Local optimistic update is synchronous.
  expect(result.current.checkins[2].state).toBe('done')
  expect(result.current.checkins[2].values?.energy).toBe(8)

  await waitFor(() => expect(postCount).toBe(1))
  expect(lastBody).not.toBeNull()
  expect(lastBody).toMatchObject({
    slotTime: '14:00',
    state: 'done',
    energy: 8, stress: 3, body: 7, mental: 8,
    note: 'délutáni',
  })
  expect(typeof lastBody!.date).toBe('string')
})

test('useCheckins (mock mode) updates the slot locally and never fetches', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  let postCount = 0
  server.use(
    http.post(`${API_BASE}/api/biometrics/checkin`, () => {
      postCount += 1
      return HttpResponse.json({ id: 'c1', savedAt: '2026-06-01T09:00:00Z' }, { status: 200 })
    }),
  )

  const { result } = renderHook(() => useCheckins(), { wrapper: makeHookWrapper() })

  act(() => {
    result.current.saveCheckIn(2, { state: 'done', values: { energy: 6, stress: 4, body: 5, mental: 6 }, note: null })
  })

  expect(result.current.checkins[2].state).toBe('done')
  expect(result.current.checkins[2].values?.energy).toBe(6)

  // Give any stray async POST a chance to fire, then assert none did.
  await new Promise(r => setTimeout(r, 20))
  expect(postCount).toBe(0)
})
