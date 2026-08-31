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
  useCharacterRuns,
  useCharacterRun,
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
  MOCK_RUNS,
  MOCK_RUN_DETAIL,
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

  test('useCharacterRuns filters the seeded run log by [from, to], newest day first', async () => {
    const { result: full } = renderHook(() => useCharacterRuns('2026-07-01', '2026-08-31'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(full.current.isLoading).toBe(false))
    expect(full.current.runs).toEqual(MOCK_RUNS)
    expect(full.current.runs.length).toBeGreaterThan(0)
    // newest day first
    for (let i = 1; i < full.current.runs.length; i++) {
      expect(full.current.runs[i - 1].day >= full.current.runs[i].day).toBe(true)
    }

    const { result: narrow } = renderHook(() => useCharacterRuns('2026-08-24', '2026-08-30'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(narrow.current.isLoading).toBe(false))
    expect(narrow.current.runs.every((r) => r.day >= '2026-08-24' && r.day <= '2026-08-30')).toBe(true)
    expect(narrow.current.runs.some((r) => r.kind === 'WEEKLY')).toBe(true)
  })

  test('useCharacterRuns includes at least two quiet nights (zero counts) and honest quiet-night rows', async () => {
    const { result } = renderHook(() => useCharacterRuns('2026-08-10', '2026-08-30'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const quiet = result.current.runs.filter((r) => r.kind === 'NIGHTLY' && r.observationCount === 0 && r.callCount === 0)
    expect(quiet.length).toBeGreaterThanOrEqual(2)
  })

  test('useCharacterRuns includes one WEEKLY row linking the seeded w2 conference, one MONTHLY, one BOOTSTRAP', async () => {
    const { result } = renderHook(() => useCharacterRuns('2026-01-01', '2026-12-31'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const weekly = result.current.runs.filter((r) => r.kind === 'WEEKLY')
    const monthly = result.current.runs.filter((r) => r.kind === 'MONTHLY')
    const bootstrap = result.current.runs.filter((r) => r.kind === 'BOOTSTRAP')
    expect(weekly).toHaveLength(1)
    expect(weekly[0].conferenceId).toBe('w2')
    expect(monthly).toHaveLength(1)
    expect(bootstrap).toHaveLength(1)
    // conference-kind rows carry callCount 0 by design (the AI-napló is the call-level truth).
    expect(weekly[0].callCount).toBe(0)
    expect(monthly[0].callCount).toBe(0)
    expect(bootstrap[0].callCount).toBe(0)
  })

  // Fix round 1 (mezo-1gim.14, finding 1): CharacterMonthlyService sets observationCount to
  // activeClaims.size() (re-evaluated ACTIVE claims), never 0 — pin it non-zero and equal to the
  // seeded active-claim base (7 CORE + 1 CHAPTER dims, 3 claims each except chapter-work's 2).
  test('MONTHLY run observationCount mirrors the backend: non-zero, the seeded active-claim count', async () => {
    const { result } = renderHook(() => useCharacterRuns('2026-01-01', '2026-12-31'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const monthly = result.current.runs.find((r) => r.kind === 'MONTHLY')!
    expect(monthly.observationCount).toBeGreaterThan(0)
    expect(monthly.observationCount).toBe(23) // 7 CORE dims * 3 claims + 1 CHAPTER dim * 2 claims
  })

  // Fix round 1 (mezo-1gim.14, finding 2): CharacterConferenceService computes a WEEKLY row's
  // detectorKeys as the union of its consumed observations' detector keys — never empty when the
  // week had signal nights (unlike MONTHLY/BOOTSTRAP, which stay [] backend-side).
  test('WEEKLY run detectorKeys is the non-empty union of its observations\' detector keys', async () => {
    const { result: runs } = renderHook(() => useCharacterRuns('2026-01-01', '2026-12-31'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(runs.current.isLoading).toBe(false))
    const weekly = runs.current.runs.find((r) => r.kind === 'WEEKLY')!
    expect(weekly.detectorKeys.length).toBeGreaterThan(0)

    const { result: detail } = renderHook(() => useCharacterRun(weekly.id), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(detail.current.isLoading).toBe(false))
    const observedDetectorKeys = new Set(detail.current.run!.observations.flatMap((o) => o.signals.map((s) => s.detectorKey)))
    expect(new Set(weekly.detectorKeys)).toEqual(observedDetectorKeys)
  })

  // Fix round 1 (mezo-1gim.14, finding 3): a single expert firing two signals in one night is
  // still one LLM call, not two — the fixture night (Aug 15) exists specifically to pin this.
  test('a night with two signals from the same expert dedups callCount to 1', async () => {
    const { result } = renderHook(() => useCharacterRun('ejsz-15'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.run!.summary.observationCount).toBe(2)
    expect(result.current.run!.summary.callCount).toBe(1)
    expect(result.current.run!.summary.expertKeys).toEqual(['drill'])
    expect(result.current.run!.observations).toHaveLength(2)
    expect(result.current.run!.observations.every((o) => o.expertKey === 'drill')).toBe(true)
  })

  // M4 (final review): production DetectorSignals never carry refIds, so refCount is always 0
  // in reality — the mock now mirrors that (previously fabricated 1–3, which SignalChainCard
  // would have rendered as a confident-looking "N forrás-hivatkozás" nowhere real).
  test('useCharacterRun returns the matching detail; a signal chain carries a numeric refCount, honestly 0', async () => {
    const { result } = renderHook(() => useCharacterRun('ejsz-30'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.run).toEqual(MOCK_RUN_DETAIL['ejsz-30'])
    expect(result.current.run!.observations.length).toBeGreaterThan(0)
    const signal = result.current.run!.observations[0].signals[0]
    expect(typeof signal.refCount).toBe('number')
    expect(signal.refCount).toBe(0)
  })

  test('useCharacterRun(null) never resolves a run', async () => {
    const { result } = renderHook(() => useCharacterRun(null), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.run).toBeNull()
  })

  test('useCharacterRun for an unknown id is null (the honest degraded state)', async () => {
    const { result } = renderHook(() => useCharacterRun('does-not-exist'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.run).toBeNull()
  })
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

  test('useCharacterRuns passes from/to as query params and maps the DTO through', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE}/api/character/runs`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([
          { id: 'r1', kind: 'NIGHTLY', day: '2026-08-30', observationCount: 1, callCount: 1, detectorKeys: ['logging-gap'], expertKeys: ['taplalkozo'], conferenceId: null },
        ])
      }),
    )
    const { result } = renderHook(() => useCharacterRuns('2026-08-24', '2026-08-30'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedUrl).toContain('from=2026-08-24')
    expect(capturedUrl).toContain('to=2026-08-30')
    expect(result.current.runs).toHaveLength(1)
    expect(result.current.runs[0].id).toBe('r1')
  })

  test('useCharacterRun maps the DTO through and 404s to null', async () => {
    server.use(
      http.get(`${API_BASE}/api/character/run/:id`, () =>
        HttpResponse.json({
          summary: { id: 'r1', kind: 'NIGHTLY', day: '2026-08-30', observationCount: 1, callCount: 1, detectorKeys: ['logging-gap'], expertKeys: ['taplalkozo'], conferenceId: null },
          observations: [{ id: 'o1', expertKey: 'taplalkozo', dimensionKeys: ['nutrition'], text: 't', salience: 0.5, signals: [{ detectorKey: 'logging-gap', summary: 's', refCount: 2 }] }],
        }),
      ),
    )
    const { result } = renderHook(() => useCharacterRun('r1'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.run).not.toBeNull())
    expect(result.current.run?.summary.id).toBe('r1')
    expect(result.current.run?.observations[0].signals[0].refCount).toBe(2)

    server.use(http.get(`${API_BASE}/api/character/run/:id`, () => new HttpResponse(null, { status: 404 })))
    const { result: missing } = renderHook(() => useCharacterRun('missing'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(missing.current.isLoading).toBe(false))
    expect(missing.current.run).toBeNull()
  })

  test('useCharacterRun(null) never hits the network', async () => {
    let called = false
    server.use(
      http.get(`${API_BASE}/api/character/run/:id`, () => {
        called = true
        return HttpResponse.json({ summary: { id: 'x', kind: 'NIGHTLY', day: '2026-08-30', observationCount: 0, callCount: 0, detectorKeys: [], expertKeys: [], conferenceId: null }, observations: [] })
      }),
    )
    const { result } = renderHook(() => useCharacterRun(null), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.run).toBeNull()
    expect(called).toBe(false)
  })
})
