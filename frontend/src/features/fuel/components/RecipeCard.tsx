// ============================================================
// Mezo · RecipeCard (Receptek v2 — spacious, alive card)
// design_2.0 fuel-body.html #page-recept `.rcpcard`, ×1.18 (mezo-d20.4.4). Tall
// halo band (the category's clay meal icon on a wash disc) with slot chip + role
// tag + ★ + fit pill; body = name, meta (hozzávaló · perc · NOVA dot — 1 sage /
// 2-3 amber / 4 terracotta, NEVER red), a row of four tinted macro mini-tiles
// (`.mz-mcells`: kcal sage · fehérje coral · szénh. amber · zsír lavender, no
// `/adag` label, no rings), then a LIVE FOOTER surfacing the never-shown contract
// fields `timesLogged`/`avgScore`/`lastLogged` (audit gap #7) — honest
// "még nem logoltad" when the recipe has never been logged.
// ============================================================
import type { Recipe, RecipeCategory } from '@/data/types'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { MCells } from '@/shared/ui/mozaik'
import { roleLabel } from '@/features/fuel/logic/recipeRole'

const CAT_ICON: Record<RecipeCategory, ClayIconName> = {
  breakfast: 'i-reggeli', lunch: 'i-ebed', dinner: 'i-vacsora', snack: 'i-snack',
}
const CAT_BAND_CLASS: Record<RecipeCategory, string> = {
  breakfast: 'mz-rcp-breakfast', lunch: 'mz-rcp-lunch', dinner: 'mz-rcp-dinner', snack: 'mz-rcp-snack',
}

export function RecipeCard({ recipe, onOpen, delayMs }: {
  recipe: Recipe
  onOpen: (r: Recipe) => void
  /** Entrance stagger (prototype `.rcpcard.rise` with `--d: 30 + i*30ms`); only animates
   *  inside an EntranceGroup, which is exactly where the list renders it. */
  delayMs?: number
}) {
  const totalMins = recipe.prepMins + recipe.cookMins
  const bandClass = CAT_BAND_CLASS[recipe.category]
  const pending = recipe.mezoFit.score == null
  // Per-serving basis — matches the recipe-detail hero's default `serving` basis and the
  // MealPickerSheet; the whole-recipe value is misleading for a multi-serving recipe
  // (mezo-m6uv). The `/adag` rail label is gone (Daniel: "nem kell a /adag kiírás") but the
  // math it named stays the contract.
  const s = Math.max(1, recipe.servings)
  const perServing = {
    kcal: Math.round(recipe.macros.kcal / s),
    p: Math.round(recipe.macros.p / s),
    c: Math.round(recipe.macros.c / s),
    f: Math.round(recipe.macros.f / s),
  }

  return (
    <button
      onClick={() => onOpen(recipe)}
      aria-label={recipe.name}
      className={`mz-rcpcard ${bandClass}${delayMs !== undefined ? ' rise' : ''}`}
      style={delayMs !== undefined ? ({ '--d': `${delayMs}ms` } as React.CSSProperties) : undefined}
    >
      <div className="mz-rcpband">
        <span className="mz-rcp-halo"><ClayIcon name={CAT_ICON[recipe.category]} size={45} /></span>
        {recipe.slot && <span className="mz-rcp-slotch">{recipe.slot}</span>}
        {recipe.role !== 'standard' && <span className="mz-rcp-rolet">{roleLabel(recipe.role)}</span>}
        {recipe.starred && <span className="mz-rcp-star" aria-hidden="true">★</span>}
        <span className={`mz-rcp-fitb${pending ? ' pending' : ''}`}>
          {pending ? '✨ Mezo' : `${Math.round(recipe.mezoFit.score! * 100)} fit`}
        </span>
      </div>
      <div className="mz-rcpbody">
        <div className="mz-rcp-nm">{recipe.name}</div>
        <div className="mz-rcpmeta">
          <span>{recipe.ingredients.length} hozzávaló</span>
          <span>·</span>
          <span>{totalMins} perc</span>
          <span>·</span>
          <span className={`mz-rcp-novadot n${recipe.novaDominant}`} aria-hidden="true" />
          <span>NOVA {recipe.novaDominant}</span>
        </div>
        <MCells
          cells={[
            { label: 'kcal', value: perServing.kcal, tone: 'sage' },
            { label: 'fehérje', value: `${perServing.p} g`, tone: 'coral' },
            { label: 'szénh.', value: `${perServing.c} g`, tone: 'amber' },
            { label: 'zsír', value: `${perServing.f} g`, tone: 'lav' },
          ]}
        />
        {recipe.timesLogged > 0 ? (
          <div className="mz-rcpfoot">
            <span>{recipe.timesLogged}× logolva</span>
            <span className="mz-rcp-avg">✨ {Math.round(recipe.avgScore * 100)} p átlag</span>
            <span className="mz-rcp-last">utoljára {recipe.lastLogged}</span>
          </div>
        ) : (
          <div className="mz-rcpfoot">
            <span className="mz-rcp-unlogged">még nem logoltad</span>
          </div>
        )}
      </div>
    </button>
  )
}
