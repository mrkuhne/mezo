import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { FactSource, MemoryLlmUsage, MemoryOverview, MemorySummaryItem, SimilarDay } from '@/data/types'

export type MemoryOverviewResponse = components['schemas']['MemoryOverviewResponse']
export type MemorySummaryListResponse = components['schemas']['MemorySummaryListResponse']

/** Wire → FE domain: a hiányzó opcionális mezők egységesen `null`-ra normalizálódnak. */
export function toOverview(w: MemoryOverviewResponse): MemoryOverview {
  return {
    l0: { daysWithAnyData: w.l0.daysWithAnyData, windowDays: w.l0.windowDays },
    l1: {
      summaryCount: w.l1.summaryCount,
      firstDate: w.l1.firstDate ?? null,
      lastDate: w.l1.lastDate ?? null,
      embeddings: { dailySummary: w.l1.embeddings.dailySummary, chatTurn: w.l1.embeddings.chatTurn },
    },
    l2: {
      patterns: w.l2.patterns.map((p) => ({ kind: p.kind, status: p.status, count: p.count })),
      pendingFactCandidates: w.l2.pendingFactCandidates,
    },
    l3: {
      // a wire string a saját backendünk pattern-kényszeréből jön
      facts: w.l3.facts.map((f) => ({ source: f.source as FactSource, count: f.count })),
      totalReinforcements: w.l3.totalReinforcements,
      factsInPrompt: w.l3.factsInPrompt,
    },
    jobs: {
      summaryCron: w.jobs.summaryCron,
      patternCron: w.jobs.patternCron,
      hypothesisCron: w.jobs.hypothesisCron,
      lastSummaryDate: w.jobs.lastSummaryDate ?? null,
      lastDetectedAt: w.jobs.lastDetectedAt ?? null,
    },
  }
}

export const memoryApi = {
  overview: async () =>
    toOverview(await apiFetch<MemoryOverviewResponse>('/api/companion/memory/overview')),
  summaries: async (): Promise<MemorySummaryItem[]> => {
    const wire = await apiFetch<MemorySummaryListResponse>('/api/companion/memory/summary')
    return wire.items.map((i) => ({ date: i.date, narrative: i.narrative, embedded: i.embedded }))
  },
  similarDays: async (q: string, k: number): Promise<SimilarDay[]> => {
    const wire = await apiFetch<components['schemas']['SimilarDaysResponse']>(
      `/api/companion/memory/similar-days?q=${encodeURIComponent(q)}&k=${k}`,
    )
    return wire.items.map((i) => ({
      date: i.date, excerpt: i.excerpt, similarity: i.similarity, finalScore: i.finalScore,
    }))
  },
  llmUsage: async (days: number): Promise<MemoryLlmUsage> => {
    const wire = await apiFetch<components['schemas']['LlmUsageResponse']>(
      `/api/companion/memory/llm-usage?days=${days}`,
    )
    return {
      enabled: wire.enabled,
      perDay: wire.perDay.map((d) => ({
        date: d.date, calls: d.calls, inputTokens: d.inputTokens,
        outputTokens: d.outputTokens, costUsd: d.costUsd ?? null,
      })),
      totals: {
        calls: wire.totals.calls, inputTokens: wire.totals.inputTokens,
        outputTokens: wire.totals.outputTokens, costUsd: wire.totals.costUsd ?? null,
      },
    }
  },
}
