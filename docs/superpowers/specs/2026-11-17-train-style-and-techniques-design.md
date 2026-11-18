# Training style, intensity techniques and the challenge — the second half of the engine redesign

- **Date:** 2026-11-17
- **Issue:** `mezo-r36n9.65` (epic `mezo-r36n9`)
- **Status:** design, awaiting owner approval
- **Builds on:** [`2026-11-17-train-volume-engine-v2-design.md`](2026-11-17-train-volume-engine-v2-design.md)
  ("v2" below). This document is its extension, asked for by the owner the same day; the two are one programme.
- **Scope:** backend engine + contract; the Boop screens (builder additions, the active-workout indication) as part
  of the Boop slice. **No web UI** (owner decision). The web app must keep working unchanged.

## 1. Intent and why

With v2 the owner's set counts become the truth. He then asked for the other half of "an engine that trains me
well":

1. **Progression must be louder.** Session to session, the same exercise — and exercises that share a muscle —
   should move: more reps or more weight; past a rep threshold, weight.
2. **A training style**, set on the block and overridable per exercise: higher-rep work, heavier work, or two
   all-out sets to failure.
3. **Intensity techniques as first-class things:** drop sets — including his own variant (to failure → 30 s rest →
   30 % less weight → the same reps) — and myo sets.
4. **A deterministic default** for where each technique goes, with an AI layer refining it.
5. **A challenge on every session:** on the main exercise, straight after the last set, half reps in the stretched
   position, as many as he can.
6. **Visible where it matters:** on the exercise and the set during the active workout, and settable and shown in
   the block.

Today none of this can be expressed (§8). Logged as plain sets, techniques would actively mislead the app: partials
would earn false records and become next session's reference, drop legs would count as extra weekly sets, and a
set taken to failure on purpose would read as a "grind" and freeze the load.

## 2. Goals, non-goals, anti-goals

**Goals**

- A **style** on a block with a per-exercise override; it sets rep range, sets, effort target and rest by default,
  and an explicit value on the exercise always wins.
- **Techniques** modelled on the plan (which exercise, which technique), on the prescription (what to do, set by
  set, with rests) and on the log (what he actually did), without touching what a "working set" means to every
  existing reader.
- A pure, config-driven **default planner** and a train-owned **AI port** that may only move techniques inside the
  planner's eligible set.
- The **challenge**: one marked exercise a session, its own personal best.
- **Progression** that is rep-range aware, effort-ramped across the block, and judged per muscle as well as per
  exercise.
- Every technique change arrives in v2's **weekly proposal** as its own line, decided per exercise.

**Non-goals**

- New web screens. A run built on the web never receives techniques (§6.9), so the web player is unaffected.
- Supersets, giant sets, tempo prescriptions, cluster sets — not asked for.
- Fractional muscle counting (ADR 0021 stands).
- Replacing `ProgressionDecider`'s step rules; they are extended, not rewritten.

**Anti-goals**

- A technique on an exercise where failing is unsafe (anything not marked stable), ever — by the planner, by the
  AI, or by a manual pick the app does not at least warn about.
- A technique leg entering records, e1RM, the progression reference or the weekly set count as if it were a
  normal set.
- More technique work than the session can carry in a deficit or on a sport day.

## 3. Owner decisions (2026-11-17)

| # | Decision |
|---|---|
| 1 | Style lives on the block; an exercise may override it. |
| 2 | Everything found in recon and everything discussed is in scope ("építsük be mindegyiket"). |
| 3 | Techniques and the special role of an exercise must be **shown on the exercise and the set during the active workout**, and **settable and visible in the block**. |
| 4 | The challenge sits on the session's most important **stable** exercise (he accepted the research correction: never a squat, a deadlift or a bent-over row). |
| 5 | The plan is extended first, then the look is built in the simulator prototype. |

## 4. Approaches

| | Approach | Trade-off |
|---|---|---|
| **A — a technique is a property of a set, its extra parts are "legs" (chosen)** | `kind` stays `warmup\|working`. A working set may carry a `technique`; what follows the main part (the drop, the mini-sets, the partials) is stored as child **legs**. Every existing reader keeps seeing one working set with its first, full-effort part. | A child table and a richer prescription. Safest for records, progression, timing and the character detectors, which all key on `kind = 'working'`. |
| B — new set kinds (`drop`, `myo`, `partial`) | Each leg is its own `exercise_set` row with a new kind. | Simple to log, but every reader of `kind` silently includes or drops the new kinds (the investigator lists nine of them), and the positional, gap-free `setIndex` the players rely on breaks. |
| C — free text | The technique is a note on the exercise; he logs whatever he did. | No work. Nothing is prescribed, counted, protected or learnable. Fails goals 3–6. |

**A** is chosen (the author's call — the owner handed over the how).

## 5. What the research says (and what we take from it)

See §9 for sources. In one paragraph: techniques **save time, they do not add growth** — a drop set or a myo set
matches several straight sets in roughly half the time, at a higher fatigue cost. They belong on **stable**
exercises (machine, cable, supported dumbbell), on the **last set**, late in the session, **one or two per
session**. Post-failure **lengthened partials** have the clearest evidence on calves and are plausible on leg curl,
leg extension, curls, pulldown and flyes; nothing supports them on big free-weight compounds. Rep ranges from about
5 to 30 grow similarly when sets end near failure, so the three styles are a matter of preference and time, not
efficacy; two all-out sets suit a deficit with sport load, on stable exercises only. No app found schedules
techniques automatically — they are manual set types.

## 6. Design

### 6.1 What an exercise needs to know about itself

`exercise_catalog` gains three attributes (the engine cannot place a technique safely without them):

- `equipment`: `machine | cable | dumbbell | barbell | bodyweight | kettlebell | other`
- `stability`: `stable | free` — *stable* = failing mid-rep is harmless and needs no spotter (machines, cables,
  chest-supported and seated-supported work). Everything else is `free`.
- `lengthened_friendly` (boolean): the stretched position is loaded and safe to repeat (calf raises, leg curl, leg
  extension, preacher / incline curl, pulldown, pec deck / fly, cable overhead extension).

The 166 master rows are classified in `content/exercise-catalog.json` (a reviewed, explicit list — not inferred at
runtime): the master catalog is upserted from that file on every startup (`ExerciseCatalogLoader`), Liquibase owns
only the three new columns. User-authored exercises default to `other / free / false` and are editable; the create/update request
gains the three optional fields.

### 6.2 Style

`trainingStyle` on `meso_template` and `mesocycle` (the block's default) and, nullable, on an exercise (template
json and run row): `balanced | volume | heavy | allout`. (**Not** `style` — that name is already a free-text label
on both tables and on the wire, e.g. "RP · 6 hét"; it stays as it is.) Hungarian: **Kiegyensúlyozott · Sok ismétlés · Nagyobb súly · Két
sorozat bukásig**.

A style is a **default-giver**: when an exercise is added or the style changes, it stamps rep range, working sets,
effort target (reps in reserve) and rest from one config table, keyed by style × exercise class. A value the owner
typed on the exercise is never overwritten (the row remembers which fields are his: `overrides` — a small set of
field names).

Exercise class: `compound-stable`, `compound-free`, `isolation` (from `type` and `stability`).

| Style | compound | isolation | sets | reserve | rest (s) |
|---|---|---|---|---|---|
| Kiegyensúlyozott | 6–10 | 10–15 | plan | 2 (legs 3) | 150 / 90 |
| Sok ismétlés | 10–15 | 15–25 | plan | 2 | 120 / 75 |
| Nagyobb súly | 5–8 | 8–12 | plan | 2 | 180 / 120 |
| Két sorozat bukásig | 6–10 | 8–12 | **2** | **0** | 180 / 120 |

`allout` applies only to **stable** exercises; a free exercise under an all-out block is stamped as *Nagyobb súly*
with a reserve of 1 and the reason is shown. All numbers are `@Validated` config.

The web editor's existing "Failure / Volume" pill (which just writes reserve 0 or 2) keeps working: it writes an
explicit reserve, which is an override.

### 6.3 Techniques — the plan

An exercise (template json + run row) carries `technique`, one of:

| Value | Hungarian | What it is |
|---|---|---|
| `none` | — | straight sets |
| `rest_drop` | Pihenős drop | **the owner's variant**: last set to failure → rest 30 s → 30 % less weight → the same reps |
| `drop` | Drop set | last set to failure → no rest → 20 % less weight → to failure |
| `myo` | Myo set | last set is the activation set (to 1 in reserve), then mini-sets of 3–5 reps with 20 s rests, up to 4, stopping when a mini-set falls short |
| `partials` | Félismétlések | after the last full set: half reps in the stretched position to failure |

One technique per exercise, always on the **last** working set. Independently, an exercise may be the day's
**challenge** (`challenge: true`, §6.6) — the challenge's technique is always `partials`.

The percentages, rests, mini-set bounds are config. `technique_source`: `owner | planner | ai` — an owner's pick is
never moved by the planner or the AI.

### 6.4 Techniques — the prescription and the log

**Prescription.** `PrescribedSet` gains, for the last working set of a technique exercise: `technique`, `restSec`
(for every set — rest becomes server-prescribed), and `legs[]`: ordered steps after the main part, each
`{kind: drop|mini|partials, weightKg?, reps? | toFailure, restBeforeSec}`. The drop weight is snapped with the
existing `WeightSnapper` (real plates, the exercise's known gaps).

**Log.** `exercise_set` gains `technique` (nullable, immutable after create like `kind`) and a child table
**`exercise_set_leg`** (`exercise_set_id`, `leg_index`, `kind`, `weight_kg`, `reps`, `rest_sec`). `SetLogRequest`
gains optional `technique` + `legs[]`; a set update may replace its legs. The parent row is always the main part:
its weight / reps / reserve mean exactly what they mean today.

**What each reader sees — the rule that keeps everything else honest:**

| Reader | Sees |
|---|---|
| Progression reference, e1RM, medals (`WEIGHT`, `REPS_AT_WEIGHT`, `E1RM`, `TARGET_HIT`) | the parent row only; legs never |
| `SESSION_VOLUME` medal, tonnage | parent + drop / mini legs; **never** partials |
| Weekly set count (bands) | one set |
| Session cap (8 per muscle) and exercise cap (5) | a technique set weighs **2** |
| Grind signal (`VolumeDecider`), `ProgressionDecider`'s hold-on-grind | a technique set's reserve of 0 is **expected**, not a grind |
| Timing EWMA, `RirCalibrationDetector` | parent rows only; leg rests are not set cycles |

Counting: the band stays in direct sets (ADR 0021 untouched). The research found no standard for crediting a
technique set as more than one; the extra cost is carried where it is real — fatigue — by the cap weight.

### 6.5 The default planner and the AI

**`TechniquePlanner`** — pure, deterministic, config-driven. Input: the block (days, exercises with catalog
attributes, tiers, style, weeks, phase curve), week number, deficit flag, sport groups and sport days. Output per
week: which exercise carries which technique, and each day's challenge.

Rules, in order:

1. **Eligible** = the exercise is `stable`, counts toward volume, and is the **last** counting exercise of its
   muscle group that day. `partials` additionally needs `lengthened_friendly`.
2. **Weeks.** Weeks 1–2: none. From week 3 to the last loading week: techniques. Deload: none.
3. **Tiers.** Hangsúly muscles first; an Építés muscle only if allowance remains; Tartás never.
4. **Allowance.** At most 2 technique exercises a session (the challenge not included). In a deficit, or on a day
   with sport the same day: 1. A sport-loaded group gets none on a sport day.
5. **Which technique.** Rep range top ≥ 15 on an isolation → `myo`. Otherwise machine / cable → `rest_drop`.
   `drop` is never chosen by default (it is the owner's alternative to pick).
6. **All-out style** exercises get no technique (they already end at failure, twice).
7. An **owner-picked** technique is kept as is and consumes allowance; if he exceeds the allowance the planner does
   not remove his pick, the evaluator warns.

**AI refinement.** A train-owned port `TechniqueLlm` (ADR 0012 pattern; adapter in companion; its own feature
switch). Given the planner's output and the eligible set, the model may **move or swap** techniques within the
eligible set and must give a one-line reason per change; a pure `TechniqueMerger` validates (eligibility,
allowance, owner picks untouched) and drops anything invalid. Switch off, model unavailable or everything rejected
→ the planner's output stands. The AI never invents a technique outside the table, never sets weights or reps.

**Where the result goes.** At build time the evaluator (v2 §6.3) returns the planned techniques and the challenge
per week so the builder can show them. During the run, a week's technique changes are **lines of v2's weekly
proposal** (`kind: technique`, `from`/`to` = technique values, reasons `technique_week`, `emphasis`,
`deficit_allowance`, `ai_suggested`, `stalled`), decided per exercise like any other line; auto mode applies them.

### 6.6 The challenge

Every training day outside the deload has at most one **challenge exercise**: the day's first counting exercise
that is `stable` + `lengthened_friendly`, preferring a Hangsúly muscle, then Építés, then the rest; an owner pick
wins. If the day has none, there is no challenge that day (never a fallback onto an unsafe lift).

After its last full set the player asks for **half reps in the stretched position, as many as he can**. Logged as a
`partials` leg (reps only). The best count per exercise identity at a given weight is a derived record
(`PARTIALS_BEST`) — replayed like every medal (ADR 0016), never stored — and the prescription carries the number to
beat. It is present from week 1 (the owner asked for it on every session); the deficit rule does not remove it,
but a sport-loaded group on a sport day is skipped.

### 6.7 Progression

`ProgressionDecider`'s step rules stay (top of range → the next real weight; an oversized jump → reps past the top
first; in range → +1 rep; hold on a real grind; down when below range at effort). What changes around it:

1. **Rep-range-aware reference.** The reference is the last completed session of the same exercise identity **whose
   plan carried the same rep range**. If the range differs (the same lift at 6–10 on Monday and 12–15 on
   Thursday; a style change), the last top set is **converted** to the new range by equal effort
   (`equalEffortReps`, already in the decider) instead of being judged against a range it was never trained in.
2. **Effort ramps across the block.** The stored reserve is the base; the prescription lowers it as the block
   advances — base in the first third, base − 1 in the middle, 0–1 in the last loading week, base + 2 in the
   deload — as a read-time overlay (the plan row is not edited). Never below 1 on a `free` exercise.
3. **The overshoot threshold becomes per style.** It is already config (`StepPolicy.repOverflow`, +3); only the
   per-style value is new: past it the weight goes up even when the jump is large.
4. **Per-muscle judgement.** Each week, per muscle group: how many of its exercises moved (reps or weight). A
   muscle whose every exercise held for two consecutive weeks is **stalled**; the weekly proposal then offers, in
   this order and only if eligible: a technique on its last exercise, a rep-range change (the other style's range
   for that exercise), or a one-week reduction for that muscle. Reason `stalled`. This is the "exercises that
   overlap in muscle" awareness: progress is owed to the muscle, not only to each lift.
5. **A new or swapped exercise** with no history keeps today's behaviour (`anchor_weight_kg`, else "enter the
   weight"). No cross-exercise load guessing — there is no data to do it honestly.
6. **Rest is prescribed** per set from the style table (today the client hard-codes 150 / 90 s).

### 6.8 Contract (all additive, `train.yml`)

- `ExerciseCatalogItem`, create / update request: `equipment`, `stability`, `lengthenedFriendly`.
- `MesoTemplateUpsertRequest` / responses, `MesocycleResponse`: `trainingStyle`, `techniquesEnabled`.
- `GymExerciseInput`, `TodayExercise`: `trainingStyle`, `restSec`, `overrides[]`, `technique`, `techniqueSource`,
  `challenge`. (`exercise` gains `training_style`, `rest_sec`, `overrides`, `technique`, `technique_source`,
  `challenge` columns; the template json the same fields.)
- `PrescribedSet`: `technique`, `restSec`, `legs[]`, and on the exercise `challengeBest`.
- `SetLogRequest`, `SetUpdateRequest`, `ExerciseSetResponse`: `technique`, `legs[]`.
- v2's evaluate response: per week `techniques[]` and `challenges[]`, plus `techniqueWarnings[]`.
- v2's proposal line: `kind` gains `technique`; reason codes gain the five in §6.5.
- `PUT /api/train/mesocycles/{id}/exercises/{exerciseId}/technique` — set or clear one exercise's technique or
  challenge mid-run (owner source).

### 6.9 Who gets techniques

`techniques_enabled` on a block (template + run), default **false**. Only a client that can show and log legs sets
it (the Boop builder). A block without it is planned, prescribed and logged exactly as today — which is how the web
app stays untouched while the engine ships.

### 6.10 The phone screens (designed here, built in the Boop slice)

Executable look: `spike/boop-blokk-epito`, `ios/Boop/EdzesTervDemo/` — extended for this round.

- **Builder.** The block's style as a four-way choice with a one-line description of what it changes; in *Napok*
  every exercise row shows its technique as a pill with the family's mark, tappable to change (the unsafe ones
  disabled with the reason), the day's challenge exercise flagged; in *Blokk* the weeks show when techniques start
  and stop.
- **Active workout.** The exercise head carries the technique pill; the set strip marks the technique set; when
  that set is current, a step card says what to do ("1 · bukásig", "2 · 30 mp pihenő", "3 · 42,5 kg, ugyanannyi")
  with the rest counting down and the leg's own fields; the challenge is its own moment after the last set: the
  number to beat, a counter, done.

## 7. Slices (continuing v2's S1–S4)

5. **T1 — style and progression.** §6.1 (catalog attributes + classification), §6.2, §6.7. No technique yet.
6. **T2 — the technique model.** §6.3, §6.4, §6.9: plan field, legs, prescription, every reader in the §6.4 table,
   the `PARTIALS_BEST` record.
7. **T3 — the planner and the challenge.** §6.5 rules 1–7, §6.6, evaluator output, proposal lines, the stall rule.
8. **T4 — AI refinement.** The port, the merger, the switch.
9. **The Boop slice** (v2's S4, now larger): builder, weekly review, and the player's technique and challenge
   moments — coordinated with the B5 session, which owns the player.

T1 can ship before v2's S3; T2–T4 need v2's S3 (the proposal).

## 8. Codebase terrain (recon, investigator)

**Affected:** `feature/train` only for writes; readers of logged sets elsewhere: `feature/character/detector`
(`RirCalibrationDetector`, `ProgressionAdherenceDetector`), `feature/companion` (adapter),
`feature/proactive` (`OverloadChallengeGenerator`).

**Today**

- `exercise_set`: weight, reps, rir, side, note, skipped, `kind` (`warmup|working`, DB CHECK), target snapshot. No
  technique, no children. `kind` immutable on update; `deleteSet` renumbers `setIndex` gap-free because the web
  cursor is positional.
- `exercise`: `warmup_sets`, `working_sets`, `rep_min`, `rep_max`, `target_rir`, `anchor_weight_kg`, `type`,
  `counts_toward_volume`. `exercise_catalog`: slug, name, muscle, type, stim, fatigue, media — **no equipment,
  stability or failure-safety attribute**.
- Load: `SetRecommendationService.prescribe` → reference = top working set of the most recent completed instance of
  the identity → `ProgressionDecider.decide` (deload ×0.9; top of range → next real weight near +2.5 % compound /
  +5 % isolation, taken if ≤ 10 %, else +1 rep past the top up to +3; reserve slack ≥ 2 → one step further; in
  range → +1 rep or hold on a grind; below range → down or hold). **Every working set of an exercise gets the same
  target.** Identity = catalog id, else exact name. No same-muscle awareness. Twice a week = one shared history,
  judged against the current row's range.
- Target RIR is a stored per-exercise value; it does not change across phases. "Failure" today = RIR 0 (the web
  pill). The **closing block** (`mezo-z2ul`) is extra not-counting exercises, off since 2026-11-02 — not a set
  technique.
- Players: web `workoutState.ts` keys sets positionally; rest 150 s / 90 s by type in the client; `FeedbackModal`
  (pump, joint pain, workload) after an exercise's last set — the finisher's slot. B5: the same shape
  (`WorkoutSession`, `.debrief`), `SetKind(wire:)` falls back to `.working` for unknown kinds.
- AI: `MesoPlanLlm` only picks catalog ids into fixed frames, validated by `MesoPlanMerger`; rep range, RIR and
  warmups are stamped in `MesoPlanGeneratorService.toExercise` from `MesoPlanProperties` — the seam the style table
  replaces.
- Records: `OneRepMax.eligible` (working, not skipped, weight > 0, reps 1–12); `MedalEvaluator` replays.

**Key files:** `entity/{ExerciseSetEntity,ExerciseEntity,ExerciseCatalogEntity}.java`,
`entity/json/GymExerciseJson.java`, `service/{WorkoutService,SetRecommendationService,ProgressionDecider,
ExerciseHistoryResolver,WeightSnapper,WeightGapService,VolumeProgressionService,MesoPlanGeneratorService,
MesoPlanLlm,MesoPlanFiller,OneRepMax,E1rmSeries,MedalEvaluator,ExerciseRecordService,ClosingBlockService}.java`,
`config/{HypertrophyProperties,MesoPlanProperties}.java`, `train.yml` (`SetLogRequest`, `SetUpdateRequest`,
`ExerciseSetResponse`, `PrescribedSet`, `GymExerciseInput`, `TodayExercise`, `ExerciseCatalogItem`), the
`ck_exercise_set_kind` changeset.

**Traps**

- ADR 0027: a new exercise field must reach `GymExerciseJson`, `TrainService.toExerciseEntity`, the rerun
  materialisation, `WorkoutExerciseChangeService`, and the FE mock.
- Warmup exclusion is single-homed in `OneRepMax.eligible` and the `kind='working'` queries — the reason approach B
  is rejected.
- A day edit re-mints exercise UUIDs; history is by identity.
- `getToday` writes; prescription reads completed instances only.
- Swift models mirror the wire by hand; an old build must degrade to "a normal set" (it does: unknown fields are
  ignored, and `techniques_enabled` keeps such builds out).
- Gates as in v2 §7.

**Tests pinning today's load behaviour:** `ProgressionDeciderTest` (24), `WeightSnapperTest`,
`SetRecommendationServiceIT` (20), `WorkoutTodayProgressionIT`, `WorkoutTodayPrescriptionIT`, `WorkoutWeightGapIT`,
`WarmupExclusionIT`; records: `OneRepMaxTest`, `E1rmSeriesTest`, `MedalEvaluatorTest`, `ExerciseRecordServiceIT`.

## 9. Prior art (recon, researcher)

Verification level as the researcher reported it: **read** = page opened this session; **recalled** = from memory,
to be checked before a number is hard-coded.

| Pattern | Source | Taken? |
|---|---|---|
| Techniques as time-savers on stable isolation work, last set only, 1–2 per session; excluded on squats, deadlifts, spinally loaded lifts (read) | RP Strength — https://rpstrength.com/blogs/articles/intensity-techniques-for-maximum-mass | **Yes** — eligibility, last set, allowance. RP's "only in later mesocycles" becomes "from week 3". |
| Drop sets: no advantage when volume is equated, similar result in about half the time, more exertion (read via a Stronger by Science summary of Coleman 2022 / Sødal 2023) | — | **Yes** — a technique set counts as one set; its cost goes to the cap. |
| Myo-reps matched traditional sets in less time; mini-sets ~3 reps, 20–40 s rest (read, free portion) | https://biolayne.com/reps/issue-50/myo-reps-for-mass/ | **Yes** — the `myo` shape. |
| Post-failure lengthened partials: +9.6 % vs +6.7 % calf thickness, untrained men (read) | Larsen et al. 2025 — https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1494323/full | **Yes**, as the challenge, limited to `lengthened_friendly` stable exercises. Trained-lifter evidence is weaker (recalled) — hence a challenge, not a growth claim. |
| Proximity to failure helps hypertrophy, curve uncertain; ranges 5–30 similar near failure (search summary + recalled) | Robinson 2024 — https://www.fau.edu/newsdesk/articles/muscle-growth-strength-study | **Yes** — styles are preference, the effort ramp is modest. |
| Double progression keyed to the first set; ~4 % load per rep out of range (read); more reps when the next jump is too big (search summary) | https://rippedbody.com/progression/ , https://alphaprogression.com/en/blog/intensity-techniques | **Partly** — the app's existing rule already does this from the top set; kept, with an explicit overshoot threshold. |
| Auto-scheduling of techniques | none of the apps found | We go further, behind the owner's weekly approval. |

Disagreements kept visible: drop size 10 % (RP) / 20 % (SBS) / 20–30 % (Alpha Progression) — ours is config, 20 %
for `drop`, 30 % with a 30 s rest for the owner's `rest_drop`; myo rest "3–5 breaths" vs 20–40 s — ours 20 s,
config. No source gives a volume-credit standard for technique sets.

## 10. Left to the builder

- The classification list itself (§6.1) — to be reviewed by the owner as a table before it lands.
- The exact thirds of the effort ramp for blocks of 4, 5, 6, 8 weeks.
- Java names, the `overrides` representation on the exercise row.
- Whether `TechniquePlanner` output is cached per week or recomputed.

## 11. Builder-check resolutions (2026-11-17) — these amend the text above where they differ

An independent read against the code raised six questions and nine factual corrections. The corrections are folded
in above (`trainingStyle`, the catalog JSON, the overshoot config, the wire fields) or listed here; the six
questions are settled as the author's calls, flagged to the owner in the hand-over.

**Questions**

1. **"Két sorozat bukásig" and the bands.** An all-out exercise has **2 sets, and the weekly proposal never adds
   sets to it** — in this style progress is load, not volume. A muscle whose exercises are all-out is judged against
   a **halved band** (`mezo.volume.bands.allout-factor: 0.5` on `low` and `high`), because the evidence says one or
   two all-out sets capture most of the effect of several. Sets stay an overridable field like the rest.
2. **A technique on an exercise already at a cap.** Techniques are time-savers, so the planner's line **replaces one
   straight set**: sets − 1, plus the technique on the new last set. If the exercise has a single set, or the swap
   still breaks a cap, the exercise is not eligible that week.
3. **Who gets the progression changes.** The style table, the effort ramp and prescribed rest apply only to a block
   that **has a `trainingStyle`** (set by the Boop builder). A block without one — every web-built block, the run in
   flight at deploy, generated web plans with their own `MesoPlanProperties` — is prescribed exactly as today. The
   one change everyone gets is the rep-range-aware reference (§6.7.1), which is a bug fix.
   The grind signal: it is judged against the **effective** (ramped) target; when that target is 0–1 a reserve can
   no longer show a grind, so there it is "logged reps at least 2 below the prescribed reps". v2 §6.4 keeps its
   signal late in the block.
4. **Owner picks.** His technique runs in **every loading week, including 1–2**, and not in the deload. The server
   **rejects** a technique (and a challenge) on an exercise that is not `stable` — from any source, on template
   save and on the mid-run PUT — and `partials` on one that is not `lengthened_friendly`. He can mark his own
   exercise stable; the master rows are classified once. (§2's "at least warn" is superseded.)
5. **The stall rule.** "Moved" = the **logged** top set improved in reps or weight against the previous week. The
   range change moves the exercise one step along *Nagyobb súly ↔ Kiegyensúlyozott ↔ Sok ismétlés*, away from where
   it stalled (a heavy exercise goes lighter, a high-rep one heavier; from the middle, towards higher reps). It is
   its own line kind, `rep_range` (`from`/`to` = the ranges). The one-week reduction is restored afterwards exactly
   like v2's deload, and is never offered for a Tartás muscle (v2: no set line there) — Tartás gets only the
   technique and range options.
6. **Challenge and technique on one exercise.** The challenge wins: that exercise carries `partials` as the
   challenge and no other technique; the planner looks for its technique slot elsewhere in the day or leaves it
   empty. The challenge weighs 2 against the caps like any technique, is counted **first**, and is never the thing
   removed to satisfy a cap.

**Corrections not visible above**

- **Range snapshot.** `exercise_set` snapshots only target weight and reps today; it gains `target_rep_min` /
  `target_rep_max` so §6.7.1 can match on the range a set was trained in. History without it falls back to the
  exercise row's current range.
- **`SetUpdateRequest` is a full replacement** where an absent field clears. For `legs` an **absent** value means
  untouched (an explicit empty list clears) — otherwise any web edit of a set would wipe its legs.
- **Web saves replace the template document** and re-mint exercise ids. `MesoTemplateService.applyUpsert` therefore
  **carries over** the new optional fields (training style, rest, overrides, technique, challenge) from the stored
  exercise with the same catalog id (else name) on the same day when the request omits them.
- **The evaluator is read-only, not stateless.** Sport days come from the owner's sport schedule (`dayOfWeek`
  against the plan day's weekday label) and the deficit from the goal port, so `POST …/evaluate` reads per-user
  state; it still writes nothing.
- **Dependencies.** Nothing of v2 is built yet; T2–T4 need all of v2 S1–S3, T1 needs v2 S1.
