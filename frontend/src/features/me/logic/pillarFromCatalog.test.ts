import { MOCK_SIGNAL_CATALOG } from '@/data/lifegoal/lifegoalMock'
import { defaultRule, pillarFromCatalog, preferredKind } from '@/features/me/logic/pillarFromCatalog'
import type { SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'

const entry = (kinds: SignalCatalogEntry['kinds']): SignalCatalogEntry =>
  ({ source: { type: 'metric', key: 'SLEEP_DURATION_H' }, label: 'Alváshossz', group: 'Alvás', kinds, unit: 'óra', defaultSkillKey: 'recovery' })

test('preferredKind prefers average, then baseline, then habit over the catalog order', () => {
  expect(preferredKind(entry(['habit', 'average', 'baseline']))).toBe('average')
  expect(preferredKind(entry(['habit', 'baseline', 'target']))).toBe('baseline')
  expect(preferredKind(entry(['target', 'habit']))).toBe('habit')
  expect(preferredKind(entry(['target']))).toBe('target')
  expect(preferredKind(entry(['linked']))).toBe('linked')
})

test('defaultRule gives habit real numbers, so no rule-less habit pillar can be built', () => {
  expect(defaultRule('habit')).toEqual({ comparator: 'gte', threshold: 1, daysPerWeek: 5 })
  expect(defaultRule('average')).toEqual({ windowDays: 7, comparator: 'gte' })
  expect(defaultRule('baseline')).toEqual({ windowDays: 28, minDataDays: 14 })
})

// The binding invariant of item 5: EVERY entry of the closed catalog must yield a pillar whose
// kind the entry actually allows, and whose rule is non-empty for the three parameterisable
// kinds — `rule: {}` is what made PillarCard print a literal `?`.
test('every catalog entry yields an allowed kind and a populated rule', () => {
  for (const e of MOCK_SIGNAL_CATALOG) {
    const p = pillarFromCatalog(e)
    expect(e.kinds).toContain(p.kind)
    if (p.kind === 'average' || p.kind === 'baseline' || p.kind === 'habit') {
      expect(Object.keys(p.rule ?? {}).length).toBeGreaterThan(0)
    }
  }
})
