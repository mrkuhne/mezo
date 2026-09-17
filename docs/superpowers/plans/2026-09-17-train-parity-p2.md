# Train 1:1 parity — P2: build the screens that do not exist yet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the three Train screens production simply does not have — „Minden izomjel", the
real Gyakorlatok catalogue, and the per-exercise story — exist, built 1:1 from the approved
prototype, with the backend series the story's strength curve needs.

**Architecture:** one FE-only screen (jelek, over the muscle taxonomy T3 already shipped),
then one contract-first backend addition (`e1rmSeries` on `ExerciseRecordResponse`, derived
through the shipped `OneRepMax` decider), then the two Gyakorlatok screens over the catalogue
and records endpoints that already exist. Two CSS families port fresh (`mm-`, `gy-`);
everything else (`pl-`, `ld-`, `wz-chip`) is already in the tree.

**Tech stack:** React + RTL, OpenAPI fragment + generators, Spring Boot service + pure
decider, prototype.css section ports with structure-test registration.

**Driving artifacts:** `docs/design_2.0/2026-09-16-train-parity-matrix.md` §15, §16, §17 (the
live-measured gaps) and its §20/§21 scoreboard; the prototype
`docs/design_2.0/prototypes/companion-titanium/` — `muscles.js:9-19` (`muscleMapHtml`),
`load-pages.js:140-141,184-187` (the doorway + the jelek route), `gyak-pages.js:18-33,35-50`
(chips, rows, `gyHome`), `:55-68` (`curve`), `:70-124` (`gyDetail`); recon `p2-recon.md`
(2026-09-17, verified anchors); bd `mezo-lf3cv`; branch `feat/train-parity-p2`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus:

- **The prototype is the specification** (owner directive 2026-09-16). Where production
  carries data the prototype's screen does not show (`videoUrl`, the demo stills), keep it
  only if it fits the prototype's anatomy without inventing a section — and say which you
  did. Where the prototype shows something production has no source for, see the next rule.
- **No invented data, ever.** The recon found four things the prototype shows that
  production cannot source. Each has a ruling in this plan; none may be faked:
  - `e1rmSeries` (the strength curve's solid line) — **built** in Task 2.
  - the *projected* dashed branch — **not built**: it is the prototype's own forward guess
    with no production model behind it. The curve draws the real series only, and the copy
    says so. Recorded as a deliberate gap in the matrix.
  - „Következő cél" — **derived client-side from the real `bestSet`** and phrased as a
    target, not a prediction (the prototype's own wording: same weight, one more rep). Never
    presented as something the system predicts.
  - the cue prose — **omitted**: no catalogue field carries it. Recorded, not faked.
- **„Hol szerepel" is derived client-side** from plan/template data the app already fetches;
  no new endpoint. If an exercise cannot be matched, the section renders its honest empty
  line, never a guess.
- **Contract change = fragment + merged `api/openapi.yml` + regenerated `api.gen.ts` in ONE
  commit**; backend DTOs regenerate at build.
- **Mock parity is manual here** (`trainHooks.ts:672-674` records that
  `exerciseRecordsMock` was hand-built once already): every new wire field and every derived
  join needs a mock fixture, or the demo silently renders empty.
- **`navModel` `owns`** must gain the new routes (`/train/exercises/:key`,
  `/train/week/jelek`) or the tab bar lights the wrong tab.
- **Every task runs `pnpm test:layout`** — P1 found it red-on-arrival for six commits
  (bd mezo-7exbw).
- **Every task ends with the WHOLE-SCREEN parity check** against the prototype, shell
  excluded (owner decision A), and updates the matrix row it closes.
- Honesty rules unchanged: em dash for missing data, estimates labelled, percent drawn,
  clay icons never emojis, Hungarian free of the banned jargon.

Verified anchors: prototype `muscles.js:9-19`, `muscle-taxonomy.js:6-13` (6 regions),
`:15-35` (the 21 muscles), `load-pages.js:140-141` (doorway copy „Minden izomjel / A 21 izom,
saját jellel, régiónként"), `:184-187` (back pill `‹ Izomtérkép`, active = muscles worked
this week), `train-pages.css:155-176` (`.mm-*`, **not** in load.css), `gyak.css` (87 lines,
`.gy-*`), `gyak-pages.js:35-50` (poster hero, `#gy-search` placeholder „Keresés névre vagy
izomra…", foot `N gyakorlat · N rekorddal · N medál`), `:18-19` (chips `Mind` + one per
region), `:21-33` (`.gy-card` rows: art, name, muscle, best e1RM + „becsült 1RM" + medal
count, else „még nincs naplózva"), `:70-124` (`gyDetail`: hero, `Rekordjaid` three stat
cards, `Következő cél`, `Az erőd íve`, `Medáljaid`, `Hol szerepel`);
production `ExercisesPage.tsx` (456 lines, DS `.excat*` top-5 shell — to be replaced),
`sheets/ExerciseRecordSheet.tsx` (the modal standing in for the story),
`TrainWeekMapPage.tsx` (where the doorway belongs), `router.tsx:281-282`,
`navModel.ts:66-67` (`owns: ['/train/medals']`), `trainApi.ts:181` (catalogue), `:192-193`
(records), `trainHooks.ts:665-668`, `:672-677`, `hooks.ts:52` (`useMedals`),
`api/openapi.yml:12978+` (`ExerciseRecordResponse` — **no** `e1rmSeries` anywhere),
`backend/.../feature/train/service/OneRepMax.java` (the shipped decider, REP_CAP 12),
`ExerciseRecordService.java` (the records assembler; note bd mezo-za09c — it does not
exclude skipped/warmup sets, unlike every other e1RM reader).

---

### Task 1: „Minden izomjel" — the screen and its doorway

**Files:**
- Modify: `frontend/src/styles/prototype.css` (a marked `mm-` sub-block inside the existing
  `ld-`/terhelés section or its own marked section — follow the file's idiom),
  `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` (register: `.mm-head`,
  `.mm-region`, `.mm-grid`, `.mm-cell`)
- Create: `frontend/src/features/train/pages/TrainWeekJelekPage.tsx` + test
- Modify: `frontend/src/app/router.tsx` (`train/week/jelek`), `frontend/src/app/navModel.ts`
  (the Terhelés row's `owns`), `frontend/src/features/train/pages/TrainWeekMapPage.tsx`
  (the doorway row)

Port `.mm-*` from `train-pages.css:155-176`. The screen (prototype `muscleMapHtml`): a head
(eyebrow `IZOMTÉRKÉP`, „Minden izomcsoport, saját jellel", and the prototype's one-sentence
lead verbatim), then six region blocks — Mell 3 · Hát 4 · Váll 3 · Kar 6 · Láb 4 · Core 1 —
each with its label, its `N izom` count, and a grid of muscle cells drawn with the shipped
`MuscleChip`/geometry (T3), a cell marked live when that muscle was worked this week (real
week-log data, the same source the map page uses — never a fabricated active set). Back pill
`‹ Izomtérkép` docked in-hero. The doorway on the map page is the prototype's `.pl-row
is-quiet` with its copy verbatim.

- [ ] **Step 1: Failing tests** — the structure test's four classes; the page renders six
  regions with the exact counts and all 21 muscles; a muscle worked this week is marked live
  and one that was not is not; the doorway on the map page routes here; the tab stays
  Terhelés.
- [ ] **Step 2:** FAIL. **Step 3:** Port the CSS, build the page, wire the route/owns/doorway.
- [ ] **Step 4:** Both-mode vitest + `tsc -b` + `pnpm build` + `pnpm test:layout`.
- [ ] **Step 5:** WHOLE-SCREEN check against the prototype's `train/2/jelek`; tick matrix §15.
- [ ] **Step 6:** Commit `feat(train): Minden izomjel — the 21 muscles by region (mezo-lf3cv)`.

### Task 2: `e1rmSeries` on the wire

**Files:**
- Modify: `api/feature/train/train.yml` (`ExerciseRecordResponse` gains `e1rmSeries`), then
  regenerate `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` — ONE commit
- Create: the series derivation in `backend/.../feature/train/service/` (a pure decider +
  plain unit test) — consume the shipped `OneRepMax`
- Modify: `ExerciseRecordService.java` (assemble the series), its IT

The series is the story curve's solid line: one point per session in which the exercise was
logged, oldest first, each point the session's best eligible e1RM. Binding shape (mirror the
T13 handoff): **capped at the most recent 52 points**, and a session with no eligible set is
a **gap, not a zero** — the wire must let the FE tell "no data" from "zero", so model the
point as `{ date, e1rm }` and simply omit the session rather than emitting 0. Eligibility is
`OneRepMax`'s (reps ≤ 12), and warmup/skipped sets are excluded — note bd mezo-za09c says
`ExerciseRecordService` does NOT exclude them today for its other figures; do not widen that
bug into the new field, and say in the report whether the existing figures stay as they are.

- [ ] **Step 1:** Failing decider unit tests (ordering, the 52 cap keeping the NEWEST points,
  a no-eligible-set session omitted entirely, reps > 12 ignored, bodyweight handled).
- [ ] **Step 2:** FAIL → implement the decider. **Step 3:** The contract commit
  (fragment + merge + `api.gen.ts` together). **Step 4:** Wire it in the service; focused IT
  with `-Dmezo.test.use-testcontainers=true` + `ArchitectureTest`.
- [ ] **Step 5:** Commits `feat(api): exercise records carry the e1RM series (mezo-lf3cv)` and
  `feat(train): derive the e1RM series through OneRepMax (mezo-lf3cv)`.

### Task 3: The `gy-` CSS section

Port `gyak.css`'s 87 lines into one marked section of `frontend/src/styles/prototype.css`
(`/* ── /train gyakorlatok titanium ─ */` … matching the file's marker idiom), registered in
`prototypeCssStructure.test.ts` asserting `.gy-card`, `.gy-rec`, `.gy-curve`, `.gy-medal`,
`.gy-next`, `.gy-hero`. Every selector `gy-`-prefixed; un-prefixed prototype names get the
prefix (list renames in the report). Do not re-port `.pl-*`/`.ld-*` — they are in the tree.

- [ ] Failing registration test → port → `pnpm build` + collision grep → `pnpm test:layout`
      → commit `feat(train): the gy- Gyakorlatok CSS section (mezo-lf3cv)`.

### Task 4: The Gyakorlatok catalogue

**Files:**
- Modify: `frontend/src/features/train/pages/ExercisesPage.tsx` (replaced wholesale) +
  its test (rewritten, not extended)
- Create: `frontend/src/features/train/logic/exerciseLibrary.ts` + test (the pure joins)

Anatomy (prototype `gyHome`): the poster hero (eyebrow `GYAKORLATOK`, „A mozdulataid", the
lead sentence verbatim, and the foot stats `N gyakorlat · N rekorddal · N medál` — all three
REAL counts from the catalogue, the records and `useMedals`); the search field with the
prototype's placeholder, matching on name OR muscle, **accent-blind** (reuse the shipped
accent-blind matcher from the wizard/library work rather than writing a second one); the
filter chips `Mind` + one per region; then one `.gy-card` per catalogue exercise — muscle
art, name, muscle label, and either the best e1RM with „becsült 1RM" plus the medal count,
or „még nincs naplózva". Tap → the story route.

The joins (catalogue × records × medals) are pure functions in `logic/exerciseLibrary.ts`
with table tests: match by `catalogId` when both sides carry one, else by name (the same
precedence the library slice established — reuse its helper if one exists).

- [ ] Failing tests (hero counts are real and honest at zero; search finds „bicepsz" typed
  without accents and matches a muscle name; chips filter by region; a logged row shows its
  e1RM + medal count; an unlogged row says „még nincs naplózva"; tap routes to the story) →
  implement → both modes → layout → whole-screen check → tick matrix §16.
- [ ] Commit `feat(train): the Gyakorlatok catalogue (mezo-lf3cv)`.

### Task 5: The exercise story

**Files:**
- Create: `frontend/src/features/train/pages/ExerciseStoryPage.tsx` + test at
  `train/exercises/:key`; `frontend/src/features/train/components/StrengthCurve.tsx` + test
- Modify: `router.tsx`, `navModel.ts` (`owns`), and the catalogue's row target;
  `sheets/ExerciseRecordSheet.tsx` retires IF no other consumer (grep — the sheet may still
  open from other surfaces; keep it if so and say where)

Sections (prototype `gyDetail`, real data only):
- Back `‹ Gyakorlatok`; hero (`.pl-dhero.gy-hero`): muscle eyebrow, name, and the foot stats
  `N alkalom · <dátum> óta · N t összsúly` from the record row. The cue prose is **omitted**
  (no source — recorded). Not-logged exercises get the prototype's empty-state prose.
- `Rekordjaid`: the three `.gy-rec` cards — BECSÜLT 1RM (with its delta when a previous
  value exists, „Becslés, nem mérés"), LEGJOBB SZETT (kg × reps + date), LEGTÖBB VOLUMEN.
  Every absent figure is an em dash.
- `Következő cél`: derived from the real `bestSet` and phrased as a target
  („ugyanaz a súly, egy ismétléssel több" — the prototype's own note), never as a prediction.
- `Az erőd íve`: `StrengthCurve` over Task 2's `e1rmSeries` — the SOLID line only. The
  dashed projected branch is NOT drawn (no model behind it); the caption says the line is
  what has happened, and names the estimate. Fewer than two points → the honest empty line,
  never a flat line through one point.
- `Medáljaid`: the medals for THIS exercise, filtered from `useMedals` (kind, value, date);
  honest empty line when none.
- `Hol szerepel`: derived client-side — the plan days and templates that reference this
  exercise, each routing to its page; honest empty line when none.
- Video and demo stills: production has them and the prototype does not. Keep them only if
  they fit the story's anatomy as one quiet row; otherwise leave them to the sheet/editor and
  say so. Do not invent a section for them.

- [ ] Failing tests (each section with real fixture data and with nothing; the curve with
  0/1/2/60 points — the 52 cap is the wire's, the FE must not re-cap silently; the derived
  target's wording; „hol szerepel" hits and misses; medals filtered to this exercise) →
  implement → both modes → layout → whole-screen check → tick matrix §17.
- [ ] Commit `feat(train): the exercise story page (mezo-lf3cv)`.

### Task 6: Sweep, docs, gates, ship

- [ ] **Sweep** everything that lost its last consumer (the old ExercisesPage internals, the
  record sheet if orphaned, dead `.excat*` CSS) — grep-verified with an import-specifier
  scan, not a word grep (the P1 lesson).
- [ ] **Docs:** `docs/features/train.md` (the Gyakorlatok surfaces, the new series field and
  its eligibility/cap/gap rules, the derived target and „hol szerepel" derivations, the
  jelek screen); the parity matrix — tick §15/§16/§17 and ADD the rows P2 creates (the
  projected curve branch not drawn; the cue prose omitted; `MedalsPage` still a
  production-only screen the prototype folds into the story); CODEMAP regen.
- [ ] **Gates FOREGROUND:** both-mode full `pnpm test`, `npx tsc -b`, `pnpm build`,
  `pnpm test:layout`, plus the backend focused ITs and `ArchitectureTest`.
- [ ] **The parity walk:** Gyakorlatok → an exercise story → back; Terhelés → map → jelek.
- [ ] Ship (controller): push, PR (`--body-file`), CI, detached merge, post-merge CODEMAP,
  close `mezo-lf3cv`.

## Self-review notes

- Task 2 is the only backend work, and it is the one thing the story cannot fake. Tasks 4-5
  depend on it; Task 1 does not, so it ships first and gives the owner something to see.
- Four prototype elements have explicit rulings (series built · projection not drawn · target
  derived · cue omitted) so no implementer has to invent one mid-task.
- The wizard (matrix §11) is NOT in this plan — it is its own package after P2.
- `MedalsPage` stays for now: it is a production-only screen, not a layer covering a
  Titanium one, so retiring it is a P3 decision, not a parity blocker.
- Type check: `e1rmSeries` point shape consistent between Tasks 2 and 5;
  `exerciseLibrary.ts`'s join helpers named once and reused by both Gyakorlatok screens.
