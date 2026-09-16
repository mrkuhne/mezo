# Fuel Mai kártya: óra-doboz + arány-gyűrűk — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Fuel Mai meal blocks, add a clock button that opens a small glass time-box showing the log time, and replace the per-meal gram strip with four mini rings (P/C/F = share of the meal's energy, fiber = share of the daily allowance), with the meal name full-width and the AI score chip moved to the bottom row.

**Architecture:** Pure share math goes in a new `mealShare.ts` logic module. The planned window time is threaded through `buildDayPlan` → `FuelSlot.plannedTime` → `DoneMealRow`, alongside a new `fiberG`. `FuelMealBlocks.tsx` renders the new row layout, the clock button, and a `TimeBox` built on the existing `GlassBox` portal primitive. All CSS lands inside the existing `fuel-mai titanium` block in `prototype.css` (`fmx-` prefix).

**Tech Stack:** React + TypeScript (frontend only), Vitest + Testing Library (jsdom), CSS in `frontend/src/styles/prototype.css`. No backend/contract change.

**Spec:** `docs/superpowers/specs/2026-09-16-fuel-card-time-box-macro-rings-design.md` · **bd:** mezo-l2gp0 · **Visual reference (owner-approved):** `docs/design_2.0/prototypes/fuel-kartya-ido.html`

## Global Constraints

- No emojis anywhere in UI — clay icons only (`ClayIcon`; clock = `i-idozito`, fiber = `i-noveny`).
- All new CSS INSIDE the existing `/* ── fuel-mai titanium (mezo-33k6) ── */` block of `frontend/src/styles/prototype.css`, `fmx-` prefixed — a second `fuel-mai titanium` block must NOT be opened (`prototypeCssStructure.test.ts` polices this).
- Honest-null: missing value → "—" and no arc, never a fabricated 0; a real 0 g shows "0 g" with an empty arc.
- Any motion must have a reduced-motion branch (`@media (prefers-reduced-motion: …)`); jsdom must not depend on animation timing.
- Hungarian UI copy; `huInt`/`hu1` for numbers.
- Tests run in BOTH modes (`VITE_USE_MOCK=false` and `"true"` explicitly — unset means mock). `pnpm test` file args do NOT scope; use `CI=true` full runs for gates.
- Run all commands from the worktree root `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/logging-cards-timestamp-display-102d81` (absolute paths; never `cd` to the primary repo).
- Conventional commits carrying the bd id, e.g. `feat(fuel): … (mezo-l2gp0)`.

---

### Task 1: `mealShare.ts` — pure share math

**Files:**
- Create: `frontend/src/features/fuel/logic/mealShare.ts`
- Test: `frontend/src/features/fuel/logic/mealShare.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  - `interface MacroShares { p: number | null; c: number | null; f: number | null }`
  - `macroEnergyShares(row: { proteinG: number | null; carbsG: number | null; fatG: number | null }): MacroShares` — integer percent (0–100) of the meal's macro-derived energy (Atwater 4/4/9). If ANY macro is null, or the macro energy total is 0, every share is null (a share over incomplete composition would be a fabricated fact).
  - `fiberSharePct(fiberG: number | null, targetG: number): number | null` — integer percent of the daily fiber allowance, clamped to 100; null when `fiberG` is null or `targetG <= 0`.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/fuel/logic/mealShare.test.ts`:

```ts
// ============================================================
// Mezo · mealShare tests (mezo-l2gp0) — a Mai kártya arány-gyűrűinek tiszta matekja.
// P/Ch/Zs: az étkezés SAJÁT (Atwater 4/4/9) energiájának részesedése; rost: napi adag része.
// ============================================================
import { expect, test } from 'vitest'
import { macroEnergyShares, fiberSharePct } from '@/features/fuel/logic/mealShare'

test('a makró-arányok az étkezés energiájából számolódnak (4/4/9)', () => {
  // 36 g P (144 kcal) + 48 g C (192) + 9 g F (81) = 417 kcal
  expect(macroEnergyShares({ proteinG: 36, carbsG: 48, fatG: 9 })).toEqual({ p: 35, c: 46, f: 19 })
})

test('a 0 g valódi nulla: 0%-os arány, nem null', () => {
  // banán: 1 g P (4) + 23 g C (92) + 0 g F (0) = 96 kcal
  expect(macroEnergyShares({ proteinG: 1, carbsG: 23, fatG: 0 })).toEqual({ p: 4, c: 96, f: 0 })
})

test('hiányzó makró mellett NINCS arány — csonka összetételre nem számolunk', () => {
  expect(macroEnergyShares({ proteinG: 36, carbsG: null, fatG: 9 })).toEqual({ p: null, c: null, f: null })
})

test('csupa nulla grammból nincs arány (0/0)', () => {
  expect(macroEnergyShares({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({ p: null, c: null, f: null })
})

test('a rost a napi adag része, 100-ra vágva', () => {
  expect(fiberSharePct(8, 30)).toBe(27)
  expect(fiberSharePct(45, 30)).toBe(100)
  expect(fiberSharePct(0, 30)).toBe(0)
})

test('rost őszinte-null: hiányzó gramm vagy értelmetlen cél → null', () => {
  expect(fiberSharePct(null, 30)).toBeNull()
  expect(fiberSharePct(8, 0)).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/logic/mealShare.test.ts`
Expected: FAIL — module `mealShare.ts` does not exist.
(Note: `pnpm vitest run <file>` DOES scope; it is `pnpm test -- <file>` that silently doesn't.)

- [ ] **Step 3: Write minimal implementation**

`frontend/src/features/fuel/logic/mealShare.ts`:

```ts
// ============================================================
// Mezo · mealShare (mezo-l2gp0) — a Mai kártya arány-gyűrűinek tiszta matekja.
//
// P/Ch/Zs gyűrű: a makró részesedése az étkezés SAJÁT, grammokból számolt (Atwater 4/4/9)
// energiájából — a részletlap arány-gyűrűinek szemantikája, kártya-léptékben. A napi célhoz
// mért per-étkezés ív a gyakorlatban üresnek látszott (owner, v1 elvetve).
// Rost gyűrű: a NAPI rost-adagból fedezett rész — a rostnak nincs energia-aránya.
//
// Őszinte-null: ha bármely makró hiányzik, EGYIK arány sem számolható (csonka összetételre
// nem állítunk tényt); a csupa-0 összetétel 0/0 → null. A hívó a grammot ettől még mutatja.
// ============================================================

export interface MacroShares { p: number | null; c: number | null; f: number | null }

const NONE: MacroShares = { p: null, c: null, f: null }

/** Egész százalék (0–100) makrónként az étkezés makró-energiájából; null-hármas, ha nem számolható. */
export function macroEnergyShares(row: {
  proteinG: number | null; carbsG: number | null; fatG: number | null
}): MacroShares {
  const { proteinG, carbsG, fatG } = row
  if (proteinG == null || carbsG == null || fatG == null) return NONE
  const p = proteinG * 4
  const c = carbsG * 4
  const f = fatG * 9
  const total = p + c + f
  if (total <= 0) return NONE
  return {
    p: Math.round((p / total) * 100),
    c: Math.round((c / total) * 100),
    f: Math.round((f / total) * 100),
  }
}

/** A napi rost-adagból fedezett rész egész százalékban, 100-ra vágva; őszinte-null. */
export function fiberSharePct(fiberG: number | null, targetG: number): number | null {
  if (fiberG == null || targetG <= 0) return null
  return Math.min(100, Math.round((fiberG / targetG) * 100))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/logic/mealShare.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/mealShare.ts frontend/src/features/fuel/logic/mealShare.test.ts
git commit -m "feat(fuel): meal-energy macro shares + fiber share math (mezo-l2gp0)"
```

---

### Task 2: `plannedTime` on done slots

**Files:**
- Modify: `frontend/src/data/types.ts` (the `FuelSlot` interface, around :50–64)
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (the done-slot branch of step 3, around :397)
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts` (append; reuse its `meal()` and `baseInput()` fixtures)

**Interfaces:**
- Consumes: `buildDayPlan(input: DayPlanInput)`, existing test fixtures `meal({ slot, loggedAt })`, `baseInput(over)`.
- Produces: `FuelSlot.plannedTime?: string` — the planned window's HH:mm on a done meal slot that consumed a planned window; ABSENT on every other slot (extra done slots without a window, open windows, protocol slots). Task 3 reads it.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/fuel/logic/buildDayPlan.test.ts`:

```ts
// mezo-l2gp0: a done slot időpontja a logolás ideje — a TERVEZETT ablak-idő eddig elveszett.
// Az óra-doboz "Terv szerint" sora miatt a done slot megőrzi plannedTime-ként.
test('a done slot megőrzi a tervezett ablak-idejét (plannedTime)', () => {
  const logged = meal({ slot: 'breakfast', loggedAt: '2026-07-02T07:55:00' })
  const withMeal = buildDayPlan(baseInput({ meals: [logged] }))
  const done = withMeal.slots.find(s => s.state === 'done')!
  const planned = buildDayPlan(baseInput({ meals: [] })).slots
    .find(s => s.slotKey === 'breakfast')!
  expect(done.time).toBe('07:55')
  expect(done.plannedTime).toBe(planned.time)
})

test('ablak nélküli extra logon nincs plannedTime — őszinte-null', () => {
  const b1 = meal({ id: 'b1', slot: 'breakfast', loggedAt: '2026-07-02T07:10:00' })
  const b2 = meal({ id: 'b2', slot: 'breakfast', loggedAt: '2026-07-02T09:40:00' })
  const plan = buildDayPlan(baseInput({ meals: [b1, b2] }))
  const dones = plan.slots.filter(s => s.state === 'done')
  expect(dones.length).toBeGreaterThanOrEqual(2)
  // a második reggeli nem kapott tervezett ablakot → nincs terv-idő
  expect(dones.some(s => s.plannedTime == null)).toBe(true)
  expect(dones.some(s => s.plannedTime != null)).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/logic/buildDayPlan.test.ts`
Expected: FAIL — `plannedTime` is `undefined` on the matched done slot (first test's `toBe(planned.time)`), and TypeScript may flag the unknown property first.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/data/types.ts`, inside `FuelSlot` after `mealName?: string`:

```ts
  /** A tervezett ablak HH:mm-je egy DONE meal-sloton (mezo-l2gp0): a `time` done állapotban a
   *  logolás ideje, a terv ideje pedig elveszne — az óra-doboz "Terv szerint" sora innen olvas.
   *  Ablak nélküli extra logon nincs (őszinte-null). */
  plannedTime?: string
```

In `frontend/src/features/fuel/logic/buildDayPlan.ts`, in the step-3 `mealSlots` map, the `if (logged)` branch returns an object starting `time: hhmmFromLoggedAt(logged.loggedAt, toHHmm(w.time)),` — add one field to that object:

```ts
        plannedTime: toHHmm(w.time),
```

(The step-4 "extra done slots" branch around :441 stays untouched — no planned window, no `plannedTime`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/logic/buildDayPlan.test.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/features/fuel/logic/buildDayPlan.test.ts
git commit -m "feat(fuel): done slots keep the planned window time (mezo-l2gp0)"
```

---

### Task 3: `DoneMealRow` gains `fiberG` + `plannedTime`

**Files:**
- Modify: `frontend/src/features/fuel/logic/keretHero.ts` (the `DoneMealRow` interface and `doneMealRows()`, around :145–175)
- Test: `frontend/src/features/fuel/logic/keretHero.test.ts` (append; reuse its existing meal/slot fixtures — if the file has none suitable, use the inline literals below)

**Interfaces:**
- Consumes: `FuelMeal.fiberG?: number | null` (already on the type, :163), `FuelSlot.plannedTime?: string` (Task 2).
- Produces: `DoneMealRow` extended with `fiberG: number | null` and `plannedTime: string | null`. Tasks 4–5 read both.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/fuel/logic/keretHero.test.ts` (adapt the two factory calls to the file's own fixture names if it has `meal()`/`slot()` helpers; otherwise these literals are complete):

```ts
// mezo-l2gp0: a Mai kártya rost-gyűrűje és óra-doboza — a sor viszi a rostot és a terv-időt.
test('doneMealRows viszi a rost grammot és a tervezett időt', () => {
  const meals = [{
    id: 'm-fiber', slot: 'breakfast', title: 'Skyr-bowl zabbal', score: 0.88,
    kcal: 420, p: 36, c: 48, f: 9, fiberG: 8,
    mealItems: [], items: [], tags: [],
    loggedAt: '2026-09-12T07:40:00', mealDate: '2026-09-12',
  } as unknown as FuelMeal]
  const slots: FuelSlot[] = [{
    time: '07:40', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast',
    state: 'done', mealId: 'm-fiber', plannedTime: '07:30',
  }]
  const rows = doneMealRows(meals, slots)
  expect(rows[0].fiberG).toBe(8)
  expect(rows[0].plannedTime).toBe('07:30')
})

test('doneMealRows őszinte-null: nincs rost-adat / nincs terv-idő', () => {
  const meals = [{
    id: 'm-plain', slot: 'breakfast', title: 'Kefir', score: null,
    kcal: 110, p: 8, c: 9, f: 4,
    mealItems: [], items: [], tags: [],
    loggedAt: '2026-09-12T09:40:00', mealDate: '2026-09-12',
  } as unknown as FuelMeal]
  const slots: FuelSlot[] = [{
    time: '09:40', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast',
    state: 'done', mealId: 'm-plain',
  }]
  const rows = doneMealRows(meals, slots)
  expect(rows[0].fiberG).toBeNull()
  expect(rows[0].plannedTime).toBeNull()
})
```

(If `FuelMeal`/`FuelSlot` are not yet imported in that test file, add them to its `@/data/types` type import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/logic/keretHero.test.ts`
Expected: FAIL — `fiberG`/`plannedTime` are `undefined` on the row (and TS flags the missing interface fields).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/features/fuel/logic/keretHero.ts`:

`DoneMealRow` — extend (after `proteinG/carbsG/fatG` line):

```ts
  /** Rost grammban (mezo-l2gp0) — a kártya rost-gyűrűjének számlálója; a wire-ról hiányzó
   *  rost null marad (őszinte-null), sosem 0. */
  fiberG: number | null
  /** A tervezett ablak-idő (mezo-l2gp0) — az óra-doboz "Terv szerint" sora; ablak nélküli
   *  extra logon null. */
  plannedTime: string | null
```

`doneMealRows()` — in the returned object add:

```ts
        fiberG: meal?.fiberG ?? null,
        plannedTime: s.plannedTime ?? null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/logic/keretHero.test.ts`
Expected: PASS. Also run `cd frontend && pnpm exec tsc --noEmit` — other `DoneMealRow` literal sites (e.g. `FuelMealBlocks.test.tsx` inline rows) may now fail to type-check; fix ONLY by adding the two new fields (`fiberG: null, plannedTime: null` or test-appropriate values) to those literals, nothing else.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/keretHero.ts frontend/src/features/fuel/logic/keretHero.test.ts frontend/src/features/fuel/components/FuelMealBlocks.test.tsx
git commit -m "feat(fuel): DoneMealRow carries fiber grams and the planned time (mezo-l2gp0)"
```

---

### Task 4: Card layout — macro ring row, full-width name, score chip below

**Files:**
- Modify: `frontend/src/features/fuel/components/FuelMealBlocks.tsx` (replace `MACRO_STRIP`/`MacroStrip` :40–61 and the `.fmx-meal-row` markup in `BlockCard` :179–194; update the header comment block :1–25)
- Modify: `frontend/src/styles/prototype.css` (inside the `fuel-mai titanium` block: replace `.fmx-meal-row`/`.fmx-meal-main`/`.fmx-meal-copy`/`.fmx-meal-macros`/`.fmx-mm` rules :12019–12035 with the new row + ring rules)
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx` (pass `fiberTargetG` at the `<FuelMealBlocks …>` call, :190)
- Test: `frontend/src/features/fuel/components/FuelMealBlocks.test.tsx` (replace the two gram-strip tests; extend fixtures)

**Interfaces:**
- Consumes: `macroEnergyShares`, `fiberSharePct` (Task 1); `DoneMealRow.fiberG` (Task 3); `ClayIcon` names `i-hus`/`i-gabona`/`i-avokado`/`i-noveny`; `huInt` from `@/shared/lib/huNum`; `dietSettings.fiberG` (already fetched in `FuelMaiPage` via `useDietSettings()`).
- Produces: `FuelMealBlocks` prop `fiberTargetG: number`; DOM contract used by tests and Task 5: `.fmx-mrings` (container, `role="img"`), `.fmx-mcell` (cell), `.fmx-mring` (+ `.is-null`), arc `<circle class="fl">` carrying `--p`.

- [ ] **Step 1: Update the test fixtures and write the failing tests**

In `frontend/src/features/fuel/components/FuelMealBlocks.test.tsx`:

1. In the `meal()` factory add `fiberG: 8,` (after `kcal: 420, p: 36, c: 48, f: 9,`).
2. In the done `slot()` of `fixture()` add `plannedTime: '07:30',`.
3. In `props()` add `fiberTargetG: 30,`.
4. DELETE the two tests `'a logolt étkezés sora mindhárom makrót viszi, grammban, a makró neve nélkül'` and `'a hiányzó makró gondolatjel a csíkon, nem nulla'`, and ADD:

```tsx
// mezo-l2gp0: a grammsor helyén négy mini gyűrű — P/Ch/Zs az étkezés energia-arányát teli
// (36/48/9 g → 144/192/81 kcal → 35/46/19%), a rost a napi adag részét (8/30 → 27%).
// A gramm marad a szám a gyűrűben; felirat továbbra sincs, a hue + clay ikon az azonosság.
test('a makró-gyűrűk az étkezés energia-arányát telítik, a rost a napi adagot', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const rings = container.querySelector('.fmx-block.is-done .fmx-mrings')!
  const cells = Array.from(rings.querySelectorAll('.fmx-mring'))
  expect(cells.map(c => c.querySelector('b')!.textContent)).toEqual(['36g', '48g', '9g', '8g'])
  const arcs = cells.map(c => (c.querySelector('.fl') as SVGCircleElement | null)?.style.getPropertyValue('--p') ?? null)
  expect(arcs).toEqual(['35', '46', '19', '27'])
  expect(rings.getAttribute('aria-label')).toBe(
    'fehérje 36 g, az étkezés energiájának 35%-a; '
    + 'szénhidrát 48 g, az étkezés energiájának 46%-a; '
    + 'zsír 9 g, az étkezés energiájának 19%-a; '
    + 'rost 8 g, a napi adag 27%-a',
  )
  // Felirat nincs a képernyőn — a szavak csak a felolvasónak szólnak.
  expect(rings.textContent).not.toMatch(/fehérje|szénhidrát|zsír|rost/i)
  expect(rings.querySelectorAll('.fmx-mcell > svg, .fmx-mcell .clay')).not.toHaveLength(0)
})

// Őszinte-null: hiányzó makró → "—" és nincs ív; csonka összetételre arány sem számolódik.
test('a hiányzó makró gondolatjel a gyűrűben, és ilyenkor egyik íve sincs aránynak', () => {
  const rows = [{
    mealId: 'meal-1', name: 'Skyr-bowl zabbal', time: '07:40', kcal: 420,
    proteinG: 36, carbsG: null, fatG: null, fiberG: null, plannedTime: '07:30', scorePct: 88,
  }]
  const { container } = render(<FuelMealBlocks {...props({ meals: rows })} />)
  const rings = container.querySelector('.fmx-block.is-done .fmx-mrings')!
  const cells = Array.from(rings.querySelectorAll('.fmx-mring'))
  expect(cells.map(c => c.querySelector('b')!.textContent)).toEqual(['36g', '—', '—', '—'])
  expect(rings.querySelectorAll('.fl')).toHaveLength(0)
  expect(rings.getAttribute('aria-label')).toBe(
    'fehérje 36 g; szénhidrát nincs adat; zsír nincs adat; rost nincs adat',
  )
})

// A név teljes szélességben él, az AI pont az alsó sorban a gyűrűk mellett (owner, v2).
test('az étkezés-sor: név felül, alul a gyűrűk és a pont-chip egy sorban', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const row = container.querySelector('.fmx-block.is-done .fmx-meal-row')!
  const bottom = row.querySelector('.fmx-meal-bottom')!
  expect(bottom.querySelector('.fmx-mrings')).not.toBeNull()
  expect(bottom.querySelector('.fmx-score')).not.toBeNull()
  expect(row.textContent).not.toMatch(/kcal/)
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/components/FuelMealBlocks.test.tsx`
Expected: the 3 new tests FAIL (no `.fmx-mrings`, no `fiberTargetG` prop); the untouched tests still pass.

- [ ] **Step 3: Implement the component**

In `frontend/src/features/fuel/components/FuelMealBlocks.tsx`:

1. Imports: drop `toMin, toHHmm` ONLY if `WindowBar` no longer uses them (it does — keep). Add:

```ts
import { macroEnergyShares, fiberSharePct } from '@/features/fuel/logic/mealShare'
```

2. Replace `MACRO_STRIP` + `MacroStrip` (:40–61) with:

```tsx
/**
 * A sor makró-gyűrűi (mezo-l2gp0, a v2 prototípus kalibrációja): NÉGY cella — P/Ch/Zs a
 * saját energia-arányával (mealShare.ts), a rost a napi adag részesedésével. Az azonosság
 * marad hue + clay ikon, felirat nélkül (mezo-n9peo); a gyűrűben a GRAMM a szám. Őszinte-null:
 * hiányzó gramm "—" és nincs ív; csonka összetételen egyik makró-ív sem rajzolódik.
 */
const MACRO_RINGS = [
  { key: 'proteinG' as const, share: 'p' as const, word: 'fehérje', color: 'var(--macro-protein)', icon: 'i-hus' as const },
  { key: 'carbsG' as const, share: 'c' as const, word: 'szénhidrát', color: 'var(--macro-carbs)', icon: 'i-gabona' as const },
  { key: 'fatG' as const, share: 'f' as const, word: 'zsír', color: 'var(--macro-fat)', icon: 'i-avokado' as const },
]

function RingCell({ color, icon, grams, sharePct }: {
  color: string; icon: 'i-hus' | 'i-gabona' | 'i-avokado' | 'i-noveny'
  grams: number | null; sharePct: number | null
}) {
  return (
    <span className="fmx-mcell" style={{ '--macro-color': color } as React.CSSProperties}>
      <ClayIcon name={icon} size={15} />
      <span className={`fmx-mring${grams == null ? ' is-null' : ''}`}>
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle className="tr" cx="20" cy="20" r="16" pathLength={100} />
          {grams != null && sharePct != null && (
            <circle className="fl" cx="20" cy="20" r="16" pathLength={100}
              style={{ '--p': String(sharePct) } as React.CSSProperties} />
          )}
        </svg>
        <b>{grams == null ? '—' : <>{huInt(grams)}<i>g</i></>}</b>
      </span>
    </span>
  )
}

function MacroRings({ row, fiberTargetG }: { row: DoneMealRow; fiberTargetG: number }) {
  const shares = macroEnergyShares(row)
  const fiberPct = fiberSharePct(row.fiberG, fiberTargetG)
  const label = [
    ...MACRO_RINGS.map(m => {
      const g = row[m.key]
      if (g == null) return `${m.word} nincs adat`
      const s = shares[m.share]
      return s == null ? `${m.word} ${huInt(g)} g` : `${m.word} ${huInt(g)} g, az étkezés energiájának ${s}%-a`
    }),
    row.fiberG == null
      ? 'rost nincs adat'
      : fiberPct == null ? `rost ${huInt(row.fiberG)} g` : `rost ${huInt(row.fiberG)} g, a napi adag ${fiberPct}%-a`,
  ].join('; ')
  return (
    <span className="fmx-mrings" role="img" aria-label={label}>
      {MACRO_RINGS.map(m => (
        <RingCell key={m.key} color={m.color} icon={m.icon} grams={row[m.key]} sharePct={shares[m.share]} />
      ))}
      <RingCell color="var(--macro-fiber)" icon="i-noveny" grams={row.fiberG} sharePct={fiberPct} />
    </span>
  )
}
```

3. In `BlockCard`, replace the `rows.map(…)` meal-row block with (props threaded: `BlockCard` and `FuelMealBlocks` both gain `fiberTargetG: number`):

```tsx
      {rows.map(r => (
        <div key={r.mealId} className="fmx-meal-row">
          {/* A név teljes szélességben (két sorig törhet) — a pont-chip az ALSÓ sorba került
              a gyűrűk mellé (mezo-l2gp0): korábban a név mellett szorongott, üres jobb oldallal. */}
          <button type="button" className="fmx-meal-main" onClick={() => onOpenMeal(r.mealId)}>
            <strong>{r.name || 'Étkezés'}</strong>
          </button>
          <div className="fmx-meal-bottom">
            <MacroRings row={r} fiberTargetG={fiberTargetG} />
            {/* A chip célja változatlan: az ÉRTÉKELÉS (mezo-jb84). */}
            <FuelScoreChip scorePct={r.scorePct} onOpen={() => onOpenScore(r.mealId)} />
          </div>
        </div>
      ))}
```

4. Header comment (:13–21): rewrite the owner-decision bullets — the visual reference line now also names `docs/design_2.0/prototypes/fuel-kartya-ido.html (v2, mezo-l2gp0)`; the „a sor IDEJE az ablak-csíkon él" bullet becomes: az idő az ablak-csíkon él ÉS az óra-dobozból kérhető le szövegesen (Task 5), a kártyán továbbra sincs idő-szöveg; the makró-csík bullet becomes the four-ring description (arány-szemantika + rost).

5. `FuelMaiPage.tsx`: add `fiberTargetG={dietSettings.fiberG}` to the `<FuelMealBlocks` call (:190).

- [ ] **Step 4: CSS — replace the meal-row rules**

In `frontend/src/styles/prototype.css`, inside the `fuel-mai titanium` block, REPLACE the `.fmx-meal-copy`, `.fmx-meal-macros`, `.fmx-mm` rules (:12024–12035 — `.fmx-meal-row` and `.fmx-meal-main` stay, retuned below) with:

```css
/* Étkezés-sor (mezo-l2gp0, v2 prototípus): a név teljes szélességben felül (2 soros clamp),
   alatta egy sorban a négy makró-gyűrű + jobbra a pont-chip. */
.fmx-meal-row { padding: 12px 0 13px; border-top: 1px solid var(--divider); }
.fmx-meal-main { display: block; width: 100%; padding: 0; border: 0; background: transparent;
  text-align: left; color: var(--ink); font-family: inherit; }
.fmx-meal-main strong { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; font-size: 16px; font-weight: 500; line-height: 1.3; }
.fmx-meal-bottom { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.fmx-meal-bottom .fmx-score { margin-left: auto; }

/* Makró mini-gyűrűk: 15px clay ikon a 40px gyűrű fölött, a gyűrűben a GRAMM makró-színnel.
   Ugyanaz a pathLength=100 ív-mechanika, mint a ház többi fmx gyűrűjén. */
.fmx-mrings { display: flex; gap: 14px; }
.fmx-mcell { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.fmx-mcell > svg:first-child { width: 15px; height: 15px;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.26)); }
.fmx-mring { position: relative; width: 40px; height: 40px; display: grid; place-items: center; }
.fmx-mring > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
  transform: rotate(-90deg);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--macro-color) 30%, transparent)); }
.fmx-mring circle { fill: none; stroke-width: 4; }
.fmx-mring .tr { stroke: var(--surface-recess); }
.fmx-mring .fl { stroke: var(--macro-color); stroke-linecap: round; stroke-dasharray: var(--p) 100; }
.fmx-mring b { position: relative; display: flex; align-items: baseline; font-size: 12.5px;
  font-weight: 600; font-variant-numeric: tabular-nums; color: var(--macro-color); }
.fmx-mring b i { font-style: normal; font-size: 7.5px; font-weight: 500; margin-left: 1px; color: var(--sub); }
.fmx-mring.is-null b { color: var(--faint); font-weight: 400; }
```

(`ClayIcon` renders an `svg.clay` element — if the icon selector `.fmx-mcell > svg:first-child` doesn't match its output, target `.fmx-mcell > .clay` instead; verify against the rendered DOM.)

- [ ] **Step 5: Run the component tests, then the full suite in both modes**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/components/FuelMealBlocks.test.tsx`
Expected: PASS (all, including the 3 new).
Then: `cd frontend && CI=true VITE_USE_MOCK=false pnpm test && CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS — fix any other consumer the layout change broke (only test expectations, not behavior).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/FuelMealBlocks.tsx frontend/src/features/fuel/components/FuelMealBlocks.test.tsx frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Mai card share-based macro+fiber rings, full-width name, score below (mezo-l2gp0)"
```

---

### Task 5: Clock button + TimeBox glass popover

**Files:**
- Modify: `frontend/src/features/fuel/components/FuelMealBlocks.tsx` (clock button in `BlockCard` head; `TimeBox` component; open-state in `FuelMealBlocks`)
- Modify: `frontend/src/styles/prototype.css` (timebox rules inside the `fuel-mai titanium` block)
- Test: `frontend/src/features/fuel/components/FuelMealBlocks.test.tsx`

**Interfaces:**
- Consumes: `GlassBox` (`frontend/src/features/fuel/components/GlassBox.tsx` — props `{ children, onClose, labelledBy, className, style }`; portals into `.phone-screen`/body, handles Escape + backdrop + focus); `DoneMealRow.time/plannedTime/name` (Task 3); `ClayIcon` `i-idozito`; `BLOCK_COLOR[tile.slotKey]`.
- Produces: DOM contract — clock trigger `button.fmx-clock[aria-label="Logolás ideje"]` (only on blocks with a logged row); dialog content `.fmx-timebox-time`, `.fmx-timebox-sub`, close `button` named `Rendben`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/fuel/components/FuelMealBlocks.test.tsx`:

```tsx
// mezo-l2gp0: az óra gomb — az idő nem szöveg a kártyán, hanem koppintásra nyíló üvegdoboz.
test('az óra gomb csak logolt blokkon él, és a doboz a logolás idejét mutatja', async () => {
  render(<FuelMealBlocks {...props()} />)
  const clocks = screen.getAllByRole('button', { name: 'Logolás ideje' })
  expect(clocks).toHaveLength(1) // 4 blokkból 1 logolt
  await userEvent.click(clocks[0])
  const dialog = screen.getByRole('dialog')
  expect(dialog.querySelector('.fmx-timebox-time')!.textContent).toBe('07:40')
  expect(dialog.querySelector('.fmx-timebox-sub')!.textContent).toBe('Reggeli · Skyr-bowl zabbal')
  expect(dialog.textContent).toContain('Terv szerint')
  expect(dialog.textContent).toContain('~07:30')
})

test('az óra-doboz zárható Rendbennel és Escape-pel is', async () => {
  render(<FuelMealBlocks {...props()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Logolás ideje' }))
  await userEvent.click(screen.getByRole('button', { name: 'Rendben' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Logolás ideje' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
})

// Őszinte-null: ablak nélküli extra logon nincs terv-idő → a sor elmarad, nem becslünk.
test('terv-idő nélkül a "Terv szerint" sor elmarad', async () => {
  const rows = [{
    mealId: 'meal-1', name: 'Skyr-bowl zabbal', time: '07:40', kcal: 420,
    proteinG: 36, carbsG: 48, fatG: 9, fiberG: 8, plannedTime: null, scorePct: 88,
  }]
  render(<FuelMealBlocks {...props({ meals: rows })} />)
  await userEvent.click(screen.getByRole('button', { name: 'Logolás ideje' }))
  expect(screen.getByRole('dialog').textContent).not.toContain('Terv szerint')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/components/FuelMealBlocks.test.tsx`
Expected: the 3 new tests FAIL (no clock button).

- [ ] **Step 3: Implement**

In `frontend/src/features/fuel/components/FuelMealBlocks.tsx`:

1. Import `useState` from `react` and `GlassBox` from `./GlassBox`.

2. `TimeBox` component (below `BudgetRing`):

```tsx
/**
 * Az óra-doboz (mezo-l2gp0): kis üvegdoboz a logolás idejével — a kártyán az idő az
 * ablak-csíkon ÉL, szövegesen innen kérhető le. View-only (owner-döntés); a "Terv szerint"
 * sor csak akkor áll, ha a done slot hozott tervezett időt (őszinte-null).
 */
function TimeBox({ label, blockColor, row, onClose }: {
  label: string; blockColor: string; row: DoneMealRow; onClose: () => void
}) {
  return (
    <GlassBox onClose={onClose} labelledBy="fmx-timebox-title" className="fmx-timebox"
      style={{ '--block-color': blockColor } as React.CSSProperties}>
      <span className="fmx-timebox-art" aria-hidden="true"><ClayIcon name="i-idozito" size={54} /></span>
      <div className="fmx-timebox-eyebrow" id="fmx-timebox-title">Logolva</div>
      <div className="fmx-timebox-time">{row.time}</div>
      <div className="fmx-timebox-sub">{row.name ? `${label} · ${row.name}` : label}</div>
      {row.plannedTime != null && (
        <div className="fmx-timebox-items">
          <div><span>Terv szerint</span><b>~{row.plannedTime}</b></div>
        </div>
      )}
      <button type="button" className="fmx-timebox-close" onClick={onClose}>Rendben</button>
    </GlassBox>
  )
}
```

3. In `BlockCard`'s head, between `fmx-block-name` and `BudgetRing` (new prop `onOpenTime: (mealId: string) => void` threaded from `FuelMealBlocks`):

```tsx
        {rows.length > 0 && (
          <button type="button" className="fmx-clock" onClick={() => onOpenTime(rows[0].mealId)}
            aria-label="Logolás ideje">
            <ClayIcon name="i-idozito" size={21} />
          </button>
        )}
```

4. In `FuelMealBlocks` (the exported wrapper): open-state + render. The open row and its tile:

```tsx
  const [timeboxFor, setTimeboxFor] = useState<string | null>(null)
  const timeboxRow = meals.find(m => m.mealId === timeboxFor) ?? null
  const timeboxTile = timeboxFor == null ? null : lane.tiles.find(t => t.mealId === timeboxFor) ?? null
```

pass `onOpenTime={setTimeboxFor}` to each `BlockCard`, and after the tiles `.map(…)` render:

```tsx
      {timeboxRow && timeboxTile && (
        <TimeBox label={timeboxTile.label} row={timeboxRow} onClose={() => setTimeboxFor(null)}
          blockColor={BLOCK_COLOR[timeboxTile.slotKey]} />
      )}
```

(The early-return empty branch of `FuelMealBlocks` renders no blocks, so hooks must be declared BEFORE the `if (lane.tiles.length === 0)` return to keep hook order stable.)

- [ ] **Step 4: CSS — clock button + timebox**

In `frontend/src/styles/prototype.css`, inside the `fuel-mai titanium` block, after the `.fmx-budget-ring` rules add:

```css
/* Az óra gomb (mezo-l2gp0): csendes üveg-korong a cím sorában — csak logolt blokkon. */
.fmx-clock { width: 34px; height: 34px; flex: 0 0 auto; display: grid; place-items: center;
  border-radius: 50%; border: 1px solid var(--border-subtle);
  background: var(--surface-glass); backdrop-filter: blur(6px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.07);
  font-family: inherit; }
.fmx-clock svg { width: 21px; height: 21px; filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.3)); }
.fmx-clock:active { transform: scale(0.92); transition: transform 0.12s; }
```

and after the `.fmx-glass-close` rules add:

```css
/* Az óra-doboz (mezo-l2gp0): kompakt, középre zárt üvegdoboz, kilógó clay stopperrel.
   A belépő 3D-billenés csak no-preference alatt fut; reduced alatt a doboz azonnal áll. */
.fmx-glass.fmx-timebox { width: min(78%, 280px); padding: 22px 22px 18px; overflow: visible;
  text-align: center;
  box-shadow: 0 34px 70px rgba(0, 0, 0, 0.5),
    0 0 34px color-mix(in srgb, var(--block-color) 16%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.08); }
@media (prefers-reduced-motion: no-preference) {
  .fmx-glass.fmx-timebox { animation: fmx-timebox-in 0.34s cubic-bezier(0.2, 0.9, 0.25, 1.18) both; }
  @keyframes fmx-timebox-in {
    from { opacity: 0; transform: perspective(700px) rotateX(14deg) scale(0.86) translateY(16px); }
    to { opacity: 1; transform: none; }
  }
}
.fmx-timebox-art { width: 54px; height: 54px; margin: -46px auto 2px; display: grid; place-items: center; }
.fmx-timebox-art svg { width: 54px; height: 54px;
  filter: drop-shadow(0 10px 12px rgba(0, 0, 0, 0.42)) drop-shadow(0 0 12px color-mix(in srgb, var(--block-color) 34%, transparent)); }
.fmx-timebox-eyebrow { font-size: 8px; font-weight: 700; letter-spacing: 1.4px;
  text-transform: uppercase; color: var(--sub); }
.fmx-timebox-time { margin-top: 2px; font-family: var(--ff-display); font-size: 54px;
  font-weight: 200; letter-spacing: -0.04em; line-height: 1.1; font-variant-numeric: tabular-nums;
  color: var(--ink); text-shadow: 0 0 26px color-mix(in srgb, var(--block-color) 30%, transparent); }
.fmx-timebox-sub { margin-top: 2px; font-size: 11px; color: var(--sub); }
.fmx-timebox-items { margin: 14px 0 0; padding: 10px 2px 0; border-top: 1px solid var(--divider);
  display: grid; gap: 7px; }
.fmx-timebox-items div { display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px; font-size: 12px; color: var(--sub); }
.fmx-timebox-items div b { font-weight: 600; font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--block-color) 70%, var(--ink)); }
.fmx-timebox-close { display: block; width: 100%; margin-top: 16px; padding: 10px 0;
  border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--surface-recess);
  color: var(--ink); font-family: inherit; font-size: 13px; font-weight: 600; }
```

- [ ] **Step 5: Run the tests, both modes**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel/components/FuelMealBlocks.test.tsx`
Expected: PASS.
Then: `cd frontend && CI=true VITE_USE_MOCK=false pnpm test && CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/FuelMealBlocks.tsx frontend/src/features/fuel/components/FuelMealBlocks.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): clock button opens a glass time-box with the log time (mezo-l2gp0)"
```

---

### Task 6: Gates, visual check, docs

**Files:**
- Modify: `docs/CODEMAP.md` (regenerated — Task 1 added `mealShare.ts`)
- Modify: `docs/features/fuel.md` (§2 + §10: the Mai block row description — rings + clock box; also fixes the stale §10 file list ONLY where this change touches it)

**Interfaces:**
- Consumes: everything above.
- Produces: a green, documented, pushable branch.

- [ ] **Step 1: Full local gates**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/logging-cards-timestamp-display-102d81/frontend && CI=true VITE_USE_MOCK=false pnpm test && CI=true VITE_USE_MOCK=true pnpm test && pnpm build && pnpm exec playwright test --config tests/layout/playwright.config.ts
```

Expected: all PASS (layout gate `.fmx-block` reachability included). If Playwright browsers are missing locally, note it and rely on CI for the layout job — do not skip the unit gates.

- [ ] **Step 2: Visual verification (mock PWA)**

Invoke the `verify` skill and drive the Fuel Mai page: confirm the four ring cells + score chip on a logged block, the clock button opening the time-box (time + "Terv szerint"), Escape/backdrop close, and the empty block WITHOUT a clock button. Compare against `docs/design_2.0/prototypes/fuel-kartya-ido.html`.

- [ ] **Step 3: Regenerate CODEMAP + update fuel.md**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/logging-cards-timestamp-display-102d81 && node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```

In `docs/features/fuel.md`: update the §2 Mai-block row description (gram strip → four share rings, clock button + time-box, score chip in the bottom row, `plannedTime` provenance) and add `mealShare.ts` to §10's fuel logic list.

- [ ] **Step 4: Commit**

```bash
git add docs/CODEMAP.md docs/features/fuel.md
git commit -m "docs(fuel): Mai card rings + time-box in feature doc and CODEMAP (mezo-l2gp0)"
```

---

## Self-review notes

- Spec coverage: window bar untouched (no task needed — v2 keeps it); clock button (T5); time-box content incl. honest-null plan row (T2/T3/T5); ring semantics + fiber (T1/T3/T4); layout (T4); owner-decision comment rewrite (T4); a11y labels (T4/T5); reduced-motion (T5 CSS); tests both modes (T4/T5/T6); CODEMAP + feature doc (T6).
- Type consistency: `DoneMealRow.fiberG/plannedTime` (T3) consumed by `MacroRings`/`TimeBox` (T4/T5); `MacroShares.p/c/f` (T1) consumed via `shares[m.share]` (T4); `FuelSlot.plannedTime` (T2) read in `doneMealRows` (T3); prop `fiberTargetG` produced T4, fixture updated same task.
- The `dietSettings.fiberG` daily target is already fetched on `FuelMaiPage` (mezo-xwgb) — no new data hook.
