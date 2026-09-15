# Train Titanium T4 — Shell & IA (four tabs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the Train domain speaks the owner-approved four tabs — **Mai · Terv · Terhelés ·
Gyakorlatok** — through the existing Titanium nav mechanism; the six-tile hub retires; the
whole domain joins the titan-dark scope.

**Architecture:** a navModel matrix-row edit with `owns` statements for every deep route
(the Fuel row is the exemplar), a `/train → /train/mai` index redirect that keeps the legacy
`?day=` forwarding, hub (`EdzesHubPage`) retirement, and the `titanDark` gate extended to
`/train` with containment tests. No page faces change in this slice — every existing page
stays reachable under its tab.

**Tech stack:** navModel/TabBar contract tests, router redirect tests, RTL.

**Driving artifacts:** coverage manifest (tab decision 2026-09-12), nav spec
`docs/superpowers/specs/2026-09-11-titanium-nav-design.md`, recon 2026-09-15 (navModel
anchors), bd `mezo-88iwa.5`, branch `feat/train-titanium-shell-ia`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus:
- The tab row lives in the global bottom TabBar (navModel matrix) — never an in-page tab
  strip (`FuelMaiPage.tsx:231-234` records why).
- `owns` is mandatory for every deep Train route or the wrong tab lights (the Fuel bug,
  `navModel.ts:20-28`).
- Every tab route stays under `/train/*` (`activeDomainId` is first-segment-based).
- titan-dark must not leak to un-sliced domains — `AppLayout.titanDark.test.tsx`'s
  containment rule ("EGYETLEN más útvonalra sem szabad átszivárognia").

Verified anchors: `navModel.ts:52-61` (the Train row), `:63-76` (Fuel exemplar),
`:120-121` (no-tab-on-hub comment), `router.tsx:221-227` (`TrainIndex` `?day=` forward),
`:261-287` (train routes), `FUEL_RETIRED_REDIRECTS` idiom `router.tsx:154-174` +
`router.fuelRetiredRedirects.test.tsx`, `AppLayout.tsx:39` (`hideChrome` `/train/session`),
`:64-65` (`titanDark`), `TabBar.test.tsx:69` (Fuel label contract),
`EdzesHubPage.tsx` (the hub to retire).

---

### Task 1: The navModel row + tab contract tests

**Files:**
- Modify: `frontend/src/app/navModel.ts:52-61`
- Test: `frontend/src/app/TabBar.test.tsx` (extend), `frontend/src/app/navModel.test.ts`
  (extend if it exists, else the TabBar test carries the assertions)

**Interfaces:**
- Produces the Train row consumed by TabBar/DomainSwitcher/routeForDomain:

```ts
  {
    id: 'train',
    name: 'Edzés',
    tabs: [
      // Owner-approved four tabs (2026-09-12): sport/running are not a tab — logging
      // lives on Mai, plans on Terv, history beside the volume on Terhelés.
      { label: 'Mai', route: '/train/mai', icon: 'i-edzes',
        owns: ['/train/session', '/train/review', '/train/sport', '/train/custom'] },
      { label: 'Terv', route: '/train/mesocycles', icon: 'i-retegek',
        owns: ['/train/templates', '/train/futas'] },
      { label: 'Terhelés', route: '/train/week', icon: 'i-meso',
        owns: ['/train/gym'] },
      { label: 'Gyakorlatok', route: '/train/exercises', icon: 'i-naplo',
        owns: ['/train/medals'] },
    ],
  },
```

- [ ] **Step 1: Write the failing tests** — beside the Fuel label contract, assert: the Train
bar renders exactly `Mai · Terv · Terhelés · Gyakorlatok`; `activeTabRoute` lights Mai on
`/train/session` and `/train/review/abc`, Terv on `/train/mesocycles/x/days/Hét` and
`/train/futas/123`, Terhelés on `/train/gym`, Gyakorlatok on `/train/medals`; and `/train`
itself lights Mai only AFTER Task 2's redirect (here: assert `activeTabRoute` on `/train`
returns null — the pre-redirect contract stays).
- [ ] **Step 2:** Run them — the label assertions FAIL (old row). **Step 3:** Edit the row as
above. **Step 4:** Tests PASS. **Step 5:** Commit
`feat(app): the Train tab row becomes Mai · Terv · Terhelés · Gyakorlatok (mezo-88iwa.5)`.

### Task 2: `/train` index redirect + hub retirement

**Files:**
- Modify: `frontend/src/app/router.tsx` (`TrainIndex` at :221-227; the `/train` route entry;
  remove the `EdzesHubPage` import)
- Delete: `frontend/src/features/train/pages/EdzesHubPage.tsx` + its test file(s)
  (`ls frontend/src/features/train/pages/EdzesHubPage*`)
- Test: `frontend/src/app/router.trainIndexRedirect.test.tsx` (create, modeled on
  `router.fuelRetiredRedirects.test.tsx`)

**Interfaces:** consumes Task 1's row (Mai lights on `/train/mai`).

- [ ] **Step 1: Failing redirect test** — rendering the router at `/train` lands on
`/train/mai`; at `/train?day=3` lands on `/train/mai?day=3` (the legacy Heti deep link);
`/train/week` still renders its own page (no over-redirect).
- [ ] **Step 2:** Rewrite `TrainIndex`:

```tsx
/** `/train` has no face of its own under the four-tab IA (owner 2026-09-12) — it forwards
 *  to Mai, keeping the legacy Heti `?day={0..6}` deep-link intact. */
function TrainIndex() {
  const [params] = useSearchParams()
  const day = params.get('day')
  return <Navigate to={`/train/mai${day !== null && day !== '' ? `?day=${day}` : ''}`} replace />
}
```

Delete `EdzesHubPage.tsx` (+ tests). Sweep `grep -rn 'EdzesHubPage' frontend/src` → only the
removed import/usage; `grep -rn "'/train'" frontend/src` — callers navigating to `/train`
(e.g. KalauzSheet, back fallbacks) stay valid through the redirect, list them in the report.
- [ ] **Step 3:** Tests PASS (redirect + the full FE suite's existing hub tests removed with
the hub). **Step 4:** Commit `feat(train): /train forwards to Mai — the six-tile hub retires (mezo-88iwa.5)`.

### Task 3: titan-dark over the Train domain

**Files:**
- Modify: `frontend/src/app/AppLayout.tsx:64-65`
- Test: `frontend/src/app/AppLayout.titanDark.test.tsx` (extend)

- [ ] **Step 1: Failing tests** — `/train/mai` and `/train/mesocycles` carry the titan-dark
scope; `/train/session` stays `hideChrome` AND in scope (the workout runs dark); `/mezo` and
`/me` still do NOT (containment).
- [ ] **Step 2:** Extend the gate: `titanDark = … || pathname.startsWith('/train')` in the
file's existing style (read the current expression and match it).
- [ ] **Step 3:** PASS. **Step 4:** Commit
`feat(app): the Train domain joins the titan-dark scope (mezo-88iwa.5)`.

### Task 4: Gates, docs, ship

- [ ] **Step 1:** `docs/features/train.md` — the navigation paragraph: the four tabs, the
owns map, the hub retirement (grep `EdzesHubPage` in docs and fix every mention);
`node scripts/gen-codemap.mjs` (the deleted hub changes the tree) + `--check`.
- [ ] **Step 2:** Full gates FOREGROUND: FE both modes, `pnpm build`, layout suite.
- [ ] **Step 3:** Commit docs; push `feat/train-titanium-shell-ia`; self-PR; CI; merge per
the detached-worktree recipe; close `mezo-88iwa.5`.

## Self-review notes

- Slice-map coverage: four tabs (T1), heading/back rules are ALREADY per-page concerns
  (option A ships with each rebuilt face, T5+) — this slice only guarantees the shell;
  hub retirement + redirects (T2); dark scope (T3).
- The `?day=` forward preserved verbatim from the old `TrainIndex`.
- Sport/running tab homes follow the coverage manifest (log→Mai, plans→Terv, history→
  Terhelés) — `/train/sport` under Mai, `/train/futas` under Terv; revisit at T8/T9 when
  those faces rebuild.
