# Fuel Titanium S3b — week switching, deltas, the day's meals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Trendek against the approved prototype — let the user step back a week, show each stat tile's change against the previous week, and list the day's meals inside the day glass box.

**Architecture:** No new backend and no contract change. Week switching and the deltas both come from a second read of the SAME weekly endpoint at the previous Monday; the day's meals come from the existing per-day endpoint, fetched only when a day box is actually opened. All three are presentation over endpoints the app already calls.

**Tech Stack:** React 19 + TypeScript, TanStack Query, Vitest + Testing Library.

## Why this exists

S3 delivered Trendek but left these three out and filed them as `mezo-sdyul`. They are not optional extras: all three are in the interactive prototype the owner approved on 2026-09-12, and the owner contract for this rebuild says a DEFER requires an explicit owner decision — silence is never consent. Nothing here needs new backend work, so there is no reason to defer. `mezo-sdyul` closes when this lands.

## Global Constraints

- Driving issue: `mezo-83g0` (S3), follow-up `mezo-sdyul`. Manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md` rows C1/C2/C5.
- **Approved visual reference**, `docs/design_2.0/prototypes/companion-titanium/`:
  - `fuel-pages.js` — `trendek` (`:199`, the `Múlt hét` / `Ez a hét` switch and the `deltas` per tile at `:211-212`), `trendDayGlass` (`:244`, the day rows and its meal section).
  - `fuel-state.js` — `weekDeltas`, `weekCompare`, `fuelDayScore`.
- Builds on S3, merged on this branch: `FuelTrendekPage.tsx`, `logic/fuelWeekView.ts`, the `ftx-` CSS block, and `useMeWeek`-sourced day scores. Extend them; do not restructure.
- **Honest-null, strictly:**
  - A delta needs BOTH weeks' values non-null. Otherwise render no delta at all — never a zero, never an arrow.
  - A day with no logged meals says so; it does not render an empty list as though the meals were missing data.
  - The previous week may not exist (a new user). That is a normal state, not an error: no deltas, and the switch says there is nothing further back.
- **Adherence-neutral:** a delta is a direction, not a verdict. No red/green "good week / bad week" colouring, no praise or blame copy. `▲`/`▼` plus the number, in the page's existing neutral hues. The page's existing assertion that the words `elrontott|túlléptél|hiba|rossz|bukta|kudarc` never appear must keep passing.
- **C5 — meal-coach history is cache-only.** Opening a past day's box must NOT trigger historical coach generation. Read the day; do not ask for a verdict.
- **Do not double-fetch.** S3 already shares `useMeWeek`'s exact query key and cache shape so the open week is fetched once. Follow that pattern for the previous week, and fetch a day only when its box opens (`enabled` gated), never for all seven upfront.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- Mock mode must stay deterministic and not midnight-fragile: S3's `mockWeekRollup(start)` re-dates to the current Monday — extend that idea for the previous week rather than hardcoding dates. Real mode never substitutes a seed.
- Reduced motion disables every animation, including any delta or count-up. Hungarian copy; clay icons, never emoji.
- Conventional commits carrying `(mezo-83g0)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Week switching

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelTrendekPage.tsx`
- Modify: the week hook S3 used (read it first — S3 extended `useFuelWeek` with `weekDays` and `start`)
- Test: `frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (the existing `ftx-` block)

**Interfaces:**
- Consumes: the weekly endpoint at an arbitrary Monday.
- Produces: the page renders either the current week or the previous one, selected in the URL (`?w=elozo`), so the view is linkable and survives a reload.

- [ ] **Step 1: Write the failing test**

```tsx
// C1 (mezo-83g0): a jóváhagyott prototípus két hetet enged megnézni — ez a delták alapja is.
test('a heti kép a múlt hétre is átváltható', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Múlt hét/ }))
  expect(screen.getByTestId('loc').textContent).toContain('w=elozo')
  expect(screen.getByRole('button', { name: /Ez a hét/ })).toBeInTheDocument()
})

test('a múlt heti nézet a múlt hét napjait mutatja', async () => {
  renderView('/fuel/trendek?w=elozo')
  expect(await screen.findByText(PREV_WEEK_FIRST_DAY_LABEL)).toBeInTheDocument()
})

// Új felhasználónál nincs korábbi hét — ez normál állapot, nem hiba.
test('korábbi hét nélkül a váltó őszintén elmondja, hogy nincs tovább', () => {
  renderView({ noPreviousWeek: true })
  expect(screen.getByText(/Ez az első heted/i)).toBeInTheDocument()
})
```

Read the file's existing harness and `LocationProbe` usage first; S3's tests already establish how this page is rendered and how mock week data is seeded.

- [ ] **Step 2: Run the test to verify it fails, then implement**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL (no switch). Then read `?w=` on this page (note: this is the Trendek page's own week parameter and is unrelated to the logger's `?w=` window key — do not reuse `tileKey` here, and say so in a code comment so a later reader does not confuse them), select the Monday accordingly, and render the switch.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelTrendekPage.tsx frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx frontend/src/data/fuel frontend/src/styles/prototype.css
git commit -m "feat(fuel): step back a week on Trendek (mezo-83g0)"
```

---

### Task 2: Week-over-week deltas on the stat tiles

**Files:**
- Modify: `frontend/src/features/fuel/logic/fuelWeekView.ts`
- Test: `frontend/src/features/fuel/logic/fuelWeekView.test.ts`
- Modify: `frontend/src/features/fuel/pages/FuelTrendekPage.tsx`, its test, and the `ftx-` CSS block

**Interfaces:**
- Consumes: two `WeekViewVM`s — this week and the previous one.
- Produces:
  ```ts
  export interface WeekDelta { key: 'avg' | 'quality' | 'weight'; direction: 'up' | 'down'; amount: number }
  export function weekDeltas(current: WeekViewVM, previous: WeekViewVM | null): Partial<Record<WeekDelta['key'], WeekDelta>>
  ```
  A key is absent whenever either side is null or the two are equal.

- [ ] **Step 1: Write the failing test**

```ts
// C2 (mezo-83g0): a delta IRÁNY, nem ítélet — és csak akkor létezik, ha mindkét hét tudja.
test('a delta a két hét különbsége, irányával', () => {
  const d = weekDeltas(week({ mealScoreAvg: 0.8 }), week({ mealScoreAvg: 0.7 }))
  expect(d.quality).toEqual({ key: 'quality', direction: 'up', amount: expect.any(Number) })
})

test('hiányzó korábbi hétnél nincs egyetlen delta sem', () => {
  expect(weekDeltas(week(), null)).toEqual({})
})

test('ha bármelyik oldal ismeretlen, az a delta kimarad', () => {
  expect(weekDeltas(week({ weightAvgKg: 82 }), week({ weightAvgKg: null })).weight).toBeUndefined()
})

test('azonos értéknél nincs delta, nem nulla nyíl', () => {
  expect(weekDeltas(week({ mealScoreAvg: 0.8 }), week({ mealScoreAvg: 0.8 })).quality).toBeUndefined()
})
```

- [ ] **Step 2: Run, implement the pure function, re-run**

- [ ] **Step 3: Write the failing page test**

```tsx
test('a mutató-csempe a múlt héthez mért változást is mutatja', async () => {
  renderView()
  const tile = screen.getByRole('button', { name: /Heti minőség/ })
  expect(within(tile).getByText(/[▲▼]/)).toBeInTheDocument()
})

// Szégyenmentesség: a delta nem minősít.
test('a delta nem visel jó/rossz színt vagy szöveget', () => {
  const { container } = renderView()
  expect(container.querySelector('.ftx-delta.is-good, .ftx-delta.is-bad')).toBeNull()
  expect(container.textContent).not.toMatch(/javult|romlott|gyengébb|jobb hét/i)
})

test('korábbi hét nélkül egyetlen csempén sincs delta', () => {
  const { container } = renderView({ noPreviousWeek: true })
  expect(container.querySelector('.ftx-delta')).toBeNull()
})
```

- [ ] **Step 4: Implement, re-run, commit**

Port the tile delta from `fuel-pages.js:211-212`. Fetch the previous week with the same shared-key discipline S3 established; while it is still loading, render no delta rather than a placeholder.

```bash
git add frontend/src/features/fuel/logic/fuelWeekView.ts frontend/src/features/fuel/logic/fuelWeekView.test.ts frontend/src/features/fuel/pages/FuelTrendekPage.tsx frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): week-over-week deltas on the Trendek stat tiles (mezo-83g0)"
```

---

### Task 3: The day's meals in the day glass box

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelTrendekPage.tsx` (the day glass box)
- Test: `frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useFuelDay(date)` — the existing per-day read — gated so it only runs for the day whose box is open.
- Produces: the box lists that day's meals with their times and scores, each opening the meal detail page S1b built.

- [ ] **Step 1: Write the failing test**

```tsx
// C5 (mezo-83g0): a napi doboz megmutatja, MIBŐL állt a nap — a meglévő napi olvasásból.
test('a napi üvegdoboz felsorolja a nap étkezéseit', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /szeptember 8/i }))
  const box = screen.getByRole('dialog')
  expect(await within(box).findByText('Túrós zabkása · áfonyával')).toBeInTheDocument()
})

test('az étkezés a doboz listájából a részletes oldalára visz', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /szeptember 8/i }))
  await userEvent.click(await screen.findByRole('button', { name: /Túrós zabkása/ }))
  expect(screen.getByTestId('loc').textContent).toContain('/fuel/etkezes/')
})

// Őszinte-null: naplózatlan nap nem „hiányzó lista", hanem naplózatlan nap.
test('naplózatlan napnál nincs étkezés-lista, hanem a már meglévő őszinte mondat áll', async () => {
  renderView({ unlogged: true })
  await userEvent.click(screen.getByRole('button', { name: /szeptember 9/i }))
  const box = screen.getByRole('dialog')
  expect(within(box).getByText(/nem naplóztál/i)).toBeInTheDocument()
  expect(within(box).queryByRole('list')).toBeNull()
})

// A nap étkezései csak akkor töltődnek be, amikor tényleg megnyitják a dobozt.
test('a napi olvasás csak a doboz megnyitásakor fut le', async () => {
  renderView()
  expect(fuelDayCalls()).toHaveLength(0)
  await userEvent.click(screen.getByRole('button', { name: /szeptember 8/i }))
  await waitFor(() => expect(fuelDayCalls()).toHaveLength(1))
})
```

- [ ] **Step 2: Run the tests to verify they fail, then implement**

Port `trendDayGlass`'s meal section (`fuel-pages.js:244+`). Keep the existing rows (meals count, protein, water, training) and the existing honest sentence for an unlogged day. When the day is still loading, show a quiet loading state, not an empty list.

Do NOT request a coach verdict for a past meal — C5 makes history cache-only. If the score is already in the day payload, show it; otherwise show none.

- [ ] **Step 3: Full gates and commit**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh` and `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`

```bash
git add -A frontend/src docs
git commit -m "feat(fuel): the day's meals inside the Trendek day box (mezo-83g0)"
```

---

### Task 4: Close the follow-up

- [ ] **Step 1: Close `mezo-sdyul`**

```bash
bd close mezo-sdyul
```
with a comment naming the three commits and stating that both items it recorded are now delivered from existing endpoints, with no contract change.

- [ ] **Step 2: Refresh the tracker backup and commit**

```bash
node scripts/check-beads-backup.mjs --fix
git add .beads/issues.jsonl
git commit -m "chore(beads): refresh tracker backup (mezo-83g0)"
```

---

## Self-review notes

- **Nothing here needed new backend work**, which is precisely why deferring it would have been the wrong call: both items ride endpoints the app already calls.
- **Every honest-null rule is a test, not a note:** a delta needs both sides, an equal pair yields no arrow, a missing previous week yields none at all, and an unlogged day keeps its existing honest sentence instead of an empty list.
- **The two `?w=` meanings are explicitly separated** — Trendek's week selector versus the logger's window key — because reusing the letter is a trap for the next reader.
- **The fetch discipline is asserted**, so a day read cannot quietly become seven.
