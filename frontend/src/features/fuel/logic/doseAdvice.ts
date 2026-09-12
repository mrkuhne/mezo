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

export const SUPPLEMENT_REFERENCE: SupplementReferenceRow[] = [
  {
    match: /d3|d-vitamin/, name: 'D3-vitamin', unit: 'NE', daily: [2000, 4000],
    zone: 'lunch', zoneLabel: 'Ebéddel',
    reason: 'Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.',
    caution: 'Tartósan magas adag előtt érdemes vérszintet méretni; K2-vel együtt szokás szedni.',
  },
  {
    match: /k2|mk-7/, name: 'K2-vitamin', unit: 'µg', daily: [100, 200],
    zone: 'lunch', zoneLabel: 'Ebéddel',
    reason: 'Zsírban oldódó — a D3-mal együtt, zsíros étkezéshez.',
    caution: 'Véralvadásgátló mellett csak orvosi egyeztetéssel.',
  },
  {
    match: /magn/, name: 'Magnézium', unit: 'mg', daily: [200, 400],
    zone: 'evening', zoneLabel: 'Vacsorával',
    reason: 'Este — GABA-moduláció és mélyalvás-támogatás, lefekvés előtt ~2 órával.',
    caution: 'Egyszerre sok magnézium emésztést zavarhat; ilyenkor oszd két részre.',
  },
  {
    match: /kreatin|creatine/, name: 'Kreatin', unit: 'g', daily: [3, 5],
    zone: 'wake', zoneLabel: 'Ébredés után',
    reason: 'Étkezéstől független — a napi konzisztencia számít, nem az időpont.',
    caution: null,
  },
  {
    match: /cink|zinc/, name: 'Cink', unit: 'mg', daily: [10, 15],
    zone: 'evening', zoneLabel: 'Vacsorával',
    reason: 'Vacsorához — távol a reggeli koffeintől és a többi ásványi anyagtól.',
    caution: 'Éhgyomorra gyakran émelygést okoz; hosszú távon nagy adag rézhiányt okozhat.',
  },
  {
    match: /omega|halolaj|krill/, name: 'Omega-3', unit: 'mg', daily: [1000, 2000],
    zone: 'lunch', zoneLabel: 'Ebéddel',
    reason: 'Zsírban oldódó — zsíros étkezéssel szívódik fel jól.',
    caution: null,
  },
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
  const needle = String(name ?? '').toLocaleLowerCase('hu-HU')
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
