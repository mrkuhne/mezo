# Train Titanium T7 — Ceremony + recap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** closing a workout earns the two-act star ceremony (the owner-approved reward
moment), the way out lands straight on Mai, and a finished session read back is one settled
recap page — per the canonical ceremony pattern doc and the prototype's `summary()` /
`detailsStep()` / `recap()`.

**Architecture:** a new pure `logic/cerScore.ts` (sessionScore/starsFor/verdict/muscle rows
over the UNCHANGED `Session` model) + a `WorkoutCeremony` component driven by ONE rAF pass,
replacing the `summary` phase render; the `complete` phase becomes the merged recap. The
finish wiring (`finishAndCelebrate`, `finishPending`, level-up) stays; only what renders
around it changes. New `cer-` CSS section ported from the prototype's `session.css`.

**Tech stack:** React + RTL, rAF single-pass choreography with a reduced-motion branch,
prototype.css `cer-` section with structure-test registration.

**Driving artifacts:** `docs/design_2.0/2026-09-15-ceremony-pattern.md` (BINDING — anatomy,
motion spec, materials, copy rules), prototype `session.js:272-452` (starRow, VERDICTS,
muscleStarRows, summary, detailsStep, recap, runCeremony) + `session-state.js:203-254`
(starsFor, sessionStars, sessionScore), slice map row T7, bd `mezo-88iwa.8`, branch
`feat/train-titanium-ceremony`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus the ceremony
pattern doc verbatim, in particular:

- **One rAF pass drives everything** — `--p`, counters, star ignition — cubic ease-out
  `1-(1-t)^3`, 2400 ms; `prefers-reduced-motion: reduce` paints the final state instantly;
  the ceremony plays exactly once per close (a re-render or back-and-forth never replays it).
  Fills/counters are frame-driven, never CSS width transitions (hidden-webview freeze).
- **A ceremony celebrates a completed whole** — it fires on the finish POST resolving
  (complete or confirmed-partial close), never mid-workout; undo paths don't exist here.
- **Stars come from real work:** `sessionScore` weighs done vs planned sets, reps and volume
  equally, each share capped at 1 (over-performing can't inflate past five stars); halves
  allowed (`starsFor`). The closing line under the ceremony says the stars come from the
  planned szett/ismétlés/súly — "nem AI-értékelés" (prototype copy).
- **Honesty:** the +XP tile shows the finish response's real XP when it carries one, else
  renders nothing (never a fabricated `count×10`); the kcal tile uses the T5
  `trainDayEnergy` estimate labelled "Becslés, nem mérés" and is HIDDEN when the estimate
  is unknown; records shown are the session's real earned RECORD-tier medals
  (`sessionMedals`), never recomputed guesses; missing data = em dash never 0.
- **Design:** stars/icons from the shared sprite and clay set, NEVER emojis; the gold-stone
  bar fill uses the Ritmus stone recipe (the `cer-` CSS port carries it); text never sits ON
  the stone; down/partial never red; copy adherence-neutral (VERDICTS ladder), Hungarian,
  no banned jargon (plafon/optimum/rámpa/tier/blokk).
- **CSS discipline:** every ported class lands `cer-`-prefixed (`.stars` → `.cer-starrow`,
  `.wo-mstar*` → `.cer-mstar*`, `.wo-sum-section` → `.cer-section`, `.wo-recap-note` →
  `.cer-recap-note`) in ONE marked section of `frontend/src/styles/prototype.css`,
  registered in `prototypeCssStructure.test.ts`; built-CSS collision grep as a named gate.
- **Data mechanics untouchable:** `workoutState.ts` unchanged except pure ADDITIONS;
  `finishAndCelebrate`/`finishPending`/`useLevelUp` wiring, the closing-note draft
  (`closingNote`), and the prep/active phases stay as T6 shipped them.

Verified anchors: `ActiveWorkoutPage.tsx:866-895` (summary/complete render WorkoutSummary;
`closing` vs `closed`; `actualMin={null}` decision comment kept), `finishAndCelebrate`
(phase flip on success; zero-pending goes straight to complete per T6), `sessionMedals`
state, `closingNote` draft state, `useLevelUp`; `components/WorkoutSummary.tsx` (362 lines —
the surface being replaced; check other importers before deleting);
`logic/trainDayEnergy.ts:17` (`trainDayEnergy(blocks, weightKg): DayEnergy` — known:false
honesty), `logic/dayImpact.ts` (muscle helpers), MUSCLE_LABELS (grep its home);
`api/feature/train/train.yml:3268-3292` (levelUp `xpGained` + the finish summary's
`xpGained`/`streakWeeks` — read the actual response schema for the exact field path);
prototype `session.js:272-281` (starRow + VERDICTS), `:292-334` (summary), `:337-361`
(detailsStep), `:364-417` (recap), `:420-452` (runCeremony), `session-state.js:203-208`
(starsFor), `:211-215` (sessionStars), `:236-254` (sessionScore); ceremony doc §Motion,
§Materials, §Copy.

---

### Task 1: `logic/cerScore.ts` — the pure ceremony math

**Files:**
- Create: `frontend/src/features/train/logic/cerScore.ts` + `cerScore.test.ts`

**Interfaces (produces, consumed by Tasks 3-4):**

```ts
export interface CerScore {
  target: { sets: number; reps: number; volume: number }
  done: { sets: number; reps: number; volume: number }
  ratio: number   // mean of the three shares, each capped at 1
  stars: number   // starsFor(ratio), halves
}
/** Stars in halves from a 0..1 ratio: round(ratio*10)/2, clamped 0..5. */
export function starsFor(ratio: number): number
/** Prototype session-state.js:236-254 ported to the production Session:
 *  targets come from prescribedAt per slot (kg×reps; a slot with no prescription
 *  contributes its logged values to done but nothing to target), done from s.logged.
 *  Skipped exercises still count in target — skipping is missed work (prototype rule). */
export function cerScore(s: Session, exercises: LoggedWorkoutExercise[]): CerScore
/** VERDICTS ladder verbatim: 5 'Hibátlan nap.' / 4 'Erős nap.' / 3 'Rendben volt.' /
 *  1.5 'Elindult.' / 0 'Ma nem jött össze.' */
export function verdictFor(stars: number): string
export interface MuscleStarRow {
  muscle: string          // taxonomy token (BodyMap/MuscleChip key)
  label: string           // Hungarian display name
  done: number; plan: number
  ratio: number; stars: number
}
/** Today's per-muscle rows from the session: plan = effectiveSetCount summed per
 *  exercise.muscle (skipped exercises included in plan), done = logged counts;
 *  sorted desc by done then plan; empty plan rows dropped. */
export function muscleStarRows(s: Session, exercises: LoggedWorkoutExercise[]): MuscleStarRow[]
```

- [ ] **Step 1: Failing table tests** — starsFor: 0→0, 0.49→2.5, 1→5, over-1 input clamps;
  cerScore: over-performed volume caps at 1 per share; warmup+working slots both count;
  no-prescription slot adds to done only; skipped exercise inflates target not done;
  verdictFor boundary cases (5/4/3/1.5/0 and 2.9→'Elindult.'? — no: 2.9 ≥ 1.5 → 'Elindult.'
  is wrong, check the ladder: ≥3 'Rendben volt.'; write the boundaries exactly);
  muscleStarRows grouping/sorting/empty-drop.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (pure, no React).
- [ ] **Step 4:** PASS. **Step 5:** Commit
  `feat(train): ceremony score math — cerScore, starsFor, muscle rows (mezo-88iwa.8)`.

### Task 2: The `cer-` CSS section

**Files:**
- Modify: `frontend/src/styles/prototype.css` (one marked section
  `/* ── /train ceremony titanium ── */` … close marker, matching the file's marker idiom),
  `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` (register; assert
  `.cer-stars`, `.cer-bar`, `.cer-counters`, `.cer-mstar`, `.cer-kcal`, `.cer-starrow`)

Port the prototype `session.css` ceremony families: `.cer` (+`.cer-sky`, `.cer-stars` with
`is-lit`/`is-half` + `.cer-aura`, `.cer-bar`/`.cer-fill`/`.cer-comet` — the Ritmus gold-stone
gradient per the ceremony doc's Materials recipe, `.cer-counters`, `.cer-result`,
`.cer-stats`, `.cer-record`, `.cer-foot`, `.cer-muscles`, `.cer-kcal*`, `.cer-cta`,
`.cer-details-screen`, `.is-settled`, `.is-told` reveal) and the renamed ones:
`.stars`→`.cer-starrow` (+`.mini`), `.wo-mstar*`→`.cer-mstar*` (incl. the zone/fill track),
`.wo-sum-section`→`.cer-section`, `.wo-recap-note`→`.cer-recap-note`,
`.wo-summary`→`.cer-screen` wrapper (the prototype's `.wo-summary cer-screen` combo becomes
just `.cer-screen`). Reduced-motion rules ported. NO `.overline` — the eyebrow uses the
existing `.tr-eyebrow`-style idiom (grep what T5 named it and reuse).

- [ ] **Step 1:** Failing structure-test registration. **Step 2:** FAIL. **Step 3:** Port +
  rename. **Step 4:** PASS; `pnpm build` + grep: every new selector starts `.cer-`
  (or `.is-` state scoped under a `.cer` ancestor). **Step 5:** Commit
  `feat(train): the cer- ceremony CSS section (mezo-88iwa.8)`.

### Task 3: `WorkoutCeremony` — the two acts replace the closing screen

**Files:**
- Create: `frontend/src/features/train/components/WorkoutCeremony.tsx` + test
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (the `summary` phase
  renders the ceremony; the finish flow's phase flips)

**Interfaces:**

```tsx
interface WorkoutCeremonyProps {
  score: CerScore
  eyebrow: string                       // 'EDZÉS LEZÁRVA'
  minutes: number | null                // measured only — null hides the tile (see below)
  xpGained: number | null               // real XP from the finish response, null hides
  records: Array<{ name: string; value: string }>  // earned RECORD medals this session
  muscles: MuscleStarRow[]
  kcal: { value: number; known: true } | null      // trainDayEnergy; null hides the tile
  note: string; onNote(v: string): void            // the closing-note draft, act two
  onClose(): void                       // straight to Mai
  onGoFuel(): void
  settled?: boolean                     // recap mode: paint final state, no pass
  reducedMotion?: boolean               // test seam; defaults to the media query
}
```

Behavior (prototype `summary()`+`detailsStep()` merged into act one → act two on ONE
screen; the separate `data-cer-next` step collapses into the `.is-told` reveal per the
ceremony doc's two-act structure):
- Act one: sky + five stars + gold bar + three counters (szett/ismétlés/kg × rep) driven by
  the single rAF pass to `score.ratio`; sr-only `<h1>` announces the stars; focus lands on it.
- Act two (`.is-told` after the pass, or instantly reduced-motion/settled): verdict sentence
  (`verdictFor`), stat tiles (minutes — ONLY if a real measured value exists, else omit
  entirely per the `actualMin` decision comment; `+XP` when `xpGained` present), the
  records strip when non-empty, the muscle rows (`.cer-mstar` with mini star rows + zone
  track), the kcal tile when known (tap → `onGoFuel`), the note field (the existing
  closing-note draft moves here), and the close CTA `Vissza a mai napra` →`onClose`.
- The pass runs ONCE: guard with a ref; `settled` skips it.
- The closing honesty line: "A csillagok a tervezett szettből, ismétlésből és súlyból
  számolnak, nem AI-értékelés." (drop the prototype's "Mintaedzés ·" prefix — this is real).

Page wiring: `finishAndCelebrate` success → `setPhase('summary')` in ALL paths (T6's
zero-pending straight-to-complete now goes to the ceremony too — the ceremony IS the close
moment); the level-up overlay still fires (it stacks above; keep the existing call order).
`onClose` → `navigate('/train/mai')` (straight-to-Mai — no intermediate read-only screen).
Minutes: pass `null` (the decision comment at `ActiveWorkoutPage.tsx:879-889` holds — no
fabricated estimate tile in the ceremony). kcal: derive via `trainDayEnergy` from the
session's gym block the way Mai does (find T5's call site and mirror it); pass `null` when
unknown. XP: read the finish response's XP field (verify the exact schema path in
`train.yml:3268-3292` / the generated types; `levelUp.xpGained` exists — if the plain
non-level-up finish carries no XP field, pass `levelUp?.xpGained ?? null`).

- [ ] **Step 1: Failing tests** — reduced-motion renders final state instantly (stars lit per
  score, counters at full values); the pass runs once (rerender doesn't restart — assert via
  the ref seam/spy); act two contents: verdict text, +XP tile present/absent by prop, kcal
  tile hidden when null with NO 0 anywhere, records strip, muscle rows with done/plan,
  note field round-trips, close CTA fires onClose; no minutes tile when null.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (rAF driver per the motion spec — cubic
  ease-out, 2400 ms, `--p` + counter textContent + star class thresholds like
  `runCeremony`). **Step 4:** Page swap: summary phase → ceremony; both-mode train suite
  green. **Step 5:** Commit
  `feat(train): the two-act closing ceremony (mezo-88iwa.8)`.

### Task 4: The merged recap, the sweep, docs, gates, ship

**Files:**
- Modify: `ActiveWorkoutPage.tsx` (the `complete` phase renders
  `<WorkoutCeremony settled …>` with the same real data — the prototype `recap()`: settled
  stars + counters + stats + records + muscles + kcal + `Vissza a mai napra`; plus the
  pending note '`N` szett kihagyott státusszal zárult.' as `.cer-recap-note` when the close
  left pending sets), delete `components/WorkoutSummary.tsx` + test IF no other importer
  (grep — `WorkoutReviewPage` is a separate surface and stays untouched), sweep dead
  `.wkx-` summary CSS the same conservative way as T6's Task 7
- Docs: `docs/features/train.md` §2 closing/summary paragraphs → the ceremony + recap
  (keep the `actualMin` decision record, note the straight-to-Mai close and that the
  challenge-outcome strip lives where it lands now — see below); CODEMAP regen
- **Challenge outcomes:** WorkoutSummary today shows per-challenge results
  (`summaryChallenges`). The recap keeps them: render the existing challenge strip (port
  the minimal markup into the ceremony's act two, records-adjacent, `.cer-record`-style
  rows) — real outcomes, not restyled away. If the strip resists a clean port, STOP and
  report BLOCKED rather than dropping the data silently.
- [ ] **Step 1:** Failing tests: complete phase renders settled ceremony (no pass), pending
  recap note when pending>0, challenges strip with outcomes, WorkoutSummary gone from the
  page. **Step 2:** Implement + sweep. **Step 3:** Full gates FOREGROUND: both-mode
  `pnpm test`, `npx tsc -b`, `pnpm build` + cer- collision grep, `pnpm test:layout`.
- [ ] **Step 4:** Docs + CODEMAP commit; push; self-PR (`--body-file`); CI monitor;
  detached-worktree merge; post-merge CODEMAP; close `mezo-88iwa.8`.

## Self-review notes

- The prototype's separate `summary`→`details` two-SCREEN step ('Részletek' CTA) is
  deliberately collapsed to the doc's two-ACT one-screen structure — the ceremony doc is
  newer and canonical ("Act two — the reading… with the single CTA pinned near the thumb";
  its meal example keeps a second step for glucose, Train has no such deeper panel).
- `sessionStars` (count/planned only) is NOT ported — `cerScore.ratio` is the one star
  source (the prototype itself used sessionScore for the bar and stars in the end).
- The kcal tile's prototype `260 × ratio` hardcode is replaced by the honest T5 estimator
  or nothing; XP `count×10` likewise replaced by the wire's value or nothing.
- WorkoutReviewPage (`/train/review/:id`) is a different surface (T4 owns its tab home) —
  untouched here; the T13/Gyakorlatok slice revisits historical surfaces.
- Type check: `CerScore`/`MuscleStarRow` names match between Tasks 1, 3, 4.
