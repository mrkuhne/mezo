// ============================================================
// Mezo · RecipeDetailPage (Receptek — recipe detail PAGE)
// F7.3 Mozaik re-face (mezo-d20.8.3.1, fuel-mely.html + spec
// 2026-08-31-fuel-mely-kor.md §B): the two-tab layout is replaced by a MOSAIC —
// the page stays one screen, depth is one tap away. Anatomy: MozaikPage(coral) →
// PageHead(‹ Receptek, Szerkesztés) → hero card (warm image band + slot chip +
// ★ + fit badge; name/meta on the card surface) → Makró eyebrow + ServingToggle
// + mz-statstrip → 2×2 mz-mosaic: Pontszám (score + top dims → RecipeScoreSheet,
// the SAME ScoreBreakdownBody the MealScoreSheet renders — one surface, two
// callers), Mezo·olvasat (static prose tile + fit chip), Hozzávalók (count +
// names → a LOCAL sliding view, not a route — the prep tile-page precedent),
// Logok (count + latest → a small sheet) → actions (Mai étkezéshez CTA +
// Csillag/Törlés ghosts). The recipe-level NutrientCells moved into the
// Hozzávalók view (above the lines) — the main page carries the four macro
// cells only. All data/behavior (serving-basis math, lazy AI breakdown,
// useRecipeActions, LogFlow prefill, route guard) is unchanged.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Recipe, RecipeInput, PantryCategoryMeta, Nutrients } from '@/data/types'
import { useRecipes, useRecipeActions, useRecipeBreakdown, usePantry, useRecipeLogs } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { Sheet } from '@/shared/ui/Sheet'
import { ScoreRing } from '@/shared/ui/ScoreRing'
import { MozaikPage, PageHead, PageBody, StatStrip, StatCell } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { RecipeScoreSheet } from '@/features/fuel/sheets/RecipeScoreSheet'
import { Icon } from '@/shared/ui/Icon'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import { NO_NUTRIENTS, scaleNutrients } from '@/data/fuel/recipeMacros'
import { RecipeLogsList } from '@/features/fuel/components/RecipeLogsList'
import { RecipeFitBadge } from '@/features/fuel/components/RecipeFitBadge'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import { roleLabel } from '@/features/fuel/logic/recipeRole'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'

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
  const { recipes, categoryMeta } = useRecipes()
  // Source badge + left-border category color resolve against the dual-mode pantry
  // (the picker's source) — NOT useRecipes().ingredients (static mock seed), which
  // misses real-mode backend UUIDs and would drop the badge/border color (mezo-yew).
  // Line name + macros come from the persisted snapshot (line.name/line.contribution).
  const { ingredients } = usePantry()
  const { update, remove } = useRecipeActions()
  const [basis, setBasis] = useState<ServingBasis>('serving')
  const [logOpen, setLogOpen] = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [ingrOpen, setIngrOpen] = useState(false)
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
      <div style={{ padding: '0 24px' }}>
        <button
          onClick={() => navigate('/fuel/recipes')}
          className="rad-16"
          style={{ width: 32, height: 32, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, marginBottom: 14 }}
          aria-label="Vissza"
        >‹</button>
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
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

  // A hozzávalók LOCAL view (not a route): the tile swaps the whole page content,
  // the back chip swaps it back — the prep tile-page precedent (spec §B3).
  if (ingrOpen) {
    return (
      <MozaikPage tone="gold">
        <PageHead onBack={() => setIngrOpen(false)} label="‹ Recept" />
        <EntranceGroup>
          <PageBody>
            <div className="row rise" style={{ alignItems: 'center', margin: '4px 2px 10px' }}>
              <span className="mz-eyebrow">Hozzávalók · {recipe.ingredients.length}</span>
              <span style={{ flex: 1 }} />
              <ServingToggle value={basis} servings={recipe.servings} onChange={setBasis} />
            </div>
            <div className="rise" style={{ '--d': '40ms', marginBottom: 10 } as React.CSSProperties}>
              <NutrientCells nutrients={nutrientsByBasis(recipe.nutrients ?? NO_NUTRIENTS, basis, recipe.servings)} size="md" />
            </div>
            <div className="col gap-sm">
              {recipe.ingredients.map((line, i) => {
                const src = sourceOf(line.refId)
                return (
                  <div key={i} className="mz-qcard rise" style={{ '--d': `${70 + i * 30}ms`, padding: '10px 12px', borderLeft: '3px solid ' + catColor(ingredients.find(ii => ii.id === line.refId)?.category ?? '') } as React.CSSProperties}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div className="col flex-1" style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{line.name}</span>
                        <span className="row gap-xs" style={{ fontSize: 8.5, color: 'var(--text-tertiary)', marginTop: 3, alignItems: 'center' }}>
                          {src && <SourceBadge source={src} />}
                          {line.note && <span>· {line.note}</span>}
                        </span>
                      </div>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                        {line.amount}<span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 1 }}>{line.unit}</span>
                      </span>
                    </div>
                    <div style={{ marginTop: 9 }}>
                      <MacroCells macros={line.contribution ?? { kcal: 0, p: 0, c: 0, f: 0 }} />
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <NutrientCells nutrients={line.nutrients ?? NO_NUTRIENTS} empty="dashes" />
                    </div>
                  </div>
                )
              })}
            </div>
          </PageBody>
        </EntranceGroup>
      </MozaikPage>
    )
  }

  // top-2 dims for the Pontszám tile's bottom line (the sheet carries the full set)
  const topDims = breakdown
    ? [...breakdown.dimensions].sort((a, b) => b.score - a.score).slice(0, 2)
    : []
  // The tile's ring value (0..1): the AI fit score when it exists, else the deterministic
  // weighted total — the SAME Σ(score×weight) the sheet already shows per-dimension as pts.
  // Never a lying 0-ring next to "8 szempont" (caught by reading the first golden).
  const tileScore = recipe.mezoFit.score
    ?? (breakdown ? breakdown.dimensions.reduce((a, d) => a + d.score * d.weight, 0) : null)

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate('/fuel/recipes')} label="‹ Receptek">
        <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/fuel/recipes/${recipe.id}/edit`)}>
          Szerkesztés
        </button>
      </PageHead>

      <EntranceGroup>
        <PageBody>
          {/* Hero — warm image band (the prototype's gradient placeholder; no real image on
              the wire) + slot chip + ★ + fit badge; name/meta on the card surface below. */}
          <div className="mz-qcard rise" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ position: 'relative', height: 108, background:
              'radial-gradient(120% 110% at 18% 8%, rgba(255,255,255,0.5), transparent 42%), linear-gradient(140deg,#F4D9A8 0%,#E8B87A 48%,#C98F52 100%)' }}>
              <div className="row gap-xs" style={{ position: 'absolute', top: 10, left: 11, zIndex: 3, alignItems: 'center' }}>
                {recipe.slot && <span className="chip brand" style={{ fontSize: 8, padding: '3px 7px', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(255,253,249,0.9)' }}>{recipe.slot}</span>}
                {recipe.starred && <Icon name="bookmark" size={13} color="var(--warning)" />}
              </div>
              <RecipeFitBadge score={recipe.mezoFit.score} size="hero" />
            </div>
            <div style={{ padding: '12px 14px 13px' }}>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1.1, color: 'var(--text-primary)' }}>
                {recipe.name}
              </div>
              <div style={{ marginTop: 5, fontVariantNumeric: 'tabular-nums', fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                {recipe.servings} adag · {totalMins} perc · <span style={{ color: NOVA_COLOR[recipe.novaDominant], fontWeight: 600 }}>NOVA {recipe.novaDominant}</span>
                {recipe.role !== 'standard' && (
                  <> · <span style={{ color: 'var(--coral-deep)', fontWeight: 600 }}>{roleLabel(recipe.role)}</span></>
                )} · létrehozva {recipe.createdDate}
              </div>
            </div>
          </div>

          {/* Makró — eyebrow + serving toggle + stat strip */}
          <div className="row rise" style={{ '--d': '40ms', alignItems: 'center', margin: '12px 2px 8px' } as React.CSSProperties}>
            <span className="mz-eyebrow">Makró</span>
            <span style={{ flex: 1 }} />
            <ServingToggle value={basis} servings={recipe.servings} onChange={setBasis} />
          </div>
          <div className="rise" style={{ '--d': '70ms' } as React.CSSProperties}>
            <StatStrip>
              <StatCell value={byBasis(macros.kcal, basis, recipe.servings)} label="kcal" />
              <StatCell value={byBasis(macros.p, basis, recipe.servings)} label="fehérje" />
              <StatCell value={byBasis(macros.c, basis, recipe.servings)} label="szénhidrát" />
              <StatCell value={byBasis(macros.f, basis, recipe.servings)} label="zsír" />
            </StatStrip>
          </div>

          {/* A 2×2 mozaik — the page's depth index. Tiles open the sheet/local view. */}
          <div className="mz-mosaic rise" style={{ '--d': '110ms', marginTop: 11 } as React.CSSProperties}>
            {/* Pontszám — the tile is tappable only once the breakdown exists */}
            <button
              type="button"
              className="mz-tile mz-w-sage"
              data-testid="recipe-score-tile"
              disabled={!breakdown || breakdownBusy}
              onClick={() => setScoreOpen(true)}
            >
              <div className="mz-tile-top"><span className="mz-eyebrow">Pontszám</span><span className="mz-chev">›</span></div>
              {breakdownBusy ? (
                <span className="text-tertiary np-twinkle" style={{ fontSize: 10.5, marginTop: 8 }}>
                  {breakdownRefreshing ? 'Mezo újraértékeli…' : 'Mezo értékeli…'}
                </span>
              ) : breakdown ? (
                <>
                  <div className="row" style={{ alignItems: 'center', gap: 9, marginTop: 6 }}>
                    <ScoreRing pct={tileScore ?? 0} size={44} stroke={4} label={String(Math.round((tileScore ?? 0) * 100))} labelColor="var(--mz-yes-ink)" />
                    <span style={{ fontSize: 9.5, color: 'var(--mz-ink-soft)' }}>
                      <b>{breakdown.dimensions.length} szempont</b><br />megbízh. {Math.round(breakdown.confidence * 100)}%
                    </span>
                  </div>
                  {topDims.length > 0 && (
                    <span style={{ fontSize: 8.5, color: 'var(--text-tertiary)', marginTop: 'auto' }}>
                      legerősebb: {topDims.map(d => `${d.label.split('·')[0].trim().toLowerCase()} ${Math.round(d.score * 100)}`).join(' · ')}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-tertiary" style={{ fontSize: 10, marginTop: 8 }}>
                  Sablon-pontszámhoz még nincs elég adat (kcal nélküli hozzávalók).
                </span>
              )}
            </button>

            {/* Mezo · olvasat — static prose tile (the full reading fits; spec §B3) */}
            <div className="mz-tile mz-w-lav" data-testid="recipe-olvasat-tile">
              <div className="mz-tile-top"><span className="mz-eyebrow">Mezo · olvasat</span></div>
              {!breakdownBusy && breakdown?.summary ? (
                <>
                  <p style={{ fontSize: 10, lineHeight: 1.45, marginTop: 6, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    <SafeMarkdown text={breakdown.summary} />
                  </p>
                  {fitsFor.length > 0 && (
                    <span className="chip brand" style={{ fontSize: 8, padding: '2px 7px', marginTop: 'auto', alignSelf: 'flex-start' }}>● {fitsFor[0]}</span>
                  )}
                </>
              ) : (
                <span className="text-tertiary" style={{ fontSize: 10, marginTop: 8 }}>
                  {breakdownBusy ? 'Mezo olvasata készül…' : 'Még nincs olvasat.'}
                </span>
              )}
            </div>

            {/* Hozzávalók — count + names, opens the local view */}
            <button type="button" className="mz-tile mz-w-gold" data-testid="recipe-ingredients-tile" onClick={() => setIngrOpen(true)}>
              <div className="mz-tile-top"><span className="mz-eyebrow">Hozzávalók</span><span className="mz-chev">›</span></div>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 300, marginTop: 4 }}>{recipe.ingredients.length}</span>
              <span style={{ fontSize: 9, color: 'var(--mz-ink-soft)', marginTop: 'auto', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {recipe.ingredients.map(l => (l.name ?? '').split('·')[0].trim()).filter(Boolean).join(' · ')}
              </span>
            </button>

            {/* Logok — count + latest, opens the log sheet */}
            <button type="button" className="mz-tile mz-w-sky" data-testid="recipe-logs-tile" onClick={() => setLogsOpen(true)}>
              <div className="mz-tile-top"><span className="mz-eyebrow">Logok</span><span className="mz-chev">›</span></div>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 300, marginTop: 4 }}>{logs.length}</span>
              <span style={{ fontSize: 9, color: 'var(--mz-ink-soft)', marginTop: 'auto' }}>
                {logs.length > 0 ? 'ma is a naplódban' : 'ma még nincs logolva'}
              </span>
            </button>
          </div>

          {/* Actions — unchanged behavior */}
          <button className="cta-primary rise" onClick={() => setLogOpen(true)} style={{ '--d': '160ms', margin: '12px 0 9px', width: '100%' } as React.CSSProperties}>
            <Icon name="plus" size={14} /> Mai étkezéshez
          </button>
          {/* Receptműhely (mezo-92pb) — iterate on THIS recipe: the workshop seeds its draft
              from it (?recipeId) and saves back as an update, not a second copy. */}
          <button
            className="cta-ghost rise"
            onClick={() => navigate(`/fuel/recipes/muhely?recipeId=${recipe.id}`)}
            style={{ '--d': '175ms', width: '100%', marginBottom: 9 } as React.CSSProperties}
          >
            ✨ Iterálás a Műhelyben
          </button>
          <div className="row gap-sm rise" style={{ '--d': '190ms' } as React.CSSProperties}>
            <button className="cta-ghost" onClick={toggleStar} style={{ flex: 1 }}>
              <Icon name="bookmark" size={12} /> {recipe.starred ? 'Csillag le' : 'Csillag'}
            </button>
            <button className="cta-ghost" onClick={del} style={{ flex: 1, color: 'var(--error)', borderColor: 'rgba(244,63,94,0.25)' }} aria-label="Törlés">
              <Icon name="x" size={12} /> Törlés
            </button>
          </div>
        </PageBody>
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
    </MozaikPage>
  )
}
