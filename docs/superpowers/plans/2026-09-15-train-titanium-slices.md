# Train Titanium Production Rebuild — Slice Map (master plan)

> **For agentic workers:** this is the SLICE INDEX for the approved Train Titanium rebuild.
> Each slice gets its own dated plan file (`2026-09-15-train-titanium-t<N>-….md`, authored
> just-in-time before execution) following the `2026-09-10-nap-mai-titanium.md` precedent, and
> its own bd issue + `feat/<topic>` branch + self-PR + CI + premerge + `--no-ff` merge.
> REQUIRED SUB-SKILL per slice: superpowers:subagent-driven-development.

**Goal:** carry the owner-approved Train prototype
(`docs/design_2.0/prototypes/companion-titanium/`, approval 2026-09-15, coverage manifest
`docs/design_2.0/2026-09-12-train-coverage.md`) into production, and land the four openGym-audit
correctness/engine workstreams it depends on (audit handoff of 2026-09-15).

**Architecture:** mostly a frontend rebuild over the existing 58-op train contract (recon
2026-09-15 confirmed). Backend additions are exactly: the e1RM per-session series (T13), sport
kcal estimate fields + MET math (T8), the A1 `weightDown` counter, and the B stall lever. The
prototype's seven pure state modules translate 1:1 into `frontend/src/features/train/logic/*`
modules with table tests; pages stay presentational and consume `@/data/hooks` re-exports only.

**Tech stack:** React + TanStack Query dual-mode hooks, Mozaik/clay UI kit + Titanium additions,
Spring Boot 4 backend with pure-decider services, OpenAPI contract-first.

## Global Constraints (inherited by every slice plan)

- Design: Mozaik 2.0/Titanium — posters, clay 3D SVG (never emoji), full-bleed heroes,
  reveal-on-scroll (IntersectionObserver, reduced-motion renders final state), reorder by
  arrows never drag, details in the 3D glass never a drawer, no page heading on Train
  (posters name the place; subpage back pill docks inside the hero).
- Copy: Hungarian; one plain sentence per page; jargon ban (plafon/optimum/rámpa/tier/blokk →
  felső érték/szett/pihenőhét/terv); estimates always labelled ("Becslés, nem mérés");
  percent drawn as a graphic, never text-only; missing data = em dash, never 0; down-trend
  never red.
- Licensing: body geometry ONLY from MIT MuscleMap (melihcolpan/MuscleMap); openGym (AGPL)
  is behaviour-reference only, never copied; root `NOTICE.md` ships with T3 and is a release
  blocker for T12.
- Contract changes: fragment + merged `api/openapi.yml` + regenerated
  `frontend/src/data/_client/api.gen.ts` in ONE commit.
- FE gates: `CI=true VITE_USE_MOCK=true pnpm test` AND `…=false pnpm test` (unset = mock!),
  `pnpm build`; layout guard `frontend/tests/layout/layout.spec.ts`. Mock parity: every new
  real path gets an MSW handler (inline fixtures — `handlers.ts:160` rule) and representative
  mock fixtures; no static fallback in real mode (`useDualQuery` idiom).
- BE gates: focused ITs with `-Dmezo.test.use-testcontainers=true` + `ArchitectureTest` when
  contracts/signatures move; pure rules as Spring-free deciders with plain unit tests; XP
  grants stay in-transaction behind `ProgressionGate`.
- Every slice: regenerate `docs/CODEMAP.md` in-change and after merge; refresh
  `docs/features/train.md` sections it touches; conventional commits carrying the bd id.

## Slice map

| # | Slice | Scope (manifest rows) | Depends on |
| --- | --- | --- | --- |
| T1 | A1 overload summary honesty | `weightDown` counter (contract + WorkoutService sign-split + FE chip). Spec: audit handoff §A1. | — |
| T2 | A2 One home for Epley | `OneRepMax` decider (REP_CAP=12), five call sites delegate, warmup leak fixed, docs corrected. Spec: handoff §A2. | — |
| T3 | Body geometry + BodyMap | Handoff D1+D2: `scripts/gen-body-geometry.mjs` → generated TS module (dynamic import), root NOTICE.md, tested 21-token→shape table, `BodyMap`/`MuscleChip` components (browser-measured zoom crops). Prototype refs: `body-geometry.js`, `muscle-taxonomy.js:TOKEN_SHAPES`, `muscles.js`. | — |
| T4 | Train shell & IA | Four tabs Mai · Terv · Terhelés · Gyakorlatok (router re-map of `router.tsx:220-257`), no page headings, back-in-hero pattern, hub retirement with redirects. | — |
| T5 | Mai day view | Day poster + start CTA + Egyedi/Sport chips + kcal contribution + impact-in-words rows. Prototype: `train-pages.js`. | T3, T4 |
| T6 | Active workout v3 | Card list, per-card ⋮ menu, records glass, fixed rest dock, 3-state finish, finish-moment warning, RIR 0–5 (handoff §A3 folded in), MÚLT column removed. Prototype: `session.js`, `session-state.js`. | T4 (T5 for entry) |
| T7 | Ceremony + recap | Two-step star ceremony, straight-to-Mai close, merged recap for finished sessions. Prototype: `session.js` ceremony fns, `sessionStars/sessionScore`. | T6 |
| T8 | Sport logging + kcal | Full-screen flow, 11 sports with per-sport fields, contract adds kcal estimate + override to sport-sessions (`train.yml:3472` request / response), BE owns MET math personalised by sex/age/body-fat (never AI), same ceremony. Prototype: `sport.js`, `sport-state.js`. | T7 |
| T9 | Terv core pages | Mesocycle landing + day page + week review + one-muscle page (gauge with merged labels, versus bars). Prototype: `plan-pages.js`, `plan-state.js`. | T3, T4 |
| T10 | Plan library | Most fut/Következik/Új terv landing + Sablonjaid + Lezárt futamaid lists and detail pages (template week spelled out; closed-run report + then-vs-now). Reads existing meso-templates + report endpoints. | T9 |
| T11 | Plan wizard v2 | Five steps over existing endpoints (`meso-plans/generate:317`, templates CRUD/start `:347-507`, day-exercises PUT `:235`, muscle-priorities `:97`); group-level focus; accent-blind picker; replaces `MesocyclePlannerPage` + `wizard/` generation. 2026-09-07 editor decisions apply. | T10 |
| T12 | Terhelés + map wiring | Handoff D3: week hero, two-view heat map (Tervezett/Eddig megvolt modes, `weekZone` 4-state scale, exclusions respected — warmup/skipped/plyo/off-day/counts_toward_volume), groups desc-by-done with glass details, sport card + Minden mozgásod (estimates never mixed with logged), untouched-muscles list, day-only muscles counted. | T3, T4 |
| T13 | Gyakorlatok + e1RM series | Handoff C: `e1rmSeries` on ExerciseRecordResponse (derived, capped 52, gap-not-zero) via `OneRepMax`; catalog+records library with search/region filter; per-exercise story page (records, next target, curve solid/dashed, medals, where-used). Replaces ExercisesPage/MedalsPage surfaces. | T2, T4 |
| T14 | B stall detection | Earned deload: miss predicate, consecutive-miss count over exercise identity, `deloadAfter` config (=3), Hungarian rationale, ProgressionBanner tone; planned deload wins; bodyweight holds-and-says-so. Spec: handoff §B. | T2 (and after T6 so the banner lands once) |

Parallel-safe start set: T1, T2, T3, T4. The UI chain is T5→T6→T7→T8 and T9→T10→T11;
T12/T13 join after T3/T2. T14 closes the series.

## Still-open items (tracked, never silently dropped)

Backend no-UI capabilities (exercise image upload · in-cycle focus change · learned timing
profile · sport-slot skips · unshown collected data) and the female body view stay on the
coverage manifest's open list; each becomes its own bd issue at triage, not part of these
slices.
