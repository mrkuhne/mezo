# Admin value dashboard — Slice 6: Költés Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/admin/cost` per the section template: KPI strip (calendar-month spend + Δ vs previous month same-day, month-end run-rate, per-tester price, unpriced calls) → top-5 cards → model-mix table with tokens → 30d daily trend with clickable anomaly dots → the existing call list as the URL-param-driven deepest layer → cost-matrix heat grid behind a toggle. Closes the Pulzus alert deep-link dead ends (`?day=`, `?feature=`).

**Architecture:** Small backend extension on the llm-usage contract (calls endpoint gains a `day` filter; model rollup gains token sums; summary gains `prevMonthToSameDayUsd`), then a frontend rebuild of `AdminCostPage` adopting URL-as-state. Ai* components are reused/restyled, not rewritten. Matrix grid consumes the long-existing `useAdminCostMatrix`.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §4. Epic **mezo-l096**.

## Global Constraints

Same as prior slices (owner gate, contract-drift + codemap gates, focused local tests only, both-mode FE tests, Hungarian + label discipline, honest nulls — cost is a priced-rows-only estimate with the "~becslés" footnote and `unpricedCount` honesty KPI, no emojis, `.ad-*` CSS, AdminTile isolation, URL-as-state). Branch `feat/admin-slice6-koltes` off main AFTER slice 5 merges.

## Rulings

- **"Olcsóbb modell jelölt" flag is CUT from v1** (forced heuristic across a feature↔model join that no endpoint carries); file a bd follow-up. The model-mix table ships without it.
- **Budget-cap surfacing is OUT of this slice** — the mezo-ozri track owns it (backend shipped 3 days ago with zero API; adding UI here would collide). bd note referencing mezo-ozri.
- **Calendar vs rolling windows labeled explicitly**: KPI strip says "szeptember (naptári hónap)"; the trend/matrix tiles say "elmúlt 30 nap". Never mix in one tile.
- **Anomaly dots** reproduce the cost_spike rule client-side (pure fn `spikeDays(series, factor=2, minUsd=0.5)` in adminViz, unit-tested against the backend rule's semantics — yesterday-relative applied to each day: day > factor × avg of prior 7 (missing=0) and ≥ minUsd). Dot click sets `?day=` which filters the call list.
- **Run-rate** = monthCostSoFar / dayOfMonth × daysInMonth, client-side, labelled "a mostani tempóval".
- **Per-tester price** = calendar-month cost / non-owner ACTIVE account count (users hook), labelled "aktív fiókonként".

---

### Task 0: Branch + bd bookkeeping
- [ ] `bd create --title="admin slice 6: Költés — section template, model mix, anomaly drill, matrix grid" --type=task --priority=1` → `<ID>`; claim; branch; file the two bd follow-ups (olcsóbb-modell flag; budget-cap UI → mezo-ozri track).

### Task 1: Backend + data-layer extensions

**Files:** `api/feature/llm-usage/llm-usage.yml` (+regen), `LlmUsageController/Service`, `LlmLogRepository` (+ row types), ITs (extend the existing llm-usage IT class), `frontend/src/data/me/llmUsageApi.ts`/`llmUsageHooks.ts` (+mocks/MSW).

**Interfaces:**
- Calls op gains optional `day` query param (ISO date, report-zone calendar day filter, composable with existing feature/status/userId params).
- Breakdown `models[]` items gain `promptTokens`, `totalTokens` (int64, summed).
- Summary response gains `prevMonthToSameDayUsd: number|null` (same-day-of-month boundary in report zone; null when no prior-month rows).
- FE: `useLlmCalls` accepts `day?: string`; breakdown/summary types regenerate; mocks extended honestly (prev-month value + per-model tokens with sum-invariants like the file's existing comments demand).

- [ ] TDD ITs: day filter returns only that report-zone day's calls (edge: 23:45 local seed); model token sums exact; prevMonthToSameDay boundary (seed prior-month rows before/after the cut) and null case. Focused runs only. Commits: `feat(api): llm-usage day filter, model tokens, prev-month comparison (<ID>)` + `feat(admin): cost data layer extensions (<ID>)`.

### Task 2: Rebuild AdminCostPage

**Files:** `AdminCostPage.tsx` rebuild (+test), `lib/adminViz.ts` `spikeDays` + `monthRunRate` pure fns (+tests), reuse/restyle `Ai*` components (keep `AdminCostDetailPage` and `AiCallRow` links), CSS.

**Layout (12-col):**
1. KPI strip (4 × sp3): "E havi költés" (calendar month + Δ chip vs prevMonthToSameDayUsd, honest "nincs előző havi adat" when null) · "Várható hó végén" (run-rate) · "Egy aktív fiókra jut" · "Ismeretlen költségű hívások" (unpricedCount + "árlista nélküli hívás" hint).
2. Top-5 cards (2 × sp6 TopListTile): "Mire megy a pénz" (breakdown features via featureLabel, moreTo scrolls/anchors the call list with ?feature=) · "Ki költi" (byUser incl. Háttér).
3. Model-mix table (sp12 tile): model · hívások · tokenek (prompt/total) · költség · share bar. Monospace model names acceptable (deepest technical layer).
4. Daily 30d trend (sp12): overview costSeries sparkline + coral anomaly dots (spikeDays); dot click → sets `?day=` (and scrolls to the list); tag above the chart names the latest spike day like the approved mockup.
5. Call list tile (sp12): the existing filter chips + rows, now URL-param-driven — read/write `?day=`, `?feature=`, `?status=`, `?user=` via useSearchParams (URL is the source of truth, chips reflect it); "becsült költség" footnote kept. Detail route unchanged.
6. "Teljes mátrix" toggle → cost-matrix heat grid (users × features, heatColor cells, featureLabel columns, Háttér row, unknownCalls marker in cell tooltip) from `useAdminCostMatrix('30d')`.

- [ ] TDD: pure fns first (spikeDays hand-computed incl. missing days; monthRunRate) → page tests (KPI values from mocks incl. null prev-month state; URL param round-trip: mount with ?feature=X → chip active + list filtered, dot click sets ?day=; matrix toggle renders grid with HU labels; calendar/rolling labels present) both modes. Commit `feat(admin): Költés section rebuild — KPI strip, model mix, anomaly drill, matrix (<ID>)`.

### Task 3: Gates + visual check + ship
- [ ] Full admin FE both modes + build + codemap; focused backend ITs re-run; controller browser check (page vs approved "Költés oldal" mockup frame); ship per house flow; `bd close <ID>`.

## Self-review notes
- Spec §4 coverage: template ✔ model mix (sans cheaper-model flag — ruled) ✔ anomaly drill ✔ matrix grid ✔ per-use cost lives on the Funkciók page (already shipped) — not duplicated here ("same fact once per screen" guardrail).
- Deep-link contract with slice 1 alerts closed: ?day= and ?feature= now live.
- Names bind: `spikeDays`, `monthRunRate`, `day` param, `prevMonthToSameDayUsd`.
