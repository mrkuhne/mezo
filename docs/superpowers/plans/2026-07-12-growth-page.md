# Me · Growth Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the dedicated `/me/growth` page (variant-B mockup): hero XP/trait trio + segmented Skillek (all 33 skills, three band cards, NO radars) / Napló (30-day quest+activity journal) / Kitüntetések (9 computed badges + perk unlocks), plus the Profile consolidation — one compact `GrowthSummaryCard` replaces the three progression cards and the radar diagrams retire app-wide.

**Architecture:** Contract-first, no DDL. Two new range reads (quest history, activity history) + one achievements read (`AchievementService` in progression, badges derived on read via the EXISTING `QuestLedgerSource`/`ActivityLedgerSource` ports + `TraitCalculator` + `SkillProgressRepository`, perks from `perk_unlock` × `PerkCatalog`). The FE composes everything: hero Össz XP is summed client-side from the existing profile response; journal merging/grouping is a pure `buildGrowthJournal` function; the page is a new Me route with a local segmented state. Contract tasks are split in two (history, then achievements) so the backend NEVER has an unimplemented generated interface between tasks (the E3 compile-gap lesson).

**Tech Stack:** Spring Boot 4 / Java 21 / Maven; OpenAPI codegen; React 19 + react-router + TanStack Query + MSW/Vitest.

**Driving bd issue:** `mezo-rmhr`. Spec: `docs/superpowers/specs/2026-07-12-growth-page-design.md` (+ approved mockup `2026-07-12-growth-page-mockup.html`).

## Global Constraints

- **No DDL.** Everything derives from existing tables (`daily_quest`, `activity_log`, `skill_progress`, `perk_unlock`, `level_up_event` via TraitCalculator).
- Contract-first: fragments edited BEFORE backend code; controllers implement generated `<Tag>Api`; never hand-write boundary DTOs. **Sequencing rule:** a contract task adding an operation and the backend task implementing it must be ADJACENT (Tasks 1→2 history, 3→4 achievements) — no maven run happens between a contract task and its controller task.
- Badge catalog (spec §3, EXACT values): `first_quest` 🏁 "Első küldetés" target 1 (completed quests) · `quests_10` 📜 "10 küldetés" target 10 · `quests_50` 🎖️ "50 küldetés" target 50 · `first_activity` ✍️ "Első tevékenység" target 1 (entries) · `rhythm_4w` 🔥 "4 hetes ritmus" target 4 (consistencyWeeks) · `all_life_active` 🌈 "Mind a 8 LIFE aktív" target 8 (LIFE skills with cumulativeXp>0) · `life_lv5` 🧠 "LIFE Lv 5" target 5 (best LIFE level) · `life_xp_10k` 🏛️ "10 000 LIFE XP" target 10000 (Σ LIFE cumulativeXp) · `savings_100k` 💰 "100k megtakarítás" target 100000 (Σ all-time financial amountHuf). `achieved = current >= target`. All-time port window: `LocalDate.of(2000, 1, 1)` → `LocalDate.now()`. NO unlock dates in v1.
- Journal: fixed 30-day window (`from = today-29`, `to = today`); offered quests are NOT displayed (FE filters); rerolled rows never leave the backend. Day labels: `Ma`, `Tegnap`, else `{Júl 10}`-style HU short date.
- Ownership from the security principal on every endpoint; honest empty arrays, never 404.
- HU copy verbatim as written in tasks; HUF/number formatting `toLocaleString('hu-HU')` with NBSP/NNBSP→space normalization.
- FE house rules: hooks via `@/data/hooks` barrel only; `useDualQuery` reads; deep `@/*` imports; colocated tests; both vitest modes green; keep `.progress-m*` CSS (reused), delete only `.progress-radar-*`.
- Deletions (spec §5): `AthleticRadarCard.tsx`, `MuscleLevelsCard.tsx`, `GrowthCard.tsx`, `features/me/logic/radarGeometry.ts` + their colocated tests + the radar CSS block. Git history is the archive.
- Tests integration-first backend (populators, AssertJ, `test{Method}_should{Result}_when{Condition}`, TDD RED→GREEN); Maven ALWAYS `clean`, focused `-Dtest=<Class> -DargLine=-Xmx3g` only (full suite = CI).
- Commits: conventional subject + `(mezo-rmhr)`; in this worktree ALWAYS `git -c core.hooksPath=/dev/null commit ...`; `bd` only from the MAIN checkout.
- Branch: `feat/growth-page` (already cut from `origin/main` @ d7e13c4f, spec committed 01d1fa76). Landing: push → self-PR → CI green → `gh pr merge --merge`.

## File Structure

**Contract:** Modify `api/feature/quest/quest.yml` (+`/api/quest/history`), `api/feature/activity/activity.yml` (+`/api/activity/history`), `api/feature/progression/progression.yml` (+`/api/progression/achievements`, `AchievementsResponse`/`BadgeResponse`/`PerkUnlockResponse`); regen `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` (twice: Task 1 and Task 3).

**Backend (new):** `.../feature/progression/service/AchievementService.java`; Tests: `feature/quest/QuestHistoryApiIT.java`, `feature/activity/ActivityHistoryApiIT.java`, `feature/progression/AchievementsApiIT.java`.

**Backend (modified):** `DailyQuestRepository.java` (+Between finder), `QuestService.java` (+history), `QuestController.java` (+delegate), `ActivityService.java` (+history), `ActivityController.java` (+delegate), `PerkUnlockRepository.java` (+desc finder), `ProgressionController.java` (+achievements delegate), `messages.properties` (+2 range codes).

**Frontend (new):** `features/me/pages/GrowthPage.tsx` (+test), `features/me/components/SkillBandCard.tsx` (+test), `features/me/components/GrowthJournalCard.tsx` (+test), `features/me/components/BadgesCard.tsx` (+test), `features/me/components/PerksCard.tsx` (+test), `features/me/components/GrowthSummaryCard.tsx` (+test), `features/me/logic/growthJournal.ts` (+test), `data/progression/achievementsMock.ts`.

**Frontend (modified):** `app/router.tsx`, `features/me/pages/MeSubNav.tsx` (+test), `features/me/pages/ProfilePage.tsx`, `features/progression/logic/levelUpMeta.ts` (export ATHLETIC_META), `data/quest/{questHooks,questApi,questMock}.ts`, `data/activity/{activityHooks,activityApi,activityMock}.ts`, `data/progression/{progressionHooks,progressionApi}.ts`, `data/types.ts`, `data/hooks.ts`, `test/msw/handlers.ts`, `styles/prototype.css` (radar block removal).

**Frontend (deleted):** `features/me/components/AthleticRadarCard.tsx` (+test), `features/me/components/MuscleLevelsCard.tsx` (+test), `features/me/components/GrowthCard.tsx` (+test), `features/me/logic/radarGeometry.ts` (+test).

**Docs:** `docs/features/me.md` (major), `docs/features/growth.md`, `docs/milestones/roadmap.md`.

---

### Task 1: Contract — quest + activity history endpoints + regen

**Files:**
- Modify: `api/feature/quest/quest.yml`, `api/feature/activity/activity.yml`; regen `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (backend, regenerated in Task 2's maven run): `QuestApi.getQuestHistory(LocalDate from, LocalDate to)` → `List<QuestResponse>`; `ActivityApi.getActivityHistory(LocalDate from, LocalDate to)` → `List<ActivityResponse>`. FE: `paths['/api/quest/history']` + `paths['/api/activity/history']`.

- [ ] **Step 1: Commit this plan file**

```bash
git add docs/superpowers/plans/2026-07-12-growth-page.md
git -c core.hooksPath=/dev/null commit -m "docs(plans): Me Growth page implementation plan (mezo-rmhr)"
```

- [ ] **Step 2: `api/feature/quest/quest.yml`** — add after the reroll path:

```yaml
  /api/quest/history:
    get:
      tags: [Quest]
      operationId: getQuestHistory
      summary: Quest history in an inclusive date range, newest first (Quests)
      description: >-
        Non-rerolled quests of the range for the Growth journal. Honest empty array — never a
        404. from must not be after to (400 QUEST_INVALID_DATE_RANGE).
      parameters:
        - name: from
          in: query
          required: true
          schema: { type: string, format: date }
        - name: to
          in: query
          required: true
          schema: { type: string, format: date }
      responses:
        '200':
          description: Quests of the range (rerolled rows excluded)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/QuestResponse' }
        '400':
          description: from is after to
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

- [ ] **Step 3: `api/feature/activity/activity.yml`** — add after the category path (same shape):

```yaml
  /api/activity/history:
    get:
      tags: [Activity]
      operationId: getActivityHistory
      summary: Activity-log entries in an inclusive date range, newest first (Activity log)
      description: >-
        Entries of the range for the Growth journal. Honest empty array — never a 404. from
        must not be after to (400 ACTIVITY_INVALID_DATE_RANGE).
      parameters:
        - name: from
          in: query
          required: true
          schema: { type: string, format: date }
        - name: to
          in: query
          required: true
          schema: { type: string, format: date }
      responses:
        '200':
          description: Entries of the range
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/ActivityResponse' }
        '400':
          description: from is after to
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

- [ ] **Step 4: Merge + FE regen + build check**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api && pnpm build
```
Expected: both history paths in `api/openapi.yml` + `api.gen.ts`; build PASS (pure additions).

- [ ] **Step 5: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): quest + activity history range reads (mezo-rmhr)"
```

---

### Task 2: Backend — history endpoints

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/repository/DailyQuestRepository.java`, `.../feature/quest/service/QuestService.java`, `.../feature/quest/controller/QuestController.java`, `.../feature/activity/service/ActivityService.java`, `.../feature/activity/controller/ActivityController.java`, `backend/src/main/resources/messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestHistoryApiIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/activity/ActivityHistoryApiIT.java`

**Interfaces:**
- Produces (consumed by Task 5 via HTTP): the two history endpoints per Task 1's contract. `QuestService.history(UUID, LocalDate, LocalDate)` → `List<QuestResponse>`; `ActivityService.history(UUID, LocalDate, LocalDate)` → `List<ActivityResponse>`.

- [ ] **Step 1: messages.properties** — append after the ACTIVITY block:

```properties
QUEST_INVALID_DATE_RANGE=The from date must not be after the to date.
ACTIVITY_INVALID_DATE_RANGE=The from date must not be after the to date.
```

- [ ] **Step 2: Write the two failing ITs** (mirror the existing `QuestApiIT`/`ActivityApiIT` helper idioms — `ownerId()`, `ownerAuthHeaders()`, `getForBody`, `exchangeForBody` + `assertHasRequestError`; ADAPT signatures to the real `ApiIntegrationTest`):

`QuestHistoryApiIT.java`:
```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/quest/history — inclusive range, rerolled excluded, newest date first, owner-scoped. */
class QuestHistoryApiIT extends ApiIntegrationTest {

    @Autowired private QuestPopulator questPopulator;

    @Test
    void testGetQuestHistory_shouldListRangeNewestFirstWithoutRerolled_whenMixedRows() {
        UUID owner = ownerId();
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(29);
        questPopulator.quest(owner, to.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_water",
            "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, to.minusDays(2), DailyQuestEntity.SLOT_BODY, "body_rest_sleep",
            "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"), 20, DailyQuestEntity.STATUS_EXPIRED);
        questPopulator.quest(owner, to.minusDays(2), DailyQuestEntity.SLOT_GROWTH, "growth_read",
            "learning", "LIFE", "activity_match", null, 20, DailyQuestEntity.STATUS_REROLLED);
        questPopulator.quest(owner, to.minusDays(30), DailyQuestEntity.SLOT_FUELBIO, "bio_sleep",
            "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"), 25, DailyQuestEntity.STATUS_COMPLETED);

        QuestResponse[] list = getForBody("/api/quest/history?from=" + from + "&to=" + to,
            QuestResponse[].class, HttpStatus.OK);

        assertThat(list).hasSize(2); // rerolled + out-of-range excluded
        assertThat(list[0].getQuestDate()).isEqualTo(to.minusDays(1)); // newest first
        assertThat(list).extracting(QuestResponse::getStatus).doesNotContain("rerolled");
    }

    @Test
    void testGetQuestHistory_shouldReject_whenFromAfterTo() {
        LocalDate d = LocalDate.now();
        var body = getForBodyExpectingError("/api/quest/history?from=" + d + "&to=" + d.minusDays(1),
            HttpStatus.BAD_REQUEST);
        assertHasRequestError(body, "QUEST_INVALID_DATE_RANGE");
    }
}
```
(`getForBodyExpectingError` is a stand-in: use the file's real error-read idiom — `exchangeForBody`/`getForBody` with `String.class` + `assertHasRequestError`, exactly as `ActivityApiIT`'s 400 test does.)

`ActivityHistoryApiIT.java`:
```java
package io.mrkuhne.mezo.feature.activity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/activity/history — inclusive range, newest first, owner-scoped. */
class ActivityHistoryApiIT extends ApiIntegrationTest {

    @Autowired private ActivityPopulator activityPopulator;

    @Test
    void testGetActivityHistory_shouldListRangeNewestFirst_whenEntriesSpanRange() {
        UUID owner = ownerId();
        LocalDate to = LocalDate.now();
        activityPopulator.activity(owner, to.minusDays(1), "Olvastam", "learning", 15, ActivityLogEntity.BY_AI);
        activityPopulator.financialActivity(owner, to.minusDays(3), "Spórolás", 50000L);
        activityPopulator.activity(owner, to.minusDays(31), "Régi bejegyzés", "mindset", 10, ActivityLogEntity.BY_AI);

        ActivityResponse[] list = getForBody("/api/activity/history?from=" + to.minusDays(29) + "&to=" + to,
            ActivityResponse[].class, HttpStatus.OK);

        assertThat(list).hasSize(2);
        assertThat(list[0].getText()).isEqualTo("Olvastam");
        assertThat(list[1].getAmountHuf()).isEqualTo(50000L);
    }
}
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd backend && ./mvnw clean test -Dtest='QuestHistoryApiIT,ActivityHistoryApiIT' -DargLine=-Xmx3g`
Expected: FAIL — compile error on the controllers (generated `getQuestHistory`/`getActivityHistory` unimplemented). That IS the RED: implement next.

- [ ] **Step 4: Implement**

`DailyQuestRepository.java` add:
```java
    /** Growth-journal history read (rerolled filtered in the service). */
    List<DailyQuestEntity> findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc(
        UUID createdBy, LocalDate from, LocalDate to);
```

`QuestService.java` add (imports exist; `HttpStatus`, `SystemMessage`, `SystemRuntimeErrorException` already imported):
```java
    /** Growth-journal read: non-rerolled quests of the inclusive range, newest date first. */
    @Transactional(readOnly = true)
    public List<QuestResponse> history(UUID userId, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_INVALID_DATE_RANGE").build(), HttpStatus.BAD_REQUEST);
        }
        return repository.findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc(userId, from, to)
            .stream()
            .filter(q -> !DailyQuestEntity.STATUS_REROLLED.equals(q.getStatus()))
            .map(mapper::toQuestResponse)
            .toList();
    }
```

`QuestController.java` add (mirror the existing delegate style exactly):
```java
    @Override
    public List<QuestResponse> getQuestHistory(LocalDate from, LocalDate to) {
        return questService.history(currentUserId.get(), from, to);
    }
```

`ActivityService.java` add:
```java
    /** Growth-journal read: entries of the inclusive range, newest first. */
    @Transactional(readOnly = true)
    public List<ActivityResponse> history(UUID userId, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ACTIVITY_INVALID_DATE_RANGE").build(), HttpStatus.BAD_REQUEST);
        }
        return repository.findByCreatedByAndOccurredOnBetween(userId, from, to).stream()
            .sorted(java.util.Comparator.comparing(ActivityLogEntity::getOccurredOn).reversed()
                .thenComparing(ActivityLogEntity::getCreatedAt, java.util.Comparator.reverseOrder()))
            .map(mapper::toResponse)
            .toList();
    }
```

`ActivityController.java` add:
```java
    @Override
    public List<ActivityResponse> getActivityHistory(LocalDate from, LocalDate to) {
        return activityService.history(currentUserId.get(), from, to);
    }
```
(ADAPT: if the generated interfaces wrap in `ResponseEntity`, mirror whatever the file's existing delegates do.)

- [ ] **Step 5: Run to verify they pass**

Run: `cd backend && ./mvnw clean test -Dtest='QuestHistoryApiIT,ActivityHistoryApiIT' -DargLine=-Xmx3g`
Expected: PASS (3 tests).

- [ ] **Step 6: Guard + commit**

Run: `cd backend && ./mvnw clean test -Dtest='Quest*,Activity*,ArchitectureTest' -DargLine=-Xmx3g` → PASS.

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(quest,activity): history range reads for the growth journal (mezo-rmhr)"
```

---

### Task 3: Contract — achievements endpoint + regen

**Files:**
- Modify: `api/feature/progression/progression.yml`; regen `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (backend regen in Task 4): `ProgressionApi.getAchievements()` → `AchievementsResponse`; api.dto `BadgeResponse`, `PerkUnlockResponse`, `AchievementsResponse` (builders). FE: `paths['/api/progression/achievements']`.

- [ ] **Step 1: Add the path** (after growth-week):

```yaml
  /api/progression/achievements:
    get:
      tags: [Progression]
      operationId: getAchievements
      summary: Computed growth badges + unlocked perk milestones (Progression)
      description: >-
        Badges are derived on read from the ledgers (deterministic, retroactive, no unlock
        dates in v1); perks are the persisted perk_unlock rows joined with the perk catalog.
        Honest zero-progress badges — never a 404.
      responses:
        '200':
          description: The 9 badges (fixed catalog order) + unlocked perks (newest first)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AchievementsResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

- [ ] **Step 2: Add the schemas** (next to `GrowthWeekResponse`):

```yaml
    BadgeResponse:
      type: object
      required: [key, icon, name, achieved, current, target]
      properties:
        key: { type: string }
        icon: { type: string, description: Emoji }
        name: { type: string, description: HU display name }
        achieved: { type: boolean }
        current: { type: integer, format: int64, description: Progress numerator (also set when achieved) }
        target: { type: integer, format: int64 }
    PerkUnlockResponse:
      type: object
      required: [perkKey, name, effectCopy, skillKey, milestoneLevel, unlockedAt]
      properties:
        perkKey: { type: string }
        name: { type: string, description: HU perk name from the catalog }
        effectCopy: { type: string, description: HU effect line from the catalog }
        skillKey: { type: string }
        milestoneLevel: { type: integer, format: int32 }
        unlockedAt: { type: string, format: date-time }
    AchievementsResponse:
      type: object
      required: [badges, perks]
      properties:
        badges:
          type: array
          items: { $ref: '#/components/schemas/BadgeResponse' }
        perks:
          type: array
          items: { $ref: '#/components/schemas/PerkUnlockResponse' }
```

- [ ] **Step 3: Merge + FE regen + build**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api && pnpm build
```
Expected: path + 3 schemas present; build PASS.

- [ ] **Step 4: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): achievements contract — computed badges + perk unlocks (mezo-rmhr)"
```

---

### Task 4: Backend — `AchievementService` + endpoint

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/AchievementService.java`
- Modify: `.../feature/progression/repository/PerkUnlockRepository.java`, `.../feature/progression/controller/ProgressionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/AchievementsApiIT.java`

**Interfaces:**
- Consumes: `QuestLedgerSource.closedQuestStats` + `ActivityLedgerSource.stats` (ObjectProvider, all-time window `LocalDate.of(2000,1,1)`→`LocalDate.now()`), `TraitCalculator.traits(...)` (consistencyWeeks), `SkillProgressRepository.findByCreatedByOrderBySkillKeyAsc` (LIFE rows), `PerkUnlockRepository`, `PerkCatalog.find(skillKey, milestoneLevel)`.
- Produces: `AchievementService.achievements(UUID)` → `AchievementsResponse`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AchievementsResponse;
import io.mrkuhne.mezo.api.dto.BadgeResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.progression.activity.ActivitySignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/progression/achievements — derived badges (fixed order) + perk unlocks. */
class AchievementsApiIT extends ApiIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private ProgressionService progressionService;

    private BadgeResponse badge(AchievementsResponse res, String key) {
        return res.getBadges().stream().filter(b -> key.equals(b.getKey())).findFirst().orElseThrow();
    }

    @Test
    void testGetAchievements_shouldReturnNineZeroBadges_whenNoData() {
        AchievementsResponse res = getForBody("/api/progression/achievements",
            AchievementsResponse.class, HttpStatus.OK);

        assertThat(res.getBadges()).hasSize(9);
        assertThat(res.getBadges()).extracting(BadgeResponse::getKey).containsExactly(
            "first_quest", "quests_10", "quests_50", "first_activity", "rhythm_4w",
            "all_life_active", "life_lv5", "life_xp_10k", "savings_100k");
        assertThat(res.getBadges()).allSatisfy(b -> assertThat(b.getAchieved()).isFalse());
        assertThat(res.getPerks()).isEmpty();
    }

    @Test
    void testGetAchievements_shouldComputeQuestActivityAndSavingsBadges_whenDataSeeded() {
        UUID owner = ownerId();
        LocalDate d = LocalDate.now().minusDays(2);
        questPopulator.quest(owner, d, DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery",
            "LIFE", "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, d.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_sleep", "recovery",
            "LIFE", "sleep_target", new BigDecimal("7.5"), 25, DailyQuestEntity.STATUS_EXPIRED);
        activityPopulator.financialActivity(owner, d, "Spórolás", 120000L);
        // one LIFE XP grant so all_life_active counts exactly 1 of 8
        progressionService.applyActivity(owner, new ActivitySignal(UUID.randomUUID(), "learning", 15, "Teszt"));

        AchievementsResponse res = getForBody("/api/progression/achievements",
            AchievementsResponse.class, HttpStatus.OK);

        assertThat(badge(res, "first_quest").getAchieved()).isTrue();     // 1 completed (expired doesn't count)
        assertThat(badge(res, "first_quest").getCurrent()).isEqualTo(1L);
        assertThat(badge(res, "quests_10").getAchieved()).isFalse();
        assertThat(badge(res, "quests_10").getCurrent()).isEqualTo(1L);
        assertThat(badge(res, "first_activity").getAchieved()).isTrue();  // 2 entries
        assertThat(badge(res, "savings_100k").getAchieved()).isTrue();    // 120k >= 100k
        assertThat(badge(res, "savings_100k").getCurrent()).isEqualTo(120000L);
        assertThat(badge(res, "all_life_active").getCurrent()).isEqualTo(1L);
        assertThat(badge(res, "all_life_active").getAchieved()).isFalse();
        assertThat(badge(res, "life_lv5").getCurrent()).isEqualTo(1L);    // best LIFE level is 1
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=AchievementsApiIT -DargLine=-Xmx3g`
Expected: FAIL — compile error (controller doesn't implement `getAchievements`).

- [ ] **Step 3: Implement**

`PerkUnlockRepository.java` add:
```java
    List<PerkUnlockEntity> findByCreatedByOrderByUnlockedAtDesc(UUID createdBy);
```

`AchievementService.java`:
```java
package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.api.dto.AchievementsResponse;
import io.mrkuhne.mezo.api.dto.BadgeResponse;
import io.mrkuhne.mezo.api.dto.PerkUnlockResponse;
import io.mrkuhne.mezo.feature.progression.ActivityLedgerSource;
import io.mrkuhne.mezo.feature.progression.PerkCatalog;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.feature.progression.QuestLedgerSource;
import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import io.mrkuhne.mezo.feature.progression.repository.PerkUnlockRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Growth achievements (Me Growth page, bd mezo-rmhr): 9 badges DERIVED ON READ from the
 * existing ledgers — deterministic, retroactive, zero migration cost, no unlock dates (a
 * persistent achievement table with dates + celebration overlay is the recorded future
 * upgrade). Perks are the persisted milestone unlocks joined with the catalog copy. Port
 * switches off ⇒ those badges honestly report current=0.
 */
@Service
@RequiredArgsConstructor
public class AchievementService {

    /** All-time window for the ledger ports (they take date ranges). */
    static final LocalDate ALL_TIME_FROM = LocalDate.of(2000, 1, 1);

    private final SkillProgressRepository skillProgressRepository;
    private final PerkUnlockRepository perkUnlockRepository;
    private final PerkCatalog perkCatalog;
    private final TraitCalculator traitCalculator;
    private final ObjectProvider<QuestLedgerSource> questLedgerSource;
    private final ObjectProvider<ActivityLedgerSource> activityLedgerSource;

    public AchievementsResponse achievements(UUID createdBy) {
        LocalDate today = LocalDate.now();

        long questsCompleted = 0;
        QuestLedgerSource quests = questLedgerSource.getIfAvailable();
        if (quests != null) {
            questsCompleted = quests.closedQuestStats(createdBy, ALL_TIME_FROM, today).completed();
        }
        long activityEntries = 0;
        long savingsAllTime = 0;
        ActivityLedgerSource activities = activityLedgerSource.getIfAvailable();
        if (activities != null) {
            ActivityLedgerSource.Stats s = activities.stats(createdBy, ALL_TIME_FROM, today);
            activityEntries = s.entries();
            savingsAllTime = s.savingsHuf();
        }
        int consistencyWeeks = traitCalculator.traits(createdBy, today).getConsistencyWeeks();

        List<SkillProgressEntity> lifeRows = skillProgressRepository
            .findByCreatedByOrderBySkillKeyAsc(createdBy).stream()
            .filter(r -> ProgressionTaxonomy.LIFE.contains(r.getSkillKey()))
            .toList();
        long lifeActive = lifeRows.stream().filter(r -> r.getCumulativeXp() > 0).count();
        long lifeBestLevel = Math.max(1, lifeRows.stream()
            .mapToInt(SkillProgressEntity::getCurrentLevel).max().orElse(1));
        long lifeXpSum = lifeRows.stream().mapToLong(SkillProgressEntity::getCumulativeXp).sum();

        List<BadgeResponse> badges = new ArrayList<>();
        badges.add(badge("first_quest", "🏁", "Első küldetés", questsCompleted, 1));
        badges.add(badge("quests_10", "📜", "10 küldetés", questsCompleted, 10));
        badges.add(badge("quests_50", "🎖️", "50 küldetés", questsCompleted, 50));
        badges.add(badge("first_activity", "✍️", "Első tevékenység", activityEntries, 1));
        badges.add(badge("rhythm_4w", "🔥", "4 hetes ritmus", consistencyWeeks, 4));
        badges.add(badge("all_life_active", "🌈", "Mind a 8 LIFE aktív", lifeActive, 8));
        badges.add(badge("life_lv5", "🧠", "LIFE Lv 5", lifeBestLevel, 5));
        badges.add(badge("life_xp_10k", "🏛️", "10 000 LIFE XP", lifeXpSum, 10000));
        badges.add(badge("savings_100k", "💰", "100k megtakarítás", savingsAllTime, 100000));

        List<PerkUnlockResponse> perks = perkUnlockRepository
            .findByCreatedByOrderByUnlockedAtDesc(createdBy).stream()
            .map(u -> {
                var def = perkCatalog.find(u.getSkillKey(), u.getMilestoneLevel()).orElse(null);
                return PerkUnlockResponse.builder()
                    .perkKey(u.getPerkKey())
                    .name(def != null ? def.name() : u.getPerkKey())
                    .effectCopy(def != null ? def.effectCopy() : "")
                    .skillKey(u.getSkillKey())
                    .milestoneLevel(u.getMilestoneLevel())
                    .unlockedAt(u.getUnlockedAt().atOffset(ZoneOffset.UTC))
                    .build();
            })
            .toList();

        return AchievementsResponse.builder().badges(badges).perks(perks).build();
    }

    private static BadgeResponse badge(String key, String icon, String name, long current, long target) {
        return BadgeResponse.builder()
            .key(key).icon(icon).name(name)
            .achieved(current >= target)
            .current(current).target(target)
            .build();
    }
}
```
(ADAPT: `unlockedAt` mapping — if the generated DTO field is `OffsetDateTime` the `.atOffset(ZoneOffset.UTC)` stands; mirror how other mappers convert `Instant`.)

`ProgressionController.java` add (inject `AchievementService achievementService`):
```java
    @Override
    public AchievementsResponse getAchievements() {
        return achievementService.achievements(currentUserId.get());
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=AchievementsApiIT -DargLine=-Xmx3g`
Expected: PASS (2 tests).

- [ ] **Step 5: Guard + commit**

Run: `cd backend && ./mvnw clean test -Dtest='Progression*,ArchitectureTest' -DargLine=-Xmx3g` → PASS.

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(progression): achievements read — 9 derived badges + perk unlocks (mezo-rmhr)"
```

---

### Task 5: FE data layer — history + achievements hooks, journal logic

**Files:**
- Create: `frontend/src/data/progression/achievementsMock.ts`, `frontend/src/features/me/logic/growthJournal.ts` (+ `growthJournal.test.ts`)
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/quest/{questApi,questMock,questHooks}.ts` (+ questHooks.test.tsx), `frontend/src/data/activity/{activityApi,activityMock,activityHooks}.ts` (+ activityHooks.test.tsx), `frontend/src/data/progression/{progressionApi,progressionHooks}.ts` (+ test if present), `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Produces (consumed by Tasks 6–8): barrel hooks `useQuestHistory(from: string, to: string)` → `{ data: DailyQuest[], isPending }`, `useActivityHistory(from: string, to: string)` → `{ data: ActivityEntry[], isPending }`, `useAchievements()` → `{ data: Achievements, isPending }`; types `GrowthBadge { key, icon, name, achieved, current, target }`, `PerkUnlock { perkKey, name, effectCopy, skillKey, milestoneLevel, unlockedAt }`, `Achievements { badges: GrowthBadge[], perks: PerkUnlock[] }`; pure `buildGrowthJournal(quests: DailyQuest[], activities: ActivityEntry[], todayIso: string): JournalDay[]` with `JournalDay { date: string; label: string; xpTotal: number; entries: JournalEntry[] }` and `JournalEntry = { kind: 'quest'; quest: DailyQuest } | { kind: 'activity'; activity: ActivityEntry }`.

- [ ] **Step 1: Types** (`data/types.ts`, after the activity block):

```ts
// ── Growth achievements (Me Growth page, mezo-rmhr) ──────────────────────────
export interface GrowthBadge {
  key: string
  icon: string
  name: string
  achieved: boolean
  current: number
  target: number
}
export interface PerkUnlock {
  perkKey: string
  name: string
  effectCopy: string
  skillKey: string
  milestoneLevel: number
  unlockedAt: string
}
export interface Achievements {
  badges: GrowthBadge[]
  perks: PerkUnlock[]
}
```

- [ ] **Step 2: API wrappers** — follow each file's existing wire idiom exactly (`apiFetch`, `paths[...]` types):
- `questApi.ts`: `history: (from: string, to: string) => apiFetch<...>(`/api/quest/history?from=${from}&to=${to}`).then((list) => list.map(toQuest))`.
- `activityApi.ts`: `history: (from, to) => ... .then((list) => list.map(toActivity))`.
- `progressionApi.ts`: re-export the generated `AchievementsResponse` piece-types if useful, plus `progressionApi.getAchievements()` → GET `/api/progression/achievements` mapped onto the hand `Achievements` type (fields are 1:1; cast/spread like `toActivity` does, `unlockedAt` kept as string).

- [ ] **Step 3: Mocks** (deterministic, fixed dates):
- `questMock.ts` add:
```ts
/** Mock seed: 30-day quest history for the Growth journal (terminal statuses only). */
export const mockQuestHistory: DailyQuest[] = [
  { ...mockQuestDay[1], id: 'qh1' },
  {
    id: 'qh2', questDate: '2026-07-11', slot: 'BODY', skillKey: 'strength_endurance',
    title: 'A mai tervezett edzés a naptárban van — csináld végig',
    why: 'A megjelenés a legerősebb identitás-szavazat: aki ma edz, az edző ember.',
    targetLabel: 'Mai tervezett edzés teljesítve', xp: 25, status: 'completed',
    completedAt: '2026-07-11T18:05:00Z', completionMode: 'DERIVED',
  },
  {
    id: 'qh3', questDate: '2026-07-11', slot: 'GROWTH', skillKey: 'mindfulness',
    title: '10 perc meditáció vagy légzőgyakorlat',
    why: 'A figyelmed izom: napi 10 perc edzéssel nyugodtabb az alvás és élesebb a fókusz.',
    targetLabel: 'Tevékenységnapló-bejegyzés ma', xp: 20, status: 'expired', completionMode: 'ACTIVITY',
  },
  {
    id: 'qh4', questDate: '2026-07-10', slot: 'FUELBIO', skillKey: 'recovery',
    title: 'Igyál meg legalább 2,5 litert ma',
    why: 'A hidratáltság a legolcsóbb teljesítményfokozó — edzés, fókusz, étvágy mind rajta múlik.',
    targetLabel: '≥ 2500 ml víz', xp: 15, status: 'completed',
    completedAt: '2026-07-10T20:00:00Z', completionMode: 'DERIVED',
  },
]
```
- `activityMock.ts` add:
```ts
/** Mock seed: 30-day activity history for the Growth journal. */
export const mockActivityHistory: ActivityEntry[] = [
  ...mockActivities,
  {
    id: 'ah1', occurredOn: '2026-07-10', text: 'Rendet raktam a garázsban',
    skillKey: 'productivity', confidence: 0.7, xpAwarded: 10,
    durationMin: null, amountHuf: null, categorizedBy: 'USER', createdAt: '2026-07-10T17:00:00Z',
  },
]
```
- `achievementsMock.ts` (mirror the mockup's 4/9 state):
```ts
import type { Achievements } from '@/data/types'

/** Mock seed: the approved mockup's 4/9 achievement state. */
export const achievementsMock: Achievements = {
  badges: [
    { key: 'first_quest', icon: '🏁', name: 'Első küldetés', achieved: true, current: 23, target: 1 },
    { key: 'quests_10', icon: '📜', name: '10 küldetés', achieved: true, current: 23, target: 10 },
    { key: 'quests_50', icon: '🎖️', name: '50 küldetés', achieved: false, current: 23, target: 50 },
    { key: 'first_activity', icon: '✍️', name: 'Első tevékenység', achieved: true, current: 14, target: 1 },
    { key: 'rhythm_4w', icon: '🔥', name: '4 hetes ritmus', achieved: true, current: 5, target: 4 },
    { key: 'all_life_active', icon: '🌈', name: 'Mind a 8 LIFE aktív', achieved: false, current: 6, target: 8 },
    { key: 'life_lv5', icon: '🧠', name: 'LIFE Lv 5', achieved: false, current: 3, target: 5 },
    { key: 'life_xp_10k', icon: '🏛️', name: '10 000 LIFE XP', achieved: false, current: 1085, target: 10000 },
    { key: 'savings_100k', icon: '💰', name: '100k megtakarítás', achieved: false, current: 50000, target: 100000 },
  ],
  perks: [
    { perkKey: 'armor_plating_1', name: 'Páncélzat', effectCopy: '10 hét töretlen — sérülésállóság nő', skillKey: 'robustness', milestoneLevel: 10, unlockedAt: '2026-07-08T10:00:00Z' },
    { perkKey: 'afterburner_1', name: 'Utánégő', effectCopy: 'becsült csúcssebesség +4%', skillKey: 'sprint_speed', milestoneLevel: 10, unlockedAt: '2026-07-01T10:00:00Z' },
    { perkKey: 'iron_core_2', name: 'Vas-törzs II', effectCopy: 'push-volumen tűrés +6%', skillKey: 'max_strength', milestoneLevel: 5, unlockedAt: '2026-06-20T10:00:00Z' },
  ],
}
```

- [ ] **Step 4: Hooks** (`useDualQuery`, inline query keys):
- `questHooks.ts`: `export function useQuestHistory(from: string, to: string)` → `useDualQuery<DailyQuest[]>({ queryKey: ['questHistory', from, to], mockData: mockQuestHistory, realFetch: () => questApi.history(from, to), realEmpty: [] })`.
- `activityHooks.ts`: `export function useActivityHistory(from: string, to: string)` → key `['activityHistory', from, to]`, mock `mockActivityHistory`, real `activityApi.history(from, to)`, empty `[]`.
- `progressionHooks.ts`: `export function useAchievements()` → key `['achievements']`, mock `achievementsMock`, real `progressionApi.getAchievements()`, `realEmpty: { badges: [], perks: [] }`, `realStaleTime: 60_000`.
- Barrel `data/hooks.ts`: `export { useQuestHistory } ...` etc. (extend the existing lines).

- [ ] **Step 5: MSW defaults** (`handlers.ts`, next to the quest/activity handlers):
```ts
  http.get(`${API_BASE}/api/quest/history`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/activity/history`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/progression/achievements`, () =>
    HttpResponse.json({
      badges: [
        { key: 'first_quest', icon: '🏁', name: 'Első küldetés', achieved: false, current: 0, target: 1 },
      ],
      perks: [],
    })),
```

- [ ] **Step 6: `growthJournal.ts`** (pure, colocated test):

```ts
import type { ActivityEntry, DailyQuest } from '@/data/types'

export type JournalEntry =
  | { kind: 'quest'; quest: DailyQuest }
  | { kind: 'activity'; activity: ActivityEntry }

export interface JournalDay {
  date: string
  label: string
  xpTotal: number
  entries: JournalEntry[]
}

const MONTHS_HU = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']

export function dayLabel(dateIso: string, todayIso: string): string {
  if (dateIso === todayIso) return 'Ma'
  const d = new Date(dateIso + 'T00:00:00')
  const t = new Date(todayIso + 'T00:00:00')
  if (t.getTime() - d.getTime() === 86_400_000) return 'Tegnap'
  return `${MONTHS_HU[d.getMonth()]} ${d.getDate()}`
}

/** Merge quests + activities into descending day groups with day XP totals.
 *  Offered (still-live) quests are excluded — they belong to Today, not the journal. */
export function buildGrowthJournal(
  quests: DailyQuest[],
  activities: ActivityEntry[],
  todayIso: string,
): JournalDay[] {
  const byDate = new Map<string, JournalEntry[]>()
  const push = (date: string, e: JournalEntry) => {
    const list = byDate.get(date) ?? []
    list.push(e)
    byDate.set(date, list)
  }
  for (const q of quests) {
    if (q.status === 'offered' || q.status === 'rerolled') continue
    push(q.questDate, { kind: 'quest', quest: q })
  }
  for (const a of activities) push(a.occurredOn, { kind: 'activity', activity: a })

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, entries]) => ({
      date,
      label: dayLabel(date, todayIso),
      xpTotal: entries.reduce((sum, e) =>
        sum + (e.kind === 'quest'
          ? (e.quest.status === 'completed' ? e.quest.xp : 0)
          : e.activity.xpAwarded), 0),
      entries,
    }))
}
```

`growthJournal.test.ts` — assert: (a) day grouping descending with mixed quests+activities; (b) offered/rerolled quests excluded; (c) xpTotal counts completed-quest xp + activity xpAwarded, expired quests contribute 0; (d) `dayLabel` returns `Ma`/`Tegnap`/`Júl 10` for '2026-07-12' today. Write the four cases with small literal fixtures (reuse the mock shapes).

- [ ] **Step 7: Hook tests** — extend `questHooks.test.tsx` and `activityHooks.test.tsx` with one mock-mode case each (`useQuestHistory` returns the 4-entry seed; `useActivityHistory` returns 4 entries) and one real-mode case (MSW `[]` default resolves). Add a `useAchievements` mock-mode case (9 badges) wherever the progression hook tests live (create `progressionHooks.test.tsx` mirroring the sibling test files if none exists).

- [ ] **Step 8: Gates + commit**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3.

```bash
git add frontend/src/data frontend/src/features/me/logic frontend/src/test/msw/handlers.ts
git -c core.hooksPath=/dev/null commit -m "feat(fe/data): history + achievements hooks and growth-journal builder (mezo-rmhr)"
```

---

### Task 6: FE — GrowthPage skeleton, route, subnav, hero + Skillek tab

**Files:**
- Create: `frontend/src/features/me/pages/GrowthPage.tsx` (+ `GrowthPage.test.tsx`), `frontend/src/features/me/components/SkillBandCard.tsx` (+ `SkillBandCard.test.tsx`)
- Modify: `frontend/src/app/router.tsx`, `frontend/src/features/me/pages/MeSubNav.tsx` (+ `MeSubNav.test.tsx`), `frontend/src/features/progression/logic/levelUpMeta.ts`

**Interfaces:**
- Consumes: `useProgressionProfile()` (profile: athletic/muscle/life SkillLevel[], traits, savingsHuf30d), `LIFE_SKILLS`, `MUSCLE_LABELS` (`@/data/train/train`).
- Produces (consumed by Task 7): `GrowthPage` with `const [tab, setTab] = useState<'skills' | 'journal' | 'awards'>('skills')`, hero always rendered, `{tab === 'skills' && …}` sections; `SkillBandCard({ eyebrow, chip, rows, footer }: { eyebrow: string; chip: string; rows: SkillRowVM[]; footer?: ReactNode })` with `SkillRowVM { key: string; icon: string; name: string; level: number; progressPct: number; xp: number }`.

- [ ] **Step 1: Export the athletic meta** — in `levelUpMeta.ts` change `const ATHLETIC_META` to `export const ATHLETIC_META` (the map already includes `robustness`).

- [ ] **Step 2: Route + subnav.** `router.tsx`: inside the `me` children, after the index route: `{ path: 'growth', element: <GrowthPage /> }` (+ import). `MeSubNav.tsx`: insert `{ to: '/me/growth', label: 'Growth' }` right after the Profil item. Update `MeSubNav.test.tsx` expectations (tab count/labels).

- [ ] **Step 3: `SkillBandCard.tsx`** — presentational, reuses `.progress-m*` classes:

```tsx
import type { ReactNode } from 'react'

export interface SkillRowVM {
  key: string
  icon: string
  name: string
  level: number
  progressPct: number
  xp: number
}

const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/** One skill band (LIFE / Atlétikus / Izom) as a full meter-row list — Growth page Skillek tab. */
export function SkillBandCard({ eyebrow, chip, rows, footer }: {
  eyebrow: string
  chip: string
  rows: SkillRowVM[]
  footer?: ReactNode
}) {
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow brand">{eyebrow}</span>
        <span className="chip notch-4">{chip}</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="progress-mrow">
          <span className="progress-mrk">{r.icon}</span>
          <span className="progress-mnm">{r.name}</span>
          <span className="progress-mlv">Lv {r.level}</span>
          <div className="progress-mbar"><div className="progress-mfill" style={{ width: `${Math.min(100, Math.max(0, r.progressPct))}%` }} /></div>
          <span style={{ width: 46, textAlign: 'right', fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{fmt(r.xp)}</span>
        </div>
      ))}
      {footer}
    </div>
  )
}
```
ADAPT the row markup to the exact `.progress-m*` structure the deleted `MuscleLevelsCard` used (read it BEFORE deleting in Task 8 — copy its row idiom incl. the reduced-motion `--w` fill pattern if that is how `.progress-mfill` animates).

- [ ] **Step 4: `GrowthPage.tsx`:**

```tsx
import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { useProgressionProfile } from '@/data/hooks'
import { SkillBandCard, type SkillRowVM } from '@/features/me/components/SkillBandCard'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { SkillLevel } from '@/data/progression/progressionApi'

type Tab = 'skills' | 'journal' | 'awards'

const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

const byLevelXpDesc = (a: SkillLevel, b: SkillLevel) =>
  b.level - a.level || b.cumulativeXp - a.cumulativeXp

function toRows(skills: SkillLevel[], iconOf: (key: string) => string, nameOf: (key: string) => string): SkillRowVM[] {
  return [...skills].sort(byLevelXpDesc).map((s) => ({
    key: s.skillKey, icon: iconOf(s.skillKey), name: nameOf(s.skillKey),
    level: s.level, progressPct: s.progressPct, xp: s.cumulativeXp,
  }))
}

export function GrowthPage() {
  const { data: profile } = useProgressionProfile()
  const [tab, setTab] = useState<Tab>('skills')

  const life = profile.life ?? []
  const athletic = profile.athletic ?? []
  const muscle = profile.muscle ?? []
  const totalXp = [...life, ...athletic, ...muscle].reduce((s, x) => s + x.cumulativeXp, 0)
  const lifeXp = life.reduce((s, x) => s + x.cumulativeXp, 0)
  const disc = profile.traits?.disciplinePct
  const weeks = profile.traits?.consistencyWeeks ?? 0
  const savings = profile.savingsHuf30d

  const lifeMeta = (k: string) => LIFE_SKILLS.find((s) => s.key === k)
  const athMeta = (k: string) => ATHLETIC_META[k]

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Me</Eyebrow>
          <PageTitle className="mt-sm">Growth</PageTitle>
        </div>
      </div>
      <div style={{ padding: '8px 24px 24px' }}>
        <div className="col gap-md">
          {/* hero trio — always visible */}
          <div className="card notch-12" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <HeroStat value={fmt(totalXp)} label="Össz XP" />
              <HeroStat value={disc == null ? '–' : `${disc}%`} label="Fegyelem" />
              <HeroStat value={`${weeks} hét`} label="Ritmus" />
            </div>
          </div>

          {/* segmented control */}
          <div className="row" role="tablist" aria-label="Growth nézetek" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: 3, gap: 3 }}>
            <SegButton on={tab === 'skills'} onClick={() => setTab('skills')}>Skillek</SegButton>
            <SegButton on={tab === 'journal'} onClick={() => setTab('journal')}>Napló</SegButton>
            <SegButton on={tab === 'awards'} onClick={() => setTab('awards')}>Kitüntetések</SegButton>
          </div>

          {tab === 'skills' && (
            <>
              <SkillBandCard
                eyebrow="LIFE"
                chip={`8 skill · ${fmt(lifeXp)} XP`}
                rows={toRows(life, (k) => lifeMeta(k)?.icon ?? '✨', (k) => lifeMeta(k)?.name ?? k)}
                footer={typeof savings === 'number' && savings > 0 ? (
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 11, paddingTop: 9, borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-secondary" style={{ fontSize: 12 }}>Megtakarítás (30 nap)</span>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 600, color: 'var(--brand-glow)' }}>{fmt(savings)} Ft</span>
                  </div>
                ) : undefined}
              />
              <SkillBandCard
                eyebrow="Atlétikus"
                chip={`12 skill · átlag ${profile.athleteLevel ?? '–'}`}
                rows={toRows(athletic, (k) => athMeta(k)?.icon ?? '✨', (k) => athMeta(k)?.name ?? k)}
              />
              <SkillBandCard
                eyebrow="Izom"
                chip={`13 izom · legjobb Lv ${muscle.length ? Math.max(...muscle.map((m) => m.level)) : 1}`}
                rows={toRows(muscle, () => '💪', (k) => MUSCLE_LABELS[k] ?? k)}
              />
            </>
          )}
          {tab === 'journal' && <JournalTab />}
          {tab === 'awards' && <AwardsTab />}
        </div>
      </div>
    </>
  )
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '11px 6px 9px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 23, color: 'var(--brand-glow)' }}>{value}</div>
      <div className="eyebrow" style={{ marginTop: 3 }}>{label}</div>
    </div>
  )
}

function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button role="tab" aria-selected={on} onClick={onClick}
      className="notch-4"
      style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '7px 0', borderRadius: 3,
        color: on ? 'var(--brand-glow)' : 'var(--text-tertiary)',
        background: on ? 'var(--surface-3)' : 'transparent',
        boxShadow: on ? 'inset 0 0 0 1px var(--border-brand)' : 'none' }}>
      {children}
    </button>
  )
}

/* Task 7 fills these in — Task 6 ships placeholders that render nothing visible. */
function JournalTab() { return null }
function AwardsTab() { return null }
```
NOTE for Task 6: `JournalTab`/`AwardsTab` returning null is the DELIBERATE intermediate state — Task 7 replaces them. ADAPT: shared UI (`Eyebrow`, `PageTitle`, `page-header`) — mirror `ProfilePage`'s header block exactly.

- [ ] **Step 5: Tests.**
- `GrowthPage.test.tsx` (mock the barrel like sibling page tests; render with router+query wrappers): (a) hero shows the FE-summed Össz XP (from `progressionProfileMock`: sum of all cumulativeXp — compute the literal in the test), "78%", "5 hét"; (b) default tab lists all three band eyebrows (LIFE, Atlétikus, Izom) and 8+12+13 = 33 `.progress-mrow` rows; (c) LIFE card shows "Megtakarítás (30 nap)" + "50 000 Ft"; (d) clicking Napló hides the band cards.
- `SkillBandCard.test.tsx`: rows render name/Lv/xp; footer renders when given.
- `MeSubNav.test.tsx`: Growth tab present after Profil.

- [ ] **Step 6: Gates + commit**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3.

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fe/me): Growth page skeleton — route, subnav, hero + all-band Skillek tab (mezo-rmhr)"
```

---

### Task 7: FE — Napló + Kitüntetések tabs

**Files:**
- Create: `frontend/src/features/me/components/GrowthJournalCard.tsx` (+ test), `frontend/src/features/me/components/BadgesCard.tsx` (+ test), `frontend/src/features/me/components/PerksCard.tsx` (+ test)
- Modify: `frontend/src/features/me/pages/GrowthPage.tsx` (+ its test)

**Interfaces:**
- Consumes: `useQuestHistory`/`useActivityHistory`/`useAchievements` (Task 5, via `@/data/hooks`), `buildGrowthJournal`/`JournalDay` (Task 5), `LIFE_SKILLS`, `localDateString` (`@/shared/lib/dates`).
- Produces: `GrowthJournalCard({ days, summary })`, `BadgesCard({ badges })`, `PerksCard({ perks })`.

- [ ] **Step 1: `GrowthJournalCard.tsx`:**

```tsx
import type { JournalDay } from '@/features/me/logic/growthJournal'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'

const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/** 30-day quest+activity journal, day-grouped (Growth page Napló tab). */
export function GrowthJournalCard({ days, summary }: { days: JournalDay[]; summary: string }) {
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow brand">Utolsó 30 nap</span>
        <span className="chip notch-4">{summary}</span>
      </div>
      {days.length === 0 && (
        <p className="text-tertiary" style={{ fontSize: 12, marginTop: 10 }}>
          Még nincs bejegyzés — a teljesített küldetések és tevékenységek itt gyűlnek.
        </p>
      )}
      {days.map((d) => (
        <div key={d.date} style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 5, borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="eyebrow">{d.label}</span>
            <span className="eyebrow">+{d.xpTotal} XP</span>
          </div>
          {d.entries.map((e) =>
            e.kind === 'quest' ? (
              <div key={`q-${e.quest.id}`} className="row" style={{ gap: 9, alignItems: 'flex-start', paddingTop: 7, opacity: e.quest.status === 'expired' ? 0.6 : 1 }}>
                <span style={{ width: 15, textAlign: 'center', color: e.quest.status === 'completed' ? 'var(--success)' : 'var(--text-quaternary)' }}>
                  {e.quest.status === 'completed' ? '✓' : '—'}
                </span>
                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>
                  {e.quest.title}
                  <span className="text-tertiary" style={{ display: 'block', fontSize: 10 }}>
                    küldetés · {e.quest.slot}
                    {e.quest.status === 'completed' && e.quest.completionMode === 'ACTIVITY' ? ' — tevékenységgel teljesült' : ''}
                    {e.quest.status === 'expired' ? ' · csendben lejárt' : ''}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: e.quest.status === 'completed' ? 'var(--brand-glow)' : 'var(--text-quaternary)' }}>
                  {e.quest.status === 'completed' ? `+${e.quest.xp}` : '0'}
                </span>
              </div>
            ) : (
              <div key={`a-${e.activity.id}`} className="row" style={{ gap: 9, alignItems: 'flex-start', paddingTop: 7 }}>
                <span style={{ width: 15, textAlign: 'center', color: 'var(--brand-glow)' }}>✎</span>
                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35 }}>
                  {e.activity.text}
                  <span className="text-tertiary" style={{ display: 'block', fontSize: 10 }}>
                    tevékenység
                    {e.activity.skillKey ? ` · ${LIFE_SKILLS.find((s) => s.key === e.activity.skillKey)?.icon ?? ''} ${LIFE_SKILLS.find((s) => s.key === e.activity.skillKey)?.name ?? e.activity.skillKey}` : ' · besorolatlan'}
                    {typeof e.activity.amountHuf === 'number' && e.activity.amountHuf > 0 ? ` · ${fmt(e.activity.amountHuf)} Ft` : ''}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: e.activity.xpAwarded > 0 ? 'var(--brand-glow)' : 'var(--text-quaternary)' }}>
                  {e.activity.xpAwarded > 0 ? `+${e.activity.xpAwarded}` : '0'}
                </span>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `BadgesCard.tsx` + `PerksCard.tsx`:**

```tsx
import type { GrowthBadge } from '@/data/types'

/** 9 computed growth badges — achieved = brand tint + ✓; else progress bar (Growth page). */
export function BadgesCard({ badges }: { badges: GrowthBadge[] }) {
  const done = badges.filter((b) => b.achieved).length
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow brand">Badge-ek</span>
        <span className="chip notch-4">{done} / {badges.length} megszerezve</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
        {badges.map((b) => (
          <div key={b.key} style={{
            background: b.achieved ? 'rgba(94,234,212,0.05)' : 'var(--surface-2)',
            border: `1px solid ${b.achieved ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
            borderRadius: 4, padding: '10px 6px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 19 }}>{b.icon}</div>
            <div style={{ fontSize: 9.5, fontWeight: 600, marginTop: 4, lineHeight: 1.25 }}>{b.name}</div>
            {b.achieved ? (
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--brand-glow)', marginTop: 3 }}>✓</div>
            ) : (
              <>
                <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (b.current / b.target) * 100)}%`, background: 'var(--brand-primary)' }} />
                </div>
                <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
                  {b.current.toLocaleString('hu-HU').replace(/[  ]/g, ' ')} / {b.target.toLocaleString('hu-HU').replace(/[  ]/g, ' ')}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

```tsx
import type { PerkUnlock } from '@/data/types'

/** Unlocked perk milestones, newest first (Growth page Kitüntetések tab). */
export function PerksCard({ perks }: { perks: PerkUnlock[] }) {
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow brand">Perkek — mérföldkövek</span>
        <span className="chip notch-4">{perks.length} feloldva</span>
      </div>
      {perks.length === 0 && (
        <p className="text-tertiary" style={{ fontSize: 12, marginTop: 10 }}>
          Még nincs feloldott perk — a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.
        </p>
      )}
      {perks.map((p, i) => (
        <div key={p.perkKey + p.unlockedAt} className="row" style={{ gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', marginTop: i === 0 ? 8 : 0 }}>
          <span style={{ flex: 1, fontSize: 12 }}>
            {p.name}
            <span className="text-tertiary" style={{ display: 'block', fontSize: 10, marginTop: 1 }}>{p.effectCopy}</span>
          </span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            {p.skillKey} · LV{p.milestoneLevel}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Wire the tabs in `GrowthPage.tsx`** — replace the null placeholders:

```tsx
function JournalTab() {
  const today = localDateString()
  const from = isoDaysAgo(29)
  const { data: quests } = useQuestHistory(from, today)
  const { data: activities } = useActivityHistory(from, today)
  const days = buildGrowthJournal(quests, activities, today)
  const completed = quests.filter((q) => q.status === 'completed').length
  const expired = quests.filter((q) => q.status === 'expired').length
  return <GrowthJournalCard days={days} summary={`${completed} ✓ · ${expired} — · ${activities.length} ✎`} />
}

function AwardsTab() {
  const { data } = useAchievements()
  return (
    <>
      <BadgesCard badges={data.badges} />
      <PerksCard perks={data.perks} />
    </>
  )
}
```
`isoDaysAgo(n)`: add next to the page's helpers — `const isoDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }` — UNLESS `@/shared/lib/dates` already has an equivalent (check first and reuse).

- [ ] **Step 4: Tests.**
- `GrowthJournalCard.test.tsx`: renders day labels + entries; expired quest shows "csendben lejárt" + `0`; activity-completed quest shows "tevékenységgel teljesült"; financial sublabel shows "50 000 Ft"; empty days → empty copy.
- `BadgesCard.test.tsx`: 9 badges; achieved shows ✓ and no progress bar; unachieved shows `current / target`; header `4 / 9 megszerezve` from the mock.
- `PerksCard.test.tsx`: rows render name/effectCopy/`SKILL · LVn`; empty state copy.
- `GrowthPage.test.tsx` extension: Napló tab renders the journal from mock seeds (a "Tegnap" group from qh2/qh3 given mock dates vs mocked today — pin todayIso by mocking `localDateString` to '2026-07-12'); Kitüntetések tab renders both cards.

- [ ] **Step 5: Gates + commit**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3.

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fe/me): Growth page Naplo + Kituntetesek tabs (mezo-rmhr)"
```

---

### Task 8: FE — Profile consolidation, radars retire

**Files:**
- Create: `frontend/src/features/me/components/GrowthSummaryCard.tsx` (+ test)
- Modify: `frontend/src/features/me/pages/ProfilePage.tsx` (+ its test if present), `frontend/src/styles/prototype.css`
- Delete: `frontend/src/features/me/components/AthleticRadarCard.tsx` (+ `.test.tsx`), `frontend/src/features/me/components/MuscleLevelsCard.tsx` (+ `.test.tsx`), `frontend/src/features/me/components/GrowthCard.tsx` (+ `.test.tsx`), `frontend/src/features/me/logic/radarGeometry.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `useProgressionProfile` (via ProfilePage prop pattern), `skillDisplay`/`LIFE_SKILLS`/`ATHLETIC_META` from levelUpMeta, `MUSCLE_LABELS`, `useNavigate` (react-router).
- Produces: `GrowthSummaryCard({ profile }: { profile: ProgressionProfileResponse })` — whole card navigates to `/me/growth`.

- [ ] **Step 1: `GrowthSummaryCard.tsx`** (BEFORE writing: read the current `GrowthCard.tsx` ghost block and reuse its ghost markup + copy verbatim):

```tsx
import { useNavigate } from 'react-router-dom'
import type { ProgressionProfileResponse, SkillLevel } from '@/data/progression/progressionApi'
import { ATHLETIC_META, LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'

const fmt = (v: number) => v.toLocaleString('hu-HU').replace(/[  ]/g, ' ')

/** Compact progression summary on the Profile tab — the whole card opens /me/growth. */
export function GrowthSummaryCard({ profile }: { profile: ProgressionProfileResponse }) {
  const navigate = useNavigate()
  const all: SkillLevel[] = [...(profile.athletic ?? []), ...(profile.muscle ?? []), ...(profile.life ?? [])]
  const totalXp = all.reduce((s, x) => s + x.cumulativeXp, 0)

  if (totalXp === 0) {
    /* ghost: reuse the deleted GrowthCard's ghost card markup + copy verbatim,
       with the tap still navigating to /me/growth */
  }

  const top3 = [...all].sort((a, b) => b.level - a.level || b.cumulativeXp - a.cumulativeXp).slice(0, 3)
  const iconName = (s: SkillLevel) =>
    s.kind === 'MUSCLE'
      ? { icon: '💪', name: MUSCLE_LABELS[s.skillKey] ?? s.skillKey }
      : s.kind === 'LIFE'
        ? { icon: LIFE_SKILLS.find((l) => l.key === s.skillKey)?.icon ?? '✨', name: LIFE_SKILLS.find((l) => l.key === s.skillKey)?.name ?? s.skillKey }
        : { icon: ATHLETIC_META[s.skillKey]?.icon ?? '✨', name: ATHLETIC_META[s.skillKey]?.name ?? s.skillKey }
  const disc = profile.traits?.disciplinePct
  const savings = profile.savingsHuf30d

  return (
    <button className="card notch-12" onClick={() => navigate('/me/growth')} aria-label="Growth oldal megnyitása"
      style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden', textAlign: 'left', width: '100%', display: 'block' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow brand">Growth</span>
        <span className="chip notch-4">{fmt(totalXp)} XP →</span>
      </div>
      <div className="row" style={{ gap: 14, marginTop: 9, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span>Atléta-szint <b style={{ color: 'var(--brand-glow)' }}>{profile.athleteLevel ?? '–'}</b></span>
        <span>Streak <b style={{ color: 'var(--brand-glow)' }}>{profile.streakWeeks} hét</b></span>
        <span>Fegyelem <b style={{ color: 'var(--brand-glow)' }}>{disc == null ? '–' : `${disc}%`}</b></span>
      </div>
      <div style={{ marginTop: 9 }}>
        {top3.map((s) => {
          const m = iconName(s)
          return (
            <div key={s.skillKey} className="row" style={{ gap: 8, fontSize: 12, paddingTop: 4 }}>
              <span style={{ width: 16, textAlign: 'center' }}>{m.icon}</span>
              <span style={{ flex: 1 }}>{m.name}</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10.5, color: 'var(--brand-glow)' }}>Lv {s.level}</span>
            </div>
          )
        })}
      </div>
      {typeof savings === 'number' && savings > 0 && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <span className="text-secondary" style={{ fontSize: 12 }}>Megtakarítás (30 nap)</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 600, color: 'var(--brand-glow)' }}>{fmt(savings)} Ft</span>
        </div>
      )}
    </button>
  )
}
```
The ghost branch comment is the ONE deliberate open point: copy the exact ghost markup/copy from `GrowthCard.tsx` before deleting it (it must render as a `<button>` navigating to `/me/growth` too).

- [ ] **Step 2: `ProfilePage.tsx`** — replace the three card usages + imports with `<GrowthSummaryCard profile={progression} />` (BiometricCard + sheet untouched); update the block comment to name the consolidation (mezo-rmhr).

- [ ] **Step 3: Delete** the four components/logic files + their tests (`git rm`). Then `grep -rn "AthleticRadarCard\|MuscleLevelsCard\|GrowthCard\|radarGeometry" frontend/src` — the ONLY remaining hits must be `GrowthSummaryCard`/`GrowthJournalCard` self-references; fix any straggler imports the grep reveals.

- [ ] **Step 4: CSS** — in `styles/prototype.css` delete the `.progress-radar-*` classes + the `progress-radar-in` keyframes (+ their reduced-motion guards). KEEP `.progress-mrow/mrk/mnm/mlv/mbar/mfill` + `progress-mbar-grow` (the band cards use them). Verify with `grep -n "progress-radar" frontend/src` → 0 hits.

- [ ] **Step 5: Tests.** `GrowthSummaryCard.test.tsx`: (a) populated profile renders total XP chip, top-3 rows (learning/…) and stats line; (b) click navigates to `/me/growth` (render inside a memory router, assert location); (c) ghost when zero XP; (d) savings row hidden at 0. Remove/replace any ProfilePage test expectations that referenced the deleted cards.

- [ ] **Step 6: Gates + commit**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3 (deleted-file tests gone, no dangling imports).

```bash
git add -A frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fe/me): GrowthSummaryCard replaces the profile progression cards — radars retire (mezo-rmhr)"
```

---

### Task 9: Docs + gates + PR + merge

**Files:**
- Modify: `docs/features/me.md` (major), `docs/features/growth.md`, `docs/milestones/roadmap.md`

- [ ] **Step 1: `me.md`** — §2 rewrite: Profil tab = Biometria + GrowthSummaryCard; NEW Growth subtab (hero + 3 tabs, all skills, journal, achievements); §3/§4 the new reads; §5 growth-domain pointers; §7 how to add a badge; §10 key files (REMOVE the deleted card/logic files from `key_files` + body, add the new ones); frontmatter `updated:`.
- [ ] **Step 2: `growth.md`** — §2 the new page as the growth layer's home surface; §4 the three new endpoints; §9 gotcha (badges derived on read — no unlock dates, persistent-achievements = recorded future upgrade); §10 key files.
- [ ] **Step 3: `roadmap.md`** — landing entry (Growth page, mezo-rmhr).
- [ ] **Step 4:** `node scripts/lint-docs.mjs` → 0 stale / 0 error (minimal truthful touches on any doc the shared-file edits staled — keep docs the LAST commit).
- [ ] **Step 5: Commit docs**

```bash
git add docs
git -c core.hooksPath=/dev/null commit -m "docs(features): me/growth + roadmap for the Growth page (mezo-rmhr)"
```

- [ ] **Step 6: Focused backend gate**

```bash
cd backend && ./mvnw clean test -Dtest='Quest*,Activity*,Progression*,Achievements*,ArchitectureTest' -DargLine=-Xmx3g
```
Expected: PASS.

- [ ] **Step 7: FE full gate**: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → PASS ×3.

- [ ] **Step 8: Visual verification (controller, mock mode):** /me → GrowthSummaryCard (tap-through), /me/growth → all three tabs against the approved mockup. Screenshots reviewed.

- [ ] **Step 9: Push + self-PR + CI + merge** (E2/E3 flow verbatim; PR title `Me Growth page: all-band skills + 30d journal + achievements + Profile consolidation (mezo-rmhr)`), then bd closeout from the MAIN checkout (`bd close mezo-rmhr` + handoff notes + `bd dolt push`).

## Self-review notes (done at plan time)

- Spec coverage: §2 UX (subnav/route/hero/segmented/3 tabs) → Tasks 6–7; §3 badge catalog → Task 4 (values copied into Global Constraints verbatim); §4 endpoints → Tasks 1–4; FE data + journal builder → Task 5; §5 Profile consolidation + deletions → Task 8; §6 testing → per-task; docs → Task 9.
- Compile-gap avoidance: contract→controller adjacency (1→2, 3→4) — no maven run in Tasks 1/3.
- Type consistency: `SkillRowVM` (Task 6 producer = consumer), `JournalDay`/`JournalEntry` (Task 5 → 7), `GrowthBadge`/`PerkUnlock`/`Achievements` (Task 5 → 7), history hook signatures (5 → 7); `ATHLETIC_META` export lands in Task 6 before Task 8 consumes it.
- Deliberate intermediate state: Task 6 ships null `JournalTab`/`AwardsTab` placeholders, replaced in Task 7 (documented in-plan, not an accidental gap).
- Open point flagged for the implementer: GrowthSummaryCard ghost branch copies the to-be-deleted GrowthCard's ghost markup verbatim (Task 8 Step 1 note).
