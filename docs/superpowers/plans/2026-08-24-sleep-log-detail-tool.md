# get_recovery — on-demand full sleep-log detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**bd:** `mezo-ohce` · **Spec:** [`2026-08-24-sleep-log-detail-tool-design.md`](../specs/2026-08-24-sleep-log-detail-tool-design.md) · **Branch:** `feat/sleep-log-detail-tool`

**Goal:** `get_recovery(scope=sleep)` gains three optional params — `date` (multi-valued, ≤3),
`from`, `to` — that render the **full** `sleep_log` row for the explicitly requested days
(bedtime, wakeup, duration, in-bed/awake/light/REM/deep minutes, quality, awakenings, source +
source quality, hypnogram, notes). With no new params the tool is **byte-identical** to today's
compact 7-day view; the params are silently ignored on `scope=sleep-goal`/`checkins`.

**Architecture:** A new derived finder
`SleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc` (one read over
the clamped window) + an in-memory filter to the requested days (bounded by the window cap, no
N+1).
`BiometricsTools.getRecovery` routes to a new `renderSleepDetail` when any of
`date`/`from`/`to` is present on scope=sleep; the compact path is untouched. Detail rows are
fully null-guarded (absent fields omitted, never fabricated — manual rows stay sparse). The
`@Tool` description and `ChatService.SYSTEM_PROMPT`'s `[Eszköz-útmutató]` sleep entry are updated
in the same change per `companion_tool_conventions.md`.

**Tech Stack:** Java 21 / Spring Boot 4 / Spring AI 2.0 `@Tool` + JPA. **No API-contract change,
no frontend change, no migration** (the spec states this explicitly — `sleep_log` already holds
every field). Integration tests on Postgres (`AbstractIntegrationTest`).

## Global Constraints

- **No contract change:** do **not** touch `api/` or `frontend/`, do **not** run any
  `generate:api` step — tools are server-side, not the REST surface (spec §8).
- **No migration, no `ResetDatabase` change:** `sleep_log` is already in the TRUNCATE list
  (added with mezo-dbsr) and `SleepLogPopulator` already exists (added with mezo-dbsr — see the
  spec-correction commit `93d0fef2`).
- **Byte-identical default:** `getRecovery(scope, days, null, null, null)` on scope=sleep must
  produce exactly the current compact output — including the `Alvás (utolsó N nap):` header.
  Existing `CompanionToolsRenderIT` **assertions** stay green unmodified — its five
  `getRecovery(...)` call sites (lines 180/190/200/215/226) gain `null, null, null` before `ctx(...)`
  as a compile-level param addition (Task 2, Step 3). No other direct call site exists (verified
  by grep — elsewhere the tool is reached via the fake-tool sentinel).
- **Null-guarded rendering:** every detail field is optional; absent fields are omitted, never
  rendered as zero/empty (spec §3 — "never a fabricated value").
- **Window cap:** the selectable window is `properties.tools().maxWindowDays()` (default 7;
  `application.yml` sets 30) — the same cap `days` already honours via `ToolText.clamp`.
- **`date` cap 3:** the spec's "capped at 3 entries" is a *guidance-for-the-model* rule carried
  in the param description ("maximum 3"); the window cap is the *code* clamp. Do **not** add a
  separate 3-entry code limit (the spec's clamping paragraph defines clamping purely against
  `maxWindowDays`; a hardcoded 3 would contradict the spec's "extras ignored, not an error"
  phrasing for out-of-window days and is not tested anywhere in spec §6).
- **Spec correction (recorded here, applied in Task 5):** the spec §3 example writes the
  light-sleep stage as `feheres` — a typo. The house label is **`könnyű`** (the hypnogram
  alphabet is `D=mély, L=könnyű, R=REM, A=éber` — `frontend/src/features/me/logic/sleepPhases.ts`,
  `SleepChart.tsx` legend). The plan and the rendered output use `könnyű`.
- **Hungarian UI strings** in tool output; code/identifiers in English.
- **Spring rules (ArchUnit-enforced):** constructor injection only, no `@Value`, read-only tool,
  `ToolContexts.userId`-scoped (never a model arg).
- **Commit subjects** carry the bd id: `feat(companion): ... (mezo-ohce)`.
- **Backend gate command** (per the house local recipe — full IT suite runs on CI, local is
  focused; compose up or use Testcontainers):
  `cd backend && ./mvnw clean test -Dtest='CompanionToolsRenderIT,CompanionToolRegistryIT,ChatServiceIT' -Dmezo.test.use-testcontainers=true`

## File structure

**Create:**
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/SleepLogDetailRenderIT.java` —
  all spec §6 ITs (kept separate from `CompanionToolsRenderIT` — a 1 409-line file — same
  package, same framework; §6.6a is covered by §6.1's full-line assert).

**Modify:**
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java`
  — new `DateBetween` derived finder (plain, no companion dependency).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/BiometricsTools.java` —
  3 new `@ToolParam`s, `renderSleepDetail`, `renderDetailLine`, `hm` helper, `@Tool` description.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` —
  `[Eszköz-útmutató]` sleep line in `SYSTEM_PROMPT`.
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/SleepLogPopulator.java` — one
  tracker-grade overload (stage minutes + source + hypnogram).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java` —
  the five existing `getRecovery(...)` call sites gain `null, null, null` before `ctx(...)` so they
  compile against the new signature (assertions untouched).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java` — one fake-tool
  turn test proving the `List<LocalDate>` arg reaches the tool (Spring AI's JSON→param
  conversion, `ChatServiceIT:64` recipe).
- `docs/features/companion.md` — §4 tool-catalog row, §5.5 tools-seam paragraph, §9 note.
- `docs/superpowers/specs/2026-08-24-sleep-log-detail-tool-design.md` — the `feheres`→`könnyű`
  typo fix.
- `docs/superpowers/plans/2026-08-24-sleep-log-detail-tool.md` — this plan (already committed
  with the spec on this branch; the remaining doc updates land in Task 5).

## Spec §6 test-case → task map

| spec §6 case | test (in `SleepLogDetailRenderIT` unless noted) | task |
|---|---|---|
| 1. one `date` → full line, every populated field | `testRenderDetailOneDate_shouldRenderFullLine_whenRowIsPopulated` | 2 |
| 2. 2–3 `date`s → each rendered, newest first | `testRenderDetailMultipleDates_shouldRenderEachNewestFirst_whenTwoOrThreeDates` | 2 |
| 3. `from` only / `from`+`to` → every logged day in range | `testRenderDetailFromOnly_shouldUseTodayAsTo_whenToOmitted` · `testRenderDetailFromTo_shouldRenderEveryLoggedDayInRange_whenRangeGiven` | 2 |
| 4. range wider than window cap → clamped, header shows trimmed count | `testRenderDetailWideRange_shouldClampToWindow_andShowTrimmedCount_inHeader` | 2 |
| 5. requested day without row → `nincs rögzített alvás` | `testRenderDetailMissingDay_shouldRenderExplicitNothingLine_whenNoRowOnDay` | 2 |
| 6. screenshot row → tracker fields + hypnogram; manual sparse → only populated | §6.6a is covered by the §6.1 full-line assert (`testRenderDetailOneDate_…`) · `testRenderDetailManualRow_shouldOmitAbsentFields_whenSparse` | 2 |
| 7. date/range on checkins / sleep-goal → ignored, existing output | `testRenderDetailParams_shouldBeIgnored_whenScopeCheckins` · `testRenderDetailParams_shouldBeIgnored_whenScopeSleepGoal` | 3 |
| 8. default call → byte-identical compact (regression) | existing `CompanionToolsRenderIT` tests, **unmodified** + new `testRenderDetailAbsentParams_shouldKeepCompactOutput_whenNoDateParams` | 3 |
| — Spring AI JSON→`List<LocalDate>` conversion | `ChatServiceIT` fake-tool turn test | 4 |

---

### Task 1: repository finder + tracker-grade populator overload

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/SleepLogPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/SleepLogDetailRenderIT.java` (new — Task 2 adds the detail ITs here; this task adds the shared scaffolding + one finder smoke test)

**Interfaces:**
- Produces: `SleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(UUID createdBy, LocalDate from, LocalDate to) → List<SleepLogEntity>` (newest first);
  `SleepLogPopulator.createTrackerSleepLog(UUID owner, LocalDate date, String bedtime, String wakeup, BigDecimal durationH, Integer quality, Integer awakenings, Integer inBedMin, Integer awakeMin, Integer lightMin, Integer remMin, Integer deepMin, Integer sourceQualityPct, String source, SleepHypnogram hypnogram, String notes) → SleepLogEntity`.
- Consumes: `SleepLogEntity` setters (Lombok `@Setter`), `SleepHypnogram(Integer bucketMin, String stages)`.

- [x] **Step 1: Add the finder (production code, no test yet — it is exercised by the IT in Step 3)**

`SleepLogRepository.java`, below the existing `DateGreaterThanEqual` finder:

```java
    /** Detail window for the companion get_recovery(scope=sleep) date/from/to params (mezo-ohce)
     *  — plain derived finder, no companion dependency. Inclusive bounds, newest first. */
    List<SleepLogEntity> findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
            UUID createdBy, LocalDate from, LocalDate to);
```

- [x] **Step 2: Add the tracker-grade populator overload**

`SleepLogPopulator.java`, append (after the 5-arg `createSleepLog` overload). Every field explicit
so the IT can seed both fully-enriched screenshot rows and sparse manual rows from one factory:

```java
    /** Tracker-grade (screenshot) row — every enrichment field explicit (mezo-dbsr/mezo-fk9a);
     *  nulls allowed so sparse manual rows seed from the same factory (mezo-ohce). */
    public SleepLogEntity createTrackerSleepLog(UUID owner, LocalDate date, String bedtime, String wakeup,
        BigDecimal durationH, Integer quality, Integer awakenings, Integer inBedMin, Integer awakeMin,
        Integer lightMin, Integer remMin, Integer deepMin, Integer sourceQualityPct, String source,
        SleepHypnogram hypnogram, String notes) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setBedtime(bedtime);
        e.setWakeup(wakeup);
        e.setDurationH(durationH);
        e.setQuality(quality);
        e.setAwakenings(awakenings);
        e.setInBedMin(inBedMin);
        e.setAwakeMin(awakeMin);
        e.setLightMin(lightMin);
        e.setRemMin(remMin);
        e.setDeepMin(deepMin);
        e.setSourceQualityPct(sourceQualityPct);
        e.setSource(source);
        e.setHypnogram(hypnogram);
        e.setNotes(notes);
        return sleepLogRepository.saveAndFlush(e);
    }
```

Import `io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram` in the populator.

- [x] **Step 3: Create `SleepLogDetailRenderIT` with scaffolding + finder smoke test (expect PASS)**

`SleepLogDetailRenderIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.ai.chat.model.ToolContext;

/**
 * get_recovery(scope=sleep) detail mode — on-demand full sleep-log rows (mezo-ohce). Spec:
 * docs/superpowers/specs/2026-08-24-sleep-log-detail-tool-design.md §3/§4/§6. Same package and
 * framework as CompanionToolsRenderIT; kept separate because that file is already 1.4k lines.
 * Detail rows are null-guarded: absent fields are omitted, never a fabricated value.
 */
class SleepLogDetailRenderIT extends AbstractIntegrationTest {

    @Autowired private BiometricsTools biometricsTools;
    @Autowired private SleepLogRepository sleepLogRepository;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private ToolCallAudit audit;

    // Verbatim mirror of CompanionToolsRenderIT's ctx helper (that file:106-112).
    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testSleepLogRepository_shouldReturnInclusiveNewestFirst_whenDateBetween() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(2), new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(5), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(9), new BigDecimal("5.0"), 2);

        List<SleepLogEntity> rows = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
                        owner, LocalDate.now().minusDays(7), LocalDate.now());

        assertThat(rows).extracting(SleepLogEntity::getDate)
                .containsExactly(LocalDate.now().minusDays(2), LocalDate.now().minusDays(5));
    }
}
```

(Also import `java.util.Map`; no `@BeforeEach`/`setUp` needed — `ctx()` creates a fresh audit per
call, exactly as `CompanionToolsRenderIT` does.)

- [x] **Step 4: Run (expect PASS)**

```bash
cd backend && ./mvnw clean test -Dtest='SleepLogDetailRenderIT' -Dmezo.test.use-testcontainers=true
```

- [x] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java \
        backend/src/test/java/io/mrkuhne/mezo/support/populator/SleepLogPopulator.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/SleepLogDetailRenderIT.java
git commit -m "feat(companion): sleep_log between-finder + tracker populator for get_recovery detail (mezo-ohce)"
```

---

### Task 2: `renderSleepDetail` — param plumbing, clamping, full-line rendering (spec §3, §5, §6.1–6.6)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/BiometricsTools.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java`
  (five call sites gain `null, null, null` — compile fix only, see Step 3)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/SleepLogDetailRenderIT.java`

**Interfaces:**
- Produces: `BiometricsTools.getRecovery(String scope, Integer days, List<LocalDate> date,
  LocalDate from, LocalDate to, ToolContext toolContext)` — the new public signature (the old
  3-arg form no longer exists; Spring AI binds params by name, so the `@ToolParam` names
  `date`/`from`/`to` are the wire names). Private `renderSleepDetail(UUID userId,
  List<LocalDate> date, LocalDate from, LocalDate to, ToolContext toolContext)` and
  `renderDetailLine(SleepLogEntity row)`.
- Consumes: `SleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc`
  (Task 1), `SleepLogEntity` getters incl. `getHypnogram() → SleepHypnogram(bucketMin, stages)`,
  `properties.tools().maxWindowDays()`, `ToolText.NO_DATA`, `ToolCallAudit.addRef`.

**RENDERING — single source of truth for this task (spec §3, Hungarian labels):**

One line per requested day, newest first. Fields in fixed order; **a field renders only when
non-null** (notes: only when non-blank) — absent fields are omitted, never rendered as zero:

```
<date>: lefekvés 23:15, ébredés 06:45; 7h 30p; ágyban 480p; ébren 12p · könnyű 210p · REM 90p · mély 68p; minőség 4/5; ébredések 2; forrás: screenshot (87%); hypnogram: 10 DDRRLDL…; megjegyzés: …
```

- Clock parts: `lefekvés <bedtime>` / `ébredés <wakeup>` — stored `HH:MM` strings, rendered as-is
  (only when non-null; either may appear alone, or both, or neither).
- Duration: `Xh Yp` from `durationH` (e.g. `7.5` → `7h 30p`; `7.0` → `7h`).
- `ágyban <inBedMin>p` — its own `;`-separated segment (only when non-null), exactly as the
  spec example (`…; Xh Yp; ágyban Zp; ébren A p · …`).
- Stage minutes — one `·`-separated segment, in the order awake → light → REM → deep, each only
  when non-null (if any are present the segment renders): `ébren <awakeMin>p`,
  `könnyű <lightMin>p`, `REM <remMin>p`, `mély <deepMin>p`.
- `minőség <quality>/5` (quality is the 1–5 integer), `ébredések <awakenings>`.
- Source: `forrás: <source>` + ` (<sourceQualityPct>%)` only when pct non-null.
- Hypnogram: `hypnogram: <bucketMin> <stages>` — raw stage-letter string, display-only
  (ADR 0015), only when the hypnogram is non-null.
- Notes: `megjegyzés: <notes>` only when non-blank (same rule as `get_weight_log`).
- **Requested day with no row:** `<date>: nincs rögzített alvás`.
- **Header:** `Alvás — részletes nézet:`; when clamping trimmed any requested day:
  `Alvás — részletes nézet, visszavágva <N> napra:` where **N = number of days actually rendered
  (the clamped set's size)** — the header always carries the rendered count, trimmed or not.
- **Audit:** `addRef("Sleep", date.toString())` per rendered day (row present **or** missing —
  the day was inspected), newest first, `limit(5)` like compact mode.

**Clamping (spec §2):** `today = LocalDate.now()`; `windowFrom = today.minusDays(maxWindowDays() - 1)`
(the same start point compact mode computes from `days=maxWindowDays()`). The requested day set is
the union of `date` entries (≤3 guidance — see Global Constraints) and the inclusive range
`max(from, windowFrom) .. min(to != null ? to : today, today)`. **`from` before `windowFrom` is
clamped up** (not just the entries — the range edge), **`to` after today is clamped down to
today**; out-of-window `date` entries are dropped. If any day was dropped (requested set ≠ clamped
set), the header carries the `visszavágva` suffix. After clamping the set is ≤ `maxWindowDays`
days (≤30 in the test env) — one `DateBetween` read over `[min of set, max of set]`, in-memory
filter to the set (no N+1).

- [x] **Step 1: Write the failing ITs (spec §6.1–6.6) in `SleepLogDetailRenderIT`**

Append to the class from Task 1 (imports: `SleepHypnogram`, `java.util.List`):

```java
    // ---- spec §6.1 — one date, fully populated tracker row -> every field on one line ----

    @Test
    void testRenderDetailOneDate_shouldRenderFullLine_whenRowIsPopulated() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createTrackerSleepLog(owner, d, "23:15", "06:45", new BigDecimal("7.5"),
                4, 2, 480, 12, 210, 90, 68, 87, "screenshot",
                new SleepHypnogram(10, "DDRRLDLRA"), "korán keltem");

        String out = biometricsTools.getRecovery("sleep", null, List.of(d), null, null, ctx(owner));

        assertThat(out).isEqualTo("Alvás — részletes nézet:\n"
                + d + ": lefekvés 23:15, ébredés 06:45; 7h 30p; ágyban 480p; ébren 12p · könnyű 210p · REM 90p · mély 68p; "
                + "minőség 4/5; ébredések 2; forrás: screenshot (87%); hypnogram: 10 DDRRLDLRA; megjegyzés: korán keltem");
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Sleep", d.toString()));
    }

    // ---- spec §6.2 — two dates -> each rendered, newest first ----

    @Test
    void testRenderDetailMultipleDates_shouldRenderEachNewestFirst_whenTwoOrThreeDates() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d3 = LocalDate.now().minusDays(3);
        LocalDate d1 = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, d3, new BigDecimal("6.0"), 3);
        sleepLogPopulator.createSleepLog(owner, d1, new BigDecimal("8.0"), 5);

        String out = biometricsTools.getRecovery("sleep", null, List.of(d3, d1), null, null, ctx(owner));

        assertThat(out).startsWith("Alvás — részletes nézet:\n");
        int newer = out.indexOf(d1.toString());
        int older = out.indexOf(d3.toString());
        assertThat(newer).isPositive().isLessThan(older); // newest first
        assertThat(out).contains(d1 + ": 8h").contains(d3 + ": 6h");
        assertThat(out).doesNotContain(LocalDate.now().minusDays(2).toString());
    }

    // ---- spec §6.3a — from only (to omitted -> today) ----

    @Test
    void testRenderDetailFromOnly_shouldUseTodayAsTo_whenToOmitted() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d3 = LocalDate.now().minusDays(3);
        LocalDate d2 = LocalDate.now().minusDays(2);
        sleepLogPopulator.createSleepLog(owner, d3, new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, d2, new BigDecimal("7.2"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now(), new BigDecimal("6.8"), 3);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(6), new BigDecimal("5.5"), 2);

        String out = biometricsTools.getRecovery("sleep", null, null, d3, null, ctx(owner));

        assertThat(out).startsWith("Alvás — részletes nézet:\n");
        assertThat(out).contains(d2.toString()).contains(d3.toString()).contains(LocalDate.now().toString());
        assertThat(out).doesNotContain(LocalDate.now().minusDays(6).toString()); // before `from`
    }

    // ---- spec §6.3b — from + to, every logged day in range ----

    @Test
    void testRenderDetailFromTo_shouldRenderEveryLoggedDayInRange_whenRangeGiven() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d5 = LocalDate.now().minusDays(5);
        LocalDate d2 = LocalDate.now().minusDays(2);
        sleepLogPopulator.createSleepLog(owner, d5, new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(3), new BigDecimal("7.4"), 4);
        sleepLogPopulator.createSleepLog(owner, d2, new BigDecimal("6.9"), 3);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(6), new BigDecimal("5.0"), 2);

        String out = biometricsTools.getRecovery("sleep", null, null, d5, d2, ctx(owner));

        assertThat(out).contains(d5.toString())
                .contains(LocalDate.now().minusDays(3).toString())
                .contains(d2.toString())
                .doesNotContain(LocalDate.now().minusDays(6).toString());
    }

    // ---- spec §6.4 — range wider than the window cap -> clamped, trimmed header ----
    // application.yml pins max-window-days=30 for tests (same fixture CompanionToolsRenderIT:180
    // relies on). A 60-day request must clamp to 30 days back and announce the trim.

    @Test
    void testRenderDetailWideRange_shouldClampToWindow_andShowTrimmedCount_inHeader() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(2), new BigDecimal("7.0"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(40), new BigDecimal("5.0"), 2); // outside window

        String out = biometricsTools.getRecovery("sleep", null, null, LocalDate.now().minusDays(59), null, ctx(owner));

        // clamped set = 30 days -> header carries the rendered count
        assertThat(out).startsWith("Alvás — részletes nézet, visszavágva 30 napra:\n");
        assertThat(out).contains(LocalDate.now().minusDays(2).toString());
        assertThat(out).doesNotContain(LocalDate.now().minusDays(40).toString());
    }

    // ---- spec §6.5 — requested day without a row -> explicit "nothing" ----

    @Test
    void testRenderDetailMissingDay_shouldRenderExplicitNothingLine_whenNoRowOnDay() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate empty = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(4), new BigDecimal("7.0"), 4);

        String out = biometricsTools.getRecovery("sleep", null, List.of(empty), null, null, ctx(owner));

        assertThat(out).isEqualTo("Alvás — részletes nézet:\n" + empty + ": nincs rögzített alvás");
        // the day WAS inspected -> it still gets a ref (spec §4: ref per expanded row)
        assertThat(audit.toRefsEnvelope().refs())
                .containsExactly(new RefsEnvelope.Ref("Sleep", empty.toString()));
    }

    // ---- spec §6.6a — screenshot row: tracker fields + hypnogram (asserted in §6.1's full line) ----

    // ---- spec §6.6b — manual sparse row: only populated fields, nothing fabricated ----

    @Test
    void testRenderDetailManualRow_shouldOmitAbsentFields_whenSparse() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d = LocalDate.now().minusDays(1);
        // duration + quality + awakenings; source keeps the entity's "manual" default, other fields stay null
        sleepLogPopulator.createSleepLog(owner, d, "23:40", "07:05", new BigDecimal("7.4"), 3, 1, null);

        String out = biometricsTools.getRecovery("sleep", null, List.of(d), null, null, ctx(owner));

        assertThat(out).isEqualTo("Alvás — részletes nézet:\n"
                + d + ": lefekvés 23:40, ébredés 07:05; 7h 24p; minőség 3/5; ébredések 1; forrás: manual");
        assertThat(out).doesNotContain("ágyban").doesNotContain("hypnogram")
                .doesNotContain("megjegyzés").doesNotContain("forrás: screenshot");
    }
```

> Add the imports the asserts need:
> `io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope` (same import as
> `CompanionToolsRenderIT:8`) and `io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram`.

- [x] **Step 2: Run — expect FAIL**

```bash
cd backend && ./mvnw clean test -Dtest='SleepLogDetailRenderIT' -Dmezo.test.use-testcontainers=true
```

(Compile failure: `getRecovery` has no 6-arg overload yet. That is the expected RED.)

- [x] **Step 3: Add the params + routing + `renderSleepDetail` to `BiometricsTools`**

In `BiometricsTools.java`:
1. `getRecovery` — add the three `@ToolParam`s after `days` (param descriptions carry the
   "≤3" guidance and the "ignored on other scopes" note — the spec's honest-absence rule):

```java
            @ToolParam(required = false, description = "Konkrét alvásnapok teljes részlete "
                    + "(YYYY-MM-DD), maximum 3 nap — csak scope=sleep, más scope-on nincs hatása. "
                    + "pl. [\"2026-08-23\"])")
            List<LocalDate> date,
            @ToolParam(required = false, description = "Részletes nézet kezdő napja (YYYY-MM-DD), "
                    + "tárgyilagos határ; elhagyva 'to': a mai napig — csak scope=sleep, más "
                    + "scope-on nincs hatása.")
            LocalDate from,
            @ToolParam(required = false, description = "Részletes nézet záró napja (YYYY-MM-DD), "
                    + "tárgyilagos; elhagyva: mai nap — csak scope=sleep, más scope-on nincs hatása.")
            LocalDate to,
```

2. Body — route by scope first (detail params apply only to sleep; on the other scopes they are
   never read, i.e. silently ignored):

```java
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeRecoveryScope(scope);
        if ("sleep-goal".equals(s)) {
            return renderSleepGoal(userId, toolContext);
        }
        if ("checkins".equals(s)) {
            return renderCheckIns(userId, days, toolContext);
        }
        boolean detail = date != null && !date.isEmpty() || from != null || to != null;
        return detail ? renderSleepDetail(userId, date, from, to, toolContext)
                : renderSleep(userId, days, toolContext);
```

3. `renderSleepDetail` + `renderDetailLine` + `hm` (below `renderSleep`; the compact method stays
   byte-identical):

```java
    /** scope=sleep detail mode (mezo-ohce) — full sleep_log rows for explicitly requested days.
     *  One read over the clamped window, in-memory filter; every field null-guarded (absent =
     *  omitted, never fabricated); a requested day without a row says "nincs rögzített alvás". */
    private String renderSleepDetail(UUID userId, List<LocalDate> date, LocalDate from, LocalDate to,
            ToolContext toolContext) {
        LocalDate today = LocalDate.now();
        LocalDate windowFrom = today.minusDays(properties.tools().maxWindowDays() - 1L);
        boolean clamped = false;

        // Requested day set = union of explicit dates and the inclusive range
        // (to omitted -> today; to omitted-AND-from omitted is not detail mode at all).
        java.util.Set<LocalDate> requested = new java.util.TreeSet<>();
        if (date != null) {
            requested.addAll(date);
        }
        if (from != null || to != null) {
            LocalDate lo = from != null ? from : windowFrom; // to-only: the range starts at the window start
            LocalDate hi = to == null ? today : to;          // from-only: the range ends at today
            if (hi.isAfter(today)) {
                clamped = true;
                hi = today;
            }
            if (lo.isBefore(windowFrom)) {
                clamped = true;
                lo = windowFrom;
            }
            if (!lo.isAfter(hi)) {
                for (LocalDate d = lo; !d.isAfter(hi); d = d.plusDays(1)) {
                    requested.add(d);
                }
            }
            // (lo.isAfter(hi) here = the whole range fell outside the window on the low side —
            //  nothing is added; `clamped` already reflects the edge trim above)
        }

        java.util.NavigableSet<LocalDate> days = new java.util.TreeSet<>();
        for (LocalDate d : requested) {
            if (d.isBefore(windowFrom) || d.isAfter(today)) {
                clamped = true;
            } else {
                days.add(d);
            }
        }

        String header = "Alvás — részletes nézet"
                + (clamped ? ", visszavágva " + days.size() + " napra" : "") + ":";
        if (days.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }

        // One read over the clamped window, then filter in memory (the set is <= maxWindowDays).
        List<SleepLogEntity> rows = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
                        userId, days.first(), days.last());
        java.util.Map<LocalDate, SleepLogEntity> byDate = new java.util.HashMap<>();
        for (SleepLogEntity r : rows) {
            byDate.putIfAbsent(r.getDate(), r); // rows are newest-first; keep the first per date
        }

        StringBuilder b = new StringBuilder(header);
        for (java.util.Iterator<LocalDate> it = days.descendingIterator(); it.hasNext(); ) {
            LocalDate d = it.next();
            SleepLogEntity row = byDate.get(d);
            b.append('\n').append(d).append(row == null ? ": nincs rögzített alvás" : ": " + renderDetailLine(row));
        }
        // Audit: one Sleep ref per rendered day (row present OR missing — the day was inspected),
        // newest first, capped at 5 like compact mode (spec §4).
        days.stream().sorted(java.util.Comparator.reverseOrder()).limit(5)
                .forEach(d -> ToolContexts.audit(toolContext).addRef("Sleep", d.toString()));
        return b.toString();
    }
```

> **Decisions inside the code (recorded here so the implementer doesn't re-litigate them):**
> - `to` given without `from`: the range starts at the window start (`windowFrom`) — the mirror
>   image of `from`-only defaulting `to` to today. The spec defines only `to`-omitted; this is the
>   only symmetric reading.
> - `clamped` is set when EITHER edge was trimmed or an out-of-window `date` entry was dropped —
>   i.e. whenever `requested` (before clamp) ≠ `days` (after).
> - `byDate.putIfAbsent` keeps the first row per date (rows arrive newest-first); one row per
>   `(created_by, date)` is the aggregate's uniqueness invariant.

4. `renderDetailLine` + `hm`:

```java
    /** One detail line for a populated row — fixed field order, every field null-guarded
     *  (absent fields omitted; spec §3). Clocks render as stored HH:MM strings. */
    private String renderDetailLine(SleepLogEntity row) {
        StringBuilder b = new StringBuilder();
        if (row.getBedtime() != null) {
            b.append("lefekvés ").append(row.getBedtime());
        }
        if (row.getWakeup() != null) {
            if (b.length() > 0) {
                b.append(", ");
            }
            b.append("ébredés ").append(row.getWakeup());
        }
        if (b.length() > 0) {
            b.append("; ");
        }
        if (row.getDurationH() != null) {
            b.append(hm(row.getDurationH()));
        }
        // ágyban is its own "; "-separated segment (spec example), the four stage minutes form
        // one "· "-separated segment: ágyban Zp; ébren A · könnyű B · REM C · mély D
        if (row.getInBedMin() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("ágyban ").append(row.getInBedMin()).append("p");
        }
        java.util.List<String> stages = new java.util.ArrayList<>();
        if (row.getAwakeMin() != null) {
            stages.add("ébren " + row.getAwakeMin() + "p");
        }
        if (row.getLightMin() != null) {
            stages.add("könnyű " + row.getLightMin() + "p");
        }
        if (row.getRemMin() != null) {
            stages.add("REM " + row.getRemMin() + "p");
        }
        if (row.getDeepMin() != null) {
            stages.add("mély " + row.getDeepMin() + "p");
        }
        if (!stages.isEmpty()) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append(String.join(" · ", stages));
        }
        if (row.getQuality() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("minőség ").append(row.getQuality()).append("/5");
        }
        if (row.getAwakenings() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("ébredések ").append(row.getAwakenings());
        }
        if (row.getSource() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("forrás: ").append(row.getSource());
            if (row.getSourceQualityPct() != null) {
                b.append(" (").append(row.getSourceQualityPct()).append("%)");
            }
        }
        if (row.getHypnogram() != null) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("hypnogram: ").append(row.getHypnogram().bucketMin()).append(' ')
                    .append(row.getHypnogram().stages());
        }
        if (row.getNotes() != null && !row.getNotes().isBlank()) {
            if (b.length() > 0) {
                b.append("; ");
            }
            b.append("megjegyzés: ").append(row.getNotes());
        }
        return b.toString();
    }

    /** 7.5 -> "7h 30p", 7.0 -> "7h" (house Hungarian compact hours). */
    private static String hm(BigDecimal hours) {
        int h = hours.intValue();
        int p = (int) Math.round((hours.doubleValue() - h) * 60);
        if (p == 60) {
            return (h + 1) + "h";
        }
        return p == 0 ? h + "h" : h + "h " + p + "p";
    }
```

5. **Compile fix for the existing tests** — in `CompanionToolsRenderIT`, the five `getRecovery(...)`
   calls (lines 180, 190, 200, 215, 226) gain `null, null, null` before `ctx(...)`, e.g.
   `biometricsTools.getRecovery("sleep", 90, null, null, null, ctx(owner))`. **Do not touch any
   assertion.** (If more call sites fail to compile — there are none by grep — fix them the same
   way.)

- [x] **Step 4: Run (expect PASS)**

```bash
cd backend && ./mvnw clean test -Dtest='SleepLogDetailRenderIT,CompanionToolsRenderIT' -Dmezo.test.use-testcontainers=true
```

- [x] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/BiometricsTools.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/SleepLogDetailRenderIT.java
git commit -m "feat(companion): get_recovery(scope=sleep) full sleep-log detail for date/from/to (mezo-ohce)"
```

---

### Task 3: `getRecovery` routing + param-ignoring on other scopes + compact regression (spec §6.7–6.8)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/SleepLogDetailRenderIT.java`
  (no production code — the routing already landed with Task 2 Step 3; this task pins the
  spec §6.7/§6.8 behaviours it introduced)

**Interfaces:**
- Consumes: `BiometricsTools.getRecovery(scope, days, date, from, to, toolContext)` (Task 2).

- [x] **Step 1: Write the failing ITs (spec §6.7–6.8)**

Append to `SleepLogDetailRenderIT`:

```java
    // ---- spec §6.7 — detail params on scope=checkins -> ignored, existing output ----

    @Test
    void testRenderDetailParams_shouldBeIgnored_whenScopeCheckins() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, LocalDate.now().minusDays(1), "08:00", 7, 3, null);
        // a sleep row on the requested date — must NOT appear in checkins output
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 4);

        String out = biometricsTools.getRecovery("checkins", null, List.of(LocalDate.now().minusDays(1)),
                LocalDate.now().minusDays(3), null, ctx(owner));

        assertThat(out).startsWith("Bejelentkezések (utolsó 7 nap):\n");
        assertThat(out).contains(LocalDate.now().minusDays(1) + " 08:00: energia 7/10");
        assertThat(out).doesNotContain("részletes").doesNotContain("lefekvés");
    }

    // ---- spec §6.7 — detail params on scope=sleep-goal -> ignored, existing output ----

    @Test
    void testRenderDetailParams_shouldBeIgnored_whenScopeSleepGoal() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner); // 7h30m target, 06:45 wake anchor (populator defaults)

        String out = biometricsTools.getRecovery("sleep-goal", null, List.of(LocalDate.now()),
                null, null, ctx(owner));

        assertThat(out).isEqualTo("Alvási cél: 7ó 30p alvás, ébredés 06:45, lefekvés 23:15; szabályosság ±15 perc");
        assertThat(out).doesNotContain("részletes");
    }

    // ---- spec §6.8 — default call, no new params -> byte-identical compact output ----

    @Test
    void testRenderDetailAbsentParams_shouldKeepCompactOutput_whenNoDateParams() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 4);

        String out = biometricsTools.getRecovery("sleep", 7, null, null, null, ctx(owner));

        // EXACTLY the pre-change compact format — the regression line (spec §6.8, §8).
        assertThat(out).isEqualTo("Alvás (utolsó 7 nap):\n"
                + LocalDate.now().minusDays(1) + ": 7.5 h, minőség 4/5");
    }
```

> Autowire `CheckInPopulator` and `SleepGoalPopulator` in `SleepLogDetailRenderIT` (same populator
> classes `CompanionToolsRenderIT` uses — signatures at `CompanionToolsRenderIT:209-226` above:
> `createCheckIn(owner, date, "08:00", energy, stress, null)` hardcodes body/mental to 3;
> `sleepGoalPopulator.goal(owner)` gives the 7h30m/06:45 fixture the sleep-goal IT there relies on).

- [x] **Step 2: Run (expect PASS)**

The routing is already in place (Task 2) — these tests should pass immediately. If any FAILS, the
routing regressed: fix `BiometricsTools`, not the test.

```bash
cd backend && ./mvnw clean test -Dtest='SleepLogDetailRenderIT' -Dmezo.test.use-testcontainers=true
```

- [x] **Step 3: Run the whole render+registry+chat suite (expect PASS)**

```bash
cd backend && ./mvnw clean test -Dtest='SleepLogDetailRenderIT,CompanionToolsRenderIT,CompanionToolRegistryIT,ChatServiceIT' -Dmezo.test.use-testcontainers=true
```

- [x] **Step 4: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/SleepLogDetailRenderIT.java
git commit -m "test(companion): pin get_recovery detail-mode scope isolation + compact regression (mezo-ohce)"
```

---

### Task 4: `@Tool` description + `SYSTEM_PROMPT` routing hint + schema/fake-tool wiring tests (spec §2)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/BiometricsTools.java`
  (the `@Tool` description on `getRecovery`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
  (`SYSTEM_PROMPT` `[Eszköz-útmutató]` sleep line — `companion_tool_conventions.md` requires the
  sync in the same change)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistryIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`

**Interfaces:**
- Consumes: `CompanionToolRegistryIT`'s existing `registry.callbacks(registry.newTurnAudit())`
  wiring (reads the tool definitions Spring AI generated from the `@Tool`/`@ToolParam` annotations);
  `ChatServiceIT`'s fake-tool recipe (`ChatServiceIT:64-76`).

- [x] **Step 1: Write the failing wiring tests**

`CompanionToolRegistryIT` — append (proves the generated schema carries the new params, so the
LLM can actually pass them):

```java
    @Test
    void testGetRecoverySchema_shouldExposeDateFromTo_andMaxThreeGuidance_whenV06DetailParams() {
        List<ToolCallback> callbacks = registry.callbacks(registry.newTurnAudit());
        String schema = callbacks.stream()
                .filter(cb -> cb.getToolDefinition().name().equals("get_recovery"))
                .findFirst().orElseThrow()
                .getToolDefinition().inputSchema();

        assertThat(schema).contains("\"date\"").contains("\"from\"").contains("\"to\"");
        assertThat(schema).contains("array");            // date is the only array-typed param
        assertThat(schema).contains("YYYY-MM-DD");       // ISO format documented in the schema
    }

    @Test
    void testGetRecoveryDescription_shouldCarryDetailFieldsAndTriggerClause_whenV06DetailParams() {
        List<ToolCallback> callbacks = registry.callbacks(registry.newTurnAudit());
        String description = callbacks.stream()
                .filter(cb -> cb.getToolDefinition().name().equals("get_recovery"))
                .findFirst().orElseThrow()
                .getToolDefinition().description();

        // spec §2: a scope=sleep sentence describing the detail fields + the trigger clause
        assertThat(description)
                .contains("részletes")          // the detail fields are advertised
                .contains("konkrét nap")        // the trigger: "a user konkrét nap ... kérdezi"
                .contains("hypnogram");
    }
```

`ChatServiceIT` — append (end-to-end: Spring AI must convert the JSON array into
`List<LocalDate>` and the tool must render detail; this is the only IT that exercises the
REAL param binding, not a direct method call):

```java
    @Test
    void testSendMessage_shouldBindListDates_whenFakeToolPassesDateArray() {
        UUID userId = databasePopulator.populateUser("chat-tools-detail@test.local");
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createTrackerSleepLog(userId, d, "23:00", "06:30", new BigDecimal("7.5"),
                4, 1, 450, 10, 200, 80, 60, 87, "screenshot",
                new io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram(10, "DRL"), null);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(),
                request("miért fáradt vagyok? [fake-tool:get_recovery {\"scope\":\"sleep\",\"date\":[\""
                        + d + "\"]}]"));

        // the fake echoed the REAL tool's rendered detail — proving JSON array -> List<LocalDate>
        assertThat(resp.getContent()).contains("tool:get_recovery=[\"Alvás — részletes nézet");
        assertThat(resp.getContent()).contains("lefekvés 23:00").contains("hypnogram: 10 DRL");
        assertThat(resp.getRefs()).extracting(MessageRef::getKind).contains("Sleep");
    }
```

> `createTrackerSleepLog` is the 16-arg populator overload from Task 1 — if it is not yet on the
> classpath when this IT is written, write this step AFTER Task 1's commit (the tasks are ordered
> that way already).

- [x] **Step 2: Run — expect FAIL**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionToolRegistryIT,ChatServiceIT' -Dmezo.test.use-testcontainers=true
```

(The schema/description tests fail on the missing param names/trigger text; the ChatServiceIT one
fails on the unrendered detail.)

- [x] **Step 3: Update the `@Tool` description and the system prompt**

`BiometricsTools.getRecovery` `@Tool` description — insert the scope=sleep detail sentence +
trigger clause **after** the existing scope=sleep sentence (keep the existing text, add to it):

```java
    @Tool(name = "get_recovery", description = "Regeneráció: alvás, alvási cél és napi közérzet. "
            + "scope=sleep (alapértelmezés) — alvásnapló az elmúlt napokra: dátum, óra, minőség (1-5), "
            + "ébredések. scope=sleep részletes nézet — a date (max 3 nap) vagy from/to paraméterekkel "
            + "a kért napok Teljes adatai: lefekvés/ébredés időpont, alvási idő, ágyban/ébren/könnyű/REM/"
            + "mély percek, minőség, ébredések, forrás (minőséggel), hypnogram, megjegyzés. scope=sleep-goal "
            + "— az alvási cél: cél alvásidő (óra/perc), ébredés/lefekvés időpontja, szabályossági sáv "
            + "(± perc). scope=checkins — bejelentkezések az elmúlt napokra: energia/stressz/testi/mentális "
            + "állapot (1-10) minden rögzített időpontra. Használd, amikor a user alvásról, alvás-céljáról/"
            + "ritmusáról, vagy közérzetéről (energia/stressz) kérdez — vagy amikor a user konkrét nap "
            + "alvási adatait / fázisait kérdezi (akkor a date vagy from/to paraméterrel). "
            + "scope: sleep (alapértelmezés), sleep-goal, checkins.")
```

`ChatService.SYSTEM_PROMPT` `[Eszköz-útmutató]` — extend the sleep line (keep the existing routing,
add the detail trigger):

```java
            - alvás, alvási cél, közérzet (energia/stressz) → get_recovery
            - konkrét nap alvási adata / fázisai / hypnogram → get_recovery (date vagy from/to)
```

- [x] **Step 4: Run (expect PASS)**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionToolRegistryIT,ChatServiceIT' -Dmezo.test.use-testcontainers=true
```

- [x] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/BiometricsTools.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistryIT.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java
git commit -m "feat(companion): get_recovery detail schema + system-prompt routing hint (mezo-ohce)"
```

---

### Task 5: docs in the same change (spec §7)

**Files:**
- Modify: `docs/features/companion.md` — §4 tool-catalog row for `get_recovery` (line ~2083),
  §5.5 tools-seam paragraph (line ~2552), §9 note if warranted
- Modify: `docs/superpowers/specs/2026-08-24-sleep-log-detail-tool-design.md` — the
  `feheres` → `könnyű` typo fix (Global Constraints)
- Run: `node scripts/lint-docs.mjs` (must be green before close)

**Interfaces:** none (docs only).

- [x] **Step 1: Update the §4 tool-catalog row**

In `docs/features/companion.md` §4, the `get_recovery(scope, days)` catalog row (line ~2083 —
"scope=sleep: `SleepLogRepository` since-date finder → duration, quality, awakenings"). Extend
the scope=sleep cell and the input/output cells:

```markdown
| `get_recovery(scope, days, date, from, to)` (mezo-xixu, merged from `get_sleep`, adds sleep-goal + check-ins; **mezo-ohce: on-demand full sleep-log detail** via `date` (≤3, ISO dates) / `from` / `to`) | scope=sleep: compact last-N-days (duration, quality, awakenings) **OR — any of `date`/`from`/`to` present — full detail per requested day via `SleepLogRepository` between-finder (bedtime, wakeup, duration, in-bed/awake/könnyű/REM/mély minutes, quality, awakenings, source+quality, hypnogram `bucketMin`+raw stages, notes; null-guarded, missing day → `nincs rögzített alvás`; window clamped to `tools().maxWindowDays()`, trimmed header `visszavágva N napra`)**; scope=sleep-goal: ... (unchanged) ... | scope=sleep: `Sleep`/date (≤5, detail mode: one per rendered day incl. missing); ... |
```

(Keep the sleep-goal and checkins cells of the row verbatim — only the scope=sleep portion
changes; the row is one long markdown table line, edit it in place.)

- [x] **Step 2: Update the §5.5 tools-seam paragraph**

In §5.5, the "V0.5 tools seam" paragraph (line ~2552: "V0.5 added **three plain finders** to the
owning features' repos"). Append a sentence:

```markdown
mezo-ohce added a fourth — `SleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc`
(inclusive window, newest first) for `get_recovery`'s detail mode.
```

- [x] **Step 3: Fix the spec typo**

`docs/superpowers/specs/2026-08-24-sleep-log-detail-tool-design.md` line ~61:
`ébredések k; forrás: screenshot (87%)` block — replace `feheres B p` with `könnyű B p`
(search `feheres` → should be exactly one occurrence).

- [ ] **Step 4: Regenerate CODEMAP if file lists changed, then lint**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs
```

(`SleepLogDetailRenderIT` is a new test class under `feature/companion` — CODEMAP's test list
should pick it up; the plan file itself is not CODEMAP-tracked. If the codemap diff is only the
new IT + this plan, commit it; otherwise keep the codemap as-is and note why in the PR body.)

- [x] **Step 5: Commit**

```bash
git add docs/features/companion.md docs/superpowers/specs/2026-08-24-sleep-log-detail-tool-design.md docs/CODEMAP.md docs/superpowers/plans/2026-08-24-sleep-log-detail-tool.md
git commit -m "docs(companion): get_recovery detail-mode catalog + plan + spec typo fix (mezo-ohce)"
```

---

## Final gate (before push)

- [ ] Full focused backend gate (compose up or Testcontainers):

```bash
cd backend && ./mvnw clean test -Dtest='SleepLogDetailRenderIT,CompanionToolsRenderIT,CompanionToolRegistryIT,ChatServiceIT' -Dmezo.test.use-testcontainers=true
```

- [ ] `node scripts/lint-docs.mjs` green.
- [ ] `git status` clean; branch commits all carry `(mezo-ohce)`.

## Ship (house git flow)

- [ ] `git push -u origin feat/sleep-log-detail-tool`
- [ ] `gh pr create` (self-PR = the CI gate; body links bd `mezo-ohce` + spec)
- [ ] `gh pr checks <PR#> --watch` until green (CI runs the FULL backend IT suite — the local run was focused)
- [ ] After green: `git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo pull --rebase`, merge the
      branch with `--no-ff`, push main (the PR auto-closes)
- [ ] `bd close mezo-ohce && bd dolt push`; delete the branch locally + on the remote
- [ ] `git status` clean and "up to date with origin" in both the worktree and the primary repo

## Self-review notes

- **Spec §2 (signature):** `date`/`from`/`to` params, precedence (any present → detail mode,
  `days` ignored), `to` omitted → today, union semantics, sleep-only applicability → Tasks 2 + 3.
  `@Tool` description + `[Eszköz-útmutató]` sync → Task 4.
- **Spec §3 (rendering):** line format, null-guarding, `nincs rögzített alvás`, headers incl.
  trimmed count → Task 2 (the `RENDERING` contract below is the single source of truth).
- **Spec §4 (audit):** `Sleep`/date refs per expanded row, ≤5 cap → Task 2.
- **Spec §5 (data access):** one `DateBetween` finder + in-memory filter → Tasks 1 + 2.
- **Spec §6 (testing):** all eight cases mapped in the table above.
- **Spec §7 (docs):** companion.md §4/§5.5 + lint → Task 5.
- **Deliberate decisions (recorded, not silently reversed):**
  - "capped at 3" = param-description guidance, window cap = code clamp (Global Constraints).
  - Detail ITs live in a **new** `SleepLogDetailRenderIT` rather than growing the 1 409-line
    `CompanionToolsRenderIT` (same package/framework; `CompanionToolsRenderIT` stays the
    regression home and is unmodified).
  - "visszavágva N napra" N = the size of the clamped day set actually rendered (the header
    always carries the rendered count, trimmed or not) — the spec's "shows the trimmed count"
    is satisfied because the trimmed count IS the rendered count.
  - Spec typo `feheres` → `könnyű` (Global Constraints), fixed in the spec doc itself in Task 5.
