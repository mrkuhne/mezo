# Minták — lifecycle dashboard + pattern detail page — Design

> **Date:** 2026-08-14
> **Status:** Approved (brainstorming) → next: writing-plans
> **Mockup:** [`2026-08-14-patterns-dashboard-redesign-mockup.html`](2026-08-14-patterns-dashboard-redesign-mockup.html) (links the live `prototype.css` — open from a checkout)
> **Scope:** the Insights pattern surface only — Patterns tab rewrite, Motor tab retirement, a new
> per-pattern detail page, and the backend history/traceability it needs. The detection math
> (`PatternGate`, nightly job, freeze semantics) is explicitly **unchanged**.

## Problem

The current Patterns tab (`PatternsPage` + `PatternCard`) is a Phase-1 leftover next to the newer
Motor tab, and the user experience shows it:

1. **Raw stats as primary UI.** Cards lead with `r=…, n=… nap, p=…` evidence chips and a date
   range — meaningless to a non-statistician — while the Motor tab already solved this
   (question-form titles, composed human sentences, `megbízható/ígéretes/még bizonytalan`
   confidence chips; `logic/findings.ts`). The `↔` pair notation hides direction and lag.
2. **Two tabs, one entity.** A statistical pattern row is 1:1 a catalog pair (`pairKey`); Motor
   and Minták talk about the same ~18 pairs in two languages with no shared identity on screen.
3. **No noise floor.** The gate persists every computable correlation (`n ≥ min-n`, non-constant),
   so an `r=0.00, p=1.000` row asks for Confirm with the same weight as a real finding.
4. **Decision semantics invisible.** Confirm→knowledge-fact promotion→prompt injection→
   prediction/experiment/challenge grounding all exist in the backend but are never explained;
   Monitor/Reject consequences likewise.
5. **No history.** The `pattern` row is overwritten nightly (`last_detected_at` only); decisions
   keep no log. "How did this pattern's learning evolve" is unanswerable.
6. **Doesn't scale.** A flat card list with 18+ pairs (more later) gives no overview and no
   always-visible "what needs me now" signal.

## Approved decisions

| Decision | Choice |
|---|---|
| Structure | **Merge into one Minták dashboard** — Motor tab retired; every pair gets a detail page at `/insights/patterns/:pairKey`; motor diagnostics become a collapsed section of the detail page; metric coverage becomes a collapsed "Adat-egészség" section at the dashboard bottom |
| Dashboard backbone | **Lifecycle sections** (the pattern's journey), not domain grouping: 🔔 Döntésre vár → 👁 Megfigyelés alatt → ✓ Megerősítve (él a tudásban) → ⏳ Még gyűlik az adat → ○ Megnéztük — nincs összefüggés → ✕ Elvetve. Domain is a filter chip row + a rail color on cards |
| Noise floor | **Display-layer strength gate**: only `|r| ≥ 0.3 AND p ≤ 0.15` (the existing "ígéretes jel" boundary) asks for a decision. Weaker LIVE rows land in a collapsed "no relationship" section — shown as a *result*, with no decision buttons; they move up if they strengthen. The gate/persistence is untouched (history needs the weak rows too) |
| Detail page content | All four blocks: strength timeline chart, aligned-days scatter, decision+motor event journal, impact ("mit kezd ezzel az app") |
| Traceability depth | **Full**: additive `source_pattern_id` on prediction/experiment/challenge + generators fill it; pre-existing rows stay unlinked (honest) |
| History storage | **One append-only `pattern_event` table** (kind + typed jsonb payload); band-crossing journal lines are *derived* from snapshots at render time, not stored |
| Dashboard data | **FE-composed** from the two existing reads (`usePatterns` + `usePatternMonitor`) merged by `pairKey` — no new bootstrap endpoint |
| Detail data | **One new endpoint** `GET /api/companion/pattern/pair/{pairKey}` serving the whole detail page (works for pairs with no persisted row too) |

## UX design (see mockup)

### Screen 1 — Minták dashboard (replaces both old tabs)

- **Hero — "A motor állapota":** one human sentence ("**18 kérdést** figyelek a naplóidból.
  **3 megerősített** összefüggés dolgozik a társban, **2 vár a döntésedre**."), `utolsó futás ·
  ablak` meta, a 6-tile lifecycle count grid, domain filter chips (Mind / 🌙 Alvás / 💪 Edzés /
  🍽 Táplálkozás …). Tiles double as anchors to their sections.
- **🔔 Döntésre vár** — `status=proposed` rows above the strength gate (hypotheses: above the
  confidence gate); the only section rendered as full cards; drivable to zero. Card anatomy:
  domain chip + confidence chip (`megbízható jel` / `ígéretes jel`), **question-form title** from
  the catalog (`question`), directional pair line `metrikaA → *másnapi* metrikaB` (lag spelled
  out in words, `↔` retired), "📈 Amit eddig látunk" box = `findingSentence` + `confidenceMeta`
  sentence (n + p translated to Hungarian, never the raw decimals), decision buttons
  **Megerősítem / Figyeljük / Elvetem**, "Részletek és előzmények →" link. The **first** undecided
  card additionally carries the "Mi történik a döntéseddel" explainer (3 one-liners: confirm →
  durable knowledge feeding companion/predictions/experiments; monitor → keeps computing, no
  learning; reject → frozen, never resurfaced) — once per list, not per card.
- **Lifecycle sections** (collapsible `details`-style cards, mini-row lists inside):
  - **✓ Megerősítve — él a tudásban · N** (default open): title + `megerősítve {date} · azóta ×N
    megerősödött`; footer note that these live in the companion prompt and ground predictions.
  - **👁 Megfigyelés alatt · N**: title + trend line (`a jel erősödik ↗ (r 0.21 → 0.34)`) derived
    from snapshots.
  - **⏳ Még gyűlik az adat · N**: title + the Motor few_days/no_data nudge (`🎯 még N nap
    {metrika}-adat kell`); footer explains these are not errors and logging brings them alive.
  - **○ Megnéztük — nincs összefüggés · N**: weak-LIVE rows; footer frames absence-of-correlation
    as a result; no decisions.
  - **✕ Elvetve · N**: frozen rows + a "visszanyit" affordance (decision transitions are already
    repeatable server-side).
- **Adat-egészség** (collapsed, bottom): the current `MetricCoverageRing` list.
- Every row/card links to the detail page.

### Screen 2 — Pattern detail (`/insights/patterns/:pairKey`)

Order: header card (chips + question title + pair line + "Amit most látunk" + the same 3 decision
buttons, current state highlighted) → **"Hogyan erősödött a jel"** (r-over-time line chart off
snapshots; band guides at 0.3/0.6 labeled `érezhető`/`határozott`; the confirm-date point
accented) → **"A 32 nap, amiből ez kijött"** (scatter of aligned days, axis labels in plain
Hungarian, trend line, latest day highlighted + one-line callout; "Napok listája →" opens a plain
date/A/B table) → **"A minta története"** (journal: derived band-crossings + stored decision/
reinforce/promote events, newest last, fact link inline) → **"Mit kezd ezzel az app"** (impact
rows: Tudástár-tény ×N + prompt status · predictions with outcome counts · experiments · challenges,
each row → its surface) → **🔧 Motor-diagnosztika** (collapsed: window, lag, last run, freeze
note for judged rows, source chips, raw `r/n/p` in mono).

For a pair with **no persisted row** (még gyűlik / no_data / degenerate) the detail page renders
the header + gate diagnostics + nudge; the scatter still plots whatever aligned days exist (they
are honest data), while the strength chart (no snapshots), journal and impact sections show
honest empty states. For an **undecided** pattern the impact section speaks in future tense
("ha megerősíted: …").

### Copy rules

- Titles are the catalog `question` strings; direction reads `A → (lag szó) B`.
- Stats speak Hungarian: `strengthWord` (|r| bands), `confidenceMeta` (n + p → chip + sentence),
  `findingSentence` (per-pair hand-written direction readings + `Igen:/Meglepő:` prefix) — all
  reused from `frontend/src/features/insights/logic/findings.ts`.
- Raw `r/n/p` and the ISO date window appear **only** inside Motor-diagnosztika.

## Backend design

### 1 · `pattern_event` — append-only history

New table (Liquibase, `{ts}_mezo-<bd>_create_pattern_event.sql`, house conventions):

| column | notes |
|---|---|
| `id uuid` PK | `gen_random_uuid()` |
| `created_by uuid` | ownership, server-set |
| `pattern_id uuid` | FK → `pattern`, `ON DELETE CASCADE` |
| `kind varchar(16)` | CHECK: `snapshot \| confirmed \| monitoring \| rejected \| reinforced \| promoted` |
| `occurred_at timestamptz` | event time |
| `payload jsonb` | typed envelope (`@JdbcTypeCode(SqlTypes.JSON)`): snapshot → `{r, n, p}`; reinforced → `{reinforcementCount}`; promoted → `{factId}`; decision kinds → `{}` |
| `is_deleted` | soft-delete convention |

Index: `idx_pattern_event_pattern` on `(pattern_id, occurred_at)`.

Writers (all existing call sites, no new flows):
- **`PatternDetectionService`**: one `snapshot` per **LIVE evaluation** of a pair that has (or just
  got) a pattern row — **including confirmed rows**: the outcome is already computed on the
  reinforce path; the judged row's stats stay frozen, only history accrues. Rejected rows keep
  their silence (evaluated but nothing persisted — no snapshot either). `reinforced` alongside
  the fact bump.
- **`PatternService.decide`**: `confirmed`/`monitoring`/`rejected` on every transition;
  `promoted` when the first-confirm promotion fires.

Volume: ~18 pairs × nightly ≈ 6.6k rows/year — negligible. No backfill; history starts at rollout
(the journal's first entry is then "Életre kelt" only for newly-detected patterns — acceptable).

### 2 · Pair detail endpoint

Contract-first (`api/feature/companion/companion.yml` fragment → merge → generated `<Tag>Api`):

`GET /api/companion/pattern/pair/{pairKey}` → `PatternPairDetailResponse`:

- **pair meta** from `CompanionProperties.PatternPair` (question, mechanism, direction readings,
  category, lag, metric labels + `sourceHu` per side) — 404 on unknown key;
- **gate state**: live verdict/alignedDays/missingDays/bottleneck via the shared `PatternGate`
  math (same request-scoped series cache pattern as `PatternMonitorService`);
- **pattern** (nullable): the persisted row — status, r/n/p, confidence, critique, thinking,
  `promotedFactId`, `lastDetectedAt`;
- **events[]**: the `pattern_event` rows (ascending `occurred_at`);
- **days[]**: aligned `(date, a, b)` pairs from `MetricSeriesService` for the current window —
  computed live, never persisted (frozen rows honestly show the *current* window's days);
- **impact** (empty-able): promoted fact `{id, text, reinforcementCount, includeInPrompt}` +
  predictions/experiments/challenges referencing this pattern via `source_pattern_id`
  `{id, title, status/outcome}` each.

### 3 · `source_pattern_id` traceability

Three additive migrations: `source_pattern_id uuid NULL` (FK → `pattern`, `ON DELETE SET NULL`)
on `prediction`, `experiment`, `challenge`. The generators already resolve the model's
`patternIndex` to a `PatternEntity` (confidence copy proves it) — they now also store its id.
Old rows stay NULL and simply don't appear in impact lists.

### Unchanged on purpose

`PatternGate` thresholds and verdicts; nightly upsert/freeze/reinforce semantics; the
`PatternMonitorService` endpoint (still consumed — see FE); decision API
(`POST /api/companion/pattern/{id}/decision`, repeatable transitions); fact promotion heuristic.

## Frontend design

### Data layer (`frontend/src/data/insights/`)

- `usePatterns` + `usePatternMonitor` stay as-is (two cached reads).
- **New pure merge** `features/insights/logic/lifecycle.ts`: `(patterns[], monitor)` → the six
  lifecycle buckets, keyed by `pairKey`; carries the display strength gate
  (`STRONG_SIGNAL: |r| ≥ 0.3 && p ≤ 0.15`, defined next to `MIN_PATTERN_CONFIDENCE` in
  `data/insights/insights.ts`). Hypothesis rows (`kind=ai_hypothesis`, V3.2) bucket by their
  `confidence` against `MIN_PATTERN_CONFIDENCE` instead of r/p. Fully unit-tested.
- **New** `usePatternPairDetail(pairKey)` + `patternPairDetailApi` — dual-mode (`useDualQuery`);
  mock seeds extended in `insights.ts` (a confirmed pair with events/days/impact + a gathering
  pair, so both detail states render in mock).
- Barrel: new hooks re-exported via `data/hooks.ts` only.

### Pages / components (`frontend/src/features/insights/`)

- **`PatternsPage`** rewritten as the dashboard (hero + inbox + lifecycle sections +
  Adat-egészség). New components: `MotorStateHero`, `PatternDecisionCard`, `LifecycleSection`
  (+ mini-row). `VerdictFilterChips` retires in favor of domain filter chips (client-side filter).
- **New `PatternDetailPage`** at `/insights/patterns/:pairKey` (router: nested under insights,
  no sub-nav pill — it is a leaf detail, back-links to `/insights`). New components:
  `PatternStrengthChart` + `PatternScatter` (hand-drawn SVG, token colors, per the dataviz house
  approach), `PatternJournal`, `PatternImpactCard`.
- **Motor retirement:** `motor` entry removed from `tabs.ts`; `MotorPage`, `PairRow`,
  `MotorHero`, `DomainSection`, `VerdictFilterChips` deleted; `MetricCoverageRing` moves under
  the dashboard's Adat-egészség section; `findings.ts` + verdict sentence logic are reused by the
  new cards. Route `/insights/motor` → redirect to `/insights`; the `?pair=` anchor
  (mezo-18bx) → redirect to `/insights/patterns/:pairKey`. In-app links (`PatternsPage` empty/
  degraded states) re-point to the new places.
- Existing decision hook (`usePatternActions`) unchanged; detail page reuses it.

### Honest-surface rules (unchanged spirit)

Mock stays byte-faithful to its seeds; real mode renders only computed/persisted truth — the
degraded 404 card, "tanulom" on null confidence, honest empty states on the detail page. No
fabricated numbers anywhere (IDENT precedents).

## Slicing (one bd issue + branch each, every slice independently green)

| # | Slice | Content |
|---|---|---|
| S1 | BE history | `pattern_event` migration + entity/repo + the three writers + `ResetDatabase` + populator + ITs |
| S2 | BE traceability | `source_pattern_id` ×3 migrations + generator writes + ITs |
| S3 | BE detail endpoint | contract fragment + merge + `PatternPairDetailService` + controller + ITs (S1+S2 first) |
| S4 | FE dashboard | lifecycle merge logic + `PatternsPage` rewrite + Motor retirement + redirects + both-mode tests |
| S5 | FE detail page | route + hook + page + charts/journal/impact + both-mode tests |

Docs ride each slice per house rules (`insights.md` §2.1/§2.8 rewrite, `companion.md` V3.x notes,
`proactive.md` grounding note, `_platform-design-system.md` if a new shared primitive emerges);
`node scripts/lint-docs.mjs` after each.

## Testing

- **BE:** integration-first per `testing_standards.md` / `integration_test_framework.md` — event
  writes asserted through the real job/service paths; detail endpoint via `ApiIntegrationTest`
  (known pair, unknown pair 404, pair-without-row, frozen pair); generator ITs assert
  `source_pattern_id`.
- **FE:** vitest both modes — lifecycle bucketing unit tests (thresholds, hypothesis rows,
  missing monitor row), dashboard render states (degraded/empty/filtered), detail page states
  (confirmed/undecided/no-row), redirect tests.
- **CI** is the authoritative full-suite gate (self-PR per slice).

## Out of scope / deferred

- Backfilling history for existing patterns (starts at rollout).
- Scatter-point → day drill-in (the "Napok listája" table ships; per-day deep links later).
- Domain filter persistence, section-order personalization.
- Any change to detection math, catalog pairs, or the V3.2 hypothesis loop itself.
