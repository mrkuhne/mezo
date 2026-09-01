// ============================================================
// Mezo · FuelRecipesPage (Receptek) — Mozaik re-face + entrance choreography
// (fidelity audit, mezo-d20.11). Source of truth: docs/design_2.0/prototypes/src/
// fuel-body.html #page-recept (p-coral, ×1.18).
//
// What changed vs the shipped page: it wore the pre-Mozaik `.pghead-np` header and had
// NO entrance choreography at all (audit group A). Now: MozaikPage(coral) → PageHead
// (‹ Fuel + `＋ Új`) → PageHero(i-recept, the catalog count counting up) → PageBody, all
// inside an EntranceGroup — the prototype's `.segtabs` filter (`.fh-segtabs`, with the
// per-tab count as the prototype's `<small>` line), its `.lsthead` "Katalógus" row with
// the live hit count, and the cards themselves rising with the prototype's 30 + i·30 ms
// stagger.
//
// The card itself (RecipeCard) already ports `.rcpcard` 1:1 — band + slot chip + role tag
// + ★ + fit pill, four tinted macro cells, and the live footer (timesLogged / avgScore /
// lastLogged). Detail + create stay routed pages.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe } from '@/data/types'
import { useRecipes } from '@/data/hooks'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { RecipeCard } from '@/features/fuel/components/RecipeCard'
import RecipesSkeleton from '@/features/fuel/pages/RecipesSkeleton'

type FilterId = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'starred'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Mind' },
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsi' },
  { id: 'snack', label: 'Snack' },
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
  const heroCount = useCountUp(recipes.length)

  const filtered = recipes.filter(r => {
    if (filter === 'all') return true
    if (filter === 'starred') return r.starred
    return r.category === filter
  })

  // Real-mode loading window — skeleton before the empty-state list (hooks are all
  // above, so hook order stays stable). Mock mode never sets pending (mezo-f2z).
  if (pending) return <RecipesSkeleton />

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate('/fuel')} label="‹ Fuel">
        {/* Receptműhely (mezo-92pb) — the AI builder sits next to the manual editor. */}
        <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={() => navigate('/fuel/recipes/muhely')}>
          ✨ Műhely
        </button>
        <button type="button" className="pgact" onClick={() => navigate('/fuel/recipes/new')}>
          <Icon name="plus" size={12} /> Új
        </button>
      </PageHead>

      <EntranceGroup>
        <PageHero icon="i-recept" big={heroCount} name="Receptek" />

        <PageBody principle="A fit-jelvény ✨, amíg a Mezo még nem pontozta — a szám csak akkor kerül ki, ha valóban megszületett.">
          {/* Type filter — the prototype's .segtabs, each segment carrying its own count */}
          <div className="fh-segtabs rise" style={{ '--d': '30ms' } as React.CSSProperties} aria-label="Recept-szűrő">
            {FILTERS.map(f => {
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.id)}
                  className={active ? 'on' : undefined}
                >
                  {f.label}
                  <small>{countFor(recipes, f.id)}</small>
                </button>
              )
            })}
          </div>

          <div className="fh-lsthead rise" style={{ '--d': '60ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">Katalógus</span>
            <span className="cnt">{filtered.length} / {recipes.length}</span>
          </div>

          {filtered.map((r, i) => (
            <RecipeCard key={r.id} recipe={r} delayMs={30 + i * 30} onOpen={() => navigate(`/fuel/recipes/${r.id}`)} />
          ))}
          {filtered.length === 0 && (
            <div className="fh-nohit rise" style={{ '--d': '90ms' } as React.CSSProperties}>Nincs egyező recept.</div>
          )}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
