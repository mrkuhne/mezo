import { describe, expect, it } from 'vitest'
import { actualMinutes } from '@/features/train/logic/actualDuration'

describe('actualMinutes', () => {
  it('prefers elapsed wall clock when both stamps exist', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z',
      finishedAt: '2026-09-02T18:11:00Z',
      activeSeconds: 3000,
    })).toBe(71)
  })

  it('falls back to active seconds when the session was auto-closed', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z', finishedAt: null, activeSeconds: 3000,
    })).toBe(50)
  })

  it('returns null when nothing was measured', () => {
    expect(actualMinutes({ startedAt: null, finishedAt: null, activeSeconds: null })).toBeNull()
  })

  it('returns null for a zero-length measurement rather than showing 0 perc', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z', finishedAt: '2026-09-02T17:00:10Z', activeSeconds: null,
    })).toBeNull()
  })
})
