# Mintarészlet — közérthető következtetés és adaptív grafikon — Implementation Plan

**Goal:** A Minták részletoldala a vizsgált hipotézist és az aktuális következtetést világosan
szétválasztja, a 8 hétköznap + 1 hétvége helyzetet adatgyűjtésként kezeli, és a metrika típusához
illő, első pillantásra olvasható grafikont mutat.

**Architecture:** A meglévő közös `PatternGate` új, konfigurált bináris csoportkaput kap, ezért az
éjszakai job és a live monitor továbbra is ugyanazt a döntést hozza. Az OpenAPI
`PatternMonitorPair` value-kind és csoportmezőkkel bővül; a frontend ezekből választ story hero,
csoportos pontdiagram vagy folytonos scatter között. Minden felhasználói copy determinisztikus;
LLM és új endpoint nincs.

**Global Constraints:** `min-group-n = 3`; a kapusorrend `no_data → few_days →
imbalanced_groups → degenerate/live`; nem-live proposed sorhoz nincs döntési CTA és nincs
aktuálisként mutatott régi `r/p`; bináris A metrikánál nincs regressziós vonal, medián csak legalább
3 pontos csoporton; a normatív vizuális referencia a jóváhagyott Design 2.0 prototípus; contract
first; backend integration-first; frontend mindkét adat-módja zöld.

**Spec:** [`docs/superpowers/specs/2026-09-04-pattern-detail-redesign-design.md`](../specs/2026-09-04-pattern-detail-redesign-design.md)

**Driving bd issue:** `mezo-0469`

### Task 1: Contract — a pair wire alakja kimondja a metrikatípust és a csoporthiányt

**Files:**

- Modify: `api/feature/companion/companion.yml`
- Regenerate: `api/openapi.yml`
- Regenerate: `frontend/src/data/_client/api.gen.ts`

**Interfaces:**

- `PatternMonitorPair.metricAValueKind: 'number' | 'clock_hour' | 'binary'`
- `PatternMonitorPair.metricBValueKind: 'number' | 'clock_hour' | 'binary'`
- `PatternMonitorPair.verdict` gains `imbalanced_groups`
- nullable `groupZeroDays`, `groupOneDays`, `requiredPerGroup`

- [x] In `PatternMonitorPair.required`, add `metricAValueKind` and `metricBValueKind`. Add the two
  string properties with pattern `^(number|clock_hour|binary)$`.
- [x] Widen the verdict pattern to
  `^(live|few_days|no_data|degenerate|imbalanced_groups|frozen)$`.
- [x] Add nullable integer properties with descriptions that say they are populated only when
  metric A is binary:

  ```yaml
  groupZeroDays: { type: integer, nullable: true }
  groupOneDays: { type: integer, nullable: true }
  requiredPerGroup: { type: integer, nullable: true }
  ```

- [x] Generate in contract-first order:

  ```bash
  cd api/generate
  npm install
  npm run generate:api
  cd ../../frontend
  pnpm generate:api
  ```

- [x] Verify the merged and generated shapes contain every new property and no endpoint drift:

  ```bash
  rg -n "metricAValueKind|imbalanced_groups|groupZeroDays|requiredPerGroup" \
    api/openapi.yml frontend/src/data/_client/api.gen.ts
  git diff --check
  ```

- [x] Commit only the contract and generated artifacts:

  ```bash
  git add api/feature/companion/companion.yml api/openapi.yml \
    frontend/src/data/_client/api.gen.ts
  git commit -m "feat(api): describe pattern group balance (mezo-0469)"
  ```

### Task 2: Backend core — value-kind metaadat és 3+3-as bináris kapu

**Files:**

- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricValueKind.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternGate.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternMonitorService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternPairDetailService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PatternGateTest.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java`

**Interfaces:**

```java
enum MetricValueKind { NUMBER, CLOCK_HOUR, BINARY; String wireKey(); }

static Outcome evaluate(
    Map<LocalDate, Double> seriesA,
    Map<LocalDate, Double> seriesB,
    int lagDays,
    int minN,
    int minGroupN,
    MetricValueKind metricAValueKind
)

record Outcome(
    Verdict verdict,
    int alignedDays,
    PearsonCorrelation.Result result,
    Side constantSide,
    Integer groupZeroDays,
    Integer groupOneDays
) {}
```

- [x] RED: extend `PatternGateTest` first. Update existing calls to pass `3` and `NUMBER`, then
  add these cases:

  ```java
  @Test
  void testEvaluate_shouldReturnImbalancedGroups_whenBinarySeriesHasEightAndOne() {
      PatternGate.Outcome outcome = PatternGate.evaluate(
          series(D, 0, 0, 0, 0, 0, 0, 0, 0, 1),
          series(D, 12, 13, 14, 15, 16, 17, 18, 19, 20),
          0, 8, 3, MetricValueKind.BINARY);

      assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.IMBALANCED_GROUPS);
      assertThat(outcome.groupZeroDays()).isEqualTo(8);
      assertThat(outcome.groupOneDays()).isEqualTo(1);
      assertThat(outcome.result()).isNull();
  }
  ```

  Add the complementary `3+3 → LIVE` case and keep one NUMBER case proving that a numerically
  two-valued non-binary metric does not enter the group gate.

- [x] Run the focused test and observe compile/failing assertions before production edits:

  ```bash
  cd backend
  ./mvnw -Dtest=PatternGateTest clean test
  ```

- [x] GREEN: create `MetricValueKind` with lowercase `wireKey()`. Keep the current three-argument
  `MetricKey` constructor as a `NUMBER` default and add a four-argument overload. Mark only:

  ```java
  LATE_MEAL_HOUR(..., MetricValueKind.CLOCK_HOUR)
  BEDTIME_HOUR(..., MetricValueKind.CLOCK_HOUR)
  WAKEUP_HOUR(..., MetricValueKind.CLOCK_HOUR)
  RITUAL_CLOSED(..., MetricValueKind.BINARY)
  WEEKEND(..., MetricValueKind.BINARY)
  ```

  Expose `MetricKey.valueKind()`; do not change its config/wire key.

- [x] Add `IMBALANCED_GROUPS` and the two nullable counts to `PatternGate`. After alignment, keep
  the exact gate order from Global Constraints. For binary A, count exact extractor values:

  ```java
  int zero = (int) aligned.stream().filter(v -> v[0] == 0.0).count();
  int one = (int) aligned.stream().filter(v -> v[0] == 1.0).count();
  if (zero < minGroupN || one < minGroupN) {
      return new Outcome(Verdict.IMBALANCED_GROUPS, n, null, null, zero, one);
  }
  ```

  LIVE binary outcomes retain both counts; non-binary outcomes carry `null/null`.

- [x] Add `@Min(3) @Max(30) int minGroupN` immediately after `minN` in
  `CompanionProperties.Patterns`, and `min-group-n: 3` next to `min-n: 8` in `application.yml`.
  Extend `CompanionPropertiesIT` to assert the bound value is `3` and invalid `2` fails binding.

- [x] Thread `config.minGroupN()` and `pair.metricA().valueKind()` through both shared callers:
  `PatternDetectionService.detectPair(...)` and `PatternMonitorService.toPair(...)`.
  `PatternPairDetailService` must pass both thresholds when it reuses `toPair`; no duplicate math.

- [x] Run RED→GREEN focused gates:

  ```bash
  cd backend
  ./mvnw -Dtest=PatternGateTest,CompanionPropertiesIT clean test
  ```

- [x] Refactor only after green: update javadocs so they say total-size **and** binary-balance
  gate, then rerun the same command.

- [x] Commit:

  ```bash
  git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricValueKind.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternGate.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternMonitorService.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternPairDetailService.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java \
    backend/src/main/resources/application.yml \
    backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PatternGateTest.java \
    backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java
  git commit -m "feat(companion): gate imbalanced pattern groups (mezo-0469)"
  ```

### Task 3: Backend boundary — monitor/detail egyezőség és stale-row védelem

**Files:**

- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternMonitorService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternMonitorApiIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternPairDetailApiIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PatternDetectionServiceIT.java`

**Interfaces:** `PatternMonitorService.toPair(..., int minN, int minGroupN, LocalDate from,
LocalDate to)` builds every new generated `PatternMonitorPair` field. Wire verdict constant:
`imbalanced_groups`.

- [x] RED: add a `MealPopulator` overload that accepts `mealDate` + `loggedAt` while reusing the
  existing line/cascade builder. In `CompanionPatternMonitorApiIT`, seed nine finished dates:
  eight weekdays and one weekend, one meal per date, with different local clock hours. Assert:

  ```java
  PatternMonitorPair pair = pair(monitor(), "weekend~late-meal-hour");
  assertThat(pair.getVerdict()).isEqualTo("imbalanced_groups");
  assertThat(pair.getAlignedDays()).isEqualTo(9);
  assertThat(pair.getGroupZeroDays()).isEqualTo(8);
  assertThat(pair.getGroupOneDays()).isEqualTo(1);
  assertThat(pair.getRequiredPerGroup()).isEqualTo(3);
  assertThat(pair.getR()).isNull();
  assertThat(pair.getP()).isNull();
  assertThat(pair.getMetricAValueKind()).isEqualTo("binary");
  assertThat(pair.getMetricBValueKind()).isEqualTo("clock_hour");
  ```

  Derive weekend/weekday dates with `DayOfWeek`; do not pin the test to today's weekday.

- [x] Add the same pair assertion through
  `GET /api/companion/pattern/pair/weekend~late-meal-hour` in
  `CompanionPatternPairDetailApiIT`, including `days.size() == 9`. This pins monitor/detail
  agreement at the HTTP boundary.

- [x] Add `PatternDetectionServiceIT` coverage for a pre-existing proposed row: capture its
  `r/n/p/lastDetectedAt` and snapshot count, run `detect(owner)`, then assert those values and the
  count are unchanged for the 8+1 pair. A separate no-row case asserts no pattern is created.

- [x] Run and observe failure before mapper implementation:

  ```bash
  cd backend
  ./mvnw -Dtest=CompanionPatternMonitorApiIT,CompanionPatternPairDetailApiIT,PatternDetectionServiceIT clean test
  ```

- [x] GREEN: in `PatternMonitorService`, always map both value kinds:

  ```java
  .metricAValueKind(pair.metricA().valueKind().wireKey())
  .metricBValueKind(pair.metricB().valueKind().wireKey())
  ```

  Add the exhaustive switch arm:

  ```java
  case IMBALANCED_GROUPS -> builder.verdict(VERDICT_IMBALANCED_GROUPS)
      .groupZeroDays(outcome.groupZeroDays())
      .groupOneDays(outcome.groupOneDays())
      .requiredPerGroup(minGroupN);
  ```

  Also attach the three group fields to a binary `LIVE` pair so the detail hero can show both
  sample sizes after the gate opens. Keep them null for non-binary and frozen pairs.

- [x] Re-run the three focused IT classes with `clean`. Confirm the old no-data/few/live/frozen
  assertions remain green, not only the new case.

- [x] Commit:

  ```bash
  git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternMonitorService.java \
    backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java \
    backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternMonitorApiIT.java \
    backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternPairDetailApiIT.java \
    backend/src/test/java/io/mrkuhne/mezo/feature/companion/PatternDetectionServiceIT.java
  git commit -m "test(companion): pin balanced pattern evidence (mezo-0469)"
  ```

### Task 4: Frontend domain — adapterek, verdikt- és következtetés-copy

**Files:**

- Modify: `frontend/src/data/types.ts`
- Create: `frontend/src/data/insights/patternPairMapper.ts`
- Create: `frontend/src/data/insights/patternPairMapper.test.ts`
- Modify: `frontend/src/data/insights/monitorApi.ts`
- Modify: `frontend/src/data/insights/patternDetailApi.ts`
- Modify: `frontend/src/data/insights/insights.ts`
- Modify: `frontend/src/features/insights/logic/findings.ts`
- Modify: `frontend/src/features/insights/logic/findings.test.ts`
- Modify: `frontend/src/features/insights/logic/verdicts.ts`
- Create: `frontend/src/features/insights/logic/verdicts.test.ts`
- Modify: `frontend/src/features/insights/logic/metricFormat.ts`
- Modify: `frontend/src/features/insights/logic/metricFormat.test.ts`
- Modify as compilation fixtures require: `frontend/src/features/insights/logic/*.test.ts`
  and `frontend/src/features/insights/pages/*.test.tsx`

**Interfaces:**

```ts
export type PatternMetricValueKind = 'number' | 'clock_hour' | 'binary'
export type PatternGateVerdict =
  | 'live' | 'few_days' | 'no_data' | 'degenerate' | 'imbalanced_groups' | 'frozen'

export interface PatternMonitorPair {
  metricAValueKind: PatternMetricValueKind
  metricBValueKind: PatternMetricValueKind
  groupZeroDays: number | null
  groupOneDays: number | null
  requiredPerGroup: number | null
}
```

- [x] RED: create `patternPairMapper.test.ts` with a generated-wire-shaped 8/1 fixture. Assert the
  mapper preserves `binary`, `clock_hour`, `imbalanced_groups`, `8`, `1`, `3`, and normalizes all
  omitted nullable fields to `null`. Add `verdicts.test.ts` asserting the exact strings:

  ```ts
  expect(verdictSentence(pair, null)).toBe('Még 2 hétvégi nap kell.')
  expect(groupBalanceSentence(pair)).toBe(
    '8 hétköznapi nap mellett még csak 1 hétvégi nap van. Egyetlen hétvégi napból még nem mondunk irányt.',
  )
  ```

- [x] Change `findings.test.ts` expectations before production code:

  ```ts
  expect(findingSentence(base)?.prefix).toBe('Eddig az ellenkezője látszik:')
  expect(findingSentence({ ...base, r: 0.62 })?.prefix)
    .toBe('Eddig ebbe az irányba mutatnak a napjaid:')
  expect(confidenceMeta(13, 0.302).sentence)
    .toBe('13 közös nap — bizonytalan jel; ebből még nem érdemes következtetést levonni')
  ```

- [x] Run the focused frontend tests in both modes and observe RED/compile failure:

  ```bash
  cd frontend
  pnpm vitest run src/data/insights/patternPairMapper.test.ts \
    src/features/insights/logic/findings.test.ts \
    src/features/insights/logic/verdicts.test.ts
  VITE_USE_MOCK=true pnpm vitest run src/data/insights/patternPairMapper.test.ts \
    src/features/insights/logic/findings.test.ts \
    src/features/insights/logic/verdicts.test.ts
  ```

- [x] GREEN: add the domain types. Move the duplicated wire mapper from `monitorApi.ts` and
  `patternDetailApi.ts` into `patternPairMapper.ts`:

  ```ts
  export function toPatternMonitorPair(w: PairWire): PatternMonitorPair {
    return {
      // existing fields unchanged
      metricAValueKind: w.metricAValueKind as PatternMetricValueKind,
      metricBValueKind: w.metricBValueKind as PatternMetricValueKind,
      groupZeroDays: w.groupZeroDays ?? null,
      groupOneDays: w.groupOneDays ?? null,
      requiredPerGroup: w.requiredPerGroup ?? null,
    }
  }
  ```

  Both APIs import this file directly by `@/data/insights/patternPairMapper`; do not add a barrel.

- [x] Add value kinds and null group fields to every mock monitor pair. Add the approved
  `weekend~late-meal-hour` 8+1 fixture as `imbalanced_groups` and make its mock detail days match
  the prototype's nine dates and clock values. Do not retain a live `r/p` on that pair.

- [x] Replace `findingSentence` prefixes and `confidenceMeta` sentences exactly as specified.
  Preserve the existing `strengthWord` thresholds and category chips.

- [x] Extend `metricFormat.ts` with binary group copy metadata, not chart-type detection:

  ```ts
  binaryGroupLabels('weekend')
  // => { zero: { axis: 'hétköznap', day: 'hétköznapi' },
  //      one: { axis: 'hétvége', day: 'hétvégi' } }
  ```

  `ritual-closed` gets `kimaradt/megvolt` axis labels and `lezárás nélküli/lezárt esti` day
  labels; unknown keys receive neutral `0-s csoport/1-es csoport` fallbacks.

- [x] Implement `verdictSentence`'s `imbalanced_groups` arm from actual count/required fields and
  a separate `groupBalanceSentence(pair)` for the explanatory paragraph. If fields are missing,
  return „Mindkét oldalról több nap kell.” without inventing a number.

- [x] Run focused tests, then TypeScript build in both environment modes:

  ```bash
  cd frontend
  pnpm vitest run src/data/insights/patternPairMapper.test.ts \
    src/features/insights/logic/findings.test.ts \
    src/features/insights/logic/verdicts.test.ts \
    src/features/insights/logic/metricFormat.test.ts
  VITE_USE_MOCK=true pnpm vitest run src/data/insights/patternPairMapper.test.ts \
    src/features/insights/logic/findings.test.ts \
    src/features/insights/logic/verdicts.test.ts \
    src/features/insights/logic/metricFormat.test.ts
  pnpm build
  ```

- [x] Commit:

  ```bash
  git add frontend/src/data/types.ts frontend/src/data/insights \
    frontend/src/features/insights/logic frontend/src/features/insights/pages/*.test.tsx
  git commit -m "feat(insights): explain pattern evidence clearly (mezo-0469)"
  ```

### Task 5: Frontend UI — Design 2.0 story flow és adaptív evidence chart

**Files:**

- Create: `frontend/src/features/insights/components/PatternDetailHero.tsx`
- Create: `frontend/src/features/insights/components/PatternEvidenceChart.tsx`
- Create: `frontend/src/features/insights/components/PatternEvidenceChart.test.tsx`
- Delete: `frontend/src/features/insights/components/PatternScatter.tsx`
- Modify: `frontend/src/features/insights/components/PatternJournal.tsx`
- Modify: `frontend/src/features/insights/logic/patternHistory.ts`
- Modify: `frontend/src/features/insights/logic/patternHistory.test.ts`
- Create: `frontend/src/features/insights/logic/patternEvidence.ts`
- Create: `frontend/src/features/insights/logic/patternEvidence.test.ts`
- Modify: `frontend/src/features/insights/pages/PatternDetailPage.tsx`
- Modify: `frontend/src/features/insights/pages/PatternDetailPage.test.tsx`
- Modify: `frontend/src/features/insights/pages/PatternsPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**

```ts
export function PatternDetailHero(props: {
  pair: PatternMonitorPair
  pattern: Pattern | null
  onDecide: (status: PatternStatus) => void
}): ReactNode

export function PatternEvidenceChart(props: {
  days: AlignedDay[]
  pair: PatternMonitorPair
}): ReactNode

export function groupedEvidence(days: AlignedDay[], requiredPerGroup: number): {
  zero: GroupSummary
  one: GroupSummary
  latest: AlignedDay | null
}
```

- [ ] RED: add pure `patternEvidence.test.ts` cases using the exact nine prototype values. Assert:
  zero count `8`, median `19:38` after formatting, range `10:07–23:43`; one count `1`, no median;
  latest date `2026-09-03` belongs to the zero group. Add a balanced 3+3 case where both medians
  exist.

- [ ] RED: add component assertions to `PatternEvidenceChart.test.tsx`: binary value kind renders
  `Hétköznap`, `Hétvége`, `24:00`, `18:00`, `12:00`, an accessible „legutóbbi nap” marker and no
  `trendvonal`; number value kind renders formatted X/Y tick labels, and a non-live number pair
  renders no trendline.

- [ ] RED: rewrite the 8+1 real-mode fixture in `PatternDetailPage.test.tsx` to assert:

  ```ts
  expect(await screen.findByText('Még nincs elég hétvégi adat.')).toBeInTheDocument()
  expect(screen.getByText('1 / 3')).toBeInTheDocument()
  expect(screen.getByText('Még 2 hétvégi nap kell.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Megerősítem' })).not.toBeInTheDocument()
  expect(screen.queryByText(/r=-0\.27/)).not.toBeInTheDocument()
  expect(screen.getByText('Hogyan számoltuk?')).toBeInTheDocument()
  ```

  Keep explicit pending/error/404 coverage and add live-strong, live-weak, monitoring, confirmed
  and rejected hero cases from the state matrix.

- [ ] Run the focused UI suite in both modes and observe RED before implementation:

  ```bash
  cd frontend
  pnpm vitest run src/features/insights/logic/patternEvidence.test.ts \
    src/features/insights/components/PatternEvidenceChart.test.tsx \
    src/features/insights/pages/PatternDetailPage.test.tsx
  VITE_USE_MOCK=true pnpm vitest run src/features/insights/logic/patternEvidence.test.ts \
    src/features/insights/components/PatternEvidenceChart.test.tsx \
    src/features/insights/pages/PatternDetailPage.test.tsx
  ```

- [ ] GREEN: implement `patternEvidence.ts` as pure data transforms. Median uses sorted values;
  a group summary sets `median: null` until `values.length >= requiredPerGroup`. Axis ticks are
  derived from observed min/max, but clock-hour charts expand to readable whole-hour bounds and
  always label with `formatMetricValue`.

- [ ] Implement `PatternEvidenceChart`:

  - branch on `pair.metricAValueKind`, never a metric-key allowlist;
  - binary branch: two softly colored plot columns, jittered points, four horizontal grid lines,
    group labels and conditional median bars, with the latest point ringed gold;
  - numeric/clock branch: existing scatter semantics plus three real tick labels per axis;
  - render the dashed regression line only when `pair.verdict === 'live'`;
  - retain an accessible `role="img"` label describing the pair and number of days.

- [ ] Implement `PatternDetailHero` from the state table. For `imbalanced_groups`, use the exact
  approved copy, a `groupOneDays / requiredPerGroup` progress bar for the deficient group, and no
  action buttons even when a stale proposed `pattern` row exists. For live proposed patterns,
  show decision actions only when `isStrongSignal(pair.r, pair.p)`; judged states are read-only
  summaries.

- [ ] Recompose `PatternDetailPage` in the prototype order. Use semantic sections and
  `<details>`/buttons for the two folds. The comparison cards read from `days`; the story tiles
  read from pair verdict + group summary; `PatternImpactCard` renders only when there is a pattern
  or non-empty impact. Replace `Motor-diagnosztika` with the four-cell „Hogyan számoltuk?” block
  and put raw stats in the nested „Technikai számok” disclosure. Read current stats only from
  `pair.r/n/p`; a non-live pair's persisted `pattern.r/n/p` may appear only inside that nested
  disclosure under „Korábbi nyers számítás — még a csoportkapu előtt”.

- [ ] Simplify `journalEntries`: first snapshot becomes „Először számolhatóvá vált — N közös
  nap”; remove strength-band crossings; retain user decisions, promotion link and reinforcement;
  append a „Most” group-progress row for `imbalanced_groups`. The `PatternStrengthChart` remains
  available only in valid live/frozen history; it is not rendered for a non-live pair.

- [ ] Port the approved prototype styling into `prototype.css` under a collision-safe `pdt-`
  prefix, replacing fixed hexes with existing `--mz-*`, `--dv-*`, surface and text tokens where a
  token exists. Add dark-theme-safe colors and the required `prefers-reduced-motion` override.

- [ ] Update dashboard/page assertions affected by the new deterministic copy. Do not weaken the
  lifecycle guard: an `imbalanced_groups` proposed row must still bucket into `gathering`.

- [ ] Run focused suites and the complete frontend gates:

  ```bash
  cd frontend
  pnpm vitest run src/features/insights/logic/patternEvidence.test.ts \
    src/features/insights/logic/patternHistory.test.ts \
    src/features/insights/components/PatternEvidenceChart.test.tsx \
    src/features/insights/pages/PatternDetailPage.test.tsx \
    src/features/insights/pages/PatternsPage.test.tsx
  VITE_USE_MOCK=true pnpm vitest run src/features/insights/logic/patternEvidence.test.ts \
    src/features/insights/logic/patternHistory.test.ts \
    src/features/insights/components/PatternEvidenceChart.test.tsx \
    src/features/insights/pages/PatternDetailPage.test.tsx \
    src/features/insights/pages/PatternsPage.test.tsx
  pnpm test
  VITE_USE_MOCK=true pnpm test
  pnpm build
  ```

- [ ] Start the app in mock mode and perform Browser visual QA at a mobile viewport against the
  approved prototype: hero hierarchy, 8+1 cards, chart scale, latest ring, fold interactions,
  dark theme, reduced-motion emulation where available, and zero console errors.

- [ ] Commit:

  ```bash
  git add frontend/src/features/insights frontend/src/styles/prototype.css
  git commit -m "feat(insights): redesign pattern detail story (mezo-0469)"
  ```

### Task 6: Élő dokumentáció, teljes verifikáció és self-PR

**Files:**

- Modify: `docs/features/insights.md`
- Modify: `docs/features/companion.md`
- Regenerate if file map changes: `docs/CODEMAP.md`
- Update through CLI: bd issue `mezo-0469`

**Interfaces:** the feature docs become the current source of truth for the new gate, contract,
copy, UI state matrix, chart branches, file map and test coverage.

- [ ] Update `docs/features/companion.md` in place: `min-group-n`, `MetricValueKind`, gate order,
  `imbalanced_groups`, group fields, no persistence/snapshot/notification outside LIVE, and the
  monitor/detail shared-math invariant. Remove any sentence that still says `min-n` is the only
  eligibility condition.

- [ ] Update `docs/features/insights.md` in place: story hero, deterministic question/conclusion
  split, new confidence copy, csoportos chart, significant-event journal, layered diagnostics and
  stale-row CTA suppression. Update §10 for `PatternDetailHero`, `PatternEvidenceChart`,
  `patternEvidence` and the removed `PatternScatter`.

- [ ] Regenerate CODEMAP because source files were added/removed, then verify it:

  ```bash
  node scripts/gen-codemap.mjs
  node scripts/gen-codemap.mjs --check
  node --test scripts/gen-codemap.test.mjs
  ```

- [ ] Run doc lint. If the known clean-HEAD baseline still reports unrelated stale feature docs,
  save the exact count in the PR body; `insights.md` and `companion.md` must not appear in the
  stale/error list and no new error may exist:

  ```bash
  node scripts/lint-docs.mjs
  ```

- [ ] Run final contract drift check by regenerating and requiring a clean diff for generated
  artifacts:

  ```bash
  cd api/generate
  npm run generate:api
  cd ../../frontend
  pnpm generate:api
  git diff --exit-code -- ../api/openapi.yml src/data/_client/api.gen.ts
  ```

- [ ] Run the proportionate local backend gate with PostgreSQL available. Always use `clean`:

  ```bash
  cd backend
  docker compose up -d
  ./mvnw -Dtest=PatternGateTest,CompanionPropertiesIT,CompanionPatternMonitorApiIT,CompanionPatternPairDetailApiIT,PatternDetectionServiceIT clean test
  ```

- [ ] Run the complete frontend gates in both data modes:

  ```bash
  cd frontend
  pnpm test
  VITE_USE_MOCK=true pnpm test
  pnpm build
  ```

- [ ] Run source/copy guards and whitespace checks:

  ```bash
  rg -n "Meglepő:|minden [0-9]+\. ilyen minta|Motor-diagnosztika|gyenge.*sáv" \
    frontend/src/features/insights
  git diff --check
  git status --short
  ```

  The `rg` command must return no user-facing production occurrence; historical test comments may
  be rewritten instead of exempted.

- [ ] Commit docs and generated CODEMAP:

  ```bash
  git add docs/features/insights.md docs/features/companion.md docs/CODEMAP.md
  git commit -m "docs(insights): document balanced pattern evidence (mezo-0469)"
  ```

- [ ] Add a bd comment with the exact focused backend results, both frontend modes, build,
  contract drift, visual QA and the doc-lint baseline. Do not close the issue before CI is green.

- [ ] Push the feature branch and open the self-PR whose body lists commits, gate output and any
  baseline-only deviation:

  ```bash
  bd dolt push
  git push -u origin feat/pattern-detail-redesign
  gh pr create --base main --head feat/pattern-detail-redesign \
    --title "feat(insights): redesign pattern detail evidence" \
    --body-file /tmp/mezo-0469-pr.md
  ```

- [ ] Wait for authoritative CI. If it is green, leave `mezo-0469` in progress and hand the PR to
  Daniel for review and merge, as required by the executing-plans workflow. If CI is red, fix on
  this branch, rerun the relevant focused gate, push and wait again; never merge from this session.
