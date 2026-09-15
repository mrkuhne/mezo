# Train Titanium T5 — Mai Day View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TrainTodayPage` becomes the owner-approved Titanium Mai face — day poster with the
start CTA inside it, the "Vagy inkább" quick chips, the kcal-contribution card and the
muscle-impact-in-words card — while every one of the page's 49 pinned behaviors survives.

**Architecture:** two new pure logic modules (`dayImpact.ts`, `trainDayEnergy.ts`) carry the
derivations; the `.tr-*` Titanium CSS ports from the approved prototype into `prototype.css`;
the page rebuild happens in two passes (poster+CTA first, cards second) so the suite stays
green between commits. The prototype (`docs/design_2.0/prototypes/companion-titanium/
train-pages.js` + `train-pages.css`) is the visual source of truth; the page's URL/day/gating
contracts are the behavioral source of truth and DO NOT change.

**Tech stack:** React + existing hooks (no contract change), vitest/RTL, prototype.css tokens.

**Driving artifacts:** approved prototype (Mai), coverage manifest, recon 2026-09-15
(TrainTodayPage anchors), bd `mezo-88iwa.6`, branch `feat/train-titanium-mai`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus, binding:

- NO behavioral contract changes: the `?day={0..6}` URL derivation (`TrainTodayPage.tsx:96-110`,
  `replace: true`, the `Number(null)===0` guard), the three-state gym gating (`:340-385` —
  completed → `/train/review/:id`; open → "Folytassuk"; else "Indítsuk"), rest-day/ghost/
  skeleton identities, done-flip and no-leak-across-days, Pótold-on-past, morning-training
  cards, the level-up plumbing (`logSportSession/logRunSession onSuccess: showLevelUp`), the
  Sport row and Mezociklus row doors (the ONLY entries to `/train/sport` and the meso overview).
- Test honesty: the 49 existing tests are ADAPTED to the new markup (query changes), never
  deleted or weakened; every listed pinned behavior keeps an assertion.
- Clay icons only — the page's emojis (`🗓` :298, `🏋️ GYM`, `SPORT_EMOJI`, `🏃`) all go.
- Estimates say so: the kcal card carries "Becslés, nem mérés"; missing data is an em dash or
  an honest sentence, never a fabricated 0 (the FuelMaiPage no-BMR honest-zero precedent).
- Dual-mode: mock stays synchronous-fixture-fed; no static fallback in real mode; both-mode
  suites gate every task that touches the page.
- `TrainTodaySkeleton.tsx` mirrors the new layout in the same commit as the face change.
- New CSS goes into `frontend/src/styles/prototype.css` in its own commented `tr-` section;
  `prototypeCssStructure.test.ts` / `mozaikCssTokens.test.ts` updated in step; tokens only,
  no raw hex beyond what those gates already allow.

Verified anchors: recon report 2026-09-15 (in the bd notes of mezo-88iwa.6's parent); page
`TrainTodayPage.tsx` sections `:55-68` hooks, `:96-110` URL, `:115` skeleton, `:120-154`
ghost, `:246-260` legacy header, `:271-287` DayStrip, `:290-304` meso row, `:310-320` sport
row, `:325-502` hero cards, `:510-567` rest-day family, `:569-598` sheets. Prototype word
ladder `train-pages.js:36`; MET table `frontend/src/data/fuel/fuelConfig.ts:39`
(`MET_BY_KIND = { gym: 6.0, sport: 4.5, run: 9.5 }`, kcal = MET × weightKg × hours);
T3 components `BodyMap({heat, views, className, ariaLabel})`, `MuscleChip({token, size, className})`.

---

### Task 1: `dayImpact` — the day's muscles, in words

**Files:**
- Create: `frontend/src/features/train/logic/dayImpact.ts`
- Test: `frontend/src/features/train/logic/dayImpact.test.ts`

**Interfaces:**
- Consumes: the active meso day shape (`activeMeso.days[].exercises[].{muscle, workingSets}`
  — same rows `muscleWeek.ts:21` reads) and, optionally, logged working-set counts per muscle.
- Produces:

```ts
export type DayImpactRow = {
  region: string            // muscleColors region id (6 families)
  label: string             // REGION_LABELS[region]
  token: string             // the region's heaviest muscle token (for MuscleChip)
  plannedSets: number
  doneSets: number
  word: 'ma nem kap' | 'enyhe' | 'közepes' | 'erős'
}
export function dayImpact(
  exercises: Array<{ muscle: string; workingSets: number }>,
  doneByMuscle?: Record<string, number>,
): DayImpactRow[]
```

Rules (the prototype's ladder, `train-pages.js:36`): per REGION sum of planned working sets —
0 → 'ma nem kap', 1–3 → 'enyhe', 4–6 → 'közepes', ≥7 → 'erős'. Rows sorted plannedSets desc,
'ma nem kap' regions included only for the four big families (Mell/Hát/Váll/Láb — the
prototype shows absent ones honestly), Kar/Core omitted when 0. `doneSets` sums the optional
map (default 0), capped at plannedSets for the bar (the raw value still returned).
`token` = the region's muscle token with the most planned sets (ties: first seen).

- [ ] **Step 1: the failing table test** — cases: a Felsőtest-A-like day (chest 3 / back 3 /
shoulder 3 → three 'enyhe' rows + Láb 'ma nem kap'); a leg day crossing thresholds (quad 4 +
ham 3 = Láb 7 → 'erős'); done map caps at planned; empty exercises → the four big families
all 'ma nem kap'; unknown muscle token contributes to no region and is dropped silently.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement with `muscleRegion`/`REGION_LABELS` from
`./muscleColors` (no new vocab). **Step 4:** run → PASS. **Step 5:** Commit
`feat(train): dayImpact — the day's muscles in words (mezo-88iwa.6)`.

### Task 2: `trainDayEnergy` — the day's kcal contribution, honestly

**Files:**
- Create: `frontend/src/features/train/logic/trainDayEnergy.ts`
- Test: `frontend/src/features/train/logic/trainDayEnergy.test.ts`

**Interfaces:**
- Consumes: the day's planned movement blocks
  `Array<{ kind: 'gym' | 'sport' | 'run'; minutes: number; done: boolean }>` and `weightKg:
  number | null`.
- Produces:

```ts
export type DayEnergy = {
  plannedKcal: number   // rounded sum over blocks: MET_BY_KIND[kind] × weightKg × minutes/60
  earnedKcal: number    // the done blocks' share of the same sum
  known: boolean        // false when weightKg is null/0 or there are no blocks
}
export function trainDayEnergy(blocks: Block[], weightKg: number | null): DayEnergy
```

`known: false` → the card renders the honest empty state, never 0 kcal. Import `MET_BY_KIND`
from `@/data/fuel/fuelConfig` (the same numbers Fuel's budget uses — ONE source; if the
import path is blocked by a lint boundary, re-export it through `@/data/hooks` instead and
note it).

- [ ] **Step 1: failing test** — 60-min gym at 80 kg → 480 kcal planned; done flag moves it
into earned; mixed blocks sum; `weightKg: null` → `known: false` with zeros; empty blocks →
`known: false`. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** Commit
`feat(train): trainDayEnergy — the day's movement kcal as an honest estimate (mezo-88iwa.6)`.

### Task 3: The `.tr-*` Titanium CSS section

**Files:**
- Modify: `frontend/src/styles/prototype.css` (new `/* — train mai (Titanium, T5) — */`
  section at the end of the file's train area)
- Modify: `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` (register the section
  per the file's own convention — read it first)

Port from `docs/design_2.0/prototypes/companion-titanium/train-pages.css` the class families
the T4/T5 face needs, translated to the app's `--mz-*` tokens (map the prototype's raw colors
to the nearest existing token; the domain green is the train tone token already used by
`.trainhero`): `.tr-day` (the poster: full-bleed gradient wash, status pill, big title, chips
row, constellation slot), `.tr-start` (the in-poster CTA, three visual states via modifier
classes `is-go`/`is-resume`/`is-review`), `.tr-alt` (the "Vagy inkább" chip pair), the energy
card block (`.tr-energy`), and the impact card (`.tr-mus`, `.tr-mus-row`, the two-layer
plan/earned bar `.tr-mus-track` with `--w` custom-property widths). Every color via
`var(--…)`; reveal/entrance via the existing `.rise`/`EntranceGroup` idiom, no new keyframes
unless the poster sheen needs one (then guard it with `prefers-reduced-motion`).

- [ ] **Step 1:** read the structure-gate test, add the section registration (failing).
- [ ] **Step 2:** port the CSS. **Step 3:** `CI=true npx vitest run src/shared/ui/mozaik` →
PASS. **Step 4:** Commit `feat(design): the tr- Titanium section for the Mai face (mezo-88iwa.6)`.

### Task 4: Face rebuild, pass 1 — poster + CTA + chips

**Files:**
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` (sections `:246-260` header,
  `:325-385` today-gym hero), `frontend/src/features/train/pages/TrainTodaySkeleton.tsx`
- Test: `frontend/src/features/train/pages/TrainTodayPage.test.tsx` (adapt queries)

**Interfaces:** consumes Task 3's classes; `MuscleChip` from `../components/MuscleChip`.

The today-gym block becomes the `.tr-day` poster:
- status pill: "BETERVEZVE" / "FOLYAMATBAN" / "KÉSZ" from the same three-state condition that
  drives the CTA today — no new state logic;
- big title = the session type (e.g. "Felsőtest A"), sub-line = the meso name + week
  (`activeMeso`), the `~perc` timing chip moves into the poster's chip row;
- constellation: one `MuscleChip` per `dayImpact` row with `plannedSets > 0` (size 28) in the
  poster's art slot — the first BodyMap-family consumer (verify in Task 6 that the geometry
  chunk now splits);
- the start CTA moves INSIDE the poster (`.tr-start is-go|is-resume|is-review`), same
  navigation targets and guards as today, centred icon+label, no arrow;
- directly under the poster: the `.tr-alt` pair — "Egyedi edzés" (opens `CustomWorkoutSheet`)
  and "Sport naplózása" (opens `SportLogSheet`) — the same two sheets the page already mounts;
- the legacy `.page-header` block (`Eyebrow`/`PageTitle`/"← Ma") is REMOVED (option A: the
  poster names the place; DayStrip stays directly above the poster);
- non-today days, rest day, ghost, morning cards, meso/sport rows: unchanged in this pass
  (only emoji swaps: `🗓` → `ClayIcon i-meso`, `🏋️ GYM`→`i-edzes` chip, `SPORT_EMOJI`→
  `i-sport`, `🏃`→`i-futas`, inside the components this page owns).

- [ ] **Step 1:** adapt the affected tests first (poster queries: `getByRole('button', {name:
/Indítsuk|Folytassuk|Eredmény/})` style stays; header-removal assertions; emoji assertions →
clay icon presence) — run, expect the adapted set to FAIL against the old markup.
- [ ] **Step 2:** rebuild pass 1 + skeleton. **Step 3:**
`CI=true npx vitest run src/features/train/pages` → PASS; `npx tsc -b` clean.
- [ ] **Step 4:** Commit `feat(train): the Mai poster — status pill, in-poster CTA, quick chips (mezo-88iwa.6)`.

### Task 5: Face rebuild, pass 2 — energy + impact cards

**Files:**
- Modify: `TrainTodayPage.tsx` (after the hero-card run, before the rest-day family)
- Test: `TrainTodayPage.test.tsx`

Two new cards, today-only (hidden on non-today days exactly like the current today-only
blocks, test-pinned):
- **`.tr-energy`** — eyebrow "A MAI KERETEDHEZ", headline `+{plannedKcal} kcal`
  (`data`-driven count-up NOT required — static number), the two-line honest split
  ("{earnedKcal} kcal már megszolgálva · {plannedKcal − earnedKcal} a tervben"), footer
  "Becslés, nem mérés."; blocks derive from what the page already knows: today's gym session
  (duration from the timing profile's ~perc, `done` from the three-state), today's sport/run
  slots and their done flips; `weightKg` from the profile the fuel bridge uses — find the
  weight source `deriveDailyBudget` consumes (`frontend/src/data/fuel/timelineHooks.ts:92-110`)
  and read the SAME hook; `known:false` → the card renders one sentence: "Ha megadod a
  súlyod, kiszámoljuk, mennyit ad a mai mozgásod a keretedhez." and no number.
- **`.tr-mus`** — eyebrow "HATÁS AZ IZOMZATODRA", heading "Mit terhel a mai mozgásod", rows
  from `dayImpact` (today's meso day exercises; `doneByMuscle` from the open/completed
  workout's logged working sets when available, else omitted): `MuscleChip` + region label +
  two-layer track (plan faint, earned lit, widths as % of the max planned row) + the word;
  footer "A halvány sáv a tervezett terhelés, a világos a már megszolgált. Becslés, nem
  mérés." On a rest day with a sport slot, rows come from the sport's static heuristic
  (`sportMuscleLoad.ts:62`) with the footer noting the estimate; with nothing planned the
  card is absent (never an all-zero table).

- [ ] **Step 1:** failing tests: energy card renders the honest split for a planned+done mix;
non-today day hides both cards; no-weight renders the sentence and no number; impact rows
show the ladder words and cap earned at planned; rest-day-with-sport shows estimate rows;
nothing-planned renders no card. **Step 2:** implement. **Step 3:** pages suite + tsc PASS.
- [ ] **Step 4:** Commit `feat(train): Mai energy + muscle-impact cards (mezo-88iwa.6)`.

### Task 6: Gates, docs, ship

- [ ] **Step 1:** full gates FOREGROUND: FE both modes, `pnpm build` — CONFIRM the
`bodyGeometry.gen` chunk now exists (first consumer landed; name it in the report) and the
workbox per-file cap holds — layout suite.
- [ ] **Step 2:** `docs/features/train.md` Mai section rewritten to the Titanium face (poster
anatomy, the two cards, the derivations' module names); CODEMAP regen + `--check`.
- [ ] **Step 3:** Commit docs + the plan file; push `feat/train-titanium-mai`; self-PR; CI;
detached-worktree merge; close `mezo-88iwa.6`.

## Self-review notes

- Prototype coverage: poster+pill+chips+constellation (T4 pass 1), in-poster 3-state CTA
  (pass 1), Vagy-inkább chips (pass 1), kcal card (pass 2), impact-in-words (pass 2). The
  prototype's day-navigation bar maps onto the existing DayStrip (kept, restyle allowed in
  pass 1 within the token rules).
- Deliberately NOT in T5: the active-workout overlay (T6), ceremony (T7), sport flow changes
  (T8) — the sheets/routes this page opens stay as they are.
- Type consistency: `DayImpactRow.token` feeds `MuscleChip.token`; `dayImpact`'s optional
  `doneByMuscle` matches the logged-sets map pass 2 builds; `DayEnergy.known` gates the card.
