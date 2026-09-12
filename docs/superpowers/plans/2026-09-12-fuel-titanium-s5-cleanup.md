# Fuel Titanium S5 — retirement, deep links, closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Fuel rebuild — retire the pages the new destinations replaced without breaking a single saved link, re-anchor the tutorial, verify every invisible background guarantee still holds, and record the manifest as delivered.

**Architecture:** No new UI. Three kinds of work: redirects for retired routes (so bookmarks, notifications and the tutorial keep resolving), deletion of code that genuinely has no consumer left, and a verification pass over the manifest's background section — the rows that are invisible and therefore the easiest to break silently.

**Tech Stack:** React Router redirects, Vitest, the repo's codemap and tracker scripts.

## Global Constraints

- Driving issue: `mezo-qt5q` (S5). Manifest rows: **A18/E11** (tutorial anchors), **E1–E12** (background guarantees — verify, do not modify), plus the retirements implied by A10 (`/fuel/log`), C1 (`/fuel/plan`), C5 (`/fuel/naplo`), D1 (`/fuel/stack/today`) and D3 (the four `manage/*` pages). Manifest: `docs/design_2.0/2026-09-11-fuel-coverage.md`.
- **Depends on S1a–S1d, S2, S3 and S4** all being merged on this branch. Do not start until the new destinations are live, because this slice deletes their predecessors.
- **A retired route must never 404.** Every path this slice removes gets a redirect to its new home, using the router's existing `LegacyPathRedirect` idiom (`frontend/src/app/router.tsx:299` shows it in use for `/insights/*`). Saved links, push notifications and the tutorial registry all point at these paths.
- **Delete only what provably has no consumer.** For each candidate, grep first; if any real consumer remains, keep the file and report why. A deletion that breaks an import is a worse outcome than a file left behind.
- **The background rows are verify-only.** E1–E12 describe guarantees that live mostly in the backend and in the data layer: goal recomputation on diet save, write-time macro freezing and 8-dimension scoring, workout-aware meal roles, the scheduled-training day-type rule, the companion read-only tools, the cross-domain query invalidation web, dual-mode hook parity, the AI draft outcome signal, meal provenance writing, and the feature-flag degradations. This slice must not change any of them — it confirms they still hold and reports the evidence.
- Both frontend modes must stay green, run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`. Filters after `--` are ignored — always run the whole suite. Cheap gate from the worktree root: `bash .github/scripts/cheap-gates.sh`.
- Conventional commits carrying `(mezo-qt5q)`, each ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Redirect the retired routes

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Test: `frontend/src/app/router.test.tsx` (or the file that covers routing — find it)

**Interfaces:**
- Consumes: the new destinations.
- Produces: every retired path redirects instead of 404-ing.

- [ ] **Step 1: Write the failing test**

```tsx
// mezo-qt5q: a leváltott útvonalak SOSEM tűnnek el nyomtalanul — a mentett linkek,
// az értesítések és a Kalauz mind ezekre mutatnak.
test.each([
  ['/fuel/log', '/fuel'],
  ['/fuel/plan', '/fuel/trendek'],
  ['/fuel/naplo', '/fuel/trendek'],
  ['/fuel/stack/today', '/fuel/stack'],
  ['/fuel/stack/manage', '/fuel/stack/protocol'],
  ['/fuel/stack/manage/protocol', '/fuel/stack/protocol'],
  ['/fuel/stack/manage/timing', '/fuel/stack/protocol'],
  ['/fuel/stack/manage/meals', '/fuel/stack/protocol'],
])('%s átirányít ide: %s', (from, to) => {
  renderAt(from)
  expect(screen.getByTestId('loc')).toHaveTextContent(to)
})

// A napi paraméter nem veszhet el az átirányításban.
test('a lapozott nap túléli az átirányítást', () => {
  renderAt('/fuel/log?d=2026-09-08')
  expect(screen.getByTestId('loc').textContent).toContain('d=2026-09-08')
})
```

Confirm each target against what S1–S4 actually built before writing the table; if a mapping in this list disagrees with the delivered surface, follow the delivered surface and report the correction.

- [ ] **Step 2: Run the tests to verify they fail, then implement**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL. Then replace each retired route's element with the redirect, following the file's existing helper and its static-before-dynamic ordering convention.

- [ ] **Step 3: Re-run and commit**

```bash
git add frontend/src/app/router.tsx frontend/src/app/router.test.tsx
git commit -m "feat(fuel): redirect every retired Fuel route to its new home (mezo-qt5q)"
```

---

### Task 2: Re-anchor the tutorial

**Files:**
- Modify: `frontend/src/features/tutorial/registry/fuel.ts`
- Modify: the pages whose anchors moved (add `data-kalauz-anchor` where a step needs one)
- Test: the tutorial registry's colocated test

**Interfaces:**
- Consumes: the new Fuel pages and their anchor attributes.
- Produces: every Fuel tutorial step resolves on a live page (manifest A18 / E11).

- [ ] **Step 1: Write the failing test**

```ts
// A18/E11 (mezo-qt5q): a Kalauz minden Fuel-lépése ÉLŐ oldalra és létező horgonyra mutat.
test('minden Fuel tutorial lépés élő útvonalra mutat', () => {
  for (const step of FUEL_STEPS) {
    expect(routeExists(step.route), `${step.id} halott útvonalra mutat: ${step.route}`).toBe(true)
  }
})

test('minden horgony megtalálható a saját oldalán', () => { ... })
```

Read the registry and its existing test first: reuse whatever route-resolution helper they already have rather than inventing `routeExists` if an equivalent exists.

- [ ] **Step 2: Run the tests to verify they fail, then implement**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test` → FAIL for the steps that moved. Repoint them, and add the missing `data-kalauz-anchor` attributes to the new pages.

- [ ] **Step 3: Re-run and commit**

```bash
git add frontend/src/features/tutorial/registry/fuel.ts frontend/src/features/fuel
git commit -m "feat(fuel): re-anchor the Kalauz to the rebuilt Fuel pages (mezo-qt5q)"
```

---

### Task 3: Delete what has no consumer left

**Files:**
- Delete: the retired page components and their tests, once proven unreferenced
- Modify: any barrel that re-exported them

**Interfaces:**
- Consumes: nothing. Produces: nothing. This is dead-code removal only.

- [ ] **Step 1: Prove each candidate is dead**

Candidates: `FuelLogPage`, `FuelPlanPage`, `FuelNaploPage`, `FuelStackTodayPage`, the four `FuelStackManage*Page`s, and `KeretHero` (S1a left it alive because `FuelLogPage` still rendered it). For each:

```bash
grep -rn "<Name" frontend/src --include=*.tsx | grep -v "pages/Name.tsx" | grep -v "\.test\."
```

A candidate is dead only when the sole remaining references are its own definition and its own test. Anything else — keep it, and report the consumer.

- [ ] **Step 2: Delete, then run the full suite**

Run from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: green, with no unresolved import. If a deletion breaks a test that was covering behaviour the new surface still owns, port that coverage to the new page's test rather than deleting the assertion.

- [ ] **Step 3: Commit**

```bash
git add -A frontend/src
git commit -m "chore(fuel): remove the superseded Fuel pages (mezo-qt5q)"
```

---

### Task 4: Verify the background guarantees

**Files:**
- Test only — no production change expected. If you find a genuine regression, fix it and say so loudly in your report.

- [ ] **Step 1: Walk manifest section E and record the evidence**

For each row, state how you verified it and what you found:

- **E1** diet-settings save recomputes the active goal — the backend IT exists; confirm the frontend save path still reaches that endpoint unchanged.
- **E2** write-time macro freezing + 8-dimension scoring (FORMULA_VERSION 5) — confirm the frontend never recomputes a score locally and never writes a macro the backend did not return.
- **E3/E4** workout-aware meal roles and the scheduled-training day-type rule — confirm the Mai rebuild still reads them from `useFuelTimeline` rather than re-deriving.
- **E5** companion read-only tools — confirm no read shape they depend on was renamed.
- **E7** the cross-domain invalidation web (`fuelHooks.ts:64-71`: meal → habitDay / dailyQuests, diet → goals, medication → today) — confirm every new mutation path goes through the same `invalidate()`.
- **E9** AI draft outcome signal, **E10** meal provenance writing — confirm both still fire from the rebuilt logger.
- **E12** feature-flag degradations (coach off ⇒ 200 + empty, LLM off ⇒ 503 handled) — confirm the new score and workshop surfaces degrade the same way.

Where a row already has a test, name it. Where it does not and the rebuild plausibly could have broken it, add one.

- [ ] **Step 2: Commit any tests you added**

```bash
git add frontend/src
git commit -m "test(fuel): pin the background guarantees the rebuild must not move (mezo-qt5q)"
```

---

### Task 5: Close the manifest

**Files:**
- Modify: `docs/design_2.0/2026-09-11-fuel-coverage.md`, `docs/features/fuel.md`, `docs/CODEMAP.md`, `.beads/issues.jsonl`

- [ ] **Step 1: Mark every row delivered**

Add a delivery record to the manifest's closure section: each row's decision and where it landed, with the DROPs and DEFERs restated so a future reader cannot mistake them for gaps. Name the two follow-up capabilities that were deliberately deferred: `mezo-vj61` (micronutrient storage end-to-end) and `mezo-nmzh` (supplement dose advisor backend).

- [ ] **Step 2: Final docs and gates**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
node scripts/check-beads-backup.mjs --fix
```
Then from `frontend/`: `CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Then from the worktree root: `bash .github/scripts/cheap-gates.sh`

- [ ] **Step 3: Commit**

```bash
git add -A docs .beads
git commit -m "docs(fuel): close the Fuel Titanium coverage manifest (mezo-qt5q)"
```

---

## Self-review notes

- **Nothing 404s:** Task 1 covers every retired path with a redirect and a test, including the query parameter that a bookmarked past day carries.
- **Deletion has a stop condition:** Task 3 requires proving zero consumers per candidate, and requires porting coverage rather than dropping it.
- **The invisible rows get a real pass:** section E is the part of the manifest most likely to be silently broken by a UI rebuild, so Task 4 makes verification an explicit deliverable with named evidence, not an assumption.
- **The manifest closes with its DROPs and DEFERs restated**, which is what stops a future session from "fixing" an owner decision.
