// ============================================================
// Mezo · recipeSlotFace (Fuel Titanium S4, mezo-hygp)
// Egy recept „arca" az étkezési blokkja szerint: ház-hue + clay szimbólum + magyar felirat.
// A prototípus `slotBlock`-ja (companion-titanium/fuel-state.js) ház-tokenekre fordítva — a
// beégetett prototípus-hexeket NEM vesszük át, a paletta zárt.
//
// Egy helyen él, mert három felület olvassa (Konyha hub poszter, Receptek lista, recept
// részletlap) — egy negyedik másolat garantáltan elcsúszna. A választék SZÁNDÉKOSAN ugyanaz a
// négy blokk-hue, amit a Mai oldal étkezés-blokkjai viselnek (FuelMealDetailPage `BLOCK`).
// ============================================================
import type { RecipeCategory } from '@/data/types'
import type { ClayIconName } from '@/shared/ui/clay'

export interface RecipeSlotFace { color: string; icon: ClayIconName; label: string }

export const RECIPE_SLOT_FACE: Record<RecipeCategory, RecipeSlotFace> = {
  breakfast: { color: 'var(--amber)', icon: 'i-reggeli', label: 'Reggeli' },
  lunch: { color: 'var(--sage)', icon: 'i-ebed', label: 'Ebéd' },
  snack: { color: 'var(--lav)', icon: 'i-snack', label: 'Uzsonna' },
  dinner: { color: 'var(--sky)', icon: 'i-vacsora', label: 'Vacsora' },
}

/** A recept arca — ismeretlen kategóriára a semleges tányér-arc (nem találgatunk blokkot). */
export function recipeSlotFace(category: RecipeCategory | string | null | undefined): RecipeSlotFace {
  return RECIPE_SLOT_FACE[category as RecipeCategory]
    ?? { color: 'var(--sky)', icon: 'i-tanyer', label: 'Étkezés' }
}
