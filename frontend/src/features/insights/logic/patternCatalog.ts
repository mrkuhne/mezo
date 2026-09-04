import type { MetricDomain } from '@/data/types'
import { DOMAIN_ORDER } from '@/features/insights/logic/domains'
import { BUCKET_ORDER, type LifecycleBucket, type LifecycleEntry } from '@/features/insights/logic/lifecycle'

export const PATTERN_PAGE_SIZE = 5

export type PatternCatalogSort = 'progress' | 'domain'

export function initialBucket(buckets: Map<LifecycleBucket, LifecycleEntry[]>): LifecycleBucket {
  return BUCKET_ORDER.find((bucket) => buckets.get(bucket)!.length > 0) ?? 'decide'
}

export function entryDomain(entry: LifecycleEntry): MetricDomain {
  return entry.pair?.metricBDomain ?? 'other'
}

function entryTitle(entry: LifecycleEntry): string {
  return entry.pair?.questionHu ?? entry.pattern?.title ?? ''
}

export function filterSortEntries(
  entries: LifecycleEntry[],
  domain: MetricDomain | null,
  sort: PatternCatalogSort,
): LifecycleEntry[] {
  const filtered = domain == null ? [...entries] : entries.filter((entry) => entryDomain(entry) === domain)
  if (sort === 'progress') return filtered

  return filtered.sort((left, right) => {
    const byDomain = DOMAIN_ORDER.indexOf(entryDomain(left)) - DOMAIN_ORDER.indexOf(entryDomain(right))
    return byDomain || entryTitle(left).localeCompare(entryTitle(right), 'hu-HU')
  })
}

export function pageEntries(entries: LifecycleEntry[], requestedPage: number): {
  items: LifecycleEntry[]
  page: number
  pageCount: number
} {
  const pageCount = Math.max(1, Math.ceil(entries.length / PATTERN_PAGE_SIZE))
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1))
  const from = page * PATTERN_PAGE_SIZE
  return { items: entries.slice(from, from + PATTERN_PAGE_SIZE), page, pageCount }
}
