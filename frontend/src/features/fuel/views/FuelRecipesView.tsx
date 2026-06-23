// ============================================================
// Mezo · FuelRecipesView (Receptek — editorial library)
// Approved redesign (docs/design/recipes-library.html): editorial RecipeCards +
// a segmented typebar filter (Mind / Reggeli / Ebéd / Vacsi / ★ with live counts,
// the Kamra typebar pattern) replacing the old chip row. The fake "Avg fit 0.89"
// stat is removed; the header sub shows real counts. Detail + create are now
// routed PAGES — the card navigates to /fuel/recipes/:id, +Új to /fuel/recipes/new
// (the old RecipeDetailSheet / NewRecipeSheet overlays are retired).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { RecipeCard } from '@/features/fuel/components/RecipeCard'

type FilterId = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'starred'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsi' },
  { id: 'starred', label: '★' },
]

function countFor(recipes: Recipe[], id: FilterId): number {
  if (id === 'all') return recipes.length
  if (id === 'starred') return recipes.filter(r => r.starred).length
  return recipes.filter(r => r.category === id).length
}

export function FuelRecipesView() {
  const navigate = useNavigate()
  const { recipes } = useRecipes()
  const [filter, setFilter] = useState<FilterId>('all')

  const starredCount = recipes.filter(r => r.starred).length
  const filtered = recipes.filter(r => {
    if (filter === 'all') return true
    if (filter === 'starred') return r.starred
    return r.category === filter
  })

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Fuel · Receptek</Eyebrow>
          <PageTitle className="mt-sm">Receptek</PageTitle>
          <span className="label-mono" style={{ display: 'block', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginTop: 5 }}>
            {recipes.length} recept · {starredCount} csillagos
          </span>
        </div>
        <button onClick={() => navigate('/fuel/recipes/new')} className="chip brand" style={{ padding: '8px 10px' }}>
          <Icon name="plus" size={12} /> Új
        </button>
      </div>

      {/* Segmented typebar */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ gap: 5, padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 13 }}>
          {FILTERS.map(f => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="notch-8 col flex-1"
                style={{ alignItems: 'center', padding: '8px 0 7px', background: active ? 'var(--brand-primary)' : 'transparent', boxShadow: active ? '0 8px 18px -8px rgba(20,184,166,0.6)' : undefined }}
              >
                <span style={{ fontFamily: 'var(--ff-display)', fontSize: 13, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', lineHeight: 1, color: active ? 'var(--text-inverse)' : 'var(--text-secondary)' }}>{f.label}</span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, marginTop: 3, color: active ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>{countFor(recipes, f.id)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="col" style={{ gap: 13 }}>
          {filtered.map(r => (
            <RecipeCard key={r.id} recipe={r} onOpen={() => navigate(`/fuel/recipes/${r.id}`)} />
          ))}
          {filtered.length === 0 && (
            <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs egyező recept.</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
