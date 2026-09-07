import { describe, expect, it } from 'vitest'
import {
  EFFORT_FACTORS, effortLevel, effortRated, effortSum, effortWeakest, effortXp,
  type EffortState,
} from '@/features/me/logic/habitEffort'

const eff = (over: Partial<EffortState> = {}): EffortState =>
  ({ time: null, body: null, mind: null, fit: null, ...over })

describe('habitEffort — a négy Fogg ability-faktor → XP (mezo-9k99)', () => {
  it('négy faktort kérdez, mindegyik három fokozattal', () => {
    expect(EFFORT_FACTORS).toHaveLength(4)
    expect(EFFORT_FACTORS.map((f) => f.key)).toEqual(['time', 'body', 'mind', 'fit'])
    for (const f of EFFORT_FACTORS) expect(f.opts).toHaveLength(3)
  })

  it('az XP a 6–14 szűk sávban él: csupa könnyű = 6, csupa nehéz = 14', () => {
    expect(effortXp(eff({ time: 0, body: 0, mind: 0, fit: 0 }))).toBe(6)
    expect(effortXp(eff({ time: 2, body: 2, mind: 2, fit: 2 }))).toBe(14)
    expect(effortXp(eff({ time: 1, body: 0, mind: 2, fit: 0 }))).toBe(9)
  })

  it('a jelöletlen faktor könnyűnek számít, nem hibának', () => {
    expect(effortSum(eff({ time: 2 }))).toBe(2)
    expect(effortXp(eff())).toBe(6)
  })

  it('effortRated csak akkor igaz, ha a felhasználó tényleg jelölt', () => {
    expect(effortRated(eff())).toBe(false)
    expect(effortRated(eff({ body: 0 }))).toBe(true)
  })

  it('a szint-címke a összegből jön (Könnyű / Közepes / Erős / Nehéz)', () => {
    expect(effortLevel(eff({ time: 0 })).label).toBe('Könnyű')
    expect(effortLevel(eff({ time: 2, body: 1 })).label).toBe('Közepes')
    expect(effortLevel(eff({ time: 2, body: 2, mind: 1 })).label).toBe('Erős')
    expect(effortLevel(eff({ time: 2, body: 2, mind: 2, fit: 1 })).label).toBe('Nehéz')
  })

  it('a „vedd kisebbre” tanács a legmagasabb fokozatú faktorra szól, és csak 2-es fokozatra', () => {
    expect(effortWeakest(eff({ time: 1, body: 1 }))).toBeNull()
    expect(effortWeakest(eff({ mind: 2, fit: 2 }))).toBe('mind') // az első a faktor-sorrendben
    const w = effortWeakest(eff({ fit: 2 }))
    expect(w).toBe('fit')
  })
})
