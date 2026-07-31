import { describe, expect, it } from 'vitest'
import type { SleepEntry } from '@/data/types'
import {
  averageBreakdown, deepFrontLoadPct, halfNightSplit, parseHypnogram,
  phaseBreakdown, phasePct, remByDuration,
} from '@/features/me/logic/sleepPhases'

const base: SleepEntry = {
  date: '2026-05-22', bedtime: '00:42', wakeup: '09:03', duration: 7.5,
  quality: 9, awakenings: 1, mealToSleep: 0, notes: null,
}
const night = (over: Partial<SleepEntry> = {}): SleepEntry => ({
  ...base, inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100, ...over,
})

describe('phaseBreakdown', () => {
  it('computes asleep as the sum of the three sleep stages, not from duration', () => {
    // duration says 7.5h = 450 min; the stages sum to 450 — but a mismatched duration
    // must not change the answer, because duration is rounded hours.
    const b = phaseBreakdown(night({ duration: 6.1 }))!
    expect(b.asleep).toBe(450)
    expect(b.inBed).toBe(502)
  })

  it('returns null when any of deep/light/rem is missing', () => {
    expect(phaseBreakdown(night({ deepMin: null }))).toBeNull()
    expect(phaseBreakdown(night({ lightMin: null }))).toBeNull()
    expect(phaseBreakdown(night({ remMin: null }))).toBeNull()
  })

  it('treats a missing awake as zero rather than as missing data', () => {
    const b = phaseBreakdown(night({ awakeMin: null }))!
    expect(b.awake).toBe(0)
    expect(b.inBed).toBe(450)
  })

  it('returns null on a plain manual row', () => {
    expect(phaseBreakdown(base)).toBeNull()
  })
})

describe('phasePct', () => {
  it('denominates on asleep, never on inBed', () => {
    const b = phaseBreakdown(night())!
    expect(Math.round(phasePct(b, 'deep'))).toBe(22)  // 100/450, not 100/502
    expect(Math.round(phasePct(b, 'rem'))).toBe(32)
  })
})

describe('averageBreakdown', () => {
  it('returns null below three qualifying nights', () => {
    expect(averageBreakdown([night(), night(), base], 14)).toBeNull()
  })

  it('averages only the qualifying nights and reports how many', () => {
    const r = averageBreakdown([base, night({ deepMin: 90 }), night(), night({ deepMin: 110 })], 14)!
    expect(r.nights).toBe(3)
    expect(r.avg.deep).toBe(100)
  })

  it('keeps the parts summing to the whole after rounding', () => {
    // Every per-field mean here lands OFF-integer, so Math.round actually bites and the two
    // possible implementations genuinely diverge:
    //   rebuilt from the rounded parts -> deep 301/3=100.33->100, light 604/3=201.33->201,
    //                                     rem 424/3=141.33->141  =>  asleep 442
    //   rounding the raw asleep mean    -> (439+442+448)/3 = 443.0 -> 443
    // Asserting 442 is what makes the rail's segments provably fill their total.
    const r = averageBreakdown([
      night({ deepMin: 99, lightMin: 200, remMin: 140, awakeMin: 52 }),  // asleep 439
      night({ deepMin: 100, lightMin: 201, remMin: 141, awakeMin: 52 }), // asleep 442
      night({ deepMin: 102, lightMin: 203, remMin: 143, awakeMin: 52 }), // asleep 448
    ], 14)!
    expect(r.avg.deep).toBe(100)
    expect(r.avg.light).toBe(201)
    expect(r.avg.rem).toBe(141)
    expect(r.avg.asleep).toBe(442) // NOT 443 — rebuilt from the rounded parts
    expect(r.avg.asleep).toBe(r.avg.deep + r.avg.light + r.avg.rem)
    expect(r.avg.inBed).toBe(r.avg.asleep + r.avg.awake)
  })

  it('honours the window', () => {
    const many = [night(), night(), night(), base, base]
    expect(averageBreakdown(many, 2)).toBeNull()
  })
})

describe('parseHypnogram', () => {
  it('returns the stage array', () => {
    expect(parseHypnogram(night({ hypnogram: { bucketMin: 15, stages: 'ALDR' } }))).toEqual(['A', 'L', 'D', 'R'])
  })

  it('returns null when absent or empty', () => {
    expect(parseHypnogram(night())).toBeNull()
    expect(parseHypnogram(night({ hypnogram: { bucketMin: 15, stages: '' } }))).toBeNull()
  })

  it('rejects an out-of-alphabet sequence rather than dropping the bad letters', () => {
    expect(parseHypnogram(night({ hypnogram: { bucketMin: 15, stages: 'ALDX' } }))).toBeNull()
  })
})

describe('halfNightSplit', () => {
  it('gives the middle bucket to the first half on an odd count', () => {
    const { first, second } = halfNightSplit(['D', 'D', 'D', 'R', 'R'], 15)
    expect(first.deep).toBe(45)
    expect(second.rem).toBe(30)
  })

  it('scales by the bucket width from the data', () => {
    const { first } = halfNightSplit(['D', 'D'], 30)
    expect(first.deep).toBe(30)
  })
})

describe('deepFrontLoadPct', () => {
  it('returns the share of deep buckets in the first half', () => {
    expect(deepFrontLoadPct(['D', 'D', 'D', 'R', 'D', 'R'])).toBe(75)
  })

  it('returns null below four deep buckets, where the number would be noise', () => {
    expect(deepFrontLoadPct(['D', 'D', 'D', 'R', 'R', 'R'])).toBeNull()
  })
})

describe('remByDuration', () => {
  const short = (rem: number) => night({ lightMin: 150, remMin: rem, deepMin: 90, awakeMin: 20 })
  const long = (rem: number) => night({ lightMin: 210, remMin: rem, deepMin: 105, awakeMin: 20 })

  it('returns null unless there are three nights on each side of 7h', () => {
    expect(remByDuration([short(100), short(105), short(110), long(150), long(155)])).toBeNull()
  })

  it('reports the REM gap between short and long nights', () => {
    const r = remByDuration([
      short(100), short(110), short(120), long(140), long(150), long(160),
    ])!
    expect(r.shortNights).toBe(3)
    expect(r.longNights).toBe(3)
    expect(r.shortAvg).toBe(110)
    expect(r.longAvg).toBe(150)
    expect(r.deltaMin).toBe(40)
  })

  it('puts a night of exactly 7.0h asleep on the long side', () => {
    // 90 + 200 + 130 = 420 min = exactly 7.0h. The contract is `>= SHORT_NIGHT_H`, so the
    // boundary night is LONG. Without a fixture sitting exactly on the line, flipping the
    // short-side test from `<` to `<=` would pass the whole rest of the suite.
    const exactly7h = () => night({ deepMin: 90, lightMin: 200, remMin: 130, awakeMin: 20 })
    const r = remByDuration([
      short(100), short(100), short(100), exactly7h(), exactly7h(), exactly7h(),
    ])!
    expect(r.shortNights).toBe(3)
    expect(r.longNights).toBe(3)
    expect(r.longAvg).toBe(130)  // the 420-min nights' REM — they are on the long side
    expect(r.shortAvg).toBe(100)
  })

  it('classifies by the computed asleep sum, not by the duration field', () => {
    // `duration` and the phase sum deliberately DISAGREE about which side of 7h each night is on,
    // so a duration-based implementation returns a wrong NON-NULL answer (the two averages swap)
    // rather than degenerating to null — that is what gives this test its teeth.
    // duration claims 6.0h (short), phases sum to 450 min = 7.5h -> genuinely LONG:
    const longByPhases = () => night({ duration: 6.0, deepMin: 100, lightMin: 206, remMin: 144, awakeMin: 20 })
    // duration claims 8.0h (long), phases sum to 360 min = 6.0h -> genuinely SHORT:
    const shortByPhases = () => night({ duration: 8.0, deepMin: 90, lightMin: 180, remMin: 90, awakeMin: 20 })
    const r = remByDuration([
      longByPhases(), longByPhases(), longByPhases(),
      shortByPhases(), shortByPhases(), shortByPhases(),
    ])!
    expect(r.shortNights).toBe(3)
    expect(r.longNights).toBe(3)
    // The short side must be the duration:8.0 group — the one a duration-based
    // implementation would have called "long", flipping these two averages.
    expect(r.shortAvg).toBe(90)
    expect(r.longAvg).toBe(144)
  })
})
