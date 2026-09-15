// ============================================================
// Mezo · FuelMealScorePage — az étkezés AI értékelése SAJÁT oldalon
// (Fuel Titanium S1b, mezo-33k6; fagyasztott manifeszt A11).
//
// EZ NEM EGY ÚJ PONTOZÓ FELÜLET. Ugyanazt a `meal.breakdown` envelope-ot rendereli, amit a
// MealScoreSheet — csak a bőr és a navigáció más (sheet → oldal + per-dimenzió üvegdoboz).
// Ezért:
//   • a súly/pont/Σ aritmetika a KÖZÖS `logic/scoreArithmetic.ts`-ből jön (a volt
//     `totalOf`/`weight*100` JSX-ből kiemelve), nem egy másolt szorzásból,
//   • a dimenzió arca (hue-tónus + clay ikon) a KÖZÖS `logic/dimensionFace.ts`-ből,
//   • a dimenzió saját grafikonjai a MEGLÉVŐ panelek (MacroPanel / MicroPanel / NovaPanel /
//     ContextPanel / MealTimingStrip) — az üvegdoboz a TARTÓJUK, nem egy második rajzuk,
//   • a coach-interplay a sheetből szó szerint átvéve: a `summary` a verdictből, különben az
//     envelope-ból; a `useFeedback` FELTÉTEL NÉLKÜL mountol (a hook-sorrend nem függhet az
//     adattól), a chipek csak akkor jelennek meg, ha van miről szavazni.
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/
// fuel-dashboard.js `scorePage` (:202), `dimTile` (:183), `dimGlassHtml` (:188);
// CSS: fuel-pages.css `AI score page — centered hero, colorful dimension mosaic` (:344)
// és `Glass box: one dimension` (:370).
//
// Őszinte-null + szégyenmentesség: egy adat nélküli (súly 0) dimenzió „még tanulom", nem
// nulla pont; a hero száma mellől a „/10" elmarad (owner); és egy alacsony pontszám sosem
// kudarc-hangon szólal meg.
// ============================================================
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFeedback, useFuelDay, useMealCoachFor } from '@/data/hooks'
import { huInt } from '@/shared/lib/huNum'
import { breakdownTotalPct } from '@/features/fuel/logic/scoreArithmetic'
import { hhmmFromLoggedAt } from '@/features/fuel/logic/buildDayPlan'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { FuelScoreSurface } from '@/features/fuel/components/FuelScoreSurface'

export function FuelMealScorePage() {
  const { id } = useParams<{ id: string }>()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const day = search.get('d')
  const { fuel } = useFuelDay(day ?? undefined)
  const meal = fuel.meals.find(m => m.id === id) ?? null

  // A coach verdict on demand (mezo-mr4n) — a determinisztikus test alatta azonnal renderel.
  const { verdict, isPending: coachPending } = useMealCoachFor(meal?.id ?? null)
  const b = meal?.breakdown
  const summary = verdict?.summary ?? b?.summary ?? null
  // EGY useFeedback, FELTÉTEL NÉLKÜL mountolva (mezo-76f6): a hook-sorrend nem függhet attól,
  // van-e breakdown vagy próza — a chipek maguk renderelnek csak akkor, ha van miről szavazni.
  const feedback = useFeedback('meal_coach', summary && meal ? [meal.id] : [])

  const back = () => navigate(meal ? `/fuel/etkezes/${meal.id}${day ? `?d=${day}` : ''}` : '/fuel')

  if (!meal) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel')} aria-label="Vissza a Mai oldalra">‹</button>
          <span><strong>Ez az étkezés nincs meg</strong></span>
        </div>
        <p className="fmx-block-empty">Lehet, hogy egy másik napon logoltad, vagy közben törölted.</p>
      </div>
    )
  }
  // Ugyanaz a szabály, mint a sheetnél: breakdown nélkül nincs mit megmutatni — és nem
  // gyártunk hozzá pontszámot.
  if (!b) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={back} aria-label="Vissza az étkezéshez">‹</button>
          <span><small>AI ÉRTÉKELÉS</small><strong>{mealDisplayName(meal) ?? 'Étkezés'}</strong></span>
        </div>
        <p className="fmx-block-empty">
          Ehhez az étkezéshez még nincs értékelés. Amint az értékelés megszületik, itt találod.
        </p>
      </div>
    )
  }

  const scorePct = meal.score != null ? Math.round(meal.score * 100) : breakdownTotalPct(b)
  const tagline = verdict?.tagline ?? b.tagline
  const improve = verdict?.improve?.length ? verdict.improve : b.improve

  return (
    <div className="fmx-page">
      <div className="fmx-subhead">
        <button type="button" onClick={back} aria-label="Vissza az étkezéshez">‹</button>
        <span>
          <small>AI ÉRTÉKELÉS</small>
          <strong>{mealDisplayName(meal) ?? 'Étkezés'}</strong>
        </span>
        <b className="fmx-subhead-end">{hhmmFromLoggedAt(meal.loggedAt, '—')} · {huInt(meal.kcal)} kcal</b>
      </div>

      <FuelScoreSurface
        breakdown={b}
        scorePct={scorePct}
        tagline={tagline}
        summary={summary}
        coachPending={coachPending}
        improve={improve}
        feedback={summary ? (
          /* Csendes 👍/👎 a coach SAJÁT prózájára (mezo-76f6) — a számokra nem szavazunk. */
          <div className="fmx-score-fb">
            <FeedbackChips
              key={meal.id}
              value={feedback.get(meal.id)}
              onVote={(v, reason) => feedback.vote(meal.id, v, reason)}
              label="a Mezo olvasatáról"
            />
          </div>
        ) : null}
        note={<>
          A pontszám mentéskor, determinisztikusan születik; a szöveges részt a coach írja hozzá,
          és sosem írja át a számokat. Egyetlen étkezés sosem ítélet — a nap egészében nézzük.
        </>}
      />
    </div>
  )
}
