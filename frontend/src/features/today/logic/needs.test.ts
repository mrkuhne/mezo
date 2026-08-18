import { describe, expect, test } from 'vitest'
import {
  needsAt, bandOf, NEED_META, NEEDS_TUNING,
  type NeedKey, type NeedEvent, type NeedsInputs,
} from '@/features/today/logic/needs'

const d = (s: string) => new Date(s)
const wake = '06:45'
const bed = '23:15'

const empty = (): Record<NeedKey, NeedEvent[]> => ({
  energia: [], hidratacio: [], pihenes: [], mozgas: [], lelek: [], rend: [],
})

/** Build a NeedsInputs with only `key`'s events populated, every other ring empty. */
const inputsWith = (key: NeedKey, events: NeedEvent[]): NeedsInputs => ({
  wakeTime: wake,
  bedTime: bed,
  events: { ...empty(), [key]: events },
})

const ringAt = (now: Date, key: NeedKey, events: NeedEvent[]) => {
  const state = needsAt(now, inputsWith(key, events)).find((r) => r.key === key)
  if (!state) throw new Error(`missing ring ${key}`)
  return state
}

// ---------------------------------------------------------------------------
// 1. bandOf edges
// ---------------------------------------------------------------------------
describe('bandOf', () => {
  test('band thresholds are half-open at green/red/critical', () => {
    expect(bandOf(60)).toBe('green')
    expect(bandOf(59)).toBe('yellow')
    expect(bandOf(30)).toBe('yellow')
    expect(bandOf(29)).toBe('red')
    expect(bandOf(15)).toBe('red')
    expect(bandOf(14)).toBe('critical')
  })
})

// ---------------------------------------------------------------------------
// 2 & 3. additive refill + awake decay (hidratacio)
// ---------------------------------------------------------------------------
describe('additive refill + awake decay (hidratacio)', () => {
  test('sparse refills fully decay back to 0 → critical', () => {
    // yesterday 06:45 (value 0) -> ... -> today: 08:00 +12, 10:00 +12; now 12:00.
    // 06:45->08:00 stays 0, +12 -> 08:00->10:00: 12-(2h*6)=0 (clamped), +12 ->
    // 10:00->12:00: 12-12=0.
    const events: NeedEvent[] = [
      { at: d('2026-08-17T08:00:00'), kind: 'add', amount: 12, label: '+250 ml' },
      { at: d('2026-08-17T10:00:00'), kind: 'add', amount: 12, label: '+250 ml' },
    ]
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', events)
    expect(state.pct).toBe(0)
    expect(state.band).toBe('critical')
  })

  test('denser refills outpace decay → red', () => {
    // +12 at 10:00, 11:00, 11:30, now 12:00 ->
    // 10:00->11:00: 12-6=6; +12=18; 11:00->11:30: 18-3=15; +12=27; 11:30->12:00: 27-3=24.
    const events: NeedEvent[] = [
      { at: d('2026-08-17T10:00:00'), kind: 'add', amount: 12, label: '+250 ml' },
      { at: d('2026-08-17T11:00:00'), kind: 'add', amount: 12, label: '+250 ml' },
      { at: d('2026-08-17T11:30:00'), kind: 'add', amount: 12, label: '+250 ml' },
    ]
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', events)
    expect(state.pct).toBe(24)
    expect(state.band).toBe('red')
  })
})

// ---------------------------------------------------------------------------
// 4. clamp at 100 (energia)
// ---------------------------------------------------------------------------
describe('clamp at 100 (energia)', () => {
  test('stacked refills cap at 100 then resume decaying', () => {
    // 07:00 +40=40; ->07:10 40-1=39; +40=79; ->07:20 79-1=78; +40=118 -> cap 100; ->07:30 -1=99.
    const events: NeedEvent[] = [
      { at: d('2026-08-17T07:00:00'), kind: 'add', amount: 40, label: 'Reggeli' },
      { at: d('2026-08-17T07:10:00'), kind: 'add', amount: 40, label: 'Snack' },
      { at: d('2026-08-17T07:20:00'), kind: 'add', amount: 40, label: 'Snack' },
    ]
    const state = ringAt(d('2026-08-17T07:30:00'), 'energia', events)
    expect(state.pct).toBe(99)
  })
})

// ---------------------------------------------------------------------------
// 5. night slowdown (energia)
// ---------------------------------------------------------------------------
describe('night slowdown (energia)', () => {
  test('single evening refill fully decays overnight', () => {
    // yesterday 19:00 +40 -> 19:00->23:15 awake: 40-(4.25h*6)=14.5 ->
    // night 23:15->06:45 (7.5h*2=15) -> clamp 0. now today 06:45.
    const events: NeedEvent[] = [
      { at: d('2026-08-16T19:00:00'), kind: 'add', amount: 40, label: 'Vacsora' },
    ]
    const state = ringAt(d('2026-08-17T06:45:00'), 'energia', events)
    expect(state.pct).toBe(0)
  })

  test('later evening refill leaves residual after the night', () => {
    // yesterday 21:00 +40 -> 21:00->23:15: 40-13.5=26.5; night -15 -> 11.5; now today 06:45 -> 12.
    const events: NeedEvent[] = [
      { at: d('2026-08-16T21:00:00'), kind: 'add', amount: 40, label: 'Vacsora' },
    ]
    const state = ringAt(d('2026-08-17T06:45:00'), 'energia', events)
    expect(state.pct).toBe(12)
  })
})

// ---------------------------------------------------------------------------
// 6. sleepSet (pihenes)
// ---------------------------------------------------------------------------
describe('sleepSet (pihenes)', () => {
  const sleepEvent: NeedEvent = {
    at: d('2026-08-17T06:45:00'), kind: 'set', amount: 75, label: '6,0 óra alvás',
  }

  test('set-at-wake decays through the awake segment', () => {
    // 75 - (6h*5) = 45.
    const state = ringAt(d('2026-08-17T12:45:00'), 'pihenes', [sleepEvent])
    expect(state.pct).toBe(45)
    expect(state.band).toBe('yellow')
  })

  test('one minute before the wake-set event, no night decay applied', () => {
    // now is strictly before the set event: it has no effect yet, and pihenes
    // has nightRate 0, so the ring sits at its yesterday baseline of 0.
    const state = ringAt(d('2026-08-17T06:44:00'), 'pihenes', [sleepEvent])
    expect(state.pct).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 7. mozgas set-100 + flat 24/7 decay
// ---------------------------------------------------------------------------
describe('flat 24/7 decay (mozgas)', () => {
  const setEvent: NeedEvent = {
    at: d('2026-08-16T18:00:00'), kind: 'set', amount: 100, label: 'Edzés',
  }

  test('24h later: 100 - 48 = 52', () => {
    const state = ringAt(d('2026-08-17T18:00:00'), 'mozgas', [setEvent])
    expect(state.pct).toBe(52)
  })

  test('12h later: 100 - 24 = 76', () => {
    const state = ringAt(d('2026-08-17T06:00:00'), 'mozgas', [setEvent])
    expect(state.pct).toBe(76)
  })

  test('with a same-day activity refill on top', () => {
    // 100-(14h*2)=72 -> +25=97 -> 97-(4h*2)=89.
    const events: NeedEvent[] = [
      setEvent,
      { at: d('2026-08-17T08:00:00'), kind: 'add', amount: 25, label: 'Aktivitás' },
    ]
    const state = ringAt(d('2026-08-17T12:00:00'), 'mozgas', events)
    expect(state.pct).toBe(89)
  })
})

// ---------------------------------------------------------------------------
// 8. carry (lelek)
// ---------------------------------------------------------------------------
describe('carry (lelek)', () => {
  test('a good yesterday still needs today to act', () => {
    // yesterday: checkin +20 at 08:00,12:00,16:00,20:00; reflection +25 at 22:00.
    // 06:45->08:00 0; +20 -> 08:00->12:00: 20-20=0; +20 -> 12:00->16:00: 0; +20 ->
    // 16:00->20:00: 0; +20 -> 20:00->22:00: 20-10=10; +25=35 -> 22:00->23:15: 35-6.25=28.75 ->
    // night rate 0 -> wake x0.4 = 11.5 -> today 06:45->10:45 (4h*5=20) -> clamp 0.
    const events: NeedEvent[] = [
      { at: d('2026-08-16T08:00:00'), kind: 'add', amount: 20, label: 'Bejelentkezés' },
      { at: d('2026-08-16T12:00:00'), kind: 'add', amount: 20, label: 'Bejelentkezés' },
      { at: d('2026-08-16T16:00:00'), kind: 'add', amount: 20, label: 'Bejelentkezés' },
      { at: d('2026-08-16T20:00:00'), kind: 'add', amount: 20, label: 'Bejelentkezés' },
      { at: d('2026-08-16T22:00:00'), kind: 'add', amount: 25, label: 'Reflexió' },
    ]
    const state = ringAt(d('2026-08-17T10:45:00'), 'lelek', events)
    expect(state.pct).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 9. zeroAt forecast
// ---------------------------------------------------------------------------
describe('zeroAt forecast', () => {
  test('hidratacio: value 24, rate 6 -> zero in 4h, same day', () => {
    const events: NeedEvent[] = [
      { at: d('2026-08-17T10:00:00'), kind: 'add', amount: 12, label: '+250 ml' },
      { at: d('2026-08-17T11:00:00'), kind: 'add', amount: 12, label: '+250 ml' },
      { at: d('2026-08-17T11:30:00'), kind: 'add', amount: 12, label: '+250 ml' },
    ]
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', events)
    expect(state.pct).toBe(24)
    expect(state.zeroAt).toEqual(d('2026-08-17T16:00:00'))
  })

  test('pihenes: value 45, rate 5 -> zero in 9h, before bed so no cap needed', () => {
    const sleepEvent: NeedEvent = {
      at: d('2026-08-17T06:45:00'), kind: 'set', amount: 75, label: '6,0 óra alvás',
    }
    const state = ringAt(d('2026-08-17T12:45:00'), 'pihenes', [sleepEvent])
    expect(state.pct).toBe(45)
    expect(state.zeroAt).toEqual(d('2026-08-17T21:45:00'))
  })

  test('energia: crosses the bed boundary into the slower night rate', () => {
    // Pin the raw value to exactly 12 at 22:00 via a 'set' event at that instant,
    // isolating the forecast math from the history that produced it (already
    // covered by the night-slowdown cases above).
    // 22:00->23:15 (1.25h*6=7.5): 12-7.5=4.5. Night rate 2: 4.5/2=2.25h -> 01:30 next day.
    const events: NeedEvent[] = [
      { at: d('2026-08-17T22:00:00'), kind: 'set', amount: 12, label: 'test-pin' },
    ]
    const state = ringAt(d('2026-08-17T22:00:00'), 'energia', events)
    expect(state.pct).toBe(12)
    expect(state.zeroAt).not.toBeNull()
    expect(state.zeroAt?.getDate()).toBe(18)
    expect(state.zeroAt?.getHours()).toBe(1)
    expect(state.zeroAt?.getMinutes()).toBe(30)
  })

  test('lelek: survives the night unchanged (nightRate 0), then the wake carry factor applies', () => {
    // Pin value 20 at 20:00 (well before bed). 20:00->23:15 (3.25h*5=16.25): 20-16.25=3.75.
    // Night (nightRate 0): stays 3.75 until wake. Wake: 3.75*0.4=1.5. Awake rate 5: 1.5/5=0.3h=18min.
    const events: NeedEvent[] = [
      { at: d('2026-08-17T20:00:00'), kind: 'set', amount: 20, label: 'test-pin' },
    ]
    const state = ringAt(d('2026-08-17T20:00:00'), 'lelek', events)
    expect(state.pct).toBe(20)
    expect(state.zeroAt).toEqual(d('2026-08-18T07:03:00'))
  })

  test('a ring already at 0 has no zeroAt forecast', () => {
    const events: NeedEvent[] = [
      { at: d('2026-08-17T08:00:00'), kind: 'add', amount: 12, label: '+250 ml' },
      { at: d('2026-08-17T10:00:00'), kind: 'add', amount: 12, label: '+250 ml' },
    ]
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', events)
    expect(state.pct).toBe(0)
    expect(state.zeroAt).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 10. ratePerHour
// ---------------------------------------------------------------------------
describe('ratePerHour', () => {
  test('reflects the segment containing now, not a fixed constant', () => {
    const awake = ringAt(d('2026-08-17T12:00:00'), 'energia', [])
    expect(awake.ratePerHour).toBe(6)

    const night = ringAt(d('2026-08-17T02:00:00'), 'energia', [])
    expect(night.ratePerHour).toBe(2)

    const pihenesNight = ringAt(d('2026-08-17T02:00:00'), 'pihenes', [])
    expect(pihenesNight.ratePerHour).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 11. lastFill
// ---------------------------------------------------------------------------
describe('lastFill', () => {
  test('picks the latest event at or before now', () => {
    const events: NeedEvent[] = [
      { at: d('2026-08-17T08:00:00'), kind: 'add', amount: 12, label: 'Reggeli ital' },
      { at: d('2026-08-17T10:00:00'), kind: 'add', amount: 12, label: 'Délelőtti ital' },
    ]
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', events)
    expect(state.lastFill).toEqual({ at: d('2026-08-17T10:00:00'), label: 'Délelőtti ital' })
  })

  test('ignores events after now', () => {
    const events: NeedEvent[] = [
      { at: d('2026-08-17T08:00:00'), kind: 'add', amount: 12, label: 'Reggeli ital' },
      { at: d('2026-08-17T20:00:00'), kind: 'add', amount: 12, label: 'Esti ital (jövő)' },
    ]
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', events)
    expect(state.lastFill).toEqual({ at: d('2026-08-17T08:00:00'), label: 'Reggeli ital' })
  })

  test('no events -> null', () => {
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', [])
    expect(state.lastFill).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// todayFills — today's events (at >= today wake, <= now)
// ---------------------------------------------------------------------------
describe('todayFills', () => {
  test('excludes events before today\'s wake and after now, keeps chronological order', () => {
    const events: NeedEvent[] = [
      { at: d('2026-08-16T20:00:00'), kind: 'add', amount: 12, label: 'Tegnapi ital' },
      { at: d('2026-08-17T10:00:00'), kind: 'add', amount: 12, label: 'Második' },
      { at: d('2026-08-17T08:00:00'), kind: 'add', amount: 12, label: 'Első' },
      { at: d('2026-08-17T18:00:00'), kind: 'add', amount: 12, label: 'Jövőbeli' },
    ]
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', events)
    expect(state.todayFills).toEqual([
      { at: d('2026-08-17T08:00:00'), label: 'Első' },
      { at: d('2026-08-17T10:00:00'), label: 'Második' },
    ])
  })

  test('an event exactly at today\'s wake boundary counts as today', () => {
    const sleepEvent: NeedEvent = {
      at: d('2026-08-17T06:45:00'), kind: 'set', amount: 75, label: '6,0 óra alvás',
    }
    const state = ringAt(d('2026-08-17T12:45:00'), 'pihenes', [sleepEvent])
    expect(state.todayFills).toEqual([{ at: d('2026-08-17T06:45:00'), label: '6,0 óra alvás' }])
  })

  test('an event still in the future (relative to now) is excluded', () => {
    const sleepEvent: NeedEvent = {
      at: d('2026-08-17T06:45:00'), kind: 'set', amount: 75, label: '6,0 óra alvás',
    }
    const state = ringAt(d('2026-08-17T06:44:00'), 'pihenes', [sleepEvent])
    expect(state.todayFills).toEqual([])
  })

  test('no events -> empty array', () => {
    const state = ringAt(d('2026-08-17T12:00:00'), 'hidratacio', [])
    expect(state.todayFills).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 12. needsAt shape + NEED_META
// ---------------------------------------------------------------------------
describe('needsAt', () => {
  test('always returns all 6 rings in the fixed order', () => {
    const inputs: NeedsInputs = { wakeTime: wake, bedTime: bed, events: empty() }
    const states = needsAt(d('2026-08-17T12:00:00'), inputs)
    expect(states.map((s) => s.key)).toEqual([
      'energia', 'hidratacio', 'pihenes', 'mozgas', 'lelek', 'rend',
    ])
  })

  test('every ring carries its NEED_META emoji/label/color', () => {
    const inputs: NeedsInputs = { wakeTime: wake, bedTime: bed, events: empty() }
    const states = needsAt(d('2026-08-17T12:00:00'), inputs)
    for (const state of states) {
      const meta = NEED_META[state.key]
      expect(state.emoji).toBe(meta.emoji)
      expect(state.label).toBe(meta.label)
      expect(state.color).toBe(meta.color)
    }
  })

  test('NEED_META colors match the design spec', () => {
    expect(NEED_META.energia).toEqual({ emoji: '🍽️', label: 'Energia', color: 'var(--dv-sage)' })
    expect(NEED_META.hidratacio).toEqual({ emoji: '💧', label: 'Hidratáció', color: 'var(--dv-sky)' })
    expect(NEED_META.pihenes).toEqual({ emoji: '😴', label: 'Pihenés', color: 'var(--dv-lav)' })
    expect(NEED_META.mozgas).toEqual({ emoji: '💪', label: 'Mozgás', color: 'var(--dv-coral)' })
    expect(NEED_META.lelek).toEqual({ emoji: '💗', label: 'Lélek', color: 'var(--dv-rose)' })
    expect(NEED_META.rend).toEqual({ emoji: '⚡', label: 'Rend', color: 'var(--accent-base)' })
  })

  test('NEEDS_TUNING carries the exact spec values', () => {
    expect(NEEDS_TUNING.rings.energia).toEqual({ awakeRate: 6, nightRate: 2, wakeTransform: 'none' })
    expect(NEEDS_TUNING.rings.hidratacio).toEqual({ awakeRate: 6, nightRate: 2, wakeTransform: 'none' })
    expect(NEEDS_TUNING.rings.pihenes).toEqual({ awakeRate: 5, nightRate: 0, wakeTransform: 'sleepSet' })
    expect(NEEDS_TUNING.rings.mozgas).toEqual({ awakeRate: 2, nightRate: 2, wakeTransform: 'none' })
    expect(NEEDS_TUNING.rings.lelek).toEqual({ awakeRate: 5, nightRate: 0, wakeTransform: 'carry' })
    expect(NEEDS_TUNING.rings.rend).toEqual({ awakeRate: 4, nightRate: 0, wakeTransform: 'carry' })
    expect(NEEDS_TUNING.carryFactor).toBe(0.4)
    expect(NEEDS_TUNING.bands).toEqual({ green: 60, red: 30, critical: 15 })
    expect(NEEDS_TUNING.refill).toEqual({
      mainMeal: 40, snack: 15, waterGlassMl: 250, waterGlass: 12, activity: 25,
      checkin: 20, intention: 15, reflection: 25, habitTick: 12,
    })
  })
})
