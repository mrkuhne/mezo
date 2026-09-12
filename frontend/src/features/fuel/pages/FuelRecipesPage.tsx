// ============================================================
// Mezo · FuelRecipesPage (Receptek) — a Konyha egyik ajtaja mögötti könyvtár
// (Fuel Titanium S4, mezo-hygp; fagyasztott manifeszt B8).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `receptekPage` (:43) + `recipeTile` (:39), a fuel-pages.css „Konyha v2" (:497) blokkjával.
// Anatómia: al-fejléc (‹ Konyha + KONYHA/Receptek) → blokk-szűrők a saját darabszámukkal →
// két-hasábos csempe-rács (blokk-hue, tál-ikon, AI-pontszám chip, kcal/adag, makró-sáv) →
// őszinte üres állapot, ami cselekvésre hív.
//
// B10 owner-döntés: a Receptműhely gombja LEJÖTT erről a lapról — a Műhely a Konyha hub
// saját posztere. Ide NE kerüljön vissza.
//
// Változatlan viselkedés: a szűrés tengelye, a valódi módú betöltő csontváz (mezo-f2z), a
// `＋ Új` a kézi szerkesztőbe, és a csempe a részletlapra visz.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe, RecipeCategory } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { ClayIcon } from '@/shared/ui/clay'
import { hu1, huInt } from '@/shared/lib/huNum'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { FuelScoreChip } from '@/features/fuel/components/FuelMealBlocks'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { roleLabel } from '@/features/fuel/logic/recipeRole'
import RecipesSkeleton from '@/features/fuel/pages/RecipesSkeleton'

type FilterId = 'all' | RecipeCategory | 'starred'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsi' },
  { id: 'snack', label: 'Snack' },
  { id: 'starred', label: 'Csillagos' },
]

function matches(r: Recipe, id: FilterId): boolean {
  if (id === 'all') return true
  if (id === 'starred') return r.starred
  return r.category === id
}

function RecipeTile({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const face = recipeSlotFace(recipe.category)
  const perServing = Math.round(recipe.macros.kcal / Math.max(1, recipe.servings))
  const pK = recipe.macros.p * 4, cK = recipe.macros.c * 4, fK = recipe.macros.f * 9
  const total = pK + cK + fK || 1
  const mins = recipe.prepMins + recipe.cookMins
  return (
    <button type="button" className="fkx-recipe rise"
      style={{ '--fkx': face.color } as React.CSSProperties} onClick={onOpen}>
      <span className="fkx-recipe-top">
        <span className="fkx-recipe-art" aria-hidden="true"><ClayIcon name="i-tanyer" size={48} /></span>
        <FuelScoreChip scorePct={recipe.mezoFit.score == null ? null : Math.round(recipe.mezoFit.score * 100)} />
      </span>
      <strong>{recipe.name}</strong>
      <span className="fkx-recipe-kcal"><b>{huInt(perServing)}</b> kcal / adag</span>
      <span className="fkx-macro-bar" role="img" aria-label={`Makró-arány: fehérje ${hu1(recipe.macros.p)} g, szénhidrát ${hu1(recipe.macros.c)} g, zsír ${hu1(recipe.macros.f)} g`}>
        <i style={{ '--w': `${(pK / total) * 100}%`, '--c': 'var(--macro-protein)' } as React.CSSProperties} />
        <i style={{ '--w': `${(cK / total) * 100}%`, '--c': 'var(--macro-carbs)' } as React.CSSProperties} />
        <i style={{ '--w': `${(fK / total) * 100}%`, '--c': 'var(--macro-fat)' } as React.CSSProperties} />
      </span>
      <span className="fkx-recipe-meta">
        <span aria-hidden="true"><ClayIcon name={face.icon} size={16} /></span>
        {face.label}{mins > 0 ? ` · ${mins} perc` : ''}
        {/* A szerep a MÉRCÉT nevezi meg, amihez a pontszám mér (mezo-uavr). Az „Általános" a
            hallgatólagos alapeset, ezért SOHA nem kap jelölést. */}
        {recipe.role !== 'standard' && <em className="fkx-role">{roleLabel(recipe.role)}</em>}
      </span>
    </button>
  )
}

export function FuelRecipesPage() {
  const navigate = useNavigate()
  const { recipes, pending } = useRecipes()
  const [filter, setFilter] = useState<FilterId>('all')

  const filtered = recipes.filter(r => matches(r, filter))

  // Real-mode loading window — skeleton before the empty-state list (hooks are all
  // above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <RecipesSkeleton />

  return (
    <div className="fmx-page fkx-library">
      <EntranceGroup>
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel/konyha')} aria-label="Vissza">‹ Konyha</button>
          <span>
            <small>KONYHA</small>
            <strong>Receptek</strong>
          </span>
          <button type="button" className="fkx-head-act" onClick={() => navigate('/fuel/recipes/new')}>
            ＋ Új
          </button>
        </div>

        <div className="fkx-filters" role="group" aria-label="Recept-szűrő" data-kalauz-anchor="receptek-tabs">
          {FILTERS.map(f => {
            const n = recipes.filter(r => matches(r, f.id)).length
            const face = f.id === 'all' || f.id === 'starred' ? null : recipeSlotFace(f.id)
            return (
              <button key={f.id} type="button" aria-pressed={filter === f.id}
                style={{ '--fkx': face?.color ?? 'var(--lav)' } as React.CSSProperties}
                onClick={() => setFilter(f.id)}>
                {face && <span aria-hidden="true"><ClayIcon name={face.icon} size={16} /></span>}
                {f.label}<b>{n}</b>
              </button>
            )
          })}
        </div>

        {filtered.length > 0 ? (
          <div className="fkx-tile-grid">
            {filtered.map(r => (
              <RecipeTile key={r.id} recipe={r} onOpen={() => navigate(`/fuel/recipes/${r.id}`)} />
            ))}
          </div>
        ) : (
          <div className="fkx-empty">
            <span aria-hidden="true"><ClayIcon name="i-tanyer" size={52} /></span>
            <strong>Ebben a blokkban még nincs recepted.</strong>
            <button type="button" onClick={() => navigate('/fuel/recipes/new')}>Mentsünk egyet ＋</button>
          </div>
        )}
      </EntranceGroup>
    </div>
  )
}
