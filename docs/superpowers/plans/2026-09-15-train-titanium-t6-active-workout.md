# Train Titanium T6 — Active workout v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the active workout's `active` phase speaks the owner-approved Hevy-card Titanium
idiom — one card per exercise in a scrollable list, set rows you tick, a per-card ⋮ menu
glass, a records glass, a fixed rest dock, and a 3-state finish CTA with a finish-moment
warning — and the RIR picker finally offers the contract's full 0–5 range (audit §A3).

**Architecture:** a UI reface of `ActiveWorkoutSession`'s `active` phase over the UNCHANGED
`logic/workoutState.ts` session model and `useTrain()` data wiring (optimistic logSet +
`attachSetId` dual identity, `mezo-l3on`). The prototype's glasses land on the shipped
`GlassBox` primitive. The `prep`, `summary` and `complete` phases stay as they are — T7
(ceremony) replaces them. New `.wo-` CSS section ported from the prototype's `session.css`.

**Tech stack:** React + RTL, GlassBox (`.gl-*`), MuscleChip (T3), prototype.css `.wo-`
section with structure-test registration.

**Driving artifacts:** coverage manifest (`2026-09-12-train-coverage.md:116` — RIR 0–5 must
land here), audit handoff §A3 (verbatim requirements below), prototype
`docs/design_2.0/prototypes/companion-titanium/session.js` + `session-state.js` +
`session.css`, recon `t6-recon.md` (2026-09-16), bd `mezo-88iwa.7`, branch
`feat/train-titanium-active-workout`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus:

- **Data mechanics are untouchable:** the reface keeps `workoutState.ts` exactly as is and
  preserves the `mezo-l3on` set-identity rules — a row logged optimistically without its
  server id yet is not editable/deletable (`rowFailed`/`rowDisabled` gating,
  `ActiveWorkoutPage.tsx:1613-1614` today); warmup sets never send `rir` (`mezo-eerq`);
  the "Csak ma / Minden hétre" add-set prompt semantics stay (template write via
  `saveDayExercises`).
- **§A3 verbatim:** the RIR picker renders the full `0..5` range driven by ONE exported
  constant (no inline literal arrays); the prefilled value is always visibly selected
  (`aria-pressed`), including 4 and 5; six buttons must fit the narrowest supported viewport
  (320 px) without wrapping — solve it inside the card with tighter pills, never by keeping
  0–3. RIR capture stays mandatory (it drives the progression lever) — no opt-out.
- **Set logging is strictly in order per exercise:** the checkable row is the exercise's next
  pending slot (`nextSetIdx`); later pending rows render their prescribed targets read-only.
  (The pure model appends in completion order — out-of-order ticks would misalign
  prescriptions.) A DONE row tap opens the existing `SetEditSheet`.
- **CSS discipline:** every new class is `wo-`-prefixed, lives in one marked section of
  `frontend/src/styles/prototype.css`, registered in
  `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts`, and the built-CSS Tailwind
  collision grep runs as a named gate step. Never an unprefixed utility-name class
  (the T5 `.overline` lesson).
- **Layout guard:** `/train/session` stays chrome-free (`AppLayout.tsx:39`) and the active
  phase's first sticky element keeps the `sticky-top` class flush at scroller top
  (`frontend/tests/layout/layout.spec.ts:243-257` pins this).
- **Phases:** `prep → active → summary → complete` machine stays; only `active` refaces.
  The manual phase-flip scroll-reset effect stays (no route change between phases).
- **Honesty:** the records glass draws only real data (bestSet/bestE1rm/bestSessionVolume/
  repRecords/recentTopSets + `lastWeek`); e1RM figures carry "Becslés, nem mérés"; missing
  data = em dash; the long-term e1RM curve ("Hosszabb táv") is T13's — do NOT fake it here.
- **Reorder by arrows, never drag** (menu glass "Előrébb/Hátrébb"); details in the 3D glass,
  never a drawer.

Verified anchors: `ActiveWorkoutPage.tsx:147` (guard cmp), `:219` (`ActiveWorkoutSession`),
`:256` (phase), `:260` (session), `:263` (`viewedId`), `:395,402` (targetRIR prefills),
`:857` (`sticky-top`), `:981` (`onFinish={finishAndCelebrate}`), `:1427-1429` (SetSteppers),
`:1434-1446` (`.rirrow`, `[0,1,2,3].map` at `:1436`), `:1448-1457` (side picker), `:1613-1614`
(row gating), `:1701` (`NoteEditSheet`); `SetEditSheet.tsx:70` (second 0–3 picker);
`sheets/ExerciseActionSheet.tsx` (to retire from this page); `trainHooks.ts:542`
(`useTrain`), `:628-629` (`exerciseRecords`, mock `[]`); `types.ts:1359-1380`
(`LoggedWorkoutExercise`: `rationale`, `note`, `videoUrl`, `muscle`, `lastWeek`);
`api/openapi.yml:12976` (`ExerciseRecordResponse`), `:12940` (`RecordSetRef`);
`GlassBox.tsx` (props `{open, onClose, label, tint?, children}`); `TrainTodayPage.tsx:235`
(entry CTA); `router.tsx:283` (`train/session`); prototype `session.js:71-99` (card + row),
`:101-126` (menu glass), `:132-158` (finish CTA + dock), `:161-246` (history/video glass),
`:249-265` (confirm glass).

---

### Task 1: RIR 0–5 — the §A3 correctness fix

Small and independently correct: it ships even if the reface stalled.

**Files:**
- Create: `frontend/src/features/train/logic/rir.ts` + `rir.test.ts`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx:1436` (picker),
  `frontend/src/features/train/sheets/SetEditSheet.tsx:70` (picker)
- Test: extend `ActiveWorkoutPage.test.tsx` + `SetEditSheet.test.tsx`

**Interfaces:**
- Produces `RIR_VALUES` consumed by both pickers and later tasks:

```ts
// logic/rir.ts — the ONE mirror of the contract bound (train.yml rir: 0..5).
/** Every value the RIR picker offers, in render order. */
export const RIR_VALUES = [0, 1, 2, 3, 4, 5] as const
export const RIR_MAX = RIR_VALUES[RIR_VALUES.length - 1]
```

- [ ] **Step 1: Failing tests.** `rir.test.ts`: `RIR_VALUES` is `[0,1,2,3,4,5]`.
  `ActiveWorkoutPage.test.tsx`: on a working set, buttons `RIR 0`…`RIR 5` all render (six of
  them); with a plan whose `targetRIR` is 4, the `RIR 4` button has `aria-pressed="true"`
  before any tap. `SetEditSheet.test.tsx`: six buttons; editing a set whose `rir` is 5 shows
  `RIR 5` pressed.
- [ ] **Step 2:** Run them — FAIL (only four buttons).
- [ ] **Step 3:** Create `logic/rir.ts`; replace both inline `[0, 1, 2, 3]` arrays with
  `RIR_VALUES.map(…)`. Grep the file pair for any other `0-3` RIR assumption
  (`ActiveWorkoutPage.tsx:1637`'s display line is numeric pass-through — fine).
- [ ] **Step 4:** Tests PASS. Check the six-button row at 320 px: shrink the pill padding in
  the existing `.rirrow` CSS if it wraps (measure with a JSDOM-independent eye — the layout
  suite in Task 7 backs this).
- [ ] **Step 5:** Commit `fix(train): RIR picker offers the contract's full 0-5 range (mezo-88iwa.7)`.

### Task 2: The `.wo-` Titanium CSS section

**Files:**
- Modify: `frontend/src/styles/prototype.css` (append one marked section),
  `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` (register it)

Port the prototype's `session.css` (688 lines) into a `wo-`-prefixed section between
`/* ── /train session titanium ── */` … `/* ── //train session titanium ── */` markers.
Port ONLY the list-phase families this slice uses (the ceremony families — `.cer*`,
`.wo-summary`, `.stars`, `.wo-mstar*` — are T7's; leave them out): `.wo-card`,
`.wo-card-head`, `.wo-card-art`, `.wo-card-copy`, `.wo-card-log`, `.wo-card-menu`,
`.wo-note`, `.wo-cue`, `.wo-rows`, `.wo-rows-head`, `.wo-row`, `.wo-idx`, `.wo-field`,
`.wo-check`, `.wo-verdict`, `.wo-list`, `.wo-dock` (+ ring/copy/acts/finish children),
`.wo-finish` (3 states + glow/art), `.wo-menu`, `.wo-menu-row`, and the glass-card interior
titles the glasses reuse (`.wo-glass-title`, `.wo-glass-note`, `.wo-glass-head`,
`.wo-glass-more`, `.wo-glass-chart`, `.wo-glass-medals`, `.last`, `.last-head`, `.last-row`,
`.rec`, `.recs`, `.rec-art`, `.rec-head`, `.rec-since`, `.rec-track`, `.rec-now`,
`.rec-empty`, `.wo-confirm-art`, `.wo-confirm-list`, `.wo-close-cta`, `.wo-close-art`,
`.wo-secondary`, `.wo-video-frame`). Where the prototype styles `.wo-glass`/`.wo-glass-card`
themselves, SKIP them — the shipped `.gl-backdrop`/`.gl-card` carry that role; the glass
interiors mount INSIDE `GlassBox`. Adapt selectors accordingly (e.g. `.gl-card .wo-menu`).
Un-prefixed prototype names get the prefix (`.last` → `.wo-last`, `.rec` → `.wo-rec`, etc.).

- [ ] **Step 1: Failing test** — register the section in `prototypeCssStructure.test.ts`
  the same way the `terheles` block is: open/close markers present in order, and the span
  actually carries `.wo-card`, `.wo-row`, `.wo-dock`, `.wo-finish`, `.wo-menu-row`,
  `.wo-rec`.
- [ ] **Step 2:** FAIL (no section). **Step 3:** Append the ported section (prefix rename
  applied; `.rirrow` sizing for six pills folded in here if Task 1 left it to CSS).
- [ ] **Step 4:** PASS. `pnpm build`, then grep the built CSS for collisions: every selector
  in the new section must start with `wo-` (or `gl-` descendant); assert none of the ported
  names exists as a Tailwind utility (`grep -o '\.wo-[a-z-]*' dist/assets/*.css | sort -u`
  eyeball + the structure test).
- [ ] **Step 5:** Commit `feat(train): the wo- Titanium CSS section for the active workout (mezo-88iwa.7)`.

### Task 3: The Hevy card list (the centerpiece)

The `active` phase stops being a one-exercise-at-a-time view (`viewedId`): EVERY exercise is
a `.wo-card` in one `.wo-list`, with as many `.wo-row`s as `effectiveSetCount` says.

**Files:**
- Create: `frontend/src/features/train/components/WorkoutCard.tsx` + `WorkoutCard.test.tsx`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (the `active` phase
  render swaps to the card list; the old per-exercise stepper block, `.rirrow`, side-picker
  and v4 `.wkx-slist` table go — but ONLY out of the `active` phase; `summary`/`complete`
  keep whatever they render today)
- Test: rewrite the `active`-phase blocks of `ActiveWorkoutPage.test.tsx`

**Interfaces (consumed):** `Session` + `effectiveSetCount`/`nextSetIdx`/`prescribedAt`/
`completeSet`/`updateLoggedSet`/`attachSetId` (unchanged); `useTrain().logSet/updateSet/
deleteSet`; `MuscleChip` (T3) for `.wo-card-art`; Task 1's `RIR_VALUES`.

**Produces:** `WorkoutCard` props:

```tsx
interface WorkoutCardProps {
  exercise: LoggedWorkoutExercise
  session: Session
  busy: boolean                       // a log/edit write is in flight for this exercise
  onLogSet(input: { weight: number; reps: number; rir: number | null; side: SetSide | null }): void
  onTapDoneRow(setIdx: number): void  // opens SetEditSheet (existing)
  onOpenRecords(): void               // Task 5 glass
  onOpenMenu(): void                  // Task 4 glass
  onEditNote(): void                  // existing NoteEditSheet
}
```

Card anatomy (prototype `session.js:82-99`, adapted to real data):
- Header: `MuscleChip` art from `exercise.muscle`, name, a records button (`.wo-card-log`,
  aria `„… · előzmények és rekordok"`), the ⋮ menu button. Skipped card: `KIHAGYVA` tag,
  rows hidden, `is-skipped` class. All-done card: `is-complete`.
- The saved note as a `.wo-note` pill (tap → `onEditNote`); the `rationale` line as the
  `.wo-cue` sentence when present (it is the plan's own words — no invented cue copy).
- `ProgressionBanner` stays where it is today (above/inside the card head area) — the slice
  map retires the standalone MÚLT column, and that column is already gone; the banner is the
  progression surface T14 will re-tone. Do not delete it.
- Rows: `.wo-rows-head` (`# / KG / ISM / RIR / ✓`), then per slot:
  - DONE row (`is-done`): logged numbers read-only, tap → `onTapDoneRow(idx)` (disabled
    while its server id is missing or its write failed — port the `rowFailed`/`rowDisabled`
    gating verbatim); the medal chip renders in the row end cell where today's table put it.
  - The NEXT pending row: editable `kg`/`reps` numeric inputs (min 44 px touch height)
    prefilled from `prescribedAt` → falling back exactly as today's `prefill()` does; the
    RIR pill row (`RIR_VALUES`, hidden on warmup rows); the L/B/R side segment where the
    exercise takes sides (port the existing condition); a `✓` submit that calls `onLogSet`.
  - LATER pending rows: prescribed targets as quiet placeholders, not interactive.
  - Warmup slots keep their amber `B1…Bn` index labels and never show RIR.
- The card list preserves today's medal toast, challenge chips, `useLevelUp`, and the
  finish/summary wiring untouched (the CTA itself refaces in Task 6).

- [ ] **Step 1: Failing tests** (`WorkoutCard.test.tsx` — table-driven over a seeded
  Session): renders one row per effective slot; only the next pending row has enabled
  inputs; warmup row shows no RIR pills; RIR pills are six and `targetRIR` arrives
  pre-pressed; done row tap fires `onTapDoneRow` but NOT while the entry lacks a server id;
  skipped exercise renders collapsed with `KIHAGYVA`; `onLogSet` receives the typed values
  (`rir: null` on warmup).
- [ ] **Step 2:** FAIL. **Step 3:** Build `WorkoutCard`; swap the `active` phase of
  `ActiveWorkoutSession` to `session.order.map(...)` cards; delete `viewedId` and the
  exercise-rail navigation from the active phase; keep the sticky header (`sticky-top`, back
  chevron, set-progress line, session clock).
- [ ] **Step 4:** Rewrite the `active`-phase tests in `ActiveWorkoutPage.test.tsx` to the
  card idiom (log-a-set optimistic flow, edit/delete via SetEditSheet, medal toast, warmup
  no-RIR wire assertion, `mezo-l3on` gating). Full FE suite green in BOTH modes.
- [ ] **Step 5:** Commit `feat(train): Hevy-card active workout list (mezo-88iwa.7)`.

### Task 4: The per-card ⋮ menu glass

**Files:**
- Create: `frontend/src/features/train/components/WorkoutMenuGlass.tsx` + test
- Modify: `ActiveWorkoutPage.tsx` (menu state `{kind:'menu'|'records'|'video', id} | null`;
  wire the ⋮), retire the `ExerciseActionSheet` import from this page (the sheet file stays —
  check other importers before deleting; if this page was its only consumer, delete it and
  its test)

Menu rows (prototype `session.js:101-126`), each `.wo-menu-row` with disabled states:
Videó (only when `videoUrl` present → opens the video glass), Jegyzet (→ existing
`NoteEditSheet`), Szett hozzáadása (→ the EXISTING "Csak ma / Minden hétre" prompt flow,
unchanged semantics), Szett elvétele (only an unchecked trailing slot; `canRemoveSet` +
last-slot-done check), Előrébb / Hátrébb (arrow reorder over `session.order` — replaces the
`SortableList` sheet for this page), Gyakorlat kihagyása / Visszavesszük (existing
`skipExercise` wire, logged sets kept).

- [ ] **Step 1: Failing tests:** the glass lists the right rows with the right disabled
  states (first exercise: Előrébb disabled; one slot: Elvétele disabled; no `videoUrl`: no
  Videó row); Hátrébb moves the card and closes the glass; Kihagyás flips to Visszavesszük.
- [ ] **Step 2:** FAIL. **Step 3:** Implement on `GlassBox` (`label` = exercise name,
  `tint` from the muscle family color the card already uses). The video glass is a minimal
  `.wo-video-frame` embed of `videoUrl` (same embed idiom the current UI uses for demo
  videos — find and reuse it; if none exists, a plain `<iframe>` YouTube embed).
- [ ] **Step 4:** PASS + suite green. **Step 5:** Commit
  `feat(train): per-card menu glass — reorder by arrows, skip, sets, note, video (mezo-88iwa.7)`.

### Task 5: The records glass + mock fixture

**Files:**
- Create: `frontend/src/features/train/components/WorkoutRecordsGlass.tsx` + test
- Modify: `frontend/src/data/train/trainHooks.ts:628-629` (mock `exerciseRecords` returns a
  fixture instead of `[]`), `frontend/src/data/train/train.ts` (the fixture — records for
  the mock plan's exercises, incl. one with `bestE1rm` and one bodyweight with no
  `weightKg`), `ActiveWorkoutPage.tsx` (wire `.wo-card-log`)

Content (prototype `session.js:161-230`, real data only):
- Head: MuscleChip art, muscle + `sessionCount` eyebrow, name.
- "A múltkori alkalom": the `lastWeek` top working set as ONE row, honestly labelled
  `A múltkori legjobb munkaszetted` (the wire carries the top set, not the full session —
  never render invented sibling rows). Em dash card when `lastWeek` is null.
- "Megdönthető rekordok" — `.wo-rec` bars for: BECSÜLT 1RM (`bestE1rm`, "Becslés, nem
  mérés" note), LEGJOBB SZETT (`bestSet`), LEGTÖBB VOLUMEN egy alkalmon
  (`bestSessionVolume`); each with today's progress from the session's logged sets (today's
  best e1RM via the same Epley the backend documents — `kg × (1 + reps/30)`, reps ≤ 12
  eligible only; today's volume = Σ kg×reps of done sets) and a `MA MEGDÖNTVE` state when
  beaten. Empty state when nothing is logged yet (prototype `rec-empty` copy).
- `repRecords` as a compact list (max-reps at top weights). NO trajectory chart — a one-line
  `.wo-glass-note`: the long-term curve arrives with the Gyakorlatok rebuild (T13).
- Record lookup: match by `catalogId` when present, else by name — extract a pure helper
  `recordFor(records, exercise)` in `logic/` with a table test.

- [ ] **Step 1: Failing tests:** helper match precedence; glass renders the three record
  bars from a fixture; beaten state at a today-set exceeding `bestSet`; null `lastWeek` →
  em dash; empty-log state; bodyweight record renders reps-only (no `weightKg`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement; add the mock fixture (inline, matching the
  mock plan's exercise names/ids so the demo shows real-looking records).
- [ ] **Step 4:** PASS, both modes. **Step 5:** Commit
  `feat(train): records glass on the workout card + exercise-records mock fixture (mezo-88iwa.7)`.

### Task 6: The fixed rest dock + 3-state finish + confirm glass

**Files:**
- Create: `frontend/src/features/train/components/WorkoutDock.tsx` + test,
  `frontend/src/features/train/components/FinishConfirmGlass.tsx` + test
- Modify: `ActiveWorkoutPage.tsx` (the dock replaces `RestTimerBar`'s slot in the active
  phase; the finish CTA refaces; `pendingCount` helper), `frontend/src/features/train/logic/workoutState.ts`
  — ADD (never modify existing fns) a pure `pendingSetCount(s: Session): number` +
  `pendingByExercise(s: Session): Array<{ id: string; left: number }>` (skipped exercises
  excluded) with table tests in `workoutState.test.ts`

Dock (prototype `session.js:144-158`): fixed at the bottom of the active phase, constant
height. Idle: progress ring (done/planned sets), `ELVÉGZETT MUNKA` + `n / m szett`, and a
`Lezárás →` button (disabled at zero logged). Resting: the ring becomes the countdown,
`PIHENŐ · <exercise>` + mm:ss, `+30s` and `Kész` actions. Drive it from the EXISTING
`useRestTimer()` instance — same start sites (after a working-set log with more slots open),
same `restSecondsFor` durations; only the rendering moves. `aria-live="polite"` status.

Finish (prototype `session.js:132-142, 249-265`): one `.wo-finish` CTA at the list end in
three honest states — `skip` (nothing logged: „Edzés kihagyása"), `partial` (gold), `full`
(green, all non-skipped slots done). Tapping it (or the dock's Lezárás) with pending sets
opens the confirm glass: pending count headline, per-exercise `.wo-confirm-list` from
`pendingByExercise`, „Befejezem így" → the EXISTING `finishAndCelebrate` path (phase flips
to `summary` exactly as today — T7 owns what comes after), „Mégse, visszamegyek" closes.
With zero pending it goes straight to `finishAndCelebrate`. `finishPending` still disables
everything in flight.

- [ ] **Step 1: Failing tests:** the two pure helpers (skipped excluded; extra/removed slots
  respected); dock idle vs resting renders; +30s extends; disabled Lezárás at zero; CTA
  state table (skip/partial/full); confirm glass lists the right exercises and counts;
  confirm fires finish; cancel doesn't.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS both modes; the layout
  suite's `/train/session` expectations still hold (sticky-top flush, no app-head).
- [ ] **Step 5:** Commit
  `feat(train): fixed rest dock, 3-state finish and finish-moment warning (mezo-88iwa.7)`.

### Task 7: Sweep, docs, gates, ship

- [ ] **Step 1: Sweep.** Grep the active phase for dead `.wkx-`/`.excard`/`.rirrow`/
  `.steprow` usages that no longer render from THIS page's active phase; remove classes from
  `prototype.css` ONLY if no other surface uses them (`SetEditSheet`, summary/complete
  phases and other pages still use their own — verify with grep before touching, list the
  survivors in the report). If `ExerciseActionSheet`/`SortableList` lost their last
  consumer, delete file + test; else leave. `SetStepper` stays (SetEditSheet uses it — verify).
- [ ] **Step 2: Docs.** `docs/features/train.md` §2 (Active workout) rewrite to the card
  idiom (cards, in-order logging rule, menu/records glasses, dock, 3-state finish + warning,
  RIR 0–5 with the §A3 note); keep the `mezo-l3on`/`mezo-eerq` decision records. Regenerate
  `docs/CODEMAP.md`.
- [ ] **Step 3: Full gates FOREGROUND:** `CI=true VITE_USE_MOCK=true pnpm test`,
  `CI=true VITE_USE_MOCK=false pnpm test`, `npx tsc -b`, `pnpm build` + wo- collision grep,
  `pnpm test:layout`.
- [ ] **Step 4:** Commit docs; push; self-PR (`--body-file`); CI monitor; detached-worktree
  merge; post-merge CODEMAP; close `mezo-88iwa.7`.

## Self-review notes

- §A3 is Task 1, self-contained and first — the audit's "ship first" order honored.
- Ceremony/`summary`/`recap` deliberately absent (T7); the prototype's `setVerdict` per-row
  up/down icons are NOT ported — the wire has no per-index last-time sets (only the top-set
  `lastWeek` ref), and inventing them would break the honesty rule; the medal chip is the
  earned per-row marker. Recorded here so the reviewer doesn't chase it.
- The stall-detection banner tone is T14; ProgressionBanner survives untouched.
- Type check: `WorkoutCardProps.onLogSet` carries `rir: number | null` — null on warmup,
  matching the `mezo-eerq` wire rule; `SetSide` comes from `workoutState.ts:11`.
- Prototype's free-numeric RIR input is overridden by §A3's pill-row requirement (the
  handoff is the newer, binding text).
