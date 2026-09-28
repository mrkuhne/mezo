import { describe, expect, it } from 'vitest'
import type { Challenge } from '@/data/types'
import { briefingDecisions, durationRange, preTicked } from './briefing'

const ch = (id: string, over: Partial<Challenge> = {}): Challenge => ({
  id, type: 'PR', typeLabel: 'PR-attempt', exerciseId: 'ex1', target: '100 kg × 8',
  confidence: 0.8, risk: 'low', why: '', refs: [], glory: '', ...over,
})

describe('durationRange', () => {
  it('spreads ±10% and rounds to 5 minutes', () => {
    expect(durationRange(78)).toEqual([70, 85])
  })
  it('keeps at least a 5-minute band', () => {
    expect(durationRange(20)).toEqual([20, 25])
  })
  it('returns null for an unknown/zero estimate', () => {
    expect(durationRange(0)).toBeNull()
  })
})

describe('preTicked', () => {
  it('ticks low-risk ≥70% challenges and the overload one, not the rest', () => {
    const list = [
      ch('a', { confidence: 0.72 }),
      ch('o', { type: 'overload', confidence: null }),
      ch('b', { confidence: 0.68 }),
      ch('c', { confidence: null }),
      ch('d', { confidence: 0.9, risk: 'mid' }),
    ]
    expect(preTicked(list, {})).toEqual({ a: true, o: true, b: false, c: false, d: false })
  })
  it('keeps an already-accepted challenge ticked whatever its confidence', () => {
    expect(preTicked([ch('x', { confidence: 0.5 })], { x: true })).toEqual({ x: true })
  })
})

describe('briefingDecisions', () => {
  it('accepts newly ticked offers and undoes unticked accepted ones', () => {
    const list = [
      ch('new'),
      ch('keep', { status: 'accepted' }),
      ch('drop', { status: 'accepted' }),
      ch('idle'),
      ch('done', { status: 'hit' }),
    ]
    const accepted = { keep: true, drop: true, done: true }
    const ticked = { new: true, keep: true, drop: false, idle: false, done: false }
    expect(briefingDecisions(list, ticked, accepted)).toEqual({ accept: ['new'], undo: ['drop'] })
  })
})
