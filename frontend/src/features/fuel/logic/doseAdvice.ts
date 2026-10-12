// ============================================================
// Mezo · doseAdvice — az adag-tanácsadó (Fuel Titanium S2, mezo-g2vl; manifeszt D3).
//
// Egy termékcímkéből tervet csinál: mennyi naponta, ennyi darab EBBŐL a termékből, mikor, miért,
// és meddig tart ki a doboz. A referencia-tábla és a logika a jóváhagyott prototípusból van
// portolva 1:1: docs/design_2.0/prototypes/companion-titanium/fuel-state.js
// `SUPPLEMENT_REFERENCE` (:66) + `doseAdvice` (:76).
//
// A tábla tükrözi, amit a produkció ma tud (a `PlacementRules` zónája + magyar indoka), PLUSZ
// azt, ami még nincs meg: hatóanyagonkénti ajánlott napi sáv. A backend képesség külön ügy
// (mezo-nmzh) — ez a szelet a jóváhagyott felületet szállítja, és őszinte-null marad mindenhol,
// ahol a termék ténye hiányzik.
//
// KÉT őszinte-null szerződés, amit soha nem sértünk meg:
//   1. ismeretlen hatóanyagra NEM adunk adagot — `null` a válasz, nem találgatás,
//   2. ismert hatóanyag + ismeretlen termékerősség esetén NINCS darabszám és nincs napi érték —
//      csak az ajánlott sáv, `unknownProduct: true` jelzéssel.
//
// Ez tájékoztatás, nem orvosi tanács: a `caution` mező ott van, ahol a referencia ad ilyet, és a
// felület köteles megjeleníteni.
// ============================================================
import type { StackZoneKey } from '@/data/types'
import { m } from '@/shared/i18n'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'

/** An amount as the screen prints it: whole numbers grouped („4 000"), fractions with the language's decimal mark. */
export const fmtAmount = (v: number): string => (Number.isInteger(v) ? fmtGrouped(v) : fmtNum(v, 2))

export interface SupplementReferenceRow {
  /** Névtöredék-illesztés a termék vagy hatóanyag nevére (kisbetűs, HU-lokalizált bemenetre). */
  match: RegExp
  name: string
  unit: string
  /** Ajánlott napi sáv: [alsó, felső]. */
  daily: [number, number]
  zone: StackZoneKey
  zoneLabel: string
  reason: string
  caution: string | null
}

/** The fixed half of a reference row; its words (`name`, `unit`, `zoneLabel`, `reason`, `caution`) live in the catalog
 *  (`fuelKieg.ref`) and are read when the row is READ (getters), so the table follows a language switch. */
const row = (
  key: keyof ReturnType<typeof m>['fuelKieg']['ref'], match: RegExp, daily: [number, number], zone: StackZoneKey,
): SupplementReferenceRow => ({
  match, daily, zone,
  get name() { return m().fuelKieg.ref[key].name },
  get unit() { return m().fuelKieg.ref[key].unit },
  get zoneLabel() { return m().fuelKieg.ref[key].zoneLabel },
  get reason() { return m().fuelKieg.ref[key].reason },
  get caution() { return (m().fuelKieg.ref[key] as { caution?: string }).caution ?? null },
})

export const SUPPLEMENT_REFERENCE: SupplementReferenceRow[] = [
  row('d3', /d3|d-vitamin/, [2000, 4000], 'lunch'),
  row('k2', /k2|mk-7/, [100, 200], 'lunch'),
  row('magnesium', /magn/, [200, 400], 'evening'),
  row('creatine', /kreatin|creatine/, [3, 5], 'wake'),
  row('zinc', /cink|zinc/, [10, 15], 'evening'),
  row('omega', /omega|halolaj|krill/, [1000, 2000], 'lunch'),
]

export interface DoseAdvice {
  substance: string
  unit: string
  /** Az ajánlott napi sáv — ez akkor is megvan, ha a termékről semmit nem tudunk. */
  range: [number, number]
  /** A megcélzott napi mennyiség (saját felülírás, különben a sáv felső értéke). */
  target: number
  /** Hány egység EBBŐL a termékből — null, ha nem tudjuk, mennyi van egy egységben. */
  units: number | null
  /** A darabszámból tényleg kijövő napi mennyiség — null termékerősség nélkül. */
  daily: number | null
  unitForm: string
  /** Hány napra elég a doboz — null kiszerelés vagy darabszám nélkül. */
  days: number | null
  zone: StackZoneKey
  zoneLabel: string
  reason: string
  caution: string | null
  /** Hamis, ha a kerekítés miatt a napi mennyiség eltér a megcélzottól. */
  matchesTarget: boolean
  /** Igaz: ismerjük a hatóanyagot, de a termék erősségét nem. */
  unknownProduct: boolean
}

export interface DoseAdviceInput {
  name: string
  perUnit: number | null
  unitForm?: string
  container?: number | null
  dailyOverride?: number | null
}

/**
 * Tervet ad egy termékcímkéből — vagy `null`-t, ha a hatóanyagot nem ismerjük. Tiszta függvény:
 * nincs hálózat, nincs környezeti idő, nincs állapot.
 */
export function doseAdvice(input: DoseAdviceInput): DoseAdvice | null {
  const { name, perUnit, unitForm = 'kapszula', container = null, dailyOverride = null } = input
  const needle = String(name ?? '').toLowerCase()
  if (!needle.trim()) return null
  const reference = SUPPLEMENT_REFERENCE.find(row => row.match.test(needle))
  // 1. őszinte-null: ismeretlen hatóanyagra nem találunk ki adagot.
  if (!reference) return null

  const target = Number.isFinite(dailyOverride) && (dailyOverride as number) > 0
    ? dailyOverride as number
    : reference.daily[1]

  const base = {
    substance: reference.name,
    unit: reference.unit,
    range: reference.daily,
    target,
    unitForm,
    zone: reference.zone,
    zoneLabel: reference.zoneLabel,
    reason: reference.reason,
    caution: reference.caution,
  }

  // 2. őszinte-null: termékerősség nélkül nincs darabszám és nincs napi érték — csak a sáv.
  if (!Number.isFinite(perUnit) || (perUnit as number) <= 0) {
    return { ...base, units: null, daily: null, days: null, matchesTarget: false, unknownProduct: true }
  }

  const strength = perUnit as number
  const units = Math.max(1, Math.round(target / strength))
  const daily = Math.round(units * strength * 100) / 100
  return {
    ...base,
    units,
    daily,
    days: Number.isFinite(container) && (container as number) > 0
      ? Math.floor((container as number) / units)
      : null,
    matchesTarget: Math.abs(daily - target) <= strength * 0.01,
    unknownProduct: false,
  }
}
