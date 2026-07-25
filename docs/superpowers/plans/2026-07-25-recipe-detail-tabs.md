# Recipe Detail Two-Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `RecipeDetailPage` from one long scroll into a shared header (hero + macros) + two in-page tabs — „Részletek" (default: AI breakdown + PONTSZÁM + Logok) and „Hozzávalók" — so the AI evaluation is immediately visible.

**Architecture:** Single-file layout restructure of `frontend/src/features/fuel/pages/RecipeDetailPage.tsx` following the `GrowthPage.tsx` local-`useState` `role="tablist"`/`SegButton` pattern (NOT routed). The meta strip is deleted; NOVA moves into the hero meta line. No data-layer, hook, contract, or backend change.

**Tech Stack:** React 19 + Vite, Vitest + Testing Library, TanStack Query (untouched), design tokens from `prototype.css`.

**Spec:** `docs/superpowers/specs/2026-07-25-recipe-detail-tabs-design.md` · **Mockup (approved):** `docs/superpowers/specs/2026-07-25-recipe-detail-tabs-mockup.html` · **Driving issue:** `mezo-n3xa`

## Global Constraints

- **Read `docs/references/frontend_conventions.md` before touching `frontend/src`** (house standard; this plan complies with it — verify, don't deviate).
- UI copy Hungarian; code/comments/commits English. Commit subjects carry `(mezo-n3xa)`.
- **Worktree commit rule (memory `bd-hooks-pollute-worktree-commits`):** always commit with `git -c core.hooksPath=/dev/null commit …` and never stage `.beads/issues.jsonl`.
- **bd runs from the main checkout** (`cd /Users/daniel.kuhne/MrKuhne/mezo && bd …`) — worktrees have no `.dolt`.
- Colors via `var(--token)` only — active tab wash is `var(--wash-gym)` (the house coral wash `chip.brand` uses; there is no `--wash-fuel`/`--wash-coral`).
- No new `*Screen`/`*View`; the tab is component-local state, `FUEL_TABS` routing untouched.
- Gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — **both modes green**.
- Working dir: the worktree `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-2`, branch `feat/recipe-detail-tabs`.

---

### Task 1: RecipeDetailPage two-tab restructure (TDD)

**Files:**
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx`
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx`

**Interfaces:**
- Consumes: existing hooks/components only (`useRecipes`, `usePantry`, `useRecipeActions`, `useRecipeLogs`, `useRecipeBreakdown`, `ScoreBreakdownBody`, `RecipeLogsList`, `ServingToggle`, `MacroCells`, `SourceBadge`, `RecipeFitBadge`, `LogMealSheet`) — none change.
- Produces: no exported API change; `recipeToInput` export stays as-is.

- [ ] **Step 1: Update the test file — rewrite one test, add two**

In `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx`:

**(a)** Replace the whole test `renders the hero, macro hero and ingredient contributions` (currently the first `test(…)` block) with:

```tsx
test('default tab is Részletek: hero, macro hero and breakdown visible, ingredients hidden (mezo-n3xa)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  expect(await screen.findByText(r.name)).toBeInTheDocument()
  // whole-recipe kcal appears in the macro hero
  expect(screen.getByText(String(r.macros.kcal))).toBeInTheDocument()
  // the breakdown section is immediately visible on the default tab
  expect(screen.getByText('PONTSZÁM')).toBeInTheDocument()
  // ingredient rows moved to the Hozzávalók tab
  expect(screen.queryByText(r.ingredients[0].name!)).toBeNull()
  // tablist renders with Részletek selected
  expect(screen.getByRole('tab', { name: 'Részletek' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: /Hozzávalók/ })).toHaveAttribute('aria-selected', 'false')
})
```

**(b)** Add after it:

```tsx
test('switching to Hozzávalók shows the ingredient lines and keeps the actions (mezo-n3xa)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('tab', { name: /Hozzávalók/ }))
  expect(screen.getByText(r.ingredients[0].name!)).toBeInTheDocument()
  // breakdown content hides with the tab
  expect(screen.queryByText('PONTSZÁM')).toBeNull()
  // the tab label carries the line count
  expect(screen.getByRole('tab', { name: /Hozzávalók/ }).textContent).toContain(String(r.ingredients.length))
  // page actions stay below the tab content on both tabs
  expect(screen.getByRole('button', { name: /mai étkezéshez/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Törlés/ })).toBeInTheDocument()
})

test('the hero meta line carries the NOVA value and the meta strip is gone (mezo-n3xa)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  // NOVA moved into the hero meta line (textContent spans the colored child span)
  expect(screen.getByText(/létrehozva/).textContent).toContain(`NOVA ${r.novaDominant}`)
  // the old 4-cell meta strip is deleted
  expect(screen.queryByText('Idő')).toBeNull()
  expect(screen.queryByText('Hozzáv.')).toBeNull()
})
```

All other existing tests stay byte-identical — they exercise the default (Részletek) tab or shared chrome, which keeps rendering.

- [ ] **Step 2: Run the test file — the three touched tests must FAIL**

Run: `cd frontend && pnpm test RecipeDetailPage.test`
Expected: FAIL — no `role="tab"` elements yet, ingredient name IS found on initial render, `NOVA {n}` not in the meta line. The untouched tests still pass.

- [ ] **Step 3: Restructure `RecipeDetailPage.tsx`**

Replace the file's content with the version below. It is the current file with exactly these deltas: updated header comment; new `DetailTab` type + local `DetailTabButton`; `tab` state; NOVA span in the hero meta line; the tablist after the macro hero; meta strip deleted; the Hozzávalók list (its `sech` header dropped — the tab is the header) wrapped in the `hozzavalok` tab; breakdown + PONTSZÁM + LOGOK (reordered: logs now AFTER the score) wrapped in the `reszletek` tab; actions left outside the tabs. Everything else — guard, hooks, actions, `recipeToInput` — is byte-identical.

```tsx
// ============================================================
// Mezo · RecipeDetailPage (Receptek — recipe detail PAGE)
// Two-tab redesign (mezo-n3xa, docs/superpowers/specs/2026-07-25-recipe-detail-tabs-design.md,
// approved mockup …-mockup.html): shared header — editorial hero (image band + name/meta on the
// card surface, var(--ink)/var(--faint); meta line carries NOVA since the meta strip's removal)
// → /adag↔egész macro hero — then two in-page tabs (GrowthPage SegButton tablist pattern, local
// state, NOT routed): „Részletek" (default: Mezo · sablon-olvasat + PONTSZÁM — mezo-bw3y
// deterministic dims + lazy AI prose, ScoreBreakdownBody shared with MealScoreSheet — then Logok
// ← useRecipeLogs) and „Hozzávalók · N" (per-line contribution in MacroCells). Actions below the
// tab content on both tabs: Star / Szerkesztés / Törlés / + Mai étkezéshez, all LIVE
// (useRecipeActions / LogMealSheet). Route guard relies on useRecipes().recipes: mock is
// synchronous via initialData; real mode briefly shows the not-found fallback on
// a cold deep-link until the list resolves.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Recipe, RecipeInput, PantryCategoryMeta } from '@/data/types'
import { useRecipes, useRecipeActions, useRecipeBreakdown, usePantry, useRecipeLogs } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { SourceBadge } from '@/features/fuel/components/SourceBadge'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { RecipeLogsList } from '@/features/fuel/components/RecipeLogsList'
import { RecipeFitBadge } from '@/features/fuel/components/RecipeFitBadge'
import { ScoreBreakdownBody } from '@/features/fuel/components/ScoreBreakdownBody'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'

const NOVA_COLOR: Record<number, string> = { 1: 'var(--success)', 2: 'var(--warning)', 3: 'var(--warning)', 4: 'var(--error)' }

type DetailTab = 'reszletek' | 'hozzavalok'

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
    <div className="rad-16" style={{ textAlign: 'center', padding: '10px 2px', background: 'var(--surface-glass)' }}>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, lineHeight: 1, color: accent ? 'var(--success)' : 'var(--text-primary)' }}>{value}</div>
      <div className="label-mono" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 5 }}>{label}</div>
    </div>
  )
}

// The GrowthPage SegButton pattern with the Fuel (coral) accent wash.
function DetailTabButton({ on, onClick, count, children }: { on: boolean; onClick: () => void; count?: number; children: string }) {
  return (
    <button
      role="tab" aria-selected={on} onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
        padding: '9px 0', borderRadius: 11,
        color: on ? 'var(--coral-deep)' : 'var(--text-tertiary)',
        background: on ? 'var(--wash-gym)' : 'transparent',
      }}
    >
      {children}
      {count != null && (
        <span style={{ fontFamily: 'var(--ff-mono)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 4, color: on ? 'var(--coral-deep)' : 'var(--coral)' }}>
          {count}
        </span>
      )}
    </button>
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
  const [tab, setTab] = useState<DetailTab>('reszletek')
  // Today's logs of this recipe (mezo-cki) + the template breakdown (mezo-bw3y). Called with
  // `id ?? ''` alongside the other top-level hooks — BEFORE the not-found early return — so hook
  // order stays stable on a cold/not-found render.
  const { logs } = useRecipeLogs(id ?? '')
  const { breakdown, fitsFor, pending: breakdownPending } = useRecipeBreakdown(id ?? '')

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

  return (
    <>
    <div style={{ padding: '0 16px 24px' }}>
      {/* Top bar */}
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 12px' }}>
        <button
          onClick={() => navigate('/fuel/recipes')}
          className="rad-16"
          style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
          aria-label="Vissza"
        >‹</button>
        <Eyebrow className="text-tertiary">Recept</Eyebrow>
        <div style={{ width: 34 }} />
      </div>

      {/* Hero — image band on top (no text overlay); name/meta live on the card
          surface below it (var(--ink)/var(--faint) — Napiv de-darkening, mezo-8141:
          the retired dark-media text tokens). The meta line carries NOVA since the
          meta strip's removal (mezo-n3xa). */}
      <div className="rad-24" style={{ position: 'relative', marginBottom: 14, overflow: 'hidden', background: 'var(--surface-1)' }}>
        <div style={{ position: 'relative', height: 150, background: 'linear-gradient(135deg,#16323a,#0f2027)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(125deg,rgba(255,255,255,0.025) 0 16px,rgba(255,255,255,0) 16px 32px)' }} />
          <div className="row gap-xs" style={{ position: 'absolute', top: 11, left: 12, zIndex: 3, alignItems: 'center' }}>
            {recipe.slot && <span className="chip brand" style={{ fontSize: 8, padding: '3px 7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{recipe.slot}</span>}
            {recipe.starred && <Icon name="bookmark" size={13} color="var(--warning)" />}
          </div>
          <RecipeFitBadge score={recipe.mezoFit.score} size="hero" />
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.05, color: 'var(--ink)' }}>
            {recipe.name}
          </div>
          <div style={{ marginTop: 6, fontVariantNumeric: 'tabular-nums', fontSize: 9, letterSpacing: '0.06em', color: 'var(--faint)' }}>
            {recipe.servings} adag · {totalMins} perc · <span style={{ color: NOVA_COLOR[recipe.novaDominant], fontWeight: 600 }}>NOVA {recipe.novaDominant}</span> · létrehozva {recipe.createdDate}
          </div>
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

      {/* Main tabs (mezo-n3xa) — Részletek (default) / Hozzávalók */}
      <div className="row" role="tablist" aria-label="Recept nézetek" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 3, gap: 3, margin: '14px 0 16px' }}>
        <DetailTabButton on={tab === 'reszletek'} onClick={() => setTab('reszletek')}>Részletek</DetailTabButton>
        <DetailTabButton on={tab === 'hozzavalok'} onClick={() => setTab('hozzavalok')} count={recipe.ingredients.length}>Hozzávalók</DetailTabButton>
      </div>

      {tab === 'reszletek' && (
        <>
          {/* Mezo · sablon-olvasat + Pontszám (mezo-bw3y) — deterministic numbers + lazy AI prose.
              Real mode: the FIRST open runs the LLM (seconds) → twinkle card; later opens serve the
              jsonb cache. Prose-less envelope (flag/companion off, LLM error) renders cards only. */}
          {breakdownPending && (
            <div className="card" style={{ margin: '0 0 16px', padding: 16, textAlign: 'center' }}>
              <div className="np-twinkle" style={{ color: 'var(--coral)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <Icon name="sparkle" size={20} />
              </div>
              <span className="text-tertiary" style={{ fontSize: 11.5 }}>Mezo értékeli a receptet…</span>
            </div>
          )}
          {!breakdownPending && breakdown?.summary && (
            <div className="card" style={{ margin: '0 0 16px', padding: 12, background: 'color-mix(in srgb, var(--sage) 6%, transparent)' }}>
              <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                <Icon name="sparkle" size={12} color="var(--coral)" />
                <div className="col flex-1">
                  <Eyebrow brand>Mezo · sablon-olvasat</Eyebrow>
                  <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6, color: 'var(--text-primary)' }}>
                    <SafeMarkdown text={breakdown.summary} />
                  </p>
                  {fitsFor.length > 0 && (
                    <div className="row gap-xs" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                      {fitsFor.map(t => (
                        <span key={t} className="chip brand" style={{ fontSize: 9, padding: '3px 8px' }}>● {t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {!breakdownPending && breakdown && (
            <>
              <div className="row" style={{ alignItems: 'center', gap: 9, margin: '0 2px 10px' }}>
                <span className="label-mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>PONTSZÁM</span>
                <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  {breakdown.dimensions.length} szempont · megbízh. {Math.round(breakdown.confidence * 100)}%
                </span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <ScoreBreakdownBody breakdown={breakdown} />
              </div>
            </>
          )}
          {!breakdownPending && !breakdown && (
            <div className="card" style={{ margin: '0 0 16px', padding: 16, textAlign: 'center' }}>
              <span className="text-tertiary" style={{ fontSize: 11.5 }}>
                Sablon-pontszámhoz még nincs elég adat (kcal nélküli hozzávalók).
              </span>
            </div>
          )}

          {/* Logok — today's logs of this recipe (mezo-cki) */}
          <div className="row" style={{ alignItems: 'center', gap: 9, margin: '4px 2px 10px' }}>
            <span className="label-mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>LOGOK</span>
            {logs.length > 0 && <span className="label-mono" style={{ fontSize: 10, color: 'var(--coral)' }}>{logs.length}</span>}
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <RecipeLogsList logs={logs} baselineScore={recipe.mezoFit.score ?? 0} />
          </div>
        </>
      )}

      {tab === 'hozzavalok' && (
        <div className="col gap-sm" style={{ marginBottom: 16 }}>
          {recipe.ingredients.map((line, i) => {
            const src = sourceOf(line.refId)
            return (
              <div key={i} className="card" style={{ padding: '10px 12px', borderLeft: '2px solid ' + catColor(ingredients.find(ii => ii.id === line.refId)?.category ?? '') }}>
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
              </div>
            )
          })}
        </div>
      )}

      {/* Actions — below the tab content on BOTH tabs, normal page flow (not sticky) */}
      <button className="cta-primary" onClick={() => setLogOpen(true)} style={{ marginBottom: 9 }}>
        <Icon name="plus" size={14} /> Mai étkezéshez
      </button>
      <div className="row gap-sm">
        <button className="cta-ghost" onClick={toggleStar} style={{ flex: 1 }}>
          <Icon name="bookmark" size={12} /> {recipe.starred ? 'Csillag le' : 'Csillag'}
        </button>
        <button className="cta-ghost" onClick={() => navigate(`/fuel/recipes/${recipe.id}/edit`)} style={{ flex: 1.4 }}>
          <Icon name="settings" size={12} /> Szerkesztés
        </button>
        <button className="cta-ghost" onClick={del} style={{ flex: 1, color: 'var(--error)', borderColor: 'rgba(244,63,94,0.25)' }} aria-label="Törlés">
          <Icon name="x" size={12} /> Törlés
        </button>
      </div>
    </div>
    {logOpen && <LogMealSheet prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={() => setLogOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 4: Run the test file — all tests pass**

Run: `cd frontend && pnpm test RecipeDetailPage.test`
Expected: PASS (all tests — the three new/rewritten plus all pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/RecipeDetailPage.tsx frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(fuel): recipe detail two-tab layout — Részletek default, Hozzávalók (mezo-n3xa)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Feature doc update + full gate

**Files:**
- Modify: `docs/features/fuel.md` (the `RecipeDetailPage` paragraph — currently starting `**\`RecipeDetailPage\` (\`/fuel/recipes/:id\`…**` — and the recipe-page test-list bullet mentioning `pages/RecipeDetailPage.test.tsx`)

**Interfaces:**
- Consumes: Task 1's shipped layout.
- Produces: up-to-date living feature doc; lint-docs green (clears the git-drift staleness flag).

- [ ] **Step 1: Rewrite the `RecipeDetailPage` paragraph in `docs/features/fuel.md`**

Locate the paragraph beginning `**\`RecipeDetailPage\` (\`/fuel/recipes/:id\`, \`docs/design/recipes-detail.html\`):**` (§ the Receptek view section). Replace ONLY its structural narration; keep every factual sub-clause (mezo-cki logs, mezo-bw3y breakdown mechanics, mezo-arb actions, guard, `recipeToInput`) — the result:

```markdown
**`RecipeDetailPage` (`/fuel/recipes/:id`, two-tab redesign `mezo-n3xa` — spec + approved mockup `docs/superpowers/specs/2026-07-25-recipe-detail-tabs-*`; original page design `docs/design/recipes-detail.html`):** the full-page detail (no sub-nav chrome). **Shared header:** an editorial **hero** — a 150px diagonal-stripe image band (slot chip + bookmark, `RecipeFitBadge size="hero"` top-right) with the name + meta line moved OFF the band onto the card surface below it (`var(--ink)`/`var(--faint)` — de-darkening, `mezo-8141`); since `mezo-n3xa` the meta line reads `servings adag · totalMins perc · NOVA {n} · létrehozva {createdDate}` (NOVA colored via `NOVA_COLOR` — the old 4-cell meta strip is **deleted**, its only non-redundant datum was NOVA) → a **macro hero** with the `ServingToggle` (1 adag ↔ egész; values rounded per basis). **Then two in-page tabs** (the GrowthPage `SegButton` tablist pattern — `role="tablist"`/`role="tab"`, local `useState`, NOT routed; active wash `var(--wash-gym)` + `var(--coral-deep)`): **„Részletek" (default)** — the **Mezo · sablon-olvasat + PONTSZÁM** sections (mezo-bw3y): `useRecipeBreakdown(id)` serves the template breakdown; while the real-mode FIRST open generates (LLM seconds) a twinkle "Mezo értékeli a receptet…" card shows; with prose, the olvasat card renders `summary` + `fitsFor` chips (hidden while summary is null); the PONTSZÁM mono section header (`{n} szempont · megbízh. {c}%`) is followed by **`ScoreBreakdownBody`** (dimension cards + "Lehetne jobb" + "Hogyan számoltam" — shared with `MealScoreSheet`, pixel-identical; the template view KEEPS the weight-0 degraded context card); a kcal-less recipe gets an honest "nincs elég adat" card — then a **"LOGOK"** section (**`RecipeLogsList` ← `useRecipeLogs(id)`**, mezo-cki: today's logs of this recipe — scored card with delta-vs-baseline against the live `recipe.mezoFit.score`, pending-sparkle chip for pre-P7 score-less rows, empty-state card when never logged); **„Hozzávalók · N"** — the ingredient list (each row: category-accented left border, snapshot `name`, `SourceBadge` + optional note, the `amount{unit}`, and a per-line `MacroCells` of that line's `contribution`; the count renders on the tab label, no in-tab section header). **Below the tab content on both tabs** (normal flow, not sticky): live **`+ Mai étkezéshez`** (mezo-arb — opens **`LogMealSheet`** pre-filled `{ source: 'recipe', recipeId: recipe.id }`), live **Csillag** (toggles `starred` via `update(id, {...recipeToInput(r), starred:!r.starred})`), live **Szerkesztés** (→ `/fuel/recipes/:id/edit`), live **Törlés** (`remove(id)` + `navigate('/fuel/recipes')`). The route guard relies on `useRecipes().recipes` (no raw query status): mock resolves synchronously via `initialData`, real mode briefly shows the **`"Nincs ilyen recept."`** fallback on a cold deep-link until the list resolves. `RecipeDetailPage` also exports **`recipeToInput(r: Recipe): RecipeInput`** (prefills every field, re-keys each line `refId → pantryItemId`) — reused by the star toggle and the editor.
```

- [ ] **Step 2: Update the test-list bullet in `docs/features/fuel.md`**

In the testing section, the bullet starting `- Recipe page tests: \`pages/RecipeDetailPage.test.tsx\` (hero + macro hero + ingredient contributions, missing-id fallback, …` — replace its parenthesized `RecipeDetailPage.test.tsx` list head so it reads:

```markdown
- Recipe page tests: `pages/RecipeDetailPage.test.tsx` (two-tab layout `mezo-n3xa`: default Részletek tab shows hero + macro hero + breakdown with ingredients hidden, tab-switch reveals the ingredient lines + count on the tab label with actions on both tabs, NOVA in the hero meta line with the meta strip gone; missing-id fallback, serving-toggle basis switch, Szerkesztés navigates to `/:id/edit`, Törlés removes + navigates back, Csillag toggles `starred`) and `pages/RecipeEditorPage.test.tsx` (…)
```

(Leave the `RecipeEditorPage.test.tsx` half of the bullet untouched.)

- [ ] **Step 3: Lint the docs**

Run: `node scripts/lint-docs.mjs` (from the worktree root)
Expected: PASS — no broken links, no staleness flag for `fuel.md`.

- [ ] **Step 4: Run the full frontend gate — both modes**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: `tsc -b` + vite build clean; ALL tests green in real mode AND mock mode.

- [ ] **Step 5: Commit**

```bash
git add docs/features/fuel.md
git -c core.hooksPath=/dev/null commit -m "docs(fuel): recipe detail feature doc — two-tab layout (mezo-n3xa)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Land — push, self-PR, CI gate, merge, bd close

**Files:** none (git/GitHub/bd operations only)

**Interfaces:**
- Consumes: Tasks 1–2 committed on `feat/recipe-detail-tabs`.
- Produces: change merged to `origin/main`; `mezo-n3xa` closed.

- [ ] **Step 1: Push the branch and open the self-PR (the CI gate)**

```bash
git push -u origin feat/recipe-detail-tabs
gh pr create --title "feat(fuel): recipe detail two-tab layout (mezo-n3xa)" --body "Restructures RecipeDetailPage: shared hero+macro header, then two in-page tabs — Részletek (default: AI breakdown + PONTSZÁM + Logok) and Hozzávalók. Meta strip removed, NOVA moved into the hero meta line. Spec: docs/superpowers/specs/2026-07-25-recipe-detail-tabs-design.md (mezo-n3xa).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Verify the PR is mergeable (memory `conflicting-pr-no-ci`: a conflicting PR never starts CI), then wait for CI green**

```bash
gh pr view --json mergeable,url
gh pr checks --watch
```
Expected: `"mergeable": "MERGEABLE"`; all checks pass. If CI fails: read the failing job log (`gh run view <id> --log-failed`), fix, commit (hooks disabled), push, re-watch.

- [ ] **Step 3: Merge (worktree landing — memory `mezo-worktree-landing-via-gh-pr-merge`: remote merge instead of the local `--no-ff` when working from a worktree)**

```bash
gh pr merge --merge --delete-branch
```
Expected: merged into `origin/main`; remote branch deleted. Local `main` + bd reconcile stay deferred to the main checkout (per the memory).

- [ ] **Step 4: Close the bd issue (from the MAIN checkout; memory `bd-close-reason-arg`: close by id, notes separately)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
bd close mezo-n3xa
bd update mezo-n3xa --notes="Shipped via feat/recipe-detail-tabs (gh pr merge). Two-tab RecipeDetailPage: Részletek default (breakdown+PONTSZÁM+Logok), Hozzávalók list, meta strip removed, NOVA in hero meta. Spec: docs/superpowers/specs/2026-07-25-recipe-detail-tabs-design.md"
bd dolt push
```

---

## Self-Review (done)

1. **Spec coverage:** split/labels/default (Task 1 tablist + tests) ✓ · meta strip → NOVA hero line (Task 1 code + test) ✓ · actions on both tabs, not sticky (Task 1 code + tab-switch test) ✓ · GrowthPage pattern, local state, not routed (DetailTabButton) ✓ · breakdown tri-state inside Részletek (code preserved) ✓ · logs after score (reorder) ✓ · docs impact (Task 2) ✓ · both test modes (Task 2 Step 4) ✓.
2. **Placeholder scan:** none — full file content and full test code inline.
3. **Type consistency:** `DetailTab`/`DetailTabButton` defined and used in the same file; no cross-task signatures.
