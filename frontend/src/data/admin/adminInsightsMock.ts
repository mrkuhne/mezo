import { MOCK_ANNA_ID, MOCK_BELA_ID, MOCK_OWNER_ID } from '@/data/admin/adminMock'
import type {
  AdminCostMatrixResponse,
  AdminDayAmount,
  AdminDayCount,
  AdminDaySeries,
  AdminFeatureUsageResponse,
  AdminOverviewResponse,
  AdminScreenUsageResponse,
  AdminUserDetailResponse,
  AdminUserInsightResponse,
} from '@/data/admin/adminInsightsApi'

// Admin hub insights seed (mezo-d5iy.10). Reuses MOCK_OWNER_ID/MOCK_ANNA_ID/MOCK_BELA_ID from
// adminMock.ts so the beta-admin (invites/accounts) surface and this insights surface agree on
// ids — the same three fictive accounts appear in both.

/**
 * Last `n` ISO calendar days (YYYY-MM-DD), oldest first, ending TODAY. Computed once at module
 * load from the real clock so `costSeries` etc. always have exactly `n` entries ending "today" —
 * deterministic in the sense that no test asserts a specific date string, only length and
 * aggregate values (`some(d => amountUsd > 0)`), which do not depend on which day "today" is.
 */
function lastNDays(n: number): string[] {
  const today = new Date()
  const days: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

const OVERVIEW_DAYS = lastNDays(30)

// Deterministic (day-index-driven, no Math.random) so the fixture never flakes.
const activeUserSeries: AdminDayCount[] = OVERVIEW_DAYS.map((day, i) => ({ day, count: 6 + (i % 5) }))
const domainSeries: AdminDaySeries[] = [
  { key: 'train', days: OVERVIEW_DAYS.map((day, i) => ({ day, count: 2 + (i % 4) })) },
  { key: 'food', days: OVERVIEW_DAYS.map((day, i) => ({ day, count: 4 + (i % 6) })) },
  { key: 'journal', days: OVERVIEW_DAYS.map((day, i) => ({ day, count: 1 + (i % 3) })) },
]
const costSeries: AdminDayAmount[] = OVERVIEW_DAYS.map((day, i) => ({
  day,
  amountUsd: Number((0.42 + (i % 7) * 0.31).toFixed(2)),
}))

export const ADMIN_OVERVIEW_MOCK: AdminOverviewResponse = {
  userCount: 3,
  activeToday: 2,
  active7d: 3,
  active30d: 3,
  loggedToday: { train: 4, food: 9, sleep: 1, journal: 2, habits: 6, chat: 3 },
  costTodayUsd: 1.84,
  memoryItemCount: 512,
  vectorCount: 488,
  activeUserSeries,
  domainSeries,
  costSeries,
}

export const ADMIN_OVERVIEW_EMPTY: AdminOverviewResponse = {
  userCount: 0,
  activeToday: 0,
  active7d: 0,
  active30d: 0,
  loggedToday: {},
  costTodayUsd: 0,
  memoryItemCount: 0,
  vectorCount: 0,
  activeUserSeries: [],
  domainSeries: [],
  costSeries: [],
}

export const ADMIN_USER_INSIGHTS_MOCK: AdminUserInsightResponse[] = [
  {
    id: MOCK_OWNER_ID, email: 'daniel@mezo.local', name: 'Daniel', role: 'OWNER', status: 'ACTIVE',
    createdAt: '2026-06-01T08:00:00Z', onboardedAt: '2026-06-01T08:00:00Z', lastSeenAt: '2026-08-14T12:32:00Z',
    lastActivityAt: '2026-08-14T12:32:00Z', rowCount: 2140, vectorCount: 812, cost30dUsd: 14.62, activeDays30d: 27,
  },
  {
    id: MOCK_ANNA_ID, email: 'anna@test.local', name: 'Anna', role: 'USER', status: 'ACTIVE',
    createdAt: '2026-08-02T18:20:00Z', onboardedAt: '2026-08-02T18:35:00Z', lastSeenAt: '2026-08-14T07:10:00Z',
    lastActivityAt: '2026-08-14T07:10:00Z', rowCount: 356, vectorCount: 140, cost30dUsd: 3.21, activeDays30d: 11,
  },
  {
    id: MOCK_BELA_ID, email: 'bela@test.local', name: 'Béla', role: 'USER', status: 'DISABLED',
    createdAt: '2026-08-05T09:00:00Z', onboardedAt: null, lastSeenAt: null,
    lastActivityAt: null, rowCount: 4, vectorCount: 0, cost30dUsd: 0, activeDays30d: 0,
  },
]

export const ADMIN_USER_INSIGHTS_EMPTY: AdminUserInsightResponse[] = []

// The detail mock's `user` is Anna's row from the list mock above (same id/fields) so Task 11
// can navigate list -> detail against the mocks without a mismatch.
const ANNA_INSIGHT = ADMIN_USER_INSIGHTS_MOCK[1]

export const ADMIN_USER_DETAIL_MOCK: AdminUserDetailResponse = {
  user: ANNA_INSIGHT,
  activitySeries: [
    { key: 'train', days: lastNDays(90).map((day, i) => ({ day, count: i % 3 === 0 ? 1 : 0 })) },
    { key: 'food', days: lastNDays(90).map((day, i) => ({ day, count: i % 2 === 0 ? 2 : 0 })) },
  ],
  inventory: [
    { table: 'train_session', rowCount: 84, deletedCount: 2, lastCreatedAt: '2026-08-14T07:00:00Z' },
    { table: 'food_log', rowCount: 210, deletedCount: 0, lastCreatedAt: '2026-08-14T06:40:00Z' },
    { table: 'journal_note', rowCount: 22, deletedCount: 1, lastCreatedAt: '2026-08-10T21:00:00Z' },
  ],
  featureUsage30d: { chat: 18, coach: 6, vision: 2 },
  costByFeature30d: [
    { feature: 'chat', calls: 18, costUsd: 2.4, unknownCalls: 0 },
    { feature: 'coach', calls: 6, costUsd: 0.81, unknownCalls: 0 },
    { feature: 'vision', calls: 2, costUsd: 0, unknownCalls: 2 },
  ],
}

const EMPTY_USER_INSIGHT: AdminUserInsightResponse = {
  id: '', email: '', name: '', role: 'USER', status: 'ACTIVE',
  createdAt: '', onboardedAt: null, lastSeenAt: null, lastActivityAt: null,
  rowCount: 0, vectorCount: 0, cost30dUsd: 0, activeDays30d: 0,
}

export const ADMIN_USER_DETAIL_EMPTY: AdminUserDetailResponse = {
  user: EMPTY_USER_INSIGHT,
  activitySeries: [],
  inventory: [],
  featureUsage30d: {},
  costByFeature30d: [],
}

const FEATURE_USAGE_DAYS = lastNDays(30)

export const ADMIN_FEATURE_USAGE_MOCK: AdminFeatureUsageResponse = {
  period: '30d',
  days: FEATURE_USAGE_DAYS,
  features: [
    { key: 'chat', days: FEATURE_USAGE_DAYS.map((day, i) => ({ day, count: 3 + (i % 4) })) },
    { key: 'coach', days: FEATURE_USAGE_DAYS.map((day, i) => ({ day, count: 1 + (i % 2) })) },
    { key: 'vision', days: FEATURE_USAGE_DAYS.map((day, i) => ({ day, count: i % 6 === 0 ? 1 : 0 })) },
  ],
}

// `period` here is unavoidably a real `AdminPeriod` value (the type is `'7d' | '30d' | '90d'`,
// no neutral/unset member) — final review Finding 4 fixed the one place this was displayed
// (AdminUsagePage) to render its own `period` state instead of this field, so the hardcoded
// '30d' no longer reaches the screen; it survives here only as an unused placeholder to satisfy
// the response shape while real-mode data is unresolved.
export const ADMIN_FEATURE_USAGE_EMPTY: AdminFeatureUsageResponse = {
  period: '30d',
  days: [],
  features: [],
}

// Cost matrix: one "Háttér" (background/cron) bucket with a null user id, and one cell that is
// unpriced (costUsd: 0, unknownCalls > 0) so "unknown ≠ zero cost" has a fixture Task 11's
// rendering can exercise.
export const ADMIN_COST_MATRIX_MOCK: AdminCostMatrixResponse = {
  period: '30d',
  users: [
    { id: MOCK_OWNER_ID, label: 'Daniel' },
    { id: MOCK_ANNA_ID, label: 'Anna' },
    { id: MOCK_BELA_ID, label: 'Béla' },
    { id: null, label: 'Háttér' },
  ],
  features: ['chat', 'coach', 'vision'],
  cells: [
    { userId: MOCK_OWNER_ID, feature: 'chat', calls: 40, costUsd: 5.6, unknownCalls: 0 },
    { userId: MOCK_OWNER_ID, feature: 'coach', calls: 12, costUsd: 1.9, unknownCalls: 0 },
    { userId: MOCK_ANNA_ID, feature: 'chat', calls: 18, costUsd: 2.4, unknownCalls: 0 },
    { userId: MOCK_ANNA_ID, feature: 'vision', calls: 2, costUsd: 0, unknownCalls: 2 },
    { userId: MOCK_BELA_ID, feature: 'chat', calls: 1, costUsd: 0.1, unknownCalls: 0 },
    { userId: null, feature: 'chat', calls: 6, costUsd: 0, unknownCalls: 6 },
  ],
  totalUsd: 10.0,
}

// Same caveat as ADMIN_FEATURE_USAGE_EMPTY above — no consumer currently renders this field
// directly (the one cost-matrix caller, AdminOverviewPage, pins the period to '30d' itself).
export const ADMIN_COST_MATRIX_EMPTY: AdminCostMatrixResponse = {
  period: '30d',
  users: [],
  features: [],
  cells: [],
  totalUsd: 0,
}

// Screen usage (mezo-o5cz) — the "Képernyők" panel's seed. Route PATTERNS, never concrete URLs,
// exactly like what the real telemetry client reports; deterministic (index-driven, no random)
// so the fixture cannot flake. Ordered views-desc to match the backend's own sort, so the mock
// and real surfaces render the same shape.
const SCREEN_USAGE_SEED: { screen: string; base: number; users: number }[] = [
  { screen: '/nap', base: 9, users: 3 },
  { screen: '/fuel', base: 6, users: 3 },
  { screen: '/edzes', base: 4, users: 2 },
  { screen: '/mezo/chat', base: 3, users: 2 },
  { screen: '/admin/users/:id', base: 1, users: 1 },
]

export const ADMIN_SCREEN_USAGE_MOCK: AdminScreenUsageResponse = {
  period: '30d',
  days: FEATURE_USAGE_DAYS,
  screens: SCREEN_USAGE_SEED.map(({ screen, base, users }, s) => {
    const days = FEATURE_USAGE_DAYS.map((day, i) => ({ day, count: Math.max(0, base + ((i + s) % 3) - 1) }))
    return {
      screen,
      views: days.reduce((sum, d) => sum + d.count, 0),
      uniqueUsers: users,
      lastSeenAt: `${FEATURE_USAGE_DAYS[FEATURE_USAGE_DAYS.length - 1]}T18:${String(10 + s).padStart(2, '0')}:00Z`,
      days,
    }
  }),
}

// Same caveat as ADMIN_FEATURE_USAGE_EMPTY — AdminUsagePage renders its own `period` state, so
// this hardcoded value never reaches the screen; it exists to satisfy the response shape while
// real-mode data is unresolved.
export const ADMIN_SCREEN_USAGE_EMPTY: AdminScreenUsageResponse = {
  period: '30d',
  days: [],
  screens: [],
}
