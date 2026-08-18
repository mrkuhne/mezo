# Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An `app_notification` outbox fed by the 12 AI-brain event kinds, a bell chip + dropdown panel in `AppHero`, and push delivery for every kind through the existing dispatcher.

**Architecture:** One new table is the single source of truth; producers call a thin always-on `AppNotificationEmitter`; the FE reads one new `GET /api/notification/feed` endpoint via a `useDualQuery` hook; slice F3 maps feed rows into `AnchorResolver` as push anchors (6 new `NotificationCategory` entries, wake-deferral for overnight events).

**Tech Stack:** Spring Boot 4 / Java 21 / Maven / Liquibase / PostgreSQL · React 19 + TanStack Query + Vitest/MSW · contract-first OpenAPI (`api/`).

**Spec:** `docs/superpowers/specs/2026-08-18-notification-center-design.md` (approved 2026-08-18). Mockup (A-variant approved): `docs/superpowers/specs/2026-08-18-notification-center-mockup.html`.

## Global Constraints

- Base package `io.mrkuhne.mezo`; UUID PKs (`gen_random_uuid()`); every owned table extends `OwnedEntity` (`created_by`, `is_deleted`, `created_at`) with `@SQLDelete`/`@SQLRestriction`.
- Contract-first: edit `api/feature/notification/notification.yml` BEFORE code; merge with `cd api/generate && npm run generate:api`; FE types with `cd frontend && pnpm generate:api`; backend types regenerate in `./mvnw generate-sources`.
- Backend tests: integration-first, `test{Method}_should{Result}_when{Condition}` names, AssertJ only, data via populators, new table → `ResetDatabase` TRUNCATE list. **Locally run ONLY the focused test selectors given per task — never the full backend suite (16 GB machine OOMs; CI is the full-suite gate).**
- Frontend: hooks only via `@/data/hooks` barrel; `useDualQuery` for dual reads (import from `@/data/useDualQuery`); no new barrels; deep `@/*` imports; both test modes must pass at slice gates.
- Copy rules (spec §2): backend composes Hungarian title/body at emit time; never a reproach, never a fabricated number, exactly one deeplink.
- Conventional commits carrying the driving bd id, e.g. `feat(api): notification feed contract (mezo-gzhp.1)`.
- Ship flow per slice: own bd child issue + own `feat/*` branch → push → self-PR → CI green → local `--no-ff` merge to main → push. Before committing, check `git status` for an unexpectedly emptied `backend/archunit-store` (known corruption trap) and an auto-staged root `issues.jsonl` (expected, keep it).
- Slices build on each other: F2 branches from main after F1 merged; F3 after F2.

---

# Slice F1 — outbox + feed API + FE bell/panel + pattern-family emits

Branch: `feat/notification-feed-f1`. First step: `bd create --title="F1 — app_notification outbox + feed API + bell/panel + pattern emits" --type=task --priority=1` as child of `mezo-gzhp` (`bd dep add <new-id> mezo-gzhp` if the create flag isn't available), then `bd update <id> --claim`.

### Task 1: Migration + entity + repository + test plumbing

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608181400_mezo-gzhp.1_create_app_notification.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/entity/AppNotificationEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/repository/AppNotificationRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list)
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/AppNotificationPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AppNotificationRepositoryIT.java`

**Interfaces:**
- Produces: `AppNotificationEntity` (getters/setters for `kind,title,body,deeplink,refId,dedupKey,occurredAt,readAt` + inherited `createdBy`), `AppNotificationRepository` with the four finders below, `AppNotificationPopulator.notification(owner, kind, dedupKey, occurredAt)`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Notification center F1 (bd mezo-gzhp.1, spec 2026-08-18 §3).
-- The AI-brain event outbox: one row per notifiable event, HU copy composed at emit
-- time (single copy source for the in-app bell AND the push body). dedup_key is the
-- occurrence identity — the partial unique makes emit idempotent across the cron +
-- lazy-GET double generation paths (memoir/prediction/experiment).

create table app_notification (
    id          uuid         not null default gen_random_uuid(),
    created_by  uuid         not null,
    is_deleted  boolean      not null default false,
    created_at  timestamptz  not null default now(),
    kind        varchar(32)  not null,
    title       varchar(120) not null,
    body        varchar(300),
    deeplink    varchar(200) not null,
    ref_id      uuid,
    dedup_key   varchar(80)  not null,
    occurred_at timestamptz  not null default now(),
    read_at     timestamptz,
    constraint pk_app_notification_id primary key (id),
    constraint fk_app_notification_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_app_notification_created_by_dedup_key
    on app_notification (created_by, dedup_key) where is_deleted = false;
-- The feed read: newest-first per owner.
create index idx_app_notification_created_by_occurred_at
    on app_notification (created_by, occurred_at desc);
```

- [ ] **Step 2: Register in `1.0.0_master.yml`** (append after the `202608180300_mezo-dhzk_needs_source_type` changeset, same shape):

```yaml
  - changeSet:
      id: "1.0.0:202608181400_mezo-gzhp.1_create_app_notification"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608181400_mezo-gzhp.1_create_app_notification.sql
```

- [ ] **Step 3: Entity + repository**

```java
package io.mrkuhne.mezo.feature.notification.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One AI-brain event in the notification outbox (bd mezo-gzhp.1, spec 2026-08-18 §3).
 * The HU copy is composed at emit time and stored — the in-app bell renders it and the
 * push (slice F3) sends it verbatim; there is no second copy source anywhere.
 */
@Getter
@Setter
@Entity
@Table(name = "app_notification")
@SQLDelete(sql = "update app_notification set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class AppNotificationEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "kind", nullable = false, length = 32)
    private String kind;

    @NotNull
    @Column(name = "title", nullable = false, length = 120)
    private String title;

    @Column(name = "body", length = 300)
    private String body;

    @NotNull
    @Column(name = "deeplink", nullable = false, length = 200)
    private String deeplink;

    @Column(name = "ref_id")
    private UUID refId;

    @NotNull
    @Column(name = "dedup_key", nullable = false, length = 80)
    private String dedupKey;

    @NotNull
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "read_at")
    private Instant readAt;
}
```

```java
package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.AppNotificationEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppNotificationRepository extends JpaRepository<AppNotificationEntity, UUID> {

    List<AppNotificationEntity> findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(
            UUID createdBy, Pageable pageable);

    List<AppNotificationEntity> findByCreatedByAndReadAtIsNullAndDeletedFalse(UUID createdBy);

    boolean existsByCreatedByAndDedupKeyAndDeletedFalse(UUID createdBy, String dedupKey);

    /** Slice F3's push-anchor read: today's events for one owner. */
    List<AppNotificationEntity> findByCreatedByAndOccurredAtBetweenAndDeletedFalse(
            UUID createdBy, Instant from, Instant to);
}
```

- [ ] **Step 4: `ResetDatabase`** — add `app_notification, ` to the TRUNCATE list, right after `notification_schedule, ` in the same string literal.

- [ ] **Step 5: Populator**

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.notification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.notification.repository.AppNotificationRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class AppNotificationPopulator {

    private final AppNotificationRepository repository;

    /** One outbox row with sensible copy — kind/dedupKey/occurredAt are what tests vary. */
    public AppNotificationEntity notification(UUID owner, String kind, String dedupKey, Instant occurredAt) {
        AppNotificationEntity e = new AppNotificationEntity();
        e.setCreatedBy(owner);
        e.setKind(kind);
        e.setTitle("Teszt értesítés");
        e.setBody("Teszt törzs.");
        e.setDeeplink("/insights");
        e.setDedupKey(dedupKey);
        e.setOccurredAt(occurredAt);
        return repository.saveAndFlush(e);
    }
}
```

- [ ] **Step 6: Repository IT (write it, run it, expect FAIL before the migration lands, PASS after)**

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.notification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AppNotificationPopulator;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

class AppNotificationRepositoryIT extends AbstractIntegrationTest {

    @Autowired private AppNotificationRepository repository;
    @Autowired private AppNotificationPopulator populator;

    @Test
    void testFindByCreatedBy_shouldReturnNewestFirst_whenMultipleRowsExist() {
        var owner = ownerId();
        populator.notification(owner, "pattern_inbox", "pattern_inbox:a", Instant.parse("2026-08-18T04:40:00Z"));
        populator.notification(owner, "memory_note", "memory_note:b", Instant.parse("2026-08-18T00:20:00Z"));

        var rows = repository.findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(owner, PageRequest.of(0, 50));

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).getKind()).isEqualTo("pattern_inbox");
    }

    @Test
    void testSave_shouldViolateUniqueIndex_whenSameDedupKeyInsertedTwice() {
        var owner = ownerId();
        populator.notification(owner, "pattern_inbox", "pattern_inbox:dup", Instant.now());

        assertThatThrownBy(() -> populator.notification(owner, "pattern_inbox", "pattern_inbox:dup", Instant.now()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
```

Note: `ownerId()` — if `AbstractIntegrationTest` has no such helper, resolve the owner as `NotificationPrefApiIT` does (`appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId()` with the two `@Autowired` fields) — copy that private helper verbatim.

- [ ] **Step 7: Run** `cd backend && ./mvnw clean test -Dtest='AppNotificationRepositoryIT'` — expect PASS.
- [ ] **Step 8: Commit** `feat(be): app_notification outbox table + entity + repository (mezo-gzhp.1)`

### Task 2: `AppNotificationKind` catalog enum

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/AppNotificationKind.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AppNotificationKindTest.java`

**Interfaces:**
- Produces: `AppNotificationKind` enum with `key()`, `familyKey()` (nullable String — the push category key F3 maps to), `deeplink()` base, `fromKey(String): Optional<AppNotificationKind>`.

- [ ] **Step 1: Write the failing test** (plain JUnit, no Spring — pins spec §2's table):

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.AppNotificationKind;
import org.junit.jupiter.api.Test;

class AppNotificationKindTest {

    @Test
    void testCatalog_shouldPinTwelveKindsWithFamiliesAndDeeplinks_perSpec() {
        assertThat(AppNotificationKind.values()).hasSize(12);
        assertThat(AppNotificationKind.PATTERN_INBOX.key()).isEqualTo("pattern_inbox");
        assertThat(AppNotificationKind.PATTERN_INBOX.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.PATTERN_SIGNAL.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.HYPOTHESIS_NEW.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.FACT_CANDIDATE.familyKey()).isEqualTo("knowledge");
        assertThat(AppNotificationKind.FACT_REINFORCED.familyKey()).isEqualTo("knowledge");
        // memoir_ready: the existing `memoir` push category already owns that push — no family.
        assertThat(AppNotificationKind.MEMOIR_READY.familyKey()).isNull();
        assertThat(AppNotificationKind.PREDICTION_NEW.familyKey()).isEqualTo("prediction");
        assertThat(AppNotificationKind.PREDICTION_OUTCOME.familyKey()).isEqualTo("prediction");
        assertThat(AppNotificationKind.EXPERIMENT_PROPOSED.familyKey()).isEqualTo("experiment");
        assertThat(AppNotificationKind.EXPERIMENT_CLOSED.familyKey()).isEqualTo("experiment");
        assertThat(AppNotificationKind.CHALLENGE_EVENT.familyKey()).isEqualTo("challenge");
        assertThat(AppNotificationKind.MEMORY_NOTE.familyKey()).isEqualTo("memory");
        assertThat(AppNotificationKind.FACT_CANDIDATE.deeplink()).isEqualTo("/insights/knowledge");
        assertThat(AppNotificationKind.CHALLENGE_EVENT.deeplink()).isEqualTo("/train");
        assertThat(AppNotificationKind.MEMORY_NOTE.deeplink()).isEqualTo("/insights/memoria");
        assertThat(AppNotificationKind.fromKey("pattern_inbox")).contains(AppNotificationKind.PATTERN_INBOX);
        assertThat(AppNotificationKind.fromKey("nope")).isEmpty();
    }
}
```

- [ ] **Step 2: Run** `./mvnw clean test -Dtest='AppNotificationKindTest'` — expect FAIL (class missing).
- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.notification.domain;

import java.util.Arrays;
import java.util.Optional;

/**
 * The 12 AI-brain notification kinds (bd mezo-gzhp, spec 2026-08-18 §2) — the single source of
 * truth for kind key, push family (slice F3 maps it to a {@link NotificationCategory}), and the
 * deeplink base. {@code familyKey} is null ONLY for {@code memoir_ready}: the existing
 * {@code memoir} push category already pushes that event — a second category would double-notify.
 * Pattern-detail kinds interpolate {@code {pairKey}} into the deeplink at emit time.
 */
public enum AppNotificationKind {

    PATTERN_INBOX("pattern_inbox", "pattern", "/insights/patterns/"),
    PATTERN_SIGNAL("pattern_signal", "pattern", "/insights/patterns/"),
    HYPOTHESIS_NEW("hypothesis_new", "pattern", "/insights"),
    FACT_CANDIDATE("fact_candidate", "knowledge", "/insights/knowledge"),
    FACT_REINFORCED("fact_reinforced", "knowledge", "/insights/knowledge"),
    MEMOIR_READY("memoir_ready", null, "/insights/memoir"),
    PREDICTION_NEW("prediction_new", "prediction", "/insights/predictions"),
    PREDICTION_OUTCOME("prediction_outcome", "prediction", "/insights/predictions"),
    EXPERIMENT_PROPOSED("experiment_proposed", "experiment", "/insights/experiments"),
    EXPERIMENT_CLOSED("experiment_closed", "experiment", "/insights/experiments"),
    CHALLENGE_EVENT("challenge_event", "challenge", "/train"),
    MEMORY_NOTE("memory_note", "memory", "/insights/memoria");

    private final String key;
    private final String familyKey;
    private final String deeplink;

    AppNotificationKind(String key, String familyKey, String deeplink) {
        this.key = key;
        this.familyKey = familyKey;
        this.deeplink = deeplink;
    }

    /** The stable wire key persisted in {@code app_notification.kind}. */
    public String key() {
        return key;
    }

    /** The push category key this kind rides in slice F3 — null = no feed-driven push. */
    public String familyKey() {
        return familyKey;
    }

    /** The deeplink base; the two pattern kinds append the pairKey at emit time. */
    public String deeplink() {
        return deeplink;
    }

    public static Optional<AppNotificationKind> fromKey(String key) {
        return Arrays.stream(values()).filter(k -> k.key.equals(key)).findFirst();
    }
}
```

- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** `feat(be): AppNotificationKind 12-kind catalog (mezo-gzhp.1)`

### Task 3: Config + `AppNotificationService` + `AppNotificationEmitter`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/config/NotificationFeedProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (one constant)
- Modify: `backend/src/main/resources/application.yml` (two blocks)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AppNotificationService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AppNotificationEmitter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AppNotificationServiceIT.java`

**Interfaces:**
- Consumes: Task 1's repository, Task 2's enum.
- Produces: `AppNotificationService.emit(UUID owner, AppNotificationKind kind, String title, String body, String deeplink, UUID refId, String dedupKey)`, `.feed(UUID owner, int limit): List<AppNotificationEntity>`, `.markAllRead(UUID owner): int`; `AppNotificationEmitter.emit(...)` (same signature as service emit) — the ALWAYS-ON facade every producer injects.

- [ ] **Step 1: Properties + switch + yml.**

```java
package io.mrkuhne.mezo.feature.notification.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * In-app notification feed tunables (bd mezo-gzhp.1, spec 2026-08-18 §4).
 *
 * @param limit max rows the feed read returns (newest first)
 * @param inboxMinAbsR the pattern_inbox strength gate's |r| floor — MUST equal the FE
 *     {@code STRONG_SIGNAL.minAbsR} ({@code frontend/src/data/insights/insights.ts}); both sides
 *     pin it by test so the bell can never disagree with the dashboard's decide bucket
 * @param inboxMaxP the same gate's p ceiling — mirrors {@code STRONG_SIGNAL.maxP}
 * @param bandPromising |r| band edge #1 (0.3) — mirrors the FE {@code strengthWord} bands
 *     ({@code features/insights/logic/findings.ts}); pattern_signal emits only on a band crossing
 * @param bandStrong |r| band edge #2 (0.6) — same mirror
 */
@Validated
@ConfigurationProperties(prefix = "mezo.notification.feed")
public record NotificationFeedProperties(
        @Min(1) @Max(200) int limit,
        @DecimalMin("0.0") @DecimalMax("1.0") double inboxMinAbsR,
        @DecimalMin("0.0") @DecimalMax("1.0") double inboxMaxP,
        @DecimalMin("0.0") @DecimalMax("1.0") double bandPromising,
        @DecimalMin("0.0") @DecimalMax("1.0") double bandStrong) {}
```

`FeaturesConfiguration` — append before the closing brace:

```java
    /** In-app notification feed + bell (bd mezo-gzhp) — off ⇒ no feed beans, /api/notification/feed 404s, producers' emits no-op through AppNotificationEmitter. */
    public static final String NOTIFICATION_FEED_SWITCH = "mezo.feature.notification-feed.enabled";
```

`application.yml`: under the `mezo.feature.*` switch block (grep `notification.enabled` to find it) add:

```yaml
    notification-feed:
      enabled: true
```

and under the existing `mezo.notification:` block (after `prose-generation-grace-min: 15`) add:

```yaml
    # In-app notification feed (bd mezo-gzhp.1). The two inbox-* values MUST mirror the FE
    # STRONG_SIGNAL constant, the two band-* values the FE strengthWord bands — pinned by
    # AppNotificationServiceIT and the FE insights tests on both sides.
    feed:
      limit: 50
      inbox-min-abs-r: 0.3
      inbox-max-p: 0.15
      band-promising: 0.3
      band-strong: 0.6
```

- [ ] **Step 2: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.notification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.notification.service.AppNotificationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class AppNotificationServiceIT extends AbstractIntegrationTest {

    @Autowired private AppNotificationService service;
    @Autowired private AppNotificationRepository repository;

    @Test
    void testEmit_shouldPersistOneRow_whenCalledTwiceWithSameDedupKey() {
        var owner = ownerId();
        service.emit(owner, AppNotificationKind.PATTERN_INBOX, "Új minta vár döntésre",
                "Teszt.", "/insights/patterns/x", null, "pattern_inbox:x");
        service.emit(owner, AppNotificationKind.PATTERN_INBOX, "Új minta vár döntésre",
                "Teszt.", "/insights/patterns/x", null, "pattern_inbox:x");

        assertThat(repository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner)).hasSize(1);
    }

    @Test
    void testEmit_shouldTruncateBody_whenLongerThanColumnBudget() {
        var owner = ownerId();
        service.emit(owner, AppNotificationKind.MEMORY_NOTE, "Napi összefoglaló kész",
                "x".repeat(400), "/insights/memoria", null, "memory_note:long");

        var row = repository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner).get(0);
        assertThat(row.getBody()).hasSizeLessThanOrEqualTo(300);
    }

    @Test
    void testMarkAllRead_shouldStampEveryUnreadRow_andLeaveReadOnesAlone() {
        var owner = ownerId();
        service.emit(owner, AppNotificationKind.FACT_REINFORCED, "Egy tudás megerősödött ×2",
                null, "/insights/knowledge", null, "fact_reinforced:f:2");
        int stamped = service.markAllRead(owner);
        int stampedAgain = service.markAllRead(owner);

        assertThat(stamped).isEqualTo(1);
        assertThat(stampedAgain).isZero();
        assertThat(repository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner)).isEmpty();
    }

    @Test
    void testFeed_shouldCapAtLimit_andOrderNewestFirst() {
        var owner = ownerId();
        for (int i = 0; i < 5; i++) {
            service.emit(owner, AppNotificationKind.MEMORY_NOTE, "Napi összefoglaló kész",
                    null, "/insights/memoria", null, "memory_note:" + i);
        }
        assertThat(service.feed(owner, 3)).hasSize(3);
    }
}
```

(Same `ownerId()` note as Task 1.)

- [ ] **Step 3: Run** `./mvnw clean test -Dtest='AppNotificationServiceIT'` — expect FAIL.
- [ ] **Step 4: Implement service + emitter**

```java
package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.config.NotificationFeedProperties;
import io.mrkuhne.mezo.feature.notification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.notification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.notification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The AI-brain notification outbox (bd mezo-gzhp.1, spec 2026-08-18 §4). {@code emit} is
 * IDEMPOTENT by dedup key: the exists-check catches the common re-run, the unique-index catch
 * the cron-vs-lazy-GET race — either way a duplicate occurrence is silently a no-op, never an
 * error surfaced to the producer. Bean is gated on the feed switch; producers reach it ONLY
 * through {@link AppNotificationEmitter}, which no-ops when this bean does not exist.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_FEED_SWITCH, havingValue = "true")
public class AppNotificationService {

    private final AppNotificationRepository repository;
    private final NotificationFeedProperties properties;

    /**
     * REQUIRES_NEW keeps a duplicate-key rollback contained: several producers call emit from
     * inside their own @Transactional write (fact extraction, pattern decide) — letting the
     * unique-violation mark THAT transaction rollback-only would turn a benign duplicate
     * notification into a lost domain write.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void emit(UUID owner, AppNotificationKind kind, String title, String body,
                     String deeplink, UUID refId, String dedupKey) {
        if (repository.existsByCreatedByAndDedupKeyAndDeletedFalse(owner, dedupKey)) {
            return;
        }
        AppNotificationEntity e = new AppNotificationEntity();
        e.setCreatedBy(owner);
        e.setKind(kind.key());
        e.setTitle(PushSender.truncateBody(title, 120));
        e.setBody(PushSender.truncateBody(body, 300));
        e.setDeeplink(deeplink);
        e.setRefId(refId);
        e.setDedupKey(dedupKey);
        e.setOccurredAt(Instant.now());
        try {
            repository.saveAndFlush(e);
        } catch (DataIntegrityViolationException ex) {
            log.debug("Duplicate notification emit for {} ({}) — ignored", dedupKey, kind.key());
        }
    }

    public List<AppNotificationEntity> feed(UUID owner, int limit) {
        int capped = Math.min(limit, properties.limit());
        return repository.findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(owner, PageRequest.of(0, capped));
    }

    /** Panel-open semantics: every unread row gets stamped. Returns how many were stamped. */
    @Transactional
    public int markAllRead(UUID owner) {
        List<AppNotificationEntity> unread = repository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner);
        Instant now = Instant.now();
        unread.forEach(n -> n.setReadAt(now));
        repository.saveAllAndFlush(unread);
        return unread.size();
    }
}
```

```java
package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.domain.AppNotificationKind;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * The ALWAYS-ON emit facade (spec 2026-08-18 §4): producers (companion/proactive services)
 * inject this plainly; when the feed switch is off the {@link AppNotificationService} bean does
 * not exist and every emit is a silent no-op — a producer must never break because notifications
 * are disabled. This is the single place that holds the optionality (the RitualService
 * ObjectProvider precedent), so 12 call sites stay one-liners.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppNotificationEmitter {

    private final ObjectProvider<AppNotificationService> serviceProvider;

    public void emit(UUID owner, AppNotificationKind kind, String title, String body,
                     String deeplink, UUID refId, String dedupKey) {
        AppNotificationService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return;
        }
        try {
            service.emit(owner, kind, title, body, deeplink, refId, dedupKey);
        } catch (Exception e) {
            // A duplicate-key race inside emit's REQUIRES_NEW surfaces here as
            // UnexpectedRollbackException on commit — and no notification failure of ANY
            // shape may break the producing domain write. Log and move on.
            log.warn("Notification emit failed for {} ({}) — producer unaffected", dedupKey, kind.key(), e);
        }
    }
}
```

Note: `PushSender.truncateBody` is package-private in this same package — reuse it, do not copy it. If `title` may be null it never is (callers always pass one); `truncateBody` handles null `body`.

- [ ] **Step 5: Run** the IT — expect PASS. Also run `./mvnw clean test -Dtest='NotificationCategoryTest,DueEvaluatorTest'` to prove the existing notification suite still compiles.
- [ ] **Step 6: Commit** `feat(be): AppNotificationService outbox emit/feed/markAllRead + always-on emitter (mezo-gzhp.1)`

### Task 4: API contract + `NotificationFeedController`

**Files:**
- Modify: `api/feature/notification/notification.yml` (new tag + 2 paths + 2 schemas)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/controller/NotificationFeedController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/NotificationFeedApiIT.java`

**Interfaces:**
- Consumes: Task 3's service.
- Produces: `GET /api/notification/feed?limit=` → `NotificationFeedResponse{items: NotificationFeedItem[]}` (`id,kind,title,body,deeplink,occurredAt,readAt`); `POST /api/notification/feed/read-all` → 204. Generated interface: `NotificationFeedApi` (tag `NotificationFeed`).

- [ ] **Step 1: Contract.** In `notification.yml` add under `paths:`:

```yaml
  /api/notification/feed:
    get:
      tags: [NotificationFeed]
      operationId: getNotificationFeed
      summary: The in-app notification feed, newest first (NotificationFeed)
      parameters:
        - { name: limit, in: query, required: false, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
      responses:
        '200':
          description: The newest feed rows for the current user
          content:
            application/json:
              schema: { $ref: '#/components/schemas/NotificationFeedResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/notification/feed/read-all:
    post:
      tags: [NotificationFeed]
      operationId: markNotificationFeedRead
      summary: Mark every unread feed row read (NotificationFeed)
      responses:
        '204': { description: Stamped }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

and under `components.schemas:`:

```yaml
    NotificationFeedItem:
      type: object
      required: [id, kind, title, deeplink, occurredAt]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, minLength: 1, maxLength: 32, example: pattern_inbox }
        title: { type: string, minLength: 1, maxLength: 120 }
        body: { type: string, maxLength: 300, nullable: true }
        deeplink: { type: string, minLength: 1, maxLength: 200 }
        occurredAt: { type: string, format: date-time }
        readAt: { type: string, format: date-time, nullable: true }
    NotificationFeedResponse:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items: { $ref: '#/components/schemas/NotificationFeedItem' }
```

Then `cd api/generate && npm run generate:api` and `cd backend && ./mvnw clean generate-sources` (emits `NotificationFeedApi` + DTOs).

- [ ] **Step 2: Write the failing API IT**

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.NotificationFeedResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.AppNotificationPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP-level tests for /api/notification/feed (bd mezo-gzhp.1). */
class NotificationFeedApiIT extends ApiIntegrationTest {

    @Autowired private AppNotificationPopulator populator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetFeed_shouldReturnOwnRowsNewestFirst_whenRowsExist() {
        populator.notification(ownerId(), "pattern_inbox", "pattern_inbox:x", Instant.parse("2026-08-18T04:40:00Z"));
        populator.notification(ownerId(), "memory_note", "memory_note:y", Instant.parse("2026-08-18T00:20:00Z"));

        NotificationFeedResponse response = getForBody("/api/notification/feed",
                ownerAuthHeaders(), HttpStatus.OK, NotificationFeedResponse.class);

        assertThat(response.getItems()).hasSize(2);
        assertThat(response.getItems().get(0).getKind()).isEqualTo("pattern_inbox");
        assertThat(response.getItems().get(0).getReadAt()).isNull();
    }

    @Test
    void testReadAll_shouldStampEveryRow_whenCalled() {
        populator.notification(ownerId(), "fact_reinforced", "fact_reinforced:f:2", Instant.now());

        postForBody("/api/notification/feed/read-all", null, ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        NotificationFeedResponse response = getForBody("/api/notification/feed",
                ownerAuthHeaders(), HttpStatus.OK, NotificationFeedResponse.class);
        assertThat(response.getItems().get(0).getReadAt()).isNotNull();
    }

    @Test
    void testGetFeed_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/notification/feed", new HttpHeaders(), HttpStatus.UNAUTHORIZED, String.class);
    }
}
```

- [ ] **Step 3: Run** `./mvnw clean test -Dtest='NotificationFeedApiIT'` — expect FAIL (no controller → 404/500).
- [ ] **Step 4: Controller**

```java
package io.mrkuhne.mezo.feature.notification.controller;

import io.mrkuhne.mezo.api.controller.NotificationFeedApi;
import io.mrkuhne.mezo.api.dto.NotificationFeedItem;
import io.mrkuhne.mezo.api.dto.NotificationFeedResponse;
import io.mrkuhne.mezo.feature.notification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.notification.service.AppNotificationService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/notification/feed surface (bd mezo-gzhp.1) — thin delegation; gated on the feed switch. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_FEED_SWITCH, havingValue = "true")
public class NotificationFeedController implements NotificationFeedApi {

    private final AppNotificationService appNotificationService;
    private final CurrentUserId currentUserId;

    @Override
    public NotificationFeedResponse getNotificationFeed(Integer limit) {
        NotificationFeedResponse response = new NotificationFeedResponse();
        response.setItems(appNotificationService.feed(currentUserId.get(), limit == null ? 50 : limit).stream()
                .map(NotificationFeedController::toDto)
                .toList());
        return response;
    }

    @Override
    public void markNotificationFeedRead() {
        appNotificationService.markAllRead(currentUserId.get());
    }

    private static NotificationFeedItem toDto(AppNotificationEntity e) {
        NotificationFeedItem dto = new NotificationFeedItem();
        dto.setId(e.getId());
        dto.setKind(e.getKind());
        dto.setTitle(e.getTitle());
        dto.setBody(e.getBody());
        dto.setDeeplink(e.getDeeplink());
        dto.setOccurredAt(OffsetDateTime.ofInstant(e.getOccurredAt(), ZoneOffset.UTC));
        dto.setReadAt(e.getReadAt() == null ? null : OffsetDateTime.ofInstant(e.getReadAt(), ZoneOffset.UTC));
        return dto;
    }
}
```

Note: check the generated `NotificationFeedApi` method signatures after generate-sources (parameter type for `limit`, DTO date type — if the generator emits `Instant` instead of `OffsetDateTime`, adapt `toDto` to it). The generated DTO is the contract; never hand-edit it.

- [ ] **Step 5: Run** the IT — expect PASS.
- [ ] **Step 6: Commit** `feat(api): notification feed contract + controller (mezo-gzhp.1)` (include the regenerated `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` — run `cd frontend && pnpm generate:api` too).

### Task 5: Pattern-family emit sites (backend)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/PatternEventRepository.java` (one finder)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/PatternEmitIT.java`

**Interfaces:**
- Consumes: `AppNotificationEmitter.emit(...)` (Task 3), `NotificationFeedProperties` (Task 3), `AppNotificationKind` (Task 2).
- Produces: emits `pattern_inbox` (new strong row), `pattern_signal` (band crossing on proposed/monitoring rows), `fact_reinforced` (nightly reinforcement).

- [ ] **Step 1: Add the finder** to `PatternEventRepository`:

```java
    Optional<PatternEventEntity> findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
            UUID createdBy, UUID patternId, String kind);
```

(add `import java.util.Optional;`)

- [ ] **Step 2: Wire the emitter into `PatternDetectionService`.** Add two constructor fields (`@RequiredArgsConstructor` picks them up):

```java
    private final AppNotificationEmitter appNotificationEmitter;
    private final NotificationFeedProperties feedProperties;
```

with imports `io.mrkuhne.mezo.feature.notification.service.AppNotificationEmitter`, `io.mrkuhne.mezo.feature.notification.config.NotificationFeedProperties`, `io.mrkuhne.mezo.feature.notification.domain.AppNotificationKind`.

In `upsert(...)` (currently at `PatternDetectionService.java:99`), two changes:

(a) In the `pattern == null` branch, remember newness; after `patternRepository.saveAndFlush(pattern); recordSnapshot(pattern, result);` append:

```java
        if (isNew && passesInboxGate(result)) {
            appNotificationEmitter.emit(userId, AppNotificationKind.PATTERN_INBOX,
                    "Új minta vár döntésre",
                    "„" + pair.title() + "” — erős jel rajzolódik ki. Döntsd el, figyeljük-e.",
                    AppNotificationKind.PATTERN_INBOX.deeplink() + pair.key(),
                    pattern.getId(), "pattern_inbox:" + pair.key());
        }
```

(`boolean isNew = pattern == null;` captured right before the null-check branch.)

(b) `recordSnapshot` becomes band-aware. Replace its body with:

```java
    /** S1 (mezo-tk88.1): one history snapshot per LIVE evaluation — the detail chart's raw data.
     *  Feed (mezo-gzhp.1): a band crossing on a still-undecided row also emits a pattern_signal
     *  notification — the SAME |r| bands the FE strengthWord uses (0.3/0.6), config-pinned. */
    private void recordSnapshot(PatternEntity pattern, PearsonCorrelation.Result result) {
        var previous = patternEventRepository
                .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        pattern.getCreatedBy(), pattern.getId(), PatternEventEntity.KIND_SNAPSHOT);
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(pattern.getCreatedBy());
        event.setPatternId(pattern.getId());
        event.setKind(PatternEventEntity.KIND_SNAPSHOT);
        event.setOccurredAt(Instant.now());
        event.setPayload(PatternEventPayloadEnvelope.snapshot(result.r(), result.n(), result.p()));
        patternEventRepository.saveAndFlush(event);

        boolean undecided = PatternEntity.STATUS_PROPOSED.equals(pattern.getStatus())
                || PatternEntity.STATUS_MONITORING.equals(pattern.getStatus());
        if (undecided && previous.isPresent() && previous.get().getPayload().r() != null) {
            int prevBand = band(previous.get().getPayload().r());
            int newBand = band(result.r());
            if (prevBand != newBand) {
                boolean strengthened = newBand > prevBand;
                appNotificationEmitter.emit(pattern.getCreatedBy(), AppNotificationKind.PATTERN_SIGNAL,
                        "Egy minta jele " + (strengthened ? "erősödött" : "gyengült"),
                        "„" + pattern.getTitle() + "” — átlépett egy erősség-sávot.",
                        AppNotificationKind.PATTERN_SIGNAL.deeplink() + pattern.getPairKey(),
                        pattern.getId(),
                        "pattern_signal:" + pattern.getPairKey() + ":" + LocalDate.now());
            }
        }
    }

    /** |r| → band index 0/1/2 — MUST mirror the FE strengthWord thresholds (findings.ts). */
    private int band(double r) {
        double abs = Math.abs(r);
        if (abs < feedProperties.bandPromising()) {
            return 0;
        }
        return abs < feedProperties.bandStrong() ? 1 : 2;
    }

    private boolean passesInboxGate(PearsonCorrelation.Result result) {
        return Math.abs(result.r()) >= feedProperties.inboxMinAbsR()
                && result.p() <= feedProperties.inboxMaxP();
    }
```

(c) In `reinforcePromotedFact(...)`, inside the `ifPresent` lambda after the `log.info(...)` line, append:

```java
            appNotificationEmitter.emit(pattern.getCreatedBy(), AppNotificationKind.FACT_REINFORCED,
                    "Egy tudás megerősödött ×" + fact.getReinforcementCount(),
                    "„" + fact.getFactText() + "” — újra előjött ugyanabban az irányban.",
                    AppNotificationKind.FACT_REINFORCED.deeplink(), fact.getId(),
                    "fact_reinforced:" + fact.getId() + ":" + fact.getReinforcementCount());
```

(Check the fact entity's text getter name — `KnowledgeFactEntity` uses `setFactText` in `PatternService.promote`, so `getFactText()` is right.)

- [ ] **Step 3: Write the emit IT.** Drive the package-private seams directly with a constructed entity + result — NOT the whole nightly pipeline (that needs metric seeding). First check the record signature: `grep -n 'record Result' backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PearsonCorrelation.java` and use its component order.

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.PatternDetectionService;
import io.mrkuhne.mezo.feature.notification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Verifies the pattern-family feed emits (bd mezo-gzhp.1) end to end against Postgres. */
class PatternEmitIT extends AbstractIntegrationTest {

    @Autowired private PatternDetectionService patternDetectionService;
    @Autowired private AppNotificationRepository appNotificationRepository;

    // Drive detection through its public entry (the same method PatternDetectionJob calls —
    // grep 'patternDetectionService\.' backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionJob.java
    // for the exact name) after seeding two correlated metric series via the existing
    // populators the V3.1 detection ITs use — copy the seeding block from the existing
    // PatternDetection*IT test class in feature/companion (grep -l 'PatternDetection' backend/src/test).
    // Assertions to make, whatever the seeding recipe:

    @Test
    void testDetection_shouldEmitPatternInbox_whenNewStrongRowIsCreated() {
        // ...seed a strongly-correlated pair (the existing detection IT's recipe), run detection...
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(ownerId()))
                .anySatisfy(n -> {
                    assertThat(n.getKind()).isEqualTo("pattern_inbox");
                    assertThat(n.getDeeplink()).startsWith("/insights/patterns/");
                });
    }

    @Test
    void testDetection_shouldEmitOnlyOneInboxRow_whenRunTwice() {
        // ...same seeding, run detection twice...
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(ownerId())
                .stream().filter(n -> n.getKind().equals("pattern_inbox")).count()).isEqualTo(1);
    }
}
```

The seeding block is the ONE deliberately-referenced piece here: it must be copied from the existing V3.1 detection IT (it exists — V3.1 shipped tested), because inventing metric-series seeding cold would be less reliable than reusing the proven fixture. If that IT turns out to drive `upsert` via reflection or a package-private seam instead, mirror that instead — the two assertions above are the contract.

- [ ] **Step 4: Run** `./mvnw clean test -Dtest='PatternEmitIT,AppNotificationServiceIT'` — expect PASS.
- [ ] **Step 5: Commit** `feat(be): pattern-family feed emits — inbox/signal/reinforced (mezo-gzhp.1)`

### Task 6: FE types + feed API + mock seed + hooks

**Files:**
- Modify: `frontend/src/data/types.ts` (append after the notification region)
- Create: `frontend/src/data/notification/feedApi.ts`
- Create: `frontend/src/data/notification/feedMock.ts`
- Create: `frontend/src/data/notification/feedHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel exports)
- Test: `frontend/src/data/notification/feedHooks.test.tsx`

**Interfaces:**
- Produces: `useNotificationFeed(): { items: AppNotificationView[]; isPending: boolean }`, `useNotificationFeedActions(): { markAllRead: () => Promise<void> }`, type `AppNotificationView`, seed `notificationFeedSeed`.

- [ ] **Step 1: Types** (append to `types.ts` after `NOTIFICATION_CATEGORY_META`):

```ts
// --- In-app notification feed (bd mezo-gzhp.1, spec 2026-08-18) ---
/** Mirrors backend AppNotificationKind — keep in sync (AppNotificationKindTest pins that side). */
export type AppNotificationKindKey =
  | 'pattern_inbox' | 'pattern_signal' | 'hypothesis_new'
  | 'fact_candidate' | 'fact_reinforced' | 'memoir_ready'
  | 'prediction_new' | 'prediction_outcome'
  | 'experiment_proposed' | 'experiment_closed'
  | 'challenge_event' | 'memory_note'

export interface AppNotificationView {
  id: string
  kind: AppNotificationKindKey
  title: string
  body: string | null
  deeplink: string
  /** ISO date-time */
  occurredAt: string
  readAt: string | null
}

/** Per-kind panel icon + tint class suffix (the mockup's family colors). */
export const APP_NOTIFICATION_KIND_META: Record<AppNotificationKindKey, { emoji: string; tint: string }> = {
  pattern_inbox: { emoji: '🧩', tint: 'pattern' },
  pattern_signal: { emoji: '🧩', tint: 'pattern' },
  hypothesis_new: { emoji: '🧩', tint: 'pattern' },
  fact_candidate: { emoji: '📚', tint: 'knowledge' },
  fact_reinforced: { emoji: '📚', tint: 'knowledge' },
  memoir_ready: { emoji: '✍️', tint: 'memoir' },
  prediction_new: { emoji: '🔮', tint: 'prediction' },
  prediction_outcome: { emoji: '🔮', tint: 'prediction' },
  experiment_proposed: { emoji: '🧪', tint: 'experiment' },
  experiment_closed: { emoji: '🧪', tint: 'experiment' },
  challenge_event: { emoji: '🏆', tint: 'experiment' },
  memory_note: { emoji: '🗂', tint: 'memory' },
}
```

- [ ] **Step 2: API client** (`feedApi.ts`):

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

type FeedResponse = components['schemas']['NotificationFeedResponse']

export const notificationFeedApi = {
  feed: () => apiFetch<FeedResponse>('/api/notification/feed'),
  readAll: () => apiFetch<void>('/api/notification/feed/read-all', { method: 'POST' }),
}
```

- [ ] **Step 3: Mock seed** (`feedMock.ts`) — the mockup's six items; times derived from "now" so the Ma/Tegnap groups always populate (a mock seed, not a fixture — component tests assert group labels, not exact times):

```ts
import type { AppNotificationView } from '@/data/types'

function at(daysAgo: number, hhmm: string): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** Deterministic-shape feed seed: 3 unread today + 3 read older (mockup 2026-08-18, A variant). */
export const notificationFeedSeed: AppNotificationView[] = [
  { id: 'nf-1', kind: 'pattern_inbox', title: 'Új minta vár döntésre', body: 'A késői vacsora és a felszínes alvás között erős jel rajzolódik ki — döntsd el, figyeljük-e.', deeplink: '/insights/patterns/late-meal-sleep', occurredAt: at(0, '06:12'), readAt: null },
  { id: 'nf-2', kind: 'prediction_outcome', title: 'Bejött egy előrejelzés', body: 'A korai lefekvés utáni jobb reggeli energia ma igazolódott.', deeplink: '/insights/predictions', occurredAt: at(0, '06:15'), readAt: null },
  { id: 'nf-3', kind: 'experiment_closed', title: 'Kísérlet lezárult', body: 'A magnézium-kísérlet 14 napja letelt — az eredmény: igazolódott.', deeplink: '/insights/experiments', occurredAt: at(0, '06:20'), readAt: null },
  { id: 'nf-4', kind: 'fact_candidate', title: 'Új tény vár jóváhagyásra', body: '„Edzés után 40 perccel esik legjobban az étkezés” — a beszélgetésből emeltem ki.', deeplink: '/insights/knowledge', occurredAt: at(1, '21:40'), readAt: at(1, '22:00') },
  { id: 'nf-5', kind: 'fact_reinforced', title: 'Egy tudás megerősödött ×4', body: '„A hétvégi kimaradás után hétfőn nehezebb az edzés” — újra előjött ugyanabban az irányban.', deeplink: '/insights/knowledge', occurredAt: at(1, '06:05'), readAt: at(1, '08:00') },
  { id: 'nf-6', kind: 'memoir_ready', title: 'Elkészült a heti memoár', body: 'A 33. hét története megírva — két minta és egy kísérlet köré épült.', deeplink: '/insights/memoir', occurredAt: at(2, '19:15'), readAt: at(2, '20:00') },
]
```

- [ ] **Step 4: Hooks** (`feedHooks.ts`) — the `notificationPrefHooks.ts` recipe:

```ts
import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { notificationFeedApi } from '@/data/notification/feedApi'
import { notificationFeedSeed } from '@/data/notification/feedMock'
import type { components } from '@/data/_client/api.gen'
import type { AppNotificationKindKey, AppNotificationView } from '@/data/types'

const FEED_KEY = ['notification-feed'] as const

function toView(item: components['schemas']['NotificationFeedItem']): AppNotificationView {
  return {
    id: item.id,
    // The wire kind is a plain string; the backend enum guarantees the 12 known keys.
    kind: item.kind as AppNotificationKindKey,
    title: item.title,
    body: item.body ?? null,
    deeplink: item.deeplink,
    occurredAt: item.occurredAt,
    readAt: item.readAt ?? null,
  }
}

/** The in-app notification feed (bd mezo-gzhp.1). Real mode's pre-resolve value is the honest
 *  EMPTY list (never the demo seed — the badge must not flash a fabricated count at a live user);
 *  refresh rides refetchOnWindowFocus (TanStack default) + app open, no interval polling. */
export function useNotificationFeed(): { items: AppNotificationView[]; isPending: boolean } {
  const { data, isPending } = useDualQuery<AppNotificationView[]>({
    queryKey: FEED_KEY,
    mockData: notificationFeedSeed,
    realFetch: async () => (await notificationFeedApi.feed()).items.map(toView),
    realEmpty: [],
  })
  return { items: data, isPending }
}

export function useNotificationFeedActions(): { markAllRead: () => Promise<void> } {
  const qc = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async () => {
      if (mock) return
      await notificationFeedApi.readAll()
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: FEED_KEY })
      const previous = qc.getQueryData<AppNotificationView[]>(FEED_KEY)
      const now = new Date().toISOString()
      qc.setQueryData<AppNotificationView[]>(FEED_KEY, (rows) =>
        (rows ?? []).map((n) => (n.readAt ? n : { ...n, readAt: now })))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(FEED_KEY, context.previous)
    },
    onSettled: () => {
      if (!mock) qc.invalidateQueries({ queryKey: FEED_KEY })
    },
  })

  const markAllRead = useCallback(
    (): Promise<void> => mutation.mutateAsync().then(() => undefined),
    [mutation],
  )
  return { markAllRead }
}
```

Barrel (`data/hooks.ts`, append at the end):

```ts
export { useNotificationFeed, useNotificationFeedActions } from '@/data/notification/feedHooks'
```

- [ ] **Step 5: Write the failing hook test** (`feedHooks.test.tsx` — the `notificationPrefHooks.test.tsx` recipe, stateful fake backend included):

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/notification/feedHooks'
import { notificationFeedSeed } from '@/data/notification/feedMock'
import { isMockMode } from '@/data/_client/mode'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'

describe('useNotificationFeed', () => {
  it('serves the 6-item seed with 3 unread', async () => {
    server.use(http.get(`${API_BASE}/api/notification/feed`, () =>
      HttpResponse.json({ items: notificationFeedSeed })))
    const { result } = renderHook(() => useNotificationFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.items).toHaveLength(6))
    expect(result.current.items.filter((n) => !n.readAt)).toHaveLength(3)
  })

  it('mock mode never reaches the network', async () => {
    if (!isMockMode()) return
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useNotificationFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.items).toHaveLength(6))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('markAllRead optimistically stamps every unread row (both modes)', async () => {
    let state = notificationFeedSeed.map((n) => ({ ...n }))
    server.use(
      http.get(`${API_BASE}/api/notification/feed`, () => HttpResponse.json({ items: state })),
      http.post(`${API_BASE}/api/notification/feed/read-all`, () => {
        state = state.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(
      () => ({ feed: useNotificationFeed(), actions: useNotificationFeedActions() }),
      { wrapper: makeHookWrapper() },
    )
    await waitFor(() => expect(result.current.feed.items).toHaveLength(6))

    await act(async () => { await result.current.actions.markAllRead() })

    await waitFor(() => expect(result.current.feed.items.filter((n) => !n.readAt)).toHaveLength(0))
  })

  it('real mode: a failed read-all rolls the optimistic stamp back', async () => {
    if (isMockMode()) return
    server.use(
      http.get(`${API_BASE}/api/notification/feed`, () =>
        HttpResponse.json({ items: notificationFeedSeed })),
      http.post(`${API_BASE}/api/notification/feed/read-all`, () =>
        new HttpResponse(null, { status: 500 })),
    )
    const { result } = renderHook(
      () => ({ feed: useNotificationFeed(), actions: useNotificationFeedActions() }),
      { wrapper: makeHookWrapper() },
    )
    await waitFor(() => expect(result.current.feed.items).toHaveLength(6))

    await act(async () => { await result.current.actions.markAllRead().catch(() => {}) })

    await waitFor(() => expect(result.current.feed.items.filter((n) => !n.readAt)).toHaveLength(3))
  })
})
```

- [ ] **Step 6: Run** `cd frontend && pnpm test src/data/notification/feedHooks.test.tsx` — FAIL first (missing modules), then implement Steps 1-4 if written test-first, and re-run in BOTH modes: `pnpm test src/data/notification/feedHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/notification/feedHooks.test.tsx` — expect PASS.
- [ ] **Step 7: Commit** `feat(fe/data): notification feed hooks + mock seed (mezo-gzhp.1)`

### Task 7: `NotificationBell` + `NotificationPanel` + CSS + AppHero wiring

**Files:**
- Create: `frontend/src/features/notification/logic/groupByDay.ts`
- Create: `frontend/src/features/notification/components/NotificationPanel.tsx`
- Create: `frontend/src/features/notification/components/NotificationBell.tsx`
- Modify: `frontend/src/features/progression/components/AppHero.tsx` (one chip)
- Modify: `frontend/src/styles/prototype.css` (one block)
- Test: `frontend/src/features/notification/logic/groupByDay.test.ts`, `frontend/src/features/notification/components/NotificationBell.test.tsx`

**Interfaces:**
- Consumes: `useNotificationFeed`/`useNotificationFeedActions` from `@/data/hooks`, `APP_NOTIFICATION_KIND_META` from `@/data/types`.
- Produces: `<NotificationBell />` (self-contained: chip + badge + panel + backdrop).

- [ ] **Step 1: Write the failing pure-logic test** (`groupByDay.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import type { AppNotificationView } from '@/data/types'

const item = (id: string, occurredAt: string): AppNotificationView => ({
  id, kind: 'memory_note', title: 't', body: null, deeplink: '/insights', occurredAt, readAt: null,
})

describe('groupByDay', () => {
  it('splits Ma / Tegnap / Korábban against the given today', () => {
    const groups = groupByDay([
      item('a', '2026-08-18T06:12:00.000Z'),
      item('b', '2026-08-17T21:40:00.000Z'),
      item('c', '2026-08-15T19:15:00.000Z'),
    ], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma', 'Tegnap', 'Korábban'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['a'])
    expect(groups[2].items.map((i) => i.id)).toEqual(['c'])
  })

  it('omits empty groups', () => {
    const groups = groupByDay([item('a', '2026-08-18T06:12:00.000Z')], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma'])
  })
})
```

- [ ] **Step 2: Run it** (`pnpm test src/features/notification/logic/groupByDay.test.ts`) — FAIL. Implement:

```ts
import type { AppNotificationView } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

export interface FeedGroup {
  label: 'Ma' | 'Tegnap' | 'Korábban'
  items: AppNotificationView[]
}

/** Day-buckets the feed for the panel. `today` is injectable for pure tests
 *  (`localDateString()` at the call site). Items arrive newest-first and stay that way. */
export function groupByDay(items: AppNotificationView[], today: string): FeedGroup[] {
  const todayDate = new Date(`${today}T00:00:00`)
  const yesterday = new Date(todayDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = localDateString(yesterday)

  const buckets: Record<FeedGroup['label'], AppNotificationView[]> = { Ma: [], Tegnap: [], Korábban: [] }
  for (const n of items) {
    const day = localDateString(new Date(n.occurredAt))
    if (day === today) buckets.Ma.push(n)
    else if (day === yesterdayStr) buckets.Tegnap.push(n)
    else buckets.Korábban.push(n)
  }
  return (['Ma', 'Tegnap', 'Korábban'] as const)
    .filter((label) => buckets[label].length > 0)
    .map((label) => ({ label, items: buckets[label] }))
}
```

Note: check `localDateString`'s signature in `frontend/src/shared/lib/dates.ts` — if it takes no argument (always "now"), add a local `const iso = (d: Date) => \`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}\`` helper instead of extending the shared one.

- [ ] **Step 3: Panel component** (`NotificationPanel.tsx`) — the `SubNavDropdown` portal recipe verbatim (lazy backdrop portal into `.phone-screen`):

```tsx
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { APP_NOTIFICATION_KIND_META, type AppNotificationView } from '@/data/types'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import { localDateString } from '@/shared/lib/dates'
import { cn } from '@/shared/lib/cn'

function timeLabel(occurredAt: string, group: string): string {
  const d = new Date(occurredAt)
  if (group === 'Korábban') {
    return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

/** The A-variant dropdown panel (spec 2026-08-18 §6, mockup A). Purely presentational —
 *  the bell owns open-state and read-marking; `wasUnread` is the bell's open-time snapshot
 *  so the dots stay visible while the panel is open even though the cache is already stamped. */
export function NotificationPanel({ items, wasUnread, onClose }: {
  items: AppNotificationView[]
  wasUnread: ReadonlySet<string>
  onClose: () => void
}) {
  const navigate = useNavigate()
  const groups = groupByDay(items, localDateString())
  return (
    <>
      {createPortal(
        <button type="button" className="dd-backdrop" aria-label="Bezárás" onClick={onClose} />,
        document.querySelector('.phone-screen') ?? document.body,
      )}
      <div className="nf-panel" role="dialog" aria-label="Értesítések">
        <div className="nf-head">
          <span className="nf-title">Értesítések</span>
        </div>
        <div className="nf-scroll">
          {groups.length === 0 && <p className="nf-empty">Még nincs értesítés.</p>}
          {groups.map((group) => (
            <div key={group.label}>
              <div className="nf-group">{group.label}</div>
              {group.items.map((n) => {
                const meta = APP_NOTIFICATION_KIND_META[n.kind]
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={cn('nf-item np-press', wasUnread.has(n.id) && 'unread')}
                    onClick={() => { onClose(); navigate(n.deeplink) }}
                  >
                    {wasUnread.has(n.id) && <span className="nf-dot" aria-hidden="true" />}
                    <span className={cn('nf-ico', meta.tint)} aria-hidden="true">{meta.emoji}</span>
                    <span className="nf-txt">
                      <span className="nf-t">{n.title}</span>
                      {n.body && <span className="nf-b">{n.body}</span>}
                    </span>
                    <span className="nf-time">{timeLabel(n.occurredAt, group.label)}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Bell component** (`NotificationBell.tsx`):

```tsx
import { useRef, useState } from 'react'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/hooks'
import { NotificationPanel } from '@/features/notification/components/NotificationPanel'

/** The 4th AppHero counter chip: 🔔 + unread badge; opens the dropdown panel and marks
 *  everything read on open (classic bell semantics — the badge clears immediately, the
 *  open-time snapshot keeps the dots visible inside the panel until it closes). */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { items } = useNotificationFeed()
  const { markAllRead } = useNotificationFeedActions()
  const snapshotRef = useRef<ReadonlySet<string>>(new Set())

  const unread = items.filter((n) => !n.readAt).length

  const toggle = () => {
    if (!open) {
      snapshotRef.current = new Set(items.filter((n) => !n.readAt).map((n) => n.id))
      if (unread > 0) void markAllRead()
    }
    setOpen((v) => !v)
  }

  return (
    <div className="nf-bell">
      <button
        type="button"
        className="cnt bell np-press"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Értesítések, ${unread} olvasatlan` : 'Értesítések'}
        onClick={toggle}
      >
        🔔
        {unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>
      {open && (
        <NotificationPanel items={items} wasUnread={snapshotRef.current} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: AppHero wiring** — in `AppHero.tsx` add `import { NotificationBell } from '@/features/notification/components/NotificationBell'` and insert `<NotificationBell />` as the LAST child of `<div className="counters">` (after the 🪙 button).

- [ ] **Step 6: CSS** — append to `prototype.css` right after the `.subnav-dd .dd-sep` rule:

```css
/* ===== NotificationBell + panel — the 4th AppHero counter chip (mezo-gzhp.1) =====
   Same stacking recipe as SubNavDropdown: chip+panel inside .apphero (z 45), the
   backdrop portaled into .phone-screen at z 44. */
.nf-bell { position: relative; }
.nf-bell .cnt.bell { font-size: 15px; padding: 6px 6px 6px 8px; position: relative; }
.nf-bell .bell-badge {
  position: absolute; top: 0; right: -2px; min-width: 15px; height: 15px;
  border-radius: var(--r-full); background: var(--primary-base); color: #fff;
  font: 800 9px/1 var(--ff-body); display: flex; align-items: center; justify-content: center;
  padding: 0 3px; border: 2px solid var(--canvas);
}
.nf-panel {
  position: absolute; top: calc(100% + 8px); right: -60px;
  width: min(348px, calc(100vw - 20px));
  background: var(--surface-card); border: 1px solid var(--divider);
  border-radius: var(--r-lg); box-shadow: var(--shadow-lg); overflow: hidden;
}
.nf-panel .nf-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px; }
.nf-panel .nf-title { font: 800 15px/1 var(--ff-display); letter-spacing: -.01em; color: var(--text-primary); }
.nf-panel .nf-scroll { overflow-y: auto; max-height: min(480px, 62vh); }
.nf-panel .nf-empty { padding: 18px 16px 22px; font-family: var(--ff-serif); font-style: italic; font-size: 14px; color: var(--text-secondary); }
.nf-panel .nf-group { font: 800 10.5px/1 var(--ff-body); letter-spacing: .6px; text-transform: uppercase; color: var(--text-muted); padding: 10px 16px 4px; }
.nf-panel .nf-item {
  display: flex; gap: 10px; padding: 10px 16px 10px 18px; align-items: flex-start; position: relative;
  width: 100%; background: none; border: none; cursor: pointer; text-align: left;
}
.nf-panel .nf-item + .nf-item { border-top: 1px solid var(--divider); }
.nf-panel .nf-item.unread { background: color-mix(in srgb, var(--primary-base) 5%, transparent); }
.nf-panel .nf-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary-base); position: absolute; left: 6px; top: 50%; transform: translateY(-50%); }
.nf-panel .nf-ico { width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; }
.nf-panel .nf-ico.pattern { background: color-mix(in srgb, var(--dv-lav) 18%, transparent); }
.nf-panel .nf-ico.knowledge { background: color-mix(in srgb, var(--dv-sage) 20%, transparent); }
.nf-panel .nf-ico.prediction { background: color-mix(in srgb, var(--dv-sky) 18%, transparent); }
.nf-panel .nf-ico.experiment { background: color-mix(in srgb, var(--dv-amber) 22%, transparent); }
.nf-panel .nf-ico.memoir { background: color-mix(in srgb, var(--primary-base) 12%, transparent); }
.nf-panel .nf-ico.memory { background: var(--surface-recess); }
.nf-panel .nf-txt { min-width: 0; flex: 1; display: block; }
.nf-panel .nf-t { display: block; font: 700 12.5px/1.25 var(--ff-body); color: var(--text-primary); }
.nf-panel .nf-b {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  font: 400 11.5px/1.4 var(--ff-body); color: var(--text-secondary); margin-top: 2px;
}
.nf-panel .nf-time { font: 600 10px/1 var(--ff-body); color: var(--text-muted); flex-shrink: 0; margin-top: 1px; white-space: nowrap; }
```

- [ ] **Step 7: Component test** (`NotificationBell.test.tsx`):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NotificationBell } from '@/features/notification/components/NotificationBell'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderBell = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<NotificationBell />} />
          <Route path="/insights/knowledge" element={<div>TUDÁSTÁR OLDAL</div>} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

test('badge shows the seed unread count', () => {
  renderBell()
  expect(screen.getByLabelText('Értesítések, 3 olvasatlan')).toBeInTheDocument()
})

test('opening shows Ma/Tegnap groups and clears the badge', async () => {
  renderBell()
  await userEvent.click(screen.getByLabelText('Értesítések, 3 olvasatlan'))
  expect(screen.getByText('Ma')).toBeInTheDocument()
  expect(screen.getByText('Tegnap')).toBeInTheDocument()
  expect(screen.getByText('Új minta vár döntésre')).toBeInTheDocument()
  // Read-all fired on open — the accessible name drops the unread count.
  expect(await screen.findByLabelText('Értesítések')).toBeInTheDocument()
})

test('tapping an item deeplinks and closes the panel', async () => {
  renderBell()
  await userEvent.click(screen.getByLabelText('Értesítések, 3 olvasatlan'))
  await userEvent.click(screen.getByText('Új tény vár jóváhagyásra'))
  expect(await screen.findByText('TUDÁSTÁR OLDAL')).toBeInTheDocument()
  expect(screen.queryByText('Értesítések')).not.toBeInTheDocument()
})
```

- [ ] **Step 8: Run** `pnpm test src/features/notification src/features/progression/components/AppHero.test.tsx` in BOTH modes — expect PASS (AppHero's existing tests must survive the new chip).
- [ ] **Step 9: Commit** `feat(fe): notification bell + dropdown panel in AppHero (mezo-gzhp.1)`

### Task 8: F1 slice gate — docs, full FE gate, ship

- [ ] **Step 1: Docs.** Update `docs/features/_platform-notifications.md`: new §"In-app feed (bell + panel)" describing the outbox table, the two endpoints, the emitter pattern, the F1 pattern-family emits, key files; update the §1 summary line. Update `docs/features/insights.md` §5 Integrations with one bullet (pattern events now emit feed notifications). Run `node scripts/lint-docs.mjs` — the two touched docs must come out clean (pre-existing stale flags elsewhere are not this slice's problem).
- [ ] **Step 2: FE full gate** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`. Known pre-existing failure: `chatApi.test.ts` transcribe (Node 25 undici multipart — fails on main too); everything else must be green.
- [ ] **Step 3: Backend focused gate** `cd backend && ./mvnw clean test -Dtest='AppNotification*,NotificationFeed*,PatternEmitIT,NotificationCategoryTest,NotificationPrefApiIT'`.
- [ ] **Step 4: Ship** — `git push -u origin feat/notification-feed-f1`, `gh pr create --fill`, wait CI green (`gh pr checks --watch`), then `git checkout main && git pull --rebase && git merge --no-ff feat/notification-feed-f1 && git push`, delete the branch, `bd close <f1-id>`, `bd dolt push`.

---

# Slice F2 — remaining emit sites

Branch: `feat/notification-feed-f2` (from main after F1 merged). bd child: `bd create --title="F2 — knowledge/memoir/prediction/experiment/challenge/memory emits" --type=task --priority=1`, claim it.

### Task 9: Knowledge + hypothesis emits

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactExtractionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/HypothesisPipelineService.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/notification/PatternEmitIT.java` OR the producers' own existing IT classes (locate: `grep -rl 'FactExtraction' backend/src/test`) — one emit assertion per site, same style as Task 5.

**Interfaces:** Consumes `AppNotificationEmitter` (inject into both services as a new `private final` field).

- [ ] **Step 1: `FactExtractionService`** — in the persist loop (Task 9's anchor: the `learnedFactRepository.saveAndFlush(candidate); persisted++;` lines), after `persisted++;` add:

```java
            appNotificationEmitter.emit(userId, AppNotificationKind.FACT_CANDIDATE,
                    "Új tény vár jóváhagyásra",
                    "„" + candidate.getCandidateText() + "” — a beszélgetésből emeltem ki.",
                    AppNotificationKind.FACT_CANDIDATE.deeplink(), candidate.getId(),
                    "fact_candidate:" + candidate.getId());
```

and in the chat-side reinforce branch, after `knowledgeFactRepository.save(hit);`:

```java
                    appNotificationEmitter.emit(userId, AppNotificationKind.FACT_REINFORCED,
                            "Egy tudás megerősödött ×" + hit.getReinforcementCount(),
                            "„" + hit.getFactText() + "” — a beszélgetésben újra megerősítetted.",
                            AppNotificationKind.FACT_REINFORCED.deeplink(), hit.getId(),
                            "fact_reinforced:" + hit.getId() + ":" + hit.getReinforcementCount());
```

- [ ] **Step 2: `HypothesisPipelineService.persist`** — after `patternRepository.saveAndFlush(pattern);` (before `return true;`):

```java
        appNotificationEmitter.emit(userId, AppNotificationKind.HYPOTHESIS_NEW,
                "Új AI-hipotézis készült",
                "„" + title + "” — a heti hipotézis-körből. Nézd meg a Minták között.",
                AppNotificationKind.HYPOTHESIS_NEW.deeplink(), pattern.getId(),
                "hypothesis_new:" + pairKey);
```

- [ ] **Step 3: Tests + run.** One assertion per emit site in the producers' existing ITs (they exist — both features shipped integration-tested; drive the same fixtures those classes already use, assert on `AppNotificationRepository` rows by `kind`). Run `./mvnw clean test -Dtest='*FactExtraction*,*Hypothesis*,AppNotification*'`.
- [ ] **Step 4: Commit** `feat(be): knowledge + hypothesis feed emits (mezo-gzhp.2)`

### Task 10: Proactive emits (memoir, prediction, experiment)

**Files:**
- Modify: `MemoirGenerator.java`, `PredictionGenerator.java`, `PredictionValidationService.java`, `ExperimentProposalGenerator.java`, `ExperimentOutcomeService.java` (all under `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/`)
- Test: one emit assertion per site in the proactive ITs (locate: `ls backend/src/test/java/io/mrkuhne/mezo/feature/proactive/`).

**Interfaces:** Consumes `AppNotificationEmitter` (new field in each service).

- [ ] **Step 1: `MemoirGenerator.generate`** — replace the final `return memoirRepository.saveAndFlush(memoir);` with:

```java
        MemoirEntity saved = memoirRepository.saveAndFlush(memoir);
        appNotificationEmitter.emit(userId, AppNotificationKind.MEMOIR_READY,
                "Elkészült a heti memoár",
                saved.getTitle(),
                AppNotificationKind.MEMOIR_READY.deeplink(), saved.getId(),
                "memoir_ready:" + weekStart);
        return saved;
```

- [ ] **Step 2: `PredictionGenerator`** — after `saved.add(predictionRepository.saveAndFlush(e));`, using the just-saved element:

```java
            PredictionEntity savedRow = saved.get(saved.size() - 1);
            appNotificationEmitter.emit(userId, AppNotificationKind.PREDICTION_NEW,
                    "Új előrejelzés készült",
                    savedRow.getTitle(),
                    AppNotificationKind.PREDICTION_NEW.deeplink(), savedRow.getId(),
                    "prediction_new:" + savedRow.getId());
```

- [ ] **Step 3: `PredictionValidationService.validateClosedWindows`** — after `predictionRepository.saveAndFlush(p); closed++;`:

```java
            boolean validated = PredictionEntity.STATUS_VALIDATED.equals(p.getStatus());
            appNotificationEmitter.emit(userId, AppNotificationKind.PREDICTION_OUTCOME,
                    validated ? "Bejött egy előrejelzés" : "Egy előrejelzés nem vált be",
                    "„" + p.getTitle() + "” — " + p.getActual(),
                    AppNotificationKind.PREDICTION_OUTCOME.deeplink(), p.getId(),
                    "prediction_outcome:" + p.getId());
```

- [ ] **Step 4: `ExperimentProposalGenerator`** — after `saved.add(experimentRepository.saveAndFlush(e));`:

```java
            ExperimentEntity savedRow = saved.get(saved.size() - 1);
            appNotificationEmitter.emit(userId, AppNotificationKind.EXPERIMENT_PROPOSED,
                    "Új kísérlet-javaslat",
                    "„" + savedRow.getTitle() + "” — fogadd el vagy vesd el a Kísérletek fülön.",
                    AppNotificationKind.EXPERIMENT_PROPOSED.deeplink(), savedRow.getId(),
                    "experiment_proposed:" + savedRow.getId());
```

- [ ] **Step 5: `ExperimentOutcomeService.evaluateClosed`** — after `experimentRepository.saveAndFlush(e); closed++;`:

```java
            appNotificationEmitter.emit(userId, AppNotificationKind.EXPERIMENT_CLOSED,
                    "Kísérlet lezárult",
                    "„" + e.getTitle() + "” — " + e.getOutcome(),
                    AppNotificationKind.EXPERIMENT_CLOSED.deeplink(), e.getId(),
                    "experiment_closed:" + e.getId());
```

(The outcome text already encodes Beigazolódott / Nem igazolódott / Nem értékelhető — no second composition.)

- [ ] **Step 6: Tests + run.** Assertions in the proactive ITs (fixture-reuse rule as before). Also assert the memoir DOUBLE-generation path stays single: call `generate` twice, expect one `memoir_ready` row. Run `./mvnw clean test -Dtest='*Memoir*,*Prediction*,*Experiment*,AppNotification*'`.
- [ ] **Step 7: Commit** `feat(be): proactive feed emits — memoir/prediction/experiment (mezo-gzhp.2)`

### Task 11: Challenge + memory emits

**Files:**
- Modify: `ChallengeGenerator.java`, `ChallengeOutcomeEvaluator.java` (proactive), `DailySummaryService.java` (companion)
- Test: same fixture-reuse rule.

- [ ] **Step 1: `ChallengeGenerator`** — after `saved.add(challengeRepository.saveAndFlush(e));` (inside the `if (e != null)` branch):

```java
                ChallengeEntity savedRow = saved.get(saved.size() - 1);
                appNotificationEmitter.emit(userId, AppNotificationKind.CHALLENGE_EVENT,
                        "Új kihívás a mai edzéshez",
                        savedRow.getTitle(),
                        AppNotificationKind.CHALLENGE_EVENT.deeplink(), savedRow.getId(),
                        "challenge_proposed:" + savedRow.getId());
```

(Check the entity's title getter — if `ChallengeEntity` has no `getTitle()`, grep its fields and use the display-text column the FE renders.)

- [ ] **Step 2: `ChallengeOutcomeEvaluator`** — after BOTH `challengeRepository.saveAndFlush(c);` sites (the inconclusive and the hit/miss one):

```java
        appNotificationEmitter.emit(c.getCreatedBy(), AppNotificationKind.CHALLENGE_EVENT,
                "Kihívás lezárult",
                c.getOutcome(),
                AppNotificationKind.CHALLENGE_EVENT.deeplink(), c.getId(),
                "challenge_closed:" + c.getId());
```

- [ ] **Step 3: `DailySummaryService.generate`** — replace the final `return dailySummaryRepository.saveAndFlush(summary);` with:

```java
        DailySummaryEntity saved = dailySummaryRepository.saveAndFlush(summary);
        appNotificationEmitter.emit(userId, AppNotificationKind.MEMORY_NOTE,
                "Napi összefoglaló kész",
                "A(z) " + date + " nap emléke megírva és beágyazva a memóriába.",
                AppNotificationKind.MEMORY_NOTE.deeplink(), saved.getId(),
                "memory_note:" + date);
        return saved;
```

- [ ] **Step 4: Run** `./mvnw clean test -Dtest='*Challenge*,*DailySummary*,AppNotification*'`.
- [ ] **Step 5: Commit** `feat(be): challenge + daily-summary feed emits (mezo-gzhp.2)`

### Task 12: F2 slice gate

- [ ] Update `docs/features/_platform-notifications.md` (§ emit-site table now lists all 12) + `docs/features/proactive.md` §5 (one bullet: generators emit feed rows). `node scripts/lint-docs.mjs` clean on touched docs.
- [ ] Backend focused gate: `./mvnw clean test -Dtest='AppNotification*,PatternEmitIT,*FactExtraction*,*Memoir*,*Prediction*,*Experiment*,*Challenge*,*DailySummary*'`. FE untouched this slice — `pnpm build` only, as a compile sanity check.
- [ ] Ship (same flow as Task 8 Step 4), close the F2 bd child.

---

# Slice F3 — push wiring

Branch: `feat/notification-feed-f3`. bd child: `bd create --title="F3 — push: 6 new categories + AnchorResolver feed source + settings rows" --type=task --priority=1`, claim it.

### Task 13: 6 new `NotificationCategory` entries + catalog test updates

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/NotificationCategory.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/NotificationCategoryTest.java` (pins 20)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/NotificationPrefApiIT.java` (14→20, enabled 10→16)

- [ ] **Step 1:** Append to the enum (after `WEIGHT_REACTION`, comma-separated):

```java
    /** Anchor: the app_notification row's own occurred-at minute, wake-deferred (spec 2026-08-18 §4). */
    PATTERN("pattern", true, 0, false),

    /** Same feed-anchored family — knowledge (fact candidates + reinforcements). */
    KNOWLEDGE("knowledge", true, 0, false),

    /** Same feed-anchored family — predictions (new + outcome). */
    PREDICTION("prediction", true, 0, false),

    /** Same feed-anchored family — experiments (proposed + closed). */
    EXPERIMENT("experiment", true, 0, false),

    /** Same feed-anchored family — workout challenges. */
    CHALLENGE("challenge", true, 0, false),

    /** Same feed-anchored family — the nightly L1 memory note. */
    MEMORY("memory", true, 0, false);
```

Update the class javadoc's "14" to "20 (14 anchor-resolved + 6 feed-anchored, spec 2026-08-18)".

- [ ] **Step 2:** Update `NotificationCategoryTest` (values count 14→20 + six new key/default assertions in its existing style) and `NotificationPrefApiIT` (`hasSize(14)`→`hasSize(20)`, the enabled-count `10`→`16`, comment updated). Also grep for other 14-pinning asserts: `grep -rn 'hasSize(14)\|isEqualTo(10)' backend/src/test/java/io/mrkuhne/mezo/feature/notification/`.
- [ ] **Step 3: Run** `./mvnw clean test -Dtest='NotificationCategoryTest,NotificationPrefApiIT,NotificationPrefRepositoryIT'` — PASS.
- [ ] **Step 4: Commit** `feat(be): 6 feed-anchored push categories — 20-key catalog (mezo-gzhp.3)`

### Task 14: `AnchorResolver` feed source (wake-deferral + id-suffixed dedup + `?n=` discriminator)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AnchorResolverFeedIT.java`

**Interfaces:** Consumes `AppNotificationRepository` (new field), `AppNotificationKind.fromKey/familyKey`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AppNotificationPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The feed → push anchor mapping (bd mezo-gzhp.3, spec 2026-08-18 §4). */
class AnchorResolverFeedIT extends AbstractIntegrationTest {

    @Autowired private AnchorResolver anchorResolver;
    @Autowired private AppNotificationPopulator populator;

    private static Instant onDay(LocalDate date, String hhmm) {
        return LocalDateTime.of(date, LocalTime.parse(hhmm)).atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void testResolve_shouldDeferOvernightEventToWake_whenOccurredBeforeWakeMinute() {
        LocalDate today = LocalDate.now();
        populator.notification(ownerId(), "pattern_inbox", "pattern_inbox:x", onDay(today, "02:40"));

        AnchorSet anchors = anchorResolver.resolve(ownerId(), today);

        var feedEvent = anchors.backendAnchors().stream()
                .filter(a -> a.category() == NotificationCategory.PATTERN).findFirst().orElseThrow();
        // Default wake anchor is 06:00 (SleepGoalProperties default) — 02:40 defers to it.
        assertThat(feedEvent.minuteOfDay()).isEqualTo(6 * 60);
        assertThat(feedEvent.url()).contains("?n=");
        assertThat(feedEvent.dedupSuffix()).contains(":"); // HH:mm + ':' + id fragment
    }

    @Test
    void testResolve_shouldKeepDaytimeEventOnItsOwnMinute_whenOccurredAfterWake() {
        LocalDate today = LocalDate.now();
        populator.notification(ownerId(), "fact_candidate", "fact_candidate:c", onDay(today, "14:30"));

        AnchorSet anchors = anchorResolver.resolve(ownerId(), today);

        var feedEvent = anchors.backendAnchors().stream()
                .filter(a -> a.category() == NotificationCategory.KNOWLEDGE).findFirst().orElseThrow();
        assertThat(feedEvent.minuteOfDay()).isEqualTo(14 * 60 + 30);
    }

    @Test
    void testResolve_shouldSkipMemoirReady_becauseTheMemoirCategoryAlreadyOwnsThatPush() {
        LocalDate today = LocalDate.now();
        populator.notification(ownerId(), "memoir_ready", "memoir_ready:w", onDay(today, "19:20"));

        AnchorSet anchors = anchorResolver.resolve(ownerId(), today);

        assertThat(anchors.backendAnchors())
                .noneMatch(a -> a.dedupSuffix().contains("memoir_ready"));
        // (The prose `memoir` anchor may or may not exist — that path is untouched.)
    }
}
```

(If the default wake in tests differs from 06:00, read it the way `AnchorResolverIT`'s existing wake-based cases do and assert against that — do not hardcode a second source of truth.)

- [ ] **Step 2: Run** `./mvnw clean test -Dtest='AnchorResolverFeedIT'` — FAIL.
- [ ] **Step 3: Implement.** In `AnchorResolver`: add fields `private final AppNotificationRepository appNotificationRepository;` (+ import), and in `resolve(...)` after `ritualFamilyAnchors(owner, date, backendAnchors);` add `backendAnchors.addAll(feedAnchors(owner, date));`. New methods:

```java
    // ---- in-app feed events → push anchors (bd mezo-gzhp.3, spec 2026-08-18 §4) -------------

    /**
     * Today's {@code app_notification} rows, each anchored on max(its own minute, the wake
     * minute): the pattern motor runs 02:20-03:00 and a phone must not ring at night — overnight
     * events ride the wake anchor (the briefing precedent), daytime events their own minute.
     * The dedup suffix carries the row id — the inherited {@code {category}:{HHmm}} form would
     * collapse same-family wake-deferred events into one push, and every event must push
     * (user decision, spec §1). The url carries an {@code ?n=} discriminator because
     * {@code push-sw.js} uses it as the notification tag — two same-deeplink pushes would
     * replace each other on the phone (the check-in bug class).
     */
    private List<AnchoredEvent> feedAnchors(UUID owner, LocalDate date) {
        ZoneId zone = ZoneId.systemDefault();
        Instant from = date.atStartOfDay(zone).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(zone).toInstant();
        int wakeMinute = minuteOfDay(sleepAnchorPort.resolve(owner).wake());

        List<AnchoredEvent> events = new ArrayList<>();
        for (AppNotificationEntity row : appNotificationRepository
                .findByCreatedByAndOccurredAtBetweenAndDeletedFalse(owner, from, to)) {
            Optional<AppNotificationKind> kind = AppNotificationKind.fromKey(row.getKind());
            if (kind.isEmpty() || kind.get().familyKey() == null) {
                continue; // unknown (forward-compat) or memoir_ready (the memoir category owns it)
            }
            Optional<NotificationCategory> category = NotificationCategory.fromKey(kind.get().familyKey());
            if (category.isEmpty()) {
                continue;
            }
            LocalTime eventTime = LocalTime.ofInstant(row.getOccurredAt(), zone);
            int minute = Math.max(eventTime.getHour() * 60 + eventTime.getMinute(), wakeMinute);
            String idFragment = row.getId().toString().substring(0, 8);
            String hhmm = "%02d:%02d".formatted(minute / 60, minute % 60);
            String url = row.getDeeplink() + (row.getDeeplink().contains("?") ? "&" : "?") + "n=" + idFragment;
            events.add(new AnchoredEvent(category.get(), minute, hhmm + ":" + idFragment,
                    row.getTitle(), row.getBody(), url));
        }
        return events;
    }
```

Imports to add: `AppNotificationEntity`, `AppNotificationRepository`, `AppNotificationKind`. Check how the existing code converts the wake `LocalTime` to a minute (there is a `minuteOfDay(...)` helper used by `gymSlotEvent` — it takes a `String`; if no `LocalTime` overload exists, inline `wake.getHour() * 60 + wake.getMinute()` and check `SleepAnchorPort.resolve(owner).wake()`'s exact return type first: `grep -n 'wake' backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepAnchorPort.java`).

- [ ] **Step 4: Run** `./mvnw clean test -Dtest='AnchorResolverFeedIT,AnchorResolverIT,NotificationDispatchJobIT,DueEvaluatorTest'` — the existing dispatch chain must stay green (the new anchors flow through `DueEvaluator` + `push_log` untouched).
- [ ] **Step 5: Commit** `feat(be): AnchorResolver feed source — wake-deferred, id-deduped push anchors (mezo-gzhp.3)`

### Task 15: FE settings surface for the 6 new categories

**Files:**
- Modify: `frontend/src/data/types.ts` (`NotificationCategoryKey` + `NOTIFICATION_CATEGORIES` + `NotificationSection` + `NOTIFICATION_CATEGORY_META`)
- Modify: `frontend/src/data/notification/notificationMock.ts` (`DEFAULT_ENABLED`/`DEFAULT_LEAD_MINUTES`)
- Modify: `frontend/src/features/me/pages/NotificationsPage.tsx` (third section)
- Modify: `frontend/src/data/notification/notificationPrefHooks.test.tsx` (counts 14→20, 10→16)
- Modify: `frontend/src/features/me/pages/NotificationsPage.test.tsx` (third section assertions)

- [ ] **Step 1: Types.** Extend the union + array with `'pattern' | 'knowledge' | 'prediction' | 'experiment' | 'challenge' | 'memory'` (append in enum order), `NotificationSection` gains `| 'brain'`, and `NOTIFICATION_CATEGORY_META` gains:

```ts
  pattern: {
    label: 'Minták', emoji: '🧩', section: 'brain',
    description: 'Új minta döntésre, jel-erősödés — reggel, ébredés után', showLeadChip: false, iconBg: '--wash-lav',
  },
  knowledge: {
    label: 'Tudástár', emoji: '📚', section: 'brain',
    description: 'Új tény jóváhagyásra, tudás-megerősödés', showLeadChip: false, iconBg: '--wash-sage',
  },
  prediction: {
    label: 'Előrejelzések', emoji: '🔮', section: 'brain',
    description: 'Új predikció, bevált / nem vált be', showLeadChip: false, iconBg: '--wash-sport',
  },
  experiment: {
    label: 'Kísérletek', emoji: '🧪', section: 'brain',
    description: 'Új javaslat, kísérlet lezárult', showLeadChip: false, iconBg: '--wash-amber',
  },
  challenge: {
    label: 'Kihívások', emoji: '🏆', section: 'brain',
    description: 'Edzés-kihívás javaslat és eredmény', showLeadChip: false, iconBg: '--wash-gym',
  },
  memory: {
    label: 'Memória', emoji: '🗂', section: 'brain',
    description: 'Napi összefoglaló elkészült — ébredés után', showLeadChip: false, iconBg: '--wash-run',
  },
```

`notificationMock.ts`: all six `true` in `DEFAULT_ENABLED`, all six `0` in `DEFAULT_LEAD_MINUTES` (mirrors Task 13's enum defaults).

- [ ] **Step 2: `NotificationsPage`** — it renders two sections filtered on `meta.section === 'prose' | 'reminder'`; add a third block, same markup, filtered on `'brain'`, section header **"Az agy eseményei"**, placed after "Mezo megszólal". Copy the existing section's JSX block exactly, changing only the filter and the heading.
- [ ] **Step 3: Test updates.** `notificationPrefHooks.test.tsx`: `toHaveLength(14)`→`20`, `enabledCount` `10`→`16` (comment: +6 feed families, all ON). `NotificationsPage.test.tsx`: add one assertion that "Az agy eseményei" and a row labeled "Minták" render. Grep for other 14-pins: `grep -rn "toHaveLength(14)\|toBe(10)" frontend/src/data/notification frontend/src/features/me`.
- [ ] **Step 4: Run** `pnpm test src/data/notification src/features/me/pages/NotificationsPage.test.tsx` in BOTH modes — PASS.
- [ ] **Step 5: Commit** `feat(fe): settings rows for the 6 feed push categories (mezo-gzhp.3)`

### Task 16: F3 slice gate

- [ ] Docs: `_platform-notifications.md` — §4 catalog table gains the 6 rows (anchor: "feed row's own minute, wake-deferred"), §9 a gotcha bullet for the id-suffixed dedup key + `?n=` tag discriminator; the driving spec back-link. `insights.md` §5 one bullet. `node scripts/lint-docs.mjs` clean on touched docs.
- [ ] Backend focused gate: `./mvnw clean test -Dtest='Notification*,AppNotification*,AnchorResolver*,DueEvaluator*'`.
- [ ] FE full gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (chatApi transcribe pre-existing failure excepted).
- [ ] Ship + close the F3 child + `bd close mezo-gzhp` (epic) + final `bd dolt push && git push`.
- [ ] Runtime smoke (manual, optional but recommended): `docker compose up -d`, run backend with `demodata`, `VITE_USE_MOCK=true pnpm dev` for the bell UI, then real mode against the API; on the phone, wait for the next overnight cycle to see a real deferred push.

---

## Plan self-review notes (already applied)

- Spec coverage: §2 kinds → Tasks 2/5/9/10/11; §3 table → Task 1; §4 emitter/switch → Task 3; §4 push → Tasks 13/14; §5 API → Task 4; §6 FE → Tasks 6/7/15; §7 tests are inline per task; §8 slices → the three branch groups.
- The two deliberate fixture-reuse references (Task 5 Step 3, Tasks 9/10/11 tests) point at PROVEN existing IT fixtures rather than inventing seeding cold — each names the exact grep to locate them.
- Type consistency: `emit(owner, kind, title, body, deeplink, refId, dedupKey)` is identical at every call site; `AppNotificationView`/`NotificationFeedItem` field names match the contract; `familyKey` strings match Task 13's category keys.
