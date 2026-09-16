// ============================================================
// Mezo · mealNutrients — az étkezés NÉGY tárolt ténye, egy helyről (mezo-ya2wp)
//
// Korábban a részletek oldal saját, fájl-lokális másolata oldotta fel a rostot és a cukrot.
// A Mai lista vércukor-chipje UGYANEZT a két számot kéri, és a két felületnek ugyanazt a sávot
// KELL mutatnia — két másolat előbb-utóbb elcsúszik, és a chip mást mondana, mint a doboz,
// amit megnyit. Ezért a feloldás itt él, és mindkét hívó innen veszi.
//
// A rost a régi lapos `meal.fiberG`-ből is feloldható (a `nutrients` envelope előtti sorok).
// Ami hiányzik, az null marad — a hívó „—"-t ír, sosem 0-t (ház őszinte-null szabálya).
// ============================================================
import type { FuelMeal, Nutrients } from '@/data/types'

export function mealNutrients(meal: FuelMeal): Nutrients {
  const n: Nutrients | undefined = meal.nutrients
  return {
    fiberG: n?.fiberG ?? meal.fiberG ?? null,
    sugarG: n?.sugarG ?? null,
    saltG: n?.saltG ?? null,
    saturatedFatG: n?.saturatedFatG ?? null,
  }
}
