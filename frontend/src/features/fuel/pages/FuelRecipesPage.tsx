// ============================================================
// Mezo · FuelRecipesPage (Receptek) — a Konyha egyik ajtaja mögötti könyvtár
// (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt B8).
//
// Folyadék (mezo-n4wf5.5, fuel.js `receptek()`): title bar → the hero is what you eat most
// (the four most-logged recipes as levels, relative to the favourite; an empty pot while nothing
// was eaten yet) with the verdict sentence and „+ Új recept" on the liquid → 1 Szűrés (the
// counted filter pills) → 2 Receptjeid (one two-storey row per recipe: meal glyph, name, the
// meta line, kcal per SERVING on the right; under it the three per-serving macro levels and the
// status pills).
//
// B10 owner-döntés: a Receptműhely gombja LEJÖTT erről a lapról — a Műhely a Konyha hub
// saját posztere. Ide NE kerüljön vissza.
//
// Változatlan viselkedés: a szűrés tengelye, a valódi módú betöltő arc (mezo-f2z), az új recept
// a kézi szerkesztőbe visz, a sor a részletlapra.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe, RecipeCategory } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { fmtFixed, fmtGrouped } from '@/shared/lib/format'
import type { Icon3DName } from '@/shared/ui/clay'
import {
  Btn, Card, Empty, FrameBack, Hero, Level, Lk, Note, Page, Pill, Pills, Section, St, useFrameTitle,
} from '@/shared/ui/folyadek'
import { ItemRow, M3, Pot } from '@/features/fuel/components/folyadek'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { roleLabel } from '@/features/fuel/logic/recipeRole'
import RecipesSkeleton from '@/features/fuel/pages/RecipesSkeleton'

type FilterId = 'all' | RecipeCategory | 'starred'

const FILTERS: FilterId[] = ['all', 'breakfast', 'lunch', 'dinner', 'snack', 'starred']

/** The meal glyph of a recipe's category (fuel.js `CAT`). */
export const RECIPE_CATEGORY_ICON: Record<RecipeCategory, Icon3DName> = {
  breakfast: 't-sun', lunch: 't-bowl', snack: 't-snack', dinner: 't-moon',
}
export const recipeCategoryIcon = (c: string | null | undefined): Icon3DName =>
  RECIPE_CATEGORY_ICON[c as RecipeCategory] ?? 't-plate'

/** The server sends a constant dash where it has no „last eaten" text. */
export const hasLastLogged = (r: Recipe): boolean => {
  const t = (r.lastLogged ?? '').trim()
  return t !== '' && t !== '—' && t !== '-'
}

function matches(r: Recipe, id: FilterId): boolean {
  if (id === 'all') return true
  if (id === 'starred') return r.starred
  return r.category === id
}

/** A per-serving share of a whole-recipe value (the list's one basis, owner 2026-09-23). */
function perServing(v: number, servings: number) {
  return Math.round(v / Math.max(1, servings))
}

function RecipeRow({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const M = useM()
  const C = M.fuelRecept.common
  const L = M.fuelRecept.list
  const servings = recipe.servings
  const kcal = perServing(recipe.macros.kcal, servings)
  const p = perServing(recipe.macros.p, servings)
  const c = perServing(recipe.macros.c, servings)
  const f = perServing(recipe.macros.f, servings)
  const mins = recipe.prepMins + recipe.cookMins
  const score = recipe.mezoFit.score
  // A szerep a MÉRCÉT nevezi meg, amihez a pontszám mér (mezo-uavr). Az „Általános" a
  // hallgatólagos alapeset, ezért SOHA nem kap jelölést.
  const sub = [
    recipeSlotFace(recipe.category).label,
    mins > 0 ? C.minutes(mins) : null,
    recipe.role !== 'standard' ? roleLabel(recipe.role) : null,
    servings > 1 ? C.servings(servings) : null,
  ].filter(Boolean).join(' · ')
  return (
    <ItemRow icon={recipeCategoryIcon(recipe.category)} title={recipe.name} sub={sub} onClick={onOpen}
      value={<>{fmtGrouped(kcal)}<small>kcal</small></>}>
      <span className="fc-m3" role="img" aria-label={L.macrosAria(p, c, f)}><M3 p={p} c={c} f={f} /></span>
      <span className="fc-sts">
        {recipe.starred && <St tone="plan">{L.starred}</St>}
        {score == null
          ? <St tone="q">{L.scoring}</St>
          : <St tone="ok">{L.points(fmtFixed(Math.round(score * 100) / 10, 1))}</St>}
      </span>
    </ItemRow>
  )
}

export function FuelRecipesPage() {
  const M = useM()
  const C = M.fuelRecept.common
  const L = M.fuelRecept.list
  const navigate = useNavigate()
  const { recipes, pending } = useRecipes()
  const [filter, setFilter] = useState<FilterId>('all')

  useFrameTitle({ title: C.recipes, eyebrow: pending ? C.kitchen : L.eyebrow(C.recipeCount(recipes.length)) })
  const back = <FrameBack className="fo-backpill" history fallback="/fuel/konyha" label={L.backAria}>‹ {C.kitchen}</FrameBack>

  // Real-mode loading window — the loading face before the empty-state list (hooks are all
  // above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <>{back}<RecipesSkeleton /></>

  const filtered = recipes.filter(r => matches(r, filter))
  // The hero: what you ate most (`Recipe.timesLogged`); without a single log, no levels.
  const top = recipes.slice().sort((a, b) => b.timesLogged - a.timesLogged)
  const fav = top[0]
  const eaten = fav != null && fav.timesLogged > 0
  const newRecipe = () => navigate('/fuel/recipes/new')
  const filterLabel = (id: FilterId) =>
    id === 'all' ? L.filter.all : id === 'starred' ? L.filter.starred : recipeSlotFace(id).label

  return (
    <Page className="fc-page">
      {back}
      <Hero className="fc-ghero"
        label={eaten ? L.heroLabelTop : L.heroLabel}
        verdict={recipes.length === 0 ? L.verdictNone : eaten ? L.verdictFav(recipes.length, fav.timesLogged) : L.verdictNotEaten}
        sub={recipes.length === 0 ? L.subNone : eaten ? (hasLastLogged(fav) ? L.subFav(fav.name, fav.lastLogged) : fav.name) : undefined}
        actions={<Btn onClick={newRecipe}>{L.newRecipe}</Btn>}
        graphic={eaten ? (
          <div className="fc-top">
            {top.slice(0, 4).map(r => (
              <button key={r.id} type="button" onClick={() => navigate(`/fuel/recipes/${r.id}`)} aria-label={L.openAria(r.name, r.timesLogged)}>
                <span><b>{r.name}</b><em>{L.times(r.timesLogged)}</em></span>
                <Level pct={(r.timesLogged / fav.timesLogged) * 100} height={14} />
              </button>
            ))}
          </div>
        ) : (
          <div className="fc-potc" aria-hidden="true"><Pot pct={0} size={120} /></div>
        )}
      >
      </Hero>

      <Section n={1} title={L.filterSection} />
      <Card>
        <Pills role="group" aria-label={L.filterAria} data-kalauz-anchor="receptek-tabs">
          {FILTERS.map(id => (
            <Pill key={id} on={filter === id} onClick={() => setFilter(id)}>
              {filterLabel(id)}<b>{recipes.filter(r => matches(r, id)).length}</b>
            </Pill>
          ))}
        </Pills>
      </Card>

      <Section n={2} title={L.listSection} />
      {filtered.length > 0 ? (
        <Card className="fc-list">
          {filtered.map(r => (
            <RecipeRow key={r.id} recipe={r} onOpen={() => navigate(`/fuel/recipes/${r.id}`)} />
          ))}
          <Note>{L.note}</Note>
        </Card>
      ) : (
        <Card>
          <Empty icon="t-plate" actions={<Lk onClick={newRecipe}>{L.saveOne}</Lk>}>
            {recipes.length === 0 ? L.verdictNone : L.emptyFilter}
          </Empty>
        </Card>
      )}
    </Page>
  )
}
