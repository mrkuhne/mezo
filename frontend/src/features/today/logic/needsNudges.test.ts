import { describe, expect, test } from 'vitest'
import { deriveNudges, NUDGE_COPY, toNudgeMessage } from '@/features/today/logic/needsNudges'
import { NEED_META, type NeedBand, type NeedKey, type NeedState } from '@/features/today/logic/needs'
import type { NudgeSeenEntry } from '@/features/today/logic/nudgeSeen'

const d = (s: string) => new Date(s)
const wake = '06:00'
const bed = '23:00'

/** A minimal, otherwise-irrelevant NeedState — only `key`/`band` drive `deriveNudges`. */
const state = (key: NeedKey, band: NeedBand, pct = 50): NeedState => ({
  key, band, pct,
  emoji: NEED_META[key].emoji, label: NEED_META[key].label, color: NEED_META[key].color,
  ratePerHour: 5, zeroAt: null, lastFill: null, todayFills: [],
})

const allGreen = (): NeedState[] =>
  (['energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend'] as NeedKey[])
    .map((k) => state(k, 'green', 80))

describe('deriveNudges', () => {
  test('piros ring, éjszakán/ébredésen kívül, még nem szerepelt → friss nudge', () => {
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'red', 20) : s))
    const out = deriveNudges(states, d('2026-08-17T15:00:00'), wake, bed, [])
    expect(out).toEqual([{ key: 'hidratacio', at: d('2026-08-17T15:00:00').toISOString(), fresh: true }])
  })

  test('kritikus ring is kivált nudge-ot', () => {
    const states = allGreen().map((s) => (s.key === 'energia' ? state('energia', 'critical', 5) : s))
    const out = deriveNudges(states, d('2026-08-17T15:00:00'), wake, bed, [])
    expect(out).toEqual([{ key: 'energia', at: d('2026-08-17T15:00:00').toISOString(), fresh: true }])
  })

  test('már megjelent ring → áthalad fresh:false-szal, nincs duplikáció', () => {
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'red', 20) : s))
    const shown: NudgeSeenEntry[] = [{ key: 'hidratacio', at: '2026-08-17T12:00:00.000Z' }]
    const out = deriveNudges(states, d('2026-08-17T15:00:00'), wake, bed, shown)
    expect(out).toEqual([{ key: 'hidratacio', at: '2026-08-17T12:00:00.000Z', fresh: false }])
  })

  test('sárga ring → nincs nudge', () => {
    const states = allGreen().map((s) => (s.key === 'mozgas' ? state('mozgas', 'yellow', 45) : s))
    expect(deriveNudges(states, d('2026-08-17T15:00:00'), wake, bed, [])).toEqual([])
  })

  test('zöld ringek → nincs nudge', () => {
    expect(deriveNudges(allGreen(), d('2026-08-17T15:00:00'), wake, bed, [])).toEqual([])
  })

  test('éjszaka (alvás-ablakban) → a piros ring elnyomva, még ha friss lenne is', () => {
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'critical', 5) : s))
    expect(deriveNudges(states, d('2026-08-17T02:00:00'), wake, bed, [])).toEqual([])
  })

  test('ébredés utáni fél óra → elnyomva (wake+1h ablak)', () => {
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'critical', 5) : s))
    expect(deriveNudges(states, d('2026-08-17T06:30:00'), wake, bed, [])).toEqual([])
  })

  test('ébredés + 59 perc → még elnyomva (a wake+1h ablak zárt határa)', () => {
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'critical', 5) : s))
    expect(deriveNudges(states, d('2026-08-17T06:59:00'), wake, bed, [])).toEqual([])
  })

  test('ébredés + 60 perc → már NEM elnyomott (a wake+1h ablak nyitott határa)', () => {
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'critical', 5) : s))
    const out = deriveNudges(states, d('2026-08-17T07:00:00'), wake, bed, [])
    expect(out).toEqual([{ key: 'hidratacio', at: d('2026-08-17T07:00:00').toISOString(), fresh: true }])
  })

  test('ébredés + 61 perc → már NEM elnyomott', () => {
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'critical', 5) : s))
    const out = deriveNudges(states, d('2026-08-17T07:01:00'), wake, bed, [])
    expect(out).toEqual([{ key: 'hidratacio', at: d('2026-08-17T07:01:00').toISOString(), fresh: true }])
  })

  test('ébredés utáni második óra → már NEM elnyomott', () => {
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'critical', 5) : s))
    const out = deriveNudges(states, d('2026-08-17T07:30:00'), wake, bed, [])
    expect(out).toEqual([{ key: 'hidratacio', at: d('2026-08-17T07:30:00').toISOString(), fresh: true }])
  })

  test('éjszaka a MÁR megjelentek (shown) is áthaladnak — csak az ÚJ nudge nyomódik el', () => {
    const shown: NudgeSeenEntry[] = [{ key: 'energia', at: '2026-08-17T12:00:00.000Z' }]
    const states = allGreen().map((s) => (s.key === 'hidratacio' ? state('hidratacio', 'critical', 5) : s))
    const out = deriveNudges(states, d('2026-08-17T02:00:00'), wake, bed, shown)
    expect(out).toEqual([{ key: 'energia', at: '2026-08-17T12:00:00.000Z', fresh: false }])
  })

  test('shown at szerint növekvő sorrendben halad át', () => {
    const shown: NudgeSeenEntry[] = [
      { key: 'rend', at: '2026-08-17T18:00:00.000Z' },
      { key: 'energia', at: '2026-08-17T09:00:00.000Z' },
    ]
    const out = deriveNudges(allGreen(), d('2026-08-17T20:00:00'), wake, bed, shown)
    expect(out.map((n) => n.key)).toEqual(['energia', 'rend'])
  })

  test('friss elemek a ringek saját (states) sorrendjében csatlakoznak', () => {
    const states = allGreen().map((s) =>
      (s.key === 'hidratacio' || s.key === 'rend') ? state(s.key, 'critical', 5) : s)
    const out = deriveNudges(states, d('2026-08-17T15:00:00'), wake, bed, [])
    expect(out.map((n) => n.key)).toEqual(['hidratacio', 'rend'])
    expect(out.every((n) => n.fresh)).toBe(true)
  })
})

describe('toNudgeMessage', () => {
  test('a NUDGE_COPY-t szó szerint viszi, HH:mm időbélyeggel, Életjel-figyelő metával', () => {
    const msg = toNudgeMessage({ key: 'hidratacio', at: '2026-08-17T15:07:00' })
    expect(msg).toEqual({
      id: 'nudge-hidratacio-2026-08-17T15:07:00',
      eyebrow: 'Életjel',
      time: '15:07',
      paragraphs: [NUDGE_COPY.hidratacio],
      refs: [],
      meta: 'Életjel-figyelő',
      source: 'eletjel',
    })
  })

  // mezo-b3pp.15 — a küszöb-nudge nem perzisztált AI-artifact: nincs sor-azonosítója, tehát
  // nem kaphat visszajelzés-chipet (a hamis affordancia, amit ez a szelet megöl — mezo-kr9v).
  test('nincs artifactId — a nudge nem votolható', () => {
    expect(toNudgeMessage({ key: 'hidratacio', at: '2026-08-17T15:07:00' }).artifactId).toBeUndefined()
  })

  test('minden NeedKey-hez van copy, és mind emoji-val kezdődik', () => {
    const keys: NeedKey[] = ['energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend']
    for (const k of keys) {
      expect(NUDGE_COPY[k].length).toBeGreaterThan(0)
      expect(toNudgeMessage({ key: k, at: '2026-08-17T10:00:00' }).paragraphs).toEqual([NUDGE_COPY[k]])
    }
  })

  test('toNudgeMessage stamps source: eletjel — the tab partition key (mezo-ho9k)', () => {
    expect(toNudgeMessage({ key: 'hidratacio', at: '2026-05-22T12:00:00.000Z' }).source).toBe('eletjel')
  })
})
