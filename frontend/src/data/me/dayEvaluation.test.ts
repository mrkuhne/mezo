// Day evaluation (mezo-jcpt.4) — the generated types re-exported/narrowed + the deterministic
// mock builder for the day page's `GET /api/me/day/{date}/evaluation` read. Four named scenarios
// (scored / in_progress / thin / future) per the slice brief; Task 10 renders its tests against
// these exact fixtures, so their shape is a contract, not a placeholder.
import { describe, expect, test } from 'vitest'
import {
  mockDayEvaluation, mockDayEvaluationDates, normalizeDayEvaluation,
} from '@/data/me/dayEvaluation'

describe('mockDayEvaluation — the four named scenarios', () => {
  test('scored: full score, six DONE dimensions, three narrative paragraphs, a +3 adjustment', () => {
    const d = mockDayEvaluation(mockDayEvaluationDates.scored)
    expect(d.date).toBe(mockDayEvaluationDates.scored)
    expect(d.state).toBe('scored')
    expect(d.score).toBe(78)
    expect(d.base).toBe(75)
    expect(d.adjustment).toEqual({ delta: 3, reason: expect.any(String) })
    expect(d.dimensions).toHaveLength(6)
    expect(d.dimensions.every((dim) => dim.status === 'DONE')).toBe(true)
    // config weights sum to 1.0 — no degraded dimension here, so nothing was renormalized away.
    const weightSum = d.dimensions.reduce((s, dim) => s + dim.weight, 0)
    expect(weightSum).toBeCloseTo(1.0, 5)
    expect(d.narrative).toHaveLength(3)
    expect(d.highlights?.length).toBeGreaterThan(0)
  })

  test('in_progress: exactly two DONE dimensions, no overall score (unclosed day)', () => {
    const d = mockDayEvaluation(mockDayEvaluationDates.inProgress)
    expect(d.state).toBe('in_progress')
    expect(d.score).toBeNull()
    expect(d.base).toBeNull()
    const done = d.dimensions.filter((dim) => dim.status === 'DONE')
    expect(done).toHaveLength(2)
    // degraded dimensions carry 0 weight; the DONE pair's weight is renormalized to sum to 1.
    const notDone = d.dimensions.filter((dim) => dim.status !== 'DONE')
    expect(notDone.every((dim) => dim.weight === 0)).toBe(true)
    expect(done.reduce((s, dim) => s + dim.weight, 0)).toBeCloseTo(1.0, 5)
  })

  test('thin: fewer than two DONE dimensions, so base/score stay null', () => {
    const d = mockDayEvaluation(mockDayEvaluationDates.thin)
    expect(d.state).toBe('thin')
    expect(d.score).toBeNull()
    expect(d.base).toBeNull()
    expect(d.dimensions.filter((dim) => dim.status === 'DONE')).toHaveLength(1)
  })

  test('future: no data at all, every dimension NO_DATA with 0 weight', () => {
    const d = mockDayEvaluation(mockDayEvaluationDates.future)
    expect(d.state).toBe('future')
    expect(d.score).toBeNull()
    expect(d.dimensions.every((dim) => dim.status === 'NO_DATA' && dim.weight === 0)).toBe(true)
    expect(d.narrative).toEqual([])
  })

  test('an unrecognized date falls back to the scored fixture, re-dated', () => {
    const d = mockDayEvaluation('2026-07-01')
    expect(d.date).toBe('2026-07-01')
    expect(d.state).toBe('scored')
  })
})

describe('normalizeDayEvaluation — fills in the generated type\'s optional arrays', () => {
  test('defaults missing narrative/highlights/context/facts/note to empty/null, never undefined', () => {
    const n = normalizeDayEvaluation({
      date: '2026-05-18',
      state: 'thin',
      dimensions: [{ id: 'nutrition', label: 'Táplálkozás', weight: 1, status: 'DONE', score: 50 }],
    })
    expect(n.narrative).toEqual([])
    expect(n.highlights).toEqual([])
    expect(n.context).toEqual([])
    expect(n.score).toBeNull()
    expect(n.base).toBeNull()
    expect(n.adjustment).toBeNull()
    expect(n.dimensions[0].facts).toEqual([])
    expect(n.dimensions[0].note).toBeNull()
  })

  test('passes through populated fields unchanged', () => {
    const raw = mockDayEvaluation(mockDayEvaluationDates.scored)
    const n = normalizeDayEvaluation(raw)
    expect(n.score).toBe(raw.score)
    expect(n.narrative).toEqual(raw.narrative)
    expect(n.dimensions).toHaveLength(6)
  })
})
