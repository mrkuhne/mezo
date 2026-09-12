# Fuel Titanium S1b — meal blocks, meal detail, AI score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Fuel Mai its approved meal anatomy — the day's planned blocks (Reggeli · Ebéd · Uzsonna · Vacsora) each with a budget ring, an eating-window bar and its logged meals — and make a logged meal open a full Titanium detail page whose AI score opens a per-dimension breakdown page.

**Architecture:** The block/window logic already exists as a pure VM (`logic/fuelSwimlane.ts` → `WindowLaneVM`), so this slice is a presentation rebuild over it plus two new routed pages. The AI score page is NOT a new scoring surface: it re-renders the SAME `meal.breakdown` envelope the existing `MealScoreSheet` uses, so numbers can never diverge — only the skin and the navigation change (sheet → page + per-dimension glass boxes). The meal detail page is genuinely new UI over already-loaded data.

**Tech Stack:** React 19 + TypeScript, React Router, Vitest + Testing Library, the `mozaik`/`clay` kits, plain CSS in `frontend/src/styles/prototype.css`.

## Global Constraints

- Driving issue: `mezo-33k6` (S1). Manifest rows implemented here: **A10** (day meal list → Mai is the canonical home), **A11** (per-meal AI evaluation), **A14** (eating windows fold into the meal rows). Manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md`.
- **Depends on S1a** (`docs/superpowers/plans/2026-09-12-fuel-titanium-s1a-mai-hero.md`) being merged on this branch: the `fuel-mai titanium` CSS block and the `fmx-` prefix already exist — extend them, do not open a second block.
- **The approved visual reference is the prototype**, `docs/design_2.0/prototypes/companion-titanium/`. Read before writing markup:
  - `fuel-dashboard.js` — `blocksSection` (`:49`), `blockCard` (`:40`), `windowBar` (`:32`), `budgetRing` (`:39`), `mealDetailPage` (`:118`), `buildEnvelope` (`:147`), `qualityTilesHtml` (`:104`), `microCardsHtml` (`:114`), `scorePage` (`:202`), `dimTile` (`:183`), `dimGlassHtml` (`:188`), `NOVA_COLOR` (`:91`), `NOVA_SHORT` (`:179`), `ingredientStyle` (`:93`).
  - `fuel-pages.css` — `/* Meal blocks on Mai … */` (`:53`), `/* Variant A — colored wash + block-level clay icon */` (`:63`), `/* Budget ring (option 3) */` (`:77`), `/* Shared sub-page head … */` (`:107`), `/* Meal detail page */` (`:113`), `/* AI score page */` (`:131`), `/* AI score page — centered hero, colorful dimension mosaic */` (`:344`), `/* Glass box: one dimension */` (`:370`), `/* Meal detail — icon-rich, hue-coded */` (`:406`), `/* Meal detail v3 — split hero, share rings, micronutrient cards */` (`:453`).
- Owner decisions this slice must honour, captured verbatim from the approval dialogue:
  - Blocks are listed first and you log INTO a block; the generic log action sits at the BOTTOM.
  - A logged meal row shows its calories and its AI score. The score chip **animates subtly so it reads as tappable**, and opens the breakdown as its own page.
  - No per-row kcal duplication of the block ring, no "recommended frame" number on the row, and no meal icon on the row: the row's time is expressed as the **eating-window bar under the block title**.
  - On the meal detail page the macro rings show **the meal's own composition share**, not the day's target — and carry no "a nap céljához mérve" caption. Hero layout: left = icon with kcal under it; right = the time-and-block line beside its icon, the day-share under it, and the **AI score top-right**.
  - Under Quality there is also a **Micronutrients** section with icons; neither the Ingredients nor the Quality heading carries a count/caption.
  - Editing and the detailed row-level edit affordance were explicitly dropped from the row itself (editing lives in the logger, S1c).
- **Honest-null is absolute here.** Production stores only fibre, sugar, salt and saturated fat as micronutrients — vitamins and minerals are a separate, not-yet-built capability (`mezo-vj61`, manifest row F1). The micronutrient section renders exactly the four stored facts and shows `—` for anything absent. Never fabricate a vitamin value, and never show a zero in place of "we don't know".
- Adherence-neutral: no red/shame framing on a block that was missed or a meal that scored low. "Így alakult", never "elrontottad".
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — always run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- Reduced motion disables every animation, including the score chip's attention pulse.
- Conventional commits carrying `(mezo-33k6)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Block cards with budget ring and window bar

**Files:**
- Create: `frontend/src/features/fuel/components/FuelMealBlocks.tsx`
- Create: `frontend/src/features/fuel/components/FuelMealBlocks.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (extend the existing `fuel-mai titanium` block)

**Interfaces:**
- Consumes: `WindowLaneVM` / `WindowTileVM` from `@/features/fuel/logic/fuelSwimlane` (read `:60-97` for the exact field list) and `DoneMealRow[]` from `@/features/fuel/logic/keretHero` (`:135`).
- Produces: `export function FuelMealBlocks({ lane, meals, onLogInto, onOpenMeal }: { lane: WindowLaneVM; meals: DoneMealRow[]; onLogInto: (tile: WindowTileVM) => void; onOpenMeal: (mealId: string) => void }): JSX.Element`. Task 4 mounts it.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/FuelMealBlocks.test.tsx`. Build the lane with the REAL builder — `buildWindowLane({ slots, budget, meals })` from `@/features/fuel/logic/fuelSwimlane` — copying the `BUDGET`/`slot()`/`meal()` fixture style from `frontend/src/features/fuel/logic/fuelSwimlane.test.ts` rather than hand-writing a `WindowLaneVM` literal, so the test breaks if the VM contract moves. Cases:

```tsx
// A10/A14 (mezo-33k6): a nap TERVEZETT blokkjai a lista, és minden blokk a saját
// étkezési ablakát viseli — nem külön idővonal-sáv, hanem a blokk címe alatti csík.
test('minden tervezett blokk megjelenik a saját ablak-csíkjával', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const blocks = container.querySelectorAll('.fmx-block')
  expect(blocks).toHaveLength(4)
  expect(Array.from(blocks).map(b => b.querySelector('.fmx-block-name')!.textContent))
    .toEqual(['Reggeli', 'Ebéd', 'Uzsonna', 'Vacsora'])
  for (const b of blocks) expect(b.querySelector('.fmx-window')).not.toBeNull()
})

// Az owner döntése: a SORBAN nincs kcal — a keret a blokk gyűrűjén ül.
test('a blokk gyűrűje viszi a keretet, az étkezés-sor nem ismétli meg', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const done = container.querySelector('.fmx-block.is-done')!
  expect(done.querySelector('.fmx-budget-ring')).not.toBeNull()
  expect(done.querySelector('.fmx-meal-row')!.textContent).not.toMatch(/kcal/)
})

// A logolás a blokkba történik — ez a fő útvonal.
test('az üres blokk koppintása a saját ablakával indítja a naplózást', async () => {
  const onLogInto = vi.fn()
  render(<FuelMealBlocks {...props({ onLogInto })} />)
  await userEvent.click(screen.getByRole('button', { name: /Uzsonna/ }))
  expect(onLogInto).toHaveBeenCalledTimes(1)
  expect(onLogInto.mock.calls[0][0].slotKey).toBe('snack')
})

// A11: a pontszám-chip kattintható és a részletekbe visz.
test('a logolt étkezés pont-chipje a részletekbe visz', async () => {
  const onOpenMeal = vi.fn()
  render(<FuelMealBlocks {...props({ onOpenMeal })} />)
  await userEvent.click(screen.getByRole('button', { name: /AI értékelés/ }))
  expect(onOpenMeal).toHaveBeenCalledWith('meal-1')
})

// Őszinte-null + szégyenmentesség: kihagyott ablak nem hibaállapot.
test('a kihagyott ablak semlegesen jelenik meg, pontszám nélkül', () => {
  const { container } = render(<FuelMealBlocks {...props({ missed: true })} />)
  const missed = container.querySelector('.fmx-block.is-missed')!
  expect(missed.querySelector('.fmx-score')).toBeNull()
  expect(missed.textContent).not.toMatch(/elrontott|kihagytad|hiba/i)
})
```

Confirm the real slot keys and labels from `fuelSwimlane.ts:30-32` (`SLOT_ICON`) before asserting `'snack'` and the four Hungarian names — use whatever the production VM actually produces.

- [ ] **Step 2: Run the test to verify it fails**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — cannot resolve `@/features/fuel/components/FuelMealBlocks`.

- [ ] **Step 3: Implement the component**

Port `blocksSection` (`fuel-dashboard.js:49`) → `blockCard` (`:40`) → `windowBar` (`:32`) + `budgetRing` (`:39`). Each block card: the block's clay icon and name, the budget ring on the right, the window bar under the title (the 5-hour box with the optimal range marked, as `windowBar` draws it), then the block's logged meal rows. A row carries the meal name, a short provenance hint and the score chip — no kcal, no meal icon, no frame number. An empty block is one large tappable button that calls `onLogInto(tile)`; a missed one renders in the neutral state with no score.

State classes come from `WindowTileVM.state` (`'done' | 'now' | 'missed' | 'future'`) as `is-done` / `is-now` / `is-missed` / `is-future`.

- [ ] **Step 4: Add the CSS**

Extend the `fuel-mai titanium` block in `prototype.css` with the prototype's `/* Meal blocks on Mai … */` (`:53`), `/* Variant A — colored wash + block-level clay icon */` (`:63`) and `/* Budget ring (option 3) */` (`:77`), under the `fmx-` prefix. The approved calibration is **Variant A with the option-3 budget ring** — the owner picked these explicitly, so port those two and not the sibling variants in the same file. Blocks are clearly separated from one another (that was an explicit complaint about an earlier pass).

The score chip's attention pulse must be inert under reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .fmx-score { animation: none; }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/FuelMealBlocks.tsx frontend/src/features/fuel/components/FuelMealBlocks.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Titanium meal blocks with budget ring and window bar (mezo-33k6)"
```

---

### Task 2: The meal detail page

**Files:**
- Create: `frontend/src/features/fuel/pages/FuelMealDetailPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelMealDetailPage.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useFuelDay(date)` (via `@/data/hooks`) to find the meal by the `:id` route param; `FuelMeal` from `@/data/types`; `mealDisplayName` and `mealContextOf`/`MEAL_CONTEXT_LABEL` from `@/features/fuel/logic/`.
- Produces: `FuelMealDetailPage` at route `fuel/etkezes/:id`. Task 4 links to it; Task 3's score page links back to it.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/pages/FuelMealDetailPage.test.tsx`, following the `createMemoryRouter` + `RouterProvider` harness in `frontend/src/features/fuel/pages/FuelLogNewPage.test.tsx:7-35` (it shows how this repo mocks `@/data/hooks` with a hoisted fixture and drives a route param). Cases:

```tsx
// Az owner által jóváhagyott hero-elrendezés: BAL oldal ikon + alatta kcal;
// JOBB oldal az idő-és-blokk sor a saját ikonjával, alatta a nap x%-a,
// és az AI értékelés jobbra FENT.
test('a hero a jóváhagyott elrendezésben áll', () => {
  const { container } = renderAt('meal-1')
  const hero = container.querySelector('.fmx-detail-hero')!
  expect(hero.querySelector('.fmx-detail-kcal')).toHaveTextContent('430')
  expect(hero.querySelector('.fmx-detail-when')).toHaveTextContent('Uzsonna')
  expect(hero.querySelector('.fmx-detail-share')).toHaveTextContent('%')
  expect(hero.querySelector('.fmx-detail-score')).not.toBeNull()
})

// Az owner döntése: itt a gyűrűk az ÉTKEZÉS összetételét mutatják, nem a napi célt.
test('a makró gyűrűk az étkezés saját összetételét mutatják', () => {
  const { container } = renderAt('meal-1')
  const rings = container.querySelector('.fmx-detail-rings')!
  expect(rings.textContent).not.toMatch(/a nap céljához mérve/i)
  // a három makró aránya 100%-ra jön ki, mert az étkezés egészére vetítjük
  const pcts = Array.from(rings.querySelectorAll('.fmx-share-pct')).map(e => Number(e.textContent!.replace('%', '')))
  expect(pcts.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(99)
  expect(pcts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(101)
})

test('a hozzávalók abból állnak, amiből az étkezés összeállt', () => {
  renderAt('meal-1')
  expect(screen.getByRole('heading', { name: 'Hozzávalók' })).toBeInTheDocument()
  expect(screen.getByText('Görög joghurt')).toBeInTheDocument()
})

// F1/mezo-vj61 őszinteség: csak a NÉGY tárolt tény látszik, kitalált vitamin nincs.
test('a mikrotápanyag rész csak a tárolt tényeket mutatja, a hiányzót gondolatjellel', () => {
  renderAt('meal-1')
  const micro = screen.getByRole('heading', { name: 'Mikrotápanyagok' }).closest('section')!
  for (const label of ['Rost', 'Cukor', 'Só', 'Telített zsír']) {
    expect(within(micro).getByText(label)).toBeInTheDocument()
  }
  expect(within(micro).queryByText(/vitamin/i)).toBeNull()
  expect(within(micro).getAllByText('—').length).toBeGreaterThan(0)
})

// A cím és a Minőség fejléc NEM visel darabszámot/feliratot (owner).
test('a szekció-fejlécek nem visznek darabszámot', () => {
  renderAt('meal-1')
  expect(screen.getByRole('heading', { name: 'Hozzávalók' }).textContent).toBe('Hozzávalók')
  expect(screen.getByRole('heading', { name: 'Minőség' }).textContent).toBe('Minőség')
})

test('ismeretlen étkezés-azonosítónál őszinte üres állapot, nem összeomlás', () => {
  renderAt('nincs-ilyen')
  expect(screen.getByText(/Ez az étkezés nincs meg/i)).toBeInTheDocument()
})
```

Fill the fixture from the real `FuelMeal` shape — read `frontend/src/data/types.ts` for `FuelMeal` and its `items`/`breakdown` fields, and use a meal that genuinely has ingredient lines, so the assertions describe production data rather than an invented shape.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — cannot resolve `@/features/fuel/pages/FuelMealDetailPage`.

- [ ] **Step 3: Implement**

Port `mealDetailPage` (`fuel-dashboard.js:118`) with `qualityTilesHtml` (`:104`) and `microCardsHtml` (`:114`), using `ingredientStyle` (`:93`) and `NOVA_COLOR`/`NOVA_SHORT` (`:91`, `:179`) for the per-ingredient hue coding. Page anatomy, top to bottom: back head, the split hero described above, the share rings, **Hozzávalók**, **Minőség**, **Mikrotápanyagok**.

The share rings are a small pure helper — put it in `frontend/src/features/fuel/logic/mealShare.ts` with its own colocated test, exporting `mealMacroShare(meal: FuelMeal): { key: 'p' | 'c' | 'f'; label: string; grams: number | null; pct: number | null }[]`, computed from the macro ENERGY split (protein 4 kcal/g, carb 4, fat 9) so the three add to 100%. When a macro is unknown, its `pct` is `null` and the page renders `—`; do not renormalise the others to hide the gap.

Micronutrients render exactly the four stored facts. Add a one-line note under the section: `Ezt tároljuk ma. A vitaminok és ásványi anyagok még úton vannak.` — and a code comment citing `mezo-vj61` / manifest F1 so the next reader knows this is a known gap, not an oversight.

- [ ] **Step 4: Register the route**

In `frontend/src/app/router.tsx`, next to the other Fuel entries, keeping the file's static-before-dynamic convention:

```tsx
      // Fuel Titanium S1b (mezo-33k6): egy logolt étkezés részletei — A10/A14.
      { path: 'fuel/etkezes/:id', element: <FuelMealDetailPage /> },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMealDetailPage.tsx frontend/src/features/fuel/pages/FuelMealDetailPage.test.tsx frontend/src/features/fuel/logic/mealShare.ts frontend/src/features/fuel/logic/mealShare.test.ts frontend/src/app/router.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Titanium meal detail page with meal-share rings (mezo-33k6)"
```

---

### Task 3: The AI score page with per-dimension glass boxes

**Files:**
- Create: `frontend/src/features/fuel/pages/FuelMealScorePage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelMealScorePage.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: the SAME data `MealScoreSheet` consumes — `meal.breakdown`, `useMealCoachFor(meal.id)`, `useFeedback('meal_coach', …)`. Read `frontend/src/features/fuel/sheets/MealScoreSheet.tsx` in full first; its null-handling, its coach/`improve` interplay (the comment block at `:38-46`) and its feedback-hook placement are load-bearing correctness, not decoration — carry them over exactly.
- Produces: `FuelMealScorePage` at route `fuel/etkezes/:id/ertekeles`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/pages/FuelMealScorePage.test.tsx` using the same router harness as Task 2. Cases:

```tsx
// A11 (mezo-33k6): ugyanaz az envelope, más bőr — a SZÁMOK nem mozdulhatnak.
test('a dimenziók a meal.breakdown-ból jönnek, súlyostul', () => {
  const { container } = renderAt('meal-1')
  const tiles = container.querySelectorAll('.fmx-dim')
  expect(tiles.length).toBe(FIXTURE_BREAKDOWN.dimensions.length)
  expect(container.querySelector('.fmx-score-hero')).toHaveTextContent('8,2')
})

// Az owner kérése: a hero-szám mellől a „/10" elmarad.
test('a hero pontszám mellett nincs per-tíz jelölés', () => {
  const { container } = renderAt('meal-1')
  expect(container.querySelector('.fmx-score-hero')!.textContent).not.toContain('/10')
})

// Minden dimenzió KOPPINTÁSRA üvegdobozt nyit — nem lenyílót.
test('egy dimenzió koppintása üvegdobozban nyitja a magyarázatát', async () => {
  renderAt('meal-1')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Feldolgozottság/ }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('glass')
  expect(within(box).getByText(/súly/i)).toBeInTheDocument()
})

// Degradált dimenzió őszintén jelenik meg — nem nulla pont.
test('adat nélküli dimenzió „tanulom", nem nulla', () => {
  renderAt('meal-degraded')
  const tile = screen.getByRole('button', { name: /Mikrotápanyag/ })
  expect(tile).toHaveTextContent('tanulom')
  expect(tile).not.toHaveTextContent('0')
})

// Breakdown nélküli étkezésnek nincs értékelő oldala — ugyanaz a szabály, mint a sheetnél.
test('breakdown nélküli étkezésnél őszinte üres állapot', () => {
  renderAt('meal-no-breakdown')
  expect(screen.getByText(/Ehhez az étkezéshez még nincs értékelés/i)).toBeInTheDocument()
})
```

Take `FIXTURE_BREAKDOWN` from the real mock data rather than inventing dimension ids — find the seed the mock mode serves (`frontend/src/data/fuel/` seeds) and use a meal from it.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — cannot resolve `@/features/fuel/pages/FuelMealScorePage`.

- [ ] **Step 3: Implement**

Port `scorePage` (`fuel-dashboard.js:202`), `dimTile` (`:183`) and `dimGlassHtml` (`:188`): a centred score hero, then the colourful dimension mosaic — one tile per dimension with its own clay icon and hue — each tile a button opening a `dialog.glass` explaining that dimension, its weight and what moved it.

Reuse production logic wherever it exists rather than re-deriving: `ScoreLedger`/`ScoreBreakdownBody` already know how to read the envelope's dimensions, weights and colours (`frontend/src/features/fuel/components/ScoreLedger.tsx:7` documents the "nothing fabricated" contract). If a needed derivation lives inside `ScoreBreakdownBody`'s JSX, lift it into a small exported pure helper with its own test rather than copy-pasting the arithmetic into the new page — the two surfaces must not be able to drift.

Owner-approved icon note: feldolgozottság, makró- and mikrotápanyag each get their OWN clay icon (the generic ones "did not fit"), and the day-context dimension is a clock. If those symbols are missing from the sprite, add them with the S0 procedure (design asset first → verbatim copy → union → bump every count and figure in `Clay.test.tsx`; closed gradient palette, no new gradient).

- [ ] **Step 4: Register the route**

```tsx
      // Fuel Titanium S1b (mezo-33k6): az étkezés AI értékelése saját oldalon — A11.
      { path: 'fuel/etkezes/:id/ertekeles', element: <FuelMealScorePage /> },
```

Place it so the router's static-before-dynamic convention still holds relative to `fuel/etkezes/:id`.

- [ ] **Step 5: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMealScorePage.tsx frontend/src/features/fuel/pages/FuelMealScorePage.test.tsx frontend/src/app/router.tsx frontend/src/styles/prototype.css frontend/src/shared/ui/clay/ docs/design_2.0/assets/clay-icons.svg
git commit -m "feat(fuel): Titanium AI score page with per-dimension glass boxes (mezo-33k6)"
```

---

### Task 4: Mount the blocks on Mai and wire the two pages

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`

**Interfaces:**
- Consumes: `FuelMealBlocks` (Task 1), the routes from Tasks 2 and 3.
- Produces: the finished Mai meal area. The camera-first logger itself is S1c — until it lands, `onLogInto` navigates to the EXISTING logger route with the window prefill it already understands (`/fuel/log/uj?w=<tileKey>`), which keeps the page shippable at every commit.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx` (reuse `renderView()` and the `LocationProbe` already in the file):

```tsx
// A10 (mezo-33k6): a Mai a nap étkezéseinek KANONIKUS helye — a blokkok itt élnek.
test('a Mai a blokkokat mutatja, és a blokk a naplózóba visz az ablakával', async () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.fmx-block').length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: /Uzsonna/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj')
  expect(screen.getByTestId('loc').textContent).toContain('w=')
})

test('a logolt étkezés pont-chipje az értékelő oldalra visz', async () => {
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: /AI értékelés/ })[0])
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/etkezes/')
})

// Az általános naplózó a lap ALJÁN marad (owner).
test('az általános naplózás a blokkok alatt áll', () => {
  const { container } = renderView()
  const blocks = container.querySelector('.fmx-blocks')!
  const generic = container.querySelector('.fmx-loggeneric')!
  expect(blocks.compareDocumentPosition(generic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
```

The `?w=` value must be produced by `tileKey(slot)` from `fuelSwimlane.ts:107` — the doc comment there says this is the cross-URL contract and must never be re-implemented. Derive the expected key in the test the way `FuelLogNewPage.test.tsx` does, not as a hardcoded string.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — no `.fmx-block` on the page.

- [ ] **Step 3: Implement**

In `FuelMaiPage.tsx`, render `<FuelMealBlocks lane={lane} meals={doneMealRows(fuel.meals, slots)} onLogInto={…} onOpenMeal={…} />` under the hero, with the generic log entry below it. `onLogInto` navigates to `/fuel/log/uj?w=${encodeURIComponent(tileKey(...))}`; `onOpenMeal` navigates to `/fuel/etkezes/${id}`. The page already computes the lane via `buildWindowLane` — reuse that call, do not add a second one.

Remove the old meal-related mosaic tiles that the blocks now replace, and update the page header comment to cite A10/A14 and name what left.

- [ ] **Step 4: Run the full gates**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/features/fuel/pages/FuelMaiPage.test.tsx
git commit -m "feat(fuel): Mai carries the day's meal blocks (mezo-33k6)"
```

---

## Self-review notes

- **Manifest coverage:** A10 (Tasks 1+4 — Mai becomes the canonical meal list; `/fuel/log`'s retirement itself is S5), A11 (Task 3 — same envelope, new skin, `MealScoreSheet` stays alive for its other caller until S5 retires it), A14 (Task 1 — the window folds into the block, and the `?w=` deep-link contract is preserved in Task 4).
- **Anti-drift:** the score page reuses the existing envelope readers instead of re-deriving weights, and Task 3 Step 3 explicitly forbids copy-pasting the arithmetic.
- **Shippable at every commit:** Task 4 points the log action at the existing logger route, so the page works end-to-end before S1c replaces that surface.
- **Type consistency:** `WindowLaneVM`/`WindowTileVM`/`DoneMealRow` keep their production spellings; `FuelMealBlocks`, `FuelMealDetailPage`, `FuelMealScorePage` and `mealMacroShare` are spelled identically in every task that names them.
