import { MOCK_ANNA_ID, MOCK_BELA_ID, MOCK_OWNER_ID } from '@/data/admin/adminMock'
import type {
  AdminAlertsResponse,
  AdminCostMatrixResponse,
  AdminDayAmount,
  AdminDayCount,
  AdminDaySeries,
  AdminFeatureBoardResponse,
  AdminFeatureDetailResponse,
  AdminFeatureRow,
  AdminFeedbackSummaryResponse,
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

/** An ISO timestamp `daysAgo` days before now (final review F6b) — `ADMIN_USER_INSIGHTS_MOCK`'s
 *  `lastActivityAt`/`lastSeenAt` used to be hardcoded absolute dates that drift further into the
 *  past every day the fixture goes unedited (no test asserts the absolute value, only relative
 *  ordering/formatting), which the Pulzus "Csendes tesztelők" tile's day-count math would
 *  eventually read as an ever-growing, increasingly wrong number of quiet days. */
function daysAgoIso(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
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

// lastSeenAt/lastActivityAt are relative to "now" (final review F6b) — Daniel (the owner) is
// recently active, Anna is quiet enough (>3 days) to land in the Pulzus "Csendes tesztelők"
// tile, Béla has never been seen at all (null, not an invented date). createdAt/onboardedAt stay
// absolute — nothing reads them relative to "today", and no test asserts either literal value.
export const ADMIN_USER_INSIGHTS_MOCK: AdminUserInsightResponse[] = [
  {
    id: MOCK_OWNER_ID, email: 'daniel@mezo.local', name: 'Daniel', role: 'OWNER', status: 'ACTIVE',
    createdAt: '2026-06-01T08:00:00Z', onboardedAt: '2026-06-01T08:00:00Z', lastSeenAt: daysAgoIso(0),
    lastActivityAt: daysAgoIso(0), rowCount: 2140, vectorCount: 812, cost30dUsd: 14.62, activeDays30d: 27,
  },
  {
    id: MOCK_ANNA_ID, email: 'anna@test.local', name: 'Anna', role: 'USER', status: 'ACTIVE',
    createdAt: '2026-08-02T18:20:00Z', onboardedAt: '2026-08-02T18:35:00Z', lastSeenAt: daysAgoIso(25),
    lastActivityAt: daysAgoIso(25), rowCount: 356, vectorCount: 140, cost30dUsd: 3.21, activeDays30d: 11,
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

// Shared day axis for the screen-usage seed below (also used to have fed the now-deleted
// feature×day matrix mock — AdminUsagePage/mezo-kxnn dissolved that page into the Funkciók
// scorecard, which reads `useAdminFeatureBoard` instead).
const FEATURE_USAGE_DAYS = lastNDays(30)

// Cost matrix: one "Háttér" (background/cron) bucket with a null user id, and one cell that is
// unpriced (costUsd: 0, unknownCalls > 0) so "unknown ≠ zero cost" has a fixture Task 11's
// rendering can exercise. Feature slugs are REAL `LlmCallContext` slugs (see labels.ts's
// FEATURE_LABELS) — mezo-m079 Task 3 fix round: the fake 'chat'/'coach'/'vision' placeholders
// had no dictionary entry, so mock mode silently rendered raw slugs instead of Hungarian labels.
export const ADMIN_COST_MATRIX_MOCK: AdminCostMatrixResponse = {
  period: '30d',
  users: [
    { id: MOCK_OWNER_ID, label: 'Daniel' },
    { id: MOCK_ANNA_ID, label: 'Anna' },
    { id: MOCK_BELA_ID, label: 'Béla' },
    { id: null, label: 'Háttér' },
  ],
  features: ['companion_chat', 'meal_coach', 'meal_draft', 'train_meso_plan', 'proactive_feed'],
  cells: [
    { userId: MOCK_OWNER_ID, feature: 'companion_chat', calls: 40, costUsd: 5.6, unknownCalls: 0 },
    { userId: MOCK_OWNER_ID, feature: 'meal_coach', calls: 12, costUsd: 1.9, unknownCalls: 0 },
    { userId: MOCK_OWNER_ID, feature: 'train_meso_plan', calls: 4, costUsd: 0.6, unknownCalls: 0 },
    { userId: MOCK_ANNA_ID, feature: 'companion_chat', calls: 18, costUsd: 2.4, unknownCalls: 0 },
    { userId: MOCK_ANNA_ID, feature: 'meal_draft', calls: 2, costUsd: 0, unknownCalls: 2 },
    { userId: MOCK_ANNA_ID, feature: 'proactive_feed', calls: 5, costUsd: 0.4, unknownCalls: 0 },
    { userId: MOCK_BELA_ID, feature: 'companion_chat', calls: 1, costUsd: 0.1, unknownCalls: 0 },
    { userId: null, feature: 'companion_chat', calls: 6, costUsd: 0, unknownCalls: 6 },
  ],
  totalUsd: 11.0,
}

// A distinct, genuinely SMALLER 7-day fixture (final review F6a) — the Pulzus "· 7 nap" top-list
// tiles used to be fed this exact 30-day object regardless of the `period` they asked for
// (`useAdminCostMatrix('7d', ...)` got the 30d seed back), which is not what a real 7-day window
// would ever look like next to the 30-day one. Same real feature slugs, a strict subset of
// cells/users, smaller calls/costUsd throughout.
export const ADMIN_COST_MATRIX_7D_MOCK: AdminCostMatrixResponse = {
  period: '7d',
  users: [
    { id: MOCK_OWNER_ID, label: 'Daniel' },
    { id: MOCK_ANNA_ID, label: 'Anna' },
    { id: null, label: 'Háttér' },
  ],
  features: ['companion_chat', 'meal_coach', 'proactive_feed'],
  cells: [
    { userId: MOCK_OWNER_ID, feature: 'companion_chat', calls: 9, costUsd: 1.3, unknownCalls: 0 },
    { userId: MOCK_OWNER_ID, feature: 'meal_coach', calls: 3, costUsd: 0.5, unknownCalls: 0 },
    { userId: MOCK_ANNA_ID, feature: 'companion_chat', calls: 4, costUsd: 0.6, unknownCalls: 0 },
    { userId: MOCK_ANNA_ID, feature: 'proactive_feed', calls: 2, costUsd: 0.2, unknownCalls: 0 },
    { userId: null, feature: 'companion_chat', calls: 2, costUsd: 0, unknownCalls: 2 },
  ],
  totalUsd: 2.6,
}

// `period` is unavoidably a real `AdminPeriod` value here (no neutral/unset member) — no
// consumer renders this field directly (a real-mode cold load never reaches AdminOverviewPage's
// own '30d'/'7d' legends/labels either way), so the hardcoded '30d' never reaches the screen.
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

// `period` is unavoidably a real `AdminPeriod` value here — AdminFeaturesPage renders its own
// `period` state, so this hardcoded '30d' never reaches the screen; it exists to satisfy the
// response shape while real-mode data is unresolved.
export const ADMIN_SCREEN_USAGE_EMPTY: AdminScreenUsageResponse = {
  period: '30d',
  days: [],
  screens: [],
}

// Alerts (mezo-kjwa) — rule-based owner-facing warnings on the admin hub. One `warn` (cost
// spike) and one `bad` (stuck memory processing), so slice 2's UI has both severities to render
// against. `generatedAt` is computed at module load — no test asserts its exact value.
export const ADMIN_ALERTS_MOCK: AdminAlertsResponse = {
  generatedAt: new Date().toISOString(),
  alerts: [
    {
      key: 'cost_spike',
      severity: 'warn',
      title: 'Tegnapi AI-költés kiugróan magas',
      detail: 'Tegnap $1.84 ment el — a korábbi 7 nap átlaga $0.33 volt.',
      link: '/admin/cost?day=2026-09-07',
    },
    {
      key: 'memory_stuck',
      severity: 'bad',
      title: 'Elakadt emlék-feldolgozás',
      detail: '3 emlék beágyazása hibára futott.',
      link: '/admin/users',
    },
  ],
}

export const ADMIN_ALERTS_EMPTY: AdminAlertsResponse = {
  generatedAt: new Date(0).toISOString(),
  alerts: [],
}

// Feature scorecard (mezo-clgz) — the Funkciók tab's board/detail/feedback-summary seeds.
// REAL slugs throughout (see FEATURE_LABELS at features/admin/lib/labels.ts): companion_chat,
// meal_draft, meal_coach, train_meso_plan, proactive_feed are LLM feature-context slugs; `food`
// is a domain featureMap key with no LLM cost attached; `unknown` is the system bucket for calls
// that left no feature id. `usesPerWeek`/`usageByWeek` are always exactly 12 entries (oldest ->
// newest ISO week), dense-filled. `helped` is null on `meal_draft` and `food` — meal_draft is a
// real AI feature simply not yet mapped to message_feedback, `food` is a domain feature with no
// companion feedback at all — matching the schema's "null when unmapped/companion-off" rulings.
const FEATURE_WEEKS_12 = (base: number, spread: number): number[] =>
  Array.from({ length: 12 }, (_, i) => Math.max(0, base + ((i * 7) % (spread * 2 + 1)) - spread))

export const ADMIN_FEATURE_BOARD_MOCK: AdminFeatureBoardResponse = {
  period: '30d',
  rows: [
    {
      key: 'companion_chat', kind: 'ai', uniqueUsers: 8,
      usesPerWeek: FEATURE_WEEKS_12(6, 3),
      habitUserShare: 0.5, helped: { up: 14, down: 3 }, acceptedShare: null,
      costUsd: 42.3, costPerUse: 0.62, unknownCalls: 0, errorPct: 2.1, p90LatencyMs: 1400, screenViews: null,
    },
    {
      key: 'meal_draft', kind: 'ai', uniqueUsers: 5,
      usesPerWeek: FEATURE_WEEKS_12(2, 2),
      habitUserShare: 0.2, helped: null, acceptedShare: null,
      // errorPct ~20 — meal_draft (photo/text -> draft) is the flakiest of the bunch.
      costUsd: 6.75, costPerUse: 0.34, unknownCalls: 0, errorPct: 19.8, p90LatencyMs: 2200, screenViews: null,
    },
    {
      key: 'meal_coach', kind: 'ai', uniqueUsers: 6,
      usesPerWeek: FEATURE_WEEKS_12(3, 2),
      habitUserShare: 0.33, helped: { up: 9, down: 1 }, acceptedShare: null,
      // unknownCalls > 0 — a few calls without a resolvable cost mapping.
      costUsd: 8.1, costPerUse: 0.42, unknownCalls: 3, errorPct: 1.0, p90LatencyMs: 900, screenViews: null,
    },
    {
      key: 'train_meso_plan', kind: 'ai', uniqueUsers: 4,
      usesPerWeek: FEATURE_WEEKS_12(1, 1),
      habitUserShare: 0.25, helped: { up: 5, down: 0 }, acceptedShare: null,
      costUsd: 3.2, costPerUse: 0.53, unknownCalls: 0, errorPct: 0, p90LatencyMs: 1600, screenViews: null,
    },
    {
      key: 'proactive_feed', kind: 'ai', uniqueUsers: 7,
      usesPerWeek: FEATURE_WEEKS_12(5, 2),
      habitUserShare: 0.57, helped: { up: 11, down: 2 }, acceptedShare: null,
      costUsd: 2.4, costPerUse: 0.09, unknownCalls: 0, errorPct: 0.5, p90LatencyMs: 700, screenViews: null,
    },
    {
      key: 'food', kind: 'domain', uniqueUsers: 9,
      usesPerWeek: FEATURE_WEEKS_12(14, 2),
      habitUserShare: 0.78, helped: null, acceptedShare: null,
      // costPerUse 0, not null — real API parity: a domain feature with calls > 0 and no LLM
      // cost attached still has a defined (zero) cost-per-use; null is reserved for zero calls.
      costUsd: 0, costPerUse: 0, unknownCalls: 0, errorPct: null, p90LatencyMs: null, screenViews: null,
    },
    {
      // system bucket (LlmCallContext.UNKNOWN's slug) — no real human user attribution, so
      // uniqueUsers is 0, not a fabricated count. Every call landing here is by definition
      // unmapped, so calls == unknownCalls and costPerUse is the honest costUsd/unknownCalls
      // quotient rather than null (null would imply zero calls, which contradicts costUsd > 0).
      key: 'unknown', kind: 'system', uniqueUsers: 0,
      usesPerWeek: FEATURE_WEEKS_12(0, 1),
      habitUserShare: 0, helped: null, acceptedShare: null,
      costUsd: 0.15, costPerUse: 0.05, unknownCalls: 3, errorPct: null, p90LatencyMs: null, screenViews: null,
    },
  ],
}

export const ADMIN_FEATURE_BOARD_EMPTY: AdminFeatureBoardResponse = { period: '30d', rows: [] }

/** period-aware selection, mirroring `costMatrixMockFor` (mezo-m079 final review F6a) — the
 *  90d board is a strict superset-flavoured scale-up of 30d, never the identical object. */
export function featureBoardMockFor(period: string | null | undefined): AdminFeatureBoardResponse {
  if (period !== '90d') return ADMIN_FEATURE_BOARD_MOCK
  return {
    period: '90d',
    rows: ADMIN_FEATURE_BOARD_MOCK.rows.map((r) => ({
      ...r,
      uniqueUsers: Math.round(r.uniqueUsers * 1.4),
      costUsd: Number((r.costUsd * 2.6).toFixed(2)),
    })),
  }
}

const COMPANION_CHAT_ROW: AdminFeatureRow = ADMIN_FEATURE_BOARD_MOCK.rows[0]

// Only companion_chat carries a full detail seed (brief scope) — `featureDetailMockFor` below
// serves it for ANY requested key (matching `adminRowsMockFor`'s fallback-to-a-populated-default
// idiom at adminDataMock.ts), with `key` swapped to the one actually asked for.
export const ADMIN_FEATURE_DETAIL_MOCK: AdminFeatureDetailResponse = {
  key: 'companion_chat',
  kind: 'ai',
  usageByWeek: COMPANION_CHAT_ROW.usesPerWeek,
  funnel: { tried: 3, repeated: 2, habitual: 1, triedUsers: ['Daniel', 'Anna', 'Béla'] },
  // 12 ISO weeks; up/down sum to the board row's helped totals (14/3) — internally consistent.
  feedbackTrend: [
    { week: '2026-W01', up: 1, down: 0 },
    { week: '2026-W02', up: 1, down: 0 },
    { week: '2026-W03', up: 1, down: 1 },
    { week: '2026-W04', up: 2, down: 0 },
    { week: '2026-W05', up: 1, down: 0 },
    { week: '2026-W06', up: 1, down: 1 },
    { week: '2026-W07', up: 2, down: 0 },
    { week: '2026-W08', up: 1, down: 0 },
    { week: '2026-W09', up: 1, down: 0 },
    { week: '2026-W10', up: 1, down: 1 },
    { week: '2026-W11', up: 1, down: 0 },
    { week: '2026-W12', up: 1, down: 0 },
  ],
  // Real reason keys (message_feedback.reason) — counts sum to the 3 downs above.
  downReasons: [
    { reason: 'inaccurate', count: 1 },
    { reason: 'too_much', count: 1 },
    { reason: 'bad_timing', count: 1 },
  ],
  reliability: {
    errorPct: 2.1, p90LatencyMs: 1400, p50LatencyMs: 700,
    topErrors: [
      { code: 'TIMEOUT', count: 2 },
      { code: 'RATE_LIMIT', count: 1 },
    ],
  },
  costByModel: [
    { model: 'gpt-4o-mini', costUsd: 30.1, calls: 500 },
    { model: 'gpt-4o', costUsd: 12.2, calls: 40 },
  ],
  topUsers: [
    { name: 'Daniel', costUsd: 30.0, uses: 300 },
    { name: 'Anna', costUsd: 10.0, uses: 150 },
    { name: 'Béla', costUsd: 2.3, uses: 20 },
  ],
}

export const ADMIN_FEATURE_DETAIL_EMPTY: AdminFeatureDetailResponse = {
  key: '',
  kind: 'ai',
  usageByWeek: [],
  funnel: { tried: 0, repeated: 0, habitual: 0, triedUsers: [] },
  feedbackTrend: null,
  downReasons: null,
  reliability: { errorPct: null, p90LatencyMs: null, p50LatencyMs: null, topErrors: [] },
  costByModel: [],
  topUsers: [],
}

/** Serves the (single) detail seed for ANY key, `key` swapped to match — same "populated
 *  default, never a special-case empty/404" idiom as `adminRowsMockFor`. */
export function featureDetailMockFor(key: string): AdminFeatureDetailResponse {
  return { ...ADMIN_FEATURE_DETAIL_MOCK, key }
}

export const ADMIN_FEEDBACK_SUMMARY_MOCK: AdminFeedbackSummaryResponse = {
  period: '30d',
  features: [
    { key: 'companion_chat', up: 14, down: 3, reasons: ADMIN_FEATURE_DETAIL_MOCK.downReasons ?? [] },
    { key: 'meal_coach', up: 9, down: 1, reasons: [{ reason: 'inaccurate', count: 1 }] },
    {
      key: 'proactive_feed', up: 11, down: 2,
      reasons: [{ reason: 'too_much', count: 1 }, { reason: 'bad_timing', count: 1 }],
    },
    { key: 'train_meso_plan', up: 5, down: 0, reasons: [] },
  ],
  // Recall totals — useful/irrelevant/suppress across the period, companion feature switch on.
  recall: { useful: 35, irrelevant: 6, suppress: 2 },
}

export const ADMIN_FEEDBACK_SUMMARY_EMPTY: AdminFeedbackSummaryResponse = {
  period: '30d',
  features: [],
  recall: null,
}
