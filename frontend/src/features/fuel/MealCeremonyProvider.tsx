// ============================================================
// Mezo · MealCeremonyProvider — a kaja-ünneplés EGY gazdája (mezo-bqwyo).
//
// Miért provider, és nem a naplózó lap belseje? Mert a ceremónia BIRTOKOLJA a képernyőt
// (minta §„What a ceremony is"), a naplózás viszont négy helyről indulhat: a teljes lapos
// naplózó (`FuelLogNewPage`), a Mai ablakaiba nyíló szerkesztő, és a `LogFlowPage` overlay
// (recept, kamra-tétel, Életjel, Rutin). Mindegyik a mentés pillanatában BEZÁRJA magát —
// ha a ceremóniát bármelyikük hostolná, a saját bezárása vinné magával. A LevelUpProvider
// ugyanezt a mintát követi, és ez a lap ugyanúgy az AppLayoutban lakik.
//
// Őszinte-null: pontszám NÉLKÜL nem nyílik ceremónia (a csillag nem születhet a semmiből).
// Az étkezés attól még a napban van — a naplóban „folyamatban" áll, amíg az értékelés meg
// nem érkezik.
// ============================================================
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FuelMealCeremony } from '@/features/fuel/components/FuelMealCeremony'
import { scoreOutOfTen } from '@/features/fuel/logic/mealCeremony'

/** Amit a mentés visszaad, és amiből a ceremónia él. Minden mező a dróté — nincs becslés. */
export interface MealCelebration {
  mealId: string
  /** A ház 0..1-es étkezés-pontszáma; null → nincs ceremónia. */
  score: number | null
  label: string
  timeLabel: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  /** Van-e hova vinnie a „Részletek"-nek (bontás nélkül nincs pontlap). */
  hasBreakdown?: boolean
}

type Ctx = { celebrateMeal: (meal: MealCelebration) => void }
const MealCeremonyContext = createContext<Ctx | null>(null)

export function MealCeremonyProvider({ children, onDetails }: {
  children: ReactNode
  /** A mélyebb felület megnyitása (az étkezés pontlapja) — a shell adja, mert az útvonal az övé. */
  onDetails?: (mealId: string) => void
}) {
  const [celebration, setCelebration] = useState<MealCelebration | null>(null)
  const [target] = useState<Element | null>(() =>
    typeof document === 'undefined' ? null : (document.querySelector('.phone-screen') ?? document.body))

  const celebrateMeal = useCallback((meal: MealCelebration) => {
    if (meal.score == null) return
    setCelebration(meal)
  }, [])

  const value = useMemo(() => ({ celebrateMeal }), [celebrateMeal])

  return (
    <MealCeremonyContext.Provider value={value}>
      {children}
      {celebration && celebration.score != null && target && createPortal(
        <FuelMealCeremony
          scoreOutOfTen={scoreOutOfTen(celebration.score)}
          mealLabel={celebration.label}
          timeLabel={celebration.timeLabel}
          kcal={celebration.kcal}
          proteinG={celebration.proteinG}
          carbsG={celebration.carbsG}
          fatG={celebration.fatG}
          onClose={() => setCelebration(null)}
          onDetails={celebration.hasBreakdown && onDetails
            ? () => { const id = celebration.mealId; setCelebration(null); onDetails(id) }
            : undefined}
        />, target)}
    </MealCeremonyContext.Provider>
  )
}

/** A hívó oldala. Provider NÉLKÜL néma no-op: a naplózás sosem bukhat el azon, hogy a
 *  komponens egy teszt-harnessben provider nélkül áll. */
export function useMealCeremony(): Ctx {
  return useContext(MealCeremonyContext) ?? { celebrateMeal: () => {} }
}
