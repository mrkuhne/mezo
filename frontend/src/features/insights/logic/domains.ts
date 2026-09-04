import type { MetricDomain, PatternGateVerdict, PatternMonitorPair } from '@/data/types'

/** A Motor tab domén-szekcióinak megjelenítési metaadatai (mezo-18bx) — tokenek, sosem hex. */
export const DOMAIN_META: Record<MetricDomain, { label: string; icon: string; rail: string; tint: string }> = {
  sleep: { label: 'Alvás', icon: '🌙', rail: 'var(--lav)', tint: 'var(--wash-lav)' },
  train: { label: 'Edzés', icon: '🏋️', rail: 'var(--primary-base)', tint: 'var(--primary-bg)' },
  fuel: { label: 'Táplálkozás', icon: '🥗', rail: 'var(--success-base)', tint: 'var(--success-bg)' },
  mind: { label: 'Mentális & társas', icon: '🧠', rail: 'var(--accent-base)', tint: 'var(--accent-bg)' },
  body: { label: 'Test', icon: '⚖️', rail: 'var(--secondary-soft)', tint: 'var(--secondary-bg)' },
  other: { label: 'Egyéb', icon: '📅', rail: 'var(--text-muted)', tint: 'var(--surface-recess)' },
}

export const DOMAIN_ORDER: MetricDomain[] = ['sleep', 'train', 'fuel', 'mind', 'body', 'other']

/** „Mi van legközelebb az áttöréshez" — szekción belül ettől cselekvésre váltható a lista. */
const VERDICT_ORDER: Record<PatternGateVerdict, number> = {
  live: 0,
  few_days: 1,
  imbalanced_groups: 2,
  degenerate: 3,
  no_data: 4,
  frozen: 5,
}

export function comparePairs(a: PatternMonitorPair, b: PatternMonitorPair): number {
  const byVerdict = VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]
  if (byVerdict !== 0) return byVerdict
  // few_days-en belül: kevesebb hiányzó nap előre; máshol a több illesztett nap előre
  if (a.verdict === 'few_days') return (a.missingDays ?? 0) - (b.missingDays ?? 0)
  return b.alignedDays - a.alignedDays
}

/**
 * Elsődleges domén-szabály (spec §3): a pár a KIMENETI (B) metrikája doménjéhez tartozik —
 * minden pár pontosan egyszer szerepel; a kereszt-domén jelzés a sor dolga.
 */
export function groupPairsByDomain(pairs: PatternMonitorPair[]): Map<MetricDomain, PatternMonitorPair[]> {
  const grouped = new Map<MetricDomain, PatternMonitorPair[]>()
  for (const domain of DOMAIN_ORDER) grouped.set(domain, [])
  for (const pair of pairs) grouped.get(pair.metricBDomain)!.push(pair)
  for (const bucket of grouped.values()) bucket.sort(comparePairs)
  for (const domain of DOMAIN_ORDER) {
    if (grouped.get(domain)!.length === 0) grouped.delete(domain)
  }
  return grouped
}
