# Fuel Titanium S2 — Kiegészítők Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Fuel supplements destination around the daily question "Mit veszek be ma?" — today's doses grouped by time band with one-tap check-off as the protagonist, the protocol as its own readable page one level deeper, and a guided setup flow that turns a product label into a daily amount, a number of units and a placement with its reason.

**Architecture:** Five thin routes collapse into one hub plus two sub-pages. The hub merges today's `FuelStackPage` and `FuelStackTodayPage`; the four `manage/*` pages merge into one; the protocol becomes its own page because the owner found the combined scroll unreadable. The dose advisor is UI over a reference table plus the existing placement engine's output — the backend capability itself is a separate issue (`mezo-nmzh`), so this slice ships the approved surface and stays honest-null wherever the product facts are missing.

**Tech Stack:** React 19 + TypeScript, React Router, Vitest + Testing Library, the `mozaik`/`clay` kits, plain CSS in `frontend/src/styles/prototype.css`.

## Global Constraints

- Driving issue: `mezo-g2vl` (S2). Manifest rows: **D1** (today + tick + undo, MERGE of hub and today), **D2** (protocol view), **D3** (protocol editing, MERGE of the four manage pages), **D4** (meal bindings, MERGE as a sub-section), **D5** (medication, KEEP unchanged), **D7** (protocol history stays data-only), **D8** (DROP the dead replan surface), **D9** (push deep links repointed). Manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md`.
- **Depends on S0.** Independent of S1's files except `prototype.css` — coordinate: open ONE new fenced block `/* ── fuel-stack titanium (mezo-g2vl) ── */ … /* ── /fuel-stack titanium ── */`, placed after the `fuel-mai titanium` block and before the `titan-dark scope` fence. Use the `fsx-` class prefix so it can never collide with S1's `fmx-`.
- **The approved visual reference is the prototype**, `docs/design_2.0/prototypes/companion-titanium/`. Read before writing markup:
  - `fuel-pages.js` — `stackPage` (`:295`), `stackItemGlass` (`:314`), `protokollPage` (`:334`), `beallitasPage` (`:354`), `setupPick` (`:360`), `setupFacts` (`:369`), `setupAdvice` (`:384`).
  - `fuel-state.js` — `SUPPLEMENT_REFERENCE` and `doseAdvice({name, perUnit, unitForm, container, dailyOverride})`; `toggleIntake`, `nextDue`.
  - `fuel-pages.css` — `/* Kiegészítők */` (`:246`).
- Owner decisions this slice must honour, captured verbatim from the approval dialogue:
  - Today's list grouped by **time band**, one-tap check-off, undo — this is the protagonist.
  - **Protokoll is its own page.** A 5–15 item stack in one combined scroll was "baromi sok scroll és hasznos info, de ebben a formában nem átlátható".
  - **Adding a new item is a standalone page, not a popup that becomes a drawer.** The earlier flow was rejected: "nincs padding, másrészt nem értem a flow-t, hogy van egy felugró ablak aztán átváltunk drawerbe".
  - The setup accepts a **product link** the way the pantry import does, and reads the pack size and dose facts from it.
  - Tapping a supplement opens a **glass card** with its details — properly padded, coloured and sectioned.
- **The dose advisor is advice, not medicine.** Every dose surface carries the boundary line `Tájékoztatás, nem orvosi tanács.` Where a product fact is missing, say so — never infer a dose from nothing, and never present a guess as a recommendation. The backend capability is `mezo-nmzh`; this slice's advisor reads the reference table and the product facts the user supplies.
- **Do not break the protocol read path.** `getProtocol` performs a lazy backfill write-on-read and `ProtocolService:63` must stay transactional (manifest D2, traps §6.5). This slice renders the protocol; it does not touch how it is produced.
- **Medication stays exactly as it is** (D5): production-empty by owner decision (`mezo-lwmq`), its empty state lives, and the `/fuel/gyogyszer` deep link must keep resolving — add a redirect if the route moves, and never "fix" or revive the populated branch.
- **D7:** `ProtocolViewResponse.history[]` keeps being mapped into state and keeps having no UI. Do not render it, and do not delete the mapping.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — always run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- Reduced motion disables every animation. Hungarian copy; clay icons, never emoji.
- Conventional commits carrying `(mezo-g2vl)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Group today's doses into time bands

**Files:**
- Create: `frontend/src/features/fuel/logic/stackBands.ts`
- Create: `frontend/src/features/fuel/logic/stackBands.test.ts`

**Interfaces:**
- Consumes: the stack/intake types already in `@/data/types` — read them plus `frontend/src/data/fuel/` for what `useStackDay`/`useIntakes` actually return before writing anything.
- Produces:
  ```ts
  export type BandKey = 'reggel' | 'delelott' | 'delben' | 'delutan' | 'este'
  export interface BandRow { itemId: string; name: string; dose: string | null; taken: boolean; takenAtHHmm: string | null }
  export interface StackBand { key: BandKey; label: string; rows: BandRow[]; doneCount: number }
  export function groupStackByBand(items: StackItem[], intakes: Intake[], nowHHmm: string): StackBand[]
  export function nextDueBand(bands: StackBand[], nowHHmm: string): BandKey | null
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/logic/stackBands.test.ts` in the pure-logic style of `frontend/src/features/fuel/logic/fuelSwimlane.test.ts`. Cases:

```ts
// D1 (mezo-g2vl): a mai lista IDŐSÁVOK szerint csoportosul — ez az owner fő nézete.
test('a tételek a saját idősávjukba kerülnek, a sávok időrendben állnak', () => {
  const bands = groupStackByBand(ITEMS, [], '09:00')
  expect(bands.map(b => b.key)).toEqual(['reggel', 'delelott', 'delben', 'delutan', 'este'])
})

test('az üres idősáv nem jelenik meg', () => {
  expect(groupStackByBand([morningItem()], [], '09:00').map(b => b.key)).toEqual(['reggel'])
})

test('a bevett tétel a bevétel idejével jön vissza', () => { ... })

test('a sáv készültsége a bevett tételek száma', () => { ... })

// Őszinte-null: adag nélküli tételnél nem találunk ki mennyiséget.
test('adag nélküli tétel adag nélkül jön vissza', () => {
  expect(groupStackByBand([itemWithoutDose()], [], '09:00')[0].rows[0].dose).toBeNull()
})

// A „most esedékes" a legkorábbi BE NEM FEJEZETT sáv, nem egyszerűen az aktuális óra sávja.
test('a most esedékes sáv a legkorábbi befejezetlen', () => {
  expect(nextDueBand(groupStackByBand(ITEMS, [morningTaken()], '09:00'), '09:00')).toBe('delelott')
})

test('minden bevéve — nincs esedékes sáv', () => {
  expect(nextDueBand(groupStackByBand(ITEMS, ALL_TAKEN, '21:00'), '21:00')).toBeNull()
})
```

The band keys must match the zone vocabulary the production placement engine already emits — find it (`grep -rn "delben\|zone" frontend/src/data frontend/src/features/fuel --include=*.ts | head`) and use the real keys and labels rather than inventing a parallel set.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — `groupStackByBand` does not exist.

- [ ] **Step 3: Implement**

Pure functions only: no hooks, no fetching, no date arithmetic beyond `HH:mm` comparison.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/stackBands.ts frontend/src/features/fuel/logic/stackBands.test.ts
git commit -m "feat(fuel): group today's supplement doses into time bands (mezo-g2vl)"
```

---

### Task 2: The Kiegészítők hub

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelStackPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelStackPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `groupStackByBand`/`nextDueBand` (Task 1), and the existing `useStackIntakeToggle` — read it for the undo-toast behaviour and keep that behaviour exactly.
- Produces: the rebuilt hub at `/fuel/stack`, absorbing what `/fuel/stack/today` showed.

- [ ] **Step 1: Write the failing test**

Extend `frontend/src/features/fuel/pages/FuelStackPage.test.tsx` (read its existing harness first). Cases:

```tsx
// D1 (mezo-g2vl): a főnézet a mai lista, idősávokra bontva, egyérintéses pipálással.
test('a mai lista idősávokban jelenik meg', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.fsx-band').length).toBeGreaterThan(0)
})

test('egy érintés bevettre állítja a tételt', async () => {
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: /bevettem/i })[0])
  expect(toggleIntake).toHaveBeenCalledTimes(1)
})

test('a bevétel visszavonható', async () => { ... })

// A most esedékes sáv kiemelten áll, de a többi nem tűnik el.
test('a most esedékes sáv kiemelt', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.fsx-band.is-due')).toHaveLength(1)
  expect(container.querySelectorAll('.fsx-band').length).toBeGreaterThan(1)
})

// Egy tétel koppintása üvegkártyát nyit a részleteivel.
test('a tétel koppintása üvegkártyát nyit', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /D3-vitamin/ }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('glass')
  expect(within(box).getByText(/Miért/i)).toBeInTheDocument()
})

// Üres stack: hívás cselekvésre, nem üres képernyő.
test('üres stacknél a felvétel a következő lépés', () => {
  renderView({ empty: true })
  expect(screen.getByRole('button', { name: /Új elem/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — the hub has no bands.

- [ ] **Step 3: Implement**

Port `stackPage` (`fuel-pages.js:295`) and `stackItemGlass` (`:314`). The glass card is a `dialog.glass` — copy the house open/close/escape handling from an existing `dialog.glass` user rather than writing new modal logic, and give it real padding, the hue-coded sections and the colour treatment the owner asked for. Below the bands: the two doors to **Protokoll** (Task 3) and **Új elem** (Task 4).

Absorb `/fuel/stack/today`: its content now lives here. Leave the old route itself in place for now — route retirement and redirects are S5 (`mezo-qt5q`).

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelStackPage.tsx frontend/src/features/fuel/pages/FuelStackPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Kiegészítők hub — today's doses by time band (mezo-g2vl)"
```

---

### Task 3: Protokoll as its own page

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelStackProtocolPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelStackProtocolPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `getProtocol`'s already-mapped view via the existing hook. Read the page as it stands — it has an explicit error branch that must survive.
- Produces: the readable protocol page: what I take, why, and where the placement engine put it.

- [ ] **Step 1: Write the failing test**

```tsx
// D2 (mezo-g2vl): a Protokoll SAJÁT oldal, mert a kombinált görgetés átláthatatlan volt (owner).
test('a protokoll tételenként mutatja a miértet és az elhelyezést', () => {
  renderProtocol()
  const row = screen.getByRole('listitem', { name: /D3-vitamin/ })
  expect(within(row).getByText(/Ebéddel/)).toBeInTheDocument()
  expect(within(row).getByText(/zsíros étkezéssel/i)).toBeInTheDocument()
})

// D2: az elhelyezés INDOKA a motorból jön — nem a felület találja ki.
test('az elhelyezés indoka a protokollból jön, nem a felületről', () => {
  renderProtocol({ reason: null })
  const row = screen.getByRole('listitem', { name: /D3-vitamin/ })
  expect(within(row).queryByText(/mert/i)).toBeNull()
})

// D7: a verziótörténet adat marad, felület nélkül.
test('a verziótörténet nem jelenik meg', () => {
  renderProtocol({ history: [{ version: 2 }] })
  expect(screen.queryByText(/verzió|előzmény/i)).toBeNull()
})

test('a betöltési hiba őszinte, nem üres lista', () => {
  renderProtocol({ error: true })
  expect(screen.getByText(/nem sikerült betölteni/i)).toBeInTheDocument()
})
```

Read the page's current error branch first and assert on the copy it genuinely renders.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`

- [ ] **Step 3: Implement**

Port `protokollPage` (`fuel-pages.js:334`) into the existing page: one readable row per item with its dose, its zone label and the engine's Hungarian reason. Keep the error branch. Do not render `history[]`. Change nothing about how the protocol is fetched.

Fold D3's editing and D4's meal bindings in as this page's sub-sections (the four `manage/*` pages merge here per the manifest), preserving every existing rule: the placement engine places an item added without a slot, the pinned/unpin 400 rule, and the duplicate 409. Those behaviours have tests today — find them and keep them green rather than rewriting them.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelStackProtocolPage.tsx frontend/src/features/fuel/pages/FuelStackProtocolPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Protokoll as its own readable page (mezo-g2vl)"
```

---

### Task 4: The dose setup page

**Files:**
- Create: `frontend/src/features/fuel/logic/doseAdvice.ts`
- Create: `frontend/src/features/fuel/logic/doseAdvice.test.ts`
- Modify: `frontend/src/features/fuel/pages/FuelStackAddPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelStackAddPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: the prototype's `SUPPLEMENT_REFERENCE` and `doseAdvice` in `fuel-state.js` — port both, and the existing pantry URL-import capability for the product-link arm.
- Produces:
  ```ts
  export interface DoseAdvice {
    substance: string; unit: string; range: [number, number]; target: number
    units: number; unitForm: string; days: number | null
    zone: string; zoneLabel: string; reason: string; caution: string | null
    matchesTarget: boolean; unknownProduct: boolean
  }
  export function doseAdvice(input: { name: string; perUnit: number | null; unitForm?: string; container?: number | null; dailyOverride?: number | null }): DoseAdvice | null
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/logic/doseAdvice.test.ts`. Cases:

```ts
// mezo-nmzh / D3: a termékcímkéből napi mennyiség + ennyi darab + elhelyezés indokkal.
test('ismert hatóanyagnál megmondja, hány darab a napi mennyiség', () => {
  const a = doseAdvice({ name: 'D3-vitamin 2000 NE', perUnit: 1000, unitForm: 'kapszula' })!
  expect(a.unit).toBe('NE')
  expect(a.units).toBe(2)
  expect(a.zoneLabel).toBe('Ebéddel')
  expect(a.reason).toMatch(/zsír/i)
})

test('a kiszerelésből megmondja, hány napra elég', () => {
  expect(doseAdvice({ name: 'D3-vitamin', perUnit: 1000, container: 60 })!.days).toBe(30)
})

// Őszinte-null: ismeretlen hatóanyagra NEM adunk adagot.
test('ismeretlen hatóanyagra nem ad adagot', () => {
  expect(doseAdvice({ name: 'Valami ismeretlen por', perUnit: 500 })).toBeNull()
})

// Őszinte-null: ismert hatóanyag, de ismeretlen termékerősség — nincs darabszám.
test('ismeretlen termékerősségnél nincs darabszám, csak a napi tartomány', () => {
  const a = doseAdvice({ name: 'D3-vitamin', perUnit: null })!
  expect(a.unknownProduct).toBe(true)
  expect(a.units).toBeNaN
  expect(a.range).toEqual([2000, 4000])
})

test('a figyelmeztetés átjön, ahol a referencia ad ilyet', () => { ... })
```

Port the reference table faithfully from the prototype — it is the approved content. Where a substance has a caution, it must reach the UI.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`

- [ ] **Step 3: Implement the advisor**

Pure function. It never returns a dose for a substance the reference table does not know, and never invents a unit count without a product strength.

- [ ] **Step 4: Write the failing page test**

In `frontend/src/features/fuel/pages/FuelStackAddPage.test.tsx`:

```tsx
// Owner: az új elem felvétele ÖNÁLLÓ OLDAL — nem felugró, ami drawerbe vált.
test('a felvétel egyetlen oldalon fut végig, nem nyit modális réteget', async () => {
  renderAdd()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText(/Termék neve/), 'D3-vitamin')
  await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

// A termék linkről is megadható, mint a kamra beolvasásnál.
test('a termék linkről is megadható', async () => {
  renderAdd()
  await userEvent.click(screen.getByRole('button', { name: /Link/ }))
  await userEvent.type(screen.getByLabelText(/Termék linkje/), 'https://example.test/d3')
  await userEvent.click(screen.getByRole('button', { name: /Beolvasom/ }))
  expect(importFromUrl).toHaveBeenCalled()
})

test('a javaslat megmutatja a napi mennyiséget, a darabszámot és az indokot', async () => { ... })

// Határvonal: ez tájékoztatás, nem orvosi tanács — minden adag-felületen ott áll.
test('az adag-felület kimondja, hogy nem orvosi tanács', async () => {
  renderAdd()
  ...
  expect(screen.getByText(/nem orvosi tanács/i)).toBeInTheDocument()
})

// Őszinte-null: ismeretlen terméknél nem találunk ki adagot.
test('ismeretlen terméknél nem ad adagot, hanem megmondja, mit nem tud', async () => { ... })
```

- [ ] **Step 5: Run the tests to verify they fail, then implement**

Port `beallitasPage` (`:354`), `setupPick` (`:360`), `setupFacts` (`:369`) and `setupAdvice` (`:384`) as ONE standalone page with proper padding: pick the substance → give the product facts (typed, or read from a product link with the same import capability the pantry uses) → see the advice → save. No modal, no drawer hand-off at any step. Saving goes through the existing add-protocol-item path so the placement engine still places the item.

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/logic/doseAdvice.ts frontend/src/features/fuel/logic/doseAdvice.test.ts frontend/src/features/fuel/pages/FuelStackAddPage.tsx frontend/src/features/fuel/pages/FuelStackAddPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): guided dose setup — product facts to daily amount and placement (mezo-g2vl)"
```

---

### Task 5: Drop the dead replan surface

**Files:**
- Delete: `frontend/src/features/fuel/sheets/ReplanSheet.tsx` and its test
- Modify: `frontend/src/data/fuel/fuelReadHooks.ts` (remove `useReplanScenarios`)
- Modify: whatever re-exports it (check `frontend/src/data/hooks.ts`)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. This is the owner-approved deletion of manifest row **D8**.

- [ ] **Step 1: Prove it is dead**

```bash
grep -rn "ReplanSheet\|useReplanScenarios" frontend/src
```

Expected: only the definition, its own test, and the barrel re-export. If ANY real consumer appears, stop, do not delete, and report it — the manifest's DROP was granted on the evidence that it has zero consumers.

- [ ] **Step 2: Delete and re-run**

Remove the files, the hook and the re-export. Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: all green with no route or import breaking.

- [ ] **Step 3: Commit**

```bash
git rm frontend/src/features/fuel/sheets/ReplanSheet.tsx frontend/src/features/fuel/sheets/ReplanSheet.test.tsx
git add frontend/src/data/fuel/fuelReadHooks.ts frontend/src/data/hooks.ts
git commit -m "chore(fuel): drop the dead replan surface — owner-approved D8 (mezo-g2vl)"
```

---

### Task 6: Deep links and slice close

**Files:**
- Modify: `frontend/src/features/notifications/notificationScheduleWriter.ts` (only if its target moved)
- Modify: `docs/features/fuel.md`, `docs/CODEMAP.md`, `.beads/issues.jsonl`

- [ ] **Step 1: Verify the push deep links still resolve**

D9: `notificationScheduleWriter.ts:21` maps `FUEL_SLOT` → `/fuel/stack`, and the habit `morning_coffee` action does too. Both targets still exist after this slice, so the expected outcome is **no change** — confirm that with a test assertion in that file's colocated test rather than by inspection, and leave the **category key unchanged** (it is a contract with already-scheduled rows).

- [ ] **Step 2: Confirm medication is untouched**

Run the medication page's existing tests and confirm `/fuel/gyogyszer` still resolves. Report explicitly that D5's empty state and its Europe/Budapest cycle zone were not touched.

- [ ] **Step 3: Docs, codemap, tracker**

Update `docs/features/fuel.md` for the merged supplement surfaces. Then from the worktree root:
```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
node scripts/check-beads-backup.mjs --fix
```

- [ ] **Step 4: Full gates and commit**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`

```bash
git add -A docs frontend/src .beads
git commit -m "docs(fuel): record the rebuilt Kiegészítők surface (mezo-g2vl)"
```

---

## Self-review notes

- **Manifest coverage:** D1 (Tasks 1+2), D2 (Task 3), D3 (Tasks 3+4), D4 (Task 3), D5 (Task 6 — explicitly verified as untouched), D6 (no work: backend-only by decision), D7 (Task 3 — asserted to stay invisible), D8 (Task 5), D9 (Task 6).
- **Safety rails named:** the protocol's transactional read-path backfill, the medication empty state and its deep link, the notification category key, and the pinned/duplicate rules are each called out as must-not-break with their evidence.
- **The DROP has a stop condition:** Task 5 Step 1 requires proving zero consumers before deleting, rather than trusting the manifest row blindly.
- **Type consistency:** `BandKey`/`StackBand`/`groupStackByBand`/`nextDueBand`/`DoseAdvice`/`doseAdvice` keep one spelling across every task that names them, and the `fsx-` prefix is used consistently to avoid colliding with S1's `fmx-`.
