# Phase 2 Completion Roadmap — closing the core-data backend (Fuel-rest + D′ + E + T)

> **What this is.** The single durable map for **finishing Phase 2** — making every surface the app
> renders in real mode read (and write) real data, or honestly say it can't yet. Same contract as the
> companion roadmap (`2026-07-03-companion-roadmap.md`): this is a *roadmap of slices*, not an
> implementation plan — each slice gets its OWN dated `specs/`/`plans/` artifact (brainstorm → spec →
> plan → TDD) in the session that builds it. Track live state in **bd** (epic `mezo-t16y`, one child
> per new slice; the three Fuel slices keep their existing ids under epic `mezo-6r1`).
>
> **How to carry it forward in a fresh session (the handoff contract):**
> ```
> Olvasd el docs/superpowers/plans/2026-07-04-phase2-completion-roadmap.md §<SLICE>-t
> (+ az érintett docs/features/<domain>.md-t), aztán bd show <bd-id>, claim.
> L-es szeletnél: brainstorm → dátumozott specs/ + plans/ artifact ELŐBB, aztán kód.
> Végén: kapuk zölden (BE testek + FE mindkét mód + build), feature-doc frissítés,
> lint-docs, --no-ff merge, push, bd close.
> ```
> `bd ready` shows the next unblocked slice. The Fuel slices' full briefs live in
> [`2026-06-26-fuel-completion-roadmap.md`](2026-06-26-fuel-completion-roadmap.md) — this doc
> *orders* them but does not duplicate them.

**Driving principles (decided 2026-07-04):**

- **Honest real mode is the exit criterion.** Phase 2 is DONE when no screen shows fabricated
  numbers/copy in real mode: every surface is either backend-backed, deterministically composed from
  real reads (`buildDayPlan` precedent), or an explicit honest state („hamarosan" / degraded / hidden)
  — the `mezo-lfw` strip philosophy, applied to the remaining tabs.
- **Deterministic-first, AI stays in its epics.** Anything needing an LLM (briefing prose, memoir,
  weekly suggestion prose, predictions, replan, stack recommendations) is **out** — it belongs to the
  proactive-layer epic or Fuel P8, layered on the shipped companion stack (`mezo-fnnq`).
- **Hook-signature stability.** Every swap keeps the hook's returned shape; views don't move.
  Dual-mode via `useDualQuery`/`isMockMode()`; both FE test modes green.
- **Session-sized slices** — the proven Fuel-P size. If a slice needs two branches, split it.

## Where we are (2026-07-04 inventory)

Phase 2 slices A (biometrics+auth), B (Train) and C-core (Fuel: pantry/recipes/meals/water/protocol/
medication + P5 timeline) are ✅. Phase 3 (companion, `mezo-fnnq`) shipped and **superseded** most of
the old "Slice D": chat, knowledge facts, patterns are REAL dual-mode surfaces.

The complete residual mock/partial surface (hook-level audit, 2026-07-04):

| Hook | Domain | Status | Covered by |
|---|---|---|---|
| `useFuelWeek` | fuel | MOCK-ONLY | **Fuel P4** (`mezo-kpo`) |
| `usePantry().imports/suggestions` | fuel | absent | **Fuel P6** (`mezo-bka`) |
| `meal.score/breakdown` | fuel | null | **Fuel P7** (`mezo-yta`) |
| `useInsights` (weekly/memoir/predictions/experiments) | insights | MOCK-ONLY | **D′** (`mezo-t16y.1`) |
| `usePeople` + `useProfile` | me | MOCK-ONLY | **E** (`mezo-t16y.2`) |
| `useToday` / `resolveBriefing` / `useCheckins` read / `useTodayScenario` rest | today | MOCK/PARTIAL | **T** (`mezo-t16y.3`) |
| `useReplanScenarios`, `useStackRecommendations` | fuel | MOCK / GHOST | ⛔ stays — **Fuel P8** (`mezo-0h6w`) |
| `useKnowledge().edges` (graph) | insights | GHOST (`[]` real) | ⛔ stays — future companion slice |
| briefing/memoir/suggestion PROSE, predictions engine | insights/today | mock copy | ⛔ stays — **proactive epic** (next) |

## Slice D re-scope (decision 2026-07-04)

The original **Slice D "Insights seed-only"** (design spec 2026-06-10 §5: `pattern` / `knowledge_fact`
/ `ai_conversation` tables with seed rows, no AI) is **DROPPED — superseded, not skipped**: Phase 3
built the real tables *and* the real engines (patterns V3.1–3.3, facts V1.1–1.3, chat V0.2–0.5), so
seeding was never needed. What legitimately remains of "Insights in Phase 2" is only the
**deterministic Weekly review** plus an **honest-surface pass** over the three tabs whose features
live in later epics (Memoir, Predictions, Experiments — old-docs Phase 4–6 material, already declared
out of the companion epic in `specs/2026-07-03-phase3-companion-chat-design.md` §1). That is Slice D′.

---

## Slice brief format

**Goal · Builds · Out/deferred · Backend · FE · Depends on · Size · Open decisions · bd.**
Every slice implicitly includes: contract-first where a boundary DTO changes, Liquibase
`{ts}_{bd-id}_{desc}.sql` for new tables (+ populator + `ResetDatabase` TRUNCATE), dual-mode FE,
both-mode gates + build, feature-doc update (`docs/features/<domain>.md`), `node scripts/lint-docs.mjs`,
milestone row.

---

## Fuel track (epic `mezo-6r1` — briefs in the Fuel roadmap, NOT here)

### F-P4 — Weekly Plan / Rhythm (Terv) → [fuel roadmap §P4](2026-06-26-fuel-completion-roadmap.md)
**Goal:** the Terv weekly view goes real — `GymScheduleSheet` writes through to Train
(`PUT /api/train/gym-schedule`, per ADR 0004), `WeekRhythmGrid` renders the real Train week,
`weeklyStats` (kcal avg / protein-hit days) derive from the real per-day meal rollups; `useFuelWeek`
splits into a composing `fuelWeekHooks.ts`. **Depends on:** nothing open (P0a ✅, P3 ✅).
**Size:** L. **bd:** `mezo-kpo`. **Note for D′:** the weekly aggregate built here is the natural data
source for the Insights Weekly review — coordinate shapes (see D′ open decisions).

### F-P6 — Kamra Import (OpenFoodFacts) + heuristic Suggestions → [fuel roadmap §P6](2026-06-26-fuel-completion-roadmap.md)
**Goal:** pantry items by OFF lookup instead of typed macros + cheaper-alt/low-NOVA suggestion
heuristics; resolves `mezo-w3o`. **Depends on:** nothing. **Size:** L+M. **bd:** `mezo-bka`.

### F-P7 — Meal-Scoring deterministic v0 → [fuel roadmap §P7](2026-06-26-fuel-completion-roadmap.md)
**Goal:** the 4 numeric score dimensions (Macro/Micro/NOVA/Context, weights .30/.25/.25/.20 per ADR
0006) populate `meal.score` + `meal.breakdown`; zero new UI. Folds in `mezo-2dy`/`mezo-24j`.
**Depends on:** P0c ✅; verify micronutrient round-trip in-slice. **Size:** XL. **bd:** `mezo-yta`.

---

## D′ — Insights Weekly real + honest surface (`mezo-t16y.1`)

**Goal:** the Insights tab stops lying in real mode — Weekly becomes a real deterministic weekly
review over the user's own data; Memoir/Predictions/Experiments render an honest not-yet state
instead of hand-authored fiction.

**Builds:**
- **Weekly review, deterministic v0.** A real 7-day rollup replacing the static `weekly` seed:
  kcal avg + protein-hit days (FuelDay rollups — coordinate with F-P4's `weeklyStats`), sleep avg +
  quality (sleep_log), training sessions/volume done-vs-planned (Train), weight delta (weight_log EWMA
  already exists). `WeeklyItem { label, value, trend }` rows derive per metric with real trend arrows
  (this-week vs last-week).
- **Honest score.** The big `score /100` is either a *documented deterministic formula* over the
  metric rows (transparent, config-weighted — `configuration_conventions.md`) or renders the patterns
  precedent „tanulom" null-state. In-slice decision; NEVER a fabricated number (old-docs
  ProvenanceEnvelope rule).
- **`weeklySuggestion` prose** → honest placeholder in real mode ([]/null → the card hides or shows
  „a társ heti javaslata hamarosan"); the prose itself is proactive-epic work.
- **Honest-surface pass (mezo-lfw philosophy):** Memoir, Predictions, Experiments tabs in REAL mode
  render an explicit honest state (trimmed placeholder or hidden sub-tab — in-slice decision with
  sign-off); mock mode keeps the full demo. `useInsights` splits: `weekly` goes dual-mode
  (`weeklyHooks.ts`), the rest stays clearly-labelled mock.

**Out/deferred:** memoir generation, predictions engine, N=1 experiments domain (proactive/later
epics); knowledge `edges` graph (future companion slice); any LLM prose.
**Backend:** either a small read-model endpoint (`GET /api/insights/weekly` — new
`api/feature/insights/insights.yml` fragment) or client-side composition over existing real reads
(the `buildDayPlan` precedent — zero new endpoint). In-slice decision; lean client-side unless F-P4
already shipped a server aggregate to reuse.
**FE:** `useInsights` split into `weeklyHooks.ts` (dual-mode) + residual static; `WeeklyPage` honest
states; sub-tab visibility decision in `tabs.ts`/`InsightsSubNav`.
**Depends on:** soft on **F-P4** (shared weekly aggregate — build D′ after it or decide the
composition question locally). **Size:** M/L.
**Open decisions:** score formula vs „tanulom"; hide vs placeholder for the 3 Phase-3+ tabs;
server read-model vs client composition; week boundary (ISO week vs rolling 7d).
**bd:** `mezo-t16y.1`.

---

## E — People (`mezo-t16y.2`)

**Goal:** the Emberek tab goes real — persons + mention logging persist (IDENT-5's PERMA-R seed
data), and the `useProfile` mock question is settled.

**Builds:**
- **`person` + `mention` tables** (UUID, `created_by`, soft-delete; mention: `person_id` FK,
  `note`, `affect`, `tied_to` kind/label — keep the mock's `Mention` shape; `MentionLogInput` is the
  pinned POST shape per `docs/features/me.md` §4).
- **Contract** `api/feature/people/people.yml`: `GET /api/people` (persons + recent mentions),
  `POST /api/people/{id}/mention` (+ person CRUD as needed — start read-mostly: persons seeded via
  demodata, mention logging is the real write path).
- **`feature/people/` package** per house layout; populators + `ResetDatabase` + ownership-isolation IT.
- **FE swap:** `usePeople` → dual-mode (`peopleHooks.ts` in `data/me/`), `logMention` becomes a real
  mutation (mock: cache mutate); `PersonLogSheet`/`PersonDetailSheet`/`MentionRow` unchanged
  (signature-stable).
- **`useProfile` decision:** `user: UserMeta` is a static const consumed by Today + FuelStackPage.
  Either wire it to the Slice-A `user_profiles` table (read-only v1: name/initials) or record
  „static is fine, single-user" — decide + document in `me.md`; the 2026-06-10 spec parked this
  exact item to Slice E.

**Out/deferred:** relational-credit / ritual / attention surfaces (removed in `mezo-lfw`; PERMA
analytics belong to the proactive/PERMA epic); person-mention pattern mining (pattern-engine family).
**Depends on:** nothing. **Size:** M/L. **Open decisions:** person CRUD surface v1 (seed-only vs
create sheet); `affect` enum as DB enum vs check constraint; whether mentions feed the companion
snapshot now (lean: no — proactive epic wires it).
**bd:** `mezo-t16y.2`.

---

## T — Today honest completion (`mezo-t16y.3`)

**Goal:** the landing screen (the PWA's default view!) shows only real data in real mode — today it
is the last mostly-fake tab (hardcoded "78.6kg" quick-stats, fictional workout teaser, static
volleyball card, mock check-in strip, copied InsightsTeaser).

**Builds (all deterministic composition over EXISTING real reads — near-zero new backend):**
- **`useToday` split** into a dual-mode composing hook (`todayHooks.ts` stays the surface):
  - `workout` teaser ← today's planned session from `useTrain()` (active meso + gym schedule);
  - `volleyballSessions` ← real sport schedule (Train);
  - `fuelToday` ← already real via `useFuelPreview` (P5);
  - `today.date/meso week` header ← real active-meso week (Train), real date.
- **`QuickStatsRow`** ← last-night sleep (`useSleep().lastNight`), latest weight (`useWeight()`);
  the HRV stat has **no data source** → drop the cell or honest em-dash (strip philosophy).
- **`useCheckins` read path:** the strip currently always renders the mock seed — read today's real
  check-in rows (the write path + data exist since Slice A; add the list read consumer, and the
  matching `GET` if the contract lacks it).
- **`InsightsTeaser`** ← top proposed pattern from the REAL `usePatterns()` (deep-link to
  `/insights`); honest hide when none/degraded.
- **Briefing:** `resolveBriefing` prose stays static — but real mode marks it honestly (demo copy
  label or trimmed card); the real generated briefing is the proactive epic's flagship surface.
  `useTodayScenario` keeps URL-override demo controls (documented dev affordance), `retaDay` already real.

**Out/deferred:** generated briefing, AnchorMode from real signals, `vulnerable`/`niggle` real
sources (proactive epic); QuickInputSheet re-mount (own decision later).
**Backend:** at most a check-in day-read endpoint if missing; everything else composes existing reads.
**FE:** wide but thin — every Today component gets its real feed + ghost guard; both modes green.
**Depends on:** F-P4 helps (real week rhythm) but not a gate; patterns real ✅ (V3.1). **Size:** L
(surface width, not depth).
**Open decisions:** briefing card real-mode treatment (label vs trim); check-in strip read-model
(single day vs 4-slot merge semantics); do `dayState` demo params survive in real mode (lean: yes,
documented).
**bd:** `mezo-t16y.3`.

---

## X — Phase-2 exit audit (`mezo-t16y.4`)

**Goal:** declare Phase 2 done with evidence, not vibes.
**Builds:** a sweep re-running the hook inventory (this doc §Where-we-are) asserting every row is
✅/⛔-as-designed; parity screenshots on the changed tabs; `docs/features/{insights,me,today,fuel}.md`
statuses flipped; `docs/milestones/roadmap.md` **Phase 2 → ✅ done**; leftover polish bd issues filed
or closed. **Depends on:** all above. **Size:** S. **bd:** `mezo-t16y.4`.

---

## Dependency graph (quick reference)

```
F-P4 (mezo-kpo) ──soft──► D′ (mezo-t16y.1) ─┐
F-P6 (mezo-bka) ────────────────────────────┤
F-P7 (mezo-yta) ────────────────────────────┼─► X (mezo-t16y.4)
E (mezo-t16y.2) ────────────────────────────┤
T (mezo-t16y.3)  [P4 helps, not a gate] ────┘
```

Parallel-friendly: E and T are independent of the Fuel track; suggested value order
**F-P4 → T → E → D′ → F-P7 → F-P6 → X** (Today first for daily-use impact, P7/P6 are the heavy tails).

## Relationship to other roadmaps

- **Fuel completion (`mezo-6r1`)** — P4/P6/P7 briefs + checklists live there; this doc only sequences
  them. P8 (`mezo-0h6w`) stays the AI layer on top (needs `mezo-fnnq` stack — shipped, so P8 specs
  can be filed any time after P7).
- **Companion epic (`mezo-fnnq`, ✅)** — supersedes old Slice D; D′/T consume its real
  patterns surface read-only.
- **Proactive-layer epic (next, unmapped)** — briefing/heartbeat/memoir/AnchorMode/crisis; owns every
  prose/LLM item this roadmap marks ⛔. Map it companion-style (spec + slice roadmap) when Phase 2
  closes — it reuses snapshot (V0.3), facts (v1), summaries (V2.2), patterns (v3).
- **Design spec of record for Phase 2:** `docs/superpowers/specs/2026-06-10-phase2-backend-design.md`
  (architecture + conventions unchanged); this roadmap re-scopes only its §5 slice map (D→D′, +T).

## Per-slice execution checklist (when you start a slice)

1. `bd update <id> --claim`; read this §slice + the affected `docs/features/<domain>.md`.
   L-sized slice → brainstorm (superpowers:brainstorming) → dated `specs/` design + `plans/` impl plan first.
2. Contract-first where the boundary changes: edit/create `api/feature/<name>/<name>.yml` BEFORE
   code; merge (`api/generate`); regen FE (`pnpm generate:api`) + BE types.
3. TDD per `docs/references/`: integration-first, populators, `ResetDatabase` TRUNCATE growth,
   AssertJ; ownership-isolation IT for every new owned table.
4. Dual-mode FE: `useDualQuery`/`isMockMode()`, signatures stable, mock seed byte-parity where the
   view is unchanged; `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` green.
5. Update the feature doc + `docs/milestones/roadmap.md` milestone row; `node scripts/lint-docs.mjs`.
6. One bd issue + one `feat/<topic>` branch; `--no-ff` merge (`git pull --rebase` BEFORE the merge,
   never after); `bd dolt push && git push`; close with notes.
