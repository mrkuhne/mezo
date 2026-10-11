import { describe, expect, it } from 'vitest'
import type { Challenge } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import { medalPreviousShare } from '@/features/train/logic/medalLabels'
import { prevDoneByName, prevDoneLine, questRows, setBand } from '@/features/train/logic/workoutReviewDerive'

describe('medalPreviousShare · where the old record stood inside the new one', () => {
  const m = (over: Partial<Medal>): Medal => ({ type: 'WEIGHT', tier: 'RECORD', exerciseName: 'X', value: 12.5, unit: 'KG', date: '2026-09-24', ...over } as Medal)
  it('is previous / value in %', () => {
    expect(medalPreviousShare(m({ previousValue: 10 }))).toBe(80)
  })
  it('is null without a previous value, for a target medal, or for non-positive numbers', () => {
    expect(medalPreviousShare(m({}))).toBeNull()
    expect(medalPreviousShare(m({ previousValue: 10, tier: 'TARGET' }))).toBeNull()
    expect(medalPreviousShare(m({ previousValue: 0 }))).toBeNull()
    expect(medalPreviousShare(m({ previousValue: 10, value: 0 }))).toBeNull()
  })
})

describe('the review\'s dashed line · the previous instance\'s done sets', () => {
  it('maps the reference exercises by name', () => {
    expect(prevDoneByName([{ name: 'A', doneSets: 4 }, { name: 'B', doneSets: 0 }])).toEqual({ A: 4, B: 0 })
    expect(prevDoneByName(undefined)).toEqual({})
  })
  it('is a 0–1 share of TODAY\'s plan, capped at the rim; null when there is nothing to draw', () => {
    expect(prevDoneLine(2, 4)).toBe(0.5)
    expect(prevDoneLine(5, 4)).toBe(1)
    expect(prevDoneLine(undefined, 4)).toBeNull()
    expect(prevDoneLine(2, 0)).toBeNull()
  })
})

describe('setBand · the word for a logged set', () => {
  const range = { repMin: 8, repMax: 10 }
  it('célsávban / cél alatt / cél fölött from the rep range', () => {
    expect(setBand(range, { reps: 8 })).toEqual({ key: 'in', word: 'célsávban' })
    expect(setBand(range, { reps: 7 })).toEqual({ key: 'below', word: 'cél alatt' })
    expect(setBand(range, { reps: 11 })).toEqual({ key: 'above', word: 'cél fölött' })
  })
  it('a warm-up is its own word, and a missing range gives nothing', () => {
    expect(setBand(range, { reps: 3, warmup: true })).toEqual({ key: 'warmup', word: 'bemelegítő' })
    expect(setBand({ repMin: undefined, repMax: 10 }, { reps: 8 })).toBeNull()
  })
})

describe('questRows · every quest of the day with its outcome', () => {
  const c = (id: string, status: Challenge['status'], over: Partial<Challenge> = {}): Challenge => ({
    id, type: 'pr', typeLabel: '🏆 PR-kísérlet', exerciseId: 'e', exercise: 'Evezés', target: '75 kg × 8', risk: 'low', why: '', refs: [], glory: '', status, ...over,
  } as Challenge)
  it('names the four states; a quest never taken reads „nem vállaltad"', () => {
    const { rows, hit, rest } = questRows([c('1', 'hit', { outcome: 'megvolt' }), c('2', 'miss'), c('3', 'inconclusive'), c('4', 'dismissed'), c('5', 'proposed'), c('6', undefined)])
    expect(rows.map((r) => [r.state, r.label, r.tone])).toEqual([
      ['hit', 'megvan', 'ok'], ['miss', 'nem jött össze', 'q'], ['inconclusive', 'nem értékelhető', 'q'],
      ['skipped', 'nem vállaltad', 'q'], ['skipped', 'nem vállaltad', 'q'], ['skipped', 'nem vállaltad', 'q'],
    ])
    expect([hit, rest]).toEqual([1, 5])
  })
  it('strips pictographs from the type, and prefers the server\'s outcome sentence over the target', () => {
    const { rows } = questRows([c('1', 'hit', { outcome: '12,5 kg × 8 az első szetten' }), c('2', 'miss')])
    expect(rows[0]).toMatchObject({ id: '1', typeLabel: 'PR-kísérlet', exercise: 'Evezés', detail: '12,5 kg × 8 az első szetten' })
    expect(rows[1].detail).toBe('75 kg × 8')
  })
  it('an accepted quest that was never judged is not a miss — it is „nem értékelhető"', () => {
    expect(questRows([c('1', 'accepted')]).rows[0].state).toBe('inconclusive')
  })
})
