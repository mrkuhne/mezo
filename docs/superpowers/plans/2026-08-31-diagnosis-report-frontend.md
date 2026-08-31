# Diagnózis riport — frontend implementation plan (mezo-hqfi.4)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Make the shipped diagnosis backend clickable — a Mezo-hub entry, a list of past
diagnoses, and a detail page where a suspect's probe becomes a tracked experiment.

**Architecture:** The `ExperimentsPage` idiom verbatim — `MozaikPage`/`PageHead`/`PageHero`/
`PageBody` + `EntranceGroup`/`useCountUp` + `ClayIcon`, data through a dual-mode hook pair over
the generated client. No new UI primitives, no chart library.

**Tech Stack:** React 19 + TanStack Query + react-router · `@/shared/ui/mozaik` + `clay` ·
generated `api.gen.ts` types · Vitest + MSW (both modes) · Playwright visual goldens.

**Spec:** `docs/superpowers/specs/2026-08-31-diagnosis-report-design.md` §1, §6.
**Backend it consumes:** merged as `8d617464f` (v2.78.0), live.

## Global Constraints

- **Dual-mode discipline.** `isMockMode()` decides; real mode NEVER renders the mock seed.
  The `const { data = seed } = useQuery(...)` leak is a build error (`data/dualMode.guard.test.ts`).
- **Honest states, no fabricated numbers.** Absent data renders `—` or the page's own
  „tanulom"/„nincs adat" vocabulary — never 0, never a placeholder sentence presented as content.
- **Hungarian UI, verbatim.** Code and comments English.
- **Existing primitives only** — `Tile`, `Mosaic`, `MozaikPage`, `PageHead`, `PageHero`,
  `PageBody`, `EntranceGroup`, `useCountUp`, `ClayIcon`. No new shared component.
- **Route slugs:** Hungarian (`/mezo/diagnozis`), per spec §1's resolved micro-decision.
- **Clay icon:** `i-eletjel` (existing — no sprite change).
- **Writes are live-only.** Generate and start-experiment are inert in mock (the `propose`
  precedent), because both cost money / create real rows.
- **Gate:** `pnpm test` (mock) AND `VITE_USE_MOCK=false pnpm test` (real) — a bare `pnpm test`
  runs mock twice and the real gate is vacuous. Then `pnpm build`.

## File Structure

| File | Responsibility |
|---|---|
| `data/types.ts` (modify) | `Diagnosis`, `DiagnosisSuspect`, `DiagnosisEvidence`, `DiagnosisConfidence` |
| `data/insights/diagnosisApi.ts` (create) | wire → FE mapping; list/get/generate/startExperiment |
| `data/insights/diagnosisHooks.ts` (create) | `useDiagnoses`, `useDiagnosis`, `useDiagnosisActions` |
| `data/insights/diagnosisMock.ts` (create) | one seeded diagnosis — the mock-mode demo |
| `data/hooks.ts` (modify) | re-export the three hooks |
| `features/insights/logic/diagnosisCopy.ts` (create) | pure label/format helpers (confidence, delta, window) |
| `features/insights/pages/DiagnosisListPage.tsx` (create) | past diagnoses + the generate CTA |
| `features/insights/pages/DiagnosisDetailPage.tsx` (create) | verdict → suspects → evidence → probe |
| `features/insights/pages/MezoHubPage.tsx` (modify) | one tile into the existing mosaic |
| `app/router.tsx` (modify) | two sibling routes |
| `test/msw/handlers.ts` (modify) | the four endpoints |

---

### Task 1: Types, API client and the mock seed

**Files:** `data/types.ts`, `data/insights/diagnosisApi.ts`, `data/insights/diagnosisMock.ts`

**Interfaces produced:** `diagnosisApi.list()`, `.get(id)`, `.generate()`, `.startExperiment(id, rank)`;
`mockDiagnoses: Diagnosis[]`.

- [ ] **Step 1:** Add the four types to `data/types.ts` next to `Experiment`.
- [ ] **Step 2:** Write `diagnosisApi.ts` — `paths[...]` wire types, nullable → `undefined`.
- [ ] **Step 3:** Write `diagnosisMock.ts` — ONE diagnosis with 3 evidence rows and 2 suspects,
      so the mock demo shows the real shape (ranked, evidence-bound, probe-carrying).
- [ ] **Step 4:** `pnpm exec tsc --noEmit` — expected: clean.
- [ ] **Step 5:** Commit.

### Task 2: The dual-mode hooks

**Files:** `data/insights/diagnosisHooks.ts` (+ `.test.tsx`), `data/hooks.ts`

**Interfaces produced:** `useDiagnoses(): {diagnoses, mode, isPending}`,
`useDiagnosis(id): {diagnosis, mode, isPending, notFound}`,
`useDiagnosisActions(): {generate, startExperiment, pending, error}` where `error` is
`'insufficient' | 'quota' | 'failed' | null`, mapped from `ApiError.status`/`code`.

- [ ] **Step 1:** Write the failing dual-mode hook test (mock returns the seed; real returns the
      MSW rows; real NEVER returns the seed; a 429 maps to `'quota'`).
- [ ] **Step 2:** Run `VITE_USE_MOCK=false pnpm test diagnosisHooks` — expected FAIL (no module).
- [ ] **Step 3:** Implement the hooks (the `experimentsHooks.ts` idiom).
- [ ] **Step 4:** Add the four MSW handlers.
- [ ] **Step 5:** Both modes green; commit.

### Task 3: The list page

**Files:** `features/insights/logic/diagnosisCopy.ts`, `pages/DiagnosisListPage.tsx` (+ test)

- [ ] **Step 1:** Write `diagnosisCopy.ts` — confidence label, relative-day formatting, the
      window sentence. Pure functions, unit-tested.
- [ ] **Step 2:** Write the failing page test: honest empty state; a seeded row renders its
      verdict; the generate CTA is inert in mock.
- [ ] **Step 3:** Implement, `ExpFrame` idiom (`MozaikPage tone` + `PageHead onBack` to `/mezo`).
- [ ] **Step 4:** Both modes green; commit.

### Task 4: The detail page

**Files:** `pages/DiagnosisDetailPage.tsx` (+ test)

- [ ] **Step 1:** Failing test: verdict + confidence render; each suspect shows its evidence rows
      resolved through `evidenceIndexes`; the probe button is live-only; `stale` shows the badge.
- [ ] **Step 2:** Implement — verdict hero, ranked suspect cards, evidence rows carrying
      `sourceHu` as visible provenance, `✓ Próbáljuk ki` per suspect.
- [ ] **Step 3:** Both modes green; commit.

### Task 5: Wiring — routes, hub tile, gates

**Files:** `app/router.tsx`, `pages/MezoHubPage.tsx`

- [ ] **Step 1:** Two routes as full-page siblings (`mezo/diagnozis`, `mezo/diagnozis/:id`).
- [ ] **Step 2:** One tile in the Mezo hub mosaic, bottom line from `useDiagnoses` (honest while
      unresolved — the hub's existing rule).
- [ ] **Step 3:** `pnpm test` AND `VITE_USE_MOCK=false pnpm test` AND `pnpm build` — all green.
- [ ] **Step 4:** Visual goldens for the two pages, both platforms.
- [ ] **Step 5:** Docs — `proactive.md` §4 gains the FE row; CODEMAP regenerated. Commit.

## Done criteria

The user opens `/mezo`, taps Diagnózis, sees past diagnoses (or an honest empty state), generates
one, reads ranked evidence-bound suspects, and turns a probe into a tracked experiment — in the
real app, against the live backend.
