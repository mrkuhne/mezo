// ============================================================
// Mezo · usualMeals — a „szokásosak" rangsora (Fuel Titanium S1c, mezo-33k6;
// fagyasztott manifeszt A7). Jóváhagyott referencia: a prototípus
// docs/design_2.0/prototypes/companion-titanium/food-state.js `usualMeals` (:49) — ott
// beégetett minta-sorok, itt a user SAJÁT előzményéből számolt rangsor.
//
// A rendezés szerződése (FoodNoms-minta, owner-döntés): napszak ELŐSZÖR — ilyenkor ehhez
// nyúlsz —, azon belül gyakoriság, holtversenynél frissesség.
//
// Tiszta logika: nincs React, nincs ambiens idő (a hívó adja a `nowHHmm`-et), nincs
// `@/data/*` hook-import. A napszak→ablak leképezést NEM itt találjuk ki: a produkció saját
// `defaultMealSlot` szabálya adja, a logolt étkezés ablakát pedig a `mealSlotKey`.
//
// ŐSZINTE-NULL: előzmény nélkül ÜRES lista (nem kitalált javaslat); ismeretlen kalóriájú
// előzmény `kcal: null` (nem fabrikált szám); névtelen vagy ismeretlen napszakú előzmény
// egyáltalán nem lesz szokásos.
// ============================================================
import type { FuelMeal, MealSlot } from '@/data/types'
import { mealSlotKey } from '@/features/fuel/logic/buildDayPlan'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { defaultMealSlot } from '@/features/fuel/logic/defaultMealSlot'
import { toMin } from '@/data/fuel/fuelConfig'

export interface UsualMeal {
  /** Stabil sor-identitás: ablak + normalizált név. A React-kulcs és az „egy sor egy étkezés". */
  key: string
  title: string
  slot: MealSlot
  /** A legutóbbi előfordulás energiája — null, ha a forrás nem adott értéket. */
  kcal: number | null
  lastLoggedIso: string
  count: number
}

/** Alapértelmezett sorhossz: ennyi fér a módváltós logoló egy képernyőjére. */
const DEFAULT_LIMIT = 6

/**
 * A `nowHHmm` wall-clock ablaka a produkció SAJÁT szabályával (`defaultMealSlot`) — így a
 * szokásosak rangsora ugyanazt a napszak-határt használja, amit egy kontextus nélküli logolás
 * alap-slotja. Új küszöböt szándékosan nem vezetünk be.
 */
function slotForTime(nowHHmm: string): MealSlot {
  const min = toMin(nowHHmm)
  const d = new Date(2026, 0, 1, Math.floor(min / 60), min % 60)
  return defaultMealSlot(d)
}

/** Összevonási kulcs: kisbetűs, összehúzott szóközű név — „Zabkása  gyümölccsel" == a másik. */
const normTitle = (title: string) => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('hu-HU')

/** A wire legálisan hozhat érték nélküli kcal-t (lásd keretHero.ts `meal?.kcal ?? … ?? null`). */
const kcalOf = (m: FuelMeal): number | null => (typeof m.kcal === 'number' && Number.isFinite(m.kcal) ? m.kcal : null)

/**
 * A user előzményeiből rangsorolt szokásosak. `nowHHmm` a hívó órája (tiszta függvény marad),
 * `limit` a sorok maximuma.
 */
export function rankUsualMeals(meals: FuelMeal[], nowHHmm: string, limit: number = DEFAULT_LIMIT): UsualMeal[] {
  const bucket = slotForTime(nowHHmm)
  const byKey = new Map<string, UsualMeal>()

  for (const m of meals) {
    const slot = mealSlotKey(m)
    // Ismeretlen napszak vagy név nélküli előzmény: kimarad. Inkább rövidebb a lista, mint hogy
    // egy kitalált ablakot vagy nevet kínáljunk.
    if (!slot) continue
    const title = mealDisplayName(m)
    if (!title) continue
    const key = `${slot}:${normTitle(title)}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, { key, title, slot, kcal: kcalOf(m), lastLoggedIso: m.loggedAt, count: 1 })
      continue
    }
    prev.count += 1
    // A sor a LEGUTÓBBI előfordulást viszi (neve, ideje, energiája) — az a felismerhető.
    if ((m.loggedAt ?? '') > (prev.lastLoggedIso ?? '')) {
      prev.title = title
      prev.lastLoggedIso = m.loggedAt
      prev.kcal = kcalOf(m)
    }
  }

  return [...byKey.values()]
    .sort((a, b) => {
      const aFits = a.slot === bucket ? 0 : 1
      const bFits = b.slot === bucket ? 0 : 1
      if (aFits !== bFits) return aFits - bFits
      if (a.count !== b.count) return b.count - a.count
      return (b.lastLoggedIso ?? '').localeCompare(a.lastLoggedIso ?? '')
    })
    .slice(0, Math.max(0, limit))
}
