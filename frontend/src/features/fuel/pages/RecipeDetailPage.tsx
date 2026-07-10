// ============================================================
// Mezo · RecipeDetailPage (Receptek — recipe detail PAGE)
// Approved full-page detail (docs/design/recipes-detail.html · "A" phone),
// consistent with the Kamra item detail being a route. Single scroll, v1-honest:
// editorial hero → /adag↔egész macro hero → meta strip → Hozzávalók (per-line
// contribution in MacroCells) → Logok (RecipeLogsList ← useRecipeLogs) → "Mezo-fit
// · hamarosan" sparkle zone → actions. Star / Szerkesztés / Törlés / + Mai
// étkezéshez are all LIVE (useRecipeActions / LogMealSheet). Route guard relies on useRecipes().recipes: mock is
// synchronous via initialData; real mode briefly shows the not-found fallback on
// a cold deep-link until the list resolves.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Recipe, RecipeInput, PantryCategoryMeta } from '@/data/types'
import { useRecipes, useRecipeActions, usePantry, useRecipeLogs } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { RecipeLogsList } from '@/features/fuel/components/RecipeLogsList'
import { RecipeFitBadge } from '@/features/fuel/components/RecipeFitBadge'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'

const NOVA_COLOR: Record<number, string> = { 1: 'var(--success)', 2: 'var(--warning)', 3: 'var(--warning)', 4: 'var(--error)' }

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
    ingredients: r.ingredients.map(i => ({ pantryItemId: i.refId, amount: i.amount, unit: i.unit, note: i.note ?? null })),
  }
}

function round(n: number) { return Math.round(n) }
function byBasis(v: number, basis: ServingBasis, servings: number) {
  return basis === 'whole' ? round(v) : round(v / Math.max(1, servings))
}

function MacroHeroCell({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="notch-8" style={{ textAlign: 'center', padding: '10px 2px', background: 'var(--surface-glass)' }}>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, lineHeight: 1, color: accent ? 'var(--success)' : 'var(--text-primary)' }}>{value}</div>
      <div className="label-mono" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 5 }}>{label}</div>
    </div>
  )
}

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes, categoryMeta } = useRecipes()
  // Source badge + left-border category color resolve against the dual-mode pantry
  // (the picker's source) — NOT useRecipes().ingredients (static mock seed), which
  // misses real-mode backend UUIDs and would drop the badge/border color (mezo-yew).
  // Line name + macros come from the persisted snapshot (line.name/line.contribution).
  const { ingredients } = usePantry()
  const { update, remove } = useRecipeActions()
  const [basis, setBasis] = useState<ServingBasis>('serving')
  const [logOpen, setLogOpen] = useState(false)
  // Today's logs of this recipe (mezo-cki). Called with `id ?? ''` alongside the other top-level
  // hooks — BEFORE the not-found early return — so hook order stays stable on a cold/not-found render.
  const { logs } = useRecipeLogs(id ?? '')

  const recipe = recipes.find(r => r.id === id)

  // Not-found fallback. The DATA section exposes no raw query status, so the guard
  // relies on useRecipes().recipes: mock mode resolves synchronously via initialData;
  // real mode shows this fallback briefly on a cold deep-link until the list resolves.
  if (!recipe) {
    return (
      <div style={{ padding: '0 24px' }}>
        <button
          onClick={() => navigate('/fuel/recipes')}
          className="notch-8"
          style={{ width: 32, height: 32, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, marginBottom: 14 }}
          aria-label="Vissza"
        >‹</button>
        <div className="card notch-4" style={{ padding: 20, textAlign: 'center' }}>
          <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ilyen recept.</span>
        </div>
      </div>
    )
  }

  const totalMins = recipe.prepMins + recipe.cookMins
  const macros = recipe.macros
  const catColor = (cat: string): string => (categoryMeta as Record<string, PantryCategoryMeta>)[cat]?.color ?? 'var(--text-secondary)'
  // resolve each line's pantry source for the subline (falls back to snapshot name only)
  const sourceOf = (refId: string) => ingredients.find(i => i.id === refId)?.source

  const toggleStar = () => update(recipe.id, { ...recipeToInput(recipe), starred: !recipe.starred })
  const del = () => { remove(recipe.id); navigate('/fuel/recipes') }

  return (
    <>
    <div style={{ padding: '0 16px 24px' }}>
      {/* Top bar */}
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 12px' }}>
        <button
          onClick={() => navigate('/fuel/recipes')}
          className="notch-8"
          style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
          aria-label="Vissza"
        >‹</button>
        <Eyebrow className="text-tertiary">Recept</Eyebrow>
        <div style={{ width: 34 }} />
      </div>

      {/* Hero */}
      <div className="notch-16" style={{ position: 'relative', height: 196, marginBottom: 14, overflow: 'hidden', background: 'linear-gradient(135deg,#16323a,#0f2027)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(125deg,rgba(255,255,255,0.025) 0 16px,rgba(255,255,255,0) 16px 32px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(5,7,9,0) 32%,rgba(5,7,9,0.9) 100%)' }} />
        <div className="row gap-xs" style={{ position: 'absolute', top: 11, left: 12, zIndex: 3, alignItems: 'center' }}>
          {recipe.slot && <span className="chip brand" style={{ fontSize: 8, padding: '3px 7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{recipe.slot}</span>}
          {recipe.starred && <Icon name="bookmark" size={13} color="var(--warning)" />}
        </div>
        <RecipeFitBadge score={recipe.mezoFit.score} size="hero" />
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 30, zIndex: 3, fontFamily: 'var(--ff-display)', fontSize: 28, fontWeight: 600, textTransform: 'uppercase', lineHeight: 0.98, color: 'var(--text-on-media)' }}>
          {recipe.name}
        </div>
        <div style={{ position: 'absolute', left: 14, bottom: 12, zIndex: 3, fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-on-media-dim)' }}>
          {recipe.servings} adag · {totalMins} perc · létrehozva {recipe.createdDate}
        </div>
      </div>

      {/* Macro hero */}
      <div style={{ marginBottom: 12 }}>
        <ServingToggle value={basis} servings={recipe.servings} onChange={setBasis} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        <MacroHeroCell value={byBasis(macros.kcal, basis, recipe.servings)} label="kcal" />
        <MacroHeroCell value={byBasis(macros.p, basis, recipe.servings)} label="Fehérje" accent />
        <MacroHeroCell value={byBasis(macros.c, basis, recipe.servings)} label="Szénh." />
        <MacroHeroCell value={byBasis(macros.f, basis, recipe.servings)} label="Zsír" />
      </div>

      {/* Meta strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, margin: '12px 0 16px' }}>
        {[
          { v: String(recipe.servings), l: 'Adag', c: undefined as string | undefined },
          { v: `${totalMins}p`, l: 'Idő', c: undefined },
          { v: String(recipe.novaDominant), l: 'NOVA', c: NOVA_COLOR[recipe.novaDominant] },
          { v: String(recipe.ingredients.length), l: 'Hozzáv.', c: undefined },
        ].map(m => (
          <div key={m.l} className="notch-4" style={{ textAlign: 'center', padding: '9px 2px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, fontWeight: 600, color: m.c ?? 'var(--text-primary)' }}>{m.v}</div>
            <div className="label-mono" style={{ fontSize: 7, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 3 }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Hozzávalók */}
      <div className="row" style={{ alignItems: 'center', gap: 9, margin: '4px 2px 10px' }}>
        <span className="label-mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>HOZZÁVALÓK</span>
        <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)' }}>{recipe.ingredients.length}</span>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
      </div>
      <div className="col gap-sm" style={{ marginBottom: 16 }}>
        {recipe.ingredients.map((line, i) => {
          const src = sourceOf(line.refId)
          return (
            <div key={i} className="card notch-4" style={{ padding: '10px 12px', borderLeft: '2px solid ' + catColor(ingredients.find(ii => ii.id === line.refId)?.category ?? '') }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div className="col flex-1" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{line.name}</span>
                  <span className="row gap-xs" style={{ fontFamily: 'var(--ff-mono)', fontSize: 8.5, color: 'var(--text-tertiary)', marginTop: 3, alignItems: 'center' }}>
                    {src && <SourceBadge source={src} />}
                    {line.note && <span>· {line.note}</span>}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {line.amount}<span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 1 }}>{line.unit}</span>
                </span>
              </div>
              <div style={{ marginTop: 9 }}>
                <MacroCells macros={line.contribution ?? { kcal: 0, p: 0, c: 0, f: 0 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Logok — today's logs of this recipe (mezo-cki) */}
      <div className="row" style={{ alignItems: 'center', gap: 9, margin: '4px 2px 10px' }}>
        <span className="label-mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>LOGOK</span>
        {logs.length > 0 && <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)' }}>{logs.length}</span>}
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <RecipeLogsList logs={logs} baselineScore={recipe.mezoFit.score ?? 0} />
      </div>

      {/* Mezo-fit reasoning deferral — the NUMERIC fit is live (deterministic v0, mezo-yta);
          only the prose/Reta-phase reasoning layer remains Phase-3 (P8). */}
      <div
        className="notch-12"
        style={{ margin: '16px 0', padding: '18px 16px', textAlign: 'center', background: 'rgba(20,184,166,0.05)', border: '1px dashed var(--border-brand)' }}
      >
        <div style={{ color: 'var(--brand-glow)', display: 'flex', justifyContent: 'center', marginBottom: 10, animation: 'mezo-twinkle 2.2s ease-in-out infinite' }}>
          <Icon name="sparkle" size={26} />
        </div>
        <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 600, textTransform: 'uppercase', color: 'var(--brand-glow)', marginBottom: 6 }}>
          Mezo-fit · indoklás hamarosan
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 260, margin: '0 auto' }}>
          A fit-pontszám már determinisztikus (makró + tápanyag + NOVA). A szöveges indoklás és a
          Reta-fázis-illeszkedés a Mezo-agy bekapcsolásakor érkezik (Phase-3).
        </div>
      </div>

      {/* Actions */}
      <button className="cta-primary notch-4" onClick={() => setLogOpen(true)} style={{ marginBottom: 9 }}>
        <Icon name="plus" size={14} /> Mai étkezéshez
      </button>
      <div className="row gap-sm">
        <button className="cta-ghost notch-4" onClick={toggleStar} style={{ flex: 1 }}>
          <Icon name="bookmark" size={12} /> {recipe.starred ? 'Csillag le' : 'Csillag'}
        </button>
        <button className="cta-ghost notch-4" onClick={() => navigate(`/fuel/recipes/${recipe.id}/edit`)} style={{ flex: 1.4 }}>
          <Icon name="settings" size={12} /> Szerkesztés
        </button>
        <button className="cta-ghost notch-4" onClick={del} style={{ flex: 1, color: 'var(--error)', borderColor: 'rgba(244,63,94,0.25)' }} aria-label="Törlés">
          <Icon name="x" size={12} /> Törlés
        </button>
      </div>
    </div>
    {logOpen && <LogMealSheet prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={() => setLogOpen(false)} />}
    </>
  )
}
