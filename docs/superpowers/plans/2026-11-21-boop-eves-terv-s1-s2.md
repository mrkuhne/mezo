# Boop Edzés — tervajánló S1 + S2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new training block can be started on the phone from 2–3 server-ranked, flawless split candidates, and every
block (new or running) shows rest-inclusive minutes, a per-muscle "why", a heavy-consecutive-day hint and a weekly
tier budget (max 2 Hangsúly).

**Architecture:** Pure server cores (`SplitCatalog`, `CandidateRanker`, `TierBudget`, minutes model v2 inside
`PlanEvaluator`) behind one new read-only endpoint (`POST /api/train/meso-plans/candidates`) and additive optional
fields on the existing generate / evaluate contract. The phone gets a hand-decoded client extension, one new model
(`NewBlockModel`) and the intake screens; after the pick it creates + starts the block and opens the **existing**
builder on it. S3 (year map) and S4 (following it) get their own plan after S2 ships.

**Tech Stack:** Spring Boot 4 / Java 21, OpenAPI contract-first, JUnit 5 + Testcontainers ITs; SwiftUI, BoopKit
(`BoopCore` + `BoopDesign` Napkelte), XCTest with `StubTransport`.

**Spec:** `docs/superpowers/specs/2026-11-20-boop-eves-terv-design.md` (owner OK 2026-11-20) · spike
`spike/boop-eves-terv` (`ios/Boop/EvesTervDemo/`, captures `docs/superpowers/specs/assets/eves-terv/`, owner OK
2026-11-21 „mehet akkor a builder”).

## Global Constraints

- Contract-first: edit `api/feature/train/train.yml` → `cd api/generate && npm run generate:api` → `ios/scripts/sync-openapi.sh`; never hand-write boundary DTOs.
- Every new contract field is **optional**; absent = today's behaviour. `split` absent → generate byte-identical. An **unstyled** plan's minutes stay byte-identical.
- Hard candidate filters (spec §5 S1.2): every trained group ≥ 2×/week; every day ≤ `sessionMinutesTarget`; no group with ≥ `consecutive-heavy-sets: 4` hard sets on two consecutive calendar days (core/mobility exempt).
- `emphasize-max: 2`; Tartás band floor `ceil(mev/3)` is never bypassed.
- New config keys: `mezo.volume.evaluator.set-seconds: 40`, `mezo.volume.evaluator.transition-minutes: 1`, `mezo.volume.bands.emphasize-max: 2`, `mezo.volume.bands.consecutive-heavy-sets: 4`, `mezo.meso-plan.splits` (catalogue below) — each in its `@Validated` properties record with a binding IT; no `@Value`.
- Candidates: deterministic skeleton + filler + style stamp only — **no LLM**. The LLM runs once, on generate with the chosen `split`.
- Phone: every number is the server's (minutes, bands, budget, ranks, raise costs); hand-decoded `PlanClient`/`PlanWire`, not the generated client; Hungarian copy; no emoji; never "Mezo"; smallest iPhone width; reduced motion.
- Muscle names on screen = the builder's existing names (`BlockDraft.longName`), not the spike's.
- ArchUnit: `@Service` in `service/`, config in `config/`, no class-level `@Transactional`; ITs with `-Dmezo.test.use-testcontainers=true`; regenerate `docs/CODEMAP.md` after every merge.
- **Collision:** Tasks 3–4 edit `PlanEvaluator`, `MesoPlanEvaluateService`, `MuscleEvaluation` — files `mezo-r36n9.114` plans to touch. Start Task 3 only after `.114` merged to main (rebase first) or with that session's written OK in a bd comment. Tasks 1–2 and 5 do not touch them.

## Review Focus

1. **2 training days, or days with a gap only at the weekend (e.g. Hét, Kedd, Szo, Vas):** the catalogue must still yield ≥ 1 candidate or a clean `nothingFits`; never a 500.
2. **A running block opened in the builder with no minutes chosen:** budget and `overTarget` must be null-safe (no target → no capacity, bar hidden), not a crash or a "0 / 0".
3. **Season gym days change while the intake is open / no active season:** the intake must show the existing season-needed state before any call, and a 409 `SEASON_REQUIRED` on start must land on the same copy.
4. **He abandons right after "Ezzel kezdem":** the just-created planned block must be closable from the builder ("Mégsem, eldobom") — no orphan planned block he cannot remove.
5. **Everything at Tartás / everything at Hangsúly request sent by a stale client:** server returns 400 `TRAIN_MESO_EMPHASIZE_CAP` for > 2 Hangsúly; all-Tartás still yields candidates.

Each line's test sits in the owning task (marked **[RF n]**).

---

### Task 1: Split catalogue + skeleton split key

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/MesoPlanProperties.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.meso-plan.splits`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SplitCatalog.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanSkeleton.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/SplitCatalogTest.java`, `MesoPlanSkeletonTest.java`, `MesoPlanPropertiesBindingIT.java`

**Interfaces:**
- Produces: `MesoPlanProperties.Split(String key, String label, List<String> types)`; `MesoPlanProperties.splits(): Map<Integer, List<Split>>` (key = training-day count 2..6, first = today's default); `SplitCatalog.forDays(MesoPlanProperties p, int dayCount): List<Split>`; `SplitCatalog.find(MesoPlanProperties p, int dayCount, String key): Optional<Split>`; `MesoPlanSkeleton.build(List<String> daysOfWeek, int weeks, Map<String,String> priorities, Map<String, Baseline> baselines, Bands bands, List<String> types, String splitLabel)` (the old 5-arg `build` delegates with `SPLIT_DAYS`/`SPLIT_LABEL` — byte-identical).

Catalogue (yml, types use the existing `TYPE_GROUPS` keys `Full|Upper|Lower|Push|Pull|Legs`):

| days | key → types |
|---|---|
| 2 | `full2` Full,Full |
| 3 | `full3` Full×3 · `ulf` Upper,Lower,Full |
| 4 | `ul2` Upper,Lower,Upper,Lower · `full4` Full×4 |
| 5 | `ulppl` Upper,Lower,Push,Pull,Legs · `ulul_f` Upper,Lower,Upper,Lower,Full · `pplul` Push,Pull,Legs,Upper,Lower |
| 6 | `ppl2` Push,Pull,Legs×2 · `ul3` Upper,Lower×3 |

Labels Hungarian (`Felső / Alsó`, `Teljes test ×4`, …).

- [ ] **Step 1: Write failing tests** — `SplitCatalogTest.everyEntryKeepsSkeletonInvariants()`: for every day count and every split, `build(...)` with all-grow priorities and the yml baselines gives each baseline group frequency ≥ 2 and week-1 sets per group per day ≤ `session-cap` (8); `firstEntryIsTodaysDefault()`: `forDays(p,n).get(0).types()` equals `MesoPlanSkeleton`'s current `SPLIT_DAYS.get(n)` for n = 2..6. `MesoPlanSkeletonTest.fiveArgBuildUnchanged()`: old `build` output equals the explicit-types overload with the default types/label. Binding IT asserts `splits().get(4)` keys `[ul2, full4]`.
- [ ] **Step 2: Run** `./mvnw -q -pl backend test -Dtest='SplitCatalogTest,MesoPlanSkeletonTest' -Dmezo.test.use-testcontainers=true` → FAIL (missing types).
- [ ] **Step 3: Implement** the record, yml block, `SplitCatalog` (pure static), the skeleton overload. A catalogue entry whose type is unknown or whose length ≠ day count fails binding (`@Validated` + a compact-constructor check).
- [ ] **Step 4: Run** the same command + `MesoPlanPropertiesBindingIT` → PASS.
- [ ] **Step 5: Commit** `feat(train): split catalogue per training-day count (mezo-r36n9.113)`.

### Task 2: Generate takes `split` + Hangsúly cap

**Files:**
- Modify: `api/feature/train/train.yml` (`MesoPlanGenerateRequest.split`, string, nullable, `^[a-z0-9_]{2,16}$`), regenerate `api/openapi.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanGeneratorService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/VolumeProperties.java` (`Bands.emphasizeMax`, default 2), `application.yml`
- Modify: message bundles (both) — `TRAIN_MESO_EMPHASIZE_CAP`, `TRAIN_MESO_SPLIT_UNKNOWN`
- Test: `MesoPlanGenerateContractIT`, `MesoPlanGenerateUnstyledIT`, `TrainPropertiesBindingIT` or the existing volume binding IT

**Interfaces:**
- Consumes: Task 1 `SplitCatalog.find`, skeleton overload.
- Produces: `MesoPlanGeneratorService.generate(user, req)` honours `req.getSplit()`; `PriorityGuard.checkEmphasizeCap(Map<String,String> priorities, int max)` (pure, in `service/`, throws `SystemRuntimeErrorException` 400 `TRAIN_MESO_EMPHASIZE_CAP`) — reused by Task 4.

- [ ] **Step 1: Failing ITs** — `generateWithSplitUsesItsDayTypes()`: 4 days + `split: full4` → every generated day's type is `Full`; `generateWithoutSplitByteIdentical()` (existing golden stays green — run, don't change); `unknownSplitIs400()` → `TRAIN_MESO_SPLIT_UNKNOWN`; **[RF 5]** `threeEmphasizeIs400()` → `TRAIN_MESO_EMPHASIZE_CAP`; `twoEmphasizeOk()`.
- [ ] **Step 2: Run** `./mvnw -q -pl backend test -Dtest='MesoPlanGenerate*IT' -Dmezo.test.use-testcontainers=true` → FAIL.
- [ ] **Step 3: Implement**: contract field, regenerate, guard call before the skeleton, skeleton overload when `split` present.
- [ ] **Step 4: Run** same + `MessageBundleParityTest` → PASS.
- [ ] **Step 5: Commit** `feat(train): generate takes the chosen split, Hangsúly cap 2 (mezo-r36n9.113)`.

### Task 3: Minutes model v2 (styled plans) — after `.114` (see Global Constraints)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/PlanEvaluator.java` (`PlanExercise.restSeconds`, `Input.styled`, `day()`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoPlanEvaluateService.java` (map `x.getRestSec()` / `e.getRestSec()`, styled = `trainingStyle != null` / `run.getTrainingStyle() != null`)
- Modify: `VolumeProperties.Evaluator` (`setSeconds` 40, `transitionMinutes` 1), `application.yml`
- Test: `PlanEvaluatorTest`, `MesoPlanEvaluateContractIT`

**Interfaces:**
- Produces: `PlanExercise(String group, int workingSets, int warmupSets, boolean counts, int capExtra, Integer restSeconds)` (old ctors keep `restSeconds = null`); `Input` gains trailing `boolean styled` (old call sites pass `false`).

Formula when `styled` and the day has exercises: `Σ workingSets × (setSeconds + restSeconds_or_flatEquivalent)/60 + Σ warmupSets × minutesPerWarmupSet + exerciseCount × transitionMinutes + sessionOverheadMinutes`, HALF_UP; an exercise with `restSeconds == null` in a styled plan uses `minutesPerWorkingSet × 60 − setSeconds` as its rest. Unstyled: today's formula exactly.

- [ ] **Step 1: Failing tests** — `styledReferenceDay()`: 5 exercises × 3 working sets, rests 150,150,90,90,90, 2 warm-ups each at 1.0, set 40 s → `round(15×… )` computed in the test from the formula = **54**; assert 54 and that it lies in 35..60 (Fitbod sanity); `unstyledUnchanged()`: same day unstyled = `2.4×15 + 10 + 6` = 52; `styledNullRestFallsBack()`.
- [ ] **Step 2: Run** `./mvnw -q -pl backend test -Dtest=PlanEvaluatorTest` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `PlanEvaluatorTest` + `MesoPlanEvaluate*IT` (testcontainers) → PASS; existing unstyled IT minute values unchanged.
- [ ] **Step 5: Commit** `feat(train): session minutes include prescribed rest for styled plans (mezo-r36n9.113)`.

### Task 4: Why, heavy-consecutive hint, tier budget on the evaluation

**Files:**
- Modify: `api/feature/train/train.yml`: `MuscleEvaluation.basis` (`MuscleBasis {source: enum [landmarks_rp, maintain_third, sport_adjusted]}`), `MuscleEvaluation.consecutiveHeavy` (array of `{dayIndex, nextDayIndex, sets, nextSets}`), `MesoPlanEvaluation.budget` (`TierBudgetView {capacitySets?, usedSets, emphasizeCount, emphasizeMax, raiseCost: map muscle→int}`, nullable), regenerate
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TierBudget.java` (pure)
- Modify: `PlanEvaluator.java` (consecutive detection via calendar weekday of each day: `Hét..Vas` → 0..6, Vas→Hét wraps), `MesoPlanEvaluateService.java` (map basis/consecutive/budget)
- Modify: `VolumeProperties.Bands.consecutiveHeavySets` (4)
- Test: `TierBudgetTest`, `PlanEvaluatorTest`, `MesoPlanEvaluateContractIT`

**Interfaces:**
- Consumes: Task 3 minutes model (per-set minutes), `VolumePath.project`.
- Produces: `TierBudget.Result(Integer capacitySets, int usedSets, int emphasizeCount, int emphasizeMax, Map<String,Integer> raiseCost)`; `TierBudget.of(PlanEvaluator.Input in, PlanEvaluator.Result r): TierBudget.Result` — used by Task 5.
  - `capacitySets` (null when `sessionMinutesTarget` null **[RF 2]**) = Σ over training days of `floor((target − overhead − 2 × minutesPerWarmupSet) / (avgSetMinutes + transitionMinutes / 3.0))`, `avgSetMinutes` = mean (setSeconds + rest)/60 over the plan's counting exercises (unstyled: `minutesPerWorkingSet`).
  - `usedSets` = max `path[w].total` over non-Deload weeks.
  - `raiseCost[g]` = peak total with only `g` raised one tier (maintain→grow→emphasize; emphasize → absent) minus `usedSets`, by re-running `VolumePath.project`.

- [ ] **Step 1: Failing tests** — `TierBudgetTest`: `capacityNullWithoutTarget()`; `capacityFourDaysSixty()` (balanced rests → assert the formula's value computed in-test); `usedIsPeakLoadingWeek()` (Deload ignored); `raiseCostPositiveForMaintain()`; `emphasizedHasNoRaiseCost()`. `PlanEvaluatorTest`: `consecutiveHeavyFlagged()` (back 7 on Hét, 4 on Kedd → one entry); `fullBodyLightNotFlagged()` (3 + 3); `coreExempt()`; `sundayMondayWraps()`. Contract IT: `evaluationCarriesBasisAndBudget()`; maintain muscle `basis.source = maintain_third`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `TierBudgetTest,PlanEvaluatorTest` + `MesoPlanEvaluate*IT` + `ArchitectureTest` (testcontainers) → PASS.
- [ ] **Step 5: Commit** `feat(train): evaluation explains bands, flags heavy back-to-back days, tier budget (mezo-r36n9.113)`.

### Task 5: Candidates endpoint

**Files:**
- Modify: `api/feature/train/train.yml`: `POST /api/train/meso-plans/candidates` op `getMesoPlanCandidates`, request `MesoPlanCandidatesRequest {daysOfWeek, weeks, priorities?, sessionMinutesTarget?, sportGroups?}`, response `MesoPlanCandidates {candidates: [MesoPlanCandidate], nothingFits: bool, fixes: [CandidateFix]}`; `MesoPlanCandidate {splitKey, splitLabel, template: MesoTemplateUpsertRequest, evaluation: MesoPlanEvaluation, recommended: bool, reasons: [CandidateReason {code, value?}]}`; `CandidateFix {code: enum [more_minutes, fewer_emphasis, more_days], value?}`; regenerate
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/CandidateRanker.java` (pure), `MesoPlanCandidatesService.java`
- Modify: `TrainController.java` (one method)
- Test: `CandidateRankerTest`, `MesoPlanCandidatesContractIT`

**Interfaces:**
- Consumes: Task 1 catalogue + skeleton, Task 2 guard, Tasks 3–4 evaluator (in-process `PlanEvaluator.evaluate` + `TierBudget.of`), the generator's deterministic path (skeleton → filler → merger → style stamp, **no** `MesoPlanLlm`) — extract it as `MesoPlanGeneratorService.deterministicTemplate(user, req, Split split): MesoTemplateUpsertRequest` (package-visible, also used by `generate` before the LLM step).
- Produces: `CandidateRanker.rank(List<Scored> all): Ranked` where `Scored(Split split, PlanEvaluator.Result eval, Integer target)`, `Ranked(List<Scored> offered, boolean nothingFits, List<Fix> fixes)`.
  - Hard filters per Global Constraints; offered sorted by (fewest muscles not `INSIDE`, shortest longest day, catalogue order); first = recommended; max 3.
  - None passes → `nothingFits = true`, `offered` = [the one with the smallest overrun], `fixes`: `more_minutes {value = its longest day}` when time failed, `fewer_emphasis` when ≥ 1 Hangsúly and dropping one makes a candidate pass (re-rank), `more_days` when days < 6.
  - Reasons on offered (only positive/neutral): `fits_time {maxMinutes}`, `freq_2x`, `freq_high {perWeek}` (full body), `more_warmups {perWeek extra vs the recommended}`.

- [ ] **Step 1: Failing tests** — `CandidateRankerTest`: `filtersOverTime()`, `filtersHeavyConsecutive()`, `keepsLightFullBody()`, `ordersByBandFitThenLongestDay()`, `nothingFitsGivesClosestAndFixes()`, `atMostThree()`. IT: `fourDaysSixtyMinutesOffersUl2Recommended()` (UL first, `recommended=true`, every offered day `overTarget=false`); `noLlmCalled()` (mock `MesoPlanLlm` never invoked); **[RF 1]** `twoDays()` and `weekendGapDays()` (Hét,Kedd,Szo,Vas) → 200 with ≥ 1 candidate or `nothingFits`; **[RF 5]** `allMaintainStillOffers()`, `threeEmphasize400()`.
- [ ] **Step 2: Run** `-Dtest='CandidateRankerTest,MesoPlanCandidatesContractIT'` → FAIL.
- [ ] **Step 3: Implement** (service has no class-level `@Transactional`; method-level `readOnly` like evaluate).
- [ ] **Step 4: Run** same + `MesoPlanGenerate*IT` + `ArchitectureTest` → PASS; `node scripts/gen-codemap.mjs`.
- [ ] **Step 5: Commit** `feat(train): ranked flawless split candidates endpoint (mezo-r36n9.113)`.

### Task 6: Phone client + models

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Train/PlanWire.swift` (`WireEvaluateRequest.sessionMinutesTarget: Int?`; `WireMuscleEvaluation.basis: WireBasis?`, `.consecutiveHeavy: [WireConsecutive]?`; `WireEvaluation.budget: WireBudget?`; `WireCandidatesRequest`, `WireCandidates`, `WireCandidate`, `WireReason`, `WireFix`, `WireGenerateRequest/Response`, `WireTemplateStart`) — String enums, lenient decoding
- Modify: `ios/BoopKit/Sources/BoopCore/Train/PlanClient.swift`: `candidates(_:) -> WireCandidates`, `generate(_:) -> WireGenerateResponse`, `createTemplate(_ template: WireTemplate) -> String /* id */`, `startTemplate(id:, startDate: String, status: String) -> WireBlock`, `closeBlock(id:)`
- Create: `ios/BoopKit/Sources/BoopCore/Train/NewBlockModel.swift`
- Modify: `ios/BoopKit/Sources/BoopCore/Train/BlockBuilderModel.swift` (`minutesTarget: Int?` sent with every evaluate; `canRaise(_ muscle:) -> RaiseCheck` from `evaluation.budget`; `justCreated: Bool` + `discard() async`)
- Modify: `ios/BoopKit/Sources/BoopAPI/openapi.yaml` via `ios/scripts/sync-openapi.sh`; `scripts/check-ios-contract.mjs` must pass (new raw op ids)
- Test: `ios/BoopKit/Tests/BoopCoreTests/{PlanClientTests,NewBlockModelTests,BlockBuilderBudgetTests}.swift`, fixtures in `PlanFixtures.swift`

**Interfaces:**
- Produces: `NewBlockModel` (`@MainActor @Observable`): `init(client: PlanClient, seasonGymDays: [Int]?, debounce: Duration = .milliseconds(300))`; state `weeks: Int` (default 6, 4…8), `minutes: Int` (45/60/75/90, default 60), `tiers: [String: String]`, `startChoice: .nextMonday | .today`; `phase: .needsSeason | .editing | .loadingCandidates | .candidates(WireCandidates) | .creating | .created(blockId: String) | .failed(PlanFetchError)`; `budget: WireBudget?` (from the recommended/closest candidate's evaluation, refreshed debounced on every edit); `canRaise(_ muscle: String) -> RaiseCheck` (`.ok | .emphasizeFull | .noRoom(minutes: Int, days: Int)`) — pure comparison of `raiseCost[m]` with `capacitySets − usedSets`; `choose(_ c: WireCandidate) async` → generate(split) → create → start → `.created`; on generate failure falls back to `c.template`; 409 `SEASON_REQUIRED` → `.needsSeason` **[RF 3]**.
- Season days → tokens: `[0:"Hét",1:"Kedd",2:"Sze",3:"Csü",4:"Pén",5:"Szo",6:"Vas"]`; nil/empty `seasonGymDays` → `.needsSeason` before any call **[RF 3]**.

- [ ] **Step 1: Failing tests** — `NewBlockModelTests`: `noSeasonNeedsSeasonWithoutCalls()`; `editRefreshesCandidatesDebounced()`; `raiseBlockedWhenEmphasizeFull()`; `raiseBlockedWhenNoRoom()`; `loweringAlwaysAllowed()`; `chooseCreatesAndStarts()` (stub asserts generate carries `split`, start carries next Monday + `planned`); `generateFailureUsesCandidateTemplate()`; `seasonRequired409GoesToNeedsSeason()`. `BlockBuilderBudgetTests`: `minutesTargetSent()`, **[RF 2]** `noTargetNoBudgetNoCrash()`, **[RF 4]** `discardClosesJustCreatedBlock()`. `PlanClientTests`: decoding of a candidates fixture incl. unknown enum strings.
- [ ] **Step 2: Run** `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max'` (per `ios/README.md`) → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same → PASS; `node scripts/check-ios-contract.mjs` → OK.
- [ ] **Step 5: Commit** `feat(boop): new-block model, candidates client, builder budget (mezo-r36n9.113)`.

### Task 7: Phone screens

**Files:**
- Create: `ios/Boop/EdzesTerv/UjBlokk/{UjBlokkFlow,UjBlokkAlapok,UjBlokkJeloltek,UjBlokkNemFer}.swift` — ported from the spike's `EvesTervIntake.swift` (look as approved: screens 2, 2b, 3, 3b)
- Create: `ios/Boop/EdzesTerv/MuscleWhySheet.swift` (spike screen 4), `ios/Boop/EdzesTerv/BudgetLine.swift` (spike 4b compact line + Alapok card)
- Modify: `ios/Boop/EdzesTerv/BlockBuilderPage.swift` (no-block state: primary **Új blokk**; head budget line; tier chips use `canRaise` with the inline reason; muscle row opens `MuscleWhySheet`; just-created block shows „Mégsem, eldobom”), `PlanKit.swift` (copy for reason/fix codes), `PlanPreview.swift` (`-previewUjBlokk YES`, `-previewUjBlokkScreen alapok|tele|jeloltek|nemfer`, fixture evaluator minutes = server formula)
- Modify: `ios/Boop/Edzes/EdzesRoom.swift` (present the flow; pass season gym days from the Évad cache)
- Test: `ios/BoopTests/EdzesStoreTests.swift` only if the room wiring changes store state

**Interfaces:**
- Consumes: Task 6 `NewBlockModel`, `BlockBuilderModel.canRaise/discard/minutesTarget`.
- Copy (Hungarian, from the spike): reason codes → `fits_time` „Belefér a {target} percbe: a leghosszabb nap kb. {v} perc.”, `freq_2x` „Minden izom hetente kétszer kap kemény sorozatot.”, `freq_high` „Minden izom hetente {v}×, naponta kevés sorozattal.”, `more_warmups` „Minden nap mindenre bemelegítesz: hetente kb. {v} bemelegítő sorozattal több.”; fixes → „Legyen {v} perc”, „Egy izom Hangsúly helyett Építés”, „Legyen {n+1} nap”; raise reasons → „Már 2 izom van Hangsúlyon — előbb vegyél le egyet.” / „Ez már nem fér a heti {days} × {minutes} percbe. Vegyél le egy izmot Tartásra, vagy adj hozzá időt.”; basis sources → the three "miért" boxes of spike screen 4; unknown code → no line.

- [ ] **Step 1: Build the screens** from the spike, against `NewBlockModel` fixtures.
- [ ] **Step 2: Simulator walk** (own device "Boop · mezo-r36n9.113"): every preview flag screen + empty/loading/error/offline/no-season states, SE width, reduced motion; captures to `docs/superpowers/specs/assets/eves-terv/build-*.png` and compare with the spike captures.
- [ ] **Step 3: Run** `xcodebuild test` for `BoopKit-Package` and `Boop` (per `ios/README.md`) → PASS.
- [ ] **Step 4: Commit** `feat(boop): új blokk — alapok, jelöltek, nem fér, miért, heti keret (mezo-r36n9.113)`.

### Task 8: Docs, review, ship

**Files:** `docs/features/train.md` (§4 Plan generator / evaluator / new candidates, §9), `docs/features/boop-ios.md` (§2 block builder, §4 calls), feature index row, `docs/milestones/roadmap.md` milestone, `docs/boop-handbook/07-edzes/` (new page *Új blokk és tervjelöltek*, update *16-blokk-epito* and *14-edzesstilus* minutes line), `_jegyek.json` row for `.113`, `_dontesek.json` rows for decisions 1–8 of spec §2, `_kiadasok.json` row, `.claude/skills/boop/SKILL.md` §6 row.

- [ ] **Step 1:** Docs above; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors / 0 stale (gate the merge on its exit code).
- [ ] **Step 2:** Fresh-context whole-branch review on the most capable model; fix Critical/Important test-first; minors → bd under `mezo-r36n9`.
- [ ] **Step 3:** Backend focused ITs + `ArchitectureTest` (testcontainers); iOS tests; `git pull --rebase`; local `--no-ff` merge via detached HEAD; `git push origin HEAD:main`; regenerate CODEMAP after the merge.
- [ ] **Step 4:** `deploy` green, pod tag = release version; prod read: `POST …/candidates` answered (log/metrics) — no data migration.
- [ ] **Step 5:** Install on the phone (`ios/scripts/install-on-phone.sh`, say so first), walk: Új blokk → Alapok → Jelöltek → Ezzel kezdem → builder → Mégsem eldobom (then really start one only if he wants).
- [ ] **Step 6:** Notion `plan` → apply → `check` 0; `node scripts/check-beads-backup.mjs --fix`; Hungarian report.

## Kész, ha…

- [ ] 4 nap × 60 percre az Új blokk két hibátlan jelöltet mutat (Felső/Alsó ajánlott), mindegyik nap ≤ 60 perc; ha semmi nem fér bele, a „nem fér” kártya a javításokkal jelenik meg.
- [ ] A heti keret élőben követi a szint- és percváltást; 2 Hangsúly után a harmadik nem választható, az ok a sor alatt; túl kevés időnél ugyanígy.
- [ ] Ezzel kezdem → a blokk létrejön (jövő hétfőtől), a megszokott blokképítő nyílik rajta; „Mégsem, eldobom” lezárja.
- [ ] A blokképítőben minden izomnál ott a „miért?”; nagy adag két egymást követő napon jelzést kap; a percek a pihenővel számolnak (stílusos blokknál).
- [ ] Nincs évad → az évad-kérő állapot, hívás nélkül.
- [ ] Stílus nélküli blokk percei és a `split` nélküli generálás változatlan (tesztek).
- [ ] Kapuk: backend fókuszált ITs + ArchitectureTest; BoopKit + Boop tesztek; codemap; lint-docs 0/0; ios-contract.
- [ ] Docs + kézikönyv + Notion; merge, deploy zöld, telefonra telepítve és végigjárva.
