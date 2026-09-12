// A mintázat-HIVATKOZÁSOK tesztjei (Fuel Titanium S3, mezo-83g0 — C4 anti-duplikáció).
import { expect, test } from 'vitest'
import { fuelPatternRefs } from '@/features/fuel/logic/fuelPatternRefs'
import type { Pattern } from '@/data/types'

const pattern = (over: Partial<Pattern>): Pattern => ({
  id: 'p', pairKey: 'a~b', category: 'trigger', categoryLabel: 'Kiváltó',
  title: 'Valami', mechanism: 'MECHANIZMUS', evidence: ['BIZONYÍTÉK'],
  evidenceHits: 3, evidenceMisses: 1, ...over,
})

// C4: a mintázat kanonikus otthona a Mezo — innen csak ODALÉPÜNK.
test('a hivatkozás a kanonikus Mezo-útvonalra visz', () => {
  const refs = fuelPatternRefs([pattern({ pairKey: 'late-meal~next-sleep-quality' })])
  expect(refs).toHaveLength(1)
  expect(refs[0].route).toBe('/mezo/patterns/late-meal~next-sleep-quality')
})

// Anti-duplikáció: a felismerés SZÖVEGE (mechanizmus, bizonyíték) nem kerül át.
test('a hivatkozás nem hordozza a felismerés szövegét', () => {
  const refs = fuelPatternRefs([pattern({ pairKey: 'daily-kcal~x', mechanism: 'MECHANIZMUS', evidence: ['BIZONYÍTÉK'] })])
  expect(JSON.stringify(refs)).not.toContain('MECHANIZMUS')
  expect(JSON.stringify(refs)).not.toContain('BIZONYÍTÉK')
})

test('linkelhető kulcs nélkül inkább semmit nem mutatunk, mint másolatot', () => {
  expect(fuelPatternRefs([pattern({ pairKey: '', title: 'Napi kalória ↔ súly' })])).toEqual([])
  expect(fuelPatternRefs([pattern({ pairKey: '   ', title: 'Napi kalória ↔ súly' })])).toEqual([])
})

test('a nem táplálkozási mintázat nem jelenik meg a Fuel oldalon', () => {
  const refs = fuelPatternRefs([
    pattern({ pairKey: 'sport-load~next-sleep-quality', title: 'Magas sportterhelés → mélyebb alvás' }),
  ])
  expect(refs).toEqual([])
})

test('a kulcs ÉS a cím is táplálkozási jelzés lehet', () => {
  expect(fuelPatternRefs([pattern({ pairKey: 'daily-kcal~next-morning-weight-delta', title: 'X → Y' })])).toHaveLength(1)
  expect(fuelPatternRefs([pattern({ pairKey: 'hyp-3fa1c2d9', title: 'Késő szénhidrát → reggeli RPE +1' })])).toHaveLength(1)
})

test('az állapot-szó a ház meglévő szótárából jön', () => {
  const label = (status: Pattern['status']) =>
    fuelPatternRefs([pattern({ pairKey: 'daily-kcal~x', status })])[0].stateLabel
  expect(label('confirmed')).toBe('Megerősítve')
  expect(label('monitoring')).toBe('Figyeljük')
  expect(label('rejected')).toBe('Elvetve')
  expect(label('refuted')).toBe('Megnéztük — nem igazolódott')
  expect(label('dormant')).toBe('Pihen — várom az adatot')
  expect(label(undefined)).toBe('Döntésre vár')
})

test('a hivatkozó sor rövid — nem olvasmány', () => {
  const refs = fuelPatternRefs([pattern({
    pairKey: 'daily-kcal~x',
    title: 'Napi kalória ↔ másnap reggeli súlyváltozás',
    status: 'monitoring',
  })])
  expect(`${refs[0].title}${refs[0].stateLabel}`.length).toBeLessThan(120)
})

test('üres lista üres réteg', () => {
  expect(fuelPatternRefs([])).toEqual([])
})
