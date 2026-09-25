import { evidenceBlocks, evidenceDayLabel, mapEvidence, type EvidenceRecord } from './observationEvidence'

const wire = (over = {}) => ({
  type: 'record', source: 'check_in', date: '2026-05-21', time: '08:00',
  fields: { energy: '6', stress: '3', state: 'done' },
  quote: 'Meglepően jól indult a hét', ref: 'check_in:abc', ...over,
})

it('maps a check-in record: name, icon, checkin dims, quote; hidden fields dropped', () => {
  const r = mapEvidence(wire())
  expect(r).toMatchObject({ kind: 'record', source: 'Check-in', icon: 't-checkin', title: 'Check-in', date: '2026-05-21', time: '08:00', quote: 'Meglepően jól indult a hét' })
  if (r.kind !== 'record') throw new Error('record expected')
  expect(r.checkin).toEqual({ energy: 6, stress: 3 })
  expect(r.values).toEqual([]) // state is HIDDEN
})

it('maps a sport session: sport name as title, source as subtitle, formatted values', () => {
  const r = mapEvidence(wire({ source: 'sport_session', fields: { sport: 'volleyball', duration_min: '90', rpe: '7' }, quote: undefined }))
  if (r.kind !== 'record') throw new Error('record expected')
  expect(r.subtitle).toBe('Sportnapló')
  expect(r.values).toContainEqual({ value: '90', unit: 'perc' })
  expect(r.values).toContainEqual({ label: 'RPE', value: '7', unit: '/10', hot: true })
})

it('drops the raw JSON breakdown field from a meal record', () => {
  const r = mapEvidence(wire({ source: 'meal', fields: { breakdown: '{"protein":40}', kcal: '600' } })) as EvidenceRecord
  expect(r.values.some((v) => JSON.stringify(v).includes('protein'))).toBe(false)
  expect(r.values).toContainEqual({ value: '600', unit: 'kcal' })
})

it('maps unknown source to its raw name with the note icon', () => {
  const r = mapEvidence(wire({ source: 'future_thing', fields: {} }))
  expect(r).toMatchObject({ kind: 'record', source: 'future_thing', icon: 't-note' })
})

it('maps tags and recordless items to tag', () => {
  expect(mapEvidence({ type: 'tag', text: '4 hála-bejegyzés' })).toEqual({ kind: 'tag', text: '4 hála-bejegyzés' })
  expect(mapEvidence(wire({ date: undefined, text: undefined }))).toMatchObject({ kind: 'tag' })
})

const SPORT_1 = mapEvidence({
  type: 'record', source: 'sport_session', date: '2026-09-17', time: '20:46',
  fields: { sport: 'volleyball', duration_min: '120', rpe: '7.0', shoulder_strain: '6', kcal: '975', kcal_is_estimate: 'true' },
  quote: 'Típus: Edzés',
}) as EvidenceRecord
const CK_1 = mapEvidence({
  type: 'record', source: 'check_in', date: '2026-09-22', time: '14:00',
  fields: { energy: '7', stress: '2', body: '8', mental: '8' },
  quote: 'Nagyon jól vagyok. Este randizom',
}) as EvidenceRecord
const CK_2 = mapEvidence({
  type: 'record', source: 'check_in', date: '2026-09-22', time: '20:00',
  fields: { energy: '4', stress: '1', body: '9', mental: '10' },
  quote: 'Jó a randi',
}) as EvidenceRecord

test('két egymást követő check-in: a sorok számok nélkül, alattuk egy közös változás-blokk', () => {
  const blocks = evidenceBlocks([SPORT_1, CK_1, CK_2])
  expect(blocks.map((b) => b.kind)).toEqual(['record', 'record', 'record', 'shift'])
  expect(blocks[0]).not.toHaveProperty('hideCheckin')
  expect(blocks[1]).toMatchObject({ hideCheckin: true })
  const shift = blocks[3]
  expect(shift.kind === 'shift' && [shift.from.time, shift.to.time]).toEqual(['14:00', '20:00'])
})

test('egyetlen check-in megtartja a saját négy mezőjét, nincs változás-blokk', () => {
  const blocks = evidenceBlocks([CK_1, SPORT_1])
  expect(blocks.map((b) => b.kind)).toEqual(['record', 'record'])
  expect(blocks[0]).not.toHaveProperty('hideCheckin')
})

test('üres szövegű címke (a mapper text/quote fallback-je is hiányzott) nem kerül a blokkok közé', () => {
  const blocks = evidenceBlocks([SPORT_1, { kind: 'tag', text: '' }, { kind: 'tag', text: 'valódi címke' }])
  expect(blocks.map((b) => b.kind)).toEqual(['record', 'tag'])
  expect(blocks).not.toContainEqual({ kind: 'tag', text: '' })
})

test('a nap-címke relatív a mai naphoz', () => {
  expect(evidenceDayLabel('2026-09-23', '2026-09-23')).toBe('ma')
  expect(evidenceDayLabel('2026-09-22', '2026-09-23')).toBe('tegnap')
  expect(evidenceDayLabel('2026-09-17', '2026-09-23')).toBe('szept. 17. · csütörtök')
})
