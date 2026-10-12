// ============================================================
// Mezo · RecipeDetailPage — EGY recept részletező oldala (Fuel Titanium S4, mezo-hygp;
// fagyasztott manifeszt B8 · B9 · B11 · B12).
//
// OWNER-DÖNTÉS, ami ezt a lapot vezeti: egy recept megnyitása UGYANAZT a mélységet adja, mint
// egy logolt étkezésé — hozzávalók, Mezo értékelése, teljes makró és kcal, és mikrotápanyagok.
// Ezért a Makrók / Hozzávalók / Minőség / Mikrotápanyagok szekciók NEM másolatok, hanem
// pontosan azok a komponensek, amiket a Mai étkezés-részletlap rajzol
// (`FuelQualityBlocks`, a C terület fájlja). Két példány garantáltan elcsúszna.
//
// Folyadék (mezo-n4wf5.5, fuel.js `recept()` + `SH.reclogs`): a hős a FAZÉK — a szintje egy adag
// része a fazékból (1 / adag; egész receptnél tele) —, mellette az adag kcal-ja és a tények; az
// ítélet-mondat az evés-történet, alatta az adag ↔ egész váltó, a folyadékon a „Ma ettem ilyet"
// és (ha van) Mezo értékelése. Utána a közös blokkok, 4 Mezo jegyzete (az olvasat és az
// értékelés ajtaja), 5 Mit tehetsz vele (logolás, Műhely, mai logok, szerkesztés / csillag /
// törlés).
//
// Ami VÁLTOZATLAN viselkedés: az adag ↔ egész váltó, a lusta bontás (`useRecipeBreakdown`) és a
// háttér-újraértékelés őszinte jelzése (a régi szöveget nem mutatjuk késznek), az értékelés
// oldala (`/ertekeles`), a mai logok listája, a LogFlow előtöltése, a csillag, a szerkesztő-ajtó,
// a Műhely `?recipeId`-vel, és a kétlépéses törlés.
//
// ŐSZINTE-NULL: a mikrotápanyag-blokk kizárólag a négy tárolt tényt mutatja (rost, cukor, só,
// telített zsír); vitamin/ásványi anyag a produkcióban nem létezik (mezo-vj61, manifeszt F1).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Ingredient, Recipe, RecipeInput, Nutrients } from '@/data/types'
import { useRecipes, useRecipeActions, useRecipeBreakdown, usePantry, useRecipeLogs } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { fmtDate, fmtGrouped, fmtNum } from '@/shared/lib/format'
import { Sheet } from '@/shared/ui/Sheet'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import {
  Acts, Btn, Card, Chips, Empty, FoSheetHead, FrameBack, Hero, Lk, Page, Row, Section, Txt, useFrameTitle,
} from '@/shared/ui/folyadek'
import { NumG, Pot } from '@/features/fuel/components/folyadek'
import { NO_NUTRIENTS, scaleNutrients } from '@/data/fuel/recipeMacros'
import { RecipeLogsList } from '@/features/fuel/components/RecipeLogsList'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import {
  FuelIngredientSection, FuelMacroShareSection, FuelMicroNote, FuelMicroSection,
  FuelQualitySection, type FuelIngredientRowVM, type FuelQualityLine,
} from '@/features/fuel/components/FuelQualityBlocks'
import { mealMacroShare } from '@/features/fuel/logic/mealShare'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { roleLabel } from '@/features/fuel/logic/recipeRole'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { hasLastLogged } from '@/features/fuel/pages/FuelRecipesPage'

// Build a complete RecipeInput from a Recipe — prefills every field so a star
// toggle (or the editor) preserves untouched values. The editor reuses this.
// NOTE: RecipeInput.ingredients carries `pantryItemId` (the boundary contract
// name); Recipe.ingredients carries the same value under `refId`.
export function recipeToInput(r: Recipe): RecipeInput {
  return {
    name: r.name,
    slot: r.slot || null,
    category: r.category,
    servings: r.servings,
    prepMins: r.prepMins,
    cookMins: r.cookMins,
    tags: r.tags,
    starred: r.starred,
    role: r.role,
    ingredients: r.ingredients.map(i => ({ pantryItemId: i.refId, amount: i.amount, unit: i.unit, note: i.note ?? null })),
  }
}

function round(n: number) { return Math.round(n) }
function byBasis(v: number, basis: ServingBasis, servings: number) {
  return basis === 'whole' ? round(v) : round(v / Math.max(1, servings))
}
function nutrientsByBasis(n: Nutrients, basis: ServingBasis, servings: number): Nutrients {
  return basis === 'whole' ? n : scaleNutrients(n, 1 / Math.max(1, servings))
}
/** The server sends an ISO instant; the mock seed a ready short date — that one prints as it is. */
function createdLabel(createdDate: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(createdDate) ? fmtDate(createdDate.length > 10 ? new Date(createdDate) : createdDate, 'monthDay') : createdDate
}

export function RecipeDetailPage() {
  const M = useM()
  const C = M.fuelRecept.common
  const D = M.fuelRecept.detail
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes } = useRecipes()
  // A hozzávaló-sor NOVA-csoportja és eredete a duális módú kamrából oldódik fel (a
  // `useRecipes().ingredients` statikus mock-seed, ami a valódi módban hiányzik — mezo-yew).
  // A sor NEVE és makrója a perzisztált pillanatképből jön (line.name/line.contribution).
  const { ingredients } = usePantry()
  const { update, remove } = useRecipeActions()
  const [basis, setBasis] = useState<ServingBasis>('serving')
  const [logOpen, setLogOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [delArmed, setDelArmed] = useState(false)
  // Today's logs of this recipe (mezo-cki) + the template breakdown (mezo-bw3y). Called with
  // `id ?? ''` alongside the other top-level hooks — BEFORE the not-found early return — so hook
  // order stays stable on a cold/not-found render.
  const { logs } = useRecipeLogs(id ?? '')
  const { breakdown, fitsFor, pending: breakdownPending, refreshing: breakdownRefreshing } = useRecipeBreakdown(id ?? '')
  // One gate for both: a first generate and a background regeneration must both hide the
  // (stale-or-absent) prose rather than render a pre-edit reading as current (mezo-uavr).
  const breakdownBusy = breakdownPending || breakdownRefreshing

  const recipe = recipes.find(r => r.id === id)

  useFrameTitle(recipe
    ? { title: recipe.name, eyebrow: D.eyebrow(recipeSlotFace(recipe.category).label) }
    : { title: C.noSuchRecipeTitle, eyebrow: C.recipes })
  const back = <FrameBack className="fo-backpill" history fallback="/fuel/recipes">‹ {C.recipes}</FrameBack>

  // Not-found fallback. The DATA section exposes no raw query status, so the guard
  // relies on useRecipes().recipes: mock mode resolves synchronously via initialData;
  // real mode shows this fallback briefly on a cold deep-link until the list resolves.
  if (!recipe) {
    return (
      <Page className="fc-page">
        {back}
        <Card>
          <Empty icon="t-book" actions={<Btn sm onClick={() => navigate('/fuel/recipes')}>{C.backToRecipes}</Btn>}>
            {D.notFound}
          </Empty>
        </Card>
      </Page>
    )
  }

  const totalMins = recipe.prepMins + recipe.cookMins
  const servings = recipe.servings
  const whole = basis === 'whole'
  const perBasis = (v: number) => byBasis(v, basis, servings)
  const sourceOf = (refId: string): Ingredient | undefined => ingredients.find(i => i.id === refId)

  // A makrók a recept SAJÁT összetételét mutatják — a grammok követik a váltót.
  const shares = mealMacroShare({
    p: perBasis(recipe.macros.p), c: perBasis(recipe.macros.c), f: perBasis(recipe.macros.f),
  })

  const lineKcal = recipe.ingredients.reduce((s, l) => s + (l.contribution?.kcal ?? 0), 0)
  const ingredientRows: FuelIngredientRowVM[] = recipe.ingredients.map((line, i) => {
    const src = sourceOf(line.refId)
    const kcal = line.contribution?.kcal ?? null
    return {
      key: `${line.refId}-${i}`,
      name: line.name ?? line.refId,
      kcal: kcal == null ? null : perBasis(kcal),
      share: lineKcal > 0 && kcal != null ? Math.round((kcal / lineKcal) * 100) : null,
      amount: `${fmtNum(whole ? line.amount : line.amount / Math.max(1, servings), 1)} ${line.unit}`,
      // A sor a kamrából jön (egy mentett recept minden sora feloldott kamra-hivatkozás).
      source: 'pantry',
      nova: src?.nova ?? null,
    }
  })
  const qualityLines: FuelQualityLine[] = recipe.ingredients.map(line => ({
    grams: line.unit.trim().toLowerCase() === 'g' ? line.amount : null,
    kcal: line.contribution?.kcal ?? null,
    nova: sourceOf(line.refId)?.nova ?? null,
  }))

  const toggleStar = () => update(recipe.id, { ...recipeToInput(recipe), starred: !recipe.starred })
  const del = () => {
    if (!delArmed) { setDelArmed(true); return }
    remove(recipe.id)
    // the deleted recipe must not stay behind the user (history back)
    navigate('/fuel/recipes', { replace: true })
  }
  const openScore = () => navigate(`/fuel/recipes/${recipe.id}/ertekeles`)

  // The rating (0..1): Mezo's fit score when it exists, else the deterministic weighted total —
  // the SAME Σ(score×weight) the rating page shows per dimension. Never a lying 0.
  const fitScore = recipe.mezoFit.score
    ?? (breakdown ? breakdown.dimensions.reduce((a, d) => a + d.score * d.weight, 0) : null)
  // Printed on the ten scale; hidden while a reading is being (re)written.
  const score = breakdownBusy || fitScore == null ? null : fmtNum(Math.round(fitScore * 100) / 10, 1)
  const scoreOpen = Boolean(breakdown) && !breakdownBusy
  const eaten = recipe.timesLogged > 0

  return (
    <Page className="fc-page">
      {back}
      <Hero className="fc-ghero"
        label={whole ? D.heroWhole(servings) : servings > 1 ? D.heroServing(servings) : D.heroSingle}
        verdict={eaten ? (hasLastLogged(recipe) ? D.eatenLast(recipe.timesLogged, recipe.lastLogged) : D.eaten(recipe.timesLogged)) : D.notEaten}
        sub={[
          recipe.role !== 'standard' ? roleLabel(recipe.role) : null,
          !eaten ? D.subLogIt : score != null ? D.subRating(score) : breakdownBusy ? D.subRatingBusy : D.subNoRating,
        ].filter(Boolean).join(' · ')}
        actions={(
          <>
            <Btn onClick={() => setLogOpen(true)}>{D.ateToday}</Btn>
            {score != null && scoreOpen && <Lk onClick={openScore}>{D.ratingLink(score)}</Lk>}
          </>
        )}
      >
        <NumG graphic={<Pot pct={whole ? 100 : 100 / Math.max(1, servings)} size={104} />}
          value={fmtGrouped(perBasis(recipe.macros.kcal))} unit={whole ? C.kcalWhole : C.kcalPerServing}>
          <p className="fc-meta">
            {C.servings(servings)} · {totalMins > 0 ? D.readyIn(totalMins) : D.noTime} · NOVA {recipe.novaDominant}
          </p>
          <p>{D.created(createdLabel(recipe.createdDate))}</p>
        </NumG>
        {servings > 1 && (
          <div className="fc-basis"><ServingToggle value={basis} servings={servings} onChange={setBasis} /></div>
        )}
      </Hero>

      <FuelMacroShareSection n={1} shares={shares} groupLabel={D.macroGroup} frame={D.macroFrame} />

      <FuelIngredientSection n={2} heading={C.ingredientsTitle(ingredientRows.length)} rows={ingredientRows}
        empty={D.ingredientsEmpty} note={D.ingredientsNote} />

      <FuelQualitySection n={3} heading={D.qualitySection} lines={qualityLines} />
      <FuelMicroSection heading={false}
        nutrients={nutrientsByBasis(recipe.nutrients ?? NO_NUTRIENTS, basis, servings)}
        frame={whole ? D.microFrameWhole : D.microFrameServing} note={<FuelMicroNote />} />

      {/* Mezo jegyzete — a lusta olvasat. Háttér-újraértékelés közben a (már elavult) prózát
          NEM mutatjuk késznek: az egész blokk a becsületes „épp újraértékeli" állapotra vált. */}
      <Section n={4} title={D.noteSection} />
      <Card aria-label={D.noteSection}>
        {breakdownBusy ? (
          <Txt>{breakdownRefreshing ? D.noteRefreshing : D.noteBusy}</Txt>
        ) : breakdown?.summary ? (
          <Txt><SafeMarkdown text={breakdown.summary} /></Txt>
        ) : (
          <Txt>{D.noteNone}</Txt>
        )}
        {!breakdownBusy && fitsFor.length > 0 && <Chips className="fc-fit" items={[fitsFor[0]]} />}
        <Row icon="t-score" className={scoreOpen ? undefined : 'fc-off'} data-testid="recipe-score-open"
          title={D.rating}
          sub={scoreOpen && breakdown
            ? D.ratingSub(breakdown.dimensions.length, Math.round(breakdown.confidence * 100))
            : breakdownBusy ? D.ratingSoon : D.ratingNoData}
          value={scoreOpen && score != null ? score : '—'}
          disabled={!scoreOpen} onClick={openScore} chev={scoreOpen} />
      </Card>

      <Section n={5} title={D.actionsSection} />
      <Card>
        {/* B12: a logolás előtöltve indul — a kamera-felületet kihagyva. */}
        <Row icon="t-plate" title={D.log} sub={D.logSub} onClick={() => setLogOpen(true)} />
        {/* B10: a Műhely ezzel a recepttel indul (`?recipeId`), és mentéskor FRISSÍT, nem másol. */}
        <Row icon="t-chef" title={D.rework} sub={D.reworkSub}
          onClick={() => navigate(`/fuel/recipes/muhely?recipeId=${recipe.id}`)} />
        <Row icon="t-journal" data-testid="recipe-logs-open" title={D.logs(logs.length)}
          sub={logs.length > 0 ? D.logsToday : D.logsNone} onClick={() => setLogsOpen(true)} />
        <Acts>
          <Btn sm ghost onClick={() => navigate(`/fuel/recipes/${recipe.id}/edit`)}>{D.edit}</Btn>
          <Lk onClick={toggleStar}>{recipe.starred ? D.unstar : D.star}</Lk>
          {/* Két lépés: egy részletező lapon egy koppintás nem törölhet receptet. */}
          <Lk bad={delArmed} onClick={del}>{delArmed ? D.delConfirm : D.del}</Lk>
        </Acts>
      </Card>

      {logOpen && <LogFlowPage prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={() => setLogOpen(false)} />}
      {logsOpen && (
        <Sheet onClose={() => setLogsOpen(false)} className="fo-sheet fc-logsheet" labelledBy="recipe-logs-title">
          {(close) => (
            <>
              <FoSheetHead icon="t-journal" title={recipe.name} titleId="recipe-logs-title" sub={D.logsSheetSub} onClose={close} />
              <RecipeLogsList logs={logs} baselineScore={recipe.mezoFit.score ?? 0} />
              <Acts><Lk onClick={close}>{C.close}</Lk></Acts>
            </>
          )}
        </Sheet>
      )}
    </Page>
  )
}
