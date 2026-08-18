import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useJournalActions, useJournalNotes } from '@/data/hooks'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const FROM = '2026-07-01'
const TO = '2026-08-18'

describe('useJournalNotes (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the 5-entry seed synchronously, filtered by range and newest first', () => {
    const { result } = renderHook(() => useJournalNotes(FROM, TO), { wrapper: makeHookWrapper() })
    expect(result.current.data).toHaveLength(5)
    expect(result.current.data[0].id).toBe('jn5')
    expect(result.current.data[4].id).toBe('jn1')
  })

  test('a narrower range excludes entries outside it', () => {
    const { result } = renderHook(() => useJournalNotes('2026-08-01', '2026-08-31'), { wrapper: makeHookWrapper() })
    expect(result.current.data).toHaveLength(3)
    expect(result.current.data.every((n) => n.occurredOn >= '2026-08-01')).toBe(true)
  })
})

describe('useJournalActions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('addNote prepends a quickinput note into every cached journal query', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useJournalNotes(FROM, TO), { wrapper })
    const actions = renderHook(() => useJournalActions(), { wrapper })
    expect(list.result.current.data).toHaveLength(5)

    let created
    await act(async () => {
      created = await actions.result.current.addNote('Új napló bejegyzés.', '2026-08-16')
    })

    expect(created!.text).toBe('Új napló bejegyzés.')
    expect(created!.source).toBe('quickinput')
    await waitFor(() => expect(list.result.current.data).toHaveLength(6))
    expect(list.result.current.data[0].text).toBe('Új napló bejegyzés.')
    expect(list.result.current.data[0].occurredOn).toBe('2026-08-16')
  })

  test('addNote only lands in cached ranges that actually contain its occurredOn (mezo-b3pp.1 review fix)', async () => {
    // Task 7's "Korábbi hónapok" widens `from`, so an August-only range and a July-only range can
    // both be cached at once (mock's staleTime: Infinity keeps them alive). A note dated inside
    // ONLY the August range must show up there and must NOT leak into the July-only range.
    const wrapper = makeHookWrapper()
    const august = renderHook(() => useJournalNotes('2026-08-01', '2026-08-31'), { wrapper })
    const july = renderHook(() => useJournalNotes('2026-07-01', '2026-07-31'), { wrapper })
    const actions = renderHook(() => useJournalActions(), { wrapper })
    expect(august.result.current.data).toHaveLength(3)
    expect(july.result.current.data).toHaveLength(2)

    await act(async () => {
      await actions.result.current.addNote('Csak augusztusi bejegyzés.', '2026-08-16')
    })

    await waitFor(() => expect(august.result.current.data).toHaveLength(4))
    expect(august.result.current.data.some((n) => n.text === 'Csak augusztusi bejegyzés.')).toBe(true)
    // The July-only cache entry must be untouched — no leak across ranges.
    expect(july.result.current.data).toHaveLength(2)
    expect(july.result.current.data.some((n) => n.text === 'Csak augusztusi bejegyzés.')).toBe(false)
  })

  test('addNote inserts a back-dated note in its sorted (newest-first) position, not always at index 0', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useJournalNotes(FROM, TO), { wrapper })
    const actions = renderHook(() => useJournalActions(), { wrapper })
    // Seed order (newest first): jn5 2026-08-15, jn4 2026-08-10, jn3 2026-08-02, jn2 2026-07-22, jn1 2026-07-08.
    await act(async () => {
      await actions.result.current.addNote('Július közepi utólagos bejegyzés.', '2026-07-15')
    })
    await waitFor(() => expect(list.result.current.data).toHaveLength(6))
    const ids = list.result.current.data.map((n) => n.text === 'Július közepi utólagos bejegyzés.' ? 'NEW' : n.id)
    // Must land between jn2 (2026-07-22) and jn1 (2026-07-08) — NOT prepended at index 0.
    expect(ids).toEqual(['jn5', 'jn4', 'jn3', 'jn2', 'NEW', 'jn1'])
  })

  test('updateNote drops the note from a cached range it no longer falls into, and leaves other ranges alone', async () => {
    const wrapper = makeHookWrapper()
    const august = renderHook(() => useJournalNotes('2026-08-01', '2026-08-31'), { wrapper })
    const wide = renderHook(() => useJournalNotes(FROM, TO), { wrapper })
    const actions = renderHook(() => useJournalActions(), { wrapper })
    expect(august.result.current.data).toHaveLength(3)
    expect(wide.result.current.data).toHaveLength(5)

    // jn5 (2026-08-15, inside the August-only range) moves to July — it must leave the
    // August-only cache entry but stay present (repositioned) in the wide range.
    await act(async () => {
      await actions.result.current.updateNote('jn5', 'Áthelyezve júliusra.', '2026-07-05')
    })

    await waitFor(() => expect(august.result.current.data).toHaveLength(2))
    expect(august.result.current.data.find((n) => n.id === 'jn5')).toBeUndefined()
    await waitFor(() => expect(wide.result.current.data.find((n) => n.id === 'jn5')?.occurredOn).toBe('2026-07-05'))
    expect(wide.result.current.data).toHaveLength(5)
  })

  test('updateNote edits text and day on the seeded entry', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useJournalNotes(FROM, TO), { wrapper })
    const actions = renderHook(() => useJournalActions(), { wrapper })

    await act(async () => {
      await actions.result.current.updateNote('jn1', 'Frissített szöveg.', '2026-07-09')
    })

    await waitFor(() => expect(list.result.current.data.find((n) => n.id === 'jn1')?.text).toBe('Frissített szöveg.'))
    expect(list.result.current.data.find((n) => n.id === 'jn1')?.occurredOn).toBe('2026-07-09')
  })

  test('removeNote deletes the seeded entry from every cached journal query', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useJournalNotes(FROM, TO), { wrapper })
    const actions = renderHook(() => useJournalActions(), { wrapper })
    expect(list.result.current.data).toHaveLength(5)

    await act(async () => {
      await actions.result.current.removeNote('jn3')
    })

    await waitFor(() => expect(list.result.current.data).toHaveLength(4))
    expect(list.result.current.data.find((n) => n.id === 'jn3')).toBeUndefined()
  })
})

describe('useJournalNotes (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved, then resolves the default handler', async () => {
    const { result } = renderHook(() => useJournalNotes(FROM, TO), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual([])
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toEqual([])
  })

  test('maps a wire row from the server', async () => {
    server.use(
      http.get(`${API_BASE}/api/journal`, () =>
        HttpResponse.json([
          { id: 'jn-live', occurredOn: '2026-08-05', text: 'Élő bejegyzés.', source: 'ritual', createdAt: '2026-08-05T06:00:00Z' },
        ]),
      ),
    )
    const { result } = renderHook(() => useJournalNotes(FROM, TO), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data[0]).toEqual({
      id: 'jn-live',
      occurredOn: '2026-08-05',
      text: 'Élő bejegyzés.',
      source: 'ritual',
      createdAt: '2026-08-05T06:00:00Z',
    })
  })
})

describe('useJournalActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('addNote POSTs and resolves the mapped note', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${API_BASE}/api/journal`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(
          { id: 'jn-new', occurredOn: '2026-08-18', text: 'Élő új bejegyzés.', source: 'quickinput', createdAt: '2026-08-18T12:00:00Z' },
          { status: 201 },
        )
      }),
    )
    const { result } = renderHook(() => useJournalActions(), { wrapper: makeHookWrapper() })
    let created
    await act(async () => {
      created = await result.current.addNote('Élő új bejegyzés.', '2026-08-18')
    })
    expect(capturedBody).toEqual({ text: 'Élő új bejegyzés.', occurredOn: '2026-08-18', source: 'quickinput' })
    expect(created!.id).toBe('jn-new')
    expect(created!.text).toBe('Élő új bejegyzés.')
  })

  test('updateNote PUTs and resolves the mapped note', async () => {
    let capturedBody: unknown
    server.use(
      http.put(`${API_BASE}/api/journal/jn-1`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(
          { id: 'jn-1', occurredOn: '2026-08-11', text: 'Frissített élő szöveg.', source: 'quickinput', createdAt: '2026-08-10T22:05:00Z' },
        )
      }),
    )
    const { result } = renderHook(() => useJournalActions(), { wrapper: makeHookWrapper() })
    let updated
    await act(async () => {
      updated = await result.current.updateNote('jn-1', 'Frissített élő szöveg.', '2026-08-11')
    })
    expect(capturedBody).toEqual({ text: 'Frissített élő szöveg.', occurredOn: '2026-08-11' })
    expect(updated!.occurredOn).toBe('2026-08-11')
  })

  test('removeNote DELETEs and resolves void', async () => {
    let deletedId: string | undefined
    server.use(
      http.delete(`${API_BASE}/api/journal/:id`, ({ params }) => {
        deletedId = String(params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => useJournalActions(), { wrapper: makeHookWrapper() })
    await act(async () => {
      await result.current.removeNote('jn-1')
    })
    expect(deletedId).toBe('jn-1')
  })
})
