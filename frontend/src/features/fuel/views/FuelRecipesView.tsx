// ============================================================
// Mezo · FuelRecipesView (Receptek — recipe library sub-view)
// Port: prototype/src/fuel-recipes.jsx FuelRecipesView (58–161).
// Page header (Fuel · Receptek / Saját szakácskönyv + Új button), a 4-cell
// stats strip, a controlled search input, the RECIPE_FILTERS chip row, the
// filtered recipe list (RecipeCard) with empty-state, and the
// RecipeDetailSheet + NewRecipeSheet overlays.
//
// Adaptations vs prototype:
//  - Data comes from useRecipes() instead of window.MezoData.
//  - The local RecipeStat is the shared <StatCell> (identical label/val/sub/
//    color contract); StatCell expects a string val, so counts are stringified.
//  - Eyebrow / PageTitle / RecipeCard / RecipeDetailSheet / NewRecipeSheet are
//    the already-built primitives. Filter chips + Új stay native <button
//    className="chip"> (interactive, role=button) — the Chip primitive is a
//    non-interactive <span>.
// ============================================================
import { useState } from 'react'
import type { Recipe } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { StatCell } from '@/components/ui/StatCell'
import { RecipeCard } from '@/features/fuel/components/RecipeCard'
import { RecipeDetailSheet } from '@/features/fuel/RecipeDetailSheet'
import { NewRecipeSheet } from '@/features/fuel/NewRecipeSheet'

const RECIPE_FILTERS = [
  { id: 'all', label: 'Összes' },
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
  { id: 'starred', label: '★' },
] as const

export function FuelRecipesView() {
  const { recipes } = useRecipes()
  const [filter, setFilter] = useState<string>('all')
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = recipes.filter(r => {
    if (filter === 'starred') return r.starred
    if (filter !== 'all' && r.category !== filter) return false
    if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const starred = recipes.filter(r => r.starred)
  const totalLogs = recipes.reduce((a, r) => a + r.timesLogged, 0)

  return (
    <>
      <div className="screen-content" style={{ paddingTop: 96 }}>
        <div className="page-header">
          <div>
            <Eyebrow brand>Fuel · Receptek</Eyebrow>
            <PageTitle className="mt-sm">Saját szakácskönyv</PageTitle>
          </div>
          <button onClick={() => setNewOpen(true)} className="chip brand" style={{ padding: '8px 10px' }}>
            <Icon name="plus" size={12} /> Új
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card notch-4" style={{ padding: 12 }}>
            <div className="row gap-md" style={{ justifyContent: 'space-between' }}>
              <StatCell label="Receptek" val={String(recipes.length)} sub="összesen" color="var(--brand-glow)" />
              <StatCell label="Csillagos" val={String(starred.length)} sub="alaprecept" color="var(--warning)" />
              <StatCell label="Logolva" val={String(totalLogs)} sub="összesen" color="var(--cat-physiology)" />
              <StatCell label="Avg fit" val="0.89" sub="Mezo score" color="var(--cat-tendency)" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 24px 12px' }}>
          <div
            className="row gap-sm"
            style={{
              padding: '8px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Keress receptek között…"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ color: 'var(--text-tertiary)' }}>
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="row gap-xs flex-wrap" style={{ padding: '0 24px 16px' }}>
          {RECIPE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={'chip' + (filter === f.id ? ' brand' : '')}
              style={{ fontSize: 9, padding: '6px 10px' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ padding: '0 24px 24px' }}>
          <div className="col gap-md">
            {filtered.map(r => (
              <RecipeCard key={r.id} recipe={r} onOpen={setOpenRecipe} />
            ))}
            {filtered.length === 0 && (
              <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
                <span className="text-tertiary" style={{ fontSize: 12 }}>
                  Nincs egyező recept.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {openRecipe && <RecipeDetailSheet recipe={openRecipe} onClose={() => setOpenRecipe(null)} />}
      {newOpen && <NewRecipeSheet onClose={() => setNewOpen(false)} />}
    </>
  )
}
