# Fuel Titanium S4 — Konyha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge recipes and the pantry into one destination built around "Mentsd el, ami jött" — two capture actions on top, the Receptműhely promoted to its own poster on the hub, and the recipe and pantry libraries one door away, each with a detail page as rich as the meal detail page.

**Architecture:** No backend work. The hub is a new poster mosaic on the S0 scaffold; the four existing pages (recipes, recipe detail, pantry, pantry item detail) are re-skinned in place and reached through the hub's doors; the workshop moves from a button inside the recipe list to a poster on the hub and gains a live preview built from the SAME sections the recipe detail page renders, so what the user sees while iterating is what they get after saving.

**Tech Stack:** React 19 + TypeScript, React Router, Vitest + Testing Library, the `mozaik`/`clay` kits, plain CSS in `frontend/src/styles/prototype.css`.

## Global Constraints

- Driving issue: `mezo-hygp` (S4). Manifest rows: **B1** (save a recipe), **B2** (add a pantry item), **B3** (photo label import), **B4** (URL import), **B6** (pantry browse + detail), **B7** (pantry edit/delete), **B8** (recipe library + detail), **B9** (recipe edit/delete), **B10** (Receptműhely, promoted to the hub), **B11** (recipe score), **B12** (log a recipe or pantry item as a meal), **B13** (swap suggestions). Manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md`.
- **Owner DROPs — these are decisions, not oversights. Do not implement, revive, or "improve" any of them:**
  - **B5 barcode / OpenFoodFacts lookup** — the backend endpoint exists and stays contracted and untouched; it gets NO UI caller. ("nem kell vonalkód beolvasás")
  - **B14 imports feed list** — no "Legutóbb érkezett" list anywhere. The import record keeps being written, and the per-item provenance (source + when) lives on the pantry item's detail page source card.
  - **B15 shopping list** — nothing exists; build nothing.
  - **B16 stock / expiry UI** — `SHOW_PANTRY_STOCK` stays `false`, the dormant surfaces stay dormant, the backend columns stay untouched. No new reference to stock anywhere in Konyha.
  - **B17 "mit főzzünk itthon lévőből"** — no such surface. The recipe detail's ingredient list is unaffected.
  - **B1's link import for RECIPES** — recipe URL import never existed in production and the owner removed it from scope. The pantry's URL import (B4) stays and is unrelated.
- **Depends on S0.** `frontend/src/features/fuel/pages/FuelKonyhaPage.tsx` exists at `/fuel/konyha` with a placeholder body — replace the body, keep the file path and component name.
- `prototype.css`: open ONE new fenced block `/* ── fuel-konyha titanium (mezo-hygp) ── */ … /* ── /fuel-konyha titanium ── */` after the other Fuel blocks and before the `titan-dark scope` fence. Class prefix `fkx-`.
- **The approved visual reference is the prototype**, `docs/design_2.0/prototypes/companion-titanium/`. Read before writing markup:
  - `fuel-pages.js` — `konyha` (`:25`), `receptekPage` (`:43`), `recipeDetailPage` (`:50`), `recipeScoreGlass` (`:71`), `kamraPage` (`:83`), `pantryDetailPage` (`:93`), `muhelyPage` (`:115`), `runTurn` (`:158`), `saveWorkshop` (`:171`).
  - `workshop-state.js` + `workshop-state.test.js` — `GOALS`, `draftFromGoal`, `draftFromRecipe`, `lineMacros`, `draftTotals`, `draftNutrition`, `canSave`, `setLineAmount`, `scaleServings`, `replaceWithPantry`, `dropLine`, `diffKeys`, `workshopTurn`.
  - `fuel-pages.css` — `/* Konyha */` (`:188`) and `/* Konyha v2 — mosaic posters, hue-coded recipe + pantry tiles, detail pages */` (`:497`).
- Owner decisions this slice must honour, captured verbatim from the approval dialogue:
  - The hub shows **two door buttons** for Receptek and Kamra, not two inline lists.
  - **The Receptműhely lives on the Konyha hub**, as its own poster — the button comes OFF the recipe list page.
  - Opening a recipe must show **the same detail depth as opening a logged meal**: ingredients, AI score, full macros and kcal, and micronutrients — every block from the quality section.
  - The workshop shows that same preview **while iterating**, so the draft looks like the saved recipe will.
- **Preserve the workshop's real contracts** (B10): `workshopTurn` is stateless (message + goal + history + draft → reply + the WHOLE updated draft); a failed turn must preserve the user's typed text for retry; a draft containing an `estimate` line blocks saving; `?recipeId=` seeds the draft and makes the save an update instead of a create. These are existing guarantees — find their tests and keep them green rather than rewriting them.
- **Honest-null.** Production stores only fibre, sugar, salt and saturated fat as micronutrients (`mezo-vj61`, manifest F1). A recipe's micronutrient block shows exactly those and `—` for the rest. The workshop's preview macros come only from real pantry facts — the AI never invents a macro number.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — always run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- Reduced motion disables every animation, including the workshop's gold diff flash. Hungarian copy; clay icons, never emoji.
- Conventional commits carrying `(mezo-hygp)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: The Konyha hub

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelKonyhaPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelKonyhaPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useRecipes()`, `usePantry()` for the door counts; the existing add-pantry-item and recipe-editor entry points.
- Produces: the hub — two capture actions, the Receptműhely poster, two doors.

- [ ] **Step 1: Write the failing test**

Replace the S0 placeholder case in `frontend/src/features/fuel/pages/FuelKonyhaPage.test.tsx`:

```tsx
// B1/B2 (mezo-hygp): a két rögzítő művelet a lap tetején — ezért jön ide a felhasználó.
test('a két rögzítő művelet áll elöl', () => {
  const { container } = renderView()
  const captures = container.querySelectorAll('.fkx-capture')
  expect(captures).toHaveLength(2)
  expect(captures[0]).toHaveTextContent(/Recept mentése/)
  expect(captures[1]).toHaveTextContent(/Új elem a kamrába/)
})

// Owner: a Receptek és a Kamra KÉT AJTÓ, nem két lista a főoldalon.
test('a receptek és a kamra ajtóként, nem listaként jelennek meg', async () => {
  const { container } = renderView()
  expect(container.querySelector('.fkx-list')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Receptek/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/recipes')
})

// Owner: a Receptműhely SAJÁT posztert kap a főoldalon.
test('a Receptműhely saját poszterként áll a főoldalon', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Receptműhely/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/recipes/muhely')
})

// B14 DROP: nincs „Legutóbb érkezett" lista.
test('nincs import-előzmény lista a Konyhán', () => {
  renderView()
  expect(screen.queryByText(/Legutóbb érkezett/i)).toBeNull()
})

// B15/B16/B17 DROP: se bevásárlólista, se készlet, se „mit főzzünk".
test('nincs bevásárlólista, készlet vagy „mit főzzünk" felület', () => {
  const { container } = renderView()
  expect(container.textContent).not.toMatch(/bevásárl|készlet|lejárat|mit főzzünk/i)
})
```

- [ ] **Step 2: Run the test to verify it fails, then implement**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL. Then port `konyha` (`fuel-pages.js:25`) with the poster mosaic from the `Konyha v2` CSS block. A poster carries an eyebrow, a spot graphic and one big numeral (the house poster anatomy), not a list.

- [ ] **Step 3: Re-run and commit**

```bash
git add frontend/src/features/fuel/pages/FuelKonyhaPage.tsx frontend/src/features/fuel/pages/FuelKonyhaPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Konyha hub — capture actions, workshop poster, two doors (mezo-hygp)"
```

---

### Task 2: The recipe detail page gains meal-detail depth

**Files:**
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx`
- Test: `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: the recipe breakdown (`getRecipeBreakdown`, B11) and the shared quality/micronutrient sections S1b built for the meal detail page. **Reuse those components** — the owner asked for the same depth, and two copies would drift. If S1b's sections are not exported, export them from where they live rather than duplicating the markup.
- Produces: the enriched recipe detail page.

- [ ] **Step 1: Write the failing test**

```tsx
// Owner: a recept megnyitása UGYANAZT a mélységet adja, mint egy logolt étkezésé.
test('a recept részletei ugyanazokat a blokkokat viszik, mint az étkezésé', () => {
  renderRecipe('r1')
  for (const name of ['Hozzávalók', 'Minőség', 'Mikrotápanyagok']) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument()
  }
  expect(screen.getByText(/AI értékelés/i)).toBeInTheDocument()
})

// F1 őszinteség: csak a tárolt négy tény, kitalált vitamin nincs.
test('a mikrotápanyagok csak a tárolt tényeket mutatják', () => {
  renderRecipe('r1')
  const micro = screen.getByRole('heading', { name: 'Mikrotápanyagok' }).closest('section')!
  expect(within(micro).queryByText(/vitamin/i)).toBeNull()
})

// B12: a receptből naplózás előtöltve indul, a kamera-felület kihagyásával.
test('a receptből naplózás előtöltve nyílik', async () => {
  renderRecipe('r1')
  await userEvent.click(screen.getByRole('button', { name: /Logolás/ }))
  expect(screen.getByRole('dialog', { name: /Mit ettél/ })).toBeInTheDocument()
})

// B10: a részletlapról a Műhelybe lehet iterálni, a receptet magával víve.
test('a részletlapról a Műhely a recepttel indul', async () => {
  renderRecipe('r1')
  await userEvent.click(screen.getByRole('button', { name: /Iterálás a Műhelyben/ }))
  expect(screen.getByTestId('loc').textContent).toContain('recipeId=r1')
})
```

Read the page's existing tests first — the score sheet, the serving toggle and the logs sheet are already covered, and those cases must keep passing untouched.

- [ ] **Step 2: Run the test to verify it fails, then implement**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL. Then port `recipeDetailPage` (`fuel-pages.js:50`) and `recipeScoreGlass` (`:71`), reusing S1b's quality and micronutrient sections. Keep the serving toggle, the logs and the existing breakdown behaviour.

- [ ] **Step 3: Re-run and commit**

```bash
git add frontend/src/features/fuel/pages/RecipeDetailPage.tsx frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): recipe detail gains the meal-detail depth (mezo-hygp)"
```

---

### Task 3: Receptek and Kamra behind their doors

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelRecipesPage.tsx`, `frontend/src/features/fuel/pages/FuelKamraPage.tsx`, `frontend/src/features/fuel/pages/KamraItemDetailPage.tsx`
- Test: each page's colocated test
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: the existing hooks and sheets — nothing new.
- Produces: the two libraries re-skinned, with the workshop button removed from the recipe list and the pantry item's source card carrying the provenance that the dropped feed used to show.

- [ ] **Step 1: Write the failing tests**

```tsx
// B10: a Műhely-gomb a Konyha főoldalra költözött — a recept-listán már nincs.
test('a recept-listán nincs Műhely gomb', () => {
  renderRecipes()
  expect(screen.queryByRole('button', { name: /Műhely/ })).toBeNull()
})

// B14: a feed helyett az EREDET az elem részletlapján él.
test('a kamraelem részletlapja mutatja a forrást és az időt', () => {
  renderPantryItem('p1')
  const src = screen.getByRole('region', { name: /Forrás/i })
  expect(within(src).getByText(/fotó|link|katalógus|kézi/i)).toBeInTheDocument()
  expect(within(src).getByText(/\d{4}\./)).toBeInTheDocument()
})

test('a kamrában nincs import-előzmény lista', () => {
  renderPantry()
  expect(screen.queryByText(/Legutóbb érkezett/i)).toBeNull()
})

// B16: a készlet/lejárat felület a zászló mögött marad.
test('a kamra nem hivatkozik készletre vagy lejáratra', () => {
  const { container } = renderPantry()
  expect(container.textContent).not.toMatch(/készlet|lejárat/i)
})
```

The pantry page's search, filters, skeleton, edit and two-step delete are already covered by its existing tests (B6/B7) — those must keep passing untouched, so do not rewrite them.

- [ ] **Step 2: Run the tests to verify they fail, then implement**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL. Then port `receptekPage` (`:43`), `kamraPage` (`:83`) and `pantryDetailPage` (`:93`). Remove the workshop button from the recipe list. Add the provenance to the pantry item's source card. Keep the swap suggestions (B13) where they are.

- [ ] **Step 3: Re-run and commit**

```bash
git add frontend/src/features/fuel/pages/FuelRecipesPage.tsx frontend/src/features/fuel/pages/FuelKamraPage.tsx frontend/src/features/fuel/pages/KamraItemDetailPage.tsx frontend/src/features/fuel/pages/*.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Titanium Receptek and Kamra behind the Konyha doors (mezo-hygp)"
```

---

### Task 4: The Receptműhely with a live preview

**Files:**
- Modify: `frontend/src/features/fuel/pages/RecipeWorkshopPage.tsx`
- Test: `frontend/src/features/fuel/pages/RecipeWorkshopPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: the existing `workshopTurn` flow and the shared quality/micronutrient sections from Task 2.
- Produces: the canvas-first workshop with the preview.

- [ ] **Step 1: Write the failing test**

```tsx
// B10 owner: a Műhelyben ELŐRE látszik, milyen lesz a recept — ugyanazokkal a blokkokkal.
test('a vázlat előnézete a recept-részletlap blokkjait mutatja', () => {
  renderWorkshop()
  for (const name of ['Hozzávalók', 'Minőség', 'Mikrotápanyagok']) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument()
  }
})

// Őszinte-null: az AI NEM talál ki makrót — csak valódi kamra-tényből számolunk.
test('kamra-tény nélküli sor makró nélkül jelenik meg', () => {
  renderWorkshop({ draft: draftWithEstimateLine() })
  expect(screen.getByText('—')).toBeInTheDocument()
})

// Meglévő garancia: becsült sor blokkolja a mentést.
test('becsült sor esetén a mentés tiltott, és megmondjuk, miért', () => {
  renderWorkshop({ draft: draftWithEstimateLine() })
  expect(screen.getByRole('button', { name: /Mentem/ })).toBeDisabled()
  expect(screen.getByText(/becsült/i)).toBeInTheDocument()
})

// Meglévő garancia: hibás kör után a beírt szöveg megmarad.
test('sikertelen kör után a beírt szöveg megmarad', async () => { ... })

// B1: nincs link-alapú recept-import (owner kivette).
test('a Műhelyben nincs link-alapú recept-import', () => {
  renderWorkshop()
  expect(screen.queryByLabelText(/recept linkje/i)).toBeNull()
})
```

Read the page's existing tests first — the retry, the diff flash, the `?recipeId=` seed and the save gate are covered there and must keep passing untouched.

- [ ] **Step 2: Run the tests to verify they fail, then implement**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL. Then port `muhelyPage` (`:115`) with `runTurn` (`:158`) and `saveWorkshop` (`:171`), and mount the shared preview sections against the current draft. The gold diff flash marks what the last turn changed and is inert under reduced motion.

- [ ] **Step 3: Re-run and commit**

```bash
git add frontend/src/features/fuel/pages/RecipeWorkshopPage.tsx frontend/src/features/fuel/pages/RecipeWorkshopPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Receptműhely with a live recipe preview (mezo-hygp)"
```

---

### Task 5: Slice close

**Files:**
- Modify: `docs/features/fuel.md`, `docs/CODEMAP.md`, `.beads/issues.jsonl`

- [ ] **Step 1: Confirm the DROPs held**

```bash
grep -rn "lookupPantryItem\|SHOW_PANTRY_STOCK\|Legutóbb érkezett\|bevásárl" frontend/src --include=*.tsx --include=*.ts | grep -v "\.test\."
```

Expected: `lookupPantryItem` has no UI caller, `SHOW_PANTRY_STOCK` is still `false` with no new references, and neither the imports feed nor a shopping list exists. Report each one explicitly.

- [ ] **Step 2: Docs, codemap, tracker**

Update `docs/features/fuel.md` for the merged Konyha surface, naming the owner DROPs so a future reader does not "fix" them. Then from the worktree root:
```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
node scripts/check-beads-backup.mjs --fix
```

- [ ] **Step 3: Full gates and commit**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`

```bash
git add -A docs .beads
git commit -m "docs(fuel): record the merged Konyha surface (mezo-hygp)"
```

---

## Self-review notes

- **Manifest coverage:** B1 (Task 1, with the recipe link import explicitly excluded and tested for), B2/B3/B4 (Task 1's capture action — the existing import sheet keeps its photo and link arms), B6/B7 (Task 3), B8 (Tasks 2+3), B9 (Task 2 — existing flows preserved), B10 (Tasks 1+4), B11 (Task 2), B12 (Task 2), B13 (Task 3).
- **Every owner DROP is both stated as a constraint and asserted by a test**, so a later reader cannot mistake an intentional absence for a gap — and Task 5 re-verifies them at the end.
- **Anti-duplication:** the recipe detail, the meal detail and the workshop preview share ONE set of quality and micronutrient sections; Task 2 forbids a second copy.
- **Preserved contracts:** the workshop's stateless turn, retry text preservation, estimate-line save gate and `?recipeId=` seed; the pantry's search/filter/edit/two-step delete; the recipe's serving toggle, score sheet and logs.
- **Type consistency:** the `fkx-` prefix and the shared section components keep one spelling across the tasks that name them.
