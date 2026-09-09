import { MOCK_ANNA_ID, MOCK_BELA_ID, MOCK_OWNER_ID } from '@/data/admin/adminMock'
import type {
  AdminMemoryGlobalHealthResponse,
  AdminMemoryGraphResponse,
  AdminMemoryHealthResponse,
  AdminMemoryNeighborsResponse,
  AdminMemoryRunDetailResponse,
  AdminMemoryRunPageResponse,
  AdminMemoryRunSummary,
  AdminMemoryVectorsResponse,
} from '@/data/admin/adminMemoryApi'

// RAG memory explorer mock seed (mezo-4qyt.3). Ported from the design_2.0 prototype
// (docs/design_2.0/prototypes/admin-memory.html #d-futasok) — same three runs (one SHADOW with
// a graph timeout, one NEW/élő, one legacy/OLD), same candidate stack, same replay notes.
//
// The seed is shaped EXACTLY like the real API, including fields a mock is tempted to omit
// (mezo-d5iy.18 taught this the hard way): a candidate whose retrieverRanks is missing a
// retriever, a run whose promptTrace is null with a reason, an edge with no evidence at all,
// an archived node, a deleted node, a CONFLICTS edge, and a real (not hand-typed) base64
// Float32 projection block.

export const ADMIN_MEMORY_INSPECTED_USER_ID = MOCK_ANNA_ID

/** An ISO timestamp `hoursAgo` hours before "now" (mezo-k5zy fix round — F3) — same relative-date
 *  idiom as `adminInsightsMock.ts`'s `daysAgoIso`, so `newestDailySummaryAt` stays "X órája" no
 *  matter which day the suite runs on, instead of a hardcoded date drifting further into the past
 *  (and eventually past the entry page's own >26h warn threshold) every day the fixture goes
 *  unedited. */
function hoursAgoIso(hoursAgo: number): string {
  const d = new Date()
  d.setHours(d.getHours() - hoursAgo)
  return d.toISOString()
}

const RUN_SHADOW: AdminMemoryRunSummary = {
  id: 'a1000000-0000-4000-8000-000000000001',
  createdAt: '2026-09-07T09:41:12Z',
  consumerPolicy: 'CHAT_AMBIENT',
  servingMode: 'SHADOW',
  queryMode: 'REWRITE',
  rawQuery: 'mennyit aludtam tegnap',
  rewrittenQuery: 'alvásidő és alvásminőség tegnap',
  candidateCount: 24,
  selectedCount: 2,
  durationMs: 187,
  embeddingVersion: 'text-embedding-3-small@v1',
  shadowEmbeddingVersion: null,
  errorCode: null,
  traceId: 't1000000-0000-4000-8000-000000000001',
  retrieverTrace: [
    { retriever: 'dense', durationMs: 92, candidateCount: 24, error: null },
    { retriever: 'lexical', durationMs: 41, candidateCount: 18, error: null },
    { retriever: 'graph', durationMs: 187, candidateCount: 0, error: 'TIMEOUT' },
    { retriever: 'facts', durationMs: 12, candidateCount: 4, error: null },
  ],
}

const RUN_NEW: AdminMemoryRunSummary = {
  id: 'a1000000-0000-4000-8000-000000000002',
  createdAt: '2026-09-07T09:38:05Z',
  consumerPolicy: 'CHAT_AMBIENT',
  servingMode: 'NEW',
  queryMode: 'RAW',
  rawQuery: 'mit egyek edzés előtt',
  rewrittenQuery: null,
  candidateCount: 18,
  selectedCount: 3,
  durationMs: 142,
  embeddingVersion: 'text-embedding-3-small@v1',
  shadowEmbeddingVersion: null,
  errorCode: null,
  traceId: 't1000000-0000-4000-8000-000000000002',
  retrieverTrace: [
    { retriever: 'dense', durationMs: 61, candidateCount: 18, error: null },
    { retriever: 'lexical', durationMs: 28, candidateCount: 14, error: null },
    { retriever: 'graph', durationMs: 33, candidateCount: 6, error: null },
    { retriever: 'facts', durationMs: 9, candidateCount: 3, error: null },
  ],
}

const RUN_OLD: AdminMemoryRunSummary = {
  id: 'a1000000-0000-4000-8000-000000000003',
  createdAt: '2026-09-07T09:02:11Z',
  consumerPolicy: 'CHAT_AMBIENT',
  servingMode: 'OLD',
  queryMode: 'NONE',
  rawQuery: 'vízfogyasztás',
  rewrittenQuery: null,
  candidateCount: 9,
  selectedCount: 2,
  durationMs: 64,
  embeddingVersion: 'text-embedding-3-small@v1',
  shadowEmbeddingVersion: null,
  errorCode: null,
  traceId: null,
  retrieverTrace: [
    { retriever: 'dense', durationMs: 64, candidateCount: 9, error: null },
  ],
}

export const ADMIN_MEMORY_RUNS_MOCK: AdminMemoryRunPageResponse = {
  page: 0,
  size: 25,
  total: 92,
  retentionDays: 30,
  items: [RUN_SHADOW, RUN_NEW, RUN_OLD],
}

export const ADMIN_MEMORY_RUNS_EMPTY: AdminMemoryRunPageResponse = {
  page: 0,
  size: 25,
  total: 0,
  retentionDays: 30,
  items: [],
}

const FUSION_MOCK = {
  rrfK: 60,
  retrieverWeights: { dense: 1, lexical: 1, graph: 1, facts: 1 },
  pinnedBoost: 0.1,
  sourceReliabilityMaxBoost: 0.08,
  temporalMaxBoost: 0.05,
  salienceMaxAdjustment: 0.05,
  recencyMaxBoost: 0.05,
}

// The SHADOW run's detail — populated candidates, one with a missing retriever (graph), one
// with a total-retriever outage (all four absent + a run-level errorCode), a rerankDelta on
// the top candidate, and NO prompt trace (SHADOW never reaches the model).
export const ADMIN_MEMORY_RUN_SHADOW_DETAIL: AdminMemoryRunDetailResponse = {
  run: RUN_SHADOW,
  fusion: FUSION_MOCK,
  promptTrace: null,
  promptTraceReason: 'SHADOW_RUN',
  dryRun: false,
  queryProjection: null,
  replayNotes: [],
  candidates: [
    {
      resultId: 'c1000000-0000-4000-8000-000000000001',
      rank: 1,
      fusionRank: 2,
      rerankDelta: 1,
      selected: true,
      candidateKind: 'memory_item',
      candidateRefId: 'a91f0000-0000-4000-8000-0000000000ce',
      memoryItemId: 'a91f0000-0000-4000-8000-0000000000ce',
      contentSnapshot: 'Alvásidő-cél: 7,5 óra — az elmúlt 14 napból 9-en teljesült, a hétvégék rendre alulteljesítenek.',
      occurredOn: '2026-09-06',
      scoreBreakdown: {
        retrieverRanks: { dense: 2, lexical: 1, facts: 1 },
        rrf: 0.363,
        recencyBoost: 0.05,
        rerankerScore: 1,
        finalScore: 0.524,
      },
    },
    {
      resultId: 'c1000000-0000-4000-8000-000000000002',
      rank: 2,
      fusionRank: 2,
      rerankDelta: 0,
      selected: true,
      candidateKind: 'knowledge_edge',
      candidateRefId: 'e1000000-0000-4000-8000-000000000001',
      memoryItemId: null,
      contentSnapshot: 'Késői vacsora mintázat rontja a mélyalvást',
      occurredOn: null,
      scoreBreakdown: {
        retrieverRanks: { dense: 1, graph: 1, facts: 3 },
        rrf: 0.344,
        rerankerScore: 0.5,
        finalScore: 0.344,
      },
    },
    {
      resultId: 'c1000000-0000-4000-8000-000000000003',
      rank: 3,
      fusionRank: 3,
      rerankDelta: null,
      selected: false,
      candidateKind: 'memory_item',
      candidateRefId: 'a91f0000-0000-4000-8000-0000000000cf',
      memoryItemId: 'a91f0000-0000-4000-8000-0000000000cf',
      contentSnapshot: 'Heti edzésszám cél: 4',
      occurredOn: '2026-08-30',
      scoreBreakdown: {
        retrieverRanks: { dense: 5, lexical: 4 },
        rrf: 0.075,
        salienceBoost: 0.02,
        finalScore: 0.095,
      },
    },
    {
      resultId: 'c1000000-0000-4000-8000-000000000004',
      rank: 4,
      fusionRank: 4,
      rerankDelta: null,
      selected: false,
      candidateKind: 'memory_item',
      candidateRefId: 'a91f0000-0000-4000-8000-0000000000d0',
      memoryItemId: 'a91f0000-0000-4000-8000-0000000000d0',
      contentSnapshot: 'Reggeli rutin: kávé + 10 perc olvasás',
      occurredOn: '2026-08-20',
      scoreBreakdown: {
        retrieverRanks: {},
        rrf: 0,
        finalScore: 0,
      },
    },
  ],
}

// The NEW run's detail — populated prompt trace (it reached the model).
export const ADMIN_MEMORY_RUN_NEW_DETAIL: AdminMemoryRunDetailResponse = {
  run: RUN_NEW,
  fusion: FUSION_MOCK,
  promptTrace: [
    { kind: 'system', refId: 's1000000-0000-4000-8000-000000000001', label: 'SYSTEM', gist: 'A companion memóriablokkja: az alábbi tényeket és mintákat használd a válaszban, ha relevánsak…' },
    {
      kind: 'memory_block', refId: 'm1000000-0000-4000-8000-000000000001', label: 'MEMORY BLOCK · 3 tétel',
      gist: '• Edzés előtt könnyű szénhidrátot kedvel · • Reggeli rutin rövid, konkrét üzenetet vár · • Fehérje-cél: 120 g/nap',
      occurredOn: '2026-09-06', similarity: 0.81, retrievalResultId: 'c1000000-0000-4000-8000-000000000005', memoryItemId: 'a91f0000-0000-4000-8000-0000000000d1',
    },
    { kind: 'user', refId: 'u1000000-0000-4000-8000-000000000001', label: 'USER', gist: 'mit egyek edzés előtt' },
  ],
  promptTraceReason: null,
  dryRun: false,
  queryProjection: null,
  replayNotes: [],
  candidates: [
    {
      resultId: 'c1000000-0000-4000-8000-000000000005',
      rank: 1,
      fusionRank: 1,
      rerankDelta: 0,
      selected: true,
      candidateKind: 'memory_item',
      candidateRefId: 'a91f0000-0000-4000-8000-0000000000d1',
      memoryItemId: 'a91f0000-0000-4000-8000-0000000000d1',
      contentSnapshot: 'Edzés előtt könnyű szénhidrátot kedvel',
      occurredOn: '2026-09-06',
      scoreBreakdown: {
        retrieverRanks: { dense: 1, lexical: 2, graph: 1, facts: 1 },
        rrf: 0.24,
        pinnedBoost: 0.1,
        rerankerScore: 1,
        finalScore: 0.34,
      },
    },
  ],
}

export const ADMIN_MEMORY_RUN_DETAIL_MOCK = ADMIN_MEMORY_RUN_SHADOW_DETAIL

export const ADMIN_MEMORY_RUN_DETAIL_EMPTY: AdminMemoryRunDetailResponse = {
  run: { ...RUN_SHADOW, id: null },
  fusion: FUSION_MOCK,
  promptTrace: null,
  promptTraceReason: 'NO_PROMPT_IMPRINT',
  dryRun: false,
  queryProjection: null,
  replayNotes: [],
  candidates: [],
}

/** Look up a run's detail by id — the MSW handler and the hooks test both use this. */
export function adminMemoryRunDetailFor(runId: string): AdminMemoryRunDetailResponse {
  if (runId === RUN_NEW.id) return ADMIN_MEMORY_RUN_NEW_DETAIL
  if (runId === RUN_OLD.id) {
    return {
      run: RUN_OLD,
      fusion: FUSION_MOCK,
      promptTrace: null,
      promptTraceReason: 'NO_PROMPT_IMPRINT',
      dryRun: false,
      queryProjection: null,
      replayNotes: [],
      candidates: [],
    }
  }
  return ADMIN_MEMORY_RUN_SHADOW_DETAIL
}

/** A replay result — same shape as a run detail, `dryRun: true`, no `run.id` (D1: no audit row). */
export function adminMemoryReplayMockFor(query: string, reranker: boolean, rewrite: boolean): AdminMemoryRunDetailResponse {
  return {
    run: { ...RUN_NEW, id: null, rawQuery: query, rewrittenQuery: null, traceId: null },
    fusion: FUSION_MOCK,
    promptTrace: null,
    promptTraceReason: 'DRY_RUN',
    dryRun: true,
    queryProjection: null,
    replayNotes: [
      ...(rewrite ? ['rewrite_unreachable_no_history'] : ['rewrite_skipped']),
      ...(reranker ? [] : ['reranker_skipped']),
      'projection_embed_extra_call',
      'pca_unavailable',
    ],
    candidates: ADMIN_MEMORY_RUN_NEW_DETAIL.candidates,
  }
}

export const ADMIN_MEMORY_GRAPH_MOCK: AdminMemoryGraphResponse = {
  decayFactor: 0.99,
  pruneBelow: 0.05,
  nodes: [
    {
      id: 'n1000000-0000-4000-8000-000000000001', kind: 'PATTERN', title: 'Alvásidő-cél: 7,5 óra',
      summary: 'Az elmúlt 14 napból 9-en teljesült', status: 'active', sourceKind: 'memory_item',
      sourceId: 'a91f0000-0000-4000-8000-0000000000ce', occurredOn: '2026-09-06',
      userArchivedAt: null, createdAt: '2026-07-01T08:00:00Z', updatedAt: '2026-09-06T08:00:00Z',
      deleted: false, meta: { confidence: 0.81 }, degree: 3,
    },
    {
      id: 'n1000000-0000-4000-8000-000000000002', kind: 'PATTERN', title: 'Késői vacsora rontja az alvást',
      summary: null, status: 'archived', sourceKind: 'memory_item',
      sourceId: 'a91f0000-0000-4000-8000-0000000000cf', occurredOn: '2026-08-20',
      userArchivedAt: '2026-08-25T10:00:00Z', createdAt: '2026-07-10T08:00:00Z', updatedAt: null,
      deleted: false, meta: null, degree: 1,
    },
    {
      id: 'n1000000-0000-4000-8000-000000000003', kind: 'GOAL', title: 'Heti edzésszám cél: 4',
      summary: null, status: 'candidate', sourceKind: null, sourceId: null, occurredOn: null,
      userArchivedAt: null, createdAt: '2026-09-01T08:00:00Z', updatedAt: null,
      deleted: true, meta: null, degree: 0,
    },
  ],
  edges: [
    {
      id: 'e1000000-0000-4000-8000-000000000001', from: 'n1000000-0000-4000-8000-000000000001',
      to: 'n1000000-0000-4000-8000-000000000002', kind: 'TRIGGERS', weight: 0.62,
      lastReinforcedAt: '2026-09-05T08:00:00Z', createdAt: '2026-07-15T08:00:00Z', deleted: false,
      evidence: [
        { sourceKind: 'sleep_log', sourceId: 's1000000-0000-4000-8000-000000000001', note: 'két egymást követő rossz éjszaka', at: '2026-08-20T08:00:00Z' },
        { sourceKind: 'sleep_log', sourceId: 's1000000-0000-4000-8000-000000000002', note: null, at: '2026-09-05T08:00:00Z' },
      ],
    },
    {
      id: 'e1000000-0000-4000-8000-000000000002', from: 'n1000000-0000-4000-8000-000000000002',
      to: 'n1000000-0000-4000-8000-000000000003', kind: 'CONFLICTS', weight: 0.18,
      lastReinforcedAt: null, createdAt: '2026-08-01T08:00:00Z', deleted: false, evidence: [],
    },
  ],
}

export const ADMIN_MEMORY_GRAPH_EMPTY: AdminMemoryGraphResponse = { nodes: [], edges: [], decayFactor: 0.99, pruneBelow: 0.05 }

// A real 3-item x 4-dim little-endian Float32 block (generated once, pasted here — a
// hand-typed base64 of the wrong length breaks the Float32Array decode).
const PROJECTION_BASE64 = 'j8L1PXsUrr4pXA8/FK5Hv8P1aD8fhWu+ZmbmPh+FK7+uR+G9rkdhPsP1qL6uR+E+'

export const ADMIN_MEMORY_VECTORS_MOCK: AdminMemoryVectorsResponse = {
  embeddingVersion: 'text-embedding-3-small@v1',
  dims: 4,
  sampled: true,
  total: 1842,
  items: [
    { itemId: 'a91f0000-0000-4000-8000-0000000000ce', sourceKind: 'sleep_log', sourceId: 's1000000-0000-4000-8000-000000000001', occurredOn: '2026-09-06', salience: 0.81, state: 'active', snippet: 'Alvásidő-cél: 7,5 óra' },
    { itemId: 'a91f0000-0000-4000-8000-0000000000cf', sourceKind: 'fuel_log', sourceId: 'f1000000-0000-4000-8000-000000000001', occurredOn: '2026-08-20', salience: 0.42, state: 'suppressed', snippet: 'Késői vacsora mintázat' },
    { itemId: 'a91f0000-0000-4000-8000-0000000000d0', sourceKind: 'train_session', sourceId: 't1000000-0000-4000-8000-000000000003', occurredOn: '2026-08-01', salience: 0.15, state: 'superseded', snippet: 'Reggeli rutin: kávé + olvasás' },
  ],
  projection: PROJECTION_BASE64,
}

export const ADMIN_MEMORY_VECTORS_EMPTY: AdminMemoryVectorsResponse = {
  embeddingVersion: '', dims: 0, sampled: false, total: 0, items: [], projection: '',
}

export const ADMIN_MEMORY_NEIGHBORS_MOCK: AdminMemoryNeighborsResponse = {
  itemId: 'a91f0000-0000-4000-8000-0000000000ce',
  embeddingVersion: 'text-embedding-3-small@v1',
  neighbors: [
    { itemId: 'a91f0000-0000-4000-8000-0000000000cf', sourceKind: 'fuel_log', occurredOn: '2026-08-20', distance: 0.12, similarity: 0.88, salience: 0.42, state: 'suppressed', snippet: 'Késői vacsora mintázat' },
    { itemId: 'a91f0000-0000-4000-8000-0000000000d0', sourceKind: 'train_session', occurredOn: '2026-08-01', distance: 0.31, similarity: 0.69, salience: 0.15, state: 'superseded', snippet: 'Reggeli rutin: kávé + olvasás' },
  ],
}

export const ADMIN_MEMORY_NEIGHBORS_EMPTY: AdminMemoryNeighborsResponse = {
  itemId: '', embeddingVersion: '', neighbors: [],
}

export const ADMIN_MEMORY_HEALTH_MOCK: AdminMemoryHealthResponse = {
  servingEmbeddingVersion: 'text-embedding-3-small@v1',
  vectorsByStatus: [{ key: 'ready', count: 1780 }, { key: 'pending', count: 12 }, { key: 'failed', count: 6 }],
  vectorFailures: [{ key: 'RATE_LIMITED', count: 4 }, { key: 'CONTENT_FILTERED', count: 2 }],
  vectorsByVersion: [{ key: 'text-embedding-3-small@v1', count: 1780 }, { key: 'text-embedding-3-small@v0', count: 44 }],
  staleVectorCount: 9,
  itemsByState: [{ key: 'active', count: 1620 }, { key: 'suppressed', count: 140 }, { key: 'superseded', count: 82 }],
  nodesByStatus: [{ key: 'active', count: 240 }, { key: 'archived', count: 31 }, { key: 'candidate', count: 12 }],
  nodesByKind: [{ key: 'PATTERN', count: 120 }, { key: 'PREFERENCE', count: 60 }, { key: 'GOAL', count: 40 }, { key: 'LIFE_EVENT', count: 30 }, { key: 'SEASON', count: 15 }, { key: 'INSIGHT', count: 12 }, { key: 'PERSON', count: 6 }],
  edgeWeightHistogram: Array.from({ length: 10 }, (_, i) => ({ key: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`, count: [40, 55, 70, 120, 210, 380, 520, 610, 480, 220][i] })),
  jobs: {
    lastDailySummary: '2026-09-07T04:00:00Z',
    lastPatternDetection: '2026-09-07T04:12:00Z',
    lastEdgeReinforcement: '2026-09-07T04:20:00Z',
    lastRetrievalRun: '2026-09-07T09:41:12Z',
    lastVectorWrite: '2026-09-07T09:30:00Z',
  },
}

export const ADMIN_MEMORY_HEALTH_EMPTY: AdminMemoryHealthResponse = {
  servingEmbeddingVersion: '',
  vectorsByStatus: [], vectorFailures: [], vectorsByVersion: [], staleVectorCount: 0,
  itemsByState: [], nodesByStatus: [], nodesByKind: [], edgeWeightHistogram: [], jobs: {},
}

// Per-user health mocks (mezo-k5zy fix round 1) — `ADMIN_MEMORY_HEALTH_MOCK` above used to be
// served for EVERY userId, with numbers copy-shaped from the INSTALL-WIDE seed
// (`ADMIN_MEMORY_GLOBAL_HEALTH_MOCK`'s 1780/6/9/1842). That made a real browsable user's own
// explorer (e.g. Anna, `vectorCount: 140` on her `ADMIN_USER_INSIGHTS_MOCK` row) show
// installation-scale numbers next to her own much smaller hero stats — internally inconsistent
// within the SAME mock seed. `adminMemoryHealthMockFor(userId)` below keys off the three known
// mock users (owner/Anna/Béla) so a real click-through (entry page's tester picker ->
// `/admin/users/:id/memory`) always lands on numbers proportribed to THAT user; any other/
// synthetic id (arbitrary test ids like `'u-1'`) keeps falling back to `ADMIN_MEMORY_HEALTH_MOCK`
// unchanged — the existing fixture, not a stand-in for any specific mock user, so tests written
// against it are untouched.

// Anna — `vectorCount: 140`, `rowCount: 356` on her insight row. Every count here is scaled DOWN
// from the (now install-wide-only) original fixture, staying internally consistent: vectorsByStatus
// sums to her vectorCount (132+6+2=140), itemsByState sums to her rowCount (320+24+12=356).
export const ADMIN_MEMORY_HEALTH_ANNA_MOCK: AdminMemoryHealthResponse = {
  servingEmbeddingVersion: 'text-embedding-3-small@v1',
  vectorsByStatus: [{ key: 'ready', count: 132 }, { key: 'pending', count: 6 }, { key: 'failed', count: 2 }],
  vectorFailures: [{ key: 'RATE_LIMITED', count: 1 }, { key: 'CONTENT_FILTERED', count: 1 }],
  vectorsByVersion: [{ key: 'text-embedding-3-small@v1', count: 132 }, { key: 'text-embedding-3-small@v0', count: 8 }],
  staleVectorCount: 6,
  itemsByState: [{ key: 'active', count: 320 }, { key: 'suppressed', count: 24 }, { key: 'superseded', count: 12 }],
  nodesByStatus: [{ key: 'active', count: 18 }, { key: 'archived', count: 3 }, { key: 'candidate', count: 1 }],
  nodesByKind: [{ key: 'PATTERN', count: 9 }, { key: 'PREFERENCE', count: 5 }, { key: 'GOAL', count: 3 }, { key: 'LIFE_EVENT', count: 2 }, { key: 'SEASON', count: 1 }, { key: 'INSIGHT', count: 1 }, { key: 'PERSON', count: 1 }],
  edgeWeightHistogram: Array.from({ length: 10 }, (_, i) => ({ key: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`, count: [3, 4, 5, 9, 16, 30, 40, 48, 37, 17][i] })),
  jobs: {
    lastDailySummary: '2026-09-07T04:00:00Z',
    lastPatternDetection: '2026-09-07T04:12:00Z',
    lastEdgeReinforcement: '2026-09-07T04:20:00Z',
    lastRetrievalRun: '2026-09-07T09:41:12Z',
    lastVectorWrite: '2026-09-07T09:30:00Z',
  },
}

// Daniel (owner) — `vectorCount: 812`, `rowCount: 2140`. Same internal-consistency contract as
// Anna's mock above.
export const ADMIN_MEMORY_HEALTH_OWNER_MOCK: AdminMemoryHealthResponse = {
  servingEmbeddingVersion: 'text-embedding-3-small@v1',
  vectorsByStatus: [{ key: 'ready', count: 780 }, { key: 'pending', count: 20 }, { key: 'failed', count: 12 }],
  vectorFailures: [{ key: 'RATE_LIMITED', count: 8 }, { key: 'CONTENT_FILTERED', count: 4 }],
  vectorsByVersion: [{ key: 'text-embedding-3-small@v1', count: 780 }, { key: 'text-embedding-3-small@v0', count: 32 }],
  staleVectorCount: 5,
  itemsByState: [{ key: 'active', count: 1980 }, { key: 'suppressed', count: 110 }, { key: 'superseded', count: 50 }],
  nodesByStatus: [{ key: 'active', count: 100 }, { key: 'archived', count: 20 }, { key: 'candidate', count: 8 }],
  nodesByKind: [{ key: 'PATTERN', count: 54 }, { key: 'PREFERENCE', count: 27 }, { key: 'GOAL', count: 18 }, { key: 'LIFE_EVENT', count: 14 }, { key: 'SEASON', count: 7 }, { key: 'INSIGHT', count: 5 }, { key: 'PERSON', count: 3 }],
  edgeWeightHistogram: Array.from({ length: 10 }, (_, i) => ({ key: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`, count: [18, 25, 32, 54, 95, 172, 235, 276, 217, 99][i] })),
  jobs: {
    lastDailySummary: '2026-09-07T04:00:00Z',
    lastPatternDetection: '2026-09-07T04:12:00Z',
    lastEdgeReinforcement: '2026-09-07T04:20:00Z',
    lastRetrievalRun: '2026-09-07T09:41:12Z',
    lastVectorWrite: '2026-09-07T09:30:00Z',
  },
}

// Béla — `vectorCount: 0`, `status: 'DISABLED'`, never active. Honest all-zero shape, NOT the
// same identity as `ADMIN_MEMORY_HEALTH_EMPTY` (that one is the companion-off/degraded-fallback
// shape with an empty `servingEmbeddingVersion` too) — the system IS configured, Béla simply has
// nothing in it yet.
export const ADMIN_MEMORY_HEALTH_BELA_MOCK: AdminMemoryHealthResponse = {
  servingEmbeddingVersion: 'text-embedding-3-small@v1',
  vectorsByStatus: [], vectorFailures: [], vectorsByVersion: [], staleVectorCount: 0,
  itemsByState: [], nodesByStatus: [], nodesByKind: [], edgeWeightHistogram: [],
  jobs: {
    lastDailySummary: null,
    lastPatternDetection: null,
    lastEdgeReinforcement: null,
    lastRetrievalRun: null,
    lastVectorWrite: null,
  },
}

export function adminMemoryHealthMockFor(userId: string): AdminMemoryHealthResponse {
  if (userId === MOCK_ANNA_ID) return ADMIN_MEMORY_HEALTH_ANNA_MOCK
  if (userId === MOCK_OWNER_ID) return ADMIN_MEMORY_HEALTH_OWNER_MOCK
  if (userId === MOCK_BELA_ID) return ADMIN_MEMORY_HEALTH_BELA_MOCK
  return ADMIN_MEMORY_HEALTH_MOCK
}

// Installation-wide health (mezo-k5zy) — the Memória entry page's KPI tiles. A realistic
// install with a nonzero stale count (the quiet failure mode the entry page must surface).
//
// Fix round (F2): these numbers must be the SUM of the three per-user seeds above, not an
// independent fiction — otherwise the entry page's install-wide KPIs contradict what a click into
// any one user's own Áttekintés/Rétegek shows immediately after. Recomputed from
// ADMIN_MEMORY_HEALTH_{ANNA,OWNER,BELA}_MOCK:
//   vectors  Anna 132+6+2=140  Owner 780+20+12=812  Béla 0        => total 952
//   ready    Anna 132          Owner 780            Béla 0        => 912
//   failed   Anna 2            Owner 12             Béla 0        => 14
//   stale    Anna 6            Owner 5              Béla 0        => 11
//   items    Anna 356          Owner 2140           Béla 0        => 2496
// (Pulzus's own overview seed, `ADMIN_OVERVIEW_MOCK`'s 512/488 memoryItemCount/vectorCount, is a
// SEPARATE endpoint's independent fiction — deliberately left untouched; only this memory-global
// seed needs to agree with the per-user memory seeds.)
export const ADMIN_MEMORY_GLOBAL_HEALTH_MOCK: AdminMemoryGlobalHealthResponse = {
  vectorsReady: 912,
  vectorsFailed: 14,
  vectorsStale: 11,
  itemsTotal: 2496,
  newestDailySummaryAt: hoursAgoIso(5),
}

export const ADMIN_MEMORY_GLOBAL_HEALTH_EMPTY: AdminMemoryGlobalHealthResponse = {
  vectorsReady: 0,
  vectorsFailed: 0,
  vectorsStale: 0,
  itemsTotal: 0,
  newestDailySummaryAt: null,
}
