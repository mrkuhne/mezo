// ============================================================
// Mezo · FuelMealDetailPage — EGY logolt étkezés részletező oldala
// (Fuel Titanium S1b, mezo-33k6; Folyadék F5, mezo-n4wf5.5).
//
// FOLYADÉK (prototípus `vilagos/fuel.js` `meal(id)`): címsor = az étkezés helye a napban (Reggeli…), fölötte
// „Fuel · [nap ·] idő [· szerep]"; a hős a nap tálja, amibe ez az étkezés beleömlött (előtte ennyi volt benne · ez az
// étkezés), mellette a kcal és a nap-részesedés; az ítélet az értékelés tárolt címsora, a gomb Mezo értékelésére, a link a
// vércukor-lapra visz. Alatta öt számozott kártya: Makrók · Hozzávalók · Minőség · Mikrotápanyagok · Javítás és recept.
//
// A viselkedés változatlan:
//   • az értékelés a SAJÁT oldalán nyílik (`/fuel/etkezes/:id/ertekeles`, a `?d=` megy vele);
//   • szerkesztés NINCS a sorokon — a javítás ajtaja a logolóba visz (`/fuel/log/uj?edit=<id>` + `&d=`); a törlés ott,
//     két lépésben lakik — egy részletező lapon egy koppintás nem törölhet;
//   • a recept ajtaja (mezo-n9wgg): „Mentsük receptként" → Műhely `?fromMeal=<id>`, vagy „Megnyitom a receptet", ha az
//     étkezés egyetlen recept-sor; sorok nélkül nincs ajtó;
//   • a korábbi napok étkezései ugyanezen az oldalon nyílnak — a nap az URL-ben él (`?d=`).
//
// ŐSZINTE-NULL: a mikrotápanyag-rész KIZÁRÓLAG a négy tárolt tényt mutatja; a Minőség lapkák a BONTÁSBÓL olvasnak
// (`mealQualityTruth`, mezo-tm3sb), és amit a bontás nem tud, az „—" — nem esünk vissza a tételsorokra.
//
// AZ ÉTKEZÉS HELYÉNEK NEVE (`useMealPlaceLabel`): az étkezés saját slot-kulcsából jön (Reggeli…), KIVÉVE az ablak nélküli
// étkezést (owner-döntés 2026-10-12): amit a nap terve egyik ablakra sem tett (`FuelSlot.extra`, `logic/buildDayPlan` 3b),
// annak a neve „Ablakon kívül" — az idő EGYSZER áll: ezen a lapon a címsor fölötti sorban, az értékelés hősében a név után.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFuelDay, useFuelTimeline } from '@/data/hooks'
import { pct } from '@/shared/lib/pct'
import { fmtDate, fmtFixed, fmtGrouped, fmtNum } from '@/shared/lib/format'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { m, useM } from '@/shared/i18n'
import type { FuelMeal, FuelSlot, MealItemLine } from '@/data/types'
import { hhmmFromLoggedAt, mealSlotKey } from '@/features/fuel/logic/buildDayPlan'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { mealContextOf } from '@/features/fuel/logic/mealContext'
import { mealMacroShare } from '@/features/fuel/logic/mealShare'
import {
  FuelIngredientSection, FuelMacroShareSection, FuelMicroNote, FuelMicroSection, FuelQualitySection,
  type FuelIngredientRowVM, type FuelQualityLine,
} from '@/features/fuel/components/FuelQualityBlocks'
import { mealQualityTruth } from '@/features/fuel/logic/mealQualityTruth'
import { glycemicBand } from '@/features/fuel/logic/glycemicBand'
import { mealNutrients } from '@/features/fuel/logic/mealNutrients'
import { GlycemicGlassFor } from '@/features/fuel/components/GlycemicGlass'
import {
  Btn, Card, Empty, FrameBack, Hero, Lk, Page, Row, Section, useFrameTitle,
} from '@/shared/ui/folyadek'
import { NumG, PourBowl, PourKey } from '@/features/fuel/components/folyadek'

/** Az étkezés helyének neve a napban: „Ablakon kívül", ha a nap terve egyik ablakra sem tette (`slots` = a nap terve);
 *  különben a stabil slot-kulcsból (Reggeli / Ebéd / Uzsonna / Vacsora); ismeretlen slotnál „Étkezés". Az időt a hívó írja
 *  mellé. HÍVÁSKOR olvas (`m()`), renderben kell hívni. */
export function mealSlotLabel(meal: FuelMeal, slots: FuelSlot[] = []): string {
  if (slots.some(s => s.extra && s.mealId === meal.id)) return m().fuelLogika.dayPlan.betweenMeals
  const key = mealSlotKey(meal)
  return key ? m().fuelLogika.slot[key] : m().fuelEtkezes.meal.fallbackTitle
}

/** `mealSlotLabel` a nap tervével együtt: az étkezés és az értékelés lapja is ezt használja (egy hely). A terv ugyanaz a
 *  kompozíció, amiből a Mai lap blokkjai állnak (`useFuelTimeline`), így a két lap ugyanazt a nevet mondja. */
export function useMealPlaceLabel(meal: FuelMeal, day: string | null): string {
  const { plan } = useFuelTimeline(day ?? undefined)
  useM() // re-render on a language switch: the label is read at call time
  return mealSlotLabel(meal, plan.slots)
}

/** A sor grammos tömege, ha grammban van megadva — különben null (nem találgatunk). */
function gramsOf(line: MealItemLine): number | null {
  return line.unit.trim().toLowerCase() === 'g' ? line.amount : null
}

/** A megosztott minőség-lapkák bemenete EGY logolt sorból. */
function qualityLineOf(line: MealItemLine): FuelQualityLine {
  return { grams: gramsOf(line), kcal: line.contribution.kcal, nova: line.nova ?? null }
}

/** The honest empty face of a meal that is not there (prototype `notFound`), shared with the rating page. */
export function MealNotFound() {
  const M = useM()
  const T = M.fuelEtkezes.meal
  const navigate = useNavigate()
  useFrameTitle({ title: T.notFoundTitle, eyebrow: 'Fuel' })
  return (
    <Page className="fe-page">
      <FrameBack className="fo-backpill" history fallback="/fuel">‹ {M.kit.back}</FrameBack>
      <Card><Empty icon="t-plate" actions={<Btn sm onClick={() => navigate('/fuel')}>{T.backToToday}</Btn>}>{T.notFound}</Empty></Card>
    </Page>
  )
}

export function FuelMealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [search] = useSearchParams()
  // A korábbi napok étkezései ugyanezen az oldalon nyílnak — a nap az URL-ben él (`?d=`).
  const day = search.get('d')
  const { fuel } = useFuelDay(day ?? undefined)
  const meal = fuel.meals.find(x => x.id === id)
  if (!meal) return <MealNotFound />
  return <MealDetail meal={meal} day={day} meals={fuel.meals} dayTarget={fuel.targets.kcal} />
}

function MealDetail({ meal, day, meals, dayTarget }: { meal: FuelMeal; day: string | null; meals: FuelMeal[]; dayTarget: number }) {
  const M = useM()
  const T = M.fuelEtkezes.meal
  const navigate = useNavigate()
  const [glucoseOpen, setGlucoseOpen] = useState(false)

  const time = hhmmFromLoggedAt(meal.loggedAt, '')
  const ctx = mealContextOf(meal)
  const eyebrow = ['Fuel', day ? fmtDate(day, 'short') : null, time || null, ctx && ctx !== 'standard' ? T.ctx[ctx] : null]
    .filter(Boolean).join(' · ')
  const place = useMealPlaceLabel(meal, day)
  useFrameTitle({ title: place, eyebrow })

  const share = dayTarget > 0 ? Math.round(pct(meal.kcal, dayTarget)) : null
  // Ami a nap táljában ELŐTTE volt: a nap korábban logolt étkezései (a lap már betölti a napot).
  const before = meals.filter(x => x.id !== meal.id && x.loggedAt < meal.loggedAt).reduce((s, x) => s + x.kcal, 0)
  const bowl = (kcal: number) => (dayTarget > 0 ? (kcal / dayTarget) * 94 : 0)
  const facts = share != null
    ? (time ? T.facts(share, fmtGrouped(dayTarget), time) : T.factsNoTime(share, fmtGrouped(dayTarget)))
    : (time ? T.factsNoTarget(time) : T.factsNone)

  const lines = meal.mealItems
  const lineKcal = lines.reduce((s, l) => s + l.contribution.kcal, 0)
  const ingredientRows: FuelIngredientRowVM[] = lines.map((line, i) => ({
    key: `${line.refId}-${i}`,
    name: line.name,
    kcal: line.contribution.kcal,
    share: lineKcal > 0 ? Math.round((line.contribution.kcal / lineKcal) * 100) : null,
    amount: `${fmtNum(line.amount)} ${line.unit === 'adag' ? M.fuelKozos.unit.serving : line.unit}`,
    source: line.source,
    nova: line.nova ?? null,
  }))
  // A vércukor-sáv az étkezés SAJÁT összetételéből (mezo-6mi43). A rost és a cukor a négy tárolt tényből jön; ha a cukrot
  // a forrás nem adta meg, a sáv becsül, és a kártya / lap ezt kimondja.
  const mealFacts = mealNutrients(meal)
  const band = glycemicBand({ c: meal.c, sugarG: mealFacts.sugarG, fiberG: mealFacts.fiberG, p: meal.p, f: meal.f })
  const scoreTen = meal.score == null ? null : fmtFixed(Math.round(meal.score * 100) / 10, 1)
  const b = meal.breakdown
  const verdict = b?.tagline ? (/[.!?…]$/.test(b.tagline.trim()) ? b.tagline.trim() : `${b.tagline.trim()}.`) 
    : scoreTen != null ? M.fuelEtkezes.score.verdictFallback(scoreTen) : T.verdictPending

  const toScore = () => navigate(`/fuel/etkezes/${meal.id}/ertekeles${day ? `?d=${day}` : ''}`)
  // A8 (S1c, mezo-33k6): a javítás ajtaja. A `&d=` akkor is megy, ha az étkezés korábbi napra esik.
  const toEdit = () => navigate(`/fuel/log/uj?edit=${meal.id}${day ? `&d=${day}` : ''}`)
  // Logolt étkezésből recept (mezo-n9wgg): egyetlen recept-sor = ez már recept, azt nyitjuk; különben a Műhely az étkezés
  // soraival előtöltve nyílik. Sorok nélkül nincs miből receptet csinálni — nincs ajtó.
  const onlyRecipe = lines.length === 1 && lines[0].source === 'recipe' ? lines[0] : null
  const toRecipe = onlyRecipe
    ? () => navigate(`/fuel/recipes/${onlyRecipe.refId}`)
    : () => navigate(`/fuel/recipes/muhely?fromMeal=${meal.id}${day ? `&d=${day}` : ''}`)

  return (
    <Page className="fe-page">
      <FrameBack className="fo-backpill" history fallback="/fuel">‹ {M.kit.back}</FrameBack>
      <Hero className="fe-mealhero" label={mealDisplayName(meal) ?? T.fallbackTitle} verdict={verdict}
        sub={b?.summary ? <SafeMarkdown text={b.summary} /> : undefined}
        actions={<>
          {scoreTen == null
            ? <span className="fe-pendl">{T.ratingPending}</span>
            : <Btn onClick={toScore}>{T.rating(scoreTen)}</Btn>}
          {band && <Lk onClick={() => setGlucoseOpen(true)}>{T.glucose(band.label)}</Lk>}
        </>}
        graphic={<NumG value={fmtGrouped(meal.kcal)} unit="kcal"
          graphic={<span role="img" aria-label={T.bowlAria(fmtGrouped(meal.kcal), fmtGrouped(before))}><PourBowl before={bowl(before)} add={bowl(meal.kcal)} /></span>}>
          <p className="fe-facts"><SafeMarkdown text={facts} /></p>
          <PourKey before={before > 0 ? T.before(fmtGrouped(before)) : T.beforeEmpty} add={T.thisMeal} />
        </NumG>}
      >
      </Hero>

      {/* Az étkezés SAJÁT összetétele (owner) — nincs „a nap céljához mérve". */}
      <FuelMacroShareSection n={1} shares={mealMacroShare(meal)} groupLabel={T.macrosGroup} frame={T.macrosFrame}
        note={T.macrosNote(fmtGrouped((meal.p ?? 0) * 4), fmtGrouped((meal.c ?? 0) * 4), fmtGrouped((meal.f ?? 0) * 9))} />

      <FuelIngredientSection n={2} rows={ingredientRows} empty={T.ingredientsEmpty} note={T.ingredientsNote} />

      {/* A Minőség lapkák a BONTÁSBÓL olvassák a három tényt (mezo-tm3sb); a negyedik a vércukor-válasz SÁVJA
          (mezo-6mi43) — koppintásra a saját lapja nyílik. */}
      <FuelQualitySection n={3} lines={lines.map(qualityLineOf)} truth={mealQualityTruth(meal.breakdown)}
        glycemic={band} onOpenGlycemic={band ? () => setGlucoseOpen(true) : undefined} />
      {glucoseOpen && band && <GlycemicGlassFor mealId={meal.id} band={band} onClose={() => setGlucoseOpen(false)} />}

      <FuelMicroSection n={4} nutrients={mealFacts} frame={T.microFrame} note={<FuelMicroNote />} />

      <Section n={5} title={T.editSection} />
      <Card className="fe-doors">
        <Row icon="t-pencil" title={T.edit} sub={T.editSub} onClick={toEdit} />
        {lines.length > 0 && (
          <Row icon="t-book" title={onlyRecipe ? T.openRecipe : T.saveRecipe}
            sub={onlyRecipe ? onlyRecipe.name : T.saveRecipeSub} onClick={toRecipe} />
        )}
      </Card>
    </Page>
  )
}
