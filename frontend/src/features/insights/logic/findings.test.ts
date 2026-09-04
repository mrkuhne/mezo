import { confidenceMeta, findingSentence, pairLine, strengthWord } from '@/features/insights/logic/findings'
import type { PatternMonitorPair } from '@/data/types'

const base: PatternMonitorPair = {
  key: 'ritual-closed~next-sleep-quality',
  title: 'Esti lezárás ↔ rákövetkező alvásminőség',
  category: 'trigger',
  categoryLabel: 'Trigger',
  lagDays: 1,
  metricAKey: 'ritual-closed',
  metricALabel: 'esti lezárás',
  metricAValueKind: 'binary',
  metricBKey: 'sleep-quality',
  metricBLabel: 'alvásminőség',
  metricBValueKind: 'number',
  mechanismHu: 'Az esti lezárás lecsendesítheti az elalvást — jobb alvásminőség.',
  questionHu: 'Jobban alszol, ha este lezárod a napot?',
  expectedDirection: 'positive',
  whenPositiveHu: 'a lezárt esték után {erősség} jobban aludtál',
  whenNegativeHu: 'a lezárt esték után {erősség} rosszabbul aludtál',
  metricADomain: 'mind',
  metricBDomain: 'sleep',
  verdict: 'live',
  alignedDays: 13,
  missingDays: null,
  bottleneckMetricKey: null,
  groupZeroDays: 6,
  groupOneDays: 7,
  requiredPerGroup: 3,
  r: -0.31,
  n: 13,
  p: 0.302,
  status: null,
}

test('strengthWord bands |r| into kicsit / érezhetően / határozottan', () => {
  expect(strengthWord(-0.29)).toBe('kicsit')
  expect(strengthWord(0.31)).toBe('érezhetően')
  expect(strengthWord(-0.61)).toBe('határozottan')
})

test('a found direction against the expectation states that the opposite is currently visible', () => {
  const s = findingSentence(base)!
  expect(s.prefix).toBe('Eddig az ellenkezője látszik:')
  expect(s.before).toBe('a lezárt esték után ')
  expect(s.strength).toBe('érezhetően')
  expect(s.after).toBe(' rosszabbul aludtál')
})

test('a matching direction says that the days point toward the hypothesis', () => {
  const s = findingSentence({ ...base, r: 0.62 })!
  expect(s.prefix).toBe('Eddig ebbe az irányba mutatnak a napjaid:')
  expect(s.after).toBe(' jobban aludtál')
  expect(s.strength).toBe('határozottan')
})

test('no r (non-live pair) yields no sentence', () => {
  expect(findingSentence({ ...base, r: null })).toBeNull()
})

test('confidenceMeta translates p honestly into Hungarian', () => {
  expect(confidenceMeta(34, 0.001)).toEqual({
    chip: 'megbízható jel',
    tone: 'success',
    sentence: '34 közös nap — erősebb bizonyíték; ez már kevésbé magyarázható véletlennel',
  })
  expect(confidenceMeta(20, 0.12).chip).toBe('ígéretes jel')
  const weak = confidenceMeta(13, 0.302)
  expect(weak.chip).toBe('még bizonytalan')
  expect(weak.sentence).toBe('13 közös nap — bizonytalan jel; ebből még nem érdemes következtetést levonni')
})

test('pairLine marks the next-day side only on lagged pairs', () => {
  expect(pairLine(base)).toBe('esti lezárás ↔ másnapi alvásminőség')
  expect(pairLine({ ...base, lagDays: 0 })).toBe('esti lezárás ↔ alvásminőség')
})
