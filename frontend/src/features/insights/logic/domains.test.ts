import { DOMAIN_ORDER, groupPairsByDomain } from '@/features/insights/logic/domains'
import { patternMonitor } from '@/data/insights/insights'

test('groups by metric-B domain in DOMAIN_ORDER, sections sorted, empty domains dropped', () => {
  const grouped = groupPairsByDomain(patternMonitor.pairs)

  // a seed B-doménjei: sleep, train, fuel, mind, body — 'other' üres, kiesik
  expect([...grouped.keys()]).toEqual(DOMAIN_ORDER.filter((d) => d !== 'other'))

  const sleep = grouped.get('sleep')!
  expect(sleep.map((p) => p.key)).toEqual([
    'checkin-stress~sleep-quality', // élő elöl
    'late-meal~next-sleep-quality',
  ])
  const train = grouped.get('train')!
  expect(train.map((p) => p.verdict)).toEqual(['live', 'few_days', 'no_data'])
})
