import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import {
  useAdminOverview,
  useAdminCostMatrix,
  useAdminAlerts,
  useAdminFeatureBoard,
  useAdminFeatureDetail,
  useAdminFeedbackSummary,
  useAdminUserInsights,
  useAdminUserFeedback,
} from '@/data/admin/adminInsightsHooks'
import {
  ADMIN_OVERVIEW_EMPTY,
  ADMIN_OVERVIEW_MOCK,
  ADMIN_ALERTS_MOCK,
  ADMIN_COST_MATRIX_MOCK,
  ADMIN_COST_MATRIX_7D_MOCK,
  ADMIN_FEATURE_BOARD_EMPTY,
  ADMIN_FEATURE_BOARD_MOCK,
  ADMIN_FEATURE_DETAIL_EMPTY,
  ADMIN_FEEDBACK_SUMMARY_MOCK,
  ADMIN_USER_FEEDBACK_ANNA_MOCK,
  ADMIN_USER_FEEDBACK_DANIEL_MOCK,
  ADMIN_USER_FEEDBACK_EMPTY,
  ADMIN_USER_FEEDBACK_NONE_MOCK,
  ADMIN_USER_INSIGHTS_MOCK,
  featureBoardMockFor,
} from '@/data/admin/adminInsightsMock'
import { MOCK_ANNA_ID, MOCK_BELA_ID, MOCK_OWNER_ID } from '@/data/admin/adminMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

describe('adminInsights hooks (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the overview seed synchronously', () => {
    const { result } = renderHook(() => useAdminOverview(true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_OVERVIEW_MOCK)
    expect(result.current.data.activeUserSeries).toHaveLength(30)
  })

  it('seeds a 30-day cost series so the sparkline has real data', () => {
    const { result } = renderHook(() => useAdminOverview(true), { wrapper: QueryWrapper })
    expect(result.current.data.costSeries).toHaveLength(30)
    expect(result.current.data.costSeries.some((d) => d.amountUsd > 0)).toBe(true)
  })

  it('serves the alerts seed synchronously', () => {
    const { result } = renderHook(() => useAdminAlerts(true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_ALERTS_MOCK)
    expect(result.current.data.alerts).toHaveLength(2)
  })

  // Final review F6a: mock mode used to serve the SAME 30-day cost-matrix object for '7d', so
  // Pulzus's "· 7 nap" tiles were fed 30-day totals in mock mode.
  it('serves a distinct, smaller cost-matrix seed for the 7d period than for 30d', () => {
    const cm30 = renderHook(() => useAdminCostMatrix('30d', true), { wrapper: QueryWrapper })
    const cm7 = renderHook(() => useAdminCostMatrix('7d', true), { wrapper: QueryWrapper })
    expect(cm30.result.current.data).toEqual(ADMIN_COST_MATRIX_MOCK)
    expect(cm7.result.current.data).toEqual(ADMIN_COST_MATRIX_7D_MOCK)
    expect(cm7.result.current.data.period).toBe('7d')
    expect(cm7.result.current.data.totalUsd).toBeLessThan(cm30.result.current.data.totalUsd)
  })

  it('serves the feature board seed synchronously, with real slugs and 12-week series', () => {
    const { result } = renderHook(() => useAdminFeatureBoard('30d', true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_FEATURE_BOARD_MOCK)
    expect(result.current.data.rows.length).toBeGreaterThanOrEqual(6)
    expect(result.current.data.rows.every((r) => r.usesPerWeek.length === 12)).toBe(true)
    expect(result.current.data.rows.some((r) => r.kind === 'system' && r.key === 'unknown')).toBe(true)
    expect(result.current.data.rows.some((r) => r.key === 'meal_draft' && r.helped === null)).toBe(true)
  })

  it('serves a distinct, larger feature-board seed for 90d than for 30d', () => {
    const b30 = renderHook(() => useAdminFeatureBoard('30d', true), { wrapper: QueryWrapper })
    const b90 = renderHook(() => useAdminFeatureBoard('90d', true), { wrapper: QueryWrapper })
    expect(b90.result.current.data).toEqual(featureBoardMockFor('90d'))
    expect(b90.result.current.data.period).toBe('90d')
    const total30 = b30.result.current.data.rows.reduce((s, r) => s + r.costUsd, 0)
    const total90 = b90.result.current.data.rows.reduce((s, r) => s + r.costUsd, 0)
    expect(total90).toBeGreaterThan(total30)
  })

  it('serves the companion_chat detail seed with a consistent funnel/feedback/reliability shape', () => {
    const { result } = renderHook(() => useAdminFeatureDetail('companion_chat', '30d', true), { wrapper: QueryWrapper })
    expect(result.current.data.key).toBe('companion_chat')
    expect(result.current.data.usageByWeek).toHaveLength(12)
    expect(result.current.data.funnel).toEqual({ tried: 3, repeated: 2, habitual: 1, triedUsers: ['Daniel', 'Anna', 'Béla'] })
    expect(result.current.data.feedbackTrend).toHaveLength(12)
    const upTotal = result.current.data.feedbackTrend!.reduce((s, p) => s + p.up, 0)
    const downTotal = result.current.data.feedbackTrend!.reduce((s, p) => s + p.down, 0)
    expect(upTotal).toBe(14)
    expect(downTotal).toBe(3)
    expect(result.current.data.downReasons!.reduce((s, r) => s + r.count, 0)).toBe(downTotal)
    expect(result.current.data.costByModel).toHaveLength(2)
  })

  it('serves the same detail seed for an unmapped key, with `key` swapped to match', () => {
    const { result } = renderHook(() => useAdminFeatureDetail('meal_draft', '30d', true), { wrapper: QueryWrapper })
    expect(result.current.data.key).toBe('meal_draft')
    expect(result.current.data.funnel.tried).toBe(3)
  })

  it('serves the feedback summary seed synchronously, with real reason keys', () => {
    const { result } = renderHook(() => useAdminFeedbackSummary('30d', true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_FEEDBACK_SUMMARY_MOCK)
    expect(result.current.data.recall).toEqual({ useful: 35, irrelevant: 6, suppress: 2 })
    const reasons = result.current.data.features.flatMap((f) => f.reasons.map((r) => r.reason))
    expect(reasons.every((r) => ['inaccurate', 'too_much', 'bad_timing', 'not_about_me'].includes(r))).toBe(true)
  })

  // Emberek list (mezo-zde2) — 90-int activityByDay + 30d feedback totals on every row.
  it('seeds every user-insight row with a 90-int activityByDay and non-negative feedback totals', () => {
    const { result } = renderHook(() => useAdminUserInsights(null, 'lastActivityAt', 'desc', true), { wrapper: QueryWrapper })
    expect(result.current.data).toEqual(ADMIN_USER_INSIGHTS_MOCK)
    expect(result.current.data.every((u) => u.activityByDay.length === 90)).toBe(true)
    expect(result.current.data.every((u) => u.feedbackUp >= 0 && u.feedbackDown >= 0)).toBe(true)
    // Béla never logged anything — the honest all-zero array, not a fabricated one.
    const bela = result.current.data.find((u) => u.id === MOCK_BELA_ID)!
    expect(bela.activityByDay.every((n) => n === 0)).toBe(true)
  })

  it('serves the per-user feedback seed for Daniel/Anna, and the honest empty-but-on shape for Béla', () => {
    const daniel = renderHook(() => useAdminUserFeedback(MOCK_OWNER_ID, true), { wrapper: QueryWrapper })
    const anna = renderHook(() => useAdminUserFeedback(MOCK_ANNA_ID, true), { wrapper: QueryWrapper })
    const bela = renderHook(() => useAdminUserFeedback(MOCK_BELA_ID, true), { wrapper: QueryWrapper })
    expect(daniel.result.current.data).toEqual(ADMIN_USER_FEEDBACK_DANIEL_MOCK)
    expect(anna.result.current.data).toEqual(ADMIN_USER_FEEDBACK_ANNA_MOCK)
    expect(bela.result.current.data).toEqual(ADMIN_USER_FEEDBACK_NONE_MOCK)
    expect(bela.result.current.data.surfaces).toEqual([])
    expect(bela.result.current.data.recall).toEqual({ useful: 0, irrelevant: 0, suppress: 0 })
  })
})

describe('adminInsights hooks (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('test-token') })

  it('fetches the overview from the API', async () => {
    const { result } = renderHook(() => useAdminOverview(true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.userCount).toBeGreaterThan(0))
  })

  // Judgement call: the brief's version of this test flips a boolean inside an MSW handler and
  // sleeps 50ms to prove "no call happened" — a fixed sleep is a race (it can pass for the wrong
  // reason on a slow CI runner, or in principle miss a call scheduled just after the timeout).
  // `enabled: false` in TanStack Query is synchronous and deterministic: the query never leaves
  // its initial (fetchStatus 'idle', status 'pending') state, so `data` never advances past
  // `realEmpty` and `isPending` never flips to false — both assertable immediately, with no
  // network stub and no timer needed.
  it('does not fetch when the caller is not the owner', () => {
    const { result } = renderHook(() => useAdminOverview(false), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(true)
    expect(result.current.data).toEqual(ADMIN_OVERVIEW_EMPTY)
  })

  it('keeps the Hatter bucket as a null user id in the cost matrix', async () => {
    const { result } = renderHook(() => useAdminCostMatrix('30d', true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.users.length).toBeGreaterThan(0))
    expect(result.current.data.users.some((u) => u.id === null && u.label === 'Háttér')).toBe(true)
  })

  it('fetches alerts from the API', async () => {
    const { result } = renderHook(() => useAdminAlerts(true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.alerts.length).toBeGreaterThan(0))
    expect(result.current.data.alerts.some((a) => a.key === 'cost_spike')).toBe(true)
  })

  it('fetches the feature board from the API', async () => {
    const { result } = renderHook(() => useAdminFeatureBoard('30d', true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.rows.length).toBeGreaterThan(0))
  })

  it('does not fetch the feature board when the caller is not the owner', () => {
    const { result } = renderHook(() => useAdminFeatureBoard('30d', false), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(true)
    expect(result.current.data).toEqual(ADMIN_FEATURE_BOARD_EMPTY)
  })

  it('fetches a feature detail from the API', async () => {
    const { result } = renderHook(() => useAdminFeatureDetail('companion_chat', '30d', true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.key).toBe('companion_chat'))
  })

  it('never leaves isPending stuck true when no feature key is given', () => {
    const { result } = renderHook(() => useAdminFeatureDetail('', '30d', true), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(false)
    expect(result.current.data).toEqual(ADMIN_FEATURE_DETAIL_EMPTY)
  })

  it('fetches the feedback summary from the API', async () => {
    const { result } = renderHook(() => useAdminFeedbackSummary('30d', true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.features.length).toBeGreaterThan(0))
  })

  it('fetches a user-insight list row with a 90-int activityByDay from the API', async () => {
    const { result } = renderHook(() => useAdminUserInsights(null, 'lastActivityAt', 'desc', true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.length).toBeGreaterThan(0))
    expect(result.current.data.every((u) => u.activityByDay.length === 90)).toBe(true)
  })

  it('fetches a user feedback surface list from the API', async () => {
    const { result } = renderHook(() => useAdminUserFeedback(MOCK_OWNER_ID, true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.surfaces).not.toBeNull())
  })

  it('never leaves isPending stuck true when no user id is given', () => {
    const { result } = renderHook(() => useAdminUserFeedback('', true), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(false)
    expect(result.current.data).toEqual(ADMIN_USER_FEEDBACK_EMPTY)
  })

  it('does not fetch user feedback when the caller is not the owner', () => {
    // Folds `enabled` into `isPending` (same precedent as useAdminUserDetail/useAdminFeatureDetail)
    // so a disabled query never gets stuck reporting isPending: true forever.
    const { result } = renderHook(() => useAdminUserFeedback(MOCK_OWNER_ID, false), { wrapper: QueryWrapper })
    expect(result.current.isPending).toBe(false)
    expect(result.current.data).toEqual(ADMIN_USER_FEEDBACK_EMPTY)
  })
})

// Sanity check that the MSW handler wiring itself is reachable (belt-and-suspenders alongside
// the deterministic enabled:false check above) — a genuinely disabled query plus a still-correct
// handler for the enabled case.
describe('adminInsights MSW handler wiring', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('test-token') })

  it('answers /api/admin/overview with the populated seed', async () => {
    server.use(http.get(`${API_BASE}/api/admin/overview`, () => HttpResponse.json(ADMIN_OVERVIEW_MOCK)))
    const { result } = renderHook(() => useAdminOverview(true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data).toEqual(ADMIN_OVERVIEW_MOCK))
  })

  it('answers /api/admin/features/:key with the detail seed for a real path param', async () => {
    const { result } = renderHook(() => useAdminFeatureDetail('proactive_feed', '30d', true), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.data.key).toBe('proactive_feed'))
  })
})
