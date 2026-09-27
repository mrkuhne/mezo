import {
  answerLook, decisionPlan, lean, niceTicks, patternZones, pearson, readPattern, ruleSentence, saySentence,
} from '@/features/insights/logic/patternReading'
import type { AlignedDay, Pattern, PatternEvent, PatternMonitorPair } from '@/data/types'

const pair = (over: Partial<PatternMonitorPair> = {}): PatternMonitorPair => ({
  key: 'wakeup-hour~checkin-energy', title: 'Ébredés ideje ↔ energia-szint', category: 'trigger', categoryLabel: 'Kiváltó ok',
  lagDays: 0, metricAKey: 'wakeup-hour', metricALabel: 'ébredés ideje', metricAValueKind: 'clock_hour',
  metricBKey: 'checkin-energy', metricBLabel: 'energia-szint', metricBValueKind: 'number',
  mechanismHu: '', questionHu: 'Több energiád van, ha korábban kelsz?', expectedDirection: 'negative',
  whenPositiveHu: '', whenNegativeHu: '', metricADomain: 'sleep', metricBDomain: 'mind',
  verdict: 'live', alignedDays: 9, missingDays: null, bottleneckMetricKey: null,
  groupZeroDays: null, groupOneDays: null, requiredPerGroup: null, r: -0.312, n: 9, p: 0.41, status: null,
  ...over,
})
const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  id: 'p1', pairKey: 'wakeup-hour~checkin-energy', category: 'trigger', categoryLabel: 'Kiváltó ok',
  title: 't', mechanism: 'm', evidence: [], status: 'proposed', kind: 'statistical',
  evidenceHits: 0, evidenceMisses: 0,
  testPlan: { seriesA: 'wakeup-hour', seriesB: 'checkin-energy', seriesALabel: 'ébredés ideje',
    seriesBLabel: 'energia-szint', lagDays: 0, expectedDirection: 'negative', minN: 8, windowDays: 60 },
  ...over,
})
const days = (pts: [number, number][]): AlignedDay[] =>
  pts.map(([a, b], i) => ({ date: `2026-09-${String(10 + i).padStart(2, '0')}`, a, b }))
const LINE = days([[1, 2], [2, 4], [3, 6], [4, 8], [5, 10], [6, 12], [7, 14], [8, 16], [9, 18]])

describe('pearson', () => {
  test('perfect line is 1, flat side is null, fewer than 3 points is null', () => {
    expect(pearson(LINE)).toBeCloseTo(1, 6)
    expect(pearson(days([[1, 5], [2, 5], [3, 5]]))).toBeNull()
    expect(pearson(days([[1, 2], [2, 3]]))).toBeNull()
  })
})

describe('lean', () => {
  test('90% Fisher band, flipped into the hypothesis direction', () => {
    const l = lean(-0.312, 9, -1)
    expect(l.support).toBeCloseTo(0.312, 3)
    expect(l.lo).toBeCloseTo(-0.335, 2)
    expect(l.hi).toBeCloseTo(0.759, 2)
  })
  test('n <= 3 means the band spans everything', () => {
    expect(lean(0.5, 3, 1)).toMatchObject({ lo: -1, hi: 1 })
  })
})

describe('readPattern', () => {
  const read = (p: Partial<PatternMonitorPair>, pat: Partial<Pattern> | null = {}, d: AlignedDay[] = [], ev: PatternEvent[] = []) =>
    readPattern({ pair: pair(p), pattern: pat == null ? null : pattern(pat), days: d, events: ev }, 8)

  test('live states follow the band', () => {
    expect(read({ r: -0.312, n: 9 }).state).toBe('halvany')
    expect(read({ r: -0.037, n: 9 }, { testPlan: { ...pattern().testPlan!, expectedDirection: 'positive' } }).state).toBe('nincs')
    expect(read({ r: -0.582, n: 9, expectedDirection: 'positive' }, { testPlan: undefined }).state).toBe('halvanyFordit')
    expect(read({ r: -0.334, n: 32, expectedDirection: 'positive' }, { testPlan: undefined }).state).toBe('fordit')
    expect(read({ r: 0.906, n: 12, expectedDirection: 'positive' }, { testPlan: undefined }).state).toBe('eros')
  })
  test('the plan direction wins over the catalog direction', () => {
    expect(read({ r: 0.906, n: 12, expectedDirection: 'positive' }).state).toBe('fordit')
  })
  test('gate verdicts map to the gathering states', () => {
    expect(read({ verdict: 'few_days', alignedDays: 7, missingDays: 1, r: null, n: null }).state).toBe('gyulik')
    expect(read({ verdict: 'imbalanced_groups', r: null, n: null }).state).toBe('gyulik')
    expect(read({ verdict: 'no_data', alignedDays: 0, r: null, n: null }).state).toBe('kerdes')
    expect(read({ verdict: 'degenerate', r: null, n: null }).state).toBe('allo')
  })
  test('row statuses win over the numbers', () => {
    expect(read({}, { status: 'rejected' }).state).toBe('elvetve')
    expect(read({}, { status: 'refuted' }).state).toBe('elengedve')
    expect(read({}, { status: 'dormant' }).state).toBe('pihen')
  })
  test('minN: plan first, then the gate, then the catalog fallback', () => {
    expect(read({}, { testPlan: { ...pattern().testPlan!, minN: 10 } }).minN).toBe(10)
    expect(read({ verdict: 'few_days', alignedDays: 5, missingDays: 3 }, { testPlan: undefined }).minN).toBe(8)
    expect(readPattern({ pair: pair(), pattern: null, days: [], events: [] }, 12).minN).toBe(12)
  })
  test('a frozen confirmed row is re-read live from its days, and the frozen numbers become "then"', () => {
    const r = read({ verdict: 'frozen', status: 'confirmed', r: -0.545, n: 8, expectedDirection: 'positive' },
      { status: 'confirmed', testPlan: undefined }, LINE)
    expect(r.now?.r).toBeCloseTo(1, 6)
    expect(r.state).toBe('eros')
    expect(r.then?.r).toBeCloseTo(-0.545, 3)
    expect(r.dayCount).toBe(9)
  })
  test('a frozen row with too few live days is gathering', () => {
    expect(read({ verdict: 'frozen', status: 'confirmed', r: 0.5, n: 9 }, { status: 'confirmed' },
      LINE.slice(0, 5)).state).toBe('gyulik')
  })
  test('a confirmed reflection row takes "then" from the last numbered event before the confirm', () => {
    const ev: PatternEvent[] = [
      { kind: 'evidence', occurredAt: '2026-09-20T01:40:00Z', r: 0.6, n: 10, verdict: 'LIVE' },
      { kind: 'confirmed', occurredAt: '2026-09-21T09:00:00Z' },
      { kind: 'evidence', occurredAt: '2026-09-22T01:40:00Z', r: 0.2, n: 12, verdict: 'LIVE' },
    ]
    const r = read({ r: 0.2, n: 12, expectedDirection: 'positive' },
      { status: 'confirmed', kind: 'reflection', testPlan: { ...pattern().testPlan!, expectedDirection: 'positive' } }, [], ev)
    expect(r.then?.r).toBeCloseTo(0.6, 3)
    expect(r.now?.r).toBeCloseTo(0.2, 3)
  })
})

describe('binary group balance (groupsShort)', () => {
  const binPair = (over: Partial<PatternMonitorPair> = {}) => pair({
    metricAKey: 'weekend', metricALabel: 'hétvége', metricAValueKind: 'binary',
    metricBKey: 'late-meal-hour', metricBLabel: 'utolsó étkezés ideje', metricBValueKind: 'clock_hour',
    expectedDirection: 'positive', ...over,
  })
  const eightPlusOne = days([[0, 20], [0, 21], [0, 22], [0, 19], [1, 23], [0, 20], [0, 21], [0, 22], [0, 18]])

  test('a frozen confirmed 8+1 row: enough days, one group short — no minN, own sentence, own note', () => {
    const p = binPair({ verdict: 'frozen', status: 'confirmed', r: 0.4, n: 9 })
    const pat = pattern({ status: 'confirmed', testPlan: undefined })
    const reading = readPattern({ pair: p, pattern: pat, days: eightPlusOne, events: [] }, 8)
    expect(reading.state).toBe('gyulik')
    expect(reading.groups).toEqual({ zero: 8, one: 1, perGroup: 3 })
    expect(reading.groupsShort).toBe(true)
    const s = saySentence(reading, p, eightPlusOne, 'confirmed')
    expect(s).toBe('Megerősítetted. **8** hétköznapi nap mellett még csak **1** hétvégi nap van. '
      + 'Mindkét fajta napból legalább 3 kell, mielőtt irányt mondok.')
    expect(s).not.toMatch(/közös nap/)
    expect(answerLook(reading, 'confirmed')).toEqual({ word: 'Kevés az egyik fajta nap', tone: 'gold', art: 't-clock' })
    expect(decisionPlan(reading, 'confirmed').note)
      .toBe('**Maradhat:** szólok, ha mindkét fajta napból lesz elég, és nem igazolódik.')
  })
  test('the live imbalanced_groups verdict: group sentence, the gather note names the per-group minimum', () => {
    const p = binPair({ verdict: 'imbalanced_groups', alignedDays: 9, groupZeroDays: 8, groupOneDays: 1, requiredPerGroup: 3, r: null, n: null })
    const reading = readPattern({ pair: p, pattern: pattern({ testPlan: undefined }), days: [], events: [] }, 8)
    expect(reading.groupsShort).toBe(true)
    expect(reading.groups).toEqual({ zero: 8, one: 1, perGroup: 3 })
    expect(saySentence(reading, p, [], 'proposed')).toMatch(/^\*\*8\*\* hétköznapi nap mellett még csak \*\*1\*\* hétvégi nap van\./)
    expect(decisionPlan(reading, 'proposed').note).toBe('**Nincs teendőd:** szólok, amikor mindkét fajta napból megvan a 3.')
  })
  test('a confirmed row still under minN keeps "Még alig mért"', () => {
    const p = binPair({ verdict: 'frozen', status: 'confirmed', r: 0.4, n: 9 })
    const d = eightPlusOne.slice(3, 6)
    const reading = readPattern({ pair: p, pattern: pattern({ status: 'confirmed', testPlan: undefined }), days: d, events: [] }, 8)
    expect(answerLook(reading, 'confirmed').word).toBe('Még alig mért')
  })
  test('a non-binary pair never has groups', () => {
    const reading = readPattern({ pair: pair(), pattern: pattern(), days: LINE, events: [] }, 8)
    expect(reading.groups).toBeNull()
    expect(reading.groupsShort).toBe(false)
  })
})

describe('allo names the flat metric', () => {
  test('a frozen row with a flat A side names A', () => {
    const p = pair({ verdict: 'frozen', status: 'confirmed', r: 0.4, n: 9 })
    const d = days([[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7], [7, 8], [7, 9]])
    const reading = readPattern({ pair: p, pattern: pattern({ status: 'confirmed' }), days: d, events: [] }, 8)
    expect(reading.state).toBe('allo')
    expect(saySentence(reading, p, d, 'confirmed')).toMatch(/^Az \*\*ébredés ideje\*\* a vizsgált napokon mindig ugyanannyi/)
  })
  test('a frozen row with a flat B side names B', () => {
    const p = pair({ verdict: 'frozen', status: 'confirmed', r: 0.4, n: 9 })
    const d = days([[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7]])
    const reading = readPattern({ pair: p, pattern: pattern({ status: 'confirmed' }), days: d, events: [] }, 8)
    expect(saySentence(reading, p, d, 'confirmed')).toMatch(/^Az \*\*energia-szint\*\*/)
  })
})

describe('answerLook + decisionPlan', () => {
  const R = (state: Parameters<typeof answerLook>[0]['state'], then = false) =>
    ({ state, now: null, then: then ? lean(0.6, 10, 1) : null, minN: 8, dayCount: 9, dir: 1 as const, groups: null, groupsShort: false })
  test('open rows speak the reading, confirmed rows speak against the decision', () => {
    expect(answerLook(R('halvany'), 'proposed').word).toBe('Halvány jel')
    expect(answerLook(R('eros'), 'confirmed').word).toBe('Tartja magát')
    expect(answerLook({ ...R('halvany', true), now: lean(0.3, 12, 1) }, 'confirmed').word).toBe('Azóta gyengült')
    expect(answerLook(R('halvany'), 'confirmed').word).toBe('Halvány maradt')
    expect(answerLook(R('nincs'), 'confirmed').word).toBe('Az adat nem igazolja')
    expect(answerLook(R('fordit'), 'confirmed').word).toBe('Most ellentmond')
    expect(answerLook(R('gyulik'), 'confirmed').word).toBe('Még alig mért')
  })
  test('the recommended verb follows the reading', () => {
    const rec = (s: Parameters<typeof decisionPlan>[0]['state'], st: Pattern['status'] = 'proposed') =>
      decisionPlan(R(s), st).buttons.find((b) => b.recommended)?.verb ?? null
    expect(rec('nincs')).toBe('reject')
    expect(rec('halvany')).toBe('monitor')
    expect(rec('fordit')).toBe('reject')
    expect(rec('eros')).toBe('confirm')
    expect(rec('gyulik')).toBeNull()
    expect(rec('fordit', 'confirmed')).toBe('reject')
  })
  test('a confirmed row never offers "Megerősítem"; a holding one only a quiet revoke link', () => {
    const plan = decisionPlan(R('eros'), 'confirmed')
    expect(plan.buttons).toEqual([])
    expect(plan.revokeLink).toBe(true)
    expect(decisionPlan(R('halvany'), 'confirmed').buttons.map((b) => b.verb)).toEqual(['reject'])
  })
  test('confirmed + allo: nothing to compare, wait — the revoke is not pushed', () => {
    expect(answerLook(R('allo'), 'confirmed')).toEqual({ word: 'Nincs mit összevetni', tone: 'mute', art: 't-hold' })
    const plan = decisionPlan(R('allo'), 'confirmed')
    expect(plan.note).toBe('**Várjunk:** amíg az egyik adat áll, nincs mit eldönteni.')
    expect(plan.buttons.every((b) => !b.recommended)).toBe(true)
  })
  test('confirmed + halvany only says "weakened" when today is truly weaker than at the decision', () => {
    const weaker = { ...R('halvany', true), now: lean(0.3, 12, 1) }
    expect(answerLook(weaker, 'confirmed').word).toBe('Azóta gyengült')
    expect(decisionPlan(weaker, 'confirmed').note).toContain('csak gyengébben')
    const stronger = { ...R('halvany', true), now: lean(0.7, 12, 1) }
    expect(answerLook(stronger, 'confirmed').word).toBe('Halvány maradt')
    expect(decisionPlan(stronger, 'confirmed').note)
      .toBe('**Maradhat:** a jó irányba mutat, de még halványan. Szólok, ha megfordul.')
    const noThen = { ...R('halvany'), now: lean(0.3, 12, 1) }
    expect(answerLook(noThen, 'confirmed').word).toBe('Halvány maradt')
    expect(decisionPlan(noThen, 'confirmed').note).not.toContain('gyengébben')
  })
  test('a rejected row offers only "Mégis figyeljük"', () => {
    expect(decisionPlan(R('elvetve'), 'rejected').buttons).toEqual([{ verb: 'monitor', label: 'Mégis figyeljük', recommended: false }])
  })
})

describe('zones, ticks and sentences', () => {
  test('numeric zones split at the median of A, binary zones by group', () => {
    const [lo, hi] = patternZones(LINE, false)
    expect(lo.map((d) => d.a)).toEqual([1, 2, 3, 4, 5])
    expect(hi.map((d) => d.a)).toEqual([6, 7, 8, 9])
    const [zero, one] = patternZones(days([[0, 1], [1, 2], [0, 3]]), true)
    expect(zero).toHaveLength(2)
    expect(one).toHaveLength(1)
  })
  test('nice ticks', () => {
    expect(niceTicks(3.8, 6.4, false)).toEqual([4, 5, 6])
    expect(niceTicks(5.9, 7.4, true)).toEqual([6, 6.5, 7])
  })
  test('clock ticks honour the count: a 16-hour range gets at most count+1 ticks', () => {
    const t = niceTicks(9, 25, true, 3)
    expect(t.length).toBeLessThanOrEqual(4)
    expect(t).toEqual([12, 16, 20, 24])
    expect(niceTicks(20, 23, true, 3).length).toBeLessThanOrEqual(4)
  })
  test('the answer sentence names both zone averages and the honest tail', () => {
    const d = days([[6.2, 6], [6.3, 6], [6.4, 5], [6.5, 6], [6.6, 5], [6.9, 5], [7.0, 4], [7.1, 5], [7.2, 4]])
    const reading = readPattern({ pair: pair(), pattern: pattern(), days: d, events: [] }, 8)
    const s = saySentence(reading, pair(), d, 'proposed')
    expect(s).toContain('Amikor az ébredés ideje később volt')
    expect(s).toContain('**4,5**')
    expect(s).toContain('**5,6**')
    expect(s).toContain('9 napból még a véletlen is kihozhatja')
  })
  test('the rule sentence', () => {
    expect(ruleSentence(pair(), pattern().testPlan!)).toBe('Ha **az ébredés ideje** később van, aznap **az energia-szint** alacsonyabb.')
  })
  test('binary rule sentences are built from the day adjective', () => {
    const bin = (metricAKey: string) => pair({ metricAKey, metricALabel: 'x', metricAValueKind: 'binary',
      metricBKey: 'late-meal-hour', metricBLabel: 'utolsó étkezés ideje', metricBValueKind: 'clock_hour',
      expectedDirection: 'positive' })
    expect(ruleSentence(bin('weekend'), null))
      .toBe('A hétvégi napokon aznap az **utolsó étkezés ideje** később van.')
    expect(ruleSentence(bin('ritual-closed'), null))
      .toBe('A lezárt esti napokon aznap az **utolsó étkezés ideje** később van.')
    expect(ruleSentence(bin('people:anna'), null))
      .toBe('Az említéses napokon aznap az **utolsó étkezés ideje** később van.')
  })
  test('binary answer sentences name both day groups in plain Hungarian', () => {
    const p = pair({ metricAKey: 'weekend', metricALabel: 'hétvége', metricAValueKind: 'binary',
      verdict: 'live', r: 0.2, n: 8, expectedDirection: 'positive' })
    const d = days([[0, 5], [0, 6], [0, 5], [0, 6], [1, 7], [1, 8], [1, 7], [1, 6]])
    const reading = readPattern({ pair: p, pattern: null, days: d, events: [] }, 8)
    expect(saySentence(reading, p, d, null))
      .toMatch(/^A hétvégi napokon az energia-szint átlagosan \*\*7,0\*\* volt, a hétköznapi napokon \*\*5,5\*\*\./)
    const pp = { ...p, metricAKey: 'topic:uszas' }
    expect(saySentence(reading, pp, d, null)).toMatch(/^Az említéses napokon .* az említés nélküli napokon/)
  })
})
