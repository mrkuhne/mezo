# Rutin-építő Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the routine surface out of the Growth tab into its own `/me/rutin` page reachable from a full-width tile on the Én hub, and add a 4-step wizard that builds one habit recipe on either BJ Fogg's Habit Stacking or James Clear's Four Laws.

**Architecture:** The existing `habit` domain is extended, never replaced. `habit_def` gains seven nullable framework columns; `HabitAdminService` validates them per framework at write time and keeps anchor references consistent when the anchor habit disappears. On the frontend the routine surface consolidates from three places (Growth segment, `/me/routines/edit`, plus the Nap tick page) into two: `/me/rutin` builds and edits, `/nap/rutin` still ticks. A pure `routineSentence()` function renders the recipe sentence everywhere it appears.

**Tech Stack:** Java 21 / Spring Boot / JPA / Liquibase / MapStruct-free hand mappers · OpenAPI contract-first (openapi-merge-cli + openapi-typescript) · React 19 / TypeScript / TanStack Query / Vitest / Testing Library · Playwright visual baselines.

## Global Constraints

- **One bd issue = one branch = one self-PR.** Slice S2 → `feat/rutin-epito-backend` (`mezo-3zue.2`), S3 → `feat/rutin-epito-hub` (`mezo-3zue.3`), S4 → `feat/rutin-epito-wizard` (`mezo-3zue.4`). Conventional commit subjects carry the bd id: `feat(habit): ... (mezo-3zue.2)`. Merge locally with `--no-ff` only after CI is green.
- **Never run the full backend suite locally without Testcontainers.** Focused runs only: `./mvnw test -Dtest='Habit*IT' -Dmezo.test.use-testcontainers=true`.
- **Frontend tests must run in both modes explicitly.** `VITE_USE_MOCK=false pnpm test` and `VITE_USE_MOCK=true pnpm test`. An unset variable means mock, so a bare `pnpm test` runs mock twice.
- **Contract-first:** every `api/feature/habit/habit.yml` edit is followed by `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`, and `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` are committed in the **same** commit. CI diffs them.
- **CODEMAP freshness:** any new frontend file, backend class, endpoint, or doc `key_files` change requires `node scripts/gen-codemap.mjs` in the same commit.
- **API version:** `api/base.yml` `info.version` goes `0.5.0` → `0.6.0` once, in Task 1.
- **Hungarian UI copy is inline in JSX.** No i18n library. `messages.properties` is errors-only; error codes are bare `SCREAMING_SNAKE` strings passed to `SystemMessage.error(...)`.
- **Backend layering:** classes live in `controller` / `service` / `repository` / `entity` / `mapper` subpackages; constructor injection only; `@Transactional` on methods only; `feature.habit` must never import `feature.companion`.
- **Feature switch:** every habit bean is already gated by `@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")`. Do not add beans without it.
- **No second tick control.** `/me/rutin` and its children render habit status read-only; ticking stays on `/nap/rutin`.
- **Design fidelity:** copy `docs/design_2.0/prototypes/src/rutin-epito-head.html` values ×1.18 (330px prototype frame → 390px app frame). Flag any deviation in the PR body.
- **Framework field rules (fixed by the spec, referenced by many tasks):** `FOGG` requires an anchor (`anchorHabitKey` or `anchorCopy`) and `celebration`; `CLEAR` requires `cue`, `craving`, `reward`, with `identity` optional; a null `framework` requires all seven framework fields to be null.

---

## File Structure

**Backend (S2)**

| File | Responsibility |
|---|---|
| `backend/src/main/resources/db/changelog/1.0.0/script/202609021100_mezo-3zue.2_habit_def_framework.sql` | Create: the seven nullable columns + the framework check constraint. |
| `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` | Modify: register the changeSet. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitDefEntity.java` | Modify: seven fields + two framework constants. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/habit/mapper/HabitMapper.java` | Modify: map the seven fields into `HabitDefAdmin`. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitFrameworkValidator.java` | Create: the only place that knows the per-framework field rules. Keeps `HabitAdminService` from growing a fourth validation concern. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitAdminService.java` | Modify: call the validator on create/update, apply the fields, run the anchor-release cascade on delete/deactivate. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitDefRepository.java` | Modify: one finder for defs pointing at a given anchor key. |
| `api/feature/habit/habit.yml`, `api/base.yml` | Modify: schema + version. |

**Frontend data layer (S3)**

| File | Responsibility |
|---|---|
| `frontend/src/data/types.ts` | Modify: `HabitFramework` + seven fields on `HabitDefInfo`, five on `HabitSuggestion`. |
| `frontend/src/data/habit/habitAdminApi.ts` | Modify: input types + wire mapping for the new fields. |
| `frontend/src/data/habit/habitMock.ts` | Modify: one FOGG and one CLEAR example def so both modes exercise the badges. |

**Frontend logic (S3)**

| File | Responsibility |
|---|---|
| `frontend/src/features/me/logic/routineSentence.ts` | Create: pure recipe-sentence rendering, both frameworks. |
| `frontend/src/features/me/logic/habitAnchors.ts` | Create: pure anchor-chip list derivation. |

**Frontend pages (S3, S4)**

| File | Responsibility |
|---|---|
| `frontend/src/features/me/pages/RutinHubPage.tsx` | Create (absorbs `GrowthRutinPage.tsx` and `RoutineEditorPage.tsx`, both deleted): the routine home. |
| `frontend/src/features/me/pages/RoutineWizardPage.tsx` | Create: the 4-step recipe wizard. |
| `frontend/src/features/me/pages/HabitPage.tsx` | Create: one habit's recipe page. |
| `frontend/src/features/me/pages/EnHubPage.tsx` | Modify: the wide Rutin tile + its line. |
| `frontend/src/features/me/pages/GrowthHubPage.tsx` | Modify: drop the Rutin tile, repoint `TAB_REDIRECT.routines`. |
| `frontend/src/app/router.tsx` | Modify: three new routes + two redirects. |
| `frontend/src/shared/ui/mozaik/index.tsx` | Modify: `wide` prop on `Tile`. |
| `frontend/src/styles/prototype.css` | Modify: the wide-tile row layout + the routine hub/wizard classes. |

---

## Slice S2 — Backend (`mezo-3zue.2`, branch `feat/rutin-epito-backend`)

### Task 1: Framework columns, entity, mapper, contract

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021100_mezo-3zue.2_habit_def_framework.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at end)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitDefEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/mapper/HabitMapper.java:toDefAdmin`
- Modify: `api/feature/habit/habit.yml`, `api/base.yml:8`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitChainDefEntityIT.java`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `HabitDefEntity` getters/setters `getFramework/setFramework`, `getAnchorHabitKey/setAnchorHabitKey`, `getCue/setCue`, `getCraving/setCraving`, `getReward/setReward`, `getCelebration/setCelebration`, `getIdentity/setIdentity` (all `String`); constants `HabitDefEntity.FRAMEWORK_FOGG = "FOGG"` and `FRAMEWORK_CLEAR = "CLEAR"`. Generated DTOs `HabitDefAdmin`, `HabitDefCreateRequest`, `HabitDefUpdateRequest` gain the same seven properties, with `framework` typed as the generated enum `HabitDefAdmin.FrameworkEnum` / `HabitDefCreateRequest.FrameworkEnum` / `HabitDefUpdateRequest.FrameworkEnum` with values `FOGG`, `CLEAR`.

- [ ] **Step 1: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202609021100_mezo-3zue.2_habit_def_framework.sql`:

```sql
alter table habit_def
    add column framework        varchar(5),
    add column anchor_habit_key varchar(40),
    add column cue              varchar(160),
    add column craving          varchar(200),
    add column reward           varchar(160),
    add column celebration      varchar(120),
    add column identity         varchar(120);

alter table habit_def
    add constraint ck_habit_def_framework
        check (framework is null or framework in ('FOGG', 'CLEAR'));

create index idx_habit_def_user_anchor on habit_def (created_by, anchor_habit_key);
```

- [ ] **Step 2: Register the changeSet**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609021100_mezo-3zue.2_habit_def_framework"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021100_mezo-3zue.2_habit_def_framework.sql
```

- [ ] **Step 3: Run the Liquibase linter**

Run: `node scripts/lint-liquibase.mjs`
Expected: PASS, no findings for the new file.

- [ ] **Step 4: Write the failing entity test**

Add to `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitChainDefEntityIT.java` (follow the file's existing persist-and-read style, using the same repository fields and owner id helper it already declares):

```java
    @Test
    void testHabitDef_shouldRoundTripFrameworkFields() {
        HabitDefEntity def = new HabitDefEntity();
        def.setCreatedBy(ownerId());
        def.setHabitKey("custom_fw01");
        def.setChainId(morningChainId());
        def.setPosition(99);
        def.setTitle("Napi szándék");
        def.setMode(HabitDefEntity.MODE_MANUAL);
        def.setMetric(HabitDefEntity.METRIC_MANUAL);
        def.setSkillKey("mindset");
        def.setXp(10);
        def.setFramework(HabitDefEntity.FRAMEWORK_CLEAR);
        def.setCue("7:10-kor a konyhaasztalnál");
        def.setCraving("tisztább fejjel indul a nap");
        def.setReward("a pipa maga");
        def.setIdentity("figyel a saját gondolataira");

        UUID id = defRepository.saveAndFlush(def).getId();
        entityManager.clear();

        HabitDefEntity read = defRepository.findById(id).orElseThrow();
        assertThat(read.getFramework()).isEqualTo("CLEAR");
        assertThat(read.getCue()).isEqualTo("7:10-kor a konyhaasztalnál");
        assertThat(read.getCraving()).isEqualTo("tisztább fejjel indul a nap");
        assertThat(read.getReward()).isEqualTo("a pipa maga");
        assertThat(read.getIdentity()).isEqualTo("figyel a saját gondolataira");
        assertThat(read.getAnchorHabitKey()).isNull();
        assertThat(read.getCelebration()).isNull();
    }
```

If `HabitChainDefEntityIT` has no `ownerId()` / `morningChainId()` / `entityManager` members, read the file's existing tests and reuse whatever they use to obtain the owner id and a chain id; do not invent new helpers.

- [ ] **Step 5: Run the test to verify it fails**

Run: `./mvnw test -Dtest='HabitChainDefEntityIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `setFramework` does not exist (compile error).

- [ ] **Step 6: Add the entity fields**

In `backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitDefEntity.java`, add the constants next to the existing ones:

```java
    public static final String FRAMEWORK_FOGG = "FOGG";
    public static final String FRAMEWORK_CLEAR = "CLEAR";
```

and the fields after `linkUrl`:

```java
    /** Behaviour-change framework this recipe was built on; null for pre-mezo-3zue defs. */
    @Column(length = 5)
    private String framework;

    /** FOGG: the habit_key of another of the user's defs this one is stacked onto. */
    @Column(name = "anchor_habit_key", length = 40)
    private String anchorHabitKey;

    /** CLEAR: when and where — the 1st law's "make it obvious". */
    @Column(length = 160)
    private String cue;

    /** CLEAR: the wanting behind the behaviour — the 2nd law. */
    @Column(length = 200)
    private String craving;

    /** CLEAR: what makes it satisfying — the 4th law. */
    @Column(length = 160)
    private String reward;

    /** FOGG: the immediate "shine" performed within seconds of the behaviour. */
    @Column(length = 120)
    private String celebration;

    /** CLEAR: the optional identity sentence ("…hogy olyan ember legyek, aki"). */
    @Column(length = 120)
    private String identity;
```

- [ ] **Step 7: Run the entity test to verify it passes**

Run: `./mvnw test -Dtest='HabitChainDefEntityIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 8: Extend the contract**

In `api/feature/habit/habit.yml`, add to `HabitDefAdmin.properties` (after `linkUrl`):

```yaml
        framework: { type: string, enum: [FOGG, CLEAR], nullable: true }
        anchorHabitKey: { type: string, nullable: true, maxLength: 40 }
        cue: { type: string, nullable: true, maxLength: 160 }
        craving: { type: string, nullable: true, maxLength: 200 }
        reward: { type: string, nullable: true, maxLength: 160 }
        celebration: { type: string, nullable: true, maxLength: 120 }
        identity: { type: string, nullable: true, maxLength: 120 }
```

Add the identical seven-property block to `HabitDefCreateRequest.properties` and to `HabitDefUpdateRequest.properties`. Add to `HabitSuggestion.properties` (leave `HabitSuggestion.required` untouched so the extra fields are optional):

```yaml
        framework: { type: string, enum: [FOGG, CLEAR], nullable: true }
        cue: { type: string, nullable: true, maxLength: 160 }
        craving: { type: string, nullable: true, maxLength: 200 }
        reward: { type: string, nullable: true, maxLength: 160 }
        celebration: { type: string, nullable: true, maxLength: 120 }
```

In `api/base.yml:8` change `version: 0.5.0` to `version: 0.6.0`.

- [ ] **Step 9: Regenerate both artifacts**

Run:

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` both change.

- [ ] **Step 10: Map the fields into the admin DTO**

In `HabitMapper.toDefAdmin`, add before `.build()`:

```java
            .framework(def.getFramework() != null
                ? HabitDefAdmin.FrameworkEnum.fromValue(def.getFramework()) : null)
            .anchorHabitKey(def.getAnchorHabitKey())
            .cue(def.getCue())
            .craving(def.getCraving())
            .reward(def.getReward())
            .celebration(def.getCelebration())
            .identity(def.getIdentity())
```

- [ ] **Step 11: Compile and run the habit ITs**

Run: `./mvnw test -Dtest='Habit*IT' -Dmezo.test.use-testcontainers=true`
Expected: PASS — all existing habit ITs still green (every new column is nullable, so no existing behaviour changes).

- [ ] **Step 12: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/habit \
  backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitChainDefEntityIT.java \
  api/feature/habit/habit.yml api/base.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(habit): framework columns on habit_def + contract 0.6.0 (mezo-3zue.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Framework validation on create and update

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitFrameworkValidator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitAdminService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitDefRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAdminApiIT.java`

**Interfaces:**
- Consumes: `HabitDefEntity` framework getters/setters and constants from Task 1; the generated `HabitDefCreateRequest` / `HabitDefUpdateRequest` framework properties from Task 1.
- Produces: `HabitFrameworkValidator.validate(HabitDefEntity draft)` — a `void` method throwing `SystemRuntimeErrorException` with HTTP 400 on violation; `HabitDefRepository.findByCreatedByAndAnchorHabitKeyAndDeletedFalse(UUID createdBy, String anchorHabitKey)` returning `List<HabitDefEntity>` (used by Task 3).

- [ ] **Step 1: Write the failing API tests**

Add to `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAdminApiIT.java`:

```java
    @Test
    void testCreateDef_shouldRejectFogg_whenCelebrationMissing() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorCopy("kitöltöttem a reggeli kávét").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_FRAMEWORK_FOGG_INCOMPLETE");
    }

    @Test
    void testCreateDef_shouldRejectClear_whenCravingMissing() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.CLEAR)
                .cue("7:10-kor a konyhában").reward("a pipa maga").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_FRAMEWORK_CLEAR_INCOMPLETE");
    }

    @Test
    void testCreateDef_shouldRejectFrameworkFields_whenNoFramework() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_FRAMEWORK_FIELDS_ORPHAN");
    }

    @Test
    void testCreateDef_shouldRejectUnknownAnchorKey() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey("custom_nemletezik").celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_ANCHOR_INVALID");
    }

    @Test
    void testCreateDef_shouldStoreFoggRecipe_withAnchorHabitKey() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey("morning_sunlight").celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        assertThat(created.getFramework()).isEqualTo(HabitDefAdmin.FrameworkEnum.FOGG);
        assertThat(created.getAnchorHabitKey()).isEqualTo("morning_sunlight");
        assertThat(created.getCelebration()).isEqualTo("ökölrázás");
        assertThat(created.getCue()).isNull();
    }

    @Test
    void testUpdateDef_shouldRejectSelfAnchor() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey("morning_sunlight").celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        String err = exchangeForBody("/api/habit/def/" + created.getId(), HttpMethod.PATCH,
            HabitDefUpdateRequest.builder().anchorHabitKey(created.getHabitKey()).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_ANCHOR_INVALID");
    }
```

If `exchangeForBody` is not the helper `HabitAdminApiIT` already uses for PATCH, copy the exact PATCH idiom from the file's existing update tests instead.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./mvnw test -Dtest='HabitAdminApiIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — the create calls return 200 instead of 400 (no validation exists yet).

- [ ] **Step 3: Add the anchor finder to the repository**

In `HabitDefRepository`, add next to the other derived finders:

```java
    List<HabitDefEntity> findByCreatedByAndAnchorHabitKeyAndDeletedFalse(UUID createdBy, String anchorHabitKey);
```

- [ ] **Step 4: Write the validator**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitFrameworkValidator.java`:

```java
package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The one place that knows what each behaviour-change framework requires (mezo-3zue.2).
 * FOGG is the Tiny Habits recipe — an anchor (a sibling def or free text) plus a celebration;
 * CLEAR is the Four Laws — cue, craving and reward, with identity optional. A def with no
 * framework is a pre-mezo-3zue row and must carry no framework field at all, so the FE can
 * tell "legacy" from "half-filled recipe" without guessing.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitFrameworkValidator {

    private final HabitDefRepository defRepository;

    /** Validates the def's merged post-write state. Call AFTER applying the request. */
    public void validate(HabitDefEntity draft) {
        String framework = draft.getFramework();
        if (framework == null) {
            if (hasAny(draft.getAnchorHabitKey(), draft.getCue(), draft.getCraving(),
                draft.getReward(), draft.getCelebration(), draft.getIdentity())) {
                throw badRequest("HABIT_FRAMEWORK_FIELDS_ORPHAN");
            }
            return;
        }
        if (HabitDefEntity.FRAMEWORK_FOGG.equals(framework)) {
            boolean hasAnchor = isSet(draft.getAnchorHabitKey()) || isSet(draft.getAnchorCopy());
            if (!hasAnchor || !isSet(draft.getCelebration())) {
                throw badRequest("HABIT_FRAMEWORK_FOGG_INCOMPLETE");
            }
            validateAnchorReference(draft);
            return;
        }
        if (!isSet(draft.getCue()) || !isSet(draft.getCraving()) || !isSet(draft.getReward())) {
            throw badRequest("HABIT_FRAMEWORK_CLEAR_INCOMPLETE");
        }
    }

    /**
     * Clears the fields the chosen framework does not own, so a def re-framed from CLEAR to FOGG
     * cannot keep a stale cue that the sentence renderer would then print.
     */
    public void clearForeignFields(HabitDefEntity draft) {
        if (HabitDefEntity.FRAMEWORK_FOGG.equals(draft.getFramework())) {
            draft.setCue(null);
            draft.setCraving(null);
            draft.setReward(null);
            draft.setIdentity(null);
            return;
        }
        if (HabitDefEntity.FRAMEWORK_CLEAR.equals(draft.getFramework())) {
            draft.setAnchorHabitKey(null);
            draft.setCelebration(null);
        }
    }

    private void validateAnchorReference(HabitDefEntity draft) {
        String anchorKey = draft.getAnchorHabitKey();
        if (!isSet(anchorKey)) {
            return; // free-text anchor only
        }
        if (anchorKey.equals(draft.getHabitKey())) {
            throw badRequest("HABIT_ANCHOR_INVALID");
        }
        HabitDefEntity anchor = defRepository
            .findByCreatedByAndHabitKeyAndDeletedFalse(draft.getCreatedBy(), anchorKey)
            .orElseThrow(() -> badRequest("HABIT_ANCHOR_INVALID"));
        if (!Boolean.TRUE.equals(anchor.getActive())) {
            throw badRequest("HABIT_ANCHOR_INVALID");
        }
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }

    private static boolean hasAny(String... values) {
        return List.of(values).stream().anyMatch(HabitFrameworkValidator::isSet);
    }

    private static SystemRuntimeErrorException badRequest(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.BAD_REQUEST);
    }
}
```

`List.of(String...)` rejects nulls, so replace `hasAny` with an explicit stream over an array:

```java
    private static boolean hasAny(String... values) {
        for (String value : values) {
            if (isSet(value)) {
                return true;
            }
        }
        return false;
    }
```

Use the loop version; delete the `java.util.List` import if nothing else needs it.

- [ ] **Step 5: Wire the validator into createDef**

In `HabitAdminService`, add the field:

```java
    private final HabitFrameworkValidator frameworkValidator;
```

In `createDef`, after `def.setLinkUrl(request.getLinkUrl());` and before `defRepository.save(def)`:

```java
        def.setFramework(request.getFramework() != null ? request.getFramework().getValue() : null);
        def.setAnchorHabitKey(request.getAnchorHabitKey());
        def.setCue(request.getCue());
        def.setCraving(request.getCraving());
        def.setReward(request.getReward());
        def.setCelebration(request.getCelebration());
        def.setIdentity(request.getIdentity());
        frameworkValidator.clearForeignFields(def);
        frameworkValidator.validate(def);
```

- [ ] **Step 6: Wire the validator into updateDef**

In `updateDef`, after the existing `if (request.getIsActive() != null) { ... }` block and before `defRepository.save(def)`:

```java
        if (request.getFramework() != null) {
            def.setFramework(request.getFramework().getValue());
        }
        if (request.getAnchorHabitKey() != null) {
            def.setAnchorHabitKey(request.getAnchorHabitKey());
        }
        if (request.getCue() != null) {
            def.setCue(request.getCue());
        }
        if (request.getCraving() != null) {
            def.setCraving(request.getCraving());
        }
        if (request.getReward() != null) {
            def.setReward(request.getReward());
        }
        if (request.getCelebration() != null) {
            def.setCelebration(request.getCelebration());
        }
        if (request.getIdentity() != null) {
            def.setIdentity(request.getIdentity());
        }
        frameworkValidator.clearForeignFields(def);
        frameworkValidator.validate(def);
```

This keeps the file's established "a null value means keep, not clear" PATCH semantics.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `./mvnw test -Dtest='HabitAdminApiIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS, all tests including the six new ones.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/habit backend/src/test/java/io/mrkuhne/mezo/feature/habit
git commit -m "feat(habit): per-framework recipe validation on def create/update (mezo-3zue.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Anchor lifecycle — never leave a dangling stack

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitAdminService.java` (`deleteDef`, `updateDef`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAdminApiIT.java`

**Interfaces:**
- Consumes: `HabitDefRepository.findByCreatedByAndAnchorHabitKeyAndDeletedFalse` and `HabitFrameworkValidator` from Task 2.
- Produces: no new public API; `HabitAdminService.releaseAnchors(UUID userId, HabitDefEntity anchor)` is private.

- [ ] **Step 1: Write the failing tests**

Add to `HabitAdminApiIT`:

```java
    @Test
    void testDeleteDef_shouldReleaseDependentAnchors_intoFreeTextCopy() {
        catalog();
        HabitDefAdmin anchor = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Reggeli fény")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        HabitDefAdmin stacked = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey(anchor.getHabitKey()).celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        exchange("/api/habit/def/" + anchor.getId(), HttpMethod.DELETE, null,
            ownerAuthHeaders(), HttpStatus.OK);

        HabitDefAdmin after = findDef(catalog(), stacked.getId());
        assertThat(after.getAnchorHabitKey()).isNull();
        assertThat(after.getAnchorCopy()).isEqualTo("kész a Reggeli fény");
        assertThat(after.getFramework()).isEqualTo(HabitDefAdmin.FrameworkEnum.FOGG);
    }

    @Test
    void testDeactivateDef_shouldReleaseDependentAnchors() {
        catalog();
        HabitDefAdmin anchor = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Reggeli fény")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        HabitDefAdmin stacked = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey(anchor.getHabitKey()).celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        exchangeForBody("/api/habit/def/" + anchor.getId(), HttpMethod.PATCH,
            HabitDefUpdateRequest.builder().isActive(false).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        HabitDefAdmin after = findDef(catalog(), stacked.getId());
        assertThat(after.getAnchorHabitKey()).isNull();
        assertThat(after.getAnchorCopy()).isEqualTo("kész a Reggeli fény");
    }

    private static HabitDefAdmin findDef(HabitCatalogResponse cat, UUID defId) {
        return cat.getChains().stream()
            .flatMap(chain -> chain.getDefs().stream())
            .filter(d -> d.getId().equals(defId))
            .findFirst().orElseThrow();
    }
```

Use whatever DELETE/PATCH helpers `HabitAdminApiIT` already uses; copy their exact signatures from the file's existing delete and update tests rather than the placeholder names above if they differ.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./mvnw test -Dtest='HabitAdminApiIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `anchorHabitKey` still points at the deleted def.

- [ ] **Step 3: Implement the release cascade**

In `HabitAdminService`, add the private helper:

```java
    /**
     * A stacked recipe must survive its anchor disappearing (mezo-3zue.2): the sentence
     * "Miután [anchor], …" is the user's own words, so instead of nulling the whole recipe we
     * demote the reference to free text and drop the key. Runs inside the caller's transaction.
     */
    private void releaseAnchors(UUID userId, HabitDefEntity anchor) {
        List<HabitDefEntity> dependents =
            defRepository.findByCreatedByAndAnchorHabitKeyAndDeletedFalse(userId, anchor.getHabitKey());
        for (HabitDefEntity dependent : dependents) {
            if (dependent.getAnchorCopy() == null || dependent.getAnchorCopy().isBlank()) {
                dependent.setAnchorCopy("kész a " + anchor.getTitle());
            }
            dependent.setAnchorHabitKey(null);
            defRepository.save(dependent);
        }
    }
```

In `deleteDef`, replace the body with:

```java
    @Transactional
    public void deleteDef(UUID userId, UUID id) {
        catalogService.ensureCatalog(userId);
        HabitDefEntity def = requireDef(userId, id);
        releaseAnchors(userId, def);
        defRepository.delete(def); // @SQLDelete soft-deletes
    }
```

In `updateDef`, replace the existing active flag block with:

```java
        if (request.getIsActive() != null) {
            def.setActive(request.getIsActive());
            if (Boolean.FALSE.equals(request.getIsActive())) {
                releaseAnchors(userId, def);
            }
        }
```

`anchorCopy` is `varchar(120)`; a title is at most 80 characters and the prefix is 7, so the composed value always fits.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./mvnw test -Dtest='HabitAdminApiIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 5: Run the whole habit + progression IT set**

Run: `./mvnw test -Dtest='Habit*IT,ProgressionHabitIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/habit backend/src/test/java/io/mrkuhne/mezo/feature/habit
git commit -m "feat(habit): release stacked anchors when the anchor def is deleted or paused (mezo-3zue.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: AI suggestions carry a framework

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/HabitSuggestLlmAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitAiService.java` (only if it post-processes suggestion fields)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAiSuggestApiIT.java`
- Modify: `docs/features/habit.md`, `docs/CODEMAP.md`

**Interfaces:**
- Consumes: the `HabitSuggestion` contract fields added in Task 1.
- Produces: suggestions whose `framework` is `FOGG` or `CLEAR` with that framework's fields populated, consumed by the frontend in Task 11.

- [ ] **Step 1: Read the adapter to find the prompt and the response schema**

Run: `sed -n 1,200p backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/HabitSuggestLlmAdapter.java`
Note where the prompt text and the JSON schema for one suggestion live. Everything below edits those two spots only.

- [ ] **Step 2: Write the failing test**

Add to `HabitAiSuggestApiIT` a case in the same style the file already uses for stubbing the LLM response (copy its existing stub helper), asserting the new fields survive the round trip:

```java
    @Test
    void testSuggest_shouldCarryFrameworkFields_whenModelReturnsThem() {
        stubSuggestionResponse("""
            {"suggestions":[{"title":"Napi szándék","why":"tisztább fej","anchorCopy":"kávé után",
             "skillKey":"mindset","xp":10,"chainKey":"MORNING","framework":"FOGG",
             "celebration":"ökölrázás"}]}
            """);
        HabitSuggestResponse res = postForBody("/api/habit/ai/suggest",
            HabitSuggestRequest.builder().chainKey("MORNING").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitSuggestResponse.class);
        assertThat(res.getSuggestions()).hasSize(1);
        assertThat(res.getSuggestions().get(0).getFramework())
            .isEqualTo(HabitSuggestion.FrameworkEnum.FOGG);
        assertThat(res.getSuggestions().get(0).getCelebration()).isEqualTo("ökölrázás");
    }
```

Replace `stubSuggestionResponse` with the file's real stubbing helper name and signature.

- [ ] **Step 3: Run the test to verify it fails**

Run: `./mvnw test -Dtest='HabitAiSuggestApiIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `getFramework()` returns null because the adapter drops unknown fields.

- [ ] **Step 4: Extend the adapter's schema and prompt**

In the adapter's suggestion JSON schema add the five optional properties (`framework` with `enum: ["FOGG","CLEAR"]`, `cue`, `craving`, `reward`, `celebration`), and append to the prompt instructions, in Hungarian, matching the file's existing prompt voice:

```
Minden javaslat egy szokás-recept. Válassz keretet:
- "FOGG": add meg az anchorCopy-t ("miután …" pillanat) és a celebration-t (azonnali ünneplés).
- "CLEAR": add meg a cue-t (mikor és hol), a craving-et (miért vonzó) és a reward-ot.
A framework mezőt mindig töltsd ki.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./mvnw test -Dtest='HabitAiSuggestApiIT,HabitAiSuggestSwitchOffIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 6: Update the feature doc and CODEMAP**

In `docs/features/habit.md`, update §4 (data model — the seven columns and their per-framework rules), §9 (add: framework is nullable, legacy defs keep null; anchors are released, not cascaded) and §10 (`key_files`: add `HabitFrameworkValidator.java`). Then run:

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```

Expected: CODEMAP regenerated, doc lint PASS.

- [ ] **Step 7: Commit and open the S2 pull request**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature backend/src/test/java/io/mrkuhne/mezo/feature/habit docs
git commit -m "feat(habit): AI suggestions propose a framework recipe (mezo-3zue.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feat/rutin-epito-backend
gh pr create --title "feat(habit): Rutin-építő S2 — framework columns, validation, anchor lifecycle (mezo-3zue.2)" --body "$(cat <<'EOF'
Backend slice of the Rutin-építő epic. Spec: `docs/superpowers/specs/2026-09-02-routine-builder-design.md` §7.

- `habit_def` gains seven nullable framework columns + `ck_habit_def_framework`; contract 0.6.0.
- `HabitFrameworkValidator` enforces the FOGG and CLEAR field sets and the anchor reference.
- Deleting or pausing an anchor def demotes dependent recipes to free-text anchors instead of dangling.
- AI suggestions may now propose a framework.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait for CI green, then merge locally with `--no-ff` and push, per the house flow.

---

## Slice S3 — Frontend hub and tile (`mezo-3zue.3`, branch `feat/rutin-epito-hub`)

### Task 5: Data layer — types, API mapping, mock parity

**Files:**
- Modify: `frontend/src/data/types.ts:1357-1385`
- Modify: `frontend/src/data/habit/habitAdminApi.ts`
- Modify: `frontend/src/data/habit/habitMock.ts`
- Test: `frontend/src/data/habit/habitAdminApi.test.ts` (create if absent)

**Interfaces:**
- Consumes: the generated `api.gen.ts` schemas from Task 1.
- Produces: `HabitFramework = 'FOGG' | 'CLEAR'`; `HabitDefInfo` fields `framework: HabitFramework | null`, `anchorHabitKey: string | null`, `cue: string | null`, `craving: string | null`, `reward: string | null`, `celebration: string | null`, `identity: string | null`; the same seven optional fields on `HabitDefCreateInput` and `HabitDefUpdateInput`; `HabitSuggestion` fields `framework`, `cue`, `craving`, `reward`, `celebration` (all nullable).

- [ ] **Step 1: Write the failing mapping test**

Create `frontend/src/data/habit/habitAdminApi.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { habitAdminApi } from '@/data/habit/habitAdminApi'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/data/_client/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), ApiError: class extends Error {} }))

beforeEach(() => apiFetch.mockReset())

describe('habitAdminApi.createDef', () => {
  it('sends the framework fields and maps them back onto HabitDefInfo', async () => {
    apiFetch.mockResolvedValue({
      id: 'd1', habitKey: 'custom_1', chainKey: 'MORNING', position: 1, title: 'Napi mondat',
      why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
      xp: 10, linkUrl: null, isActive: true,
      framework: 'FOGG', anchorHabitKey: 'morning_sunlight', cue: null, craving: null,
      reward: null, celebration: 'ökölrázás', identity: null,
    })

    const def = await habitAdminApi.createDef({
      chainKey: 'MORNING', title: 'Napi mondat', mode: 'MANUAL', skillKey: 'mindset', xp: 10,
      framework: 'FOGG', anchorHabitKey: 'morning_sunlight', celebration: 'ökölrázás',
    })

    const body = JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body)
    expect(body.framework).toBe('FOGG')
    expect(body.anchorHabitKey).toBe('morning_sunlight')
    expect(body.celebration).toBe('ökölrázás')
    expect(def.framework).toBe('FOGG')
    expect(def.celebration).toBe('ökölrázás')
    expect(def.cue).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/habit/habitAdminApi.test.ts`
Expected: FAIL — TypeScript rejects `framework` on `HabitDefCreateInput`.

- [ ] **Step 3: Extend the domain types**

In `frontend/src/data/types.ts`, above `HabitDefInfo`:

```ts
/** Behaviour-change framework a habit recipe was built on (mezo-3zue). Null = pre-framework def. */
export type HabitFramework = 'FOGG' | 'CLEAR'
```

Add to `HabitDefInfo` after `isActive: boolean`:

```ts
  framework: HabitFramework | null
  /** FOGG: habitKey of the def this recipe is stacked onto (free-text anchors use anchorCopy). */
  anchorHabitKey: string | null
  cue: string | null
  craving: string | null
  reward: string | null
  celebration: string | null
  identity: string | null
```

Add to `HabitSuggestion` after `chainKey: string`:

```ts
  framework: HabitFramework | null
  cue: string | null
  craving: string | null
  reward: string | null
  celebration: string | null
```

- [ ] **Step 4: Extend the API inputs and mappers**

In `habitAdminApi.ts`, add to both `HabitDefCreateInput` and `HabitDefUpdateInput`:

```ts
  framework?: HabitFramework | null
  anchorHabitKey?: string | null
  cue?: string | null
  craving?: string | null
  reward?: string | null
  celebration?: string | null
  identity?: string | null
```

Import `HabitFramework` from `@/data/types`. Extend `toDefInfo`:

```ts
  framework: w.framework ?? null,
  anchorHabitKey: w.anchorHabitKey ?? null,
  cue: w.cue ?? null,
  craving: w.craving ?? null,
  reward: w.reward ?? null,
  celebration: w.celebration ?? null,
  identity: w.identity ?? null,
```

and `toSuggestion`:

```ts
  framework: w.framework ?? null,
  cue: w.cue ?? null,
  craving: w.craving ?? null,
  reward: w.reward ?? null,
  celebration: w.celebration ?? null,
```

The `createDef`/`updateDef` bodies already spread the whole input, so no change is needed there.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/habit/habitAdminApi.test.ts`
Expected: PASS.

- [ ] **Step 6: Give the mock catalog one recipe per framework**

In `habitMock.ts`, the `toDefInfo(h: HabitItem)` helper and the two literal defs (`dailyIntention`, `bedOnTime`) must all produce the seven new fields. Set the shared default in `toDefInfo`'s returned object:

```ts
    framework: null,
    anchorHabitKey: null,
    cue: null,
    craving: null,
    reward: null,
    celebration: null,
    identity: null,
```

Then make `dailyIntention` the CLEAR example:

```ts
    framework: 'CLEAR',
    anchorHabitKey: null,
    cue: '7:10-kor a konyhaasztalnál, füzet a bögre mellett',
    craving: 'tisztább fejjel indul a nap',
    reward: 'a pipa maga',
    celebration: null,
    identity: 'figyel a saját gondolataira',
```

and `bedOnTime` the FOGG example:

```ts
    framework: 'FOGG',
    anchorHabitKey: null,
    cue: null,
    craving: null,
    reward: null,
    celebration: 'mély levegő + „ez az”',
    identity: null,
```

`bedOnTime` must also carry `anchorCopy: 'letettem a fogkefét'` so the FOGG sentence is complete. Add the five suggestion fields to every entry of `mockHabitSuggestions`, using `framework: 'FOGG'` plus a `celebration` on at least one of them and `framework: 'CLEAR'` plus `cue`/`craving`/`reward` on another.

- [ ] **Step 7: Run the full frontend suite in both modes**

Run:

```bash
cd frontend && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: PASS in both. Type errors in `RoutineEditorPage.test.tsx`'s `def()` factory are expected here — add the seven fields (all `null`) to that factory to fix them.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data
git commit -m "feat(habit): framework fields in the FE habit data layer + mock parity (mezo-3zue.3)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Pure logic — the recipe sentence and the anchor chips

**Files:**
- Create: `frontend/src/features/me/logic/routineSentence.ts`
- Create: `frontend/src/features/me/logic/routineSentence.test.ts`
- Create: `frontend/src/features/me/logic/habitAnchors.ts`
- Create: `frontend/src/features/me/logic/habitAnchors.test.ts`

**Interfaces:**
- Consumes: `HabitDefInfo`, `HabitFramework`, `HabitCatalog` from Task 5.
- Produces:
  - `routineSentence(recipe: RoutineRecipe): string` — the finished sentence, no placeholders.
  - `routineSentenceParts(recipe: RoutineRecipe): SentencePart[]` where `SentencePart = { text: string; slot?: RecipeSlot; filled: boolean }` and `RecipeSlot = 'anchor' | 'title' | 'celebration' | 'cue' | 'craving' | 'reward' | 'identity'` — used by the wizard to render dashed blanks.
  - `RoutineRecipe = { framework: HabitFramework | null; title: string; anchorLabel: string; celebration: string; cue: string; craving: string; reward: string; identity: string }` (every field a plain string, `''` when unset).
  - `recipeFromDef(def: HabitDefInfo, anchorTitleOf: (habitKey: string) => string | undefined): RoutineRecipe`.
  - `habitAnchorOptions(catalog: HabitCatalog, excludeDefId?: string): AnchorOption[]` where `AnchorOption = { label: string; source: 'SZOKÁS' | 'MEZO'; habitKey?: string }`.

- [ ] **Step 1: Write the failing sentence tests**

Create `frontend/src/features/me/logic/routineSentence.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { routineSentence, routineSentenceParts, recipeFromDef, type RoutineRecipe } from '@/features/me/logic/routineSentence'
import type { HabitDefInfo } from '@/data/types'

const empty: RoutineRecipe = {
  framework: null, title: '', anchorLabel: '', celebration: '',
  cue: '', craving: '', reward: '', identity: '',
}

describe('routineSentence', () => {
  it('renders the Fogg recipe', () => {
    expect(routineSentence({
      ...empty, framework: 'FOGG', anchorLabel: 'kitöltöttem a reggeli kávét',
      title: 'leírok egy mondatot', celebration: 'ökölrázás',
    })).toBe('Miután kitöltöttem a reggeli kávét, leírok egy mondatot — és logolom. Ünneplésül: ökölrázás.')
  })

  it('renders the Clear recipe with the identity clause', () => {
    expect(routineSentence({
      ...empty, framework: 'CLEAR', cue: '7:10-kor a konyhában', title: 'leírom a napi szándékot',
      craving: 'tisztább a fejem', reward: 'a pipa maga', identity: 'figyel a gondolataira',
    })).toBe('7:10-kor a konyhában leírom a napi szándékot, mert tisztább a fejem. Jutalmam: a pipa maga. Hogy olyan ember legyek, aki figyel a gondolataira.')
  })

  it('omits the identity clause when identity is empty', () => {
    const s = routineSentence({
      ...empty, framework: 'CLEAR', cue: '21:55', title: 'leteszem a telefont',
      craving: 'reggel nem vagyok szétesve', reward: 'egy fejezet könyv',
    })
    expect(s).toBe('21:55 leteszem a telefont, mert reggel nem vagyok szétesve. Jutalmam: egy fejezet könyv.')
    expect(s).not.toContain('Hogy olyan ember')
  })

  it('falls back to the bare title for a framework-less def', () => {
    expect(routineSentence({ ...empty, title: 'Magnézium' })).toBe('Magnézium.')
  })
})

describe('routineSentenceParts', () => {
  it('marks unfilled slots so the wizard can render dashed blanks', () => {
    const parts = routineSentenceParts({ ...empty, framework: 'FOGG', anchorLabel: 'kávé után' })
    const anchor = parts.find((p) => p.slot === 'anchor')
    const title = parts.find((p) => p.slot === 'title')
    expect(anchor).toEqual({ text: 'kávé után', slot: 'anchor', filled: true })
    expect(title).toEqual({ text: 'pici tett', slot: 'title', filled: false })
  })
})

describe('recipeFromDef', () => {
  it('resolves a stacked anchor key to the anchor habit title', () => {
    const def = {
      id: 'd1', habitKey: 'custom_1', chainKey: 'MORNING', position: 1, title: 'Napi mondat',
      why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
      xp: 10, linkUrl: null, isActive: true, framework: 'FOGG',
      anchorHabitKey: 'morning_sunlight', cue: null, craving: null, reward: null,
      celebration: 'ökölrázás', identity: null,
    } satisfies HabitDefInfo

    const recipe = recipeFromDef(def, (key) => (key === 'morning_sunlight' ? 'Reggeli fény' : undefined))
    expect(recipe.anchorLabel).toBe('kész a Reggeli fény')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/logic/routineSentence.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the sentence module**

Create `frontend/src/features/me/logic/routineSentence.ts`:

```ts
// ============================================================
// Mezo · routineSentence — the one renderer of a habit recipe's Hungarian sentence
// (mezo-3zue). The wizard shows it assembling blank by blank, the hub's habit page shows it
// finished; both call this, so the two can never drift. Pure: no hooks, no formatting of
// anything the caller did not pass in.
// ============================================================
import type { HabitDefInfo, HabitFramework } from '@/data/types'

export type RecipeSlot = 'anchor' | 'title' | 'celebration' | 'cue' | 'craving' | 'reward' | 'identity'

export interface RoutineRecipe {
  framework: HabitFramework | null
  title: string
  /** FOGG: the "miután …" clause, already resolved to prose (see recipeFromDef). */
  anchorLabel: string
  celebration: string
  cue: string
  craving: string
  reward: string
  identity: string
}

export interface SentencePart {
  /** The user's own words when filled, the slot's Hungarian placeholder when not. */
  text: string
  slot?: RecipeSlot
  filled: boolean
}

const PLACEHOLDER: Record<RecipeSlot, string> = {
  anchor: 'horgony',
  title: 'pici tett',
  celebration: 'shine',
  cue: 'jelzés',
  craving: 'vágy',
  reward: 'jutalom',
  identity: 'identitás',
}

const lit = (text: string): SentencePart => ({ text, filled: true })
const slot = (name: RecipeSlot, value: string): SentencePart =>
  value.trim().length > 0
    ? { text: value.trim(), slot: name, filled: true }
    : { text: PLACEHOLDER[name], slot: name, filled: false }

export function routineSentenceParts(recipe: RoutineRecipe): SentencePart[] {
  if (recipe.framework === 'FOGG') {
    return [
      lit('Miután '), slot('anchor', recipe.anchorLabel), lit(', '),
      slot('title', recipe.title), lit(' — és logolom. Ünneplésül: '),
      slot('celebration', recipe.celebration), lit('.'),
    ]
  }
  if (recipe.framework === 'CLEAR') {
    const parts: SentencePart[] = [
      slot('cue', recipe.cue), lit(' '), { ...slot('title', recipe.title), slot: 'title' },
      lit(', mert '), slot('craving', recipe.craving), lit('. Jutalmam: '),
      slot('reward', recipe.reward), lit('.'),
    ]
    // The identity clause is optional (spec §6): it appears only once the user wrote one, so an
    // untouched field must not leave a dangling "Hogy olyan ember legyek, aki identitás."
    if (recipe.identity.trim().length > 0) {
      parts.push(lit(' Hogy olyan ember legyek, aki '), slot('identity', recipe.identity), lit('.'))
    }
    return parts
  }
  return [slot('title', recipe.title), lit('.')]
}

export function routineSentence(recipe: RoutineRecipe): string {
  return routineSentenceParts(recipe).map((p) => p.text).join('')
}

/** The FOGG placeholder differs per framework — CLEAR's response slot is not "pici tett". */
export function titlePlaceholder(framework: HabitFramework | null): string {
  return framework === 'CLEAR' ? 'tett' : PLACEHOLDER.title
}

export function recipeFromDef(
  def: HabitDefInfo,
  anchorTitleOf: (habitKey: string) => string | undefined,
): RoutineRecipe {
  const anchorTitle = def.anchorHabitKey != null ? anchorTitleOf(def.anchorHabitKey) : undefined
  return {
    framework: def.framework,
    title: def.title,
    anchorLabel: anchorTitle != null ? `kész a ${anchorTitle}` : (def.anchorCopy ?? ''),
    celebration: def.celebration ?? '',
    cue: def.cue ?? '',
    craving: def.craving ?? '',
    reward: def.reward ?? '',
    identity: def.identity ?? '',
  }
}
```

- [ ] **Step 4: Run the sentence tests to verify they pass**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/logic/routineSentence.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing anchor-options test**

Create `frontend/src/features/me/logic/habitAnchors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { habitAnchorOptions, MEZO_EVENT_ANCHORS } from '@/features/me/logic/habitAnchors'
import type { HabitCatalog, HabitDefInfo } from '@/data/types'

function def(id: string, habitKey: string, title: string, isActive = true): HabitDefInfo {
  return {
    id, habitKey, chainKey: 'MORNING', position: 1, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive,
    framework: null, anchorHabitKey: null, cue: null, craving: null, reward: null,
    celebration: null, identity: null,
  }
}

const catalog: HabitCatalog = {
  chains: [{
    id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
    position: 1, isActive: true,
    defs: [def('d1', 'sun', 'Reggeli fény'), def('d2', 'water', 'Hidratálás'), def('d3', 'old', 'Szünetel', false)],
  }],
}

describe('habitAnchorOptions', () => {
  it('offers the active habits first, then the mezo events', () => {
    const options = habitAnchorOptions(catalog)
    expect(options.slice(0, 2)).toEqual([
      { label: 'kész a Reggeli fény', source: 'SZOKÁS', habitKey: 'sun' },
      { label: 'kész a Hidratálás', source: 'SZOKÁS', habitKey: 'water' },
    ])
    expect(options.filter((o) => o.source === 'MEZO')).toEqual(MEZO_EVENT_ANCHORS)
  })

  it('drops paused habits and the def being edited', () => {
    const labels = habitAnchorOptions(catalog, 'd1').map((o) => o.label)
    expect(labels).not.toContain('kész a Reggeli fény')
    expect(labels).not.toContain('kész a Szünetel')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/logic/habitAnchors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the anchor module**

Create `frontend/src/features/me/logic/habitAnchors.ts`:

```ts
// ============================================================
// Mezo · habitAnchors — the step-2 anchor chip list for the Fogg branch of the routine wizard
// (mezo-3zue). Two sources: the user's own active habits (a real reference, stored as
// anchorHabitKey so the stack stays machine-readable) and a fixed list of mezo moments (free
// text in v1 — event binding is mezo-3zue.6). Pure.
// ============================================================
import type { AnchorSource } from '@/data/types'
import type { HabitCatalog } from '@/data/types'

export interface AnchorOption {
  /** Ready-to-render "miután …" clause. */
  label: string
  source: 'SZOKÁS' | 'MEZO'
  /** Set only for SZOKÁS options — the def this recipe stacks onto. */
  habitKey?: string
}

/** Moments the app itself knows about; free text in v1, event-bound in mezo-3zue.6. */
export const MEZO_EVENT_ANCHORS: AnchorOption[] = [
  { label: 'megmértem magam', source: 'MEZO' },
  { label: 'logoltam a reggelit', source: 'MEZO' },
  { label: 'befejeztem az edzést', source: 'MEZO' },
  { label: 'lezártam a napot', source: 'MEZO' },
]

export function habitAnchorOptions(catalog: HabitCatalog, excludeDefId?: string): AnchorOption[] {
  const own = catalog.chains
    .flatMap((chain) => chain.defs)
    .filter((d) => d.isActive && d.id !== excludeDefId)
    .map((d) => ({ label: `kész a ${d.title}`, source: 'SZOKÁS' as const, habitKey: d.habitKey }))
  return [...own, ...MEZO_EVENT_ANCHORS]
}
```

Delete the stray `AnchorSource` import line — it does not exist; the file needs only `HabitCatalog`.

- [ ] **Step 8: Run both logic test files to verify they pass**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/logic/`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/me/logic
git commit -m "feat(habit): pure recipe-sentence and anchor-option logic (mezo-3zue.3)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `/me/rutin` — the routine home, absorbing the Growth Rutin page and the editor

> **Revised 2026-09-02 after `mezo-rmi0.1` landed on main.** The Growth tab was itself
> restructured while this slice was queued: `GrowthPage`'s segmented control is gone, replaced by
> `GrowthHubPage` (`/me/growth`) with four full-page siblings, and the Rutin segment became
> `GrowthRutinPage` at `/me/growth/rutin`. `RoutinesTab.tsx` was deleted. This task therefore
> **moves and merges two existing pages** instead of removing a segment. Nothing about the goal
> changed: the routine surface leaves Growth and lives under Én.

**Starting point, verified on main:**
- `frontend/src/features/me/pages/GrowthRutinPage.tsx` — a polished, date-navigable, read-only
  overview: two 30-cell counter tiles (`CounterTile`/`Cells`), a `DayNavigator` capped at today,
  and catalog-driven chain cards branching on today vs. a past day. Its head action
  `✏️ Szerkesztés` links to `/me/routines/edit`.
- `frontend/src/features/me/pages/RoutineEditorPage.tsx` — the catalog CRUD editor: chain cards
  with an active `Toggle`, `✎` opening `ChainEditSheet`, a `SortableList` of defs, `＋ Új habit`
  opening `HabitEditSheet`, and `＋ Új rutin` / `✨ AI javaslat`.
- `frontend/src/features/me/pages/GrowthHubPage.tsx` — four tiles; the Rutin tile at line 82-83
  points at `/me/growth/rutin`, and `TAB_REDIRECT.routines` (line 26) maps the legacy `?tab=`.

**Files:**
- Create: `frontend/src/features/me/pages/RutinHubPage.tsx` (built from both pages above)
- Create: `frontend/src/features/me/pages/RutinHubPage.test.tsx`
- Delete: `frontend/src/features/me/pages/GrowthRutinPage.tsx`, `GrowthRutinPage.test.tsx`,
  `RoutineEditorPage.tsx`, `RoutineEditorPage.test.tsx`
- Modify: `frontend/src/features/me/pages/GrowthHubPage.tsx` (drop the Rutin tile, repoint `TAB_REDIRECT`)
- Modify: `frontend/src/features/me/pages/GrowthHubPage.test.tsx` (three tiles, not four)
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `routineSentence` helpers (Task 6), `habitAnchorOptions` (Task 6), `useHabitCatalog`,
  `useHabitCatalogActions`, `useHabitDay`, `useHabitSummary`.
- Produces: `RutinHubPage` at `/me/rutin`; the CSS classes `rt-fw`, `rt-strength`, `rt-row-new`
  used by Tasks 9 and 10.

**Preserve, do not regress:** the counter tiles, the day navigator, the past-day branch, the
"kimaradt — a lánc másnap folytatódott" soft note, and the principle line all survive the move
verbatim. `mezo-rmi0.1` shipped them days ago; this task adds editing and framework affordances
around them, it does not replace them.

- [ ] **Step 1: Write the failing page test**

Create `frontend/src/features/me/pages/RutinHubPage.test.tsx`. Mock at the `@/data/hooks`
boundary exactly as `GrowthRutinPage.test.tsx` and `RoutineEditorPage.test.tsx` do (read both
first and reuse their `vi.hoisted` + `vi.mock` shape and their fixture builders). Assert:

```tsx
  it('keeps the 30-day counter tiles and the day navigator from the Growth page', () => {
    renderPage()
    expect(screen.getByText('Reggel')).toBeInTheDocument()
    expect(screen.getByText('Este')).toBeInTheDocument()
    expect(screen.getByLabelText(/előző nap/i)).toBeInTheDocument()
  })

  it('badges each habit row with its framework, legacy rows included', () => {
    renderPage()
    expect(screen.getByLabelText('Reggeli fény · szokás-láncolás')).toBeInTheDocument()
    expect(screen.getByLabelText('Napi szándék · négy törvény')).toBeInTheDocument()
    expect(screen.getByLabelText('Hidratálás · keret nélkül')).toBeInTheDocument()
  })

  it('opens the habit page from a row and never renders a tick control', () => {
    renderPage()
    screen.getByLabelText('Reggeli fény · szokás-láncolás').click()
    expect(navigate).toHaveBeenCalledWith('/me/rutin/szokas/sun')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('routes the new-recipe CTA to the wizard', () => {
    renderPage()
    screen.getByRole('button', { name: /Új szokás-recept/ }).click()
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj')
  })

  it('goes back to the Én hub, not to Growth', () => {
    renderPage()
    screen.getByRole('button', { name: 'Vissza' }).click()
    expect(navigate).toHaveBeenCalledWith('/me')
  })

  it('keeps chain editing: the active toggle and the chain edit sheet', () => {
    renderPage()
    screen.getByLabelText('Reggeli rutin aktív').click()
    expect(updateChain).toHaveBeenCalledWith('chain-morning', { isActive: false })
  })

  it('shows the past-day branch without strength percentages', () => {
    renderPage()
    fireEvent.click(screen.getByLabelText(/előző nap/i))
    expect(screen.queryByText(/erő \d+%/)).not.toBeInTheDocument()
  })
```

Match the `DayNavigator`'s real accessible names by reading `frontend/src/shared/ui/DayNavigator.tsx`
rather than trusting the `/előző nap/i` guess above; fix the test to the real name.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/RutinHubPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the merged page**

Create `RutinHubPage.tsx` starting from `GrowthRutinPage.tsx` verbatim, then apply these changes
and nothing else:

- `PageHead onBack={() => navigate('/me')} label="‹ Én"`. The head action becomes
  `✨ AI javaslat`, opening `AiSuggestSheet` (state lifted from `RoutineEditorPage`). The
  `✏️ Szerkesztés` action disappears — this page IS the editor now.
- Keep `PageHero` but make it the spec's hero: big number `${doneToday} / ${totalToday}` from
  `useHabitDay`, name `Rutin`, sub `ma · 28 napos átlagerő ${meanStrength}%` (drop the second
  clause when there is no strength data). The perfect-morning count moves into the counter tiles,
  which already show it.
- Keep `CounterTile`/`Cells` and the `gr-covgrid` block unchanged (today branch only, as now).
- Keep `DayNavigator` and the whole past-day branch unchanged.
- In the **today** branch only, each chain card gains the editor's chrome: the active `Toggle`
  and the `✎` button opening `ChainEditSheet`, and its rows become a `SortableList` (import both
  from where `RoutineEditorPage` imported them).
- Each habit row gains a framework badge and a strength bar, replacing the bare `gr-chain-pct`
  span on the today branch. The badge is `<span className="rt-fw rt-fw-fogg|rt-fw-clear|rt-fw-none">`
  reading `⚓ FOGG` / `◈ CLEAR` / `– RÉGI`, and the row button's `aria-label` is
  `` `${def.title} · ${FRAMEWORK_LABEL[def.framework ?? 'NONE']}` `` with

```tsx
const FRAMEWORK_LABEL = { FOGG: 'szokás-láncolás', CLEAR: 'négy törvény', NONE: 'keret nélkül' } as const
```

  The framework comes from the **catalog** def (`useHabitCatalog`), matched to the day row by
  `habitKey`; the day view's `HabitItem` does not carry it.
- A today-branch row click navigates to `/me/rutin/szokas/${def.habitKey}`. The row stays
  non-tickable: keep the existing `gr-ck` status glyph, add no checkbox.
- Bottom CTA row: `＋ Új szokás-recept` → `navigate('/me/rutin/uj')`, and `＋ Új lánc` →
  `ChainEditSheet` in create mode.
- Read `?new=` with `useSearchParams`; when it equals a def's `habitKey`, add `rt-row-new` to that
  row.
- Keep the `PageBody principle` line as it is.

- [ ] **Step 4: Add the CSS**

Append to `frontend/src/styles/prototype.css` the `rt-fw*`, `rt-strength` and `rt-row-new` rules
from the prototype (`docs/design_2.0/prototypes/src/rutin-epito-head.html`, `.fw`, `.strength`,
`.hrow.new`) at ×1.18. Use only tokens that already exist in the stylesheet — grep before using
one, and substitute the closest existing token rather than introducing a new hex value. Do not
touch the `gr-*` classes; they keep serving the counter tiles and chain cards.

- [ ] **Step 5: Run the page test to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/RutinHubPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire the routes**

In `frontend/src/app/router.tsx`: replace the `GrowthRutinPage` and `RoutineEditorPage` imports
with `RutinHubPage`, and change the route block to:

```tsx
      // Rutin home (mezo-3zue): the routine surface's own page under Én, reached from the Én
      // hub's full-width Rutin tile. It absorbed /me/growth/rutin (mezo-rmi0.1) and the
      // /me/routines/edit editor — build and edit here, tick on /nap/rutin.
      { path: 'me/rutin', element: <RutinHubPage /> },
      // Both former homes keep working as redirects.
      { path: 'me/growth/rutin', element: <Navigate to="/me/rutin" replace /> },
      { path: 'me/routines/edit', element: <Navigate to="/me/rutin" replace /> },
```

Keep `me/rutin` registered before any `:param` sibling.

- [ ] **Step 7: Take Rutin off the Growth hub**

In `GrowthHubPage.tsx`: delete the Rutin `<Tile>` (lines 82-83) and the `rutinLine` derivation
plus any now-unused habit-hook import; change `TAB_REDIRECT.routines` to `'/me/rutin'`. In
`GrowthHubPage.test.tsx`, change the tile-count assertion to three and repoint the legacy
`?tab=routines` redirect assertion.

Then delete the four superseded files:

```bash
git rm frontend/src/features/me/pages/GrowthRutinPage.tsx \
       frontend/src/features/me/pages/GrowthRutinPage.test.tsx \
       frontend/src/features/me/pages/RoutineEditorPage.tsx \
       frontend/src/features/me/pages/RoutineEditorPage.test.tsx
```

- [ ] **Step 8: Run the full frontend suite in both modes**

Run:

```bash
cd frontend && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: PASS. Any other test referencing the deleted pages or the Growth Rutin tile must be
updated in this task, not left failing.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "feat(habit): /me/rutin absorbs the Growth Rutin page and the routine editor (mezo-3zue.3)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The full-width Rutin tile on the Én hub

**Files:**
- Modify: `frontend/src/shared/ui/mozaik/index.tsx` (`Tile`)
- Modify: `frontend/src/features/me/pages/EnHubPage.tsx` (tile derivations near line 142, mosaic near line 224)
- Modify: `frontend/src/features/me/pages/EnHubPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Modify: `docs/features/me.md`, `docs/features/growth.md`, `docs/features/habit.md`, `docs/CODEMAP.md`

**Interfaces:**
- Consumes: the `/me/rutin` route from Task 7; `useHabitDay` and `useHabitSummary`.
- Produces: `Tile` gains an optional `wide?: boolean` prop rendering the row layout.

- [ ] **Step 1: Write the failing hub test**

In `EnHubPage.test.tsx`, replace the "six tiles" test with:

```tsx
  it('renders the six small tiles plus the wide Rutin tile, each opening its own page', () => {
    renderHub()
    const targets: [string, string][] = [
      ['Súly', '/me/weight'], ['Alvás', '/me/sleep'], ['Growth', '/me/growth'],
      ['Napló', '/me/naplo'], ['Emberek', '/me/people'], ['Beállítások', '/me/beallitasok'],
      ['Rutin', '/me/rutin'],
    ]
    for (const [label, path] of targets) {
      navigate.mockClear()
      screen.getByLabelText(label).click()
      expect(navigate).toHaveBeenCalledWith(path)
    }
  })

  it('shows today done/total and both chain strengths on the Rutin tile', () => {
    renderHub()
    expect(screen.getByLabelText('Rutin')).toHaveTextContent('1 / 3 ma')
    expect(screen.getByLabelText('Rutin')).toHaveTextContent('reggel 82%')
    expect(screen.getByLabelText('Rutin')).toHaveTextContent('este 64%')
  })

  it('shows no fabricated line on the Rutin tile when the user has no habits', () => {
    useHabitDay.mockReturnValue({ habits: [] })
    useHabitSummary.mockReturnValue({ data: { perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] } })
    renderHub()
    expect(screen.getByLabelText('Rutin')).not.toHaveTextContent('/')
  })
```

Add `useHabitDay` and `useHabitSummary` to the file's `vi.hoisted` block and its
`vi.mock('@/data/hooks', …)` factory, with `beforeEach` defaults giving three habits — one done,
morning strength 82, evening strength 64, with at least one evening habit so the second clause
has data.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/EnHubPage.test.tsx`
Expected: FAIL — no element labelled `Rutin`.

- [ ] **Step 3: Add the `wide` prop to Tile**

In `frontend/src/shared/ui/mozaik/index.tsx`, add to `TileProps`:

```ts
  /** Full-bleed row tile spanning both mosaic columns (the Mezo hub's Diagnózis precedent). */
  wide?: boolean
```

destructure `wide`, and compose the class as:

```tsx
  const cls = cn('mz-tile', `mz-w-${wash}`, 'rise', wide && 'mz-tile-wide mz-tile-row', className)
```

When `wide` is true, render this instead of the default `inner`, leaving non-wide tiles untouched:

```tsx
      {icon && <div className="mz-spotwrap"><ClayIcon name={icon} size={iconSize} /></div>}
      <div className="mz-tile-body">
        <div className="mz-tile-top"><span className="mz-eyebrow">{eyebrow}</span></div>
        {line !== undefined && <div className="mz-tile-line">{line}</div>}
      </div>
      <span className="mz-chev" aria-hidden="true">›</span>
```

- [ ] **Step 4: Add the row-layout CSS**

`.mz-tile-wide` already exists in `prototype.css` (grid-column `1 / -1`). Append the row form next
to it:

```css
/* The wide tile's ROW form (mezo-3zue): spot left, eyebrow + datum centre, chevron right —
   the Mezo hub's Diagnózis tile in tile-primitive form, so the Én mosaic keeps its 3x2 pairing. */
.mz-tile-row { flex-direction: row; align-items: center; gap: 13px; min-height: 0; padding: 13px 15px; text-align: left; }
.mz-tile-row .mz-spotwrap { flex: none; padding: 0; }
.mz-tile-row .mz-tile-top { flex: none; }
.mz-tile-row .mz-tile-body { flex: 1; min-width: 0; }
.mz-tile-row .mz-tile-line { text-align: left; margin-top: 3px; font-size: 15px; font-weight: 700; }
.mz-tile-row .mz-tile-line small { font-size: 11px; font-weight: 300; color: var(--text-tertiary); margin-left: 6px; }
.mz-tile-row .mz-chev { flex: none; font-size: 16px; }
```

Grep each token before using it; substitute the closest existing one rather than adding a hex.

- [ ] **Step 5: Add the tile to the Én hub**

In `EnHubPage.tsx`, next to the other tile-line derivations:

```tsx
  const { habits: todayHabits } = useHabitDay(todayIso)
  const { data: habitSummary } = useHabitSummary()
  const strengthOf = (keys: string[]) => {
    const values = habitSummary.habits
      .filter((h) => keys.includes(h.key) && h.strengthPct != null)
      .map((h) => h.strengthPct as number)
    return values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null
  }
  const morningPct = strengthOf(todayHabits.filter((h) => h.chain === 'MORNING').map((h) => h.key))
  const eveningPct = strengthOf(todayHabits.filter((h) => h.chain === 'EVENING').map((h) => h.key))
  const doneToday = todayHabits.filter((h) => h.status === 'done').length
  // No habits at all → no line. A fabricated "0 / 0" would read as a real standing.
  const rutinLine = todayHabits.length === 0 ? undefined : (
    <>
      {doneToday} / {todayHabits.length} ma
      {(morningPct != null || eveningPct != null) && (
        <small>
          {[morningPct != null ? `reggel ${morningPct}%` : null,
            eveningPct != null ? `este ${eveningPct}%` : null].filter(Boolean).join(' · ')}
        </small>
      )}
    </>
  )
```

and inside `<Mosaic>`, after the Beállítások tile:

```tsx
          <Tile wide wash="gold" icon="i-rend" iconSize={34} eyebrow="Rutin" delayMs={370}
            line={rutinLine} onClick={() => navigate('/me/rutin')} aria-label="Rutin" />
```

Import `useHabitDay` and `useHabitSummary` from `@/data/hooks`.

- [ ] **Step 6: Run the hub test to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/EnHubPage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Update the docs and CODEMAP**

- `docs/features/me.md`: the Én hub has six small tiles plus a wide Rutin tile; `RutinHubPage` is
  the routine home; `GrowthRutinPage` and `RoutineEditorPage` are gone; update `key_files`.
- `docs/features/growth.md`: the Growth hub has three tiles; `TAB_REDIRECT.routines` now leaves
  the Growth family for `/me/rutin`.
- `docs/features/habit.md` §2 and §10: the routine surfaces are `/me/rutin` (build and edit) and
  `/nap/rutin` (tick); `/me/growth/rutin` and `/me/routines/edit` are redirects.

Run: `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only`
Expected: PASS.

- [ ] **Step 8: Run the full suite in both modes and build**

Run:

```bash
cd frontend && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src docs
git commit -m "feat(habit): full-width Rutin tile on the Én hub (mezo-3zue.3)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

The pull request for this slice is opened by the coordinator after a branch-level review.
Visual baselines for `/me`, `/me/growth` and the retired `/me/growth/rutin` change — regenerate
them with the `update-visual-baselines.yml` workflow before merging.

---


## Slice S4 — Wizard and habit page (`mezo-3zue.4`, branch `feat/rutin-epito-wizard`)

### Task 9: The 4-step recipe wizard

**Files:**
- Create: `frontend/src/features/me/pages/RoutineWizardPage.tsx`
- Create: `frontend/src/features/me/pages/RoutineWizardPage.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `routineSentenceParts`, `titlePlaceholder`, `RoutineRecipe` (Task 6); `habitAnchorOptions`, `MEZO_EVENT_ANCHORS` (Task 6); `useHabitCatalog`, `useHabitCatalogActions` (Task 5); `Stepper` from `@/shared/ui/Stepper`; `LIFE_SKILLS` from `@/features/progression/logic/levelUpMeta`.
- Produces: route `/me/rutin/uj`; reads `?prefill` (a `habitKey`) and `?chain` (a `chainKey`) query parameters, consumed by Task 11.

- [ ] **Step 1: Write the failing wizard test**

Create `frontend/src/features/me/pages/RoutineWizardPage.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutineWizardPage } from '@/features/me/pages/RoutineWizardPage'
import type { HabitChainInfo } from '@/data/types'

const { useHabitCatalog, useHabitCatalogActions, createDef, navigate } = vi.hoisted(() => ({
  useHabitCatalog: vi.fn(), useHabitCatalogActions: vi.fn(),
  createDef: vi.fn(() => Promise.resolve()), navigate: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
  useProgressionProfile: () => ({ data: { life: [] } }),
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

const MORNING: HabitChainInfo = {
  id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
  position: 1, isActive: true,
  defs: [{
    id: 'd1', habitKey: 'sun', chainKey: 'MORNING', position: 1, title: 'Reggeli fény',
    why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
    xp: 5, linkUrl: null, isActive: true, framework: null, anchorHabitKey: null,
    cue: null, craving: null, reward: null, celebration: null, identity: null,
  }],
}

beforeEach(() => {
  useHabitCatalog.mockReturnValue({ catalog: { chains: [MORNING] }, isPending: false, isError: false, refetch: vi.fn() })
  useHabitCatalogActions.mockReturnValue({ createDef, pending: false })
  createDef.mockClear()
  navigate.mockClear()
})

const renderWizard = () => render(<MemoryRouter><RoutineWizardPage /></MemoryRouter>)
const next = () => screen.getByRole('button', { name: /Tovább|Mentés/ })

describe('RoutineWizardPage', () => {
  it('blocks step 1 until a framework is chosen', () => {
    renderWizard()
    expect(next()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    expect(next()).toBeEnabled()
  })

  it('assembles the Fogg sentence as the blanks fill and saves the recipe', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())

    fireEvent.click(screen.getByRole('button', { name: 'kész a Reggeli fény' }))
    expect(screen.getByTestId('recipe-sentence')).toHaveTextContent('Miután kész a Reggeli fény')
    fireEvent.click(next())

    fireEvent.change(screen.getByLabelText('Pici tett'), { target: { value: 'leírok egy mondatot' } })
    fireEvent.click(next())

    fireEvent.click(screen.getByRole('button', { name: 'ökölrázás' }))
    expect(next()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Vállalom/ }))
    expect(next()).toBeEnabled()
    fireEvent.click(next())

    expect(createDef).toHaveBeenCalledWith(expect.objectContaining({
      chainKey: 'MORNING', title: 'leírok egy mondatot', mode: 'MANUAL',
      framework: 'FOGG', anchorHabitKey: 'sun', celebration: 'ökölrázás',
    }))
  })

  it('requires craving on the Clear branch before leaving step 3', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Négy törvény/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Jelzés'), { target: { value: '7:10-kor a konyhában' } })
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Válasz'), { target: { value: 'leírom a szándékot' } })
    expect(next()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: 'tisztább a fejem' } })
    expect(next()).toBeEnabled()
  })

  it('warns softly when the Fogg behaviour looks too big, without blocking', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.click(screen.getByRole('button', { name: 'kész a Reggeli fény' }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Pici tett'), {
      target: { value: 'lefutok tizenöt kilométert a hegyen minden egyes reggel' },
    })
    expect(screen.getByText(/nagynak hangzik/)).toBeInTheDocument()
    expect(next()).toBeEnabled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/RoutineWizardPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the wizard page**

Create `frontend/src/features/me/pages/RoutineWizardPage.tsx` following the `GoalPlannerPage` idiom: `MozaikPage tone="gold"`, `PageHead onBack` stepping back before exiting to `/me/rutin`, a right-hand `Mégse` action, `EntranceGroup replayKey={step}`, and a bottom `Vissza` / `Tovább →` row whose CTA becomes `✓ Mentés` on step 4.

Required specifics:

```tsx
const STEP_COUNT = 4
const STEP_TITLES: Record<'FOGG' | 'CLEAR', [string, string, string, string]> = {
  FOGG: ['Milyen keretre építsük?', 'Mihez horgonyzod?', 'Mi a pici tett?', 'Hogyan ünnepled?'],
  CLEAR: ['Milyen keretre építsük?', 'Mi a jelzés?', 'Mi a válasz, és miért vágysz rá?', 'Mi teszi kielégítővé?'],
}
const CELEBRATIONS = ['ökölrázás', '„Igen!”', 'mosoly a tükörbe', 'mély levegő']
const REWARDS = ['a pipa maga', 'egy fejezet papírkönyv', 'kávé csak utána', 'öt perc semmittevés']
const CUES = ['reggel · konyha', 'este · hálószoba', 'edzés előtt · öltöző', 'ebéd után · asztal']
const XP_MIN = 5
const XP_MAX = 15
const XP_STEP = 5
```

State: `framework`, `anchorLabel`, `anchorHabitKey`, `title`, `chainKey` (default `'MORNING'`), `skillKey` (default `'mindset'`), `xp` (default 10), `craving`, `identity`, `celebration`, `reward` (default `'a pipa maga'`), `committed`.

Progress uses the shared `Stepper`:

```tsx
<Stepper title="Új szokás-recept" step={step} total={STEP_COUNT} stepLabel={stepTitle} />
```

The sentence card renders from step 2 onward:

```tsx
{step > 1 && (
  <div className={cn('rt-sentence', framework === 'CLEAR' && 'is-clear')} data-testid="recipe-sentence">
    <span className="rt-sentence-lb">{framework === 'FOGG' ? '⚓ Szokás-láncolás' : '◈ Négy törvény'}</span>
    <p className="rt-sentence-tx">
      {routineSentenceParts(recipe).map((part, i) => (
        part.slot === undefined
          ? <span key={i}>{part.text}</span>
          : <span key={i} className={cn('rt-blank', part.filled && 'is-filled')}>{part.text}</span>
      ))}
    </p>
  </div>
)}
```

where `recipe` is a `RoutineRecipe` built from the state, with `title` fed through `titlePlaceholder(framework)` only for the placeholder text (the helper already handles that inside `routineSentenceParts`; use the state's `title` directly).

Step guards:

```tsx
const tooBig = framework === 'FOGG'
  && (title.trim().split(/\s+/).filter(Boolean).length > 6
      || Number(title.match(/\d+/)?.[0] ?? 0) > 5)

const canProceed =
  (step === 1 && framework !== null)
  || (step === 2 && (framework === 'FOGG' ? anchorLabel.trim() !== '' : cue.trim() !== ''))
  || (step === 3 && title.trim() !== '' && (framework === 'FOGG' || craving.trim() !== ''))
  || (step === 4 && (framework === 'FOGG' ? celebration.trim() !== '' : reward.trim() !== '') && committed)
```

Field labels must match the test exactly: `Pici tett` (FOGG) / `Válasz` (CLEAR) for the title input, `Jelzés`, `Vágy`, `Identitás`, `Ünneplés`, `Jutalom`. Anchor chips come from `habitAnchorOptions(catalog)`; picking one sets `anchorLabel` to `option.label` and `anchorHabitKey` to `option.habitKey ?? null`; typing in the free-text input clears `anchorHabitKey`.

Save:

```tsx
  const save = () => {
    if (framework === null) return
    createDef({
      chainKey, title: title.trim(), mode: 'MANUAL', skillKey, xp, framework,
      ...(framework === 'FOGG'
        ? {
            ...(anchorHabitKey != null
              ? { anchorHabitKey }
              : { anchorCopy: anchorLabel.trim() }),
            celebration: celebration.trim(),
          }
        : {
            cue: cue.trim(), craving: craving.trim(), reward: reward.trim(),
            ...(identity.trim() ? { identity: identity.trim() } : {}),
          }),
    }).then(() => navigate('/me/rutin'))
  }
```

The commitment control is a `<button type="button">` whose accessible name contains `Vállalom`, toggling `committed`.

- [ ] **Step 4: Add the wizard CSS**

Append to `prototype.css`, translating the prototype's `.sentence`, `.fwcard`, `.tip` and `.commit` rules ×1.18. Use the same token-substitution rule as Task 7 Step 4: no new hex values, closest existing token wins. The classes are `rt-sentence`, `rt-sentence-lb`, `rt-sentence-tx`, `rt-blank`, `rt-fwcard`, `rt-tip`, `rt-commit`.

- [ ] **Step 5: Register the route**

In `router.tsx`, after the `me/rutin` entry:

```tsx
      { path: 'me/rutin/uj', element: <RoutineWizardPage /> },
```

- [ ] **Step 6: Run the wizard test to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/RoutineWizardPage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src docs
git commit -m "feat(habit): 4-step routine wizard on the Fogg and Clear frameworks (mezo-3zue.4)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: The habit page

**Files:**
- Create: `frontend/src/features/me/pages/HabitPage.tsx`
- Create: `frontend/src/features/me/pages/HabitPage.test.tsx`
- Modify: `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: `recipeFromDef`, `routineSentence` (Task 6); `useHabitCatalog`, `useHabitCatalogActions`, `useHabitSummary`.
- Produces: route `/me/rutin/szokas/:habitKey`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/me/pages/HabitPage.test.tsx` with the same hook-mocking preamble as `RutinHubPage.test.tsx`, rendering at `/me/rutin/szokas/intent` through `MemoryRouter initialEntries` + a `Routes`/`Route path="/me/rutin/szokas/:habitKey"` wrapper, asserting:

```tsx
  it('shows the finished recipe sentence and the framework band', () => {
    renderPage('intent')
    expect(screen.getByTestId('recipe-sentence'))
      .toHaveTextContent('7:10-kor a konyhában leírom a napi szándékot, mert tisztább a fejem. Jutalmam: a pipa maga.')
    expect(screen.getByText('Négy törvény')).toBeInTheDocument()
  })

  it('offers pausing, not deleting, as the primary destructive action', () => {
    renderPage('intent')
    expect(screen.getByRole('button', { name: /Szüneteltetés/ })).toBeInTheDocument()
  })

  it('pauses the habit through updateDef', () => {
    renderPage('intent')
    screen.getByRole('button', { name: /Szüneteltetés/ }).click()
    expect(updateDef).toHaveBeenCalledWith('d-intent', { isActive: false })
  })

  it('labels a framework-less habit as legacy and offers re-framing', () => {
    renderPage('water')
    expect(screen.getByText('Keret nélkül')).toBeInTheDocument()
    screen.getByRole('button', { name: /Keret választása/ }).click()
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj?prefill=water')
  })
```

Give the fixture's `intent` def the CLEAR fields the first assertion expects.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/HabitPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the page**

Create `frontend/src/features/me/pages/HabitPage.tsx`: `MozaikPage tone="gold"`, `PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin"`, hero showing the def's `strengthPct` as the big number with sub `28 napos erő · {done28} pipa · {missed28} kihagyás` from `useHabitSummary` (omit the sub entirely when the def has no summary row), then:

- A framework band: `⚓ Szokás-láncolás` / `◈ Négy törvény` / `Keret nélkül`, with a right-hand button labelled `Keret váltása` (framework set) or `Keret választása` (legacy) navigating to `/me/rutin/uj?prefill=${habitKey}`.
- The sentence, large, in the same `rt-sentence` card with `data-testid="recipe-sentence"`, built via `recipeFromDef(def, (key) => allDefs.find((d) => d.habitKey === key)?.title)`.
- The framework's own fields as controlled inputs plus title, chain chips and the XP stepper, saved through `updateDef(def.id, patch)` on a `Mentés` action in the head, following `HabitEditSheet`'s "omit an emptied optional key" rule.
- `Szüneteltetés — a haladás megmarad` calling `updateDef(def.id, { isActive: false })`.
- An unknown `:habitKey` renders `<Navigate to="/me/rutin" replace />`.

- [ ] **Step 4: Register the route**

In `router.tsx`, after `me/rutin/uj` (static siblings before the dynamic one):

```tsx
      { path: 'me/rutin/szokas/:habitKey', element: <HabitPage /> },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/HabitPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(habit): habit recipe page with pause and re-framing (mezo-3zue.4)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: AI suggestions feed the wizard, and the slice closes

**Files:**
- Modify: `frontend/src/features/me/sheets/AiSuggestSheet.tsx`
- Modify: `frontend/src/features/me/pages/RoutineWizardPage.tsx` (prefill)
- Modify: `frontend/src/features/me/pages/RutinHubPage.tsx` (highlight after save)
- Modify: `docs/features/habit.md`, `docs/features/me.md`, `docs/CODEMAP.md`
- Test: `frontend/src/features/me/pages/RoutineWizardPage.test.tsx`

**Interfaces:**
- Consumes: `HabitSuggestion.framework` and friends (Task 5); the wizard's `?prefill` / `?chain` parameters (Task 9).
- Produces: nothing further; this closes the epic's build slices.

- [ ] **Step 1: Write the failing prefill tests**

Add to `RoutineWizardPage.test.tsx`:

```tsx
  it('prefills from an existing legacy def and starts on the framework step', () => {
    renderWizardAt('/me/rutin/uj?prefill=sun')
    expect(screen.getByRole('button', { name: /Szokás-láncolás/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.click(next())
    expect(screen.getByLabelText('Pici tett')).toHaveValue('Reggeli fény')
  })

  it('prefills the chain from the query parameter', () => {
    renderWizardAt('/me/rutin/uj?chain=EVENING')
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    fireEvent.click(next())
    fireEvent.change(screen.getByLabelText('Horgony'), { target: { value: 'fogat mostam' } })
    fireEvent.click(next())
    expect(screen.getByRole('button', { name: 'Esti' })).toHaveAttribute('aria-pressed', 'true')
  })
```

Add a `renderWizardAt(path)` helper using `MemoryRouter initialEntries={[path]}` and give the catalog fixture an `EVENING` chain so the second test has a chip to assert on.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/RoutineWizardPage.test.tsx`
Expected: FAIL — the inputs are empty and the chain chip is not pressed.

- [ ] **Step 3: Implement prefill in the wizard**

In `RoutineWizardPage`, read the query parameters and seed state lazily:

```tsx
  const [searchParams] = useSearchParams()
  const prefillKey = searchParams.get('prefill')
  const prefillDef = prefillKey == null ? undefined
    : catalog.chains.flatMap((c) => c.defs).find((d) => d.habitKey === prefillKey)
  const [title, setTitle] = useState(prefillDef?.title ?? '')
  const [chainKey, setChainKey] = useState(
    prefillDef?.chainKey ?? searchParams.get('chain') ?? 'MORNING',
  )
  const [skillKey, setSkillKey] = useState(prefillDef?.skillKey ?? 'mindset')
  const [xp, setXp] = useState(prefillDef?.xp ?? 10)
  const [anchorLabel, setAnchorLabel] = useState(prefillDef?.anchorCopy ?? '')
```

Prefill never skips step 1: re-framing is exactly the decision the user came to make. When `prefillDef` exists, the terminal action updates instead of creating:

```tsx
    const action = prefillDef
      ? () => updateDef(prefillDef.id, payload)
      : () => createDef({ chainKey, ...payload })
```

with `payload` the framework fields plus `title`, `xp`, `skillKey` where applicable (`updateDef` accepts no `mode`/`skillKey` — omit those from the update payload).

- [ ] **Step 4: Route accepted AI suggestions into the wizard**

In `AiSuggestSheet.tsx`, replace the accept handler's direct `createDef` call with navigation carrying the suggestion, and pass the suggestion through `sessionStorage` under the key `mezo.routineWizard.suggestion` (a query string cannot carry five prose fields legibly):

```tsx
  const accept = (s: HabitSuggestion, close: () => void) => {
    sessionStorage.setItem('mezo.routineWizard.suggestion', JSON.stringify(s))
    close()
    navigate(`/me/rutin/uj?chain=${encodeURIComponent(s.chainKey)}`)
  }
```

In the wizard, seed from that key once on mount and clear it immediately, so a reload does not resurrect a stale suggestion:

```tsx
  const [suggestion] = useState(() => {
    try {
      const raw = sessionStorage.getItem('mezo.routineWizard.suggestion')
      sessionStorage.removeItem('mezo.routineWizard.suggestion')
      return raw ? (JSON.parse(raw) as HabitSuggestion) : null
    } catch {
      return null
    }
  })
```

and use `suggestion?.title`, `suggestion?.framework`, `suggestion?.celebration`, `suggestion?.cue`, `suggestion?.craving`, `suggestion?.reward` as the initial values wherever `prefillDef` does not already supply one. The user still confirms every step, so a proposal never becomes a habit without a human pass — ADR 0019's propose-only rule holds.

- [ ] **Step 5: Highlight the new row on the hub**

In the wizard's save handler, navigate to `` `/me/rutin?new=${encodeURIComponent(habitKeyOfResult)}` `` when the create mutation resolves with the new def. `useHabitCatalogActions().createDef` currently resolves to `undefined`; change its return to pass the created def through (`createDefM.mutateAsync(input)` already resolves to the API result in real mode — return it instead of `.then(() => undefined)`, and have the mock path return the def it inserted). Update `habitAdminHooks.ts` accordingly and keep every existing caller working, since they ignore the value.

- [ ] **Step 6: Run the full frontend suite in both modes and build**

Run:

```bash
cd frontend && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```

Expected: PASS.

- [ ] **Step 7: Update the docs and CODEMAP**

`docs/features/habit.md` §2 (the wizard's four steps and the two recipes), §6 (how to consume `routineSentence`), §7 (how to add a third framework), §10 (`key_files`); `docs/features/me.md` (`key_files` for the three new pages). Then:

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```

- [ ] **Step 8: Commit and open the S4 pull request**

```bash
git add -A frontend/src docs
git commit -m "feat(habit): AI suggestions prefill the wizard; new recipe highlighted on return (mezo-3zue.4)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feat/rutin-epito-wizard
gh pr create --title "feat(habit): Rutin-építő S4 — recipe wizard + habit page (mezo-3zue.4)" --body "$(cat <<'EOF'
Wizard slice. Spec: `docs/superpowers/specs/2026-09-02-routine-builder-design.md` §6.

- `/me/rutin/uj`: four steps, framework first, the recipe sentence assembling live, a commitment tick gating save.
- `/me/rutin/szokas/:habitKey`: the finished recipe, its 28-day history, the framework fields, pause-without-loss.
- AI suggestions now open the wizard prefilled instead of writing a def directly (ADR 0019 propose-only holds).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage.** §3 routes → Tasks 7, 9, 10. §4 Én tile → Task 8. §5 hub → Task 7. §6 wizard → Tasks 9, 11. §7.1–7.3 migration/entity/contract → Task 1. §7.4 validation → Task 2. §7.5 anchor lifecycle → Task 3. §7.6 switch/untouched surfaces → constraint, verified by Task 3 Step 5. §8 data layer → Tasks 5, 6. §9 Growth removal and docs → Tasks 7, 8. §10 testing → every task's test steps. §11 slices → the three slice headings. §12 out of scope → nothing in this plan touches it.

**Two known gaps, deliberately left to their own slices:** the first-tick celebration replay (`mezo-3zue.5`) and event-bound anchors (`mezo-3zue.6`). `MEZO_EVENT_ANCHORS` is free text until then, as Task 6 documents inline.

**Type consistency.** `routineSentence`/`routineSentenceParts`/`recipeFromDef`/`titlePlaceholder` and `RoutineRecipe`/`SentencePart`/`RecipeSlot` are named identically in Tasks 6, 9 and 10. `habitAnchorOptions`/`AnchorOption`/`MEZO_EVENT_ANCHORS` match between Tasks 6 and 9. `HabitFrameworkValidator.validate`/`clearForeignFields` match between Tasks 2 and 3. The seven column names are spelled identically in the SQL, the entity, the contract and the TypeScript types.
