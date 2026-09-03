import { useDualQuery } from '@/data/useDualQuery'
import {
  llmUsageApi,
  type LlmUsageSummaryResponse,
  type LlmUsageBreakdownResponse,
  type LlmCallListResponse,
  type LlmCallDetailResponse,
  type LlmUsagePeriodKey,
  type LlmCallFilters,
} from '@/data/me/llmUsageApi'

/** Believable demo numbers for the Profil "AI-használat" card (mock mode only). */
export const LLM_USAGE_MOCK: LlmUsageSummaryResponse = {
  day: { callCount: 12, costUsd: 0.04, currency: 'USD' },
  week: { callCount: 78, costUsd: 0.31, currency: 'USD' },
  month: { callCount: 305, costUsd: 1.22, currency: 'USD' },
}

/**
 * Honest empty for real mode (never the seed): zero calls and NO cost — a null
 * `costUsd` renders as "—", so an unresolved read can't imply a $0.00 spend.
 */
export const LLM_USAGE_EMPTY: LlmUsageSummaryResponse = {
  day: { callCount: 0, costUsd: null, currency: 'USD' },
  week: { callCount: 0, costUsd: null, currency: 'USD' },
  month: { callCount: 0, costUsd: null, currency: 'USD' },
}

/**
 * LLM usage summary (mezo-h3gb) — day/week/month call counts + estimated cost from
 * the backend's LLM audit log, feeding the Profil `AiUsageCard`. Dual-mode read:
 * the seeded demo numbers in mock mode, `GET /api/llm-usage/summary` in real mode,
 * `LLM_USAGE_EMPTY` (not the seed) while unresolved. Read-only — no write path.
 */
export function useLlmUsageSummary() {
  return useDualQuery({
    queryKey: ['llmUsageSummary'],
    mockData: LLM_USAGE_MOCK,
    realFetch: () => llmUsageApi.getSummary(),
    realEmpty: LLM_USAGE_EMPTY,
    realStaleTime: 60_000,
  })
}

/** Honest empty for real mode: zero everything and NULL cost — an unresolved read must not read as $0. */
export const LLM_BREAKDOWN_EMPTY: LlmUsageBreakdownResponse = {
  from: '',
  totals: { callCount: 0, successCount: 0, errorCount: 0, cancelledCount: 0, unpricedCount: 0, costUsd: null, currency: 'USD' },
  features: [],
  models: [],
  byUser: [],
}

/**
 * Believable demo rollup for mock mode — the real feature slugs, one unpriced bucket.
 *
 * Every audited call has exactly ONE feature and ONE served model (or none, for an
 * ERROR row that never reached a model), and this response is exhaustive (no
 * truncation field) — so BOTH `features[]` and `models[]` must sum to exactly
 * `totals.callCount` / `totals.costUsd`. Keep that property when editing this seed.
 *
 * That is why `models[]` ends in a NULL-keyed bucket of exactly `totals.errorCount` calls: an
 * ERROR row never reached a model, so `served_model` is null and the backend groups those rows
 * together (`aggregateByModelSince`, ordered cost desc NULLS LAST). Without it the seed described
 * a rollup the real endpoint could not produce, and the "ismeretlen" branch of `AiModelBreakdown`
 * was unreachable in mock mode.
 */
export const LLM_BREAKDOWN_MOCK: LlmUsageBreakdownResponse = {
  from: '2026-08-10',
  totals: { callCount: 412, successCount: 381, errorCount: 24, cancelledCount: 7, unpricedCount: 38, costUsd: 1.86, currency: 'USD' },
  features: [
    { key: 'companion_chat', callCount: 96, costUsd: 0.74 },
    { key: 'companion_hypothesis', callCount: 21, costUsd: 0.39 },
    { key: 'proactive_briefing', callCount: 7, costUsd: 0.21 },
    { key: 'meal_draft', callCount: 34, costUsd: 0.18 },
    { key: 'meal_coach', callCount: 29, costUsd: 0.12 },
    { key: 'embed_memory', callCount: 148, costUsd: 0.09 },
    { key: 'proactive_heartbeat', callCount: 28, costUsd: 0.07 },
    { key: 'companion_fact_extract', callCount: 43, costUsd: 0.06 },
    { key: 'quest_flavor', callCount: 6, costUsd: null },
  ],
  models: [
    { key: 'gemini-2.5-flash', callCount: 217, costUsd: 1.12 },
    { key: 'gemini-2.5-pro', callCount: 23, costUsd: 0.65 },
    { key: 'gemini-embedding-001', callCount: 148, costUsd: 0.09 },
    { key: null, callCount: 24, costUsd: null }, // the errorCount rows: no served model, no cost
  ],
  // Per-account split (mezo-qw37.3) — sums to the totals like features[]/models[]; the null
  // group is the cron/stream traffic that has no principal (ids match adminMock).
  byUser: [
    { userId: '00000000-0000-4000-8000-000000000001', name: 'Daniel', callCount: 300, totalTokens: 1_240_000, costUsd: 1.31 },
    { userId: '00000000-0000-4000-8000-000000000002', name: 'Anna', callCount: 70, totalTokens: 310_000, costUsd: 0.34 },
    { userId: null, name: null, callCount: 42, totalTokens: 380_000, costUsd: 0.21 },
  ],
}

export const LLM_CALLS_EMPTY: LlmCallListResponse = { items: [], hasMore: false }

export const LLM_CALLS_MOCK: LlmCallListResponse = {
  items: [
    { id: '11111111-1111-4111-8111-111111111111', createdAt: '2026-08-14T12:32:00Z', createdBy: '00000000-0000-4000-8000-000000000001', feature: 'companion_chat', operation: 'stream', callKind: 'CHAT_STREAM', status: 'SUCCESS', requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash', latencyMs: 3100, streamed: true, toolRounds: null, totalTokens: 4812, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: 0.021, errorClass: null, errorCode: null },
    // costUsd must match LLM_CALL_DETAIL_MOCK below (same call id) — see the comment there.
    { id: '22222222-2222-4222-8222-222222222222', createdAt: '2026-08-14T12:31:00Z', createdBy: '00000000-0000-4000-8000-000000000001', feature: 'companion_chat', operation: 'send', callKind: 'TOOL', status: 'SUCCESS', requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash', latencyMs: 7812, streamed: false, toolRounds: 2, totalTokens: 11204, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: 0.012751, errorClass: null, errorCode: null },
    { id: '33333333-3333-4333-8333-333333333333', createdAt: '2026-08-14T12:28:00Z', createdBy: '00000000-0000-4000-8000-000000000002', feature: 'meal_draft', operation: 'photo', callKind: 'VISION', status: 'ERROR', requestedModel: 'gemini-2.5-flash', servedModel: null, latencyMs: 12000, streamed: false, toolRounds: null, totalTokens: null, imageCount: 1, embedInputCount: null, embedDimensions: null, costUsd: null, errorClass: 'ResourceExhaustedException', errorCode: null },
    { id: '44444444-4444-4444-8444-444444444444', createdAt: '2026-08-14T12:19:00Z', createdBy: '00000000-0000-4000-8000-000000000001', feature: 'companion_chat', operation: 'stream', callKind: 'CHAT_STREAM', status: 'CANCELLED', requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash', latencyMs: 1400, streamed: true, toolRounds: null, totalTokens: null, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: null, errorClass: null, errorCode: null },
    { id: '55555555-5555-4555-8555-555555555555', createdAt: '2026-08-14T12:02:00Z', createdBy: '00000000-0000-4000-8000-000000000002', feature: 'embed_memory', operation: 'document', callKind: 'EMBED_DOC', status: 'SUCCESS', requestedModel: 'gemini-embedding-001', servedModel: 'gemini-embedding-001', latencyMs: 400, streamed: false, toolRounds: null, totalTokens: null, imageCount: null, embedInputCount: 12, embedDimensions: 768, costUsd: 0.0004, errorClass: null, errorCode: null },
    { id: '66666666-6666-4666-8666-666666666666', createdAt: '2026-08-14T11:47:00Z', createdBy: '00000000-0000-4000-8000-000000000001', feature: 'companion_hypothesis', operation: 'critique', callKind: 'SMART', status: 'SUCCESS', requestedModel: 'gemini-2.5-pro', servedModel: 'gemini-2.5-pro', latencyMs: 22600, streamed: false, toolRounds: null, totalTokens: 18902, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: 0.184, errorClass: null, errorCode: null },
    { id: '77777777-7777-4777-8777-777777777777', createdAt: '2026-08-14T03:45:00Z', createdBy: null, feature: 'proactive_briefing', operation: 'generate', callKind: 'CHAT', status: 'SUCCESS', requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash', latencyMs: 5200, streamed: false, toolRounds: null, totalTokens: 9341, imageCount: null, embedInputCount: null, embedDimensions: null, costUsd: 0.031, errorClass: null, errorCode: null },
  ],
  // The seed IS everything the mock log holds — `mockCalls` recomputes `hasMore` per window, so
  // this flag only describes the unfiltered, unbounded read.
  hasMore: false,
}

/**
 * The mock log answered for a given window (mezo-uakh) — the same argument-driven mock shape as
 * `mockThread(selection)` / `mockGamificationDay(date)`.
 *
 * The seed used to be returned verbatim, which made the demo surface LIE: tapping a feature bar
 * showed the ✕ chip over an unchanged list, the status chips did nothing, and the hardcoded
 * `hasMore: true` kept offering "További hívások" over the same seven rows until the 500 ceiling.
 * Filtering and truncating here mirrors what `findCalls` does server-side, so mock mode
 * demonstrates the real behaviour.
 */
function mockCalls(filters: LlmCallFilters, limit: number): LlmCallListResponse {
  const matched = LLM_CALLS_MOCK.items.filter((call) =>
    (filters.feature == null || call.feature === filters.feature)
    && (filters.status == null || call.status === filters.status)
    && (filters.callKind == null || call.callKind === filters.callKind)
    && (filters.userId == null || call.createdBy === filters.userId))
  // `hasMore` comes from the window truncating, exactly like the backend's `limit + 1` probe.
  return { items: matched.slice(0, limit), hasMore: matched.length > limit }
}

export const LLM_CALL_DETAIL_EMPTY: LlmCallDetailResponse = {
  id: '', createdAt: '', createdBy: null, feature: '', operation: null, entityKind: null, entityId: null,
  callKind: 'CHAT', status: 'SUCCESS', requestedModel: '', servedModel: null, errorCode: null, errorClass: null,
  latencyMs: 0, streamed: false, toolRounds: null, serviceTier: null, finishReason: null,
  promptTokens: null, candidatesTokens: null, thoughtsTokens: null, cachedTokens: null, totalTokens: null,
  embedInputCount: null, embedDimensions: null, embedBillableChars: null,
  imageCount: null, imageBytesTotal: null, imageMime: null,
  systemPrompt: null, userMessage: null, responseText: null,
  truncated: false, payloadBytes: 0, costUsd: null, pricingSnapshot: null,
}

export const LLM_CALL_DETAIL_MOCK: LlmCallDetailResponse = {
  ...LLM_CALL_DETAIL_EMPTY,
  id: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-08-14T12:31:07Z',
  createdBy: '00000000-0000-4000-8000-000000000001',
  feature: 'companion_chat', operation: 'send', entityKind: 'conversation',
  entityId: '8f2acccc-cccc-4ccc-8ccc-cccccccccc41',
  callKind: 'TOOL', status: 'SUCCESS',
  requestedModel: 'gemini-2.5-flash', servedModel: 'gemini-2.5-flash',
  latencyMs: 7812, streamed: false, toolRounds: 2, serviceTier: 'standard', finishReason: 'STOP',
  promptTokens: 5826, candidatesTokens: 1008, thoughtsTokens: 3474, cachedTokens: 896, totalTokens: 11204,
  systemPrompt: 'Te vagy Mezo, Daniel személyes egészség- és teljesítmény-társa.',
  userMessage: 'most ettem egy nagy adag rizses csirkét, írd be kb 600 kcal-nak',
  responseText: 'Beírtam: Rizses csirke — 600 kcal, 48 g fehérje, 62 g szénhidrát, 14 g zsír, ebédre.',
  truncated: false, payloadBytes: 3584,
  // costUsd MUST stay derived from tokens × pricingSnapshot below (LlmLogWriter.applyCost /
  // LlmPricingService.computeGenerationCost billing formula) — NET prompt (promptTokens minus the
  // cachedTokens slice it includes) at inputPerMillion, candidates at outputPerMillion, thoughts at
  // thinkingPerMillion, cached at cachedPerMillion:
  //   (5826-896)/1e6*0.30 + 1008/1e6*2.50 + 3474/1e6*2.50 + 896/1e6*0.075 = 0.0127512
  // Keep this property when editing the seed — round to 6 decimals (numeric(12,6) column).
  costUsd: 0.012751,
  pricingSnapshot: {
    sourceModel: 'gemini-2.5-flash', currency: 'USD',
    inputPerMillion: 0.3, outputPerMillion: 2.5, thinkingPerMillion: 2.5,
    cachedPerMillion: 0.075, embedPerMillionChars: null, pricedOn: '2026-08-14',
  },
}

/** Feature/model cost rollup for the selected period — the AI-napló header (mezo-uakh). */
export function useLlmUsageBreakdown(period: LlmUsagePeriodKey) {
  return useDualQuery({
    queryKey: ['llmUsageBreakdown', period],
    mockData: LLM_BREAKDOWN_MOCK,
    realFetch: () => llmUsageApi.getBreakdown(period),
    realEmpty: LLM_BREAKDOWN_EMPTY,
    realStaleTime: 60_000,
  })
}

/**
 * The audit list. `limit` is a GROWING WINDOW (the page raises it to load more), so it belongs in
 * the queryKey — each width is its own cached read, and no page accumulation state is needed.
 */
export function useLlmCalls(period: LlmUsagePeriodKey, filters: LlmCallFilters, limit: number) {
  return useDualQuery({
    queryKey: ['llmCalls', period, filters.feature ?? null, filters.status ?? null, filters.callKind ?? null, filters.userId ?? null, limit],
    mockData: mockCalls(filters, limit),
    realFetch: () => llmUsageApi.listCalls(period, filters, limit),
    realEmpty: LLM_CALLS_EMPTY,
    realStaleTime: 30_000,
  })
}

/** One call in full, including the verbatim payload — the detail page's only read. */
export function useLlmCall(id: string) {
  return useDualQuery({
    queryKey: ['llmCall', id],
    mockData: LLM_CALL_DETAIL_MOCK,
    realFetch: () => llmUsageApi.getCall(id),
    realEmpty: LLM_CALL_DETAIL_EMPTY,
    realStaleTime: Infinity,
  })
}
