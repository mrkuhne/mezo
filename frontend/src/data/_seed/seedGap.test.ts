import { gapDays, lerpSeries } from '@/data/_seed/seedGap'

test('a lyuk a két vég KÖZÖTT van — egyik végpont sem tartozik bele', () => {
  expect(gapDays('2026-05-22', '2026-05-26')).toEqual(['2026-05-23', '2026-05-24', '2026-05-25'])
})

test('szomszédos napok közt nincs lyuk', () => {
  expect(gapDays('2026-05-22', '2026-05-23')).toEqual([])
})

test('azonos vagy fordított sorrendű végek üres lyukat adnak — sosem dob', () => {
  expect(gapDays('2026-05-22', '2026-05-22')).toEqual([])
  expect(gapDays('2026-05-26', '2026-05-22')).toEqual([])
})

test('hónap- és évhatáron is helyesen lép', () => {
  expect(gapDays('2026-12-30', '2027-01-02')).toEqual(['2026-12-31', '2027-01-01'])
})

test('a lerpSeries a két végpont KÖZÖTTI értékeket adja, egy tizedesre kerekítve', () => {
  expect(lerpSeries(78.6, 78.4, 3)).toEqual([78.55, 78.5, 78.45].map((v) => Math.round(v * 10) / 10))
})

test('a lerpSeries nulla hosszra üres — nincs osztás nullával', () => {
  expect(lerpSeries(78.6, 78.4, 0)).toEqual([])
})

test('a lerpSeries determinisztikus — ugyanaz a bemenet ugyanazt adja', () => {
  expect(lerpSeries(80, 78, 5)).toEqual(lerpSeries(80, 78, 5))
})
