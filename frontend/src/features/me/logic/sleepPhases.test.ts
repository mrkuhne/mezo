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
    const r = averageBreakdown([night({ deepMin: 99 }), night({ deepMin: 100 }), night({ deepMin: 101 })], 14)!
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

  it('classifies by the computed asleep sum, not by the duration field', () => {
    // Every short() entry inherits duration: 7.5 from `night`/`base` (7.5h claimed), but its
    // phases sum to 150+100+90 = 340..360 min (< 7h) — well under what `duration` claims.
    // If classification ever read `entry.duration` instead of the computed asleep sum, all six
    // nights would land on the same side of the 7h line and this would fail.
    const r = remByDuration([
      short(100), short(110), short(120), long(140), long(150), long(160),
    ])!
    expect(r.shortNights).toBe(3)
    expect(r.longNights).toBe(3)
  })
})
