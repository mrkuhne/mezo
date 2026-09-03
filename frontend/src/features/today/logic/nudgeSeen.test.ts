import { beforeEach, describe, expect, test } from 'vitest'
import { markNudgeShown, shownNudges } from '@/features/today/logic/nudgeSeen'
import { setCurrentUserId } from '@/shared/lib/userScope'

beforeEach(() => localStorage.clear())

describe('nudgeSeen', () => {
  test('nincs mentett bejegyzés → üres tömb', () => {
    expect(shownNudges('2026-08-17')).toEqual([])
  })

  test('roundtrip: markNudgeShown → shownNudges ugyanazt a bejegyzést adja vissza', () => {
    markNudgeShown('2026-08-17', 'hidratacio', '2026-08-17T15:00:00.000Z')
    expect(shownNudges('2026-08-17')).toEqual([
      { key: 'hidratacio', at: '2026-08-17T15:00:00.000Z' },
    ])
  })

  test('append-only: több markNudgeShown hívás felhalmozódik', () => {
    markNudgeShown('2026-08-17', 'hidratacio', '2026-08-17T15:00:00.000Z')
    markNudgeShown('2026-08-17', 'energia', '2026-08-17T18:00:00.000Z')
    expect(shownNudges('2026-08-17')).toEqual([
      { key: 'hidratacio', at: '2026-08-17T15:00:00.000Z' },
      { key: 'energia', at: '2026-08-17T18:00:00.000Z' },
    ])
  })

  test('másik napra írt bejegyzés nem szivárog át — a kulcs DÁTUMRA kulcsolt', () => {
    markNudgeShown('2026-08-17', 'hidratacio', '2026-08-17T15:00:00.000Z')
    expect(shownNudges('2026-08-18')).toEqual([])
  })

  test('sérült JSON a kulcs alatt → üres tömb, sosem dob', () => {
    localStorage.setItem('mezo.anon.needsnudge.2026-08-17', '{not json')
    expect(shownNudges('2026-08-17')).toEqual([])
  })

  test('nem tömb JSON a kulcs alatt → üres tömb', () => {
    localStorage.setItem('mezo.anon.needsnudge.2026-08-17', '{"foo":"bar"}')
    expect(shownNudges('2026-08-17')).toEqual([])
  })

  test('a nudge-napló user-névterezett', () => {
    setCurrentUserId('u1')
    markNudgeShown('2026-08-17', 'hidratacio', '2026-08-17T15:00:00.000Z')
    setCurrentUserId('u2')
    expect(shownNudges('2026-08-17')).toEqual([])
  })
})
