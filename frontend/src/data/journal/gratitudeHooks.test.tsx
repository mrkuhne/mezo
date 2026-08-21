import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useGratitudeEntries, useGratitudeActions } from '@/data/hooks'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const FROM = '2026-08-01'
const TO = '2026-08-31'

describe('useGratitudeEntries (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the 6-entry seed synchronously, filtered by range and newest first', () => {
    const { result } = renderHook(() => useGratitudeEntries(FROM, TO), { wrapper: makeHookWrapper() })
    expect(result.current.data).toHaveLength(6)
    expect(result.current.data[0].id).toBe('g6')
    expect(result.current.data[5].id).toBe('g1')
  })

  test('a narrower range excludes entries outside it', () => {
    const { result } = renderHook(() => useGratitudeEntries('2026-08-19', '2026-08-20'), { wrapper: makeHookWrapper() })
    expect(result.current.data).toHaveLength(3)
    expect(result.current.data.every((e) => e.occurredOn >= '2026-08-19')).toBe(true)
  })
})

describe('useGratitudeActions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('addEntry inserts newest-first into the cached range', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useGratitudeEntries(FROM, TO), { wrapper })
    const actions = renderHook(() => useGratitudeActions(), { wrapper })
    expect(list.result.current.data).toHaveLength(6)

    let created
    await act(async () => {
      created = await actions.result.current.addEntry('Hála a reggeli csendért', 'mindfulness', '2026-08-21')
    })

    expect(created!.text).toBe('Hála a reggeli csendért')
    expect(created!.lifeArea).toBe('mindfulness')
    await waitFor(() => expect(list.result.current.data).toHaveLength(7))
    expect(list.result.current.data[0].text).toBe('Hála a reggeli csendért')
    expect(list.result.current.data[0].lifeArea).toBe('mindfulness')
  })

  test('addEntry only lands in cached ranges that actually contain its occurredOn', async () => {
    const wrapper = makeHookWrapper()
    const august = renderHook(() => useGratitudeEntries('2026-08-01', '2026-08-31'), { wrapper })
    const narrow = renderHook(() => useGratitudeEntries('2026-08-19', '2026-08-20'), { wrapper })
    const actions = renderHook(() => useGratitudeActions(), { wrapper })
    expect(august.result.current.data).toHaveLength(6)
    expect(narrow.result.current.data).toHaveLength(3)

    await act(async () => {
      await actions.result.current.addEntry('Csak augusztus 21.', null, '2026-08-21')
    })

    await waitFor(() => expect(august.result.current.data).toHaveLength(7))
    expect(august.result.current.data.some((e) => e.text === 'Csak augusztus 21.')).toBe(true)
    // The narrow range [19,20] must be untouched.
    expect(narrow.result.current.data).toHaveLength(3)
  })

  test('removeEntry deletes from every cached gratitude query', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useGratitudeEntries(FROM, TO), { wrapper })
    const actions = renderHook(() => useGratitudeActions(), { wrapper })
    expect(list.result.current.data).toHaveLength(6)

    await act(async () => {
      await actions.result.current.removeEntry('g3')
    })

    await waitFor(() => expect(list.result.current.data).toHaveLength(5))
    expect(list.result.current.data.find((e) => e.id === 'g3')).toBeUndefined()
  })
})

describe('useGratitudeEntries (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved, then resolves the default handler', async () => {
    const { result } = renderHook(() => useGratitudeEntries(FROM, TO), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual([])
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toEqual([])
  })

  test('maps a wire row from the server', async () => {
    server.use(
      http.get(`${API_BASE}/api/journal/gratitude`, () =>
        HttpResponse.json([
          { id: 'g-live', occurredOn: '2026-08-21', text: 'Élő hála', lifeArea: null, createdAt: '2026-08-21T06:00:00Z' },
        ]),
      ),
    )
    const { result } = renderHook(() => useGratitudeEntries(FROM, TO), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data[0]).toEqual({
      id: 'g-live',
      occurredOn: '2026-08-21',
      text: 'Élő hála',
      lifeArea: null,
      createdAt: '2026-08-21T06:00:00Z',
    })
  })
})

describe('useGratitudeActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('addEntry POSTs and resolves the mapped entry', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${API_BASE}/api/journal/gratitude`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(
          { id: 'g-new', occurredOn: '2026-08-21', text: 'Élő hála bejegyzés', lifeArea: 'cooking', createdAt: '2026-08-21T12:00:00Z' },
          { status: 201 },
        )
      }),
    )
    const { result } = renderHook(() => useGratitudeActions(), { wrapper: makeHookWrapper() })
    let created
    await act(async () => {
      created = await result.current.addEntry('Élő hála bejegyzés', 'cooking', '2026-08-21')
    })
    expect(capturedBody).toEqual({ text: 'Élő hála bejegyzés', lifeArea: 'cooking', occurredOn: '2026-08-21' })
    expect(created!.id).toBe('g-new')
    expect(created!.text).toBe('Élő hála bejegyzés')
  })

  test('removeEntry DELETEs and resolves void', async () => {
    let deletedId: string | undefined
    server.use(
      http.delete(`${API_BASE}/api/journal/gratitude/:id`, ({ params }) => {
        deletedId = String(params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => useGratitudeActions(), { wrapper: makeHookWrapper() })
    await act(async () => {
      await result.current.removeEntry('g-1')
    })
    expect(deletedId).toBe('g-1')
  })
})
