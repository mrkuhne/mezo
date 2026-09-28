# Arányos progressziós lépcső — design (mezo-bk7sn)

Date: 2026-09-28 · Status: owner-approved design (brainstorm 2026-09-28) · Driving issue: `mezo-bk7sn`

## 1. Problem

`ProgressionDecider.decide` adds a **fixed** increment at the top of the rep range
(`mezo.hypertrophy.increment`: compound 5.0, isolation 2.5, default 2.5). The step is not
proportional to the load and the RIR reserve never scales it.

Production evidence (SELECT only, working sets 2026-09-15 → 09-25, 236 non-plyo working sets):

- Every exercise carries a type (compound / isolation / plyo); the "untyped" fallback never fires.
- Working loads are mostly 5–60 kg (range 2.5–95 kg). The fixed step produced +20–40 % jumps:
  lateral raise 8 → 10 (+25 %), cable curl 12.5 → 15 (+20 %), one-arm cable row 12.5 → 17.5
  (+40 %, compound = +5), lat pulldown 45 → 55 (+22 %), Smith squat / OHP 50 → 55 (+10 %).
- The owner mostly **did not take** those jumps (stayed at 8 / 12 / 39–47 / 50 kg); where he did
  (pushdown 15 → 21.5, machine lateral 23 → 36) the rep target was missed.
- RIR is logged on 92 % of working sets; a reserve ≥ target + 2 occurred on only 5 / 236 sets —
  the reserve bonus is a rare safety valve, not the main driver.
- `exercise_weight_gap` holds 2 rows total — the machine ladders are mostly unknown.

## 2. Owner decisions (2026-09-28)

1. **Reps before load when the next real weight is too far** (RP / Alpha Progression pattern).
2. **Jump cap ≈ 10 %** of the reference weight; beyond it, allow up to **+3 reps above the range
   top** before forcing the jump.
3. **Big reserve (RIR ≥ target + 2) at the range top → one step further**, cap raised to **15 %**.

## 3. Design

### 3.1 Available weights (per exercise identity)

`available = (weights ever logged on the identity ∪ plate-grid multiples of plate-step) − known gaps`
(`ExerciseHistoryResolver.workingWeightsEverLogged`, `WeightGapService.gaps`, `plate-step` 2.5).
No per-machine ladder is stored; this is the best knowledge the system has, and the gap memory
(mezo-bk7l2) keeps correcting it.

### 3.2 Up branch — reference reps ≥ repMax

Let `w` = reference weight, `p` = step percent of the type (compound **2.5 %**, isolation **5 %**,
default 5 %), `slack = rir − targetRir` (null RIR → 0).

1. **Normal candidate** `c1` = the available weight `> w` nearest to `w × (1 + p)` (ties → heavier).
   This is always at least one real step above `w`.
2. **Reserve:** if `slack ≥ 2`, the candidate is `c2` = the next available weight above `c1`, and
   the cap is 15 %; otherwise the candidate is `c1` and the cap is 10 %.
3. **Jump fits** (`(c − w) / w ≤ cap`) → lever **WEIGHT**, `base = c`, reps = equal-effort reps
   (§3.4) clamped to `[repMin, repMax]`.
4. **Jump too big** and `rp < repMax + 3` → lever **REP**, `base = w`, reps = `rp + 1`
   (above the range top is allowed, up to `repMax + 3`).
5. **Jump too big** and `rp ≥ repMax + 3` → forced **WEIGHT** to `c`, reps = equal-effort reps
   clamped to `[max(1, repMin − 3), repMax]`.

`deltaKg = base − w` uniformly (today the WEIGHT lever reports the raw increment even off-grid).

### 3.3 Down branch — reference reps < repMin and slack ≤ 0

1. Candidate `d` = the available weight `< w` nearest to `w × (1 − p)` (ties → lighter).
2. If `(w − d) / w > 10 %` and `rp ≥ repMin − 3` → the weight stays and reps are built from below:
   `slack == 0` → **REP**, reps `rp + 1`; `slack < 0` → **HOLD**, reps `rp`. This breaks the
   8 ↔ 10 kg oscillation a forced jump would otherwise cause.
3. Otherwise → **WEIGHT** down to `d`, reps = equal-effort reps clamped to `[repMin, repMax]`.

`rp < repMin` with `slack > 0` stays **HOLD**, target repMin (unchanged).

### 3.4 Equal-effort reps

Epley both ways, the reference RIR in, the target RIR out:
`e1rm = w × (1 + (rp + rir) / 30)`, `reps = round(30 × (e1rm / base − 1) − targetRir)`, min 1.
(No 20 % swing guard here — the caller clamps; `WeightSnapper.equivalentReps` stays as is.)

### 3.5 Unchanged

In-range (`repMin ≤ rp < repMax`): HOLD on grind, else +1 rep. Deload (0.9 × w, plate-rounded,
reactive gap snap). Readiness `capAtHold` — a REP lever (including the new above-range REP) is an
upward move and is capped. Weightless/plyo, first session and anchor paths. `WeightSnapper`
reactive snap stays wired for DELOAD (WEIGHT candidates already exclude gaps, so it no-ops there).
`WeightGapService` near-swap learning keeps the per-type `increment` as its threshold — the
`increment` map stays in config for that sole use.

### 3.6 Rationale strings (HU, shown verbatim on the card, banner and overload quest `why`)

| Case | Text |
|---|---|
| WEIGHT up | `Múlt hét 10×60 kg a tartomány tetején → +2,5 kg (+4%)` |
| WEIGHT up, reserve | `Múlt hét 10×60 kg, RIR 3 — sok tartalék → +5 kg (+8%)` |
| REP extension | `A 10 kg +25% ugrás lenne → előbb 13 ismétlés 8 kg-mal` |
| forced jump | `15 ismétlés 8 kg-mal megvan → 10 kg (+25%)` |
| WEIGHT down | `Múlt hét 6 rep a cél alatt, grind → −2,5 kg` |
| build from below | `A 7,5 kg −25% lenne → maradunk, 8 ismétlés a cél` |

Decimal comma in kg (`strip` + HU formatting), percent rounded to an integer.

### 3.7 Config (`mezo.hypertrophy`, `HypertrophyProperties`, `@Validated`)

```yaml
step-percent: { compound: 0.025, isolation: 0.05 }
default-step-percent: 0.05
max-jump: 0.10
max-jump-reserve: 0.15
reserve-slack: 2
rep-overflow: 3
```

### 3.8 Worked examples (owner's real exercises)

| Exercise (range) | Reference | Today | New |
|---|---|---|---|
| Machine chest press (6–10) | 60 × 10 @1 | 65 × 6 | **62.5 × 8** |
| Smith squat (4–6) | 50 × 7 @1 | 55 × 4 | **52.5 × 5** |
| Lateral raise (10–12) | 8 × 12 @1 | 10 × 10 | **8 × 13** (then 14, 15, then 10 × 7) |
| One-arm cable row (10–15, compound) | 12.5 × 15 @1 | 17.5 × 10 | **12.5 × 16** |
| Chest press, big reserve | 60 × 10 @3 | 65 × 6 | **65 × 9** |

## 4. What the owner sees

No new control or screen. Different target numbers on the set card, in the Eligazítás goal row
and the progression chip (`↑ +2,5 kg`), a REP chip for above-range reps, and the new rationale
texts. The Túlterhelés quest picks from the new signals (it ranks WEIGHT by absolute kg, else REP).
The mesocycle report is **not** affected (it computes e1RM from logged sets, not from the decider).

## 5. Prior art

- **RP Hypertrophy app** — adds "a few %" per week; if the next available increment is outside
  that, adds a rep instead (10 → 15 lb DB example). **Adopted**: reps-before-load.
  https://hypertrophy.zendesk.com/hc/en-us/articles/14605661323671
- **Alpha Progression** — equipment-aware recommendations, never "a load that does not exist";
  extra reps at 7.5 kg before a +33 % lateral-raise jump; reps may exceed the planned target.
  **Adopted**: real-weight candidates, above-range reps. **Rejected**: user-configured equipment
  ladders (no equipment field here; the gap memory learns instead).
  https://alphaprogression.com/en/blog/alpha-progression-guide
- **Helms et al. 2018** — 2 % load per 0.5 RPE off target (≈ 4 % per RIR). **Adopted in simplified
  form**: one extra real step + 15 % cap at slack ≥ 2 (reserve is rare in the owner's data).
  https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2018.00247/full
- **APRE / Stronger by Science** — graded jumps by overshoot. Confirms the two-level jump.
  https://www.strongerbyscience.com/weekly-load-progression/
- **Plotkin, Schoenfeld et al. 2022** — rep progression ≈ load progression for hypertrophy.
  Justifies the rep fallback. https://peerj.com/articles/14142/

## 6. Codebase terrain

- Engine: `feature/train/service/ProgressionDecider.java` (pure static; `decide`, `capAtHold`,
  private `round`) — the new logic goes here, taking the available-weight set and the new config
  as parameters (pure, unit-tested; `decide_shouldX_whenY`).
- Only caller: `SetRecommendationService.prescribe` (lines ~54–100): builds `inc`, calls `decide`,
  then the reactive gap snap. It must now pass `available` (used ∪ grid − gaps are resolved inside
  the decider from `used`, `gaps`, `plateStep`).
- `WeightSnapper` (reactive, DELOAD only in practice), `WeightGapService.onLogged:43` (keeps `increment`).
- `HypertrophyProperties` + `application.yml:~2972` + `HypertrophyPropertiesIT`.
- `WorkoutService.java:289-292` comment — "WEIGHT deltaKg is non-zero" still holds (candidates are
  strictly above/below `w`); `overloadSummary` tallies unchanged.
- Downstream: `OverloadChallengeGenerator` (no change), FE `progressionChip.ts` (renders deltaKg
  verbatim), `WorkoutBriefing`, `WorkoutCard`. No contract change; no FE logic mirror; mock
  fixtures `data/train/train.ts` get realistic rationale strings.
- Tests that hard-code +5/+2.5 must be updated: `ProgressionDeciderTest`, `SetRecommendationServiceIT`,
  `WorkoutTodayProgressionIT`, `WorkoutWeightGapIT`, `OverloadChallengeGeneratorIT`, `HypertrophyPropertiesIT`.
- Traps: HALF_UP rounding can erase a small % step (solved: candidates are real weights strictly
  beyond `w`); the reference set is the top set of the last completed session (resume-stable).
- Docs: `docs/features/train.md` §4 "Set recommendation engine".

## 7. Out of scope

Per-machine equipment ladders, an in-range +2-rep reserve bonus, changing the overload quest
ranking, the FE weight stepper (`SetEditSheet` step 2.5).
