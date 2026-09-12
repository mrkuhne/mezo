# Fuel Titanium S1a — the Mai energy hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Fuel Mai page's top with the approved Titanium energy instrument — a dimensional bowl inside a progress arc, the dominant remaining-kcal numeral, a tappable chip that opens the `keret − étel + mozgás` equation in a glass dialog, and five count-up macro rings (protein, carb, fat, fibre, water) each with its own clay icon above.

**Architecture:** The page keeps its existing data spine (`useFuelDay` + `useFuelTimeline` + `buildKeretHero`) — this slice is a presentation rebuild, not a data rebuild. `keretHero.ts`'s `KeretHeroVM` already carries everything the hero needs (`remainingKcal`, `consumedKcal`, `targetKcal`, `chips`, `rings`), so the work is: a new `FuelEnergyHero` component that renders that VM in the Titanium anatomy, a `fuel-titan-*` CSS block in `prototype.css`, and swapping `KeretHero` out of `FuelMaiPage`. Water joins the ring row as a fifth ring, so `buildKeretHero` gains nothing — its `rings` array already includes `water`.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library (colocated), the `mozaik` motion helpers (`EntranceGroup`, `useCountUp`), the `clay` icon kit, plain CSS in `frontend/src/styles/prototype.css`.

## Global Constraints

- Driving issue: `mezo-33k6` (S1). Parent: `mezo-jb84`. Frozen manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md` — this plan implements rows **A1** (hero), **A2** (macro rings) and **A15** (energy provenance). Spec: `docs/superpowers/specs/2026-09-11-fuel-titanium-design.md`.
- **The approved visual reference is the prototype**, `docs/design_2.0/prototypes/companion-titanium/`. Read these before writing any markup — they are the design contract, and your job is to port their anatomy to React, not to invent:
  - `fuel-dashboard.js` — `heroSection` (`:56`), `gauge` (`:53`), `ring` (`:8`), `tapChip` (`:55`), `energyDetailHtml` (`:67`), `animateFuelDashboard` (`:14`), `skipNextCountUp` (`:13`).
  - `fuel-pages.css` — the blocks `/* Hero: tappable… */` (`:271`), `/* Macro cells… */` (`:288`), `/* Glass box dialog */` (`:298`), `/* Tap chip… */` (`:317`), `/* Glass modal: visual equation flow */` (`:325`).
- Owner decisions this slice must honour (spec §Owner decisions + the prototype iterations):
  - **No 3D companion anywhere on Fuel** (decision 5).
  - Macro identity is fixed: **fehérje = red, meat icon · szénhidrát = gold, grain icon · zsír = gold, avocado icon · rost = green, plant icon · víz = blue**. The icons sit **above** the rings, not below.
  - The middle hero icon (the bowl) is **10% larger** than the first calibration.
  - The equation is NOT a drawer: tapping the chip opens the **glass dialog**.
  - Honest-null everywhere: an unknown value renders `—`, never a fabricated `0`.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test`, plus `pnpm build`. Test-file filters after `--` are ignored — always run the whole suite.
- There is **no `pnpm lint`** in this repo. The cheap gate is `bash .github/scripts/cheap-gates.sh` from the worktree root.
- `frontend/src/styles/prototype.css` is ~12 200 lines and is the main conflict surface. Add ONE new fenced block, `/* ── fuel-mai titanium (mezo-33k6) ── */ … /* ── /fuel-mai titanium ── */`, placed immediately before the `/* ── titan-dark scope (mezo-mhum) ──` fence. Scope-level overrides (anything selector-prefixed `.titan-dark`) go INSIDE the titan-dark block instead. `prototypeCssStructure.test.ts` parses the whole file — keep braces balanced and comments terminated.
- Reduced motion is mandatory: every animation this slice adds must be inert under `@media (prefers-reduced-motion: reduce)`.
- Hungarian UI copy; clay icons only, never emoji.
- Conventional commits carrying the bd id: `feat(fuel): ... (mezo-33k6)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: The count-up hook for hero numerals

**Files:**
- Modify: `frontend/src/features/fuel/logic/keretHero.ts` (append only — do not touch the existing exports)
- Test: `frontend/src/features/fuel/logic/keretHero.test.ts`

**Interfaces:**
- Consumes: `KeretHeroVM` (already exported at `keretHero.ts:20`).
- Produces: `export function heroEquationLines(vm: KeretHeroVM): EquationLine[]` where
  `export interface EquationLine { key: 'base' | 'activity' | 'eaten' | 'remaining'; label: string; value: number | null; sign: '+' | '−' | '=' | null }`
  — the ordered rows the glass equation dialog renders. Task 3 consumes it.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/fuel/logic/keretHero.test.ts` (reuse the file's existing `BUDGET`, `meal()`, `slot()` and `build()` helpers — do not write new ones):

```ts
// A1/A15 (mezo-33k6): az üvegdoboz egyenlete a hero számából vezethető le, és NEM talál ki
// értéket — ha az energiaszámítás nincs meg (statikus keret), a mozgás sora üres marad.
describe('heroEquationLines', () => {
  test('a négy sor sorrendje és előjele rögzített', () => {
    const lines = heroEquationLines(build())
    expect(lines.map(l => l.key)).toEqual(['base', 'activity', 'eaten', 'remaining'])
    expect(lines.map(l => l.sign)).toEqual([null, '+', '−', '='])
  })

  test('a sorok a hero számaiból jönnek, nem külön forrásból', () => {
    const vm = build({ consumed: { kcal: 800, p: 40, c: 90, f: 20 } })
    const lines = heroEquationLines(vm)
    const by = (k: string) => lines.find(l => l.key === k)!
    expect(by('eaten').value).toBe(vm.consumedKcal)
    expect(by('remaining').value).toBe(vm.remainingKcal)
    expect(by('base').value).toBe(vm.chips!.base)
    expect(by('activity').value).toBe(vm.chips!.activity)
  })

  test('statikus keretnél a mozgás sora őszintén üres, nem nulla', () => {
    const lines = heroEquationLines(build({ staticEnergy: true }))
    expect(lines.find(l => l.key === 'activity')!.value).toBeNull()
  })
})
```

Read `keretHero.ts:43-53` first to confirm how `chips` is nulled for `staticEnergy` — the third test must fail for the right reason, not because `chips` itself is null and the code throws.

- [ ] **Step 2: Run the test to verify it fails**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — `heroEquationLines is not a function` / no such export.

- [ ] **Step 3: Implement**

Append to `frontend/src/features/fuel/logic/keretHero.ts`:

```ts
/** Egy sor a hero üvegdobozának egyenletében (A15). */
export interface EquationLine {
  key: 'base' | 'activity' | 'eaten' | 'remaining'
  label: string
  value: number | null
  sign: '+' | '−' | '=' | null
}

/**
 * A `keret − étel + mozgás` egyenlet sorai — KIZÁRÓLAG a hero saját számaiból.
 * Statikus keretnél (a felhasználó fix kalóriacélt kért) nincs mozgás-komponens: a sor
 * `null` marad, és a felület „—"-t ír, nem nullát (őszinte-null szabály).
 */
export function heroEquationLines(vm: KeretHeroVM): EquationLine[] {
  return [
    { key: 'base', label: 'Alap', value: vm.chips?.base ?? null, sign: null },
    { key: 'activity', label: 'Mozgás', value: vm.chips?.activity ?? null, sign: '+' },
    { key: 'eaten', label: 'Étel', value: vm.consumedKcal, sign: '−' },
    { key: 'remaining', label: 'Marad', value: vm.remainingKcal, sign: '=' },
  ]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/keretHero.ts frontend/src/features/fuel/logic/keretHero.test.ts
git commit -m "feat(fuel): hero equation lines for the Titanium glass box (mezo-33k6)"
```

---

### Task 2: The macro ring row

**Files:**
- Create: `frontend/src/features/fuel/components/FuelMacroRings.tsx`
- Create: `frontend/src/features/fuel/components/FuelMacroRings.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (the new `fuel-mai titanium` block)

**Interfaces:**
- Consumes: `RingVM[]` (`keretHero.ts:18`) — `{ key: 'p'|'c'|'f'|'fiber'|'water'; label; pct; value; target; color }`.
- Produces: `export function FuelMacroRings({ rings }: { rings: RingVM[] }): JSX.Element` — a `.fmx-rings` row of five cells, each `<span class="fmx-ico"><ClayIcon …/></span>` above a `.fmx-ring` SVG with the count-up numeral inside. Task 3 renders it inside the hero.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/FuelMacroRings.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { RingVM } from '@/features/fuel/logic/keretHero'
import { FuelMacroRings } from '@/features/fuel/components/FuelMacroRings'

const RINGS: RingVM[] = [
  { key: 'p', label: 'fehérje', pct: 95, value: '148 g', target: '155 g', color: '#e0796a' },
  { key: 'c', label: 'szénhidrát', pct: 71, value: '224 g', target: '316 g', color: '#d8a44a' },
  { key: 'f', label: 'zsír', pct: 79, value: '58 g', target: '73 g', color: '#d8c14a' },
  { key: 'fiber', label: 'rost', pct: 73, value: '22 g', target: '30 g', color: '#7fc36b' },
  { key: 'water', label: 'víz', pct: 46, value: '1,9 l', target: '4 l', color: '#6fb6d8' },
]

// A2 (mezo-33k6): az owner által rögzített makró-identitás — hús/gabona/avokádó/növény/víz
// ikon a gyűrű FÖLÖTT, és minden gyűrű a saját színét viseli.
test('öt gyűrű, mindegyik a saját ikonjával a gyűrű fölött', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  const cells = container.querySelectorAll('.fmx-cell')
  expect(cells).toHaveLength(5)
  expect(Array.from(cells).map(c => c.querySelector('use')?.getAttribute('href'))).toEqual([
    '#i-hus', '#i-gabona', '#i-avokado', '#i-noveny', '#i-viz',
  ])
  // az ikon a gyűrű ELŐTT áll a DOM-ban — a vizuális „fölötte" ennek a CSS-párja
  for (const cell of cells) {
    expect(cell.firstElementChild!.className).toContain('fmx-ico')
  }
})

test('minden gyűrű a saját színét és töltöttségét kapja', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  const first = container.querySelector('.fmx-ring') as HTMLElement
  expect(first.style.getPropertyValue('--macro-color')).toBe('#e0796a')
  expect(first.style.getPropertyValue('--ring-progress')).toBe('95')
})

// Őszinte-null: cél nélkül nincs százalék és nincs kitalált nulla.
test('ismeretlen célnál a gyűrű üres marad, nem nullát mutat', () => {
  const { container } = render(
    <FuelMacroRings rings={[{ ...RINGS[0], pct: 0, value: '—', target: '—' }]} />,
  )
  expect(screen.getByText('—')).toBeInTheDocument()
  expect(container.querySelector('.fmx-ring')!.className).toContain('is-empty')
})

test('a gyűrű képernyőolvasónak egy mondatban mondja el az értéket', () => {
  render(<FuelMacroRings rings={RINGS} />)
  expect(screen.getByLabelText('fehérje: 148 g / 155 g')).toBeInTheDocument()
})
```

**Before writing this test, check the clay icon names.** The five names above (`i-hus`, `i-gabona`, `i-avokado`, `i-noveny`, `i-viz`) are the INTENT from the owner's macro decision; only `i-viz` is certain to exist. Run `grep -o 'symbol id="i-[a-z0-9-]*"' frontend/src/shared/ui/clay/clay-icons.svg | sort` first. For each of the four that is missing, add it exactly the way S0 did (`docs/superpowers/plans/2026-09-12-fuel-titanium-s0-shell.md` Task 1 is the worked example): draw the symbol in `docs/design_2.0/assets/clay-icons.svg` at `viewBox="0 0 64 64"` in the Titanium material (`ig-titanium` base + ONE accent from the CLOSED palette `ig-blue`/`ig-gold`/`ig-purple`/`ig-lime`/`ig-rose` + `filter="url(#ig-shadow)"`, no new gradient), `cp` the file verbatim to `frontend/src/shared/ui/clay/clay-icons.svg`, extend the `ClayIconName` union, and bump the count in `Clay.test.tsx` (name string, assertion, and the header comment's figure). The prototype's own art for these lives in `docs/design_2.0/prototypes/companion-titanium/nap.html` as `i-meat`, `i-carb`, `i-fat`, `i-fiber` — port the shapes, but re-point every gradient to the `ig-*` ids. Use the real names you end up with in the test.

- [ ] **Step 2: Run the test to verify it fails**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — cannot resolve `@/features/fuel/components/FuelMacroRings`.

- [ ] **Step 3: Implement the component**

Create `frontend/src/features/fuel/components/FuelMacroRings.tsx`. Port `fuel-dashboard.js`'s `ring()` (`:8`) anatomy: an outer `.fmx-cell`, the clay icon first, then `.fmx-ring` carrying `--macro-color` and `--ring-progress` as inline custom properties, an SVG with a `pathLength="100"` track circle and progress circle, and inside it the numeral plus the `/ target` sub-label. Give the ring the class `is-empty` when the target is unknown. Put the whole value sentence on `aria-label` (`` `${label}: ${value} / ${target}` ``) and mark the visual numerals `aria-hidden`, so a screen reader hears it once.

Use `useCountUp` from `@/shared/ui/mozaik/motion` for the numeral — read its signature there first and follow how `NapHubPage.tsx` calls it. Skip the count-up when the value is unknown.

- [ ] **Step 4: Add the CSS**

Open the new `/* ── fuel-mai titanium (mezo-33k6) ── */` block in `frontend/src/styles/prototype.css` (immediately before the `titan-dark scope` fence) and port the prototype's `/* Macro cells: number-only rings, custom icon below */` block (`fuel-pages.css:288`), renaming its selectors to the `fmx-` prefix and flipping the icon above the ring. The progress arc is `stroke-dasharray` driven off `--ring-progress` against `pathLength="100"`. Guard the sweep animation:

```css
@media (prefers-reduced-motion: reduce) {
  .fmx-ring-progress { transition: none; animation: none; }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS, including `prototypeCssStructure.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/FuelMacroRings.tsx frontend/src/features/fuel/components/FuelMacroRings.test.tsx frontend/src/styles/prototype.css docs/design_2.0/assets/clay-icons.svg frontend/src/shared/ui/clay/
git commit -m "feat(fuel): Titanium macro ring row with owner-approved macro identity (mezo-33k6)"
```

---

### Task 3: The energy hero with its glass equation

**Files:**
- Create: `frontend/src/features/fuel/components/FuelEnergyHero.tsx`
- Create: `frontend/src/features/fuel/components/FuelEnergyHero.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (same `fuel-mai titanium` block)

**Interfaces:**
- Consumes: `KeretHeroVM`, `heroEquationLines` (Task 1), `FuelMacroRings` (Task 2).
- Produces: `export function FuelEnergyHero({ vm, onOpenEnergy }: { vm: KeretHeroVM; onOpenEnergy?: () => void }): JSX.Element`. Task 4 mounts it on the page.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/components/FuelEnergyHero.test.tsx` with a `vm()` factory built from `buildKeretHero` (import it and the same literal `DayBudget` shape `keretHero.test.ts` uses — read that file and copy the fixture style rather than inventing one), and these cases:

```tsx
// A1 (mezo-33k6): a hero egyetlen üzenete a MARADÉK — az a domináns szám.
test('a maradék kcal a domináns szám, a tál az ívben ül', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  expect(container.querySelector('.fmx-hero-remaining')).toHaveTextContent('2 060')
  expect(container.querySelector('.fmx-gauge use')!.getAttribute('href')).toBe('#i-fuel')
})

// A15: az egyenlet NEM fiók — üvegdobozban nyílik, és csak koppintásra.
test('a koppintós chip üvegdobozban nyitja meg az egyenletet', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('glass')
  for (const label of ['Alap', 'Mozgás', 'Étel', 'Marad']) {
    expect(within(box).getByText(label)).toBeInTheDocument()
  }
})

test('az üvegdoboz bezárható', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Bezárom' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

// Őszinte-null: statikus keretnél nincs kitalált mozgás-szám.
test('statikus keretnél a mozgás sora gondolatjel', () => {
  render(<FuelEnergyHero vm={vm({ staticEnergy: true })} />)
  ...open the box, then:
  expect(within(screen.getByRole('dialog')).getByText('—')).toBeInTheDocument()
})

// A túlevett nap nem szégyenít: a szám előjelet vált, a keretezés semleges marad.
test('túllépett keretnél a szám negatív, a szöveg nem minősít', () => {
  const over = vm({ consumed: { kcal: 3000, p: 0, c: 0, f: 0 } })
  const { container } = render(<FuelEnergyHero vm={over} />)
  expect(container.querySelector('.fmx-hero-remaining')!.textContent).toMatch(/^−/)
  expect(container.textContent).not.toMatch(/elrontott|túlevés|hiba/i)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — cannot resolve `@/features/fuel/components/FuelEnergyHero`.

- [ ] **Step 3: Implement**

Port `heroSection` (`fuel-dashboard.js:56`) with the `gauge` (`:53`) and `tapChip` (`:55`). Anatomy, top to bottom: the gauge (bowl clay icon inside a progress arc whose sweep is the day's consumed fraction), the dominant remaining numeral with its `kcal ma` unit, the tap chip, then `<FuelMacroRings rings={vm.rings} />`.

The glass box is a native `<dialog className="glass">` opened with `showModal()` — this is the house pattern; find an existing `dialog.glass` user in `src/` and copy its open/close/escape handling verbatim rather than writing new modal logic. Its body renders `heroEquationLines(vm)` as the equation flow from `fuel-pages.css:325`, rendering `—` wherever `value` is `null`. Close button label: `Bezárom`.

If `onOpenEnergy` is supplied, the chip calls it INSTEAD of opening the local box — that is how Task 4 keeps the existing shared `EnergyBreakdownSheet` (A15, also used by the Én hub) reachable. Default (no prop) is the local glass box.

- [ ] **Step 4: Add the CSS**

Port `/* Hero: tappable… */` (`:271`), `/* Glass box dialog */` (`:298`), `/* Tap chip… */` (`:317`) and `/* Glass modal: visual equation flow */` (`:325`) into the same `fuel-mai titanium` block under the `fmx-` prefix. The bowl is 10% larger than the prototype's first calibration — the prototype file already carries the approved size, so port the value as written. Reduced-motion guard on the chip sheen and the arc sweep.

- [ ] **Step 5: Run the tests to verify they pass**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/components/FuelEnergyHero.tsx frontend/src/features/fuel/components/FuelEnergyHero.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): Titanium energy hero with the glass equation box (mezo-33k6)"
```

---

### Task 4: Mount the hero on Mai

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`

**Interfaces:**
- Consumes: `FuelEnergyHero` (Task 3). The page keeps calling `buildKeretHero` exactly as it does now.
- Produces: the rebuilt Mai top. The mosaic tiles, the settings band and the sheets below it are untouched by this slice (S1b replaces the meal area, S1d rewires the rest).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`, reusing its existing `renderView()` harness and `vi.mock('@/data/hooks', …)` hoisted-partial idiom:

```tsx
// A1/A2/A15 (mezo-33k6): a Mai teteje a Titán energiaműszer. A régi KeretHero elment.
test('a Mai a Titán energia-heroval nyit', () => {
  const { container } = renderView()
  expect(container.querySelector('.fmx-hero')).not.toBeNull()
  expect(container.querySelector('.khero-n')).toBeNull()
  expect(container.querySelectorAll('.fmx-cell')).toHaveLength(5)
})

// A15: a hero koppintása a MEGLÉVŐ, Énnel közös energia-magyarázatot nyitja — nem másolatot.
test('a hero koppintása az energia-magyarázatot nyitja', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  expect(await screen.findByText(/Alapanyagcsere|Energia/i)).toBeInTheDocument()
})
```

Before writing the second test, open `frontend/src/features/fuel/components/EnergyBreakdownSheet.tsx` (or wherever `FuelMaiPage.tsx` imports it from) and assert on text that sheet genuinely renders.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — `.fmx-hero` is null (the page still renders `KeretHero`).

- [ ] **Step 3: Implement**

In `FuelMaiPage.tsx`, replace the `.fh-hero` / `KeretHero` render with `<FuelEnergyHero vm={hero} onOpenEnergy={() => setEnergyOpen(true)} />`, keeping the existing `energyOpen` state and `EnergyBreakdownSheet` mount so A15's shared sheet stays canonical. Leave `buildKeretHero`'s call site, the mosaic, the band and every other hook exactly as they are.

Update the page's header comment: cite `mezo-33k6` and manifest rows A1/A2/A15, and say in one line what replaced `KeretHero` and why the energy sheet is still the canonical provenance surface.

- [ ] **Step 4: Delete what is now dead**

`KeretHero` is now unreferenced if nothing else imports it. Check with `grep -rn "KeretHero" frontend/src --include=*.tsx --include=*.ts`. If `FuelMaiPage` was its only consumer, delete the component and its test in this task and say so in the commit body; if anything else still uses it, leave it and note the remaining consumer in the commit body instead. Do NOT delete `buildKeretHero` from `logic/keretHero.ts` — the VM builder stays.

- [ ] **Step 5: Run the full gates**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/features/fuel/pages/FuelMaiPage.test.tsx
git commit -m "feat(fuel): Mai opens with the Titanium energy instrument (mezo-33k6)"
```

---

## Self-review notes

- **Manifest coverage:** A1 (hero, Tasks 3+4), A2 (rings, Task 2), A15 (energy provenance — Task 1 supplies the lines, Task 3 the box, Task 4 keeps the shared sheet canonical). A3–A14 and A16–A20 are explicitly out of scope here and belong to S1b/S1c/S1d.
- **Type consistency:** `KeretHeroVM`, `RingVM` and `EquationLine` are used with the same spelling in Tasks 1–4; `FuelEnergyHero`/`FuelMacroRings` keep one file path and one component name across their tasks and their mount site.
- **Known open item, deliberately delegated:** the four macro clay icons may not exist yet. Task 2 Step 1 makes checking mandatory and gives the exact add-an-icon procedure rather than assuming either answer.
