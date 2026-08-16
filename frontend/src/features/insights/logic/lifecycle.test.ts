import { bucketize, isStrongSignal } from '@/features/insights/logic/lifecycle'
import { patternMonitor } from '@/data/insights/insights'
import type { Pattern, PatternMonitor, PatternMonitorPair } from '@/data/types'

const pair = (over: Partial<PatternMonitorPair>): PatternMonitorPair => ({
  ...patternMonitor.pairs[0], ...over,
})
const pattern = (over: Partial<Pattern>): Pattern => ({
  id: 'p1', pairKey: 'k1', category: 'physiology', categoryLabel: 'Fiziológia',
  title: 't', mechanism: 'm', evidence: [], kind: 'statistical', status: 'proposed', ...over,
})

describe('isStrongSignal', () => {
  test('needs BOTH |r| >= 0.3 AND p <= 0.15', () => {
    expect(isStrongSignal(-0.37, 0.14)).toBe(true)
    expect(isStrongSignal(-0.37, 0.188)).toBe(false) // a screenshot Hétvége-sora — nem inbox
    expect(isStrongSignal(0.0, 1.0)).toBe(false)     // a Reta-sor — nem inbox
    expect(isStrongSignal(0.29, 0.01)).toBe(false)
    expect(isStrongSignal(null, 0.05)).toBe(false)
  })
})

describe('bucketize', () => {
  test('proposed strong statistical row → decide; weak → noRelationship', () => {
    const monitor: PatternMonitor = { ...patternMonitor, pairs: [
      pair({ key: 'k1', verdict: 'live', r: -0.55, n: 20, p: 0.01 }),
      pair({ key: 'k2', verdict: 'live', r: 0.0, n: 14, p: 1.0 }),
    ] }
    const buckets = bucketize(
      [pattern({ id: 'a', pairKey: 'k1' }), pattern({ id: 'b', pairKey: 'k2' })], monitor)
    expect(buckets.get('decide')!.map((e) => e.key)).toEqual(['k1'])
    expect(buckets.get('noRelationship')!.map((e) => e.key)).toEqual(['k2'])
  })

  test('user-judged statuses win over strength', () => {
    const monitor: PatternMonitor = { ...patternMonitor, pairs: [pair({ key: 'k1', verdict: 'frozen', r: 0.0, p: 1.0 })] }
    const buckets = bucketize([pattern({ pairKey: 'k1', status: 'confirmed' })], monitor)
    expect(buckets.get('confirmed')).toHaveLength(1)
    expect(buckets.get('noRelationship')).toHaveLength(0)
  })

  test('pairs without a pattern row land in gathering', () => {
    const monitor: PatternMonitor = { ...patternMonitor, pairs: [pair({ key: 'k9', verdict: 'few_days', missingDays: 3, r: null, n: null, p: null })] }
    const buckets = bucketize([], monitor)
    expect(buckets.get('gathering')!.map((e) => e.key)).toEqual(['k9'])
    expect(buckets.get('gathering')![0].pattern).toBeNull()
  })

  test('hypothesis rows gate on confidence, not r/p', () => {
    const buckets = bucketize(
      [pattern({ pairKey: 'h1', kind: 'ai_hypothesis', confidence: 0.8 }),
       pattern({ id: 'p2', pairKey: 'h2', kind: 'ai_hypothesis', confidence: 0.5 })], null)
    expect(buckets.get('decide')!.map((e) => e.key)).toEqual(['h1'])
    expect(buckets.get('noRelationship')!.map((e) => e.key)).toEqual(['h2'])
  })

  test('degraded monitor (null) → proposed statistical rows stay in decide (server gate passed)', () => {
    const buckets = bucketize([pattern({ pairKey: 'k1' })], null)
    expect(buckets.get('decide')).toHaveLength(1)
  })

  test('decide sorts by |r| desc (strongest asks first)', () => {
    const monitor: PatternMonitor = { ...patternMonitor, pairs: [
      pair({ key: 'k1', verdict: 'live', r: -0.35, n: 20, p: 0.05 }),
      pair({ key: 'k2', verdict: 'live', r: 0.6, n: 20, p: 0.01 }),
    ] }
    const buckets = bucketize(
      [pattern({ id: 'a', pairKey: 'k1' }), pattern({ id: 'b', pairKey: 'k2' })], monitor)
    expect(buckets.get('decide')!.map((e) => e.key)).toEqual(['k2', 'k1'])
  })
})
