// ============================================================
// Mezo · doseAdvice tesztek (Fuel Titanium S2, mezo-g2vl — manifeszt D3; a backend képesség
// külön ügy: mezo-nmzh).
//
// A tanácsadó a termékcímkéből napi mennyiséget, darabszámot és indokkal együtt elhelyezést ad.
// KÉT őszinte-null szerződés a lényeg: ismeretlen hatóanyagra NEM adunk adagot, és ismeretlen
// termékerősségnél NEM találunk ki darabszámot. Ez tájékoztatás, nem orvosi tanács.
// ============================================================
import { describe, expect, test } from 'vitest'
import { doseAdvice, SUPPLEMENT_REFERENCE } from '@/features/fuel/logic/doseAdvice'

describe('doseAdvice', () => {
  test('ismert hatóanyagnál megmondja, hány darab a napi mennyiség', () => {
    const advice = doseAdvice({ name: 'D3-vitamin 2000 NE', perUnit: 1000, unitForm: 'kapszula' })
    expect(advice).not.toBeNull()
    expect(advice!.substance).toBe('D3-vitamin')
    expect(advice!.unit).toBe('NE')
    expect(advice!.units).toBe(4)
    expect(advice!.zoneLabel).toBe('Ebéddel')
    expect(advice!.reason).toMatch(/zsír/i)
    expect(advice!.unknownProduct).toBe(false)
  })

  test('a termék saját erősségéből számol darabszámot', () => {
    expect(doseAdvice({ name: 'D3-vitamin', perUnit: 2000 })!.units).toBe(2)
  })

  test('a kiszerelésből megmondja, hány napra elég', () => {
    expect(doseAdvice({ name: 'D3-vitamin', perUnit: 2000, container: 60 })!.days).toBe(30)
  })

  test('kiszerelés nélkül nem mondja meg, hány napra elég', () => {
    expect(doseAdvice({ name: 'D3-vitamin', perUnit: 2000 })!.days).toBeNull()
  })

  // Őszinte-null: ismeretlen hatóanyagra NEM adunk adagot.
  test('ismeretlen hatóanyagra nem ad adagot', () => {
    expect(doseAdvice({ name: 'Valami ismeretlen por', perUnit: 500 })).toBeNull()
    expect(doseAdvice({ name: '', perUnit: 500 })).toBeNull()
  })

  // Őszinte-null: ismert hatóanyag, de ismeretlen termékerősség — nincs darabszám.
  test('ismeretlen termékerősségnél nincs darabszám, csak a napi tartomány', () => {
    const advice = doseAdvice({ name: 'D3-vitamin', perUnit: null })!
    expect(advice.unknownProduct).toBe(true)
    expect(advice.units).toBeNull()
    expect(advice.daily).toBeNull()
    expect(advice.days).toBeNull()
    expect(advice.range).toEqual([2000, 4000])
  })

  test('nulla vagy negatív termékerősség ugyanúgy ismeretlen', () => {
    expect(doseAdvice({ name: 'Magnézium', perUnit: 0 })!.unknownProduct).toBe(true)
    expect(doseAdvice({ name: 'Magnézium', perUnit: -5 })!.unknownProduct).toBe(true)
  })

  test('a saját napi mennyiség felülírja a referencia felső értékét', () => {
    const advice = doseAdvice({ name: 'Magnézium', perUnit: 200, dailyOverride: 200 })!
    expect(advice.target).toBe(200)
    expect(advice.units).toBe(1)
    expect(advice.matchesTarget).toBe(true)
  })

  test('kerekítésnél a matchesTarget hamis — a termék adagja dönt', () => {
    const advice = doseAdvice({ name: 'Kreatin', perUnit: 3, dailyOverride: 5 })!
    expect(advice.units).toBe(2)
    expect(advice.daily).toBe(6)
    expect(advice.matchesTarget).toBe(false)
  })

  test('a figyelmeztetés átjön, ahol a referencia ad ilyet', () => {
    expect(doseAdvice({ name: 'Cink-glükonát', perUnit: 15 })!.caution).toMatch(/éhgyomorra/i)
    expect(doseAdvice({ name: 'Kreatin-monohidrát', perUnit: 5 })!.caution).toBeNull()
  })

  test('minden referencia-sor hordoz zónát, feliratot és magyar indokot', () => {
    for (const row of SUPPLEMENT_REFERENCE) {
      expect(row.zone).toBeTruthy()
      expect(row.zoneLabel).toBeTruthy()
      expect(row.reason.length).toBeGreaterThan(10)
      expect(row.daily[0]).toBeLessThanOrEqual(row.daily[1])
    }
  })
})
