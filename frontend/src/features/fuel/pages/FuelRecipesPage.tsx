// ============================================================
// Mezo · FuelRecipesPage (Receptek — editorial library)
// Approved redesign (docs/design/recipes-library.html): pghead-np sage own header
// (over "Fuel · Receptek", h1 "Receptek", pgact-np "+ Új") + editorial RecipeCards +
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
import { Icon } from '@/shared/ui/Icon'
import { RecipeCard } from '@/features/fuel/components/RecipeCard'
import RecipesSkeleton from '@/features/fuel/pages/RecipesSkeleton'

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

export function FuelRecipesPage() {
  const navigate = useNavigate()
  const { recipes, pending } = useRecipes()
  const [filter, setFilter] = useState<FilterId>('all')

  const starredCount = recipes.filter(r => r.starred).length
  const filtered = recipes.filter(r => {
    if (filter === 'all') return true
    if (filter === 'starred') return r.starred
    return r.category === filter
  })

  // Real-mode loading window — skeleton before the empty-state list (hooks are all
  // above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <RecipesSkeleton />

  return (
    <>
      <div className="pghead-np sage">
        <div>
          <div className="over">Fuel · Receptek</div>
          <h1>Receptek</h1>
          <span className="label-mono" style={{ display: 'block', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginTop: 5 }}>
            {recipes.length} recept · {starredCount} csillagos
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/fuel/recipes/new')}
          className="pgact-np np-press"
          style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
        >
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
                className="rad-16 col flex-1"
                style={{ alignItems: 'center', padding: '8px 0 7px', background: active ? 'var(--coral)' : 'transparent', boxShadow: active ? '0 8px 18px -8px color-mix(in srgb, var(--sage) 60%, transparent)' : undefined }}
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
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs egyező recept.</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
