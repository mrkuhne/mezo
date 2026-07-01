import { expect, test } from 'vitest'
import {
  changeFromStart, progressPct, etaWeeks, isImprovement, movingAverage,
  periodWindow, sliceByPeriod, groupByWeek, dayRows, planTrajectory, daysBetween, isoMinusDays, fmtSigned,
} from '@/features/me/logic/weightStats'
import type { WeightEntry } from '@/data/types'
import type { GoalResponse } from '@/data/me/goalApi'

// 3 ISO weeks: May 11–17 (Mon 11), May 18–24 (Mon 18) ... using the mock spine tail.
const log: WeightEntry[] = [
  { date: '2026-05-11', value: 80.3 },
  { date: '2026-05-13', value: 79.5 },
  { date: '2026-05-15', value: 79.2 },
  { date: '2026-05-17', value: 79.0 },
  { date: '2026-05-19', value: 79.4 },
  { date: '2026-05-20', value: 78.9 },
  { date: '2026-05-21', value: 78.8 },
  { date: '2026-05-22', value: 78.6 },
]

test('date helpers', () => {
  expect(daysBetween('2026-05-11', '2026-05-18')).toBe(7)
  expect(isoMinusDays('2026-05-18', 7)).toBe('2026-05-11')
})

test('changeFromStart is signed latest−start; falls back to first log when no goal start', () => {
  expect(changeFromStart(log, 81.4)).toBe(-2.8)      // 78.6 − 81.4
  expect(changeFromStart(log, null)).toBe(-1.7)      // 78.6 − 80.3 (first entry)
  expect(changeFromStart([], 81.4)).toBeNull()
})

test('progressPct cut, bulk, clamp, null', () => {
  expect(progressPct(81.4, 78.6, 73.0)).toBe(33)     // cut: 2.8/8.4
  expect(progressPct(70, 72, 75)).toBe(40)           // bulk: 2/5
  expect(progressPct(81.4, 90, 73.0)).toBe(0)        // clamp low
  expect(progressPct(81.4, 78.6, null)).toBeNull()
  expect(progressPct(80, 79, 80)).toBeNull()         // start==target
})

test('etaWeeks valid only toward target', () => {
  expect(etaWeeks(78.6, 73.0, -0.5)).toBe(11)        // (73−78.6)/−0.5 = 11.2
  expect(etaWeeks(78.6, 73.0, 0.5)).toBeNull()       // moving away
  expect(etaWeeks(78.6, 73.0, 0)).toBeNull()
  expect(etaWeeks(78.6, null, -0.5)).toBeNull()
})

test('fmtSigned signs and rounds to 1dp', () => {
  expect(fmtSigned(-2.8)).toBe('−2.8')
  expect(fmtSigned(0.4)).toBe('+0.4')
  expect(fmtSigned(0)).toBe('0.0')
})

test('isImprovement is goal-direction aware', () => {
  expect(isImprovement(-0.4)).toBe(true)             // default cut: down good
  expect(isImprovement(0.4)).toBe(false)
  expect(isImprovement(0.4, 'bulk')).toBe(true)
})

test('movingAverage trailing window 3', () => {
  expect(movingAverage([1, 2, 3, 4], 3)).toEqual([1, 1.5, 2, 3])
})

test('periodWindow anchors to last entry; sliceByPeriod filters', () => {
  expect(periodWindow(log, '7d')).toEqual({ startIso: '2026-05-16', endIso: '2026-05-22' })
  expect(sliceByPeriod(log, '7d').map(e => e.date)).toEqual(['2026-05-17','2026-05-19','2026-05-20','2026-05-21','2026-05-22'])
  expect(periodWindow([], '7d')).toBeNull()
})

test('groupByWeek: Mon–Sun, newest first, avg/low/delta/direction', () => {
  const w = groupByWeek(log)
  expect(w.map(x => x.startIso)).toEqual(['2026-05-18', '2026-05-11'])  // newest first
  const newest = w[0]
  expect(newest.endIso).toBe('2026-05-24')
  expect(newest.count).toBe(4)
  expect(newest.low).toBe(78.6)
  expect(newest.direction).toBe('down')               // 79.4 → 78.6
  expect(newest.avg).toBeCloseTo(78.9, 1)              // (79.4+78.9+78.8+78.6)/4 = 78.925 (full precision)
  expect(w[1].delta).toBeNull()                        // oldest week has no prev
  expect(newest.delta).toBeCloseTo(-0.58, 1)           // 78.925 − 79.5 (full precision; display rounds to 1dp)
})

test('dayRows: newest first, dod across whole log', () => {
  const w = groupByWeek(log)[0]                        // May 18–24
  const rows = dayRows(log, w)
  expect(rows.map(r => r.iso)).toEqual(['2026-05-22','2026-05-21','2026-05-20','2026-05-19'])
  expect(rows[0].dod).toBe(-0.2)                        // 78.6 − 78.8
  expect(rows[3].dod).toBe(0.4)                         // 79.4 − 79.0 (prev week's last)
})

const goalResponse = {
  startDate: '2026-04-01', targetDate: '2026-08-15',
  startWeightKg: 81.4, targetWeightKg: 73.0,
} as unknown as GoalResponse

test('planTrajectory: linear interp, null when no goal/target', () => {
  expect(planTrajectory(null, '2026-05-01', '2026-05-31')).toBeNull()
  expect(planTrajectory({ ...goalResponse, targetWeightKg: null } as GoalResponse, '2026-05-01', '2026-05-31')).toBeNull()
  const pt = planTrajectory(goalResponse, '2026-05-01', '2026-05-31')!
  expect(pt.tolKg).toBe(1.0)
  expect(pt.plan[0].iso).toBe('2026-05-01')
  expect(pt.plan[pt.plan.length - 1].iso).toBe('2026-05-31')
  // monotonic decreasing toward target
  expect(pt.plan[0].kg).toBeGreaterThan(pt.plan[pt.plan.length - 1].kg)
})
