# Karakter — MINDENT be, 2. kör: Fuel & ciklus (mezo-1gim.15, round 2)

**Date:** 2026-09-01 · **Driving bd:** mezo-1gim.15 (epic mezo-1gim) · **Status:** approved by Daniel

The second MINDENT-be round widens the Karakter detector pipeline into the fuel-and-medication
domain. The Gépterem inventory's round 2 ("Fuel & ciklus") is the contract: its four rows become
real reads and real detectors, plus three bonus detectors that fall out of the same entity reads
(the round-1 precedent — Daniel again asked for more than the inventory minimum). Everything
stays inside the epic's honesty frame: code detects, the LLM expert interprets.

Daniel's explicit standard for this round: **"nem az a lényeg, hogy minél kevesebb munka legyen,
hanem hogy pontosak legyünk."** Where the accurate read costs a new repository finder, a new
cross-feature edge or an extra query, we pay it.

## 1. Scope

**In:** the four round-2 inventory rows wired for real, as seven detectors plus the read widening
that feeds them. **Out:** rounds 3–4, the remaining spec §5 detectors (mezo-1gim.12), any contract
(OpenAPI) change, any new persistence, any new endpoint, meal free-text/notes mining (no LLM-side
text work inside a detector), and any new rir-trend clause on the round-1 detectors. (Round 1's
`TrendWindow.gymEightWeeks` was gathered but unread; round 2 does not add a rir-trend clause, but it
does become the field's first real consumer — see §4.)

## 2. Prior art

The `researcher` recon returned four load-bearing external patterns; two were adopted, two
informed framing only.

- **Adopted — NOVA-4 *kcal share* as the deterministic diet-quality proxy.** Nutrition
  epidemiology quantifies diet quality as the caloric share of each NOVA group computed from food
  logs, and correlates it against standardized mood/stress scores; the signal is *percent of daily
  kcal from NOVA-4 foods* measured against the person's own baseline, not raw item counts
  (https://pmc.ncbi.nlm.nih.gov/articles/PMC11547796/). `comfort-eating` computes exactly this,
  with a per-day coverage gate so a partly-unclassified day cannot fake a share.
- **Adopted — within-person (EMA-style) covariance, not population thresholds.** Emotional-eating
  research models the pattern per individual as elevated negative affect co-occurring with
  high-calorie intake, with temporal ordering (mood → intake) as the signature
  (https://www.sciencedirect.com/science/article/abs/pii/S0195666323000296). Our detector therefore
  compares each day against the user's own rolling baseline and requires a minimum number of days
  where BOTH a check-in and a meal log exist; it emits "N napon megfigyelt együttjárás", never a
  diagnosis.
- **Adopted — day-since-dose bucketing for the medication cycle.** GLP-1 trackers (Shotsy, Glapp)
  place doses and symptoms on one timeline and read patterns as "symptoms cluster in the days
  after an injection", explicitly framing the cycle as "context, not a measurement", never
  diagnosis or dosing advice (https://shotsyapp.com/glp-1-tracker/, https://glapp.io/).
  `med-cycle-covariance` buckets check-in scales by cycle day against the cycle mean and adopts
  the framing discipline verbatim — descriptive numbers only.
- **Framing only — neutral, non-judgemental language for sensitive readouts.** A design study on
  AI wellbeing reflection found neutral phrasing lowers the barrier to engaging with discouraging
  data (https://arxiv.org/pdf/2601.14589). This reinforces existing house rules (Doki's persona
  already mandates mirror/question phrasing for sensitive topics, Táplálkozó's mandates
  "ítélkezésmentes"), so it changes prose discipline, not code.
- **Rejected — hydration streak gamification.** The hydration prior art is thin and
  product-blog-grade (https://www.easyhabits.io/blog/water-intake-tracking); the analytically
  useful half is the on-target day rate plus intake variability. Streaks/badges stay out —
  the dossier is not a habit game.

## 3. Codebase terrain

The `investigator` recon mapped the terrain; every field below was then verified directly in code.

**Affected features:** `character` (BE detector package + `CharacterSignalReads`, FE
`features/character` + `data/character`), and read-only into `meal`, `nutrition`, `fuel`,
`pantry`, `medication`, `biometrics/checkin`, `goal`.

**Sources (verified fields):**

| Source | Entity | Fields used |
|---|---|---|
| Étkezés | `MealEntity` | `mealDate`, `loggedAt`, `slot` (breakfast\|lunch\|dinner\|snack), `items` |
| Étel-sorok | `MealItemEntity` | `snapshotKcal`, `snapshotProteinG`, `snapshotCarbsG`, `snapshotFatG`, **`snapshotNova` (Short, nullable)** |
| Makró-célok | `GoalPrescriptionJson.Segment` + `NutritionTargetsProperties` | goal-week segment `kcal`+`proteinG`, else config `kcal/p/c/f/water` |
| Víz | `WaterLogEntity` | `logDate`, `amountMl` |
| Stack-terv | `ProtocolEntity` (status `active`) + `ProtocolItemEntity` | `pantryItemId`, `slotKey`, `restDayFallback` |
| Stack-nevek | `PantryItemEntity` | `name` (readable summaries instead of UUIDs) |
| Stack-bevitel | `SupplementIntakeEntity` | `pantryItemId`, `takenDate`, `slotKey` |
| Gyógyszer | `MedicationEntity` (active) + `MedicationDoseEntity` | `cycle` (`cycleLengthDays`, `phases[]`), `administeredDate` |
| Check-in | `CheckInEntity` | `date`, `slotTime`, `energy`, `stress`, `body`, `mental` (1–10, nullable) |

**Patterns to follow:** all reads land in `CharacterSignalReads.gather()` (the single cross-feature
read composer, `ContextSnapshotAssembler` precedent), never inside a detector; `DetectorInput` grows
typed nested records where a nullable field means "no data", never zero; detectors are `@Component`
+ `@ConditionalOnProperty(CHARACTER_SWITCH)` beans auto-discovered by `DetectorRegistry` with a
per-key kill switch `mezo.character.detector.<key>.enabled`; Hungarian summaries use the decimal
comma idiom; IT populators already exist for every new source (`MealPopulator`, `WaterLogPopulator`,
`SupplementIntakePopulator`, `MedicationPopulator`, `MedicationDosePopulator`, `CheckInPopulator`).

**Known traps:** never map a bare `List<String>` with `SqlTypes.JSON` (registry leak — wrapper
records only); `ArchitectureTest` is not in the focused `-Dtest=*Character*` sweep and must be named
explicitly; CODEMAP must be regenerated in the same change; focused character ITs need
`-Dmezo.test.use-testcontainers=true`; FE tests must run in both modes.

**Staleness found:** `MealEntity`'s javadoc still claims `breakdown` is "always NULL in v1", which
its own line 77 and the shipped `MealScoringService` contradict. Round 2 does not depend on
`breakdown` (see §4), but the stale sentence is corrected in passing.

## 4. Architecture — read layer

`CharacterSignalReads` keeps the round-1 **two-window** shape, and round 2 obeys the promise made
during the brainstorm: **the 8-week window carries raw per-day rows, never pre-aggregated weekly
means.** A day is the atomic unit for every round-2 signal, and the detector does its own bucketing
— which is what lets a cycle-aligned analysis (dose-anchored, not calendar-anchored) run correctly
out of a plain date-ordered window.

- **8-week raw series** (`TrendWindow`): meal days with per-meal detail, water days, stack days,
  check-in days and medication-cycle days, one record per day.
- **No separate 14-day copy for round-2 sources.** Every round-2 detector needs to evaluate its own
  state twice — as of `day` and as of `day − 1` (see §6) — and each evaluation needs a full trailing
  14-day window, so the detectors window the 8-week series internally by an `asOf` parameter. A
  duplicated 14-day field would be dead weight that could only ever disagree with its own source.
  The existing 14-day round-1 fields (`mealDates` included) keep their present meaning untouched.

A welcome consequence: `protein-training-mismatch` and `stack-skip-pattern` need gym days as of two
different dates, so they become the **first consumers of `TrendWindow.gymEightWeeks`** — the one
deliberate leftover round 1 documented ("gathered but unread"). Round 2 closes it.

Every read stays bounded above by the observed `day` (catch-up honesty): via the finder's upper
bound where one exists, otherwise by an in-memory filter, exactly as the round-1 weight read does.

### 4.1 New reads and finders

- **Meals.** New join-fetch range finder on `MealRepository`
  (`findWithItemsBetween(createdBy, from, to)` — `select distinct m from MealEntity m left join
  fetch m.items where … and m.mealDate between … order by m.mealDate asc, m.loggedAt asc`). This
  replaces the current per-day presence loop as the source of `mealDates` too: one query instead of
  fourteen, and no N+1 over items. `mealDates` keeps its exact present meaning (days with ≥1 meal).
- **NOVA share** is computed from the **line level** (`MealItemEntity.snapshotNova` weighted by
  `snapshotKcal`), not from `MealBreakdownJson.NovaDetail.dominant`. Reason: the line snapshots are
  written for every logged line, while `breakdown` can be NULL on legacy/manual meals, and a
  meal-level "dominant" class discards the mix. Each day carries both `nova4KcalShare` and
  `novaCoveragePct` (share of the day's kcal that actually has a NOVA class); the share is **null**
  when coverage < 70 %, so a half-classified day cannot fake a number.
- **Macro targets.** New read of the active goal (`GoalRepository.findByCreatedByAndStatusAndDeletedFalse`)
  plus `GoalPrescriptionJson.currentSegment(prescription, week)`, mirroring `FuelDayService`'s
  precedence exactly: goal-week segment prescribes kcal + protein; carbs, fat and water always come
  from `NutritionTargetsProperties`. Reproducing the real precedence is the accurate choice; a
  config-only shortcut would silently mis-score every day of an active cut.
- **Water.** New grouped range query on `WaterLogRepository`
  (`select w.logDate, sum(w.amountMl) … group by w.logDate`) — one query for the whole window
  instead of 56 `sumAmountForDay` calls.
- **Stack.** Active protocol + its items (existing finders), and intakes via the existing
  `findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc`, which
  bounds only below — so the read filters `takenDate ≤ day` in memory (round-1 weight precedent).
- **Check-ins.** The existing per-day loop is replaced by
  `findByCreatedByAndDeletedFalseAndDateBetween` over the 8-week window; `checkinCounts` keeps its
  current semantics (an entry for every day in the 14-day window, zero included) and the new
  per-day scale aggregates come from the same rows.
- **Medication cycle.** `MedicationCycleService` is **injected and reused per day** rather than
  reimplemented — the cycle-day formula must have exactly one home. `derive(userId, med, date)`
  already queries the latest dose at-or-before its date, so it is catch-up-safe by construction.

### 4.2 New `DetectorInput` records

```
MealDayPoint(date, kcal, proteinG, carbsG, fatG, nova4KcalShare, novaCoveragePct,
             kcalTarget, proteinTarget, meals List<MealPoint>)
MealPoint(slot, loggedAtLocalTime, kcal, nova)        // local time per the house LocalDate.now() zone
WaterDayPoint(date, amountMl, targetMl)               // absent day = no log, never 0
StackContext(items List<StackItem>, days List<StackDayPoint>)
StackItem(pantryItemId, name, slotKey, restDayFallback)
StackDayPoint(date, takenPantryItemIds Set<UUID>)
CheckinDayPoint(date, count, energy, stress, body, mental)  // per-day means of the logged slots
MedCycleDayPoint(date, cycleDay, phaseKey, daysSinceDose, stale boolean)
MedContext(cycleLengthDays, days List<MedCycleDayPoint>)
```

`MealPoint.loggedAtLocalTime` converts the meal's `loggedAt` `Instant` with the JVM default zone —
the same convention the character jobs already use when they take `LocalDate.now()`; the day
boundary and the meal's own `mealDate` come from the same clock, so no second time authority is
introduced. `StackItem.name` comes from `PantryItemRepository`, which makes a readable summary
possible ("Kreatin 3 napon maradt ki") instead of a UUID.

`MedCycleDay.stale` is the round's precision guard: `MedicationCycleService` deliberately CLAMPS a
cycle day when the last dose is older than one full cycle (a product decision for the Fuel UI). For
covariance that clamp would pile weeks of no-dose days into the last bucket, so the read marks
`stale = daysSinceDose + 1 > cycleLengthDays` and the detector drops those days. This is the one
place where the character read layer deliberately reads *more* than the source service exposes.

### 4.3 Stack "kihagyás" semantics

There is no skip row — a skip is derived, and the derivation must respect the product's own rest-day
rule (FE precedent `features/fuel/logic/projectStackDay.ts`): an item placed in a peri-workout zone
(`pre_workout` / `post_workout`) on a day with no training is **not** a miss — it either displaces
to its `restDayFallback` zone or is deliberately skipped. So:

- an item is **expected** on a day if its `slotKey` is not peri-workout, **or** the day has a
  completed gym session (round 1's `gymDays` — a genuine cross-round reuse);
- it is **taken** if an intake row exists that day for its `pantryItemId` (slot-agnostic, matching
  the FE's legacy-intake tolerance);
- a day with no active protocol contributes nothing (absent, not zero).

## 5. The seven detectors

All pure-code `CharacterDetector` implementations emitting
`DetectorSignal(detectorKey, expertKey, summary, salience)` with every number computed in code.
Exact thresholds are fixed in the plan and pinned by tests.

| Key | Expert | Fires when (sketch) |
|---|---|---|
| `comfort-eating` | taplalkozo | on days with both a check-in and adequate NOVA coverage, high-NOVA-4 / kcal-spike days co-occur with low mood (high `stress` or low `mental`/`energy`) above the user's own 8-week baseline, over a minimum number of paired days |
| `macro-adherence` | taplalkozo | kcal or protein systematically under/overshoots the day's real target (goal segment → config), direction + magnitude |
| `hydration-consistency` | taplalkozo | the on-target day rate (vs the 4000 ml config target) changes band, or intake variability is high while the mean looks fine |
| `protein-training-mismatch` | taplalkozo | protein target is missed specifically on gym days at a materially higher rate than on rest days |
| `late-eating-pattern` | szomnologus | late-evening meals (by `loggedAt` local time) repeat and pair with worse sleep quality that night |
| `stack-skip-pattern` | drill | derived skips cluster on the same supplement/slot, rest-day-fallback items excluded |
| `med-cycle-covariance` | doki (**ÉRZÉKENY**) | check-in scales bucketed by cycle day differ materially from the cycle mean, over enough non-stale complete cycles |

**Expert routing rationale.** Táplálkozó's watch list already names "étkezési minták", "kajához való
viszony" and "logolt vs valós bevitel eltérése" — all four nutrition detectors are hers, and the
nutrition dimension is where those claims belong. Late eating is a rhythm signal, which is
Szomnológus's "alvásminőség és -ritmus". Derived skips are Drill's "logolási fegyelem, kihagyások".
The medication cycle is Doki's — his persona already mandates "sosem diagnosztizálsz… érzékeny témát
tükörként, kérdésként".

**Sensitivity.** Sensitivity lives at claim level (`CharacterClaimEntity.sensitive`), and the
konzílium proposal prompt already instructs `sensitive=true` for gyógyszerciklus topics; the portrait
writer and the prompt assembler render the ÉRZÉKENY marker, and the FE claim tile shows the
lavender-dot frame. Per Daniel's decision, `med-cycle-covariance` is a full citizen: its claims reach
the `[Karakter]` prompt block **with** the ÉRZÉKENY marker. Because there is no code-level gate, the
detector's own summary text must already be neutral and descriptive ("a ciklus 5–6. napján az energia
átlaga 1,2 ponttal alacsonyabb"), never advisory, never a dosing or treatment statement.

## 6. Overfiring protection

Round 1's stateless change-gating (spec §5 of the round-1 design) carries over, but round 2 inverts
which half of it does the work — a finding from the design pass worth stating plainly:

**Round 1's sources are episodic; round 2's are daily.** A gym session or a run happens two or three
times a week, so "new data for this source arrived today" was a genuinely selective gate. Meals,
water, check-ins and supplement intakes arrive *every single day*, so that same gate is nearly
always open. Left alone it would re-announce an unchanged 14-day pattern nightly — precisely the
overfiring the round-1 spec set out to prevent. Therefore, for round 2:

- **The state-change gate is primary, and every detector has one.** Each detector exposes its
  finding as a `String` state computed `asOf` a date (a band, a direction, a headline bucket, an
  offender key — null when it does not qualify). `detect()` computes the state as of `day` and as of
  `day − 1` and fires only when the state is non-null **and different** from yesterday's. Double
  computation, deterministic, no state and no table — the round-1 `hr-recovery-trend` gate,
  generalised from one detector to all seven.
- **The new-data gate stays as a cheap pre-filter.** `RoundOneGates` is renamed `DetectorGates`
  (same package-private, same pure-date-check nature) and gains `newMealData`, `newWaterData`,
  `newStackData`, `newCheckinData` and `newDoseData` beside the existing five.
- **Minimum-sample silence.** The covariance detectors (`comfort-eating`, `med-cycle-covariance`)
  additionally require a minimum number of paired days / complete cycles; below that they are silent
  rather than noisy, which is the honest reading of a thin sample.
- **One documented widening.** `stack-skip-pattern` also fires when the observed day itself carries
  a miss for the offending item even though the state string is unchanged — the deliberate,
  documented shape round 1 settled on for `meso-adherence`, so a second consecutive skipped day is
  not swallowed.

Because both evaluations need a full trailing 14-day window, this is what forces the round-2 series
into the 8-week window rather than a 14-day slice (§4).

## 7. Gépterem + FE

- `inventory.ts`: the round-2 object is **deleted from `INVENTORY_ROUNDS`**, and the wired sources
  join `INVENTORY_READS` with window chips ("14 nap" / "8 hét" / "aktív protokoll" / "aktív
  gyógyszer") — the file's own header contract.
- `DetektorokPage`: the seven new detectors listed with their true owners (verified against each
  detector's real `DetectorSignal` call, never guessed) and "mit néz / mikor tüzel" copy — 20 total.
- `characterMock.ts`: one `CHAIN_POOL` chain per new detector, spread across days as round 1 did,
  `code` paraphrasing the real backend summary strings, `refs: []`, `who` matching the real owner,
  counts derived from mock data.
- **No OpenAPI change** — detector keys are free strings in the signal envelope, and no endpoint
  changes, so the contract-drift gate stays quiet.

## 8. Testing

- Per-detector unit tests in `DetectorTest` on synthetic `DetectorInput`: fires / does not fire /
  quiet-when-no-new-data / band-change gate (`hydration-consistency`) / below-minimum-sample silence
  (`comfort-eating`, `med-cycle-covariance`) / rest-day-fallback exclusion (`stack-skip-pattern`) /
  stale-cycle-day exclusion (`med-cycle-covariance`) / NOVA coverage gate (`comfort-eating`).
- `CharacterSignalReadsIT` (Testcontainers): the widened gather against a real DB, extending the
  round-1 catch-up bound test so that post-`day` meals, water, intakes, check-ins and doses leak
  into **no** slice, trend window included; plus a no-active-protocol / no-active-medication test
  proving absent-not-zero.
- `ArchitectureTest` named explicitly in the focused sweep: `character → fuel`, `character →
  medication`, `character → nutrition`, `character → pantry` and `character → goal` are new one-way edges (nothing outside
  `feature/character` imports it), so they must be proven cycle-free before merge.
- FE tests in both modes for `inventory.ts`, `DetektorokPage` and the mock chains; `pnpm build`.
- CODEMAP regeneration + `lint-docs --errors-only` in the same change.

## 9. Ship

House flow: `feat/character-s11-fuel-ciklus` → self-PR → CI green → local `--no-ff` merge → push
main → `bd update`. `docs/features/character.md` §detector catalog (13 → 20) and the §9 ledger ride
in the same change. mezo-1gim.15 stays open for rounds 3–4.
