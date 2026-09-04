import { MIN_PATTERN_CONFIDENCE, STRONG_SIGNAL } from '@/data/insights/insights'
import type { Pattern, PatternMonitor, PatternMonitorPair } from '@/data/types'

/** A dashboard hat életciklus-kosara (spec 2026-08-14) — a szekció-sorrend is. */
export type LifecycleBucket = 'decide' | 'monitoring' | 'confirmed' | 'gathering' | 'noRelationship' | 'rejected'
export const BUCKET_ORDER: LifecycleBucket[] = ['decide', 'monitoring', 'confirmed', 'gathering', 'noRelationship', 'rejected']

export interface LifecycleEntry {
  key: string
  pattern: Pattern | null
  pair: PatternMonitorPair | null
  bucket: LifecycleBucket
}

/** A döntés-inbox küszöbe — MEGJELENÍTÉSI szabály, a kapu/perzisztencia érintetlen. */
export function isStrongSignal(r: number | null | undefined, p: number | null | undefined): boolean {
  return r != null && p != null && Math.abs(r) >= STRONG_SIGNAL.minAbsR && p <= STRONG_SIGNAL.maxP
}

function bucketFor(pattern: Pattern, pair: PatternMonitorPair | null): LifecycleBucket {
  switch (pattern.status ?? 'proposed') {
    case 'confirmed': return 'confirmed'
    case 'monitoring': return 'monitoring'
    case 'rejected': return 'rejected'
    case 'proposed':
      if (pattern.kind === 'ai_hypothesis') {
        return pattern.confidence != null && pattern.confidence >= MIN_PATTERN_CONFIDENCE ? 'decide' : 'noRelationship'
      }
      // mezo-mqdj: a monitor VAN, de a pár ma nem él (few_days/no_data/degenerate/imbalanced).
      // job a kapu-bukáskor nem nyúl a korábban perzisztált sorhoz, így az elavult statisztikával
      // itt maradt — vissza a gyűjtésbe. Döntést kérni rá hazugság volna: a „Megerősítem" tartós
      // tudássá tenné (Tudástár + prompt + előrejelzés) azt, amit a mai adat ki sem tud számolni.
      if (pair != null && pair.verdict !== 'live') return 'gathering'
      // statistical: a monitor élő r/p-je dönt; monitor híján (degraded) a szerver-kapu már átengedte → kérdezzünk
      if (pair == null || pair.r == null || pair.p == null) return 'decide'
      return isStrongSignal(pair.r, pair.p) ? 'decide' : 'noRelationship'
  }
}

export function bucketize(patterns: Pattern[], monitor: PatternMonitor | null): Map<LifecycleBucket, LifecycleEntry[]> {
  const buckets = new Map<LifecycleBucket, LifecycleEntry[]>(BUCKET_ORDER.map((b) => [b, []]))
  const pairsByKey = new Map((monitor?.pairs ?? []).map((p) => [p.key, p]))
  const seenPairKeys = new Set<string>()

  for (const pattern of patterns) {
    const pair = pairsByKey.get(pattern.pairKey) ?? null
    if (pair) seenPairKeys.add(pair.key)
    const bucket = bucketFor(pattern, pair)
    buckets.get(bucket)!.push({ key: pattern.pairKey, pattern, pair, bucket })
  }
  // sor nélküli párok: still gathering — a nem élő verdikt nudgja a képviselőjük;
  // egy LIVE-de-még-sor-nélküli pár is ide esik (ma éjjel dolgozza fel a job)
  for (const pair of monitor?.pairs ?? []) {
    if (!seenPairKeys.has(pair.key)) {
      buckets.get('gathering')!.push({ key: pair.key, pattern: null, pair, bucket: 'gathering' })
    }
  }
  buckets.get('decide')!.sort((x, y) => Math.abs(y.pair?.r ?? 0) - Math.abs(x.pair?.r ?? 0))
  return buckets
}
