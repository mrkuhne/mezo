# Admin value dashboard — Slice 4: Funkciók UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Funkciók section: `/admin/features` scorecard page (rows as graphics + value/cost quadrant + screen-usage tile) and `/admin/features/:key` detail page (trend, funnel, feedback reasons, reliability, cost) — replacing the old Feature-használat page (`/admin/usage` redirects).

**Architecture:** Frontend-only, consuming the slice-3 hooks (`useAdminFeatureBoard/Detail/FeedbackSummary`) and the existing screen-usage hook. Two new pages in the admin lazy chunk; scorecard rows are a dense-but-graphic list (share bars, mini sparklines via the existing `Sparkline`, tag chips), the quadrant is hand-rolled SVG in the design-2.0 language. Labels exclusively via `featureLabel`; `missing` keys carry the "nincs címke" marker. Rail: `Feature-használat` → `Funkciók` pointing at `/admin/features`.

**Tech Stack:** React 19 + TS, hand-rolled SVG, vitest both modes, MSW.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §3. Epic **mezo-l096**.

## Global Constraints

- Hungarian copy; every key via `featureLabel` (render ` (nincs címke)` marker when `missing`); NO emojis; `.ad-*` CSS namespace additions in `frontend/src/styles/prototype.css`.
- Section template: KPI/summary layer first, detail behind clicks; the scorecard IS the section's main surface (a deliberate table-like tile) but leads with a 3-cell summary strip.
- Per-tile `AdminTile` isolation; entrance inside `ArrivalProvider`; admin chunk discipline.
- Both-mode tests; NEVER full local suite (mezo-c4ib); no backend commands.
- Data honesty: `helped: null` renders "nincs visszajelzés-forrás" (muted), NEVER 0%; `acceptedShare: null` renders "még nem mérjük"; `kind: system` rows grouped at the bottom under a muted "Rendszer" divider and excluded from the quadrant; `errorPct/p90 null` → "–".
- Branch `feat/admin-slice4-features-ui` off main AFTER slice 3 merges. Commits carry the Task-0 id.

## Rulings

- **Quadrant axes:** x = value score `uniqueUsers × (1 + habitUserShare) × (helped != null ? (0.5 + up/(up+down)) : 1)` (pure fn, unit-tested, documented as heuristic v1); y = `costUsd` (log-ish scale allowed: sqrt). Quadrant captions: "ezért kérhetünk pénzt" (high/high), "ingyenes csali" (high value, low cost), "spórolni itt lehet" (low value, high cost), "figyelni" (low/low). Median splits define the quadrant boundaries (documented on-screen: "a felezővonalak a középértékek").
- **Screen-usage tile** moves onto the scorecard page as a supporting sp4 tile (labels via `screenLabel`), reusing `ScreenUsageTable`'s data hook but rendered as a top-8 `TopListTile` (bar-less variant) with "teljes lista" behind a lenyitó or link — implementer picks the cheaper faithful option.
- **/admin/usage** route redirects to `/admin/features` (`Navigate replace`); `AdminUsagePage` and its rail item are deleted (matrix's information now lives in the scorecard sparklines; the old page's `MatrixGrid` component stays only if другой consumer exists — check; if orphaned, delete it and its test).
- **Funnel rendering:** three stacked count rows with proportional bars + the tester avatars/names at beta scale (nested semantics: tried ⊇ repeated ⊇ habitual).

---

### Task 0: Branch + bd bookkeeping
- [ ] `bd create --title="admin slice 4: Funkciók UI — scorecard, quadrant, feature detail" --type=task --priority=1` → `<ID>`; claim; branch off pulled main.

### Task 1: Scorecard page (`/admin/features`)

**Files:** Create `frontend/src/features/admin/pages/AdminFeaturesPage.tsx` (+test), create `frontend/src/features/admin/components/FeatureScoreRow.tsx` (+test), modify `adminRoutes.tsx` (route + usage redirect), `AdminRail.tsx` (Funkciók), delete `AdminUsagePage.tsx` (+test) per ruling, CSS additions.

**Layout:** summary strip (3 cells: "aktívan használt funkciók" count [rows with uniqueUsers>0, non-system], "van visszajelzése" count, "összköltség · 30 nap") → period toggle (30d/90d chips) → scorecard list tile (sp12): one `FeatureScoreRow` per row — HU name (+hint tooltip, missing marker), kind chip (AI/napló/rendszer), uniqueUsers, 12-week mini sparkline, habit share as a small ring or bar, helped as "14 👍 · 3 👎"-style counts — NO, no emoji glyphs: use ▲/▼ text glyphs with sage/coral colors, or "14 jó · 3 rossz" text — implementer picks the cleaner text form; costUsd + costPerUse, reliability dot (sage <5% / gold <20% / coral ≥20% error, grey when null) with p90 in tooltip; row click → detail page. System rows under a muted divider. Sort control: érték (default, by value score), költség, használat.
- [ ] TDD: page test asserts summary strip, a Hungarian row name from the mock, missing-marker rendering for an unlabelled key (add a temporary unlabeled slug to the test via MSW override, not the seed), system-divider grouping, row link href, redirect test `/admin/usage → /admin/features`, rail label. RED → implement → GREEN both modes. Commit.

### Task 2: Value/cost quadrant

**Files:** Create `frontend/src/features/admin/components/ValueCostQuadrant.tsx` (+test), `valueScore` pure fn in `lib/adminViz.ts` (+test), CSS.

- [ ] Quadrant per ruling: SVG scatter, sqrt-scaled y, median split lines, quadrant captions in the corners (muted uppercase), points = clay-style dots in kind colors sized by uniqueUsers, hover → name + numbers (title attr ok), click → detail. Non-system rows only; rows with 0 uses excluded (documented under the chart: "csak a használt funkciók"). Unit tests: valueScore hand-computed cases (helped null neutral ×1, 100% helped ×1.5, 0% ×0.5); component test: point count, caption presence. Lives as an sp12 tile on AdminFeaturesPage above the scorecard (order: summary → quadrant → scorecard → screen tile). Commit.

### Task 3: Feature detail page (`/admin/features/:key`)

**Files:** Create `frontend/src/features/admin/pages/AdminFeatureDetailPage.tsx` (+test), route `features/:key`, CSS.

- [ ] Layout: head (HU name + kind chip + period toggle + "vissza" to list) → KPI strip (uniqueUsers · costUsd · helped ratio or "nincs visszajelzés-forrás" · p90 or "–") → usage trend sp6 (12-week Sparkline) + funnel sp6 (nested bars + names per ruling) → feedback sp6 (trend up/down two-line sparkline + downReasons list with HU reason labels: pontatlan / túl sok / rossz időzítés / nem rólam szól; companion-off → "ki van kapcsolva" tile) + reliability sp6 (errorPct, p50/p90, topErrors with muted code text) → cost sp12 (costByModel rows + topUsers TopListTile bar-less). 404 from the hook → "ismeretlen funkció" state with back link.
- [ ] TDD: mock-seed assertions (funnel numbers, reason labels HU, model rows), 404 override case, companion-off nulls render the honest states. Both modes. Commit.

### Task 4: Gates + visual check + ship
- [ ] Full admin FE tests both modes; build; codemap regen+commit; controller browser check of both pages vs the section-template anatomy (screenshot 1440px); ship via self-PR flow (watch CONFLICTING); `bd close <ID>`.

## Self-review notes
- Spec §3 UI coverage: scorecard ✔ quadrant ✔ detail ✔ screen tile ✔ usage-page dissolution ✔; acceptance column intentionally "még nem mérjük" until slice 8.
- Names bind: `AdminFeaturesPage`, `AdminFeatureDetailPage`, `FeatureScoreRow`, `ValueCostQuadrant`, `valueScore`.
- Reason-label mapping added where? → `labels.ts` gains `FEEDBACK_REASON_LABELS` (4 entries) — small, include in Task 3 with a labels.test.ts extension.
