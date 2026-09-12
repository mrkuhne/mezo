# Fuel Titanium S0 — shell foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the approved Fuel destination set (`Mai · Kiegészítők · Trendek · Konyha`) into the production navigation with its four new clay icons, add the two new routes, and make every Fuel route render in the Titanium dark scope — without changing any existing page's content or breaking a single old deep link.

**Architecture:** The merged Titanium navigation (`frontend/src/app/navModel.ts`, mezo-jkh4) is already the single source of truth for the 5×4 matrix, so this slice edits one row of `DOMAINS`, adds four symbols to the clay sprite pair, adds two routes whose pages are honest placeholders (their content lands in S3/S4), and replaces `AppLayout`'s hardcoded `titanDark` path list with a predicate that also covers `/fuel*`. Everything else in Fuel keeps working exactly as it does today.

**Tech Stack:** React 19 + TypeScript, React Router (route table in `router.tsx`), Vitest + Testing Library (colocated `*.test.tsx`), Vite (dual mode via `VITE_USE_MOCK`), clay SVG sprite set.

## Global Constraints

- Driving issue: `mezo-o6uv` (S0). Parent: `mezo-jb84`. Frozen manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md`. Spec: `docs/superpowers/specs/2026-09-11-fuel-titanium-design.md`.
- Tab order is display order ONLY: `/fuel`, `/fuel/stack`, `/fuel/trendek`, `/fuel/konyha`. No existing route path is renamed or removed in this slice (retirements + redirects are S5, `mezo-qt5q`).
- The clay sprite is a 1:1 asset contract: new art lands in `docs/design_2.0/assets/clay-icons.svg` FIRST, then is copied verbatim into `frontend/src/shared/ui/clay/clay-icons.svg`. Both files must end up byte-identical for the symbols they share.
- Sprite gradients in production are id-prefixed and the palette is CLOSED — exactly `ig-titanium`, `ig-blue`, `ig-gold`, `ig-purple`, `ig-lime`, `ig-rose` plus the `ig-shadow` filter. Use `url(#…)` against those ids only; do NOT add a gradient (the prototype's `red`/`avo`/`pink` have no production counterpart — `ig-rose` stands in) and never reference the prototype's unprefixed ids.
- Every new symbol keeps the Titanium set's `viewBox="0 0 64 64"` (all 54 existing `i-*` symbols use it; the `<use>` wrapper's own `0 0 100 100` is irrelevant — the symbol's viewBox wins).
- Material recipe, per the sprite header comment: brushed-titanium base (`ig-titanium`) + ONE domain accent + thin bright highlight strokes + `filter="url(#ig-shadow)"` on the outer group.
- Hungarian UI copy; no emoji in production UI (clay icons only).
- Both frontend modes must stay green: `CI=true VITE_USE_MOCK=true pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test` (run from `frontend/`). Test-file filters after `--` are ignored by this repo's setup, so run the whole suite.
- Conventional commits carrying the bd id, e.g. `feat(fuel): ... (mezo-o6uv)`.

---

## Slice map (bd graph)

| Slice | bd | Scope |
| --- | --- | --- |
| S0 | `mezo-o6uv` | This plan: nav row, four icons, two routes, titan-dark scope |
| S1 | `mezo-33k6` | Mai: hero, rings, meal blocks, camera-first logger, meal detail, AI score |
| S2 | `mezo-g2vl` | Kiegészítők: time bands, intake, Protokoll page, dose setup page |
| S3 | `mezo-83g0` | Trendek: weekly picture, day glass, stat tiles, horizon, patterns |
| S4 | `mezo-hygp` | Konyha: posters, Receptek + recipe detail, Kamra + item detail, Műhely |
| S5 | `mezo-qt5q` | Cleanup: dead code, deep links, tutorial anchors, docs, coverage closure |

---

### Task 1: Four new clay icons in the design sprite and the app sprite

**Files:**
- Modify: `docs/design_2.0/assets/clay-icons.svg` (append four `<symbol>` blocks before `</defs>`/end of file, matching the file's existing structure)
- Modify: `frontend/src/shared/ui/clay/clay-icons.svg` (verbatim copy of the same four blocks)
- Modify: `frontend/src/shared/ui/clay/index.tsx:13-26` (the `ClayIconName` union)
- Test: `frontend/src/shared/ui/clay/Clay.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: four new `ClayIconName` values — `'i-tanyer'`, `'i-kiegeszito'`, `'i-trend'`, `'i-fazek'` — renderable as `<ClayIcon name="i-tanyer" size={22} />`.

- [ ] **Step 1: Write the failing test**

In `frontend/src/shared/ui/clay/Clay.test.tsx`, update the count test (`:11-15`) from 54 to 58 — its name string, its assertion, AND the "(54 symbols)" figure in the file's header comment at `:5` — then add:

```tsx
// Fuel Titanium (mezo-o6uv): a Fuel fülsor négy saját szimbóluma — tányér, kiegészítő-tégely,
// trend-tábla, fazék. A készlet szabálya szerint titánium alap + domén-akcentus.
test('a négy Fuel-fül ikon a sprite-ban van, a titánium recept szerint', () => {
  render(<ClaySprites />)
  for (const id of ['i-tanyer', 'i-kiegeszito', 'i-trend', 'i-fazek']) {
    const sym = document.querySelector(`#${id}`)
    expect(sym, `${id} hiányzik`).not.toBeNull()
    expect(sym!.getAttribute('viewBox')).toBe('0 0 64 64')
    expect(sym!.innerHTML).toContain('url(#ig-titanium)')
    expect(sym!.innerHTML).toContain('url(#ig-shadow)')
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — `i-tanyer hiányzik` (and the 54-symbol count assertion fails once updated to 58).

- [ ] **Step 3: Add the four symbols to the design sprite**

Append to `docs/design_2.0/assets/clay-icons.svg`, immediately before the file's closing `</defs></svg>` (the last line, after the `i-life-regeneracio` symbol):

```svg
<symbol id="i-tanyer" viewBox="0 0 64 64"><g filter="url(#ig-shadow)"><ellipse cx="32" cy="34" rx="26" ry="24" fill="url(#ig-titanium)" stroke="#c3bdd6" stroke-width=".8"/><ellipse cx="32" cy="33" rx="18.5" ry="17" fill="#1b1e28"/><ellipse cx="32" cy="32" rx="14" ry="12.5" fill="url(#ig-lime)" opacity=".92"/><path d="M24 25C27 20 33 20 36 24" fill="none" stroke="#f1ffd0" stroke-width="1.8" stroke-linecap="round" opacity=".85"/><path d="M12 14V26M9 14V21M15 14V21M12 26V44" stroke="url(#ig-blue)" stroke-width="2.6" stroke-linecap="round"/><path d="M52 14C55 17 55 23 52 26V44" stroke="url(#ig-gold)" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M18 20A22 20 0 0 1 30 12" fill="none" stroke="#ffffff" stroke-opacity=".3" stroke-width="1.6" stroke-linecap="round"/></g></symbol>
<symbol id="i-kiegeszito" viewBox="0 0 64 64"><g filter="url(#ig-shadow)"><rect x="17" y="6" width="30" height="10" rx="3.5" fill="#d7dde6" stroke="#aab3c2" stroke-width=".8"/><rect x="13" y="16" width="38" height="42" rx="9" fill="url(#ig-titanium)" stroke="#c9c2dc" stroke-width=".8"/><rect x="19" y="25" width="26" height="24" rx="6" fill="#151822"/><g transform="rotate(-35 32 37)"><rect x="21" y="32" width="22" height="11" rx="5.5" fill="url(#ig-purple)" stroke="#e4d8ff" stroke-width=".7"/><path d="M32 32v11" stroke="#2a2533" stroke-width="1.2"/></g><circle cx="46" cy="12" r="3" fill="url(#ig-gold)"/><path d="M17 22H24" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round"/></g></symbol>
<symbol id="i-trend" viewBox="0 0 64 64"><g filter="url(#ig-shadow)"><rect x="6" y="9" width="52" height="46" rx="12" fill="url(#ig-titanium)" stroke="#c3bdd6" stroke-width=".8"/><rect x="11" y="14" width="42" height="36" rx="8" fill="#161a23"/><path d="M15 42L26 32L34 37L49 20" fill="none" stroke="url(#ig-blue)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 46L26 41L34 44L49 34" fill="none" stroke="url(#ig-purple)" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 5"/><circle cx="49" cy="20" r="4" fill="url(#ig-gold)"/><path d="M13 18A9 9 0 0 1 20 14" fill="none" stroke="#ffffff" stroke-opacity=".3" stroke-width="1.6" stroke-linecap="round"/></g></symbol>
<symbol id="i-fazek" viewBox="0 0 64 64"><g filter="url(#ig-shadow)"><path d="M26 6C24 10 28 12 27 16M34 4C32 9 37 11 35 16" fill="none" stroke="#b8c7d2" stroke-width="2.2" stroke-linecap="round" opacity=".75"/><path d="M9 24H55L51 51A6 6 0 0 1 45 56H19A6 6 0 0 1 13 51Z" fill="url(#ig-titanium)" stroke="#c3bdd6" stroke-width=".8"/><path d="M13 31Q32 38 51 31L48.5 49A5 5 0 0 1 44 53H20A5 5 0 0 1 15.5 49Z" fill="url(#ig-gold)" opacity=".55"/><rect x="6" y="19" width="52" height="7" rx="3.5" fill="#d7dde6" stroke="#aab3c2" stroke-width=".7"/><circle cx="32" cy="16" r="3.4" fill="url(#ig-rose)"/><path d="M18 30Q22 44 26 49" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="2.2" stroke-linecap="round"/></g></symbol>
```

The four symbols belong in a new commented section at the end of the symbol list, matching the file's existing `<!-- ============ NAME ============ -->` section style:

```svg
<!-- ============ FUEL TABS (mezo-o6uv) ============ -->
```

- [ ] **Step 4: Copy the sprite verbatim into the app**

Run: `cp docs/design_2.0/assets/clay-icons.svg frontend/src/shared/ui/clay/clay-icons.svg`
Then verify they match: `diff docs/design_2.0/assets/clay-icons.svg frontend/src/shared/ui/clay/clay-icons.svg` → no output.

- [ ] **Step 5: Extend the name union**

In `frontend/src/shared/ui/clay/index.tsx`, append to the `ClayIconName` union (after the `'i-muhely'` line):

```ts
  // Fuel Titanium (mezo-o6uv): a Fuel fülsor négy saját szimbóluma.
  | 'i-tanyer' | 'i-kiegeszito' | 'i-trend' | 'i-fazek'
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS — including the updated 58-symbol count.

- [ ] **Step 7: Commit**

```bash
git add docs/design_2.0/assets/clay-icons.svg frontend/src/shared/ui/clay/
git commit -m "feat(fuel): four Fuel tab clay icons — plate, supplement jar, trend, pot (mezo-o6uv)"
```

---

### Task 2: The Fuel row of the navigation matrix

**Files:**
- Modify: `frontend/src/app/navModel.ts:56-64` (the `fuel` entry of `DOMAINS`)
- Modify: `docs/superpowers/specs/2026-09-11-titanium-nav-design.md:40` (the frozen matrix table's Fuel row + a dated amendment note)
- Test: `frontend/src/app/TabBar.test.tsx`, `frontend/src/app/navigation.test.tsx`

**Interfaces:**
- Consumes: `ClayIconName` values from Task 1.
- Produces: `DOMAINS.find(d => d.id === 'fuel')!.tabs` = `[{Mai,/fuel,i-tanyer},{Kiegészítők,/fuel/stack,i-kiegeszito},{Trendek,/fuel/trendek,i-trend},{Konyha,/fuel/konyha,i-fazek}]` — consumed by `TabBar` and `DomainSwitcher` unchanged.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/app/TabBar.test.tsx` (the file already has `renderAt(path, ui)` at `:12` and imports `screen`/`within`; reuse them — do not write a second harness):

```tsx
// Fuel Titanium (mezo-o6uv): az owner által jóváhagyott sorrend és a négy új ikon.
// A sáv a navModel mátrixból épül, a fülek Link-ek a tab.route-ra (TabBar.tsx:50-64).
test('a Fuel fülsor a jóváhagyott sorrendet és ikonokat viseli', () => {
  renderAt('/fuel', <TabBar />)
  const bar = screen.getByRole('navigation', { name: 'Fuel menü' })
  const tabs = within(bar).getAllByRole('link')
  expect(tabs.map(a => a.textContent?.trim())).toEqual(['Mai', 'Kiegészítők', 'Trendek', 'Konyha'])
  expect(tabs.map(a => a.getAttribute('href'))).toEqual([
    '/fuel', '/fuel/stack', '/fuel/trendek', '/fuel/konyha',
  ])
  expect(tabs.map(a => a.querySelector('use')?.getAttribute('href'))).toEqual([
    '#i-tanyer', '#i-kiegeszito', '#i-trend', '#i-fazek',
  ])
})

// A leghosszabb-prefix aktív-fül szabály (navModel.activeTabRoute) a mély Fuel-oldalakon is tart.
test('a Kiegészítők fül aktív a stack mélyebb oldalain is', () => {
  renderAt('/fuel/stack/manage', <TabBar />)
  const bar = screen.getByRole('navigation', { name: 'Fuel menü' })
  expect(within(bar).getByRole('link', { name: /Kiegészítők/ })).toHaveAttribute('aria-current', 'page')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — labels are `['Mai','Receptek','Kamra','Kiegészítők']`.

- [ ] **Step 3: Update the matrix**

In `frontend/src/app/navModel.ts`, replace the `fuel` domain's `tabs` array:

```ts
  {
    id: 'fuel',
    name: 'Fuel',
    tabs: [
      { label: 'Mai', route: '/fuel', icon: 'i-tanyer' },
      { label: 'Kiegészítők', route: '/fuel/stack', icon: 'i-kiegeszito' },
      { label: 'Trendek', route: '/fuel/trendek', icon: 'i-trend' },
      { label: 'Konyha', route: '/fuel/konyha', icon: 'i-fazek' },
    ],
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS. If `navigation.test.tsx` asserts the old Fuel destinations, update those expectations in the same commit — they are guard tests for this matrix.

- [ ] **Step 5: Amend the frozen nav spec**

In `docs/superpowers/specs/2026-09-11-titanium-nav-design.md`, replace the Fuel row of the matrix table with:

```markdown
| **Fuel** | Mai · `/fuel` · `i-tanyer` | Kiegészítők · `/fuel/stack` · `i-kiegeszito` | Trendek · `/fuel/trendek` · `i-trend` | Konyha · `/fuel/konyha` · `i-fazek` |
```

and add directly under the table:

```markdown
> **Amendment 2026-09-12 (mezo-o6uv):** the Fuel row above supersedes the original
> `Mai · Receptek · Kamra · Kiegészítők` set. Owner-approved with the Fuel Titanium prototype
> (`docs/superpowers/specs/2026-09-11-fuel-titanium-design.md` §Prototype approval): Receptek and
> Kamra merge into **Konyha**, the freed slot becomes **Trendek**, and the order puts the daily
> jobs first. Route paths of the surviving destinations are unchanged.
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/navModel.ts frontend/src/app/TabBar.test.tsx frontend/src/app/navigation.test.tsx docs/superpowers/specs/2026-09-11-titanium-nav-design.md
git commit -m "feat(fuel): approved Fuel destination set in the nav matrix (mezo-o6uv)"
```

---

### Task 3: The two new routes with honest placeholder pages

**Files:**
- Create: `frontend/src/features/fuel/pages/FuelTrendekPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelKonyhaPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx`
- Create: `frontend/src/features/fuel/pages/FuelKonyhaPage.test.tsx`
- Modify: `frontend/src/app/router.tsx` (Fuel route block — add two entries next to `{ path: 'fuel/plan' … }`)

**Interfaces:**
- Consumes: the routes declared in Task 2.
- Produces: `FuelTrendekPage` and `FuelKonyhaPage` React components rendered at `/fuel/trendek` and `/fuel/konyha`. S3 and S4 replace their bodies; their file paths and component names stay.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelTrendekPage } from '@/features/fuel/pages/FuelTrendekPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('a Trendek oldal a saját címével jelenik meg', () => {
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/trendek']}>
        <FuelTrendekPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(screen.getByRole('heading', { name: 'Trendek' })).toBeInTheDocument()
})
```

Create the same test for `FuelKonyhaPage` with the heading name `'Konyha'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — cannot resolve `@/features/fuel/pages/FuelTrendekPage`.

- [ ] **Step 3: Create the two pages**

`frontend/src/features/fuel/pages/FuelTrendekPage.tsx`:

```tsx
// ============================================================
// Mezo · Fuel Trendek (mezo-o6uv, S0 váz — a tartalom az S3 szelet, mezo-83g0)
// A jóváhagyott negyedik Fuel-cél: „Jól ment a hetem?". Ez a fájl most csak a
// route-ot és a címet tartja, hogy a fülsor élő legyen; a heti kép, a napi
// üvegdoboz és a mutató-csempék az S3-ban érkeznek.
// ============================================================
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'

export function FuelTrendekPage() {
  return (
    <MozaikPage tone="sage">
      <PageHead label="Trendek" />
      <PageBody>
        <h1>Trendek</h1>
        <p>A heti kép hamarosan itt lesz.</p>
      </PageBody>
    </MozaikPage>
  )
}
```

Mirror it for `FuelKonyhaPage` (`Konyha`, "A receptek és a kamra hamarosan itt lesznek.", comment pointing at S4/`mezo-hygp`).

Check `frontend/src/shared/ui/mozaik/index.tsx` for the real `MozaikPage`/`PageHead`/`PageBody` prop names before writing — copy the call shape used by an existing simple page such as `FuelNaploPage.tsx`, and match its heading markup so the `getByRole('heading')` query resolves.

- [ ] **Step 4: Register the routes**

In `frontend/src/app/router.tsx`, next to the other Fuel entries (imports at the top follow the file's existing style):

```tsx
      // Fuel Titanium S0 (mezo-o6uv): a két új cél route-ja — a tartalom S3/S4.
      { path: 'fuel/trendek', element: <FuelTrendekPage /> },
      { path: 'fuel/konyha', element: <FuelKonyhaPage /> },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelTrendekPage.tsx frontend/src/features/fuel/pages/FuelKonyhaPage.tsx frontend/src/features/fuel/pages/FuelTrendekPage.test.tsx frontend/src/features/fuel/pages/FuelKonyhaPage.test.tsx frontend/src/app/router.tsx
git commit -m "feat(fuel): routes for the new Trendek and Konyha destinations (mezo-o6uv)"
```

---

### Task 4: Every Fuel route renders in the Titanium dark scope

**Files:**
- Modify: `frontend/src/app/AppLayout.tsx:60` (the `titanDark` derivation)
- Test: `frontend/src/app/AppLayout.titanDark.test.tsx`

**Interfaces:**
- Consumes: the routes from Task 3.
- Produces: `titanDark === true` for `/nap`, `/nap/gyors` and every path starting with `/fuel`; unchanged (`false`) everywhere else.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/app/AppLayout.titanDark.test.tsx`:

```tsx
// Fuel Titanium (mezo-o6uv): a Fuel domén EGÉSZE a grafit bőrt viseli — a hub, a
// mélyebb oldalak és a logoló is, különben a portálozott sheetek világosban nyílnának.
test.each(['/fuel', '/fuel/stack', '/fuel/trendek', '/fuel/konyha', '/fuel/log/uj'])(
  '%s a titan-dark hatókörben renderel',
  path => {
    const { container } = renderAt(path)
    expect(container.querySelector('.phone-screen')?.className).toContain('titan-dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  },
)

test('a Fuel-on kívüli útvonal nem kap titan-dark hatókört', () => {
  const { container } = renderAt('/me')
  expect(container.querySelector('.phone-screen')?.className).not.toContain('titan-dark')
})
```

Reuse the file's existing `renderAt(path)` helper verbatim — do not write a second one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`
Expected: FAIL — `/fuel` renders without the `titan-dark` scope.

- [ ] **Step 3: Replace the hardcoded list with a predicate**

In `frontend/src/app/AppLayout.tsx`, replace the `titanDark` line:

```tsx
  // A Titán grafit bőr hatóköre: a Nap két útvonala (mezo-mhum) ÉS a teljes Fuel domén
  // (mezo-o6uv) — a fejléc, a TabBar és a portálozott sheetek a shellé, ezért a scope a
  // burkon ül, és a doménen belül sehol nem villanhat vissza világosra.
  const titanDark = ['/nap', '/nap/gyors'].includes(location.pathname)
    || location.pathname === '/fuel' || location.pathname.startsWith('/fuel/')
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 5: Run both modes and the build**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: both suites green, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/AppLayout.tsx frontend/src/app/AppLayout.titanDark.test.tsx
git commit -m "feat(fuel): Titanium dark scope for the whole Fuel domain (mezo-o6uv)"
```

---

### Task 5: Slice close — docs, CODEMAP, tracker

**Files:**
- Modify: `docs/features/fuel.md` (§2 route table: add the two new routes with a one-line note that their content lands in S3/S4)
- Modify: `docs/CODEMAP.md` (regenerated, not hand-edited)
- Modify: `.beads/issues.jsonl` (refreshed backup)

- [ ] **Step 1: Update the living feature doc**

Add the two routes to the `fuel.md` §2 route table with their page components and a note: `Trendek/Konyha — S0-ban route + váz (mezo-o6uv); tartalom S3 (mezo-83g0) / S4 (mezo-hygp).`

- [ ] **Step 2: Regenerate the codemap and verify**

Run: `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`
Expected: the check prints `✅ docs/CODEMAP.md is up to date.`

- [ ] **Step 3: Refresh the off-machine tracker backup**

Run: `node scripts/check-beads-backup.mjs --fix`

- [ ] **Step 4: Commit**

```bash
git add docs/features/fuel.md docs/CODEMAP.md .beads/issues.jsonl
git commit -m "docs(fuel): record the S0 shell foundations (mezo-o6uv)"
```

---

## Self-review notes

- **Spec coverage:** this slice implements owner decisions 9 (tab order) and 10 (new icons) from the spec's approval section, plus the manifest's A18/A19/A20 prerequisite that every Fuel route can render in the Titanium scope. Manifest rows for page content (A1–A17, B*, C*, D*) belong to S1–S4 and are deliberately untouched here.
- **Placeholders:** the two new pages are honest scaffolds with their own tests and a comment naming the slice that fills them — not TODOs in the plan.
- **Type consistency:** icon names (`i-tanyer`, `i-kiegeszito`, `i-trend`, `i-fazek`) are identical in Task 1 (union + sprite), Task 2 (matrix) and Task 2's test; component names (`FuelTrendekPage`, `FuelKonyhaPage`) are identical in Task 3's files, tests and router entries.
