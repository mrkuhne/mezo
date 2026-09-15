# Fuel Titanium S3 — Trendek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fuel destination that answers "Jól ment a hetem?" — the week's days against their budgets with the weekday/weekend contrast as the protagonist, the longer intake-versus-weight horizon below it, and links to the nutrition patterns that Mezo already owns.

**Architecture:** Three layers over data that already exists. The weekly picture comes from `getFuelWeek`, whose response already carries a weekly meal-score average and a weight average that the frontend mapper silently throws away — connecting those two fields is the cheapest real capability in this whole rebuild. The long horizon reuses the existing metric series (no new backend). Patterns are references to canonical Mezo items, never copies.

**Tech Stack:** React 19 + TypeScript, React Router, Vitest + Testing Library, the `mozaik`/`clay` kits, plain CSS in `frontend/src/styles/prototype.css`.

## Global Constraints

- Driving issue: `mezo-83g0` (S3). Manifest rows: **C1** (weekly rhythm — Trendek becomes canonical, `/fuel/plan` retires in S5), **C2** (weekly meal-score and weight averages — currently computed by the backend and dropped by the frontend mapper), **C3** (intake × weight long horizon from existing series), **C4** (patterns — reference Mezo, never duplicate), **C5** (day quality inside the weekly picture; `/fuel/naplo` retires in S5), **C6** (compact weekly context strip: training days, medication, supplements). Manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md`.
- **Depends on S0.** The page scaffold `frontend/src/features/fuel/pages/FuelTrendekPage.tsx` exists at `/fuel/trendek` with a placeholder body — replace its body, keep its file path and component name.
- `prototype.css`: open ONE new fenced block `/* ── fuel-trendek titanium (mezo-83g0) ── */ … /* ── /fuel-trendek titanium ── */` after the other Fuel blocks and before the `titan-dark scope` fence. Class prefix `ftx-` so it cannot collide with S1's `fmx-` or S2's `fsx-`.
- **The approved visual reference is the prototype**, `docs/design_2.0/prototypes/companion-titanium/`. Read before writing markup:
  - `fuel-pages.js` — `trendek` (`:199`), `weekBars` (`:192`), `horizonChart` (`:223`), `dimFactView` (`:233`), `trendDayGlass` (`:244`), `trendStatGlass` (`:268`), `trendPatternGlass` (`:277`), `trendHorizonGlass` (`:283`).
  - `fuel-state.js` — `weekData`, `weekSummary`, `weekCompare`, `weekDeltas`, `fuelDayScore`, `longHorizon`, `patterns`.
  - `fuel-pages.css` — `/* Trendek */` (`:218`).
- Owner decisions this slice must honour, captured verbatim from the approval dialogue:
  - The weekly picture is the protagonist; the long horizon and the patterns sit below it.
  - **A day in the week view must say something meaningful.** Raw macro numbers like "2.1, 2.3" were rejected as "nem túl beszédes" — a day shows its **AI day score**, and tapping it opens the day's glass box.
  - The day glass box's detail must be **readable**: the section under nutrition was "nagyon össze van dobva és nehéz olvasni", so dimension facts are laid out as rows, not crammed.
  - **The weekday/weekend bars fill in and the numbers count up** — specifically the day average, the meal quality and the weekly weight average.
- **Adherence-neutral is a hard rule on this page.** This is the surface most likely to shame: never colour a day red for going over, never write "elrontottad"; the framing is "így alakult". A week the user barely logged is described honestly, not scored as failure.
- **Honest-null everywhere.** An unlogged day is NOT a zero: it must be excluded from every average and drawn as "nincs adat", not as a bar of height zero. A partial day is marked partial. If the weekly averages come back null, the tiles say `—`.
- **C4 anti-duplication:** Trendek must not re-implement or re-word any insight. It links to the canonical Mezo item. If a pattern's canonical home cannot be linked to, show nothing rather than a copy.
- **C5:** meal-coach history is cache-only — never trigger historical coach generation from this page.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — always run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- **Touching any `api/feature/**/*.yml` triggers the contract-drift gate.** Task 1 should NOT need a contract change — the fields already exist in the response. Verify that before assuming otherwise; if the generated type genuinely lacks them, stop and report rather than editing the contract on your own initiative.
- Reduced motion disables every animation, including the bar fills and the count-ups. Hungarian copy; clay icons, never emoji.
- Conventional commits carrying `(mezo-83g0)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Stop throwing away the weekly averages

**Files:**
- Modify: `frontend/src/data/fuel/mealApi.ts:250-254` (the `getWeek` mapper)
- Modify: `frontend/src/data/types.ts` (`FuelWeekData` / its day type)
- Modify: `frontend/src/data/fuel/fuelWeekHooks.ts` (surface the fields; keep the mock arm honest)
- Test: `frontend/src/data/fuel/mealApi.test.ts` (or the file that covers this mapper — find it)

**Interfaces:**
- Consumes: `FuelWeekResponse` from the generated contract.
- Produces: `FuelWeekData` gains `mealScoreAvg: number | null` and `weightAvgKg: number | null`, surfaced by `useFuelWeek`. Tasks 2 and 4 render them.

- [ ] **Step 1: Verify the fields exist in the contract**

```bash
grep -rn "mealScoreAvg\|weightAvg" frontend/src/api api/feature/fuel/*.yml
```

Expected: present in the generated `FuelWeekResponse` and in the fuel contract. If they are absent, STOP and report — do not edit the contract yourself; the manifest row C2 was written on the evidence that the backend already computes and returns them (`FuelDayService:122`).

- [ ] **Step 2: Write the failing test**

```ts
// C2 (mezo-83g0): a backend kiszámolja a heti étkezés-pontszám és súly átlagot, a mapper
// eddig eldobta őket. Ez a leggyorsabb valódi nyereség az egész átépítésben.
test('a heti válasz átlagai átjutnak a mapperen', async () => {
  server.use(weekHandler({ mealScoreAvg: 0.78, weightAvgKg: 82.4 }))
  const week = await mealApi.getWeek('2026-09-07')
  expect(week.mealScoreAvg).toBe(0.78)
  expect(week.weightAvgKg).toBe(82.4)
})

// Őszinte-null: hiányzó átlag nem nulla.
test('hiányzó átlag null marad, nem nulla', async () => {
  server.use(weekHandler({ mealScoreAvg: null, weightAvgKg: null }))
  const week = await mealApi.getWeek('2026-09-07')
  expect(week.mealScoreAvg).toBeNull()
  expect(week.weightAvgKg).toBeNull()
})
```

Follow the MSW handler idiom the neighbouring API tests already use — read one before writing this.

- [ ] **Step 3: Run the test to verify it fails, then implement**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL (`undefined`), then add the two fields to the mapper and the type, and surface them through `useFuelWeek`. In mock mode return a plausible seeded value; in real mode never substitute one.

- [ ] **Step 4: Re-run and commit**

```bash
git add frontend/src/data/fuel/mealApi.ts frontend/src/data/types.ts frontend/src/data/fuel/fuelWeekHooks.ts frontend/src/data/fuel/mealApi.test.ts
git commit -m "feat(fuel): stop dropping the weekly meal-score and weight averages (mezo-83g0)"
```

---

### Task 2: The weekly picture

**Files:**
- Create: `frontend/src/features/fuel/logic/fuelWeekView.ts`
- Create: `frontend/src/features/fuel/logic/fuelWeekView.test.ts`
- Modify: `frontend/src/features/fuel/pages/FuelTrendekPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `useFuelWeek()` (with Task 1's fields), and the day score. **Find the day score before inventing one:** the manifest says the six-dimension day evaluation is served by `getDayEvaluation` in `api/feature/me-week/me-week.yml` and lands as `MeWeekDay.subscores`. Locate its hook and reuse it; a day's "AI score" on this page is that existing evaluation, not a new formula.
- Produces:
  ```ts
  export interface WeekDayVM { date: string; label: string; weekend: boolean; kcal: number | null; targetKcal: number | null; pct: number | null; dayScore: number | null; logged: boolean; training: boolean }
  export interface WeekViewVM { days: WeekDayVM[]; loggedCount: number; weekdayAvgPct: number | null; weekendAvgPct: number | null; mealScoreAvg: number | null; weightAvgKg: number | null }
  export function buildWeekView(week: FuelWeekData, dayScores: Record<string, number | null>, trainingDays: string[]): WeekViewVM
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/logic/fuelWeekView.test.ts` (pure logic, no router, no QueryClient). Cases:

```ts
// C1 (mezo-83g0): hétköznap/hétvége kontraszt — ez a heti kép fő üzenete.
test('a hétköznapok és a hétvége átlaga külön áll', () => {
  const vm = buildWeekView(WEEK, SCORES, [])
  expect(vm.weekdayAvgPct).not.toBe(vm.weekendAvgPct)
})

// Őszinte-null: a nem naplózott nap NEM nulla, és nem rontja az átlagot.
test('a nem naplózott nap kimarad az átlagból', () => {
  const vm = buildWeekView(weekWithOneUnlogged(), SCORES, [])
  expect(vm.loggedCount).toBe(6)
  expect(vm.days.find(d => !d.logged)!.pct).toBeNull()
  expect(vm.weekdayAvgPct).toBe(avgOfLoggedWeekdaysOnly())
})

test('egyetlen naplózott nap nélkül minden átlag null', () => {
  const vm = buildWeekView(emptyWeek(), {}, [])
  expect(vm.weekdayAvgPct).toBeNull()
  expect(vm.weekendAvgPct).toBeNull()
})

// Az owner kérése: a nap AI pontszáma legyen a beszédes szám.
test('a nap az AI napi pontszámát viszi', () => {
  expect(buildWeekView(WEEK, { '2026-09-07': 7.8 }, []).days[0].dayScore).toBe(7.8)
})

test('értékelés nélküli nap pontszám nélkül jön vissza', () => {
  expect(buildWeekView(WEEK, {}, []).days[0].dayScore).toBeNull()
})

// C6: az edzésnapok a heti képben is látszanak.
test('az edzésnap meg van jelölve', () => {
  expect(buildWeekView(WEEK, SCORES, ['2026-09-08']).days[1].training).toBe(true)
})
```

- [ ] **Step 2: Run the test to verify it fails, then implement the VM**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL. Then write the pure builder.

- [ ] **Step 3: Write the failing page test**

In `frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx` (the S0 scaffold's test — replace its placeholder case):

```tsx
test('a heti kép a hét napjait mutatja a kerethez mérve', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.ftx-day')).toHaveLength(7)
})

// Az owner kérése: a napokon AI pontszám álljon, ne nyers makró-számok.
test('a nap az AI pontszámát mutatja', () => {
  const { container } = renderView()
  expect(container.querySelector('.ftx-day-score')).toHaveTextContent(/^\d/)
})

test('a nap koppintása üvegdobozban nyitja a napi részleteket', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /szeptember 8/i }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('glass')
})

// A napi részletek OLVASHATÓAK: a dimenzió-tények sorokban állnak (owner).
test('a napi üvegdoboz sorokban tálalja a dimenzió-tényeket', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /szeptember 8/i }))
  expect(within(screen.getByRole('dialog')).getAllByRole('listitem').length).toBeGreaterThan(1)
})

// Szégyenmentesség: a keret feletti nap nem hibaállapot.
test('a kereten túli nap nem hibaként jelenik meg', () => {
  const { container } = renderView({ over: true })
  expect(container.querySelector('.ftx-day.is-error')).toBeNull()
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba/i)
})

// Őszinte-null: nem naplózott nap.
test('a nem naplózott nap „nincs adat", nem nulla oszlop', () => {
  const { container } = renderView({ unlogged: true })
  const day = container.querySelector('.ftx-day.is-empty')!
  expect(day).toHaveTextContent(/nincs adat/i)
})
```

- [ ] **Step 4: Implement the page's hero**

Port `trendek` (`fuel-pages.js:199`), `weekBars` (`:192`), `trendDayGlass` (`:244`) and `dimFactView` (`:233`) — the last one is what makes the day box readable, so port its row layout rather than compressing it. The stat tiles show the weekday/weekend contrast plus the two averages Task 1 unlocked (meal quality, weight), rendering `—` when null. Bars fill and numbers count up, using the same `useFuelCountUp` hook S1a exported from `FuelMacroRings.tsx`; both are inert under reduced motion.

- [ ] **Step 5: Re-run and commit**

```bash
git add frontend/src/features/fuel/logic/fuelWeekView.ts frontend/src/features/fuel/logic/fuelWeekView.test.ts frontend/src/features/fuel/pages/FuelTrendekPage.tsx frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): the weekly picture with day scores and weekday/weekend contrast (mezo-83g0)"
```

---

### Task 3: The long horizon

**Files:**
- Create: `frontend/src/features/fuel/components/FuelHorizon.tsx`
- Create: `frontend/src/features/fuel/components/FuelHorizon.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelTrendekPage.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: the existing metric series (manifest C3 names `MetricSeriesService` with DAILY_KCAL / PROTEIN / MEAL_SCORE / WATER plus the weight series used by Én). Find the frontend hook that already reads them — Én renders weight from it — and reuse it. **No new backend, no new endpoint.**
- Produces: `export function FuelHorizon({ weeks }: { weeks: HorizonWeek[] }): JSX.Element` plotting intake and weight on one time axis.

- [ ] **Step 1: Write the failing test**

```tsx
// C3 (mezo-83g0): evés és súly EGY időtengelyen — meglévő sorozatokból, új backend nélkül.
test('az evés és a súly egy időtengelyen jelenik meg', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} />)
  expect(container.querySelector('.ftx-horizon-kcal')).not.toBeNull()
  expect(container.querySelector('.ftx-horizon-weight')).not.toBeNull()
})

// Őszinte-null: hiányzó súlymérés megszakítja a vonalat, nem húzza nullára.
test('a hiányzó súly megszakítja a vonalat, nem nullára húzza', () => {
  const { container } = render(<FuelHorizon weeks={weeksWithGap()} />)
  const d = container.querySelector('.ftx-horizon-weight')!.getAttribute('d')!
  expect(d).toMatch(/M.*M/)   // több szakasz — a hiány valódi szakadás
})

test('két hétnél kevesebb adatnál nem rajzolunk trendet', () => {
  render(<FuelHorizon weeks={[WEEKS[0]]} />)
  expect(screen.getByText(/Néhány hét kell/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails, then implement**

Port `horizonChart` (`fuel-pages.js:223`) and `trendHorizonGlass` (`:283`). A missing weight sample is a genuine break in the path, never an interpolated or zeroed point.

- [ ] **Step 3: Re-run and commit**

```bash
git add frontend/src/features/fuel/components/FuelHorizon.tsx frontend/src/features/fuel/components/FuelHorizon.test.tsx frontend/src/features/fuel/pages/FuelTrendekPage.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): intake × weight long horizon from the existing series (mezo-83g0)"
```

---

### Task 4: Pattern references and slice close

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelTrendekPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx`
- Modify: `docs/features/fuel.md`, `docs/CODEMAP.md`, `.beads/issues.jsonl`

**Interfaces:**
- Consumes: the canonical insight items Mezo owns. Find how Mezo renders and routes to a single insight, and link to THAT route.
- Produces: a pattern layer that references, never duplicates.

- [ ] **Step 1: Write the failing test**

```tsx
// C4 (mezo-83g0): a mintázatok kanonikus helye a Mezo — itt csak hivatkozunk rájuk.
test('a mintázat sora a kanonikus Mezo-elemre visz', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Étkezési ritmus/ }))
  expect(screen.getByTestId('loc').textContent).toMatch(/^\/mezo\//)
})

// Anti-duplikáció: a felismerés SZÖVEGÉT nem írjuk újra itt.
test('a mintázat sora nem másolja le a felismerés szövegét', () => {
  const { container } = renderView()
  const row = container.querySelector('.ftx-pattern')!
  expect(row.textContent!.length).toBeLessThan(120)
})

test('felismerés nélkül a réteg csendben elmarad, nem üres keret', () => {
  const { container } = renderView({ patterns: [] })
  expect(container.querySelector('.ftx-patterns')).toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails, then implement**

Port `trendPatternGlass` (`fuel-pages.js:277`) as the reference row. If an insight has no linkable canonical route, omit the row entirely.

- [ ] **Step 3: Docs, codemap, tracker**

Update `docs/features/fuel.md` with the Trendek surface and note that `/fuel/plan` and `/fuel/naplo` are superseded and retire in S5 (`mezo-qt5q`). Then from the worktree root:
```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
node scripts/check-beads-backup.mjs --fix
```

- [ ] **Step 4: Full gates and commit**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`

```bash
git add -A docs frontend/src .beads
git commit -m "feat(fuel): pattern references and Trendek slice close (mezo-83g0)"
```

---

## Self-review notes

- **Manifest coverage:** C1 (Task 2), C2 (Task 1 — the dropped averages, with a stop condition if the contract disagrees), C3 (Task 3), C4 (Task 4 — reference-only, with a test that would catch a copy), C5 (Task 2 — day quality inside the weekly picture, and the cache-only coach rule stated as a constraint), C6 (Task 2 — training days in the VM and the view).
- **The two ways this page could go wrong are both tested, not just stated:** shaming the user (adherence-neutral assertions) and lying with zeros (honest-null assertions on unlogged days, missing weights and absent averages).
- **No new backend:** Task 1 only stops discarding data; Task 3 reuses existing series. The contract-drift risk is called out with a stop condition instead of an invitation to edit the contract.
- **Type consistency:** `WeekDayVM`/`WeekViewVM`/`buildWeekView`/`FuelHorizon` and the `ftx-` prefix are spelled identically across every task.
