// ============================================================
// Mezo · RecipeDetailPage — EGY recept Titán részletező oldala (Fuel Titanium S4, mezo-hygp;
// fagyasztott manifeszt B8 · B9 · B11 · B12).
//
// OWNER-DÖNTÉS, ami ezt a lapot vezeti: egy recept megnyitása UGYANAZT a mélységet adja, mint
// egy logolt étkezésé — hozzávalók, AI értékelés, teljes makró és kcal, és mikrotápanyagok.
// Ezért a Makrók / Hozzávalók / Minőség / Mikrotápanyagok szekciók NEM másolatok, hanem
// pontosan azok a komponensek, amiket a Mai étkezés-részletlap rajzol
// (`FuelQualityBlocks` — az S1b-ből kiemelve). Két példány garantáltan elcsúszna.
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `recipeDetailPage` (:50) + `recipeScoreGlass` (:71), a fuel-pages.css „Konyha v2" (:497)
// blokkjával; a szekciók stílusa az S1 `fmx-` blokkjából jön.
//
// Ami VÁLTOZATLAN viselkedés (a lap csak más arcot kapott): a `/adag ↔ egész` váltó, a lusta
// AI-bontás (`useRecipeBreakdown`) és a háttér-újraértékelés őszinte jelzése, a pontszám-sheet
// (ugyanaz a `ScoreBreakdownBody`, amit az étkezés-értékelés is rajzol), a logok listája, a
// LogFlow előtöltése, a csillag, a szerkesztő-ajtó és a Műhely-iterálás `?recipeId`-vel.
//
// Ami SZIGORODOTT: a törlés két lépés lett (a prototípus `deleteControl`-ja, és a kamra-tétel
// lap precedense) — egy részletező lapon egy koppintás nem törölhet receptet.
//
// ŐSZINTE-NULL: a mikrotápanyag-blokk kizárólag a négy tárolt tényt mutatja (rost, cukor, só,
// telített zsír); vitamin/ásványi anyag a produkcióban nem létezik (mezo-vj61, manifeszt F1).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Ingredient, Recipe, RecipeInput, Nutrients } from '@/data/types'
import { useRecipes, useRecipeActions, useRecipeBreakdown, usePantry, useRecipeLogs } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { hu1, huInt } from '@/shared/lib/huNum'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { RecipeScoreSheet } from '@/features/fuel/sheets/RecipeScoreSheet'
import { NO_NUTRIENTS, scaleNutrients } from '@/data/fuel/recipeMacros'
import { RecipeLogsList } from '@/features/fuel/components/RecipeLogsList'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import { FuelScoreChip } from '@/features/fuel/components/FuelMealBlocks'
import {
  FuelIngredientSection, FuelMacroShareSection, FuelMicroNote, FuelMicroSection,
  FuelQualitySection, type FuelIngredientRowVM, type FuelQualityLine,
} from '@/features/fuel/components/FuelQualityBlocks'
import { mealMacroShare } from '@/features/fuel/logic/mealShare'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { roleLabel } from '@/features/fuel/logic/recipeRole'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'

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

export function RecipeDetailPage() {
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
  const [scoreOpen, setScoreOpen] = useState(false)
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

  // Not-found fallback. The DATA section exposes no raw query status, so the guard
  // relies on useRecipes().recipes: mock mode resolves synchronously via initialData;
  // real mode shows this fallback briefly on a cold deep-link until the list resolves.
  if (!recipe) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel/recipes')} aria-label="Vissza">‹</button>
          <span><strong>Nincs ilyen recept.</strong></span>
        </div>
        <p className="fmx-block-empty">
          Lehet, hogy közben törölted. A Receptek listán minden megmaradt recepted ott van.
        </p>
      </div>
    )
  }

  const face = recipeSlotFace(recipe.category)
  const totalMins = recipe.prepMins + recipe.cookMins
  const servings = recipe.servings
  const perBasis = (v: number) => byBasis(v, basis, servings)
  const sourceOf = (refId: string): Ingredient | undefined => ingredients.find(i => i.id === refId)

  // A gyűrűk a recept SAJÁT összetételét mutatják — a grammok követik a váltót.
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
      amount: `${hu1(basis === 'whole' ? line.amount : line.amount / Math.max(1, servings))} ${line.unit}`,
      // A sor a kamrából jön (egy mentett recept minden sora feloldott kamra-hivatkozás).
      origin: { label: 'kamra', icon: 'i-kamra' },
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
    navigate('/fuel/recipes')
  }

  // The chip's ring value (0..1): the AI fit score when it exists, else the deterministic
  // weighted total — the SAME Σ(score×weight) the sheet already shows per-dimension as pts.
  // Never a lying 0 next to "8 szempont" (caught by reading the first golden).
  const fitScore = recipe.mezoFit.score
    ?? (breakdown ? breakdown.dimensions.reduce((a, d) => a + d.score * d.weight, 0) : null)

  return (
    <div className="fmx-page fkx-detail" style={{ '--block-color': face.color } as React.CSSProperties}>
      <EntranceGroup>
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel/recipes')} aria-label="Vissza">‹</button>
          <span>
            <small>{face.label.toLocaleUpperCase('hu-HU')}-RECEPT</small>
            <strong>{recipe.name}</strong>
          </span>
          <span className="fkx-head-score">
            <FuelScoreChip
              scorePct={breakdownBusy || fitScore == null ? null : Math.round(fitScore * 100)}
              onOpen={breakdown ? () => setScoreOpen(true) : undefined}
              size="big"
            />
          </span>
        </div>

        {/* Split hero: bal = tál-ikon és ALATTA a kcal; jobb = a blokk-sor és az evés-történet. */}
        <div className="fmx-detail-hero">
          <span className="fmx-detail-glow" aria-hidden="true" />
          <div className="fmx-detail-left">
            <span className="fmx-detail-art" aria-hidden="true"><ClayIcon name="i-tanyer" size={96} /></span>
            <div className="fmx-detail-kcal">
              <strong>{huInt(perBasis(recipe.macros.kcal))}</strong>
              <small>kcal {basis === 'whole' ? '· egész' : '/ adag'}</small>
            </div>
          </div>
          <div className="fmx-detail-right">
            <div className="fmx-detail-when">
              <span className="fmx-di-art" aria-hidden="true"><ClayIcon name={face.icon} size={30} /></span>
              <span>
                <strong>{face.label}</strong>
                <small>{totalMins > 0 ? `${totalMins} perc alatt kész` : 'elkészítési idő nincs megadva'}</small>
              </span>
            </div>
            <div className="fmx-detail-share">
              <span className="fmx-di-art" aria-hidden="true"><ClayIcon name="i-naplo" size={30} /></span>
              <span>
                <strong>{recipe.timesLogged > 0 ? `${recipe.timesLogged}× etted` : 'Még nem etted'}</strong>
                <small>{recipe.timesLogged > 0 ? `legutóbb ${recipe.lastLogged}` : 'naplózd, ha elkészült'}</small>
              </span>
            </div>
          </div>
        </div>

        {/* A meta-sor: adag · idő · NOVA · a mérce, amit egy nem-általános szerep kijelöl. */}
        <p className="fkx-meta">
          {servings} adag · {totalMins} perc · <span className="fkx-nova">NOVA {recipe.novaDominant}</span>
          {recipe.role !== 'standard' && (<> · <span className="fkx-role">{roleLabel(recipe.role)}</span></>)}
          {' '}· létrehozva {recipe.createdDate}
        </p>

        <div className="fkx-basis">
          <ServingToggle value={basis} servings={servings} onChange={setBasis} />
        </div>

        <FuelMacroShareSection shares={shares}
          groupLabel="A recept energiájának megoszlása" frame="a recept energiájának" />

        <FuelIngredientSection rows={ingredientRows}
          empty="A hozzávalók még nincsenek részletezve." />

        <FuelQualitySection lines={qualityLines} />

        <FuelMicroSection
          nutrients={nutrientsByBasis(recipe.nutrients ?? NO_NUTRIENTS, basis, servings)}
          frame={basis === 'whole' ? 'a recept' : 'az adag'} />
        <FuelMicroNote />

        {/* Mezo jegyzete — a lusta AI-olvasat. Háttér-újraértékelés közben a (már elavult) prózát
            NEM mutatjuk késznek: az egész blokk a becsületes „épp újraértékeli" állapotra vált. */}
        <section className="fkx-note" aria-label="Mezo jegyzete">
          <div className="fkx-note-head">
            <span aria-hidden="true"><ClayIcon name="i-kristaly" size={30} /></span>
            <strong>Mezo jegyzete</strong>
          </div>
          {breakdownBusy ? (
            <p className="fkx-note-body">{breakdownRefreshing ? 'Mezo újraértékeli…' : 'Mezo értékeli…'}</p>
          ) : breakdown?.summary ? (
            <p className="fkx-note-body"><SafeMarkdown text={breakdown.summary} /></p>
          ) : (
            <p className="fkx-note-body">Még nincs olvasat.</p>
          )}
          {!breakdownBusy && fitsFor.length > 0 && (
            <span className="fkx-fit-chip">● {fitsFor[0]}</span>
          )}
          <button type="button" className="fkx-door" data-testid="recipe-score-open"
            disabled={!breakdown || breakdownBusy} onClick={() => setScoreOpen(true)}>
            <span aria-hidden="true"><ClayIcon name="i-kristaly" size={26} /></span>
            <span>
              <strong>Pontszám</strong>
              <small>
                {breakdown && !breakdownBusy
                  ? `${breakdown.dimensions.length} szempont · megbízh. ${Math.round(breakdown.confidence * 100)}%`
                  : 'Sablon-pontszámhoz még nincs elég adat (kcal nélküli hozzávalók).'}
              </small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
        </section>

        {/* B12: a logolás előtöltve indul — a kamera-felületet kihagyva. */}
        <button type="button" className="fkx-cta is-primary" onClick={() => setLogOpen(true)}>
          <span aria-hidden="true"><ClayIcon name="i-tanyer" size={28} /></span>
          <span>Logolás · ma ettem ilyet</span>
          <b aria-hidden="true">›</b>
        </button>
        {/* B10: a Műhely ezzel a recepttel indul (`?recipeId`), és mentéskor FRISSÍT, nem másol. */}
        <button type="button" className="fkx-cta is-secondary"
          onClick={() => navigate(`/fuel/recipes/muhely?recipeId=${recipe.id}`)}>
          <span aria-hidden="true"><ClayIcon name="i-muhely" size={28} /></span>
          <span>Iterálás a Műhelyben</span>
          <b aria-hidden="true">›</b>
        </button>

        <button type="button" className="fkx-door" data-testid="recipe-logs-open" onClick={() => setLogsOpen(true)}>
          <span aria-hidden="true"><ClayIcon name="i-naplo" size={26} /></span>
          <span>
            <strong>Logok · {logs.length}</strong>
            <small>{logs.length > 0 ? 'ma is a naplódban' : 'ma még nincs logolva'}</small>
          </span>
          <b aria-hidden="true">›</b>
        </button>

        <div className="fkx-actions">
          <button type="button" onClick={() => navigate(`/fuel/recipes/${recipe.id}/edit`)}>
            <span aria-hidden="true"><ClayIcon name="i-recept" size={20} /></span>Szerkesztés
          </button>
          <button type="button" onClick={toggleStar}>
            <Icon name="bookmark" size={12} /> {recipe.starred ? 'Csillag le' : 'Csillag'}
          </button>
          {/* Két lépés: egy részletező lapon egy koppintás nem törölhet receptet. */}
          <button type="button" className="fkx-del" onClick={del}>
            {delArmed ? 'Biztos? Még egy érintés a törléshez' : 'Törlés'}
          </button>
        </div>
      </EntranceGroup>

      {logOpen && <LogFlowPage prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={() => setLogOpen(false)} />}
      {scoreOpen && breakdown && <RecipeScoreSheet recipe={recipe} breakdown={breakdown} onClose={() => setScoreOpen(false)} />}
      {logsOpen && (
        <Sheet onClose={() => setLogsOpen(false)} labelledBy="recipe-logs-title">
          {(close) => (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div className="col">
                  <Eyebrow brand>Recept · logok</Eyebrow>
                  <div id="recipe-logs-title" style={{ marginTop: 4 }}>
                    <Display size="md">{recipe.name}</Display>
                  </div>
                </div>
                <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
                  <Icon name="x" size={12} />
                </button>
              </div>
              <RecipeLogsList logs={logs} baselineScore={recipe.mezoFit.score ?? 0} />
              <div style={{ height: 24 }} />
            </>
          )}
        </Sheet>
      )}
    </div>
  )
}
