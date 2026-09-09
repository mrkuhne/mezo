# Admin value dashboard — Slice 7: Memória Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the memory explorer intelligible and reachable: a new `/admin/memory` entry (user picker + installation-wide health), an Áttekintés view per user (health + recall quality), plain-Hungarian verdict sentences on the runs list ("Felidézések"), HU legends on Gráf/Térkép, the memory alert deep link flipped to its real home, and a Memória rail item.

**Architecture:** One small backend op (`GET /api/admin/memory/health` installation-wide, reusing the slice-1 `AdminAlertQuery` global counts + overview counts; companion-gated 404 like the per-user memory ops) + the alert-link flip. Everything else is frontend inside the existing `features/admin/memory/*` views: the verdict sentence is a pure function over the stored `scoreBreakdown` (the contribution math already exists in `memory/contribution.ts`), recall quality reuses the slice-5 per-user feedback endpoint.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §5 (+ the original explorer spec `2026-09-06-rag-memory-explorer-design.md` for view details). Epic **mezo-l096**.

## Global Constraints

Same as prior slices (owner gate, companion-gated honest 404/"ki van kapcsolva", both-mode FE tests, focused local tests, Hungarian + no raw identifiers by default with technical detail on expand, no emojis, `.ad-*` CSS, contract/codemap gates). Branch `feat/admin-slice7-memoria` off main AFTER slice 6 merges.

## Rulings

- **Install-wide health** comes from a NEW `getAdminMemoryHealth` op on the admin-memory contract (tag AdminMemory, path `/api/admin/memory/health`): `{vectorsReady, vectorsFailed, vectorsStale, itemsTotal, newestDailySummaryAt|null}` — sourced from `AdminAlertQuery` (failed/stale/newest exist) plus one ready/total count added there. Companion off → 404 (matches the per-user memory ops' idiom). NOT client-side aggregation (N calls) — the counts already exist server-side.
- **Verdict sentence** (pure fn `runVerdictSentence(breakdown, fusionWeights?): string` in `memory/contribution.ts`): name the dominant contribution source in product words — dense → "főleg tartalmi hasonlóság miatt", lexical → "főleg szó szerinti egyezés miatt", graph → "a tudásgráf kapcsolatai miatt", facts → "egy rögzített tény miatt"; if a boost (pinned/recency/salience…) exceeds the largest retriever contribution, lead with it ("mert kiemelt/friss/fontos emlék"). Unit-tested against hand-built breakdown fixtures. Rendered as the lead line of each run row and each candidate row's expand header; the existing bars/tables stay behind the expand.
- **View rename + order:** segment bar becomes `Áttekintés · Felidézések · Gráf · Térkép · Rétegek` (`?view=` values stay backward-compatible: keep `runs` as the URL value for Felidézések; add `overview`). Deep links from earlier slices unchanged.
- **Recall quality on Áttekintés** reuses `useAdminUserFeedback(id)` (slice 5) — no new endpoint.
- **Alert link flip:** `AdminAlertService`'s memory link constant `/admin/users` → `/admin/memory` (the slice-1 comment names this slice); update the IT + the FE mock seed link + AdminStatusBand test if it pins the old link.
- **Rail:** add `Memória` → `/admin/memory` between Költés and Meghívók (icon: pick a fitting existing clay icon).
- **Labels:** add the memory terms these views render to `labels.ts` (a `MEMORY_TERM_LABELS` record + helper, e.g. dense/lexical/graph/facts source names, node kinds PATTERN/PREFERENCE/GOAL/LIFE_EVENT/SEASON/INSIGHT/PERSON, edge kinds TRIGGERS/PRECEDED_BY/SUPPORTS/CONFLICTS/RELATES_TO, vector states) + tests. Gráf/Térkép legend tiles use these.
- **AdminMemoryPage's stray "Feature-ök" label** (if truly present in its own segment/tab copy) gets corrected to `Funkciók` — verify first; skip if it was a misread.

---

### Task 0: Branch + bd bookkeeping
- [ ] `bd create --title="admin slice 7: Memória — entry page, Áttekintés, verdict sentences, HU legends" --type=task --priority=1` → `<ID>`; claim; branch.

### Task 1: Backend — install-wide health op + alert-link flip

**Files:** `api/feature/admin-memory/admin-memory.yml` (+regen), `AdminMemory*` controller/service additions (follow the existing AdminMemory ops' ObjectProvider/404 idiom), `AdminAlertQuery` (+ready/total vector counts), `AdminAlertService` (link constant), ITs (`AdminMemoryHealthIT` install-wide + companion-off 404; AdminAlertsIT link assertion update), FE data layer (`adminMemory*` hook `useAdminMemoryGlobalHealth(isOwner)` + mock/MSW; ADMIN_ALERTS_MOCK memory_stuck link → `/admin/memory`; AdminStatusBand/Pulzus tests updated if they pin the old link).
- [ ] TDD focused ITs; two commits (`feat(api): installation-wide memory health + alert link to /admin/memory (<ID>)`, `feat(admin): memory health data layer (<ID>)`).

### Task 2: Entry page + rail + Áttekintés view

**Files:** new `pages/AdminMemoryEntryPage.tsx` (+test), route `/admin/memory`, `AdminRail.tsx`, new `memory/views/OverviewView.tsx` (+test), `AdminMemoryPage.tsx` segment bar (+`overview` view), CSS.
- [ ] Entry page: install-wide health KPI posters (kész/elakadt/elavult vektorok, emlékek összesen, utolsó éjszakai feldolgozás "X órája" with the >26h warn tone) + tester picker cards (reuse the users hook; card click → `/admin/users/:id/memory`). Companion off → "ki van kapcsolva" tile.
- [ ] Áttekintés view (default `?view=overview` when none given — keep existing deep links working: explicit `?view=` values respected): per-user health summary (existing per-user health hook), recall quality ("A felidézett emlékek X%-a volt hasznos" + elnémítva from useAdminUserFeedback), last problems (failed/stale counts linking to Rétegek).
- [ ] TDD both modes; commit `feat(admin): Memória entry + Áttekintés view (<ID>)`.

### Task 3: Felidézések verdict sentences + HU polish + legends

**Files:** `memory/contribution.ts` (+`runVerdictSentence` + tests), `memory/views/RunsView.tsx` + `RunDetail.tsx` (verdict lines, humanized column headers — "Policy"→"Felhasználás", "Lekérdezés mód"→"Keresés módja", etc.), `memory/views/GraphView.tsx` + `MapView.tsx` (+legend tiles from MEMORY_TERM_LABELS), `labels.ts` (+`MEMORY_TERM_LABELS` + helper + tests), segment label fix if the stray "Feature-ök" exists, CSS.
- [ ] TDD: verdict fn fixtures first (dominant dense / lexical / boost-led / tie cases); view tests assert the sentence renders on rows and the legends show HU node/edge names. Both modes. Commit `feat(admin): verdict sentences + HU legends on the memory explorer (<ID>)`.

### Task 4: Gates + visual check + ship
- [ ] Full admin FE both modes + build + codemap; focused backend ITs; controller browser check (entry page, Áttekintés, Felidézések sentence, Gráf legend); ship per house flow; `bd close <ID>`.

## Self-review notes
- Spec §5 coverage: entry ✔ overview-first ✔ verdict sentences ✔ legends ✔ recall quality ✔ alert-link flip ✔ rail ✔; memory-term labels close the slice-0 deferred "every memory term" promise (bd note updated).
- Names bind: `useAdminMemoryGlobalHealth`, `runVerdictSentence`, `MEMORY_TERM_LABELS`, `OverviewView`, `AdminMemoryEntryPage`, `?view=overview`.
