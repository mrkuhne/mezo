import { renderHook, act, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  useCharacterOverview,
  useCharacterDimension,
  useCharacterFeed,
  useCharacterExperts,
  useCharacterConferences,
  useCharacterConference,
  useClaimFeedback,
  useCharacterBootstrap,
  mockClaimFeedbackLog,
} from '@/data/character/characterHooks'
import { confidenceWord } from '@/data/character/characterApi'
import {
  MOCK_CONFERENCES,
  MOCK_CONFERENCE_DETAIL,
  MOCK_DIMENSIONS,
  MOCK_EXPERTS,
  MOCK_FEED,
  MOCK_OVERVIEW,
  MOCK_OVERVIEW_EMPTY,
} from '@/data/character/characterMock'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

// ---------------------------------------------------------------------------
// confidenceWord — the shared threshold mapping (0.75 / 0.5)
// ---------------------------------------------------------------------------
describe('confidenceWord', () => {
  test('maps the three tiers at their exact thresholds', () => {
    expect(confidenceWord(0.9)).toBe('biztos')
    expect(confidenceWord(0.75)).toBe('biztos')
    expect(confidenceWord(0.74)).toBe('valószínű')
    expect(confidenceWord(0.5)).toBe('valószínű')
    expect(confidenceWord(0.49)).toBe('figyeljük')
    expect(confidenceWord(0)).toBe('figyeljük')
  })
})

// ---------------------------------------------------------------------------
// mock mode
// ---------------------------------------------------------------------------
describe('mock mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    mockClaimFeedbackLog.length = 0
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('useCharacterOverview starts at the pre-bootstrap empty seed', async () => {
    const { result } = renderHook(() => useCharacterOverview(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.overview).toEqual(MOCK_OVERVIEW_EMPTY)
  })

  test('useCharacterDimension returns the seeded dimension by key', async () => {
    const { result } = renderHook(() => useCharacterDimension('physical'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.dimension).toEqual(MOCK_DIMENSIONS.physical)
  })

  test('useCharacterFeed returns the full seeded feed, and a limit slices it', async () => {
    const { result: full } = renderHook(() => useCharacterFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(full.current.isLoading).toBe(false))
    expect(full.current.items).toEqual(MOCK_FEED)

    const { result: limited } = renderHook(() => useCharacterFeed(2), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(limited.current.isLoading).toBe(false))
    expect(limited.current.items).toEqual(MOCK_FEED.slice(0, 2))
  })

  test('useCharacterExperts returns the 9-persona catalog', async () => {
    const { result } = renderHook(() => useCharacterExperts(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.experts).toEqual(MOCK_EXPERTS)
    expect(result.current.experts).toHaveLength(9)
  })

  test('useCharacterConferences + useCharacterConference', async () => {
    const { result: list } = renderHook(() => useCharacterConferences(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(list.current.isLoading).toBe(false))
    expect(list.current.conferences).toEqual(MOCK_CONFERENCES)

    const { result: detail } = renderHook(() => useCharacterConference('w2'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(detail.current.isLoading).toBe(false))
    expect(detail.current.conference).toEqual(MOCK_CONFERENCE_DETAIL.w2)

    const { result: none } = renderHook(() => useCharacterConference(null), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(none.current.isLoading).toBe(false))
    expect(none.current.conference).toBeNull()
  })

  test('useClaimFeedback TALAL bumps confidence +0.05 capped at 0.85, word falls out naturally', async () => {
    const wrapper = makeHookWrapper()
    const { result: dim } = renderHook(() => useCharacterDimension('physical'), { wrapper })
    await waitFor(() => expect(dim.current.isLoading).toBe(false))
    const before = dim.current.dimension!.claims.find((c) => c.id === 'physical-claim-2')!
    expect(before.confidence).toBeCloseTo(0.6) // valószínű tier

    const { result: fb } = renderHook(() => useClaimFeedback(), { wrapper })
    await act(async () => {
      await fb.current.submit('physical-claim-2', 'TALAL')
    })
    await waitFor(() => {
      const after = dim.current.dimension!.claims.find((c) => c.id === 'physical-claim-2')!
      expect(after.confidence).toBeCloseTo(0.65)
    })
  })

  test('useClaimFeedback TALAL caps at 0.85 even from a claim already near the ceiling', async () => {
    const wrapper = makeHookWrapper()
    const { result: dim } = renderHook(() => useCharacterDimension('physical'), { wrapper })
    await waitFor(() => expect(dim.current.isLoading).toBe(false))
    const { result: fb } = renderHook(() => useClaimFeedback(), { wrapper })
    // physical-claim-0 starts at 0.8 (biztos) — three bumps would overshoot 0.85 without the cap.
    await act(async () => {
      await fb.current.submit('physical-claim-0', 'TALAL')
      await fb.current.submit('physical-claim-0', 'TALAL')
      await fb.current.submit('physical-claim-0', 'TALAL')
    })
    await waitFor(() => {
      const after = dim.current.dimension!.claims.find((c) => c.id === 'physical-claim-0')!
      expect(after.confidence).toBe(0.85)
    })
  })

  test('useClaimFeedback NEM_IGAZ retires the claim — it disappears from the dimension and the overview', async () => {
    const wrapper = makeHookWrapper()
    const { result: dim } = renderHook(() => useCharacterDimension('physical'), { wrapper })
    const { result: overview } = renderHook(() => useCharacterOverview(), { wrapper })
    await waitFor(() => expect(dim.current.isLoading).toBe(false))
    // Seed the overview cache with the FULL dossier first (empty seed has no topClaims to retire).
    const qc = renderHook(() => useQueryClient(), { wrapper }).result.current
    qc.setQueryData(['characterOverview'], MOCK_OVERVIEW)
    await waitFor(() => expect(overview.current.overview).toEqual(MOCK_OVERVIEW))

    const { result: fb } = renderHook(() => useClaimFeedback(), { wrapper })
    await act(async () => {
      await fb.current.submit('physical-claim-1', 'NEM_IGAZ')
    })
    await waitFor(() => {
      expect(dim.current.dimension!.claims.some((c) => c.id === 'physical-claim-1')).toBe(false)
    })
    const physicalSummary = overview.current.overview!.dimensions.find((d) => d.key === 'physical')!
    expect(physicalSummary.topClaims.some((c) => c.id === 'physical-claim-1')).toBe(false)
  })

  test('useClaimFeedback PONTOSITOM records the correction text without changing the claim', async () => {
    const wrapper = makeHookWrapper()
    const { result: dim } = renderHook(() => useCharacterDimension('physical'), { wrapper })
    await waitFor(() => expect(dim.current.isLoading).toBe(false))
    const before = dim.current.dimension!.claims.find((c) => c.id === 'physical-claim-2')!

    const { result: fb } = renderHook(() => useClaimFeedback(), { wrapper })
    await act(async () => {
      await fb.current.submit('physical-claim-2', 'PONTOSITOM', 'Ez pontosabb így.')
    })
    const after = dim.current.dimension!.claims.find((c) => c.id === 'physical-claim-2')!
    expect(after.confidence).toBe(before.confidence)
    expect(after.text).toBe(before.text)
    expect(mockClaimFeedbackLog).toContainEqual(
      expect.objectContaining({ claimId: 'physical-claim-2', kind: 'PONTOSITOM', text: 'Ez pontosabb így.' }),
    )
  })

  test('useCharacterBootstrap resolves "created" after a short delay and flips the overview empty -> full', async () => {
    const wrapper = makeHookWrapper()
    const { result: overview } = renderHook(() => useCharacterOverview(), { wrapper })
    await waitFor(() => expect(overview.current.overview).toEqual(MOCK_OVERVIEW_EMPTY))

    const { result: boot } = renderHook(() => useCharacterBootstrap(), { wrapper })
    expect(boot.current.result).toBeNull()
    act(() => {
      boot.current.start()
    })
    await waitFor(() => expect(boot.current.pending).toBe(true))
    await waitFor(() => expect(boot.current.result).toBe('created'), { timeout: 2000 })
    expect(boot.current.pending).toBe(false)
    await waitFor(() => expect(overview.current.overview).toEqual(MOCK_OVERVIEW))
  }, 10000)
})

// ---------------------------------------------------------------------------
// real mode
// ---------------------------------------------------------------------------
describe('real mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('useCharacterOverview maps the DTO through', async () => {
    server.use(
      http.get(`${API_BASE}/api/character`, () =>
        HttpResponse.json({ dimensions: [{ key: 'physical', title: 'Fizikai', kind: 'CORE', expertKey: 'doki', maturity: 58, portrait: 'p', topClaims: [] }] }),
      ),
    )
    const { result } = renderHook(() => useCharacterOverview(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.overview).not.toBeNull())
    expect(result.current.overview?.dimensions[0].key).toBe('physical')
  })

  test('useCharacterOverview treats a 404 (switch off) as null, not a throw', async () => {
    server.use(http.get(`${API_BASE}/api/character`, () => new HttpResponse(null, { status: 404 })))
    const { result } = renderHook(() => useCharacterOverview(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.overview).toBeNull()
  })

  test('useCharacterDimension maps the DTO through and 404s to null', async () => {
    server.use(
      http.get(`${API_BASE}/api/character/dimension/physical`, () =>
        HttpResponse.json({ key: 'physical', title: 'Fizikai', kind: 'CORE', expertKey: 'doki', maturity: 58, portrait: 'p', claims: [], revisions: [] }),
      ),
    )
    const { result } = renderHook(() => useCharacterDimension('physical'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.dimension).not.toBeNull())
    expect(result.current.dimension?.title).toBe('Fizikai')

    server.use(http.get(`${API_BASE}/api/character/dimension/missing`, () => new HttpResponse(null, { status: 404 })))
    const { result: missing } = renderHook(() => useCharacterDimension('missing'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(missing.current.isLoading).toBe(false))
    expect(missing.current.dimension).toBeNull()
  })

  test('useCharacterFeed passes the limit as a query param', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE}/api/character/feed`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      }),
    )
    const { result } = renderHook(() => useCharacterFeed(5), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedUrl).toContain('limit=5')
  })

  test('useCharacterExperts unwraps the `experts` envelope', async () => {
    server.use(
      http.get(`${API_BASE}/api/character/experts`, () =>
        HttpResponse.json({ experts: [{ key: 'doki', displayName: 'Doki', role: 'orvos', voiceLine: 'v', watch: [], dimensionKey: 'physical', kind: 'EXPERT' }] }),
      ),
    )
    const { result } = renderHook(() => useCharacterExperts(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.experts).toHaveLength(1)
    expect(result.current.experts[0].key).toBe('doki')
  })

  test('useCharacterConference(null) never hits the network', async () => {
    let called = false
    server.use(
      http.get(`${API_BASE}/api/character/conference/:id`, () => {
        called = true
        return HttpResponse.json({ id: 'x', kind: 'WEEKLY', weekStart: null, generatedAt: 'now', transcript: [], changes: [] })
      }),
    )
    const { result } = renderHook(() => useCharacterConference(null), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.conference).toBeNull()
    expect(called).toBe(false)
  })

  test('useClaimFeedback POSTs the body and invalidates characterDimension + characterOverview + characterFeed', async () => {
    let postedBody: unknown = null
    server.use(
      http.post(`${API_BASE}/api/character/claim/:claimId/feedback`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json({ id: 'physical-claim-2', text: 't', confidence: 0.65, sensitive: false, evidence: [] })
      }),
    )
    const wrapper = makeHookWrapper()
    const invalidated: unknown[] = []
    const { result } = renderHook(
      () => {
        const qc = useQueryClient()
        vi.spyOn(qc, 'invalidateQueries').mockImplementation((filters?: { queryKey?: unknown }) => {
          invalidated.push(filters?.queryKey)
          return Promise.resolve()
        })
        return useClaimFeedback()
      },
      { wrapper },
    )
    await act(async () => {
      await result.current.submit('physical-claim-2', 'TALAL')
    })
    expect(postedBody).toEqual({ kind: 'TALAL' })
    expect(invalidated).toContainEqual(['characterDimension'])
    expect(invalidated).toContainEqual(['characterOverview'])
    expect(invalidated).toContainEqual(['characterFeed'])
  })

  test('useCharacterBootstrap maps 200/204/409 to created/empty/conflict', async () => {
    server.use(
      http.post(`${API_BASE}/api/character/bootstrap`, () =>
        HttpResponse.json({ id: 'b0', kind: 'BOOTSTRAP', weekStart: null, generatedAt: 'now', transcript: [], changes: [] }),
      ),
    )
    const { result: created } = renderHook(() => useCharacterBootstrap(), { wrapper: makeHookWrapper() })
    await act(async () => {
      created.current.start()
    })
    await waitFor(() => expect(created.current.result).toBe('created'))

    server.use(http.post(`${API_BASE}/api/character/bootstrap`, () => new HttpResponse(null, { status: 204 })))
    const { result: empty } = renderHook(() => useCharacterBootstrap(), { wrapper: makeHookWrapper() })
    await act(async () => {
      empty.current.start()
    })
    await waitFor(() => expect(empty.current.result).toBe('empty'))

    server.use(
      http.post(`${API_BASE}/api/character/bootstrap`, () =>
        HttpResponse.json([{ code: 'ALREADY_BOOTSTRAPPED', message: 'x' }], { status: 409 }),
      ),
    )
    const { result: conflict } = renderHook(() => useCharacterBootstrap(), { wrapper: makeHookWrapper() })
    await act(async () => {
      conflict.current.start()
    })
    await waitFor(() => expect(conflict.current.result).toBe('conflict'))
  })
})
