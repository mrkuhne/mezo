# Train Titanium T12 — Terhelés + Muscle-Map Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the Terhelés tab (`/train/week`, `TrainWeekPage`) becomes the owner-approved
Titanium face — week hero with a drawn percent, the real-anatomy map card and screen (Eddig
megvolt / A heti terv), muscle groups descending by work done whose details open a 3D glass,
the sport card, and the Minden mozgásod screen — completing the audit handoff's D3.

**Architecture:** frontend-only. One pure module (`loadWeek.ts`) derives everything from the
EXISTING spine (`weekZoneRows`, `muscleWeekFromMeso`, `sportLoadForWeek`, `buildWeekAgenda`)
— no parallel aggregation. A new shared `GlassBox` primitive (portal, frosted, the prototype's
wo-glass grammar) replaces the drawer for details; `MuscleWeekSheet`'s content migrates into
the glass. The day-by-day agenda strip leaves this page per the approved prototype (owner,
2026-09-15) — every FUNCTION it carried is inventoried below with its surviving home.

**Scale decision (declared per the recon's warning):** the Terhelés map trusts the FATIGUE
scale — `WeekZoneStatus` (`below|entering|in|over`) is literally what `BodyMap`'s opacity
table is keyed to, and "how much of the week's ask is done" is a fatigue question. The
tier-relative scale stays Terv's (T9's `MesoWeekPage` heat).

**Driving artifacts:** prototype `load-pages.js`/`load-state.js`/`load.css`; audit handoff
§D3; recon 2026-09-15 (Terhelés anchors); bd `mezo-88iwa.13`; branch
`feat/train-titanium-terheles`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus binding:

- **Volume exclusions** (handoff D3, verbatim intent): warmup + skipped logged sets
  (`weekZone.ts:72`), plyo (`:68,:80`), off-day keys `''`/`'sport'` (`setBudget.ts:78-95`,
  `muscleWeek.ts:26`) all stay enforced. `counts_toward_volume` on the LOGGED side is a
  known gap (`weekZoneRows` never consults it): Task 1 checks whether
  `WorkoutDetailResponse` exercises carry the flag on the wire — if yes, enforce it in
  `weekZone.ts`'s logged path with a test; if the wire lacks it, file a bd naming the
  contract addition and document the gap in the module header. Never a naive SUM.
- Sport/run reach is `sportLoadForWeek`'s static heuristic — every surface that shows it
  says "Becslés, nem mérés"; it never adds to set counts.
- `useWeekMuscleLog` is mock-empty by design — every "Eddig megvolt" surface renders
  honestly on empty in mock mode; both vitest modes gate every task.
- BodyMap geometry stays behind its dynamic import (~46 kB chunk; re-verify it still splits).
- Details in the 3D glass, never a drawer (`GlassBox`); Escape/backdrop close;
  reduced-motion honored.
- The T4 reachability rule: the day-strip removal's function inventory (Task 3) is part of
  spec — nothing loses its only entry.
- `NOTICE.md` at the repo root must exist at ship time (T3 shipped it — verify).
- Class-name discipline: the new CSS is `ld-`-prefixed; the built-CSS Tailwind-collision
  grep (the T5 `.overline` lesson) is a named gate step.
- The agenda spine (`buildWeekAgenda`) keeps feeding whatever agenda-derived facts remain —
  no forked ordering/done-state math.

Verified anchors: `TrainWeekPage.tsx:48-55` hooks, `:79` agenda, `:96` `toMai`, `:115` zone
rows (no todayPlan!), `:123-215` sections, 13 tests; `GymPage.tsx:18-20` alias + sameness
test; `MuscleWeekSheet.tsx:46-55,110,117-150,168 (✨ emoji),189`; `weekZone.ts:25` status
vocab, `:60` signature, `:68-80` exclusions, `:139` selectGymRows; `setBudget.ts:31-33`
countsForVolume, `:36-50` GROUP_MEV, `:78-95` budgetGroup; `sportMuscleLoad.ts:21-27,62`;
`weekMuscleLogHooks.ts:11-41`; `BodyMap.tsx:19-30` heat levels; T9 exemplars
`MesoWeekPage.tsx:70-74,168` and the `.pl-` section; prototype `load-pages.js` (hero
:14-32, map card :?, groups :?, glass :?, screens), `load-state.js` (mapHeat/untouched/
sportTouched/movementWeek), `load.css`.

---

### Task 1: `loadWeek.ts` — the week's load, one honest module

**Files:**
- Create: `frontend/src/features/train/logic/loadWeek.ts` + `loadWeek.test.ts`
- Possibly modify: `frontend/src/features/train/logic/weekZone.ts` (the countsTowardVolume
  check's outcome) + its test

**Interfaces:**
- Consumes: `WeekZoneRow[]` (from `weekZoneRows` — the caller passes rows in; this module
  stays hook-free), `SportLoadResult` (from `sportLoadForWeek`), and for the movement split
  the same block shape `trainDayEnergy` established.
- Produces:

```ts
export type LoadWeek = {
  doneSets: number; plannedSets: number; percent: number   // drawn, never bare text
}
export function loadWeekTotals(rows: WeekZoneRow[]): LoadWeek

export type LoadGroupRow = {
  group: string; label: string; colorMuscle: string
  doneSets: number; plannedSets: number; status: WeekZoneStatus
  word: string        // 'ez a hét itt már megvan' | 'még {n} szett van hátra' | 'erre a hét második fele épül'
}
export function loadGroups(rows: WeekZoneRow[]): LoadGroupRow[]   // desc by doneSets, then plannedSets

export type MapMode = 'done' | 'planned'
export function mapHeat(rows: WeekZoneRow[], mode: MapMode): BodyHeat[]
  // done: status per row, doneSets===0 → 'none'; planned: value-scaled via the planned
  // budgets — every muscle the week touches present, none fabricated
export function untouchedMuscles(rows: WeekZoneRow[]): Array<{ label: string; plannedSets: number; colorMuscle: string }>
export function sportReach(load: SportLoadResult): string[]      // region labels, estimate-only
export function movementWeek(gymBlocks: Block[], sport: {minutes:number;kcal:number|null}[], weightKg: number|null): {
  gymMin: number; sportMin: number; totalMin: number
  gymKcal: number | null; sportKcal: number | null; known: boolean
}
```

- [ ] **Step 1: the countsTowardVolume contract check** — grep the generated types
(`frontend/src/data/_client/api.gen.ts`) and `frontend/src/data/types.ts` for the flag on
the workout-DETAIL exercise shape. IF present on the wire: add the exclusion to
`weekZone.ts`'s logged path beside the plyo skip, with a table-test case (a logged
non-counting exercise moves no group). IF absent: file
`bd create` for the contract addition, and write the gap into `loadWeek.ts`'s header.
Document the outcome in the report either way.
- [ ] **Step 2:** failing table tests for every export (statuses to words; desc ordering;
mapHeat done/planned honesty incl. the 'none' rows; untouched excludes worked groups;
movement known:false on null weight — same rules as `trainDayEnergy`).
- [ ] **Step 3:** implement (import `MET_BY_KIND` / reuse `trainDayEnergy` where the math
is identical rather than re-deriving). **Step 4:** PASS both modes. **Step 5:** Commit.

### Task 2: `GlassBox` — the 3D glass primitive

**Files:**
- Create: `frontend/src/shared/ui/mozaik/GlassBox.tsx` + test
- Modify: `frontend/src/styles/prototype.css` (a `gl-` section: frosted backdrop over the
  phone frame, bottom-docked rounded card, tint via `--gl-tint`) + structure-gate reg.

**Interfaces:**
- Produces: `export function GlassBox(props: { open: boolean; onClose: () => void; label:
  string; tint?: string; children: ReactNode }): JSX.Element | null` — portals into the
  phone-frame host exactly like `Sheet.tsx` resolves its portal target (READ Sheet first;
  reuse its target-resolution + focus/Escape handling idioms; the visual is the prototype's
  wo-glass: blurred backdrop, tinted card, × in the header). Reduced-motion renders final
  state. The T6 active-workout slice will reuse this component — keep it generic.

- [ ] **Step 1:** failing RTL tests (opens with role="dialog" + label; backdrop click and
Escape call onClose; tint var lands; reduced-motion class path). **Step 2:** implement +
CSS. **Step 3:** mozaik suite + build-CSS collision grep. **Step 4:** Commit.

### Task 3: TrainWeekPage reface — hero, map card, groups, glass

**Files:** `TrainWeekPage.tsx`, `TrainWeekSkeleton` (in step), `MuscleWeekSheet.tsx`
(content migrates; the file retires if nothing remains — sameness with `GymPage` test rides
along), tests.

Anatomy (prototype `load-pages.js` hero/groups): full-bleed `.ld-hero` — the drawn percent
(big numeral + a filling bar, reveal-driven; NO bare-text percent), "{done} szett a
{planned}-ből", ONE sentence from the strongest honest fact, the Időpontok chip stays in
the hero row; the map card (small two-view BodyMap via `mapHeat(rows,'done')`, the
untouched-count sentence) → `/train/week/terkep`; the group cards (`loadGroups`, bars fill
on reveal, status words) — tap opens the `GlassBox` (tint = the group color) carrying the
migrated MuscleWeekSheet content for THAT group: per-muscle rows, sport/run stimulus chips
(estimate-labelled), the XP forecast line; the sport card (`sportReach` + minutes,
estimate-labelled); the Minden mozgásod doorway card → `/train/week/mozgas`; the provenance
note survives at the foot; `+ Saját edzés` survives (dashed, as today).

**The day-strip function inventory (spec):** the WeeklyDayRow strip leaves this page
(owner-approved prototype). Its functions and their surviving homes — each asserted:
- drill-to-day (`toMai`) → Mai's own DayStrip (already exists; the `/train?day=` redirect
  contract untouched — KEEP the redirect test);
- Időpontok / GymScheduleSheet → the hero chip (kept here);
- non-today gym → session routing → Mai's poster CTA (exists);
- done-day → review routing → Mai past days (exists; the real-mode review-routing test
  moves to an assertion that the map/groups render for that state instead);
- the `heti-napok` kalauz anchor → re-anchor its card to the hero (`data-kalauz-anchor`
  moves; update the registry copy + anchors test);
- medál/StatStrip facts → the hero sentence and the group glass (medál count via the
  existing `useMedals` in the hero row).
Adapt the 13 tests per this table; deletions ONLY where the function's new home is named,
justified line-by-line in the report.

- [ ] **Step 1:** adapt/write failing tests (hero percent drawn; group order + words; glass
opens on tap with the group's rows; mock-empty honesty — zero done renders 'erre a hét
második fele épül', never fake bars; skeleton mirrors the new order). **Step 2:** rebuild +
wire `todayPlan` into `weekZoneRows` (the prep-screen precedent) so 'entering' can fire;
test it. **Step 3:** pages suites both modes + tsc. **Step 4:** Commit.

### Task 4: The two subscreens — Izomtérkép + Minden mozgásod

**Files:**
- Modify: `frontend/src/app/router.tsx` (two child routes under /train/week), navModel owns
  check (prefix covers them — assert)
- Create: `frontend/src/features/train/pages/TrainWeekMapPage.tsx`,
  `TrainWeekMozgasPage.tsx` + tests

Map screen (prototype map screen): back pill docked in a slim hero; the two-view BodyMap
large; the mode chips (Eddig megvolt / A heti terv) re-rendering heat only; the legend IN
WORDS (még vár / elkezdted / jó úton / megvan — mapped from the fatigue statuses; planned
mode gets its own one-line legend); the untouched-muscles list ("még munkára vár", sets);
the sport-reach note (estimate). Mozgás screen: the drawn total minutes, the gym-estimate
vs sport-logged split boxes (never mixed; `known:false` → the honest sentence), the group
rows with a "sport is" chip where the estimate reaches them.

- [ ] Steps: failing route+render tests (mode toggle switches heat; legend words; the
untouched list honest on mock-empty; mozgás split honest) → implement → suites → Commit.

### Task 5: Sweep, gates, docs, ship

- [ ] MuscleWeekSheet: delete if fully migrated (grep consumers; the `✨` emoji dies with
it — if anything remains, swap the emoji for a clay icon); `weekZone.ts:7` stale comment;
docs/features/train.md — the Terhelés section rewritten + the STALE "neither component has
a production consumer" BodyMap bullet (:762-765) fixed; NOTICE.md presence verified;
CODEMAP regen + check; beads backup refresh.
- [ ] Full gates: FE both modes, build (+ chunk-split re-verify + ld- collision grep),
layout suite.
- [ ] Commit docs + this plan file; push `feat/train-titanium-terheles`; PR; CI; detached
merge; close `mezo-88iwa.13`.

## Self-review notes

- Handoff D3 coverage: map wired with the declared scale + both modes (T3/T4 tasks),
  exclusions audited incl. the logged-side gap check (T1), untouched-list (T4), sport
  estimate never blended (T1/T3/T4), the two-scales decision written down (header).
- Owner-decision coverage: groups desc-by-done; day strip removed WITH the function
  inventory; glass never drawer (T2); ⓘ-grade explanations ride the existing detail idiom.
- Deliberate exclusions: GymPage stays the alias (sameness test rides along); the load
  page's old LoadTiles/ZoneMiniGrid retire with the reface (their data lives in the groups).
- Type consistency: `WeekZoneStatus` flows rows → mapHeat → BodyHeat; `movementWeek`
  mirrors `trainDayEnergy`'s honesty contract.
