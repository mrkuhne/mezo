# Gamified Growth E3 — Life Integrations & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the E3 polish layer: `savingsHuf30d` on the progression profile + Me GrowthCard stat, deterministic adaptive quest difficulty, companion flavor copy on the morning quest cron, and weekly growth integration (a new `GET /api/progression/growth-week/{date}` aggregate feeding a new Insights Weekly GrowthWeekCard AND a NÖVEKEDÉS block in the proactive weekly-suggestion + memoir digests).

**Architecture:** Zero DDL — everything derives from existing tables. One new port (`ActivityLedgerSource` in progression, impl in activity — the `QuestLedgerSource` pattern) carries both the 30-day savings sum and per-window activity counts. One new aggregate service (`GrowthWeekService` in progression) composes quest/LIFE-XP/activity stats per ISO week and is consumed by BOTH the new REST endpoint (FE Insights) and a new proactive `GrowthDigestBlock` (weekly-suggestion + memoir). Adaptive difficulty is a deterministic per-slot 28-day completion-ratio band in `QuestSelector` (difficulty yields to availability, like cooldown). Flavor copy is a strict-JSON LLM rewrite of `title`/`why` ONLY, hooked exclusively into `QuestJob.runGenerate` (the cron path — the lazy read path stays LLM-free and fast), with catalog copy as the fallback on any failure.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven; Jackson 3 (`tools.jackson`); OpenAPI contract-first codegen; React 19 + TanStack Query + MSW/Vitest. No Liquibase changes.

**Driving bd issue:** `mezo-6ng8` (child of umbrella epic `mezo-52vz`). Spec: `docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md` §4 (adaptive difficulty, flavor), §5 (finance thin-slice), §10 E3 row + user decisions 2026-07-11 (weekly = proactive digests AND Insights section; adaptive banding approved; flavor at generation, default ON; savings = profile + GrowthCard).

## Global Constraints

- **No DDL.** No new tables/columns; no Liquibase changeset. Everything derives from `daily_quest`, `activity_log`, `level_up_event`.
- Base package `io.mrkuhne.mezo`. Contract-first: edit `api/feature/progression/progression.yml` BEFORE backend code; controllers implement generated `<Tag>Api`; never hand-write boundary DTOs.
- Week identity = **ISO Monday** (`date.with(DayOfWeek.MONDAY)`), week = [monday, monday+6]; instants convert via `ZoneId.systemDefault()` (the `TraitCalculator` precedent).
- Ports live in `feature/progression`, impls point INTO progression (ArchUnit `feature_slices_are_cycle_free`); switch-gated impls consumed via `ObjectProvider`. New acyclic edges allowed: proactive→progression.
- Config only under `mezo:` — new sub-switch `mezo.quest.flavor.enabled` (+ `FeaturesConfiguration.QUEST_FLAVOR_SWITCH`, no `matchIfMissing`); adaptive tunables as a nested `@Valid` record in `QuestProperties` (prefix `mezo.quest.adaptive`); **never `@Value`**.
- ADR 0010 invariants: flavor rewrite may change `title`/`why` ONLY — never metric/threshold/XP/skill; any LLM failure or invalid answer keeps catalog copy; the LLM never enters the economy (adaptive difficulty is pure rule-based).
- Adaptive banding (user-approved): per-slot 28-day ratio `completed/(completed+expired)`; closed < minSample(5) → all tiers {1,2,3}; ratio ≥ 0.85 → {1,2,3}; ratio ≤ 0.50 → {1}; else → {1,2}. Difficulty yields to availability (empty filtered pool → unfiltered pool). All thresholds config.
- Errors: `SystemRuntimeErrorException` + `SystemMessage.error("CODE")`; tests integration-first (populators, AssertJ, `test{Method}_should{Result}_when{Condition}`), LLM tests via `@ActiveProfiles("companion-fake")` + `[fake-quest-flavor:...]` sentinel; TDD RED→GREEN.
- Maven: ALWAYS `./mvnw clean test`; focused `-Dtest=<Class> -DargLine=-Xmx3g` only (full suite = CI). Frontend: hooks via `@/data/hooks` barrel, dual-mode discipline, colocated tests, both modes green.
- HU copy verbatim as written in tasks; HUF formatting: `` `${v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')} Ft` ``.
- Commits: conventional subject + `(mezo-6ng8)`; in this worktree ALWAYS `git -c core.hooksPath=/dev/null commit ...`; `bd` only from the MAIN checkout.
- Branch: `feat/growth-e3` (already cut from `origin/main` @ 7d49ec13). Landing: push → self-PR → CI green → `gh pr merge --merge`.

## File Structure

**Contract:** Modify `api/feature/progression/progression.yml` (profile += `savingsHuf30d`; new path `/api/progression/growth-week/{date}` + `GrowthWeekResponse`); regen `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`.

**Backend (new):**
- `.../feature/progression/ActivityLedgerSource.java` (port) · `.../feature/activity/service/ActivityLedgerAdapter.java` (impl)
- `.../feature/progression/service/GrowthWeekService.java`
- `.../feature/quest/service/QuestFlavor.java`
- `.../feature/proactive/service/GrowthDigestBlock.java`
- Tests: `feature/progression/ProfileSavingsIT.java`, `feature/progression/GrowthWeekApiIT.java`, `feature/quest/QuestAdaptiveDifficultyIT.java`, `feature/quest/QuestFlavorIT.java`, `feature/proactive/GrowthDigestBlockIT.java`

**Backend (modified):**
- `ActivityLogRepository.java` (+between finder), `LevelUpEventRepository.java` (+entities-since finder), `DailyQuestRepository.java` (+per-slot window count)
- `ProgressionService.java` (getProfile += savings), `ProgressionController.java` (+growth-week delegate)
- `QuestProperties.java` (+Adaptive record), `QuestCatalog.java` (validate difficulty 1..3), `QuestSelector.java` (adaptive filter), `QuestJob.java` (flavor hook), `FeaturesConfiguration.java` (+QUEST_FLAVOR_SWITCH), `FakeCompanionLlm.java` (+flavor mirror), `application.yml`
- `WeeklySuggestionGenerator.java` + `MemoirGenerator.java` (digest block wiring); `QuestJobIT.java` (companion-fake profile)

**Frontend (new):** `data/insights/growthWeekApi.ts`, `features/insights/components/GrowthWeekCard.tsx` (+test)

**Frontend (modified):** `data/insights/weeklyHooks.ts` (+growthWeek), `data/insights/insights.ts` (mock seed), `data/types.ts` (WeeklyGrowth type), `features/insights/pages/WeeklyPage.tsx` (third card), `features/me/components/GrowthCard.tsx` (+savings row, +test case), `data/progression/progressionMock.ts`, `test/msw/handlers.ts` (profile += savings; growth-week default)

**Docs:** `docs/features/growth.md`, `insights.md`, `me.md`, `docs/milestones/roadmap.md`

---

### Task 1: Contract — profile `savingsHuf30d` + growth-week endpoint + regen

**Files:**
- Modify: `api/feature/progression/progression.yml`; regen `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (backend, regenerated during maven): `ProgressionProfileResponse.getSavingsHuf30d()` (Long, nullable); generated `ProgressionApi.getGrowthWeek(LocalDate date)` → `GrowthWeekResponse` (builder) with fields `weekStart (LocalDate), questCompleted (Integer), questClosed (Integer), lifeXp (Long), activities (Integer), savingsHuf (Long)`.
- Produces (FE): `paths['/api/progression/growth-week/{date}']` in `api.gen.ts`; optional `savingsHuf30d` on the profile schema (nullable → NOT in `required`, so no FE keep-green edits are expected).

- [ ] **Step 1: Commit this plan file**

```bash
git add docs/superpowers/plans/2026-07-11-gamified-growth-e3-life-polish.md
git -c core.hooksPath=/dev/null commit -m "docs(plans): E3 life-integrations implementation plan (mezo-6ng8)"
```

- [ ] **Step 2: Extend `progression.yml`.** In `ProgressionProfileResponse.properties`, right after `athleteLevel`, add (do NOT touch the `required` list):

```yaml
        savingsHuf30d:
          type: integer
          format: int64
          nullable: true
          description: Sum of AI-extracted amountHuf on financial activity entries, trailing 30 days; null when the activity feature is off
```

Add the new path after the existing profile path:

```yaml
  /api/progression/growth-week/{date}:
    get:
      tags: [Progression]
      operationId: getGrowthWeek
      summary: Weekly growth aggregate — quests, LIFE XP, activities, savings (Progression)
      description: >-
        Aggregates the ISO week (Monday-keyed) containing the given date: closed daily-quest
        counts, LIFE XP earned (level_up_event gains), activity-log entry count and the week's
        savings sum. Honest zeros when nothing happened — never a 404.
      parameters:
        - name: date
          in: path
          required: true
          schema: { type: string, format: date }
      responses:
        '200':
          description: The week's growth aggregate
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GrowthWeekResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

And the schema next to `ProfileTraits`:

```yaml
    GrowthWeekResponse:
      type: object
      required: [weekStart, questCompleted, questClosed, lifeXp, activities, savingsHuf]
      properties:
        weekStart: { type: string, format: date, description: ISO Monday of the aggregated week }
        questCompleted: { type: integer, format: int32 }
        questClosed: { type: integer, format: int32, description: completed + expired (rerolled/offered excluded) }
        lifeXp: { type: integer, format: int64, description: Sum of LIFE-kind gains in the week's level-up events }
        activities: { type: integer, format: int32, description: Activity-log entries dated in the week }
        savingsHuf: { type: integer, format: int64, description: Sum of financial amountHuf dated in the week }
```

- [ ] **Step 3: Merge + FE regen + build check**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api && pnpm build
```
Expected: `api/openapi.yml` gains the path; `api.gen.ts` gains `GrowthWeekResponse` + the optional profile field; build PASS (additions are optional/new — nothing breaks).

- [ ] **Step 4: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): profile savingsHuf30d + growth-week aggregate contract (mezo-6ng8)"
```

---

### Task 2: `ActivityLedgerSource` port + profile savings

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/ActivityLedgerSource.java`, `.../feature/activity/service/ActivityLedgerAdapter.java`
- Modify: `.../feature/activity/repository/ActivityLogRepository.java`, `.../feature/progression/service/ProgressionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProfileSavingsIT.java`

**Interfaces:**
- Produces (consumed by Task 3): `ActivityLedgerSource.stats(UUID createdBy, LocalDate from, LocalDate to)` → `ActivityLedgerSource.Stats(int entries, long savingsHuf)`; consumed via `ObjectProvider` (activity switch may be off). `ProgressionService.getProfile` now sets `savingsHuf30d` (null when port absent).
- Consumes: `ActivityPopulator.activity(...)` (sets `extracted = new ActivityExtract(30, null)` — for savings tests you need amountHuf, so ADD an overload, Step 2).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Profile savingsHuf30d: financial-entry amountHuf summed over the trailing 30 days. */
class ProfileSavingsIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGetProfile_shouldSumFinancialAmounts_whenInsideWindow() {
        UUID owner = userPopulator.createUser("sav-a@test.hu").getId();
        LocalDate today = LocalDate.now();
        activityPopulator.financialActivity(owner, today.minusDays(2), "Átraktam 50 ezret", 50000L);
        activityPopulator.financialActivity(owner, today.minusDays(29), "Régebbi spórolás", 20000L);
        activityPopulator.financialActivity(owner, today.minusDays(31), "Ablakon kívül", 99999L);
        // non-financial entry with an amount must NOT count
        activityPopulator.activity(owner, today, "Olvastam", "learning", 10, ActivityLogEntity.BY_AI);

        ProgressionProfileResponse profile = progressionService.getProfile(owner);

        assertThat(profile.getSavingsHuf30d()).isEqualTo(70000L);
    }

    @Test
    void testGetProfile_shouldReturnZeroSavings_whenNoFinancialEntries() {
        UUID owner = userPopulator.createUser("sav-b@test.hu").getId();

        assertThat(progressionService.getProfile(owner).getSavingsHuf30d()).isZero();
    }
}
```

- [ ] **Step 2: `ActivityPopulator.financialActivity` overload** — add to the populator:

```java
    /** Financial entry with an AI-extracted HUF amount (savings aggregate tests, E3). */
    public ActivityLogEntity financialActivity(UUID createdBy, LocalDate day, String text, Long amountHuf) {
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(createdBy);
        e.setOccurredOn(day);
        e.setText(text);
        e.setSkillKey("financial");
        e.setConfidence(new BigDecimal("0.900"));
        e.setXpAwarded(10);
        e.setXpSuggested(10);
        e.setExtracted(new ActivityExtract(null, amountHuf));
        e.setCategorizedBy(ActivityLogEntity.BY_AI);
        return repository.saveAndFlush(e);
    }
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProfileSavingsIT -DargLine=-Xmx3g`
Expected: FAIL — `getSavingsHuf30d()` is null (nothing populates it yet).

- [ ] **Step 4: Port + finder + adapter + wiring**

`ActivityLedgerSource.java`:
```java
package io.mrkuhne.mezo.feature.progression;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Port for the activity-log inputs of growth aggregates (savings + entry counts): progression
 * only needs the numbers; HOW they are stored belongs to feature/activity, which implements this
 * ({@code feature/activity/service/ActivityLedgerAdapter}) — dependency stays activity →
 * progression, never back (feature_slices_are_cycle_free). Bean exists only when the activity
 * switch is on; consume via ObjectProvider.
 */
public interface ActivityLedgerSource {

    record Stats(int entries, long savingsHuf) {}

    /** Entries dated in [from, to] + the sum of financial entries' extracted amountHuf. */
    Stats stats(UUID createdBy, LocalDate from, LocalDate to);
}
```

`ActivityLogRepository.java` add:
```java
    /** Window read for growth aggregates (entry count + financial amount sums in code). */
    List<ActivityLogEntity> findByCreatedByAndOccurredOnBetween(UUID createdBy, LocalDate from, LocalDate to);
```

`ActivityLedgerAdapter.java`:
```java
package io.mrkuhne.mezo.feature.activity.service;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.progression.ActivityLedgerSource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Activity side of the growth aggregates — see {@link ActivityLedgerSource}. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ACTIVITY_SWITCH, havingValue = "true")
public class ActivityLedgerAdapter implements ActivityLedgerSource {

    private final ActivityLogRepository repository;

    @Override
    public Stats stats(UUID createdBy, LocalDate from, LocalDate to) {
        List<ActivityLogEntity> rows = repository.findByCreatedByAndOccurredOnBetween(createdBy, from, to);
        long savings = rows.stream()
            .filter(r -> "financial".equals(r.getSkillKey()))
            .filter(r -> r.getExtracted() != null && r.getExtracted().amountHuf() != null)
            .mapToLong(r -> r.getExtracted().amountHuf())
            .sum();
        return new Stats(rows.size(), savings);
    }
}
```

In `ProgressionService`: add field `private final ObjectProvider<ActivityLedgerSource> activityLedgerSource;` (import `org.springframework.beans.factory.ObjectProvider` + the port). In `getProfile`, before the builder chain:
```java
        ActivityLedgerSource activityLedger = activityLedgerSource.getIfAvailable();
        Long savingsHuf30d = activityLedger == null ? null
            : activityLedger.stats(createdBy, LocalDate.now().minusDays(29), LocalDate.now()).savingsHuf();
```
and add `.savingsHuf30d(savingsHuf30d)` to the builder chain (next to `.athleteLevel(...)`).

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProfileSavingsIT -DargLine=-Xmx3g`
Expected: PASS (2 tests).

- [ ] **Step 6: Guard + commit**

Run: `cd backend && ./mvnw clean test -Dtest='Progression*,Activity*,ArchitectureTest' -DargLine=-Xmx3g` → PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression backend/src/main/java/io/mrkuhne/mezo/feature/activity backend/src/test/java/io/mrkuhne/mezo
git -c core.hooksPath=/dev/null commit -m "feat(progression): savingsHuf30d on the profile via ActivityLedgerSource port (mezo-6ng8)"
```

---

### Task 3: `GrowthWeekService` + growth-week endpoint

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/GrowthWeekService.java`
- Modify: `.../feature/progression/repository/LevelUpEventRepository.java`, `.../feature/progression/controller/ProgressionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/GrowthWeekApiIT.java`

**Interfaces:**
- Consumes: `QuestLedgerSource` (existing, ObjectProvider), `ActivityLedgerSource` (Task 2, ObjectProvider), `LevelUpEventRepository`.
- Produces (consumed by Task 6): `public GrowthWeekResponse growthWeek(UUID createdBy, LocalDate anyDayOfWeek)` — resolves the ISO Monday itself; honest zeros.

- [ ] **Step 1: Write the failing IT** (HTTP level — model helper calls on `GrowthWeekApiIT`'s sibling `QuestApiIT`/`ActivityApiIT` idioms: `ownerAuthHeaders()`, `getForBody`, owner id via the `AppUserRepository`+`OwnerProperties` idiom used there):

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.feature.progression.activity.ActivitySignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/progression/growth-week — quests + LIFE XP + activities + savings per ISO week. */
class GrowthWeekApiIT extends ApiIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private ProgressionService progressionService;

    @Test
    void testGetGrowthWeek_shouldAggregateWeek_whenDataInWindow() {
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        UUID owner = ownerId();
        // quests: 1 completed + 1 expired in-week, 1 completed BEFORE the week (excluded)
        questPopulator.quest(owner, monday, DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery",
            "LIFE", "water_target", new java.math.BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, monday.plusDays(1), DailyQuestEntity.SLOT_BODY, "body_rest_sleep",
            "recovery", "LIFE", "sleep_target", new java.math.BigDecimal("7.5"), 20, DailyQuestEntity.STATUS_EXPIRED);
        questPopulator.quest(owner, monday.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_sleep", "recovery",
            "LIFE", "sleep_target", new java.math.BigDecimal("7.5"), 25, DailyQuestEntity.STATUS_COMPLETED);
        // LIFE XP: a real award this week (occurredAt = now → in the current week)
        progressionService.applyActivity(owner, new ActivitySignal(UUID.randomUUID(), "learning", 15, "Teszt"));
        // activities: 1 financial + 1 plain, both in-week
        activityPopulator.financialActivity(owner, monday, "Spórolás", 50000L);
        activityPopulator.activity(owner, monday.plusDays(1), "Olvastam", "learning", 15,
            io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity.BY_AI);

        GrowthWeekResponse res = getForBody("/api/progression/growth-week/" + monday.plusDays(2),
            GrowthWeekResponse.class, HttpStatus.OK);

        assertThat(res.getWeekStart()).isEqualTo(monday);
        assertThat(res.getQuestCompleted()).isEqualTo(1);
        assertThat(res.getQuestClosed()).isEqualTo(2);
        assertThat(res.getLifeXp()).isEqualTo(15L);
        assertThat(res.getActivities()).isEqualTo(2);
        assertThat(res.getSavingsHuf()).isEqualTo(50000L);
    }

    @Test
    void testGetGrowthWeek_shouldReturnZeros_whenNothingHappened() {
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);

        GrowthWeekResponse res = getForBody("/api/progression/growth-week/" + monday,
            GrowthWeekResponse.class, HttpStatus.OK);

        assertThat(res.getQuestClosed()).isZero();
        assertThat(res.getLifeXp()).isZero();
        assertThat(res.getActivities()).isZero();
        assertThat(res.getSavingsHuf()).isZero();
    }
}
```
NOTE: the LIFE-XP assertion uses a REAL `applyActivity` award (its `occurredAt` is now → inside the current week) — no back-dating needed. ADAPT the helper idioms (`ownerId()`, `getForBody`) to the exact `ApiIntegrationTest` API as `ActivityApiIT` does.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=GrowthWeekApiIT -DargLine=-Xmx3g`
Expected: FAIL — 404 (endpoint unimplemented).

- [ ] **Step 3: Finder + service + controller**

`LevelUpEventRepository.java` add:
```java
    /** Growth-week aggregation: full events since the horizon (payload gains summed in code). */
    List<LevelUpEventEntity> findByCreatedByAndOccurredAtGreaterThanEqual(UUID createdBy, Instant from);
```

`GrowthWeekService.java`:
```java
package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.feature.progression.ActivityLedgerSource;
import io.mrkuhne.mezo.feature.progression.QuestLedgerSource;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Weekly growth aggregate (E3, bd mezo-6ng8): closed daily quests, LIFE XP earned, activity-log
 * entries and savings per ISO week (Monday-keyed, system zone — the TraitCalculator precedent).
 * Consumed by the REST endpoint (Insights Weekly card) AND the proactive digest block. Honest
 * zeros — a week with no growth data is a fact, not an error.
 */
@Service
@RequiredArgsConstructor
public class GrowthWeekService {

    private final LevelUpEventRepository levelUpEventRepository;
    private final ObjectProvider<QuestLedgerSource> questLedgerSource;
    private final ObjectProvider<ActivityLedgerSource> activityLedgerSource;

    public GrowthWeekResponse growthWeek(UUID createdBy, LocalDate anyDayOfWeek) {
        LocalDate weekStart = anyDayOfWeek.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        int questCompleted = 0;
        int questClosed = 0;
        QuestLedgerSource quests = questLedgerSource.getIfAvailable();
        if (quests != null) {
            QuestLedgerSource.Stats s = quests.closedQuestStats(createdBy, weekStart, weekEnd);
            questCompleted = s.completed();
            questClosed = s.completed() + s.expired();
        }

        int activities = 0;
        long savingsHuf = 0;
        ActivityLedgerSource activityLedger = activityLedgerSource.getIfAvailable();
        if (activityLedger != null) {
            ActivityLedgerSource.Stats s = activityLedger.stats(createdBy, weekStart, weekEnd);
            activities = s.entries();
            savingsHuf = s.savingsHuf();
        }

        ZoneId zone = ZoneId.systemDefault();
        Instant from = weekStart.atStartOfDay(zone).toInstant();
        Instant until = weekEnd.plusDays(1).atStartOfDay(zone).toInstant();
        long lifeXp = levelUpEventRepository.findByCreatedByAndOccurredAtGreaterThanEqual(createdBy, from)
            .stream()
            .filter(e -> e.getOccurredAt().isBefore(until))
            .flatMap(e -> e.getPayload().gains().stream())
            .filter(g -> "LIFE".equals(g.kind()))
            .mapToLong(g -> g.xpGained())
            .sum();

        return GrowthWeekResponse.builder()
            .weekStart(weekStart)
            .questCompleted(questCompleted)
            .questClosed(questClosed)
            .lifeXp(lifeXp)
            .activities(activities)
            .savingsHuf(savingsHuf)
            .build();
    }
}
```

`ProgressionController.java`: read the file first and mirror its existing delegate style (implements generated `ProgressionApi`; inject `GrowthWeekService growthWeekService`); add:
```java
    @Override
    public ResponseEntity<GrowthWeekResponse> getGrowthWeek(LocalDate date) {
        return ResponseEntity.ok(growthWeekService.growthWeek(currentUserId.get(), date));
    }
```
(ADAPT: if the generated interface returns bare DTOs — no `ResponseEntity` — return the DTO directly, exactly like the existing `getProfile` delegate.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=GrowthWeekApiIT -DargLine=-Xmx3g`
Expected: PASS (2 tests).

- [ ] **Step 5: Guard + commit**

Run: `cd backend && ./mvnw clean test -Dtest='Progression*,ArchitectureTest' -DargLine=-Xmx3g` → PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression backend/src/test/java/io/mrkuhne/mezo/feature/progression
git -c core.hooksPath=/dev/null commit -m "feat(progression): growth-week aggregate service + endpoint (mezo-6ng8)"
```

---

### Task 4: Adaptive quest difficulty (deterministic banding)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/config/QuestProperties.java`, `.../feature/quest/QuestCatalog.java`, `.../feature/quest/repository/DailyQuestRepository.java`, `.../feature/quest/service/QuestSelector.java`, `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestAdaptiveDifficultyIT.java`

**Interfaces:**
- Produces: `QuestProperties.adaptive()` → `record Adaptive(int windowDays, int minSample, double highRatio, double lowRatio)`; `DailyQuestRepository.countByCreatedByAndSlotAndStatusAndQuestDateBetween(UUID, String, String, LocalDate, LocalDate)`; `QuestSelector` difficulty banding (private — observable via generate()).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.service.QuestSelector;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Adaptive difficulty banding (E3, spec §4 ~80% success target): per-slot 28d completion ratio
 * gates the allowed difficulty tiers; difficulty yields to availability; no history = all tiers.
 */
class QuestAdaptiveDifficultyIT extends AbstractIntegrationTest {

    @Autowired private QuestSelector selector;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;

    private static final LocalDate DATE = LocalDate.of(2026, 7, 15);

    /** 6 expired + 0 completed FUELBIO quests → ratio 0 ≤ lowRatio → only difficulty-1 picks. */
    @Test
    void testGenerate_shouldPickOnlyEasyFuelBio_whenSlotRatioLow() {
        UUID owner = userPopulator.createUser("adapt-low@test.hu").getId();
        for (int i = 1; i <= 6; i++) {
            questPopulator.quest(owner, DATE.minusDays(i), DailyQuestEntity.SLOT_FUELBIO,
                "bio_checkin_full", "recovery", "LIFE", "checkin_full", new BigDecimal("4"),
                20, DailyQuestEntity.STATUS_EXPIRED);
        }

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        // difficulty-1 FUELBIO keys are bio_weight_log and bio_water
        assertThat(quests).filteredOn(q -> q.getSlot().equals(DailyQuestEntity.SLOT_FUELBIO))
            .first().extracting(DailyQuestEntity::getCatalogKey)
            .isIn("bio_weight_log", "bio_water");
    }

    /** Low BODY ratio on a GYM-less (REST) day: body_rest_sleep is difficulty 2 — the only
     *  candidate — so difficulty must yield to availability and still fill the slot. */
    @Test
    void testGenerate_shouldStillFillBodySlot_whenLowRatioFiltersWholePool() {
        UUID owner = userPopulator.createUser("adapt-yield@test.hu").getId();
        for (int i = 1; i <= 6; i++) {
            questPopulator.quest(owner, DATE.minusDays(i), DailyQuestEntity.SLOT_BODY,
                "body_rest_sleep", "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"),
                20, DailyQuestEntity.STATUS_EXPIRED);
        }

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        assertThat(quests).filteredOn(q -> q.getSlot().equals(DailyQuestEntity.SLOT_BODY))
            .first().extracting(DailyQuestEntity::getCatalogKey).isEqualTo("body_rest_sleep");
    }

    /** No history (< minSample closed) → all tiers allowed — E2 behavior byte-identical. */
    @Test
    void testGenerate_shouldAllowAllTiers_whenNoHistory() {
        UUID owner = userPopulator.createUser("adapt-none@test.hu").getId();

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        assertThat(quests).hasSize(3); // all three slots fill exactly as before
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=QuestAdaptiveDifficultyIT -DargLine=-Xmx3g`
Expected: test 1 FAILS (no banding yet — the deterministic hash may pick a difficulty-2/3 key); tests 2–3 may pass already. If test 1 happens to pass by hash luck, temporarily assert the full pool: verify with a second seeded user; the implementation step makes it deterministic regardless.

- [ ] **Step 3: Implement**

`QuestProperties.java` — extend the record (imports: `jakarta.validation.Valid`, `jakarta.validation.constraints.*`):
```java
@Validated
@ConfigurationProperties(prefix = "mezo.quest")
public record QuestProperties(
    @Min(0) int rerollPerDay,        // 1
    @NotBlank String generateCron,   // "0 35 6 * * *"
    @NotBlank String finalizeCron,   // "0 5 0 * * *"
    @NotNull @Valid Adaptive adaptive
) {
    /** Adaptive difficulty banding (E3, spec §4): per-slot completion-ratio → allowed tiers. */
    public record Adaptive(
        @Min(1) int windowDays,                            // 28
        @Min(1) int minSample,                             // 5
        @DecimalMin("0.0") @DecimalMax("1.0") double highRatio,  // 0.85
        @DecimalMin("0.0") @DecimalMax("1.0") double lowRatio    // 0.50
    ) {}
}
```

`application.yml` — extend the `mezo.quest` block:
```yaml
    # Adaptive difficulty (E3, ADR 0010 — rule-based, no LLM in the economy): per-slot 28-day
    # completion ratio bands the allowed difficulty tiers; <min-sample closed quests = all tiers.
    adaptive:
      window-days: 28
      min-sample: 5
      high-ratio: 0.85
      low-ratio: 0.50
```

`QuestCatalog.java` — extend `validate(...)` with `&& d.difficulty() >= 1 && d.difficulty() <= 3` (the field goes live; all 14 entries already carry 1–3).

`DailyQuestRepository.java` add:
```java
    /** Adaptive-difficulty window count (per slot + terminal status). */
    int countByCreatedByAndSlotAndStatusAndQuestDateBetween(
        UUID createdBy, String slot, String status, LocalDate from, LocalDate to);
```

`QuestSelector.java` — inject `private final QuestProperties properties;` and add the banding. New private method:
```java
    /** Allowed difficulty tiers for a slot from its trailing completion ratio (E3, spec §4). */
    private Set<Integer> allowedDifficulties(UUID userId, LocalDate date, String slot) {
        QuestProperties.Adaptive a = properties.adaptive();
        LocalDate from = date.minusDays(a.windowDays());
        LocalDate to = date.minusDays(1);
        int completed = repository.countByCreatedByAndSlotAndStatusAndQuestDateBetween(
            userId, slot, DailyQuestEntity.STATUS_COMPLETED, from, to);
        int expired = repository.countByCreatedByAndSlotAndStatusAndQuestDateBetween(
            userId, slot, DailyQuestEntity.STATUS_EXPIRED, from, to);
        int closed = completed + expired;
        if (closed < a.minSample()) {
            return Set.of(1, 2, 3); // not enough signal — v1 behavior
        }
        double ratio = (double) completed / closed;
        if (ratio >= a.highRatio()) {
            return Set.of(1, 2, 3);
        }
        if (ratio <= a.lowRatio()) {
            return Set.of(1);
        }
        return Set.of(1, 2);
    }
```
In `pick(...)`: compute `Set<Integer> allowed = allowedDifficulties(userId, date, slot);` first, then apply the same yield-to-availability layering the cooldown already uses — the preference order is: (1) in-band AND off-cooldown, (2) in-band, (3) any eligible:
```java
        List<QuestCatalog.QuestDef> base = eligible(slot, dayType, segment, usedMetrics);
        List<QuestCatalog.QuestDef> banded = base.stream()
            .filter(d -> allowed.contains(d.difficulty()))
            .toList();
        if (banded.isEmpty()) {
            banded = base; // difficulty yields to availability
        }
        List<QuestCatalog.QuestDef> pool = banded.stream()
            .filter(d -> !inCooldown(d, date, recent))
            .toList();
        if (pool.isEmpty()) {
            pool = banded; // cooldown yields to availability (existing rule)
        }
```
In `replacement(...)`: apply the same banding to its pool (compute `allowed` for `old.getSlot()`, filter the pool, fall back to unfiltered when empty).

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=QuestAdaptiveDifficultyIT -DargLine=-Xmx3g`
Expected: PASS (3 tests).

- [ ] **Step 5: Guard the quest suite** — the existing selector/API ITs seed NO history (< minSample → all tiers), so determinism assertions must hold unchanged:

Run: `cd backend && ./mvnw clean test -Dtest='Quest*' -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/quest backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/quest
git -c core.hooksPath=/dev/null commit -m "feat(quest): deterministic adaptive difficulty banding per slot (mezo-6ng8)"
```

---

### Task 5: Companion flavor copy on the morning cron

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestFlavor.java`
- Modify: `.../techcore/configuration/FeaturesConfiguration.java`, `.../feature/companion/llm/FakeCompanionLlm.java`, `.../feature/quest/service/QuestJob.java`, `backend/src/main/resources/application.yml`, `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestJobIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestFlavorIT.java`

**Interfaces:**
- Produces: `QuestFlavor.rewrite(List<DailyQuestEntity> quests)` — mutates+persists `title`/`why` only; bean gated on QUEST + COMPANION + QUEST_FLAVOR switches, consumed via `ObjectProvider` in `QuestJob`. `FeaturesConfiguration.QUEST_FLAVOR_SWITCH = "mezo.quest.flavor.enabled"`.
- ADR 0010: metric/threshold/XP/skill NEVER change; any failure keeps catalog copy.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestFlavor;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** Flavor rewrite (E3): companion voice on title/why ONLY; catalog copy on any bad answer. */
@ActiveProfiles("companion-fake")
class QuestFlavorIT extends AbstractIntegrationTest {

    @Autowired private QuestFlavor flavor;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private DailyQuestRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRewrite_shouldOverwriteTitleAndWhy_whenScriptedAnswerValid() {
        UUID owner = userPopulator.createUser("flavor-a@test.hu").getId();
        DailyQuestEntity q = questPopulator.quest(owner, LocalDate.now(), DailyQuestEntity.SLOT_FUELBIO,
            "bio_water", "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15,
            DailyQuestEntity.STATUS_OFFERED);
        // the sentinel rides the quest title into the fake's user message
        q.setTitle("Igyál vizet [fake-quest-flavor:[{\"title\":\"A hidratált Daniel ma is iszik 2,5 litert\","
            + "\"why\":\"A tegnapi edzés után a tested ma vizet kér — add meg neki.\"}]]");
        repository.saveAndFlush(q);

        flavor.rewrite(List.of(q));

        DailyQuestEntity reloaded = repository.findByIdAndCreatedBy(q.getId(), owner).orElseThrow();
        assertThat(reloaded.getTitle()).isEqualTo("A hidratált Daniel ma is iszik 2,5 litert");
        assertThat(reloaded.getWhy()).startsWith("A tegnapi edzés után");
        assertThat(reloaded.getTarget().metric()).isEqualTo("water_target"); // economy untouched
        assertThat(reloaded.getXp()).isEqualTo(15);
    }

    @Test
    void testRewrite_shouldKeepCatalogCopy_whenAnswerIsGarbage() {
        UUID owner = userPopulator.createUser("flavor-b@test.hu").getId();
        DailyQuestEntity q = questPopulator.quest(owner, LocalDate.now(), DailyQuestEntity.SLOT_FUELBIO,
            "bio_water", "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15,
            DailyQuestEntity.STATUS_OFFERED);
        q.setTitle("Igyál vizet [fake-quest-flavor:ez nem json]");
        repository.saveAndFlush(q);

        flavor.rewrite(List.of(q));

        assertThat(repository.findByIdAndCreatedBy(q.getId(), owner).orElseThrow().getTitle())
            .startsWith("Igyál vizet"); // untouched
    }

    @Test
    void testRewrite_shouldKeepCatalogCopy_whenAnswerCountMismatches() {
        UUID owner = userPopulator.createUser("flavor-c@test.hu").getId();
        DailyQuestEntity q = questPopulator.quest(owner, LocalDate.now(), DailyQuestEntity.SLOT_FUELBIO,
            "bio_water", "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15,
            DailyQuestEntity.STATUS_OFFERED);
        q.setTitle("Igyál vizet [fake-quest-flavor:[]]"); // empty array ≠ 1 quest
        repository.saveAndFlush(q);

        flavor.rewrite(List.of(q));

        assertThat(repository.findByIdAndCreatedBy(q.getId(), owner).orElseThrow().getTitle())
            .startsWith("Igyál vizet");
    }

    @Test
    void testRewrite_shouldKeepCatalogCopy_whenLlmFails() {
        UUID owner = userPopulator.createUser("flavor-d@test.hu").getId();
        DailyQuestEntity q = questPopulator.quest(owner, LocalDate.now(), DailyQuestEntity.SLOT_FUELBIO,
            "bio_water", "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15,
            DailyQuestEntity.STATUS_OFFERED);
        q.setTitle("Igyál vizet [fake-fail]");
        repository.saveAndFlush(q);

        flavor.rewrite(List.of(q));

        assertThat(repository.findByIdAndCreatedBy(q.getId(), owner).orElseThrow().getTitle())
            .startsWith("Igyál vizet");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=QuestFlavorIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`QuestFlavor` does not exist).

- [ ] **Step 3: Switch + yaml + fake branch**

`FeaturesConfiguration.java` append after `ACTIVITY_SWITCH`:
```java
    /** E3 quest flavor copy — sub-switch of quest; the LLM rewrites title/why on the MORNING CRON
     *  only (never targets/XP — ADR 0010). Requires COMPANION_SWITCH too (CompanionLlm port). */
    public static final String QUEST_FLAVOR_SWITCH = "mezo.quest.flavor.enabled";
```

`application.yml` — extend the `mezo.quest` block (next to `adaptive`):
```yaml
    # E3 flavor copy: the companion rewrites quest title/why in its own voice on the morning
    # cron; lazy generation and rerolls keep catalog copy; any LLM failure keeps catalog copy.
    flavor:
      enabled: true
```

`FakeCompanionLlm.java` — add next to the activity mirror:
```java
    /** Mirror of QuestFlavor.FLAVOR_MARKER (feature/quest) — LITERAL, cycle rule. */
    public static final String QUEST_FLAVOR_MARKER_MIRROR = "KULDETES-IZESITES-FELADAT";

    /** Scripted flavor rewrite (E3): {@code [fake-quest-flavor:[…]]} planted in a quest title.
     *  GREEDY — the payload is a JSON array of objects. Default [] = no rewrite, so unscripted
     *  cron runs keep catalog copy deterministically. */
    public static final Pattern QUEST_FLAVOR_SENTINEL =
            Pattern.compile("\\[fake-quest-flavor:(\\[.*\\]|[^\\]]*)]", Pattern.DOTALL);
```
and in `complete(...)` after the activity branch:
```java
        if (systemPrompt.startsWith(QUEST_FLAVOR_MARKER_MIRROR)) {
            Matcher m = QUEST_FLAVOR_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "[]";
        }
```

- [ ] **Step 4: `QuestFlavor`**

```java
package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Companion flavor copy on daily quests (E3, bd mezo-6ng8, ADR 0010): the cheap-tier LLM may
 * rewrite title/why in the companion's voice — NEVER the metric, threshold, XP or skill. Runs on
 * the morning cron path only (QuestJob); the lazy read path and rerolls keep catalog copy. Any
 * failure — LLM error, unparseable answer, count mismatch, invalid entry — quietly keeps the
 * catalog copy: flavor is a garnish, the offer is already correct without it.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.QUEST_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.QUEST_FLAVOR_SWITCH},
    havingValue = "true")
public class QuestFlavor {

    /** First word of the system prompt — FakeCompanionLlm mirrors it (literal, no import back). */
    public static final String FLAVOR_MARKER = "KULDETES-IZESITES-FELADAT";

    private static final int TITLE_MAX = 160;
    private static final int WHY_MAX = 600;

    private static final String FLAVOR_PROMPT = FLAVOR_MARKER + """
        : Az alábbi napi küldetések szövegét írd át a társ (companion) hangján: magyar, tegező,
        identitás-szavazat (nem pont-tranzakció), a valós életbeli haszon elöl. A CÉLOKAT, a
        számokat és a mértékegységeket NE változtasd meg — csak a megfogalmazást. Válaszolj
        KIZÁRÓLAG egy JSON tömbbel, pontosan annyi elemmel és abban a sorrendben, ahogy a
        bemenet: [{"title": "<max 160 karakter>", "why": "<1-2 mondat>"}, ...]""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final DailyQuestRepository repository;

    private record Copy(String title, String why) {}

    /** Rewrites title/why of the given quests in place; persists only the valid rewrites. */
    @Transactional
    public void rewrite(List<DailyQuestEntity> quests) {
        if (quests.isEmpty()) {
            return;
        }
        StringBuilder input = new StringBuilder();
        for (int i = 0; i < quests.size(); i++) {
            DailyQuestEntity q = quests.get(i);
            input.append(i + 1).append(". [").append(q.getSlot()).append("] ")
                .append(q.getTitle()).append(" — ").append(q.getWhy())
                .append(" (cél: ").append(q.getTarget().metric())
                .append(", +").append(q.getXp()).append(" XP)\n");
        }
        String raw;
        try {
            raw = companionLlm.complete(FLAVOR_PROMPT, input.toString());
        } catch (Exception e) {
            log.warn("Quest flavor rewrite failed, keeping catalog copy: {}", e.getMessage());
            return;
        }
        List<Copy> copies = parse(raw);
        if (copies == null || copies.size() != quests.size()) {
            log.warn("Quest flavor answer invalid ({} entries for {} quests) — catalog copy kept",
                copies == null ? "unparseable" : copies.size(), quests.size());
            return;
        }
        for (int i = 0; i < quests.size(); i++) {
            Copy c = copies.get(i);
            if (valid(c)) {
                DailyQuestEntity q = quests.get(i);
                q.setTitle(c.title().strip());
                q.setWhy(c.why().strip());
                repository.save(q);
            }
        }
    }

    private List<Copy> parse(String raw) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), new TypeReference<List<Copy>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean valid(Copy c) {
        return c != null && c.title() != null && !c.title().isBlank() && c.title().strip().length() <= TITLE_MAX
            && c.why() != null && !c.why().isBlank() && c.why().strip().length() <= WHY_MAX;
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=QuestFlavorIT -DargLine=-Xmx3g`
Expected: PASS (4 tests).

- [ ] **Step 6: Cron wiring + QuestJobIT profile**

`QuestJob.java`: add `private final org.springframework.beans.factory.ObjectProvider<QuestFlavor> questFlavor;` and inside `runGenerate()` replace the generation line:
```java
                if (repository.findByCreatedByAndQuestDateOrderBySlotAsc(user.getId(), today).isEmpty()) {
                    List<DailyQuestEntity> fresh = selector.generate(user.getId(), today);
                    generated += fresh.size();
                    QuestFlavor flavor = questFlavor.getIfAvailable();
                    if (flavor != null) {
                        flavor.rewrite(fresh); // companion voice; failures keep catalog copy
                    }
                }
```
`QuestJobIT.java`: add `@ActiveProfiles("companion-fake")` to the class (import `org.springframework.test.context.ActiveProfiles`) — without it the REAL Gemini bean would receive the flavor call during `runGenerate()`. If the class already carries `@ActiveProfiles`, merge the value into the array. The fake's `[]` default means existing assertions (counts, statuses, catalog titles) hold unchanged.

- [ ] **Step 7: Guard + commit**

Run: `cd backend && ./mvnw clean test -Dtest='Quest*' -DargLine=-Xmx3g` → PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/quest backend/src/main/java/io/mrkuhne/mezo/techcore backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/quest
git -c core.hooksPath=/dev/null commit -m "feat(quest): companion flavor copy on the morning cron — title/why only, catalog fallback (mezo-6ng8)"
```

---

### Task 6: Proactive digests — NÖVEKEDÉS block

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/GrowthDigestBlock.java`
- Modify: `.../feature/proactive/service/WeeklySuggestionGenerator.java`, `.../feature/proactive/service/MemoirGenerator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/GrowthDigestBlockIT.java`

**Interfaces:**
- Consumes: `GrowthWeekService.growthWeek(UUID, LocalDate)` (Task 3; unconditional bean — direct injection; proactive→progression is a new acyclic edge).
- Produces: `GrowthDigestBlock.render(UUID userId, LocalDate weekStart)` → HU block string, `""` when the week has zero growth data (no digest noise).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.GrowthDigestBlock;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** The NÖVEKEDÉS digest block: growth facts for the proactive weekly prose; "" when empty. */
@ActiveProfiles("companion-fake")
class GrowthDigestBlockIT extends AbstractIntegrationTest {

    @Autowired private GrowthDigestBlock growthDigestBlock;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRender_shouldListQuestActivityAndSavings_whenWeekHasData() {
        UUID owner = userPopulator.createUser("digest-a@test.hu").getId();
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        questPopulator.quest(owner, monday, DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery",
            "LIFE", "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, monday.plusDays(1), DailyQuestEntity.SLOT_BODY, "body_rest_sleep",
            "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"), 20, DailyQuestEntity.STATUS_EXPIRED);
        activityPopulator.financialActivity(owner, monday, "Spórolás", 50000L);

        String block = growthDigestBlock.render(owner, monday);

        assertThat(block).contains("NÖVEKEDÉS");
        assertThat(block).contains("1/2");
        assertThat(block).contains("50 000 Ft");
    }

    @Test
    void testRender_shouldReturnEmpty_whenWeekHasNoGrowthData() {
        UUID owner = userPopulator.createUser("digest-b@test.hu").getId();

        assertThat(growthDigestBlock.render(owner, LocalDate.now().with(DayOfWeek.MONDAY))).isEmpty();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=GrowthDigestBlockIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`GrowthDigestBlock` does not exist).

- [ ] **Step 3: Implement**

`GrowthDigestBlock.java`:
```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.feature.progression.service.GrowthWeekService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Growth facts for the proactive weekly digests (E3, bd mezo-6ng8): renders the week's quest
 * ratio, LIFE XP, activity count and savings as a labelled block the weekly-suggestion and
 * memoir prompts append verbatim. Empty week → empty string (no digest noise; the prose
 * generators never see a zero-filled section).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class GrowthDigestBlock {

    private final GrowthWeekService growthWeekService;

    /** HU block for the week starting weekStart; "" when the week carries no growth data. */
    public String render(UUID userId, LocalDate weekStart) {
        GrowthWeekResponse w = growthWeekService.growthWeek(userId, weekStart);
        if (w.getQuestClosed() == 0 && w.getLifeXp() == 0 && w.getActivities() == 0) {
            return "";
        }
        StringBuilder b = new StringBuilder("\n\nNÖVEKEDÉS (hét: ").append(w.getWeekStart()).append("):\n");
        b.append("- Napi küldetések: ").append(w.getQuestCompleted()).append('/')
            .append(w.getQuestClosed()).append(" teljesítve\n");
        b.append("- LIFE XP: +").append(w.getLifeXp())
            .append(" (").append(w.getActivities()).append(" tevékenység)");
        if (w.getSavingsHuf() > 0) {
            b.append("\n- Megtakarítás: ").append(formatHuf(w.getSavingsHuf())).append(" Ft");
        }
        return b.toString();
    }

    private static String formatHuf(long v) {
        return String.format(Locale.of("hu", "HU"), "%,d", v).replace(' ', ' ').replace(',', ' ');
    }
}
```
NOTE on `formatHuf`: verify the produced grouping is a plain space ("50 000"); if the locale grouping already emits NBSP-only, the two `replace` calls normalize it. The IT pins the exact "50 000 Ft" output — adjust the implementation (not the test) until green.

`WeeklySuggestionGenerator.java`: add `private final GrowthDigestBlock growthDigestBlock;` and extend `gather(...)`'s return — the suggestion is for the UPCOMING week, so the growth block covers the PRIOR week:
```java
        return contextSnapshotAssembler.render(userId, LocalDate.now())
                + facts
                + "\n\nELŐZŐ HÉT NAPJAI (legfrissebb elöl):\n" + narratives
                + (patterns.isBlank() ? "" : "\n\nMINTÁK:\n" + patterns)
                + growthDigestBlock.render(userId, weekStart.minusWeeks(1));
```

`MemoirGenerator.java`: add `private final GrowthDigestBlock growthDigestBlock;` and in `gather(...)` append the CURRENT week's block right after `payload.append(knowledgeFactService.renderPromptBlock(userId));`:
```java
        payload.append(growthDigestBlock.render(userId, weekStart));
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=GrowthDigestBlockIT -DargLine=-Xmx3g`
Expected: PASS (2 tests).

- [ ] **Step 5: Guard the proactive suite** (the generators' existing ITs must absorb the longer payload — the fake's weekly/memoir branches return sentinels/defaults, not payload echoes):

Run: `cd backend && ./mvnw clean test -Dtest='WeeklySuggestion*,Memoir*,Proactive*' -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive backend/src/test/java/io/mrkuhne/mezo/feature/proactive
git -c core.hooksPath=/dev/null commit -m "feat(proactive): NÖVEKEDÉS growth block in weekly-suggestion + memoir digests (mezo-6ng8)"
```

---

### Task 7: FE Insights — GrowthWeekCard + useWeekly extension

**Files:**
- Create: `frontend/src/data/insights/growthWeekApi.ts`, `frontend/src/features/insights/components/GrowthWeekCard.tsx` (+ `GrowthWeekCard.test.tsx`)
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/insights/insights.ts`, `frontend/src/data/insights/weeklyHooks.ts` (+ its test), `frontend/src/features/insights/pages/WeeklyPage.tsx` (+ its test), `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: `paths['/api/progression/growth-week/{date}']` (Task 1 regen); `useWeekly()`'s existing `useRealQuery` helper + `mondayIso()`; `WeeklyPage`'s `col gap-md` card column.
- Produces: `WeeklyGrowth` type; `useWeekly()` return gains `growthWeek: WeeklyGrowth | null` (mock: seed; real: fetched, null while unresolved); `<GrowthWeekCard growth={...} />`.

- [ ] **Step 1: Type + mock seed.** In `data/types.ts` next to the weekly types:

```ts
/** Weekly growth aggregate (E3, mezo-6ng8) — mirrors GrowthWeekResponse. */
export interface WeeklyGrowth {
  weekStart: string
  questCompleted: number
  questClosed: number
  lifeXp: number
  activities: number
  savingsHuf: number
}
```

In `data/insights/insights.ts` next to the `weekly` seed (import the type):
```ts
export const growthWeek: WeeklyGrowth = {
  weekStart: '2026-05-18',
  questCompleted: 9,
  questClosed: 14,
  lifeXp: 120,
  activities: 6,
  savingsHuf: 50000,
}
```

- [ ] **Step 2: `growthWeekApi.ts`** (mirror `weeklySuggestionApi.ts`'s wire idiom — read it first and reuse its fetch helper exactly):

```ts
import type { paths } from '@/data/_client/api.gen'
import type { WeeklyGrowth } from '@/data/types'

type GrowthWeekWire =
  paths['/api/progression/growth-week/{date}']['get']['responses']['200']['content']['application/json']

export const growthWeekApi = {
  get: (date: string): Promise<WeeklyGrowth> =>
    /* same fetch helper as weeklySuggestionApi: GET `/api/progression/growth-week/${date}` */
    ... .then((w: GrowthWeekWire) => ({ ...w })),
}
```
The `...` placeholder is ONLY the fetch call — replicate `weeklySuggestionApi.get`'s helper verbatim.

- [ ] **Step 3: `useWeekly` extension.** In `weeklyHooks.ts`: import `growthWeekApi` + the seed + type; add a query next to the suggestion query (mirror its `enabled: !mock, retry: false` shape, resolving `null` on error):

```ts
  const growthQ = useQuery({
    queryKey: ['insightsWeekly', 'growth', start],
    queryFn: () => growthWeekApi.get(start).catch(() => null),
    enabled: !mock,
    retry: false,
  })
```
Extend `WeeklyView` with `growthWeek: WeeklyGrowth | null`; the mock early-return includes `growthWeek: mockGrowthWeek` (the seed import, alias as needed); the real return includes `growthWeek: growthQ.data ?? null`.

- [ ] **Step 4: `GrowthWeekCard.tsx`** — third Weekly card; item-row style of the score card (read `WeeklyPage.tsx` first and reuse its row markup exactly). Skeleton:

```tsx
import type { WeeklyGrowth } from '@/data/types'

const fmtHuf = (v: number) => `${v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')} Ft`

/** Weekly growth summary card (E3): quests, LIFE XP, activities, savings. */
export function GrowthWeekCard({ growth }: { growth: WeeklyGrowth | null }) {
  const empty = !growth || (growth.questClosed === 0 && growth.lifeXp === 0 && growth.activities === 0)
  // card notch-12, eyebrow brand "Growth — heti"
  // empty → single text-tertiary line: "Még nincs growth-adat ezen a héten."
  // else rows (score-card row idiom: label text-secondary 13px left, value right):
  //   "Küldetések"      → `${questCompleted}/${questClosed}`
  //   "LIFE XP"         → `+${lifeXp}`
  //   "Tevékenységek"   → `${activities}`
  //   savingsHuf > 0 && "Megtakarítás" → fmtHuf(savingsHuf)
}
```
Every visible HU string above is final copy.

- [ ] **Step 5: `WeeklyPage.tsx`** — render `<GrowthWeekCard growth={growthWeek} />` as the third card inside the `col gap-md` wrapper (after the suggestion card); destructure `growthWeek` from `useWeekly()`.

- [ ] **Step 6: MSW default** — in `test/msw/handlers.ts` next to the weekly-suggestion 404 default, an honest-zeros default:

```ts
  http.get(`${API_BASE}/api/progression/growth-week/:date`, ({ params }) =>
    HttpResponse.json({
      weekStart: params.date,
      questCompleted: 0,
      questClosed: 0,
      lifeXp: 0,
      activities: 0,
      savingsHuf: 0,
    })),
```

- [ ] **Step 7: Tests**
- `GrowthWeekCard.test.tsx`: (a) populated growth renders "9/14", "+120", "6" and "50 000 Ft"; (b) `savingsHuf: 0` hides the Megtakarítás row; (c) null growth renders the empty line.
- `weeklyHooks.test.tsx`: extend the mock-mode case to assert `growthWeek` equals the seed; extend a real-mode case to assert the MSW zeros arrive (`growthWeek?.questClosed === 0`). Follow the file's existing structure exactly.
- `WeeklyPage.test.tsx`: assert the third card's eyebrow "Growth — heti" renders.

- [ ] **Step 8: Verify both modes + build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data frontend/src/features/insights frontend/src/test/msw/handlers.ts
git -c core.hooksPath=/dev/null commit -m "feat(fe/insights): weekly GrowthWeekCard + growth-week hook (mezo-6ng8)"
```

---

### Task 8: FE Me — GrowthCard savings stat

**Files:**
- Modify: `frontend/src/features/me/components/GrowthCard.tsx` (+ `GrowthCard.test.tsx`), `frontend/src/data/progression/progressionMock.ts`, `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: `profile.savingsHuf30d` (optional/nullable on the regenerated `ProgressionProfileResponse`).

- [ ] **Step 1: GrowthCard savings line.** Below the trait-meter rows and ABOVE the sub-caption, a bar-less stat row shown only when `savingsHuf30d` is a positive number (reuse the trait row's label/value typography, no `.progress-mbar`):

```tsx
const savings = profile.savingsHuf30d
// …
{typeof savings === 'number' && savings > 0 && (
  <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
    <span className="text-secondary" style={{ fontSize: 13 }}>Megtakarítás (30 nap)</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-glow)' }}>
      {`${savings.toLocaleString('hu-HU').replace(/[  ]/g, ' ')} Ft`}
    </span>
  </div>
)}
```
ADAPT the exact classes/inline styles to the trait rows directly above it so the two read as one block — the copy "Megtakarítás (30 nap)" and the `Ft` formatting are fixed.

- [ ] **Step 2: Mocks.** `progressionMock.ts`: `progressionProfileMock` gains `savingsHuf30d: 50000` (root level, next to `traits`); `GHOST_PROGRESSION_PROFILE` gains `savingsHuf30d: null`. MSW profile handler (`handlers.ts` progression-profile JSON) gains `savingsHuf30d: null`.

- [ ] **Step 3: Tests.** Extend `GrowthCard.test.tsx`: the populated case additionally asserts "Megtakarítás (30 nap)" + "50 000 Ft"; a new case with `savingsHuf30d: 0` (spread the mock) asserts the row is absent; the ghost case stays green (early-return precedes the row).

- [ ] **Step 4: Verify both modes + build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me frontend/src/data/progression frontend/src/test/msw/handlers.ts
git -c core.hooksPath=/dev/null commit -m "feat(fe/me): Megtakarítás (30 nap) stat on the GrowthCard (mezo-6ng8)"
```

---

### Task 9: Docs + gates + PR + merge

**Files:**
- Modify: `docs/features/growth.md`, `docs/features/insights.md`, `docs/features/me.md`, `docs/milestones/roadmap.md`

- [ ] **Step 1: `growth.md`** — §2 (adaptive difficulty behavior + flavor copy on the cron + savings stat), §3 (banding algorithm + flavor flow + growth-week aggregate), §4 (growth-week endpoint + profile savingsHuf30d), §5 (proactive digest integration + ActivityLedgerSource port), §7 (how to tune mezo.quest.adaptive / disable flavor), §9 (gotchas: flavor only on the cron path — lazy/reroll keep catalog copy; savings only from AI-extracted amounts), §10 key files; frontmatter `updated:`.
- [ ] **Step 2: `insights.md`** — §2.2 Weekly gains the GrowthWeekCard; §4 the growth-week endpoint (note: FIRST backend read composed into the otherwise client-side Weekly); §10 key files += GrowthWeekCard + growthWeekApi.
- [ ] **Step 3: `me.md`** — §2 GrowthCard savings stat; §4 profile savingsHuf30d.
- [ ] **Step 4: `roadmap.md`** — E3 landing entry after the E2 row ("Next: E4 shop/coins (future) — umbrella epic complete for now").
- [ ] **Step 5: `node scripts/lint-docs.mjs`** → 0 stale / 0 error.
- [ ] **Step 6: Commit docs**

```bash
git add docs
git -c core.hooksPath=/dev/null commit -m "docs(features): growth/insights/me + roadmap for E3 life integrations (mezo-6ng8)"
```

- [ ] **Step 7: Focused backend gate**

```bash
cd backend && ./mvnw clean test -Dtest='Quest*,Progression*,Activity*,ProfileSavingsIT,GrowthWeek*,WeeklySuggestion*,Memoir*,GrowthDigest*,ArchitectureTest' -DargLine=-Xmx3g
```
Expected: PASS.

- [ ] **Step 8: FE full gate**: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → PASS ×3.

- [ ] **Step 9: Visual verification (controller, mock mode):** Insights → Weekly (GrowthWeekCard with the seed), Me → GrowthCard (savings row). Screenshots reviewed against the house card language.

- [ ] **Step 10: Push + self-PR + CI + merge** (the E2 flow verbatim):

```bash
git push -u origin feat/growth-e3
gh pr create --title "E3 — Life integrations: savings stat + adaptive difficulty + flavor copy + weekly growth (mezo-6ng8)" --body "…summary + spec/plan pointers…"
gh pr checks --watch
gh pr merge --merge
```
Then bd closeout from the MAIN checkout: close `mezo-6ng8` with a handoff note, REOPEN `mezo-52vz` if bd auto-closes it (E4 remains, future), `bd dolt push`.

## Self-review notes (done at plan time)

- Spec coverage: §4 adaptive difficulty (~80% target, static→adaptive) → Task 4; §4 flavor ("LLM may rewrite flavor copy only, never targets or XP") → Task 5 (cron-only + validation + fallback); §5 finance thin-slice ("Megtakarítás (30 nap)" on the Growth card) → Tasks 2+8; §10 E3 "weekly-summary integration" per user decision (proactive digests AND Insights) → Tasks 3+6+7. Savings uses spec §8's `savings30d` intent as `savingsHuf30d` (HUF-explicit name chosen at contract time).
- Type consistency: `ActivityLedgerSource.Stats(entries, savingsHuf)` consistent across Tasks 2/3; `GrowthWeekResponse` fields identical in contract (Task 1), service (Task 3), digest (Task 6), FE type (Task 7); `QuestProperties.adaptive()` naming consistent between Task 4's record and yaml.
- Deliberate scope cuts: reroll replacements keep catalog copy (flavor is cron-only); `GrowthDigestBlock` renders zeros-week as `""`; adaptive banding reads only terminal statuses (offered/rerolled never count); no DDL anywhere.
- Risk watch: `QuestJobIT` MUST gain the companion-fake profile in the same commit as the QuestJob wiring (Task 5 Step 6) or it would hit the real Gemini bean; `formatHuf` output is pinned by an IT ("50 000 Ft") — implementation adjusts, test does not.
