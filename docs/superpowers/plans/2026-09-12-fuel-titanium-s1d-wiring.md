# Fuel Titanium S1d — date paging, water, settings, entry points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Fuel Mai — give it day paging with the 7-day backfill clamp, put water back on the page as a first-class module, move settings behind a quiet corner entry, and repoint every entry point that leads into Fuel so nothing lands on a retired surface.

**Architecture:** Nothing new is invented here; this slice connects existing pieces. Day paging reuses the shared `DayNavigator` primitive and the `?d=` clamp the logger already enforces. Water reuses `useWaterActions` with its in-session undo. Settings and slot templates are existing pages that only change their entry point, not their behaviour. The entry-point work is a repoint pass: every link that pointed at a Fuel surface this rebuild moved must point at its new home, verified by tests at the source pages rather than by inspection.

**Tech Stack:** React 19 + TypeScript, React Router, Vitest + Testing Library, the `mozaik`/`clay` kits, plain CSS in `frontend/src/styles/prototype.css`.

## Global Constraints

- Driving issue: `mezo-33k6` (S1). Manifest rows implemented here: **A12** (water + undo), **A13** (past-day backfill folded into shared date paging), **A16** (settings moved to a corner entry), **A17** (slot templates reachable under settings), **A19** (FAB and quick-log targets), **A20** (other pages' Fuel tiles and deep links). Manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md`. **A18** (tutorial anchors) belongs to S5, not here.
- **Depends on S1a, S1b and S1c** being merged on this branch.
- Owner decisions this slice must honour: settings live behind a **quiet corner entry** on Mai (spec decision 7) — not a tile, not a prominent button. Water stays on Mai. The shopping list is deferred and must not appear anywhere.
- **Do not change how any moved page behaves.** `FuelSettingsPage` and `FuelSlotsPage` keep their save semantics exactly — in particular the diet-settings save that re-prescribes the active goal, the custom-split 100% validation, and the slot-template validation and AI-evaluate degrade note. This slice changes how they are reached, nothing else, and their existing tests must pass untouched.
- The `?w=` window key is produced only by `tileKey()` (`frontend/src/features/fuel/logic/fuelSwimlane.ts:107`) — its doc comment states it is the cross-URL contract and must never be re-implemented. Any test that needs the key derives it from that function.
- The 7-day backfill clamp is a real product rule, not a detail: `FuelLogNewPage.tsx:28` `MAX_BACK = 7` with the `1..7` clamp. Paging must not let the user reach a day the logger will refuse.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — always run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- Reduced motion disables every animation. Hungarian copy; clay icons, never emoji. Honest-null: a day with no data reads `—` / "nincs adat", never a fabricated zero.
- Conventional commits carrying `(mezo-33k6)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Day paging on Mai

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `DayNavigator` from `@/shared/ui/DayNavigator` — read it first (`:4-10` for `DayNavigatorProps`; it takes `date`, `onChange`, `maxDate`, `minDate` and is `@/data`-free).
- Produces: Mai reads `?d=` for its selected day and passes that date down to `useFuelDay`, `useFuelTimeline` and every navigation it emits.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`, reusing its `renderView(path)` harness and `LocationProbe`:

```tsx
// A13 (mezo-33k6): a Mai lapozható, és a lapozott nap adata jelenik meg — nem csak a címke.
test('a visszalapozott nap a saját adatával jelenik meg', async () => {
  renderView('/fuel?d=' + YESTERDAY)
  expect(await screen.findByText(HU_YESTERDAY_LABEL)).toBeInTheDocument()
  expect(fuelDayCalls()).toContain(YESTERDAY)
})

// A 7 napos korlát terméki szabály: nem lehet olyan napra lapozni, ahova a naplózó nem enged.
test('hét napnál régebbre nem lehet lapozni', () => {
  renderView('/fuel?d=' + addDays(TODAY, -7))
  expect(screen.getByRole('button', { name: 'Előző nap' })).toBeDisabled()
})

test('a jövőbe nem lehet lapozni', () => {
  renderView('/fuel')
  expect(screen.getByRole('button', { name: 'Következő nap' })).toBeDisabled()
})

// A logolás a MEGTEKINTETT naphoz kapcsolódik, nem a mai naphoz.
test('múltbeli napon a blokk a pótlásba visz, a nap megtartásával', async () => {
  renderView('/fuel?d=' + YESTERDAY)
  await userEvent.click(screen.getAllByRole('button', { name: /Uzsonna/ })[0])
  const loc = screen.getByTestId('loc').textContent!
  expect(loc).toContain('/fuel/log/uj')
  expect(loc).toContain('d=')
})

// Őszinte üres állapot: egy régi nap adat nélkül nem nullákat mutat.
test('adat nélküli múltbeli nap őszintén üres', () => {
  renderView('/fuel?d=' + EMPTY_DAY)
  expect(screen.getByText(/Erre a napra nincs adat/i)).toBeInTheDocument()
})
```

`fuelDayCalls()` means: assert the date actually reached the data layer. The file already mocks `@/data/hooks` with the hoisted-partial idiom — extend that mock to record the `date` argument `useFuelDay`/`useFuelTimeline` were called with, rather than asserting on rendered text alone.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — Mai ignores `?d=` and always renders today.

- [ ] **Step 3: Implement**

Read the selected date from `?d=` with the same clamp the logger uses (`FuelLogNewPage.tsx:36-42` — offset `1..7`, anything else is today; reuse that logic by lifting it into a small exported helper rather than writing a second copy, and update `FuelLogNewPage` to call the shared helper). Pass the date into `useFuelDay(date)` and `useFuelTimeline(date)`, and mount `<DayNavigator date={date} onChange={…} minDate={addDays(today, -7)} />` at the top of the page. On a past day, apply the existing `asPastDayHero` / `asPastDayLane` transforms (`keretHero.ts:174`, `fuelSwimlane.ts:207`) so "now" and "future" states do not appear on a finished day. Every navigation the page emits carries `d=` when the day is not today.

**Cross-domain note, deliberately out of scope:** the spec's shared date axis (Súly/Alvás/Napló/Edzés Mai following the same selection) is a cross-domain contract this slice does not build. Keep the selected date in the URL — that is what makes adoption cheap later — and do not convert other domains here.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS, including the existing `FuelLogNewPage.test.tsx` clamp cases after the helper is shared.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/features/fuel/pages/FuelMaiPage.test.tsx frontend/src/features/fuel/pages/FuelLogNewPage.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): day paging on Mai with the 7-day backfill clamp (mezo-33k6)"
```

---

### Task 2: The water module

**Files:**
- Create: `frontend/src/features/fuel/components/FuelWaterModule.tsx`
- Create: `frontend/src/features/fuel/components/FuelWaterModule.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useWaterActions(date)` from `@/data/hooks` — read `frontend/src/data/fuel/fuelHooks.ts:125` for the exact returned shape (`logWater`, `undoLastWater`, `canUndo`) before writing the test.
- Produces: `export function FuelWaterModule({ date, currentMl, targetMl }: { date: string; currentMl: number; targetMl: number }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/FuelWaterModule.test.tsx`. Cases:

```tsx
// A12 (mezo-33k6): a víz a Mai-on marad, gyorsgombokkal és visszavonással.
test('a gyorsgomb a megadott mennyiséget naplózza', async () => {
  render(<FuelWaterModule date={TODAY} currentMl={1250} targetMl={4000} />)
  await userEvent.click(screen.getByRole('button', { name: '+2,5 dl' }))
  expect(logWater).toHaveBeenCalledWith(250)
})

test('a visszavonás csak akkor látszik, ha van mit visszavonni', () => {
  const { rerender } = render(<FuelWaterModule … />)   // canUndo: false
  expect(screen.queryByRole('button', { name: /Visszavonom/ })).not.toBeInTheDocument()
  // canUndo: true
  rerender(<FuelWaterModule … />)
  expect(screen.getByRole('button', { name: /Visszavonom/ })).toBeInTheDocument()
})

test('a visszavonás az utolsó saját bejegyzést vonja vissza', async () => { ... })

// Szégyenmentesség: a cél alatti érték nem hibaállapot.
test('a cél alatti víz semlegesen jelenik meg', () => {
  const { container } = render(<FuelWaterModule date={TODAY} currentMl={200} targetMl={4000} />)
  expect(container.textContent).not.toMatch(/keveset|elmaradás|hiba/i)
})
```

Use the real quick-add amounts the current `WaterLogSheet` offers — read `frontend/src/features/fuel/sheets/WaterLogSheet.tsx` and keep the same set rather than inventing new ones.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — cannot resolve `@/features/fuel/components/FuelWaterModule`.

- [ ] **Step 3: Implement**

A compact module in the Titanium language: the water ring (the same `fmx-` ring vocabulary S1a established), the quick-add buttons and the undo affordance, with the optimistic update `useWaterActions` already provides. Mount it on Mai under the meal blocks. Keep `WaterLogSheet` alive for its other callers; do not delete it here.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/FuelWaterModule.tsx frontend/src/features/fuel/components/FuelWaterModule.test.tsx frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): water module on Mai with quick-add and undo (mezo-33k6)"
```

---

### Task 3: The quiet settings corner

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelSettingsPage.tsx` (entry to slot templates only)
- Test: `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`, `frontend/src/features/fuel/pages/FuelSettingsPage.test.tsx`

**Interfaces:**
- Consumes: the existing routes `fuel/settings` and `fuel/slots`.
- Produces: one quiet corner entry at the bottom of Mai, and a link from settings into the slot-template editor.

- [ ] **Step 1: Write the failing test**

```tsx
// A16 (mezo-33k6): a beállítás CSENDES sarok — nem csempe, nem hangsúlyos gomb (owner).
test('a beállítások csendes sarokként, a lap alján érhetők el', async () => {
  const { container } = renderView()
  const corner = container.querySelector('.fmx-corner')!
  expect(corner.className).not.toContain('mz-tile')
  await userEvent.click(within(corner as HTMLElement).getByRole('button', { name: /Beállítások/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/settings')
})
```

and in `FuelSettingsPage.test.tsx`:

```tsx
// A17: az étkezési ablakok szerkesztője a beállítások alól nyílik.
test('a beállításokból elérhető az étkezési ablakok szerkesztője', async () => {
  renderSettings()
  await userEvent.click(screen.getByRole('button', { name: /Étkezési ablakok/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/slots')
})
```

Read `FuelSettingsPage.test.tsx` first and match its existing harness; add a `LocationProbe` only if the file does not already have one.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL on both.

- [ ] **Step 3: Implement**

Add the corner entry to Mai (quiet type, no tile wash) and the slot-template link to the settings page. Change nothing else on either page — in particular do not touch the settings save path.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS, with every pre-existing settings and slots test untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/features/fuel/pages/FuelSettingsPage.tsx frontend/src/features/fuel/pages/FuelMaiPage.test.tsx frontend/src/features/fuel/pages/FuelSettingsPage.test.tsx
git commit -m "feat(fuel): quiet settings corner on Mai, slot templates beneath it (mezo-33k6)"
```

---

### Task 4: Repoint every entry point into Fuel

**Files:**
- Modify: `frontend/src/app/QuickLogSurface.tsx`, `frontend/src/app/AppLayout.tsx` (FAB hiding only)
- Modify: the cross-domain link sites listed below
- Test: the colocated test of each file you change

**Interfaces:**
- Consumes: the routes this rebuild established.
- Produces: no link in the app points at a Fuel surface that this rebuild moved.

- [ ] **Step 1: Inventory, then write the failing tests**

Manifest rows A19 and A20 name the sites; verify each against the current tree before editing, because the nav merge moved some of them:

```bash
grep -rn "'/fuel\|\"/fuel\|\`/fuel" frontend/src --include=*.ts --include=*.tsx | grep -v "features/fuel/" | grep -v "\.test\."
```

Known sites from the manifest: `QuickLogSurface.tsx:70-111` (meal tile with `?w=`, water inline, stack), `AppLayout.tsx` `hideFab` (the logger route must stay FAB-free), `NapHubPage.tsx:437`, `todayItems.ts:239`, `nextStep.ts:87`, quest/habit actions, `EletjelPage:118`, `NapRutinPage:275` (both mount the meal-log overlay).

For each site that actually changes, add an assertion to that file's own colocated test — for example:

```tsx
// A19 (mezo-33k6): a gyorsnaplózó étkezés-csempéje a kamera-első naplózóba visz, ablakkal.
test('a gyors étkezés-logolás a naplózóba visz az aktuális ablakkal', async () => {
  renderQuickLog()
  await userEvent.click(screen.getByRole('button', { name: 'Étkezés' }))
  const loc = screen.getByTestId('loc').textContent!
  expect(loc).toContain('/fuel/log/uj')
  expect(loc).toContain('w=')
})
```

A site whose target did not move needs no edit and no new test — say so in your report rather than churning the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL only for the sites that genuinely need repointing.

- [ ] **Step 3: Implement**

Repoint each one. Two rules: the `?w=` value comes from `tileKey()`, never a hand-built string; and the `LogFlowPage` overlay used by `EletjelPage` and `NapRutinPage` must keep working — it wraps `MealComposer`, which S1c extended, so verify those two pages' existing tests still pass rather than rewriting the overlay.

- [ ] **Step 4: Run the full gates**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "feat(fuel): repoint every entry point at the rebuilt Fuel surfaces (mezo-33k6)"
```

---

### Task 5: Slice close

**Files:**
- Modify: `docs/features/fuel.md`
- Modify: `docs/CODEMAP.md` (regenerated)
- Modify: `.beads/issues.jsonl`

- [ ] **Step 1: Update the living feature doc**

Bring `docs/features/fuel.md` §2 (routes) and §3 (hooks) in line with what S1a–S1d built: the new Mai anatomy, the meal detail and score routes, the logger's modes, and the settings entry. Note which manifest rows are now implemented (A1–A17, A19, A20) and that A18 remains for S5.

- [ ] **Step 2: Regenerate the codemap and verify**

Run from the worktree root: `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`
Expected: `✅ docs/CODEMAP.md is up to date.`

- [ ] **Step 3: Refresh the tracker backup**

Run from the worktree root: `node scripts/check-beads-backup.mjs --fix`

- [ ] **Step 4: Commit**

```bash
git add docs/features/fuel.md docs/CODEMAP.md .beads/issues.jsonl
git commit -m "docs(fuel): record the rebuilt Mai surface (mezo-33k6)"
```

---

## Self-review notes

- **Manifest coverage:** A12 (Task 2), A13 (Task 1 — clamp preserved and shared with the logger via one helper), A16 (Task 3), A17 (Task 3), A19 + A20 (Task 4). A18 is explicitly left to S5, and the cross-domain shared date axis is explicitly named as out of scope with the reason.
- **Preservation:** the settings/slots save semantics, the `?w=` contract, the 7-day clamp and the `LogFlowPage` overlay are each named as must-not-break, with their existing tests as the evidence.
- **No churn:** Task 4 Step 1 makes the implementer inventory first and report untouched sites instead of editing every file that mentions `/fuel`.
