import { evidenceBlocks, evidenceDayLabel, parseEvidence, type EvidenceRecord } from './observationEvidence'

const SPORT_1 = 'Sportnapló · 2026-09-17 · notes=Típus: Edzés; sport=volleyball; date=2026-09-17; time=20:46; duration_min=120; rpe=7.0; shoulder_strain=6; kcal=975; kcal_is_estimate=true'
const CK_1 = 'Check-in · 2026-09-22 · note=Nagyon jól vagyok. Este randizom; date=2026-09-22; slot_time=14:00; state=done; energy=7; stress=2; body=8; mental=8; saved_at=2026-09-22T15:39:43.832634+02:00'
const CK_2 = 'Check-in · 2026-09-22 · note=Jó a randi; date=2026-09-22; slot_time=20:00; state=done; energy=4; stress=1; body=9; mental=10; saved_at=2026-09-22T21:35:54.110461+02:00'

test('a sportnapló-sor a sportág nevét és ikonját kapja, a nyers mezők címkézett értékek lesznek', () => {
  const r = parseEvidence(SPORT_1) as EvidenceRecord
  expect(r.kind).toBe('record')
  expect(r.title).toBe('Röplabda')
  expect(r.subtitle).toBe('Sportnapló')
  expect(r.icon).toBe('t-volley')
  expect(r.date).toBe('2026-09-17')
  expect(r.time).toBe('20:46')
  expect(r.quote).toBe('Típus: Edzés')
  expect(r.values).toEqual([
    { value: '120', unit: 'perc' },
    { label: 'RPE', value: '7', unit: '/10', hot: true },
    { label: 'Vállterhelés', value: '6', unit: '/10', hot: true },
    { value: '~975', unit: 'kcal' },
  ])
})

test('a check-in négy dimenziója külön mezőbe kerül, a gépi mezők (state, saved_at) eltűnnek', () => {
  const r = parseEvidence(CK_1) as EvidenceRecord
  expect(r.title).toBe('Check-in')
  expect(r.icon).toBe('t-checkin')
  expect(r.time).toBe('14:00')
  expect(r.checkin).toEqual({ energy: 7, stress: 2, body: 8, mental: 8 })
  expect(r.values).toEqual([])
  expect(r.quote).toBe('Nagyon jól vagyok. Este randizom')
})

test('a jegyzetben álló pontosvessző a jegyzet része marad', () => {
  const r = parseEvidence('Napló · 2026-09-21 · text=Fáradt vagyok; de jól; occurred_on=2026-09-21') as EvidenceRecord
  expect(r.quote).toBe('Fáradt vagyok; de jól')
})

test('csonkolt bejegyzés: a félbevágott utolsó mezőt eldobjuk, a prózát megtartjuk', () => {
  const cut = parseEvidence('Sportnapló · 2026-09-17 · sport=volleyball; duration_min=120; rpe=7.0; kc…') as EvidenceRecord
  expect(cut.truncated).toBe(true)
  expect(cut.values.map((v) => v.label ?? v.unit)).toEqual(['perc', 'RPE'])
  const midValue = parseEvidence('Sportnapló · 2026-09-17 · duration_min=120; rpe=7.0; kcal=97…') as EvidenceRecord
  expect(midValue.values.map((v) => v.label ?? v.unit)).toEqual(['perc', 'RPE'])
  const prose = parseEvidence('Napló · 2026-09-21 · text=Megint elment a vasárnap…') as EvidenceRecord
  expect(prose.quote).toBe('Megint elment a vasárnap')
  expect(prose.truncated).toBe(true)
})

test('ami nem a nyers rekord-formában jön, sima címke marad', () => {
  expect(parseEvidence('4 hála-bejegyzés')).toEqual({ kind: 'tag', text: '4 hála-bejegyzés' })
  expect(parseEvidence('2026-09-09 · Check-in: stressz')).toEqual({ kind: 'tag', text: '2026-09-09 · Check-in: stressz' })
})

test('a nyers táblanévvel érkező forrás magyar nevet kap, az ismeretlen mező olvasható címkét', () => {
  const r = parseEvidence('weight_log · 2026-09-20 · date=2026-09-20; weight_kg=82.4; mood_tag=jó') as EvidenceRecord
  expect(r.title).toBe('Testsúly')
  expect(r.icon).toBe('t-weight')
  expect(r.values).toEqual([{ value: '82,4', unit: 'kg' }, { label: 'mood tag', value: 'jó' }])
})

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

test('a nap-címke relatív a mai naphoz', () => {
  expect(evidenceDayLabel('2026-09-23', '2026-09-23')).toBe('ma')
  expect(evidenceDayLabel('2026-09-22', '2026-09-23')).toBe('tegnap')
  expect(evidenceDayLabel('2026-09-17', '2026-09-23')).toBe('szept. 17. · csütörtök')
})
