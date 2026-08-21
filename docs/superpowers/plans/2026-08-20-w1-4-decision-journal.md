# W1.4 — Decision journal + review loop (`mezo-b3pp.4`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record decisions with the context the system had at write time frozen server-side, then revisit them on a review-due date — with the decision (and later its outcome) embedded into the companion's narrative memory and a push reminder on the due day.

**Architecture:** A second aggregate (`decision_entry`) inside the **existing** `feature/journal` package, with its own contract fragment paths under `/api/journal/decision`, its own service/controller, and the same event → `@Async AFTER_COMMIT` → `MemoryEmbeddingWriter` embed seam W1.1 established (a new `DecisionEmbeddingListener` in `feature/companion/embedding`, so journal still never touches `memory_embedding` itself). The context snapshot is captured by calling `ContextSnapshotAssembler.render` **on the server, during POST**, into a typed jsonb envelope — the client cannot supply it. The review reminder is a new `NotificationCategory.DECISION_REVIEW` plus one `AnchorResolver` anchor method; no notification migration is needed (varchar columns).

**Tech Stack:** Java 21 / Spring Boot 4.x / Maven, PostgreSQL 16 + Liquibase, MapStruct + Lombok, OpenAPI contract-first (`api/feature/journal/journal.yml`); React 19 + Vite + Tailwind v4 + TanStack Query on the frontend; Vitest + Testing Library; JUnit 5 + AssertJ + Testcontainers/fixed-DB integration tests.

## Global Constraints

Copied from the design spec (`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md` §4, §5.4, §11) and the house references — every task below inherits these:

- **Contract-first.** `api/feature/journal/journal.yml` is edited BEFORE any Java; then `cd api/generate && npm run generate:api` and `cd frontend && pnpm generate:api`. Backend implements the **generated** `JournalApi` interface and uses `io.mrkuhne.mezo.api.dto` models. Never hand-write a boundary DTO.
- **Base package** `io.mrkuhne.mezo`; package layout `feature/{name}/{controller,service,repository,entity,dto,mapper}` (`docs/references/java_package_structure.md`).
- **UUID primary keys** (`gen_random_uuid()`), `created_by uuid not null references app_user(id) on delete cascade`, `is_deleted` soft delete via `@SQLRestriction`/`@SQLDelete`, `created_at timestamptz not null default now()`. Explicit constraint names: `pk_/fk_/uq_/ck_/idx_`.
- **Liquibase:** new SQL file `src/main/resources/db/changelog/1.0.0/script/{YYYYMMDDHHMM}_mezo-b3pp.4_{desc}.sql` + a `changeSet` appended to `1.0.0_master.yml` with id `"1.0.0:{filename-without-.sql}"`, author `daniel.kuhne`. Never modify a released changeset.
- **DI:** constructor injection via `@RequiredArgsConstructor`, never field injection, never `@Value`. `@Transactional` on service methods only.
- **Error handling:** `SystemRuntimeErrorException` + `SystemMessage.error("CODE")` with the Hungarian text in `src/main/resources/messages.properties`. No hardcoded user-facing strings in Java.
- **Config:** everything under the `mezo:` root in `application.yml`; new tunables go into an existing `@Validated` properties record. Feature gating reuses `FeaturesConfiguration.JOURNAL_SWITCH` (`mezo.feature.journal.enabled`) — off ⇒ no decision beans, the whole surface 404s.
- **Every LLM/embed call site** wraps in `LlmCallContextHolder.runWith(new LlmCallContext(feature, operation, entityKind, entityId), …)`. For this slice that is already inside `MemoryEmbeddingWriter` — extend it, do not call `EmbeddingPort` from anywhere else.
- **Tests are integration-first**: `@SpringBootTest` via `AbstractIntegrationTest` (service level) / `ApiIntegrationTest` (HTTP level). Naming `test{Method}_should{Result}_when{Condition}`. AssertJ only. No mocks / `@MockBean` / H2 in integration tests. Test data through `*Populator` factories. **New table ⇒ add it to `ResetDatabase`'s TRUNCATE list.**
- **Frontend** (`docs/references/frontend_conventions.md`): four layers; feature code imports hooks from **`@/data/hooks` only**; implementations in `data/journal/<name>Hooks.ts`; dual-mode reads via `useDualQuery` with an honest mock seed; modals are `*Sheet` under `features/<domain>/sheets/`; deep absolute `@/*` imports, no relative `../`, no barrels except `data/hooks.ts`; tests colocated. Hungarian UI copy.
- **Docs in the same change:** `docs/features/journal.md` (decision sections), `docs/features/_platform-notifications.md` (new category), `docs/features/me.md` (the `/me/naplo` surface gains the decisions block). Then `node scripts/lint-docs.mjs` — no new staleness allowed.
- **Gates:** `cd backend && ./mvnw clean test -Dtest='<affected ITs>'` (docker compose up first); `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`. Always `clean` — Lombok+MapStruct incremental compile is flaky.

## Locked design decisions

These were decided while reading the spec + code; do not re-litigate them mid-execution:

1. **Listing has no query parameters.** `GET /api/journal/decision` returns every non-deleted decision for the owner, newest-first by `decided_on`. Decisions are rare (a handful a year, single user); a date window would hide an old-but-still-open decision from `/me/naplo`, which is exactly the row the review loop exists for.
2. **Review is re-runnable.** `PUT /api/journal/decision/{id}/review` is idempotent in the HTTP sense: a second call overwrites `outcome_rating`/`outcome_text`, restamps `reviewed_at`, and re-embeds. No 409 (the L2 `decide` precedent's 409 protects an *approval* transition; refining your own hindsight is not that).
3. **The context snapshot is never returned over the wire** this slice. It is captured server-side and asserted in ITs through the repository. It exists for W3's recall/prompt work, not for display; adding it to the response DTO now would ship an unused field.
4. **Companion off ⇒ empty snapshot text, not a failed write.** `ContextSnapshotAssembler` is `@ConditionalOnProperty(COMPANION_SWITCH)`, so it is injected as `ObjectProvider` and a missing bean yields `new DecisionContextEnvelope("", Instant.now())` (IDENT-3: honest degraded, never silent-broken and never a fabricated snapshot).
5. **The push fires on the due day only** — the anchor exists when `review_due == date` and `reviewed_at is null`, never `review_due <= date`. An overdue decision is carried by the `/me/naplo` chip, not by a notification that nags every morning forever.
6. **Embedding content:** `decision_text` on create; after a review, `decision_text + "\n\nKimenet (N/5): …"` re-embedded in place on the same `(kind='decision', ref_id)` row — the outcome is the valuable half (spec §5.4).

## File structure

**Backend — create**
- `backend/src/main/resources/db/changelog/1.0.0/script/202608201200_mezo-b3pp.4_create_decision_entry.sql` — the table.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/DecisionEntryEntity.java` — the aggregate.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/DecisionContextEnvelope.java` — typed jsonb payload.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/DecisionEntryRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/DecisionService.java` — create (snapshot capture) / list / review.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/DecisionEntrySavedEvent.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/mapper/DecisionMapper.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/controller/DecisionController.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/DecisionEmbeddingListener.java`

**Backend — modify**
- `api/feature/journal/journal.yml` — 3 paths + 3 schemas.
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — one changeSet.
- `backend/src/main/resources/messages.properties` — `DECISION_ENTRY_NOT_FOUND`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — `writeDecision`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java` — `KIND_DECISION`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/NotificationCategory.java` — `DECISION_REVIEW`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/config/NotificationProperties.java` + `application.yml` — `decisionReviewTime`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java` — `decisionReviewAnchors`.
- `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` — `decision_entry`.
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java` — `createDecision`.

**Frontend — create**
- `frontend/src/data/journal/decisionTypes.ts`, `decisionApi.ts`, `decisionHooks.ts`, `decisionMock.ts`, `decisionHooks.test.tsx`
- `frontend/src/features/me/sheets/DecisionReviewSheet.tsx` (+ `.test.tsx`)

**Frontend — modify**
- `frontend/src/data/hooks.ts` — re-export.
- `frontend/src/features/me/sheets/JournalSheet.tsx` (+ test) — „Napló" / „Döntés" mode toggle.
- `frontend/src/features/me/pages/JournalPage.tsx` (+ test) — open-decisions block.
- `frontend/src/data/types.ts`, `frontend/src/data/notification/notificationMock.ts`, `frontend/src/features/me/logic/notificationForecast.ts` — the `decision_review` category.

---

### Task 1: Contract + migration + persistence

**Files:**
- Modify: `api/feature/journal/journal.yml`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608201200_mezo-b3pp.4_create_decision_entry.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/DecisionContextEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/DecisionEntryEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/DecisionEntryRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:41`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/journal/DecisionEntryPersistenceIT.java`

**Interfaces:**
- Consumes: `OwnedEntity` (`createdBy`, `deleted`, `createdAt`), `JournalPopulator`.
- Produces: `DecisionEntryEntity` (getters/setters for `id`, `decidedOn`, `decisionText`, `contextSnapshot`, `reviewDue`, `reviewedAt`, `outcomeRating`, `outcomeText`); `DecisionContextEnvelope(String snapshotText, Instant capturedAt)`; `DecisionEntryRepository.findByCreatedByAndDeletedFalseOrderByDecidedOnDescCreatedAtDesc(UUID)`, `.findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`, `.findByCreatedByAndReviewDueAndReviewedAtIsNullAndDeletedFalse(UUID, LocalDate)`; `JournalPopulator.createDecision(...)`; generated DTOs `CreateDecisionEntryRequest`, `ReviewDecisionRequest`, `DecisionEntryResponse`.

- [ ] **Step 1: Add the contract fragment paths + schemas**

Append to `api/feature/journal/journal.yml` — the three paths go under the existing `paths:` map, the three schemas under `components.schemas:`:

```yaml
  /api/journal/decision:
    get:
      tags: [Journal]
      operationId: listDecisionEntries
      summary: All decisions, newest first (Journal)
      responses:
        '200':
          description: Every non-deleted decision, newest first by decidedOn
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/DecisionEntryResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    post:
      tags: [Journal]
      operationId: createDecisionEntry
      summary: Record a decision; the server freezes its own context snapshot (Journal)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateDecisionEntryRequest' }
      responses:
        '201':
          description: Decision saved
          content:
            application/json:
              schema: { $ref: '#/components/schemas/DecisionEntryResponse' }
        '400':
          description: Validation error (empty decisionText)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/journal/decision/{id}/review:
    put:
      tags: [Journal]
      operationId: reviewDecisionEntry
      summary: Rate how a decision turned out (Journal)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ReviewDecisionRequest' }
      responses:
        '200':
          description: Reviewed decision
          content:
            application/json:
              schema: { $ref: '#/components/schemas/DecisionEntryResponse' }
        '400':
          description: Validation error (rating out of 1..5)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: DECISION_ENTRY_NOT_FOUND
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

```yaml
    DecisionEntryResponse:
      type: object
      required: [id, decidedOn, decisionText, reviewDue, createdAt]
      properties:
        id: { type: string, format: uuid }
        decidedOn: { type: string, format: date }
        decisionText: { type: string }
        reviewDue:
          type: string
          format: date
          description: decidedOn + mezo.companion.journal.decision-review-days, server-computed.
        reviewedAt: { type: string, format: date-time, nullable: true }
        outcomeRating: { type: integer, minimum: 1, maximum: 5, nullable: true }
        outcomeText: { type: string, nullable: true }
        createdAt: { type: string, format: date-time }
    CreateDecisionEntryRequest:
      type: object
      required: [decisionText]
      properties:
        decisionText: { type: string, minLength: 1 }
        decidedOn:
          type: string
          format: date
          description: The day the decision was made; server defaults to today when absent.
    ReviewDecisionRequest:
      type: object
      required: [outcomeRating]
      properties:
        outcomeRating: { type: integer, minimum: 1, maximum: 5 }
        outcomeText: { type: string }
```

Note deliberately absent: no `contextSnapshot` anywhere in the contract — the client can neither write it (locked decision 3) nor read it.

- [ ] **Step 2: Regenerate the merged contract and the FE types**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` gains the three paths; `frontend/src/data/_client/api.gen.ts` gains `/api/journal/decision` entries. Backend Java DTOs regenerate on the next `./mvnw` run.

- [ ] **Step 3: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202608201200_mezo-b3pp.4_create_decision_entry.sql`:

```sql
-- Phase 5 W1.4 (bd mezo-b3pp.4, spec §4.1 / §5.4): decisions with their context frozen.
-- context_snapshot is captured SERVER-side at write time (ContextSnapshotAssembler.render) —
-- the point is what the system knew, unfalsified, so the client never supplies it.
create table decision_entry (
    id               uuid        not null default gen_random_uuid(),
    created_by       uuid        not null,
    is_deleted       boolean     not null default false,
    created_at       timestamptz not null default now(),
    decided_on       date        not null,
    decision_text    text        not null,
    context_snapshot jsonb       not null,
    review_due       date        not null,
    reviewed_at      timestamptz,
    outcome_rating   smallint,
    outcome_text     text,
    constraint pk_decision_entry_id primary key (id),
    constraint fk_decision_entry_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_decision_entry_outcome_rating check (outcome_rating is null or outcome_rating between 1 and 5)
);

create index idx_decision_entry_created_by_review_due on decision_entry (created_by, review_due);
```

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202608201200_mezo-b3pp.4_create_decision_entry"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608201200_mezo-b3pp.4_create_decision_entry.sql
```

- [ ] **Step 4: Write the entity + envelope + repository**

`backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/DecisionContextEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.journal.entity;

import java.time.Instant;

/**
 * Typed jsonb payload for {@code decision_entry.context_snapshot} (bd mezo-b3pp.4, spec §5.4):
 * the rendered {@code ContextSnapshotAssembler} text plus the instant it was frozen.
 *
 * <p>{@code snapshotText} is empty — never fabricated — when the companion switch is off and the
 * assembler bean does not exist (IDENT-3: honest degraded state).
 */
public record DecisionContextEnvelope(String snapshotText, Instant capturedAt) {
}
```

`backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/DecisionEntryEntity.java`:

```java
package io.mrkuhne.mezo.feature.journal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One recorded decision (Phase 5 W1.4, bd mezo-b3pp.4, spec §4.1/§5.4): the decision text, the
 * server-frozen context snapshot, and — after {@code review_due} comes around — how it turned out.
 */
@Getter
@Setter
@Entity
@Table(name = "decision_entry")
@SQLDelete(sql = "update decision_entry set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DecisionEntryEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "decided_on", nullable = false)
    private LocalDate decidedOn;

    @NotNull
    @Column(name = "decision_text", nullable = false, columnDefinition = "text")
    private String decisionText;

    /** What the system knew when the decision was written — never client-supplied. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_snapshot", nullable = false)
    private DecisionContextEnvelope contextSnapshot;

    @NotNull
    @Column(name = "review_due", nullable = false)
    private LocalDate reviewDue;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    /** Mirrors ck_decision_entry_outcome_rating; null until reviewed. */
    @Min(1)
    @Max(5)
    @Column(name = "outcome_rating")
    private Short outcomeRating;

    @Column(name = "outcome_text", columnDefinition = "text")
    private String outcomeText;
}
```

`backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/DecisionEntryRepository.java`:

```java
package io.mrkuhne.mezo.feature.journal.repository;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DecisionEntryRepository extends JpaRepository<DecisionEntryEntity, UUID> {

    Optional<DecisionEntryEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<DecisionEntryEntity> findByCreatedByAndDeletedFalseOrderByDecidedOnDescCreatedAtDesc(UUID createdBy);

    /** The notification anchor's work list: decisions whose review lands exactly on {@code reviewDue}
     *  and that are still unreviewed (AnchorResolver, spec §5.4). */
    List<DecisionEntryEntity> findByCreatedByAndReviewDueAndReviewedAtIsNullAndDeletedFalse(
        UUID createdBy, LocalDate reviewDue);
}
```

- [ ] **Step 5: Extend the test scaffolding**

In `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:41`, add `decision_entry` next to `journal_entry` in the TRUNCATE list (same statement, comma-separated).

Add to `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java` (inject `DecisionEntryRepository` as a second final field):

```java
    public DecisionEntryEntity createDecision(UUID owner, LocalDate decidedOn, String decisionText,
                                              LocalDate reviewDue, String snapshotText) {
        DecisionEntryEntity e = new DecisionEntryEntity();
        e.setCreatedBy(owner);
        e.setDecidedOn(decidedOn);
        e.setDecisionText(decisionText);
        e.setContextSnapshot(new DecisionContextEnvelope(snapshotText, Instant.parse("2026-08-20T06:00:00Z")));
        e.setReviewDue(reviewDue);
        return decisionRepository.saveAndFlush(e);
    }
```

- [ ] **Step 6: Write the failing persistence IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/journal/DecisionEntryPersistenceIT.java`:

```java
package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.validation.ConstraintViolationException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** decision_entry DDL + jsonb envelope round-trip + rating CHECK + the anchor finder (bd mezo-b3pp.4). */
@Transactional
class DecisionEntryPersistenceIT extends AbstractIntegrationTest {

    @Autowired private DecisionEntryRepository repository;
    @Autowired private JournalPopulator populator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testCreateDecision_shouldRoundTripTheJsonbSnapshot_whenValid() {
        UUID owner = userPopulator.createUser("decision-rt@test.local").getId();

        DecisionEntryEntity saved = populator.createDecision(owner, LocalDate.parse("2026-08-20"),
            "Elhalasztom a nyári blokkot szeptemberre.", LocalDate.parse("2026-09-19"),
            "[Profil] 183 cm ...");

        DecisionEntryEntity found = repository
            .findByIdAndCreatedByAndDeletedFalse(saved.getId(), owner).orElseThrow();
        assertThat(found.getDecisionText()).isEqualTo("Elhalasztom a nyári blokkot szeptemberre.");
        assertThat(found.getContextSnapshot().snapshotText()).isEqualTo("[Profil] 183 cm ...");
        assertThat(found.getContextSnapshot().capturedAt()).isNotNull();
        assertThat(found.getReviewDue()).isEqualTo(LocalDate.parse("2026-09-19"));
        assertThat(found.getReviewedAt()).isNull();
        assertThat(found.getOutcomeRating()).isNull();
    }

    @Test
    void testFindByReviewDue_shouldReturnOnlyUnreviewedDecisionsDueThatExactDay_whenMixed() {
        UUID owner = userPopulator.createUser("decision-due@test.local").getId();
        DecisionEntryEntity dueToday = populator.createDecision(owner, LocalDate.parse("2026-07-21"),
            "Ma esedékes.", LocalDate.parse("2026-08-20"), "ctx");
        populator.createDecision(owner, LocalDate.parse("2026-07-22"),
            "Holnap esedékes.", LocalDate.parse("2026-08-21"), "ctx");
        DecisionEntryEntity alreadyReviewed = populator.createDecision(owner,
            LocalDate.parse("2026-07-20"), "Már átnézve.", LocalDate.parse("2026-08-20"), "ctx");
        alreadyReviewed.setReviewedAt(java.time.Instant.parse("2026-08-20T07:00:00Z"));
        alreadyReviewed.setOutcomeRating((short) 4);
        repository.saveAndFlush(alreadyReviewed);

        List<DecisionEntryEntity> due = repository
            .findByCreatedByAndReviewDueAndReviewedAtIsNullAndDeletedFalse(owner, LocalDate.parse("2026-08-20"));

        assertThat(due).extracting(DecisionEntryEntity::getId).containsExactly(dueToday.getId());
    }

    @Test
    void testSaveDecision_shouldRejectTheRating_whenOutsideOneToFive() {
        UUID owner = userPopulator.createUser("decision-ck@test.local").getId();
        DecisionEntryEntity e = populator.createDecision(owner, LocalDate.parse("2026-08-20"),
            "Rossz értékelés.", LocalDate.parse("2026-09-19"), "ctx");
        e.setOutcomeRating((short) 9);

        assertThatThrownBy(() -> repository.saveAndFlush(e))
            .isInstanceOf(ConstraintViolationException.class);
    }
}
```

- [ ] **Step 7: Run it and watch it fail, then pass**

```bash
cd backend && ./mvnw clean test -Dtest='DecisionEntryPersistenceIT'
```

Expected before Steps 3–5 land: compilation failure / `relation "decision_entry" does not exist`. After: PASS (3 tests). Requires `docker compose up -d`.

- [ ] **Step 8: Commit**

```bash
git add api backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/journal backend/src/test frontend/src/data/_client/api.gen.ts && git commit -m "feat(journal): decision_entry table, entity and contract (mezo-b3pp.4)"
```

---

### Task 2: DecisionService + controller — server-frozen snapshot and the review write

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/DecisionService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/DecisionEntrySavedEvent.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/mapper/DecisionMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/controller/DecisionController.java`
- Modify: `backend/src/main/resources/messages.properties`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/journal/JournalSwitchOffIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/journal/DecisionApiIT.java`

**Interfaces:**
- Consumes: Task 1's entity/repository; `ContextSnapshotAssembler.render(UUID userId, LocalDate today)`; `CompanionProperties.journal().decisionReviewDays()`; `CurrentUserId.get()`; generated `JournalApi`.
- Produces: `DecisionService.create(UUID, CreateDecisionEntryRequest)`, `.list(UUID)`, `.review(UUID, UUID, ReviewDecisionRequest)` all returning `DecisionEntryResponse`/`List<…>`; `DecisionEntrySavedEvent(UUID decisionId)` published AFTER the create and the review commit.

- [ ] **Step 1: Write the failing HTTP contract IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/journal/DecisionApiIT.java`:

```java
package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract IT for {@code /api/journal/decision} (bd mezo-b3pp.4, spec §5.4): the
 * server-side snapshot capture (including that a client-supplied one is ignored), the review-due
 * default, listing order, the review write, and ownership 404.
 *
 * <p>Not {@code @Transactional} — the create/review commits must really happen so Task 3's
 * AFTER_COMMIT embed listener fires on the same path a user would take.
 */
class DecisionApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DecisionEntryRepository decisionEntryRepository;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private CompanionProperties companionProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testCreateDecisionEntry_shouldDefaultDayAndReviewDue_whenDecidedOnAbsent() {
        ownerId();

        DecisionEntryResponse created = postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder().decisionText("Váltok esti edzésre.").build(),
            ownerAuthHeaders(), HttpStatus.CREATED, DecisionEntryResponse.class);

        assertThat(created.getDecidedOn()).isEqualTo(LocalDate.now());
        assertThat(created.getReviewDue())
            .isEqualTo(LocalDate.now().plusDays(companionProperties.journal().decisionReviewDays()));
        assertThat(created.getReviewedAt()).isNull();
        assertThat(created.getOutcomeRating()).isNull();
    }

    @Test
    void testCreateDecisionEntry_shouldCaptureTheServersOwnSnapshot_whenTheClientSuppliesOne() {
        UUID owner = ownerId();

        // The contract has no contextSnapshot field; Boot's Jackson ignores unknown properties, so
        // this is exactly what a malicious/confused client could send. It must not reach the row.
        String rawBody = """
            {"decisionText":"Hamis kontextussal.","contextSnapshot":{"snapshotText":"HAZUGSÁG","capturedAt":"2020-01-01T00:00:00Z"}}
            """;
        var response = exchangeForResponse("/api/journal/decision", org.springframework.http.HttpMethod.POST,
            rawBody, jsonHeaders(ownerAuthHeaders()));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        var stored = decisionEntryRepository
            .findByCreatedByAndDeletedFalseOrderByDecidedOnDescCreatedAtDesc(owner);
        assertThat(stored).hasSize(1);
        assertThat(stored.getFirst().getContextSnapshot().snapshotText()).doesNotContain("HAZUGSÁG");
        assertThat(stored.getFirst().getContextSnapshot().snapshotText()).contains("[Profil]");
        assertThat(stored.getFirst().getContextSnapshot().capturedAt()).isAfter(java.time.Instant.parse("2026-01-01T00:00:00Z"));
    }

    @Test
    void testCreateDecisionEntry_shouldReturn400_whenTextBlank() {
        String body = postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder().decisionText("").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "decisionText", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testListDecisionEntries_shouldReturnNewestFirst_whenSeveralExist() {
        UUID owner = ownerId();
        journalPopulator.createDecision(owner, LocalDate.parse("2026-06-01"), "Régi döntés.",
            LocalDate.parse("2026-07-01"), "ctx");
        journalPopulator.createDecision(owner, LocalDate.parse("2026-08-01"), "Új döntés.",
            LocalDate.parse("2026-08-31"), "ctx");

        List<DecisionEntryResponse> rows = getForList("/api/journal/decision", ownerAuthHeaders(),
            HttpStatus.OK, DecisionEntryResponse.class);

        assertThat(rows).extracting(DecisionEntryResponse::getDecisionText)
            .containsExactly("Új döntés.", "Régi döntés.");
    }

    @Test
    void testReviewDecisionEntry_shouldStampRatingAndReviewedAt_whenCalled() {
        UUID owner = ownerId();
        var decision = journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"),
            "Esti edzésre váltok.", LocalDate.parse("2026-08-20"), "ctx");

        DecisionEntryResponse reviewed = putForBody(
            "/api/journal/decision/" + decision.getId() + "/review",
            ReviewDecisionRequest.builder().outcomeRating(4).outcomeText("Jobban aludtam tőle.").build(),
            ownerAuthHeaders(), HttpStatus.OK, DecisionEntryResponse.class);

        assertThat(reviewed.getOutcomeRating()).isEqualTo(4);
        assertThat(reviewed.getOutcomeText()).isEqualTo("Jobban aludtam tőle.");
        assertThat(reviewed.getReviewedAt()).isNotNull();
    }

    @Test
    void testReviewDecisionEntry_shouldReturn400_whenRatingOutOfRange() {
        UUID owner = ownerId();
        var decision = journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"),
            "Rossz értékelés.", LocalDate.parse("2026-08-20"), "ctx");

        String body = putForBody("/api/journal/decision/" + decision.getId() + "/review",
            ReviewDecisionRequest.builder().outcomeRating(9).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "outcomeRating", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testReviewDecisionEntry_shouldReturn404_whenTheDecisionBelongsToSomeoneElse() {
        UUID stranger = databasePopulator.populateUser("decision-stranger@test.local");
        var foreign = journalPopulator.createDecision(stranger, LocalDate.parse("2026-07-21"),
            "Idegen döntés.", LocalDate.parse("2026-08-20"), "ctx");

        String body = putForBody("/api/journal/decision/" + foreign.getId() + "/review",
            ReviewDecisionRequest.builder().outcomeRating(3).build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertThat(body).contains("DECISION_ENTRY_NOT_FOUND");
    }
}
```

If `ApiIntegrationTest` has no `jsonHeaders(...)` helper, build the headers inline in that one test:

```java
        HttpHeaders headers = ownerAuthHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='DecisionApiIT'
```

Expected: compilation failure (`CreateDecisionEntryRequest` exists from the regenerated contract, but there is no controller) → then 404s once it compiles.

- [ ] **Step 3: Add the message code**

Append to `backend/src/main/resources/messages.properties` (next to `JOURNAL_ENTRY_NOT_FOUND` on line 83):

```properties
DECISION_ENTRY_NOT_FOUND=A döntés nem található.
```

- [ ] **Step 4: Write the event, mapper, service and controller**

`service/DecisionEntrySavedEvent.java`:

```java
package io.mrkuhne.mezo.feature.journal.service;

import java.util.UUID;

/**
 * Published after a decision is created or reviewed (bd mezo-b3pp.4). AFTER_COMMIT payload for
 * the companion embed listener: (re-)embeds the decision text — plus the outcome once reviewed —
 * into {@code memory_embedding(kind=decision)}.
 *
 * <p>No {@code userId} field, for the same reason as {@link JournalEntrySavedEvent}: mezo is
 * single-user and the listener re-reads the row by id anyway.
 */
public record DecisionEntrySavedEvent(UUID decisionId) {
}
```

`mapper/DecisionMapper.java`:

```java
package io.mrkuhne.mezo.feature.journal.mapper;

import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

/** Entity → wire. {@code contextSnapshot} is deliberately NOT mapped: the snapshot never leaves
 *  the server this slice (spec §5.4 — it exists for W3 recall, not for display). */
@Mapper(componentModel = "spring")
public interface DecisionMapper {

    DecisionEntryResponse toResponse(DecisionEntryEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

`service/DecisionService.java`:

```java
package io.mrkuhne.mezo.feature.journal.service;

import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.journal.entity.DecisionContextEnvelope;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.mapper.DecisionMapper;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Decision journal lifecycle (Phase 5 W1.4, bd mezo-b3pp.4, spec §5.4): create — freezing the
 * server's OWN context snapshot, never the client's — list newest-first, and review (rating +
 * outcome). Both writes publish {@link DecisionEntrySavedEvent} for the companion embed listener.
 * Gated {@code JOURNAL_SWITCH}, exactly like {@code JournalService}.
 *
 * <p>The assembler arrives through an {@link ObjectProvider} because it is
 * {@code @ConditionalOnProperty(COMPANION_SWITCH)}: with the companion off there is no snapshot to
 * take, and the honest record of that is an EMPTY snapshotText — not a fabricated one, and not a
 * failed decision write (IDENT-3).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")
public class DecisionService {

    private final DecisionEntryRepository repository;
    private final DecisionMapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectProvider<ContextSnapshotAssembler> contextSnapshotAssembler;
    private final CompanionProperties companionProperties;

    @Transactional
    public DecisionEntryResponse create(UUID userId, CreateDecisionEntryRequest request) {
        LocalDate decidedOn = request.getDecidedOn() == null ? LocalDate.now() : request.getDecidedOn();
        DecisionEntryEntity e = new DecisionEntryEntity();
        e.setCreatedBy(userId);
        e.setDecidedOn(decidedOn);
        e.setDecisionText(request.getDecisionText());
        e.setContextSnapshot(captureSnapshot(userId));
        e.setReviewDue(decidedOn.plusDays(companionProperties.journal().decisionReviewDays()));
        DecisionEntryEntity saved = repository.saveAndFlush(e);
        eventPublisher.publishEvent(new DecisionEntrySavedEvent(saved.getId()));
        return mapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<DecisionEntryResponse> list(UUID userId) {
        return repository.findByCreatedByAndDeletedFalseOrderByDecidedOnDescCreatedAtDesc(userId)
            .stream().map(mapper::toResponse).toList();
    }

    /**
     * Records how the decision turned out. Re-runnable on purpose (PUT semantics): refining an
     * outcome later overwrites rating/text and restamps {@code reviewedAt} — no 409, because the
     * L2 inbox's "already decided" guard protects an approval transition, not your own hindsight.
     */
    @Transactional
    public DecisionEntryResponse review(UUID userId, UUID decisionId, ReviewDecisionRequest request) {
        DecisionEntryEntity e = repository.findByIdAndCreatedByAndDeletedFalse(decisionId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("DECISION_ENTRY_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        e.setOutcomeRating(request.getOutcomeRating().shortValue());
        e.setOutcomeText(request.getOutcomeText());
        e.setReviewedAt(Instant.now());
        DecisionEntryEntity saved = repository.saveAndFlush(e);
        eventPublisher.publishEvent(new DecisionEntrySavedEvent(saved.getId()));
        return mapper.toResponse(saved);
    }

    private DecisionContextEnvelope captureSnapshot(UUID userId) {
        ContextSnapshotAssembler assembler = contextSnapshotAssembler.getIfAvailable();
        String text = assembler == null ? "" : assembler.render(userId, LocalDate.now());
        return new DecisionContextEnvelope(text, Instant.now());
    }
}
```

`controller/DecisionController.java`:

```java
package io.mrkuhne.mezo.feature.journal.controller;

import io.mrkuhne.mezo.api.controller.JournalApi;
import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.feature.journal.service.DecisionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/journal/decision surface (bd mezo-b3pp.4) — thin delegation, ownership from the principal;
 *  gated on {@code JOURNAL_SWITCH} together with the rest of the journal domain. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")
public class DecisionController implements JournalApi {

    private final DecisionService decisionService;
    private final CurrentUserId currentUserId;

    @Override
    public DecisionEntryResponse createDecisionEntry(CreateDecisionEntryRequest createDecisionEntryRequest) {
        return decisionService.create(currentUserId.get(), createDecisionEntryRequest);
    }

    @Override
    public List<DecisionEntryResponse> listDecisionEntries() {
        return decisionService.list(currentUserId.get());
    }

    @Override
    public DecisionEntryResponse reviewDecisionEntry(UUID id, ReviewDecisionRequest reviewDecisionRequest) {
        return decisionService.review(currentUserId.get(), id, reviewDecisionRequest);
    }
}
```

**Trap:** the generator emits ONE `JournalApi` interface for the whole `Journal` tag, and a Spring `@RestController` implementing it must implement every method. Two controllers cannot each implement the same interface partially. Verify how the generated interface defaults unimplemented methods (`_JournalApi` default methods returning 501 is the usual generator behavior). **If both controllers cannot coexist, fold the three decision methods into the existing `JournalController` instead** (delegating to `DecisionService`), delete `DecisionController`, and note it in the docs task — do not split the tag in the contract.

- [ ] **Step 5: Run the IT to verify it passes**

```bash
cd backend && ./mvnw clean test -Dtest='DecisionApiIT'
```

Expected: PASS (7 tests).

- [ ] **Step 6: Extend the switch-off IT**

Add to `backend/src/test/java/io/mrkuhne/mezo/feature/journal/JournalSwitchOffIT.java` (mirroring its existing journal assertions — reuse whatever assert helper the class already uses for "the surface is gone"):

```java
    @Test
    void testCreateDecisionEntry_shouldReturn404_whenTheJournalFeatureIsOff() {
        postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder().decisionText("Nem lesz mentve.").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testListDecisionEntries_shouldReturn404_whenTheJournalFeatureIsOff() {
        getForBody("/api/journal/decision", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
```

- [ ] **Step 7: Run the switch-off IT**

```bash
cd backend && ./mvnw clean test -Dtest='JournalSwitchOffIT'
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src && git commit -m "feat(journal): decision capture with server-frozen context snapshot + review (mezo-b3pp.4)"
```

---

### Task 3: Embed the decision (and its outcome) into memory

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java:44-47`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/DecisionEmbeddingListener.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/journal/DecisionEmbeddingEventIT.java`

**Interfaces:**
- Consumes: `DecisionEntrySavedEvent`, `DecisionEntryRepository`, `MemoryEmbeddingRepository.findByKindAndRefId`, the existing private `MemoryEmbeddingWriter.write(...)`/`cap(...)`.
- Produces: `MemoryEmbeddingEntity.KIND_DECISION = "decision"`; `MemoryEmbeddingWriter.writeDecision(DecisionEntryEntity)`.

The `ck_memory_embedding_kind` CHECK **already allows `'decision'`** (`202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`) — no migration in this task.

- [ ] **Step 1: Write the failing embed IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/journal/DecisionEmbeddingEventIT.java`:

```java
package io.mrkuhne.mezo.feature.journal;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Acceptance test for the W1.4 decision embed pipeline (bd mezo-b3pp.4, spec §5.4): a created
 * decision yields exactly ONE {@code memory_embedding(kind=decision)} row, and reviewing it
 * re-embeds the SAME row with the outcome folded in — the outcome is the valuable half.
 * {@code JournalEmbeddingEventIT}'s idiom: not {@code @Transactional}, Awaitility for the async hop.
 */
@ActiveProfiles("companion-fake")
class DecisionEmbeddingEventIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testCreateDecisionEntry_shouldProduceExactlyOneEmbedding_whenCommitted() {
        UUID owner = ownerId();

        DecisionEntryResponse created = postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder()
                .decisionText("Esti edzésre váltok a reggeli helyett.")
                .decidedOn(LocalDate.parse("2026-08-20"))
                .build(),
            ownerAuthHeaders(), HttpStatus.CREATED, DecisionEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            var rows = memoryEmbeddingRepository.findAll().stream()
                .filter(r -> r.getCreatedBy().equals(owner))
                .filter(r -> MemoryEmbeddingEntity.KIND_DECISION.equals(r.getKind()))
                .toList();
            assertThat(rows).hasSize(1);
            assertThat(rows.getFirst().getRefId()).isEqualTo(created.getId());
            assertThat(rows.getFirst().getContent()).isEqualTo("Esti edzésre váltok a reggeli helyett.");
            assertThat(rows.getFirst().getOccurredOn()).isEqualTo(LocalDate.parse("2026-08-20"));
        });
    }

    @Test
    void testReviewDecisionEntry_shouldReembedTheSameRowWithTheOutcome_whenReviewed() {
        UUID owner = ownerId();

        DecisionEntryResponse created = postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder()
                .decisionText("Esti edzésre váltok a reggeli helyett.")
                .decidedOn(LocalDate.parse("2026-08-20"))
                .build(),
            ownerAuthHeaders(), HttpStatus.CREATED, DecisionEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_DECISION, created.getId())).isPresent());
        UUID rowIdBefore = memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_DECISION, created.getId()).orElseThrow().getId();

        putForBody("/api/journal/decision/" + created.getId() + "/review",
            ReviewDecisionRequest.builder().outcomeRating(4).outcomeText("Jobban aludtam tőle.").build(),
            ownerAuthHeaders(), HttpStatus.OK, DecisionEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            var row = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_DECISION, created.getId()).orElseThrow();
            assertThat(row.getId()).isEqualTo(rowIdBefore);
            assertThat(row.getContent()).contains("Esti edzésre váltok a reggeli helyett.");
            assertThat(row.getContent()).contains("Jobban aludtam tőle.");
            assertThat(row.getContent()).contains("4/5");
        });
        assertThat(memoryEmbeddingRepository.findAll().stream()
            .filter(r -> r.getCreatedBy().equals(owner))
            .filter(r -> MemoryEmbeddingEntity.KIND_DECISION.equals(r.getKind()))).hasSize(1);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='DecisionEmbeddingEventIT'
```

Expected: compilation failure — `MemoryEmbeddingEntity.KIND_DECISION` does not exist.

- [ ] **Step 3: Add the kind constant and the writer method**

In `MemoryEmbeddingEntity.java`, next to the other `KIND_*` constants:

```java
    public static final String KIND_DECISION = "decision";
```

In `MemoryEmbeddingWriter.java`, after `deleteJournalEmbedding`, add (and import `DecisionEntryEntity`):

```java
    /**
     * W1.4 decision unit (spec §5.4): the decision text on create, and — once reviewed — the same
     * text plus its outcome, re-embedded IN PLACE on the live {@code (kind, ref_id)} row. The
     * outcome is the half worth recalling ("what did I decide, and did it work"), which is why a
     * review re-embeds instead of leaving the create-time vector standing.
     */
    @Transactional
    public void writeDecision(DecisionEntryEntity decision) {
        String content = decisionContent(decision);
        memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_DECISION, decision.getId())
                .ifPresentOrElse(existing -> {
                    String capped = cap(content);
                    float[] vector = llmCallContextHolder.runWith(
                            new LlmCallContext("embed_memory", "document",
                                    MemoryEmbeddingEntity.KIND_DECISION, decision.getId()),
                            () -> embeddingPort.embedDocuments(List.of(capped))).getFirst();
                    existing.setContent(capped);
                    existing.setEmbedding(vector);
                    existing.setOccurredOn(decision.getDecidedOn());
                    memoryEmbeddingRepository.saveAndFlush(existing);
                }, () -> write(decision.getCreatedBy(), MemoryEmbeddingEntity.KIND_DECISION,
                        decision.getId(), content, decision.getDecidedOn()));
    }

    private static String decisionContent(DecisionEntryEntity decision) {
        if (decision.getOutcomeRating() == null) {
            return decision.getDecisionText();
        }
        String outcome = decision.getOutcomeText() == null ? "" : " " + decision.getOutcomeText();
        return decision.getDecisionText()
                + "\n\nKimenet (" + decision.getOutcomeRating() + "/5):" + outcome;
    }
```

- [ ] **Step 4: Write the listener**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/DecisionEmbeddingListener.java`:

```java
package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.DecisionEntrySavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The W1.4 post-commit decision embed trigger ({@link JournalEmbeddingListener}'s idiom): after a
 * decision is created or reviewed, keep its {@code memory_embedding(kind=decision)} vector in
 * sync asynchronously. Gated on BOTH the companion and the journal switch, so flipping either off
 * removes the bean and no decision embed call can happen. Failures are logged and swallowed —
 * memory building must never affect a decision write.
 *
 * <p>Only the create-then-fast-review race needs handling here: two AFTER_COMMIT handlers for the
 * same decision can run concurrently on Boot's multi-threaded task executor, both take the insert
 * branch, and the loser hits {@code uq_memory_embedding_kind_ref_id}. It is retried once after a
 * re-read, so the retry takes the update-in-place branch on the winner's row and embeds the LATEST
 * state. There is no delete path for decisions (the surface offers no delete), which is why this
 * listener carries no delete-race re-check.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.JOURNAL_SWITCH},
        havingValue = "true")
public class DecisionEmbeddingListener {

    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final DecisionEntryRepository decisionEntryRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDecisionEntrySaved(DecisionEntrySavedEvent event) {
        try {
            DecisionEntryEntity decision =
                    decisionEntryRepository.findById(event.decisionId()).orElse(null);
            if (decision == null) {
                return;
            }
            try {
                memoryEmbeddingWriter.writeDecision(decision);
            } catch (DataIntegrityViolationException raceLost) {
                DecisionEntryEntity latest =
                        decisionEntryRepository.findById(event.decisionId()).orElse(null);
                if (latest != null) {
                    memoryEmbeddingWriter.writeDecision(latest);
                }
            }
        } catch (Exception e) {
            log.warn("Decision embedding failed for decision {}", event.decisionId(), e);
        }
    }
}
```

- [ ] **Step 5: Run the IT to verify it passes**

```bash
cd backend && ./mvnw clean test -Dtest='DecisionEmbeddingEventIT'
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src && git commit -m "feat(companion): embed decisions and their outcomes into memory (mezo-b3pp.4)"
```

---

### Task 4: `decision_review` notification category + anchor

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/NotificationCategory.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/config/NotificationProperties.java`
- Modify: `backend/src/main/resources/application.yml` (under `mezo.notification`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/NotificationCategoryTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AnchorResolverDecisionIT.java`

**Interfaces:**
- Consumes: `DecisionEntryRepository.findByCreatedByAndReviewDueAndReviewedAtIsNullAndDeletedFalse`, `AnchorSet.AnchoredEvent`, `NotificationProperties`.
- Produces: `NotificationCategory.DECISION_REVIEW` (key `decision_review`, defaultEnabled `true`, lead `0`, feWritten `false`); `NotificationProperties.decisionReviewTime()`.

- [ ] **Step 1: Write the failing anchor IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AnchorResolverDecisionIT.java` — mirror `AnchorResolverIT`'s setup exactly (it creates its OWN owner rather than the demodata one; copy that idiom including any `@TestPropertySource`/`@Autowired` fields it declares):

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** decision_review anchoring (bd mezo-b3pp.4, spec §5.4): the push exists on the due day only,
 *  and only while the decision is still unreviewed. */
class AnchorResolverDecisionIT extends AbstractIntegrationTest {

    private static final LocalDate DUE_DAY = LocalDate.parse("2026-08-20");

    @Autowired private AnchorResolver anchorResolver;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private DecisionEntryRepository decisionEntryRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testResolve_shouldYieldADecisionReviewAnchor_whenAnUnreviewedDecisionIsDueThatDay() {
        UUID owner = userPopulator.createUser("anchor-decision-due@test.local").getId();
        journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"),
            "Esti edzésre váltok a reggeli helyett.", DUE_DAY, "ctx");

        AnchorSet anchors = anchorResolver.resolve(owner, DUE_DAY);

        assertThat(anchors.backendAnchors())
            .filteredOn(e -> e.category() == NotificationCategory.DECISION_REVIEW)
            .singleElement()
            .satisfies(e -> {
                assertThat(e.minuteOfDay()).isEqualTo(9 * 60);
                assertThat(e.title()).isNotBlank();
                assertThat(e.body()).contains("Esti edzésre váltok");
                assertThat(e.url()).isEqualTo("/me/naplo");
            });
    }

    @Test
    void testResolve_shouldYieldNoDecisionReviewAnchor_whenTheDecisionIsAlreadyReviewed() {
        UUID owner = userPopulator.createUser("anchor-decision-done@test.local").getId();
        DecisionEntryEntity decision = journalPopulator.createDecision(owner,
            LocalDate.parse("2026-07-21"), "Már átnéztem.", DUE_DAY, "ctx");
        decision.setReviewedAt(Instant.parse("2026-08-19T18:00:00Z"));
        decision.setOutcomeRating((short) 4);
        decisionEntryRepository.saveAndFlush(decision);

        AnchorSet anchors = anchorResolver.resolve(owner, DUE_DAY);

        assertThat(anchors.backendAnchors())
            .noneMatch(e -> e.category() == NotificationCategory.DECISION_REVIEW);
    }

    @Test
    void testResolve_shouldYieldNoDecisionReviewAnchor_whenTheDueDayHasPassed() {
        UUID owner = userPopulator.createUser("anchor-decision-overdue@test.local").getId();
        journalPopulator.createDecision(owner, LocalDate.parse("2026-07-01"),
            "Régóta esedékes.", LocalDate.parse("2026-08-01"), "ctx");

        AnchorSet anchors = anchorResolver.resolve(owner, DUE_DAY);

        // Deliberate: the /me/naplo chip carries an overdue decision, not a push that nags daily.
        assertThat(anchors.backendAnchors())
            .noneMatch(e -> e.category() == NotificationCategory.DECISION_REVIEW);
    }

    @Test
    void testResolve_shouldYieldOneAnchorPerDecision_whenTwoAreDueTheSameDay() {
        UUID owner = userPopulator.createUser("anchor-decision-two@test.local").getId();
        journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"), "Egyik.", DUE_DAY, "ctx");
        journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"), "Másik.", DUE_DAY, "ctx");

        AnchorSet anchors = anchorResolver.resolve(owner, DUE_DAY);

        var decisionAnchors = anchors.backendAnchors().stream()
            .filter(e -> e.category() == NotificationCategory.DECISION_REVIEW).toList();
        assertThat(decisionAnchors).hasSize(2);
        // Distinct dedup suffixes, or push_log's day-scoped dedup would collapse them into one push.
        assertThat(decisionAnchors).extracting(AnchorSet.AnchoredEvent::dedupSuffix)
            .doesNotHaveDuplicates();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -Dtest='AnchorResolverDecisionIT'
```

Expected: compilation failure — `NotificationCategory.DECISION_REVIEW` does not exist.

- [ ] **Step 3: Add the category**

In `NotificationCategory.java`, append after `MEMORY` (keep declaration order = render order; move the `;` accordingly):

```java
    /** Anchor: {@code mezo.notification.decision-review-time} on a decision's own {@code review_due}
     *  day, while it is still unreviewed (Phase 5 W1.4, bd mezo-b3pp.4). */
    DECISION_REVIEW("decision_review", true, 0, false);
```

Update the class javadoc's "20 push-notification categories" count to 21.

- [ ] **Step 4: Add the fixed morning slot property**

In `NotificationProperties.java`, add a parameter (and its `@param` javadoc line):

```java
        @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String decisionReviewTime,
```

with javadoc:

```
 * @param decisionReviewTime the fixed HH:mm the {@code decision_review} category anchors on — a
 *     decision's review has no time of its own, only a due DATE (spec §5.4)
```

In `backend/src/main/resources/application.yml`, under `mezo.notification` (next to `medication-time`):

```yaml
      decision-review-time: "09:00"
```

- [ ] **Step 5: Add the anchor to `AnchorResolver`**

Add the constant, the repository field, the `resolve` call and the method:

```java
    private static final String URL_JOURNAL = "/me/naplo";
```

```java
    private final DecisionEntryRepository decisionEntryRepository;
```

In `resolve(...)`, after `ritualFamilyAnchors(owner, date, backendAnchors);`:

```java
        backendAnchors.addAll(decisionReviewAnchors(owner, date));
```

And the method, next to `medicationAnchor`:

```java
    // ---- decision_review (decision_entry.review_due, W1.4) --------------------------------------

    /**
     * One anchor per decision whose {@code review_due} is EXACTLY {@code date} and that is still
     * unreviewed. Deliberately not {@code review_due <= date}: an overdue decision is carried by
     * the /me/naplo chip, never by a push that would then re-fire every morning forever.
     *
     * <p>The dedup suffix carries the decision's id fragment (the feed-anchor shape) because two
     * decisions can fall due on the same day at the same fixed minute — a bare {@code HH:mm} would
     * collapse them into a single push through {@code push_log}'s day-scoped dedup.
     */
    private List<AnchoredEvent> decisionReviewAnchors(UUID owner, LocalDate date) {
        String time = notificationProperties.decisionReviewTime();
        return decisionEntryRepository
                .findByCreatedByAndReviewDueAndReviewedAtIsNullAndDeletedFalse(owner, date)
                .stream()
                .map(decision -> new AnchoredEvent(NotificationCategory.DECISION_REVIEW,
                        minuteOfDay(time), time + ":" + decision.getId().toString().substring(0, 8),
                        "Hogyan sült el?", excerptProse(decision.getDecisionText()), URL_JOURNAL))
                .toList();
    }
```

- [ ] **Step 6: Update the category catalog test**

In `NotificationCategoryTest.java`: append `"decision_review"` to the expected key list in `testValues_shouldMatchTheSpecCatalog_whenListed`, and bump the default-enabled count assertion (16 → 17) in `testDefaultEnabled_shouldBeSixteenSpecDefaults_whenFiltered` — rename that method to `…shouldBeSeventeenSpecDefaults…` to keep the name honest.

- [ ] **Step 7: Run the notification tests**

```bash
cd backend && ./mvnw clean test -Dtest='AnchorResolverDecisionIT,NotificationCategoryTest,AnchorResolverIT,DueEvaluatorTest,NotificationDispatchJobIT,NotificationPrefApiIT'
```

Expected: PASS. If `NotificationPrefApiIT`/`NotificationApiIT` assert a category count or full list, update those expectations too.

- [ ] **Step 8: Commit**

```bash
git add backend/src && git commit -m "feat(notification): decision_review category anchored on the review-due day (mezo-b3pp.4)"
```

---

### Task 5: Frontend data layer for decisions

**Files:**
- Create: `frontend/src/data/journal/decisionTypes.ts`
- Create: `frontend/src/data/journal/decisionApi.ts`
- Create: `frontend/src/data/journal/decisionMock.ts`
- Create: `frontend/src/data/journal/decisionHooks.ts`
- Test: `frontend/src/data/journal/decisionHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts:61`

**Interfaces:**
- Consumes: `apiFetch`, `paths` from `@/data/_client/api.gen`, `useDualQuery`, `isMockMode`, `localDateString`.
- Produces: `DecisionEntry { id, decidedOn, decisionText, reviewDue, reviewedAt: string | null, outcomeRating: number | null, outcomeText: string | null, createdAt }`; `useDecisions(): { data: DecisionEntry[]; isPending; isError; refetch }`; `useDecisionActions(): { addDecision(decisionText, decidedOn?); reviewDecision(id, outcomeRating, outcomeText?); pending }`; `isDecisionDue(d: DecisionEntry, todayIso: string): boolean`.

- [ ] **Step 1: Write the failing hook test**

Create `frontend/src/data/journal/decisionHooks.test.tsx` — follow `journalHooks.test.tsx`'s harness exactly (same `QueryClientProvider` wrapper, same mock-mode toggling idiom; copy its imports and helpers rather than inventing new ones):

```tsx
import { describe, expect, it } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDecisions, useDecisionActions, isDecisionDue } from '@/data/journal/decisionHooks'

describe('isDecisionDue', () => {
  it('is due when unreviewed and reviewDue is today or past', () => {
    const base = { id: 'd1', decidedOn: '2026-07-21', decisionText: 'x', createdAt: '2026-07-21T10:00:00Z' }
    expect(isDecisionDue({ ...base, reviewDue: '2026-08-20', reviewedAt: null, outcomeRating: null, outcomeText: null }, '2026-08-20')).toBe(true)
    expect(isDecisionDue({ ...base, reviewDue: '2026-08-01', reviewedAt: null, outcomeRating: null, outcomeText: null }, '2026-08-20')).toBe(true)
    expect(isDecisionDue({ ...base, reviewDue: '2026-09-01', reviewedAt: null, outcomeRating: null, outcomeText: null }, '2026-08-20')).toBe(false)
    expect(isDecisionDue({ ...base, reviewDue: '2026-08-01', reviewedAt: '2026-08-02T10:00:00Z', outcomeRating: 4, outcomeText: null }, '2026-08-20')).toBe(false)
  })
})

describe('useDecisions (mock mode)', () => {
  it('seeds decisions newest-first', async () => {
    const { result } = renderHook(() => useDecisions(), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data.length).toBeGreaterThan(0)
    const days = result.current.data.map((d) => d.decidedOn)
    expect([...days].sort().reverse()).toEqual(days)
  })

  it('adds a decision into the cached list', async () => {
    const list = renderHook(() => useDecisions(), { wrapper })
    await waitFor(() => expect(list.result.current.isPending).toBe(false))
    const before = list.result.current.data.length
    const actions = renderHook(() => useDecisionActions(), { wrapper })
    await act(async () => { await actions.result.current.addDecision('Új döntés.', '2026-08-20') })
    await waitFor(() => expect(list.result.current.data.length).toBe(before + 1))
  })

  it('review stamps rating and reviewedAt on the cached row', async () => {
    const list = renderHook(() => useDecisions(), { wrapper })
    await waitFor(() => expect(list.result.current.isPending).toBe(false))
    const openOne = list.result.current.data.find((d) => d.reviewedAt === null)!
    const actions = renderHook(() => useDecisionActions(), { wrapper })
    await act(async () => { await actions.result.current.reviewDecision(openOne.id, 4, 'Bejött.') })
    await waitFor(() => {
      const updated = list.result.current.data.find((d) => d.id === openOne.id)!
      expect(updated.outcomeRating).toBe(4)
      expect(updated.reviewedAt).not.toBeNull()
    })
  })
})
```

The `wrapper` must be the same one `journalHooks.test.tsx` defines — reuse its exact shape (a `QueryClientProvider` around children) so the two files agree.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test decisionHooks
```

Expected: FAIL — cannot resolve `@/data/journal/decisionHooks`.

- [ ] **Step 3: Write types, api, mock**

`frontend/src/data/journal/decisionTypes.ts`:

```ts
/** One recorded decision with its review loop (Journal W1.4, mezo-b3pp.4). The server-frozen
 * context snapshot deliberately never crosses the wire — it exists for the companion's recall,
 * not for display. */
export interface DecisionEntry {
  id: string
  decidedOn: string
  decisionText: string
  /** decidedOn + the backend's decision-review-days; server-computed, never derived here. */
  reviewDue: string
  reviewedAt: string | null
  outcomeRating: number | null
  outcomeText: string | null
  createdAt: string
}
```

`frontend/src/data/journal/decisionApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

type DecisionListResponse = paths['/api/journal/decision']['get']['responses']['200']['content']['application/json']
type DecisionWire = DecisionListResponse[number]
type DecisionCreateBody = paths['/api/journal/decision']['post']['requestBody']['content']['application/json']
type DecisionReviewBody =
  paths['/api/journal/decision/{id}/review']['put']['requestBody']['content']['application/json']

export function toDecisionEntry(w: DecisionWire): DecisionEntry {
  return {
    id: w.id,
    decidedOn: w.decidedOn,
    decisionText: w.decisionText,
    reviewDue: w.reviewDue,
    reviewedAt: w.reviewedAt ?? null,
    outcomeRating: w.outcomeRating ?? null,
    outcomeText: w.outcomeText ?? null,
    createdAt: w.createdAt,
  }
}

export const decisionApi = {
  list: (): Promise<DecisionEntry[]> =>
    apiFetch<DecisionListResponse>('/api/journal/decision').then((rows) => rows.map(toDecisionEntry)),
  create: (decisionText: string, decidedOn?: string): Promise<DecisionEntry> =>
    apiFetch<DecisionWire>('/api/journal/decision', {
      method: 'POST',
      body: JSON.stringify({ decisionText, decidedOn } satisfies DecisionCreateBody),
    }).then(toDecisionEntry),
  review: (id: string, outcomeRating: number, outcomeText?: string): Promise<DecisionEntry> =>
    apiFetch<DecisionWire>(`/api/journal/decision/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ outcomeRating, outcomeText } satisfies DecisionReviewBody),
    }).then(toDecisionEntry),
}
```

`frontend/src/data/journal/decisionMock.ts`:

```ts
import type { DecisionEntry } from '@/data/journal/decisionTypes'

/** Mock seed: one decision due for review, one still ripening, one already reviewed — so the
 * /me/naplo decisions block renders all three states in mock mode. */
export const mockDecisions: DecisionEntry[] = [
  {
    id: 'dec3',
    decidedOn: '2026-08-18',
    decisionText: 'Szeptembertől heti négy edzésre váltok háromról.',
    reviewDue: '2026-09-17',
    reviewedAt: null,
    outcomeRating: null,
    outcomeText: null,
    createdAt: '2026-08-18T20:10:00Z',
  },
  {
    id: 'dec2',
    decidedOn: '2026-07-21',
    decisionText: 'Esti edzésre váltok a reggeli helyett, mert reggel sosem alszom eleget.',
    reviewDue: '2026-08-20',
    reviewedAt: null,
    outcomeRating: null,
    outcomeText: null,
    createdAt: '2026-07-21T21:30:00Z',
  },
  {
    id: 'dec1',
    decidedOn: '2026-06-10',
    decisionText: 'Kihagyom a nyári versenyt, és inkább alapozok.',
    reviewDue: '2026-07-10',
    reviewedAt: '2026-07-11T08:00:00Z',
    outcomeRating: 4,
    outcomeText: 'Jó döntés volt, ősszel sokkal frissebb voltam.',
    createdAt: '2026-06-10T19:00:00Z',
  },
]
```

- [ ] **Step 4: Write the hooks**

`frontend/src/data/journal/decisionHooks.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { decisionApi } from '@/data/journal/decisionApi'
import { mockDecisions } from '@/data/journal/decisionMock'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

const DECISIONS_KEY = ['decisions'] as const

/** A decision is "due" once its review date has arrived and it has not been reviewed yet.
 * `<=` on ISO date strings is a correct chronological comparison and needs no Date parsing. */
export function isDecisionDue(decision: DecisionEntry, todayIso: string): boolean {
  return decision.reviewedAt === null && decision.reviewDue <= todayIso
}

export function useDecisions(): {
  data: DecisionEntry[]
  isPending: boolean
  isError: boolean
  refetch: () => void
} {
  return useDualQuery<DecisionEntry[]>({
    queryKey: [...DECISIONS_KEY],
    mockData: mockDecisions,
    realFetch: () => decisionApi.list(),
    realEmpty: [],
  })
}

export function useDecisionActions(): {
  addDecision: (decisionText: string, decidedOn?: string) => Promise<DecisionEntry>
  reviewDecision: (id: string, outcomeRating: number, outcomeText?: string) => Promise<DecisionEntry>
  pending: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()

  const addM = useMutation({
    mutationFn: async (input: { decisionText: string; decidedOn?: string }): Promise<DecisionEntry> => {
      if (mock) {
        const decidedOn = input.decidedOn ?? localDateString()
        // The mock horizon mirrors the backend default (30 days) — a mock-only constant, never a
        // second source of truth for the real reviewDue, which the server always computes.
        const due = new Date(`${decidedOn}T00:00:00`)
        due.setDate(due.getDate() + 30)
        const decision: DecisionEntry = {
          id: `dec-m-${Date.now()}`,
          decidedOn,
          decisionText: input.decisionText,
          reviewDue: due.toISOString().slice(0, 10),
          reviewedAt: null,
          outcomeRating: null,
          outcomeText: null,
          createdAt: new Date().toISOString(),
        }
        qc.setQueryData<DecisionEntry[]>([...DECISIONS_KEY], (d) =>
          [decision, ...(d ?? [])].sort((a, b) => (a.decidedOn < b.decidedOn ? 1 : -1)),
        )
        return decision
      }
      return decisionApi.create(input.decisionText, input.decidedOn)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: [...DECISIONS_KEY] }),
  })

  const reviewM = useMutation({
    mutationFn: async (input: {
      id: string
      outcomeRating: number
      outcomeText?: string
    }): Promise<DecisionEntry> => {
      if (mock) {
        let updated: DecisionEntry | undefined
        qc.setQueryData<DecisionEntry[]>([...DECISIONS_KEY], (d) =>
          (d ?? []).map((row) => {
            if (row.id !== input.id) return row
            updated = {
              ...row,
              outcomeRating: input.outcomeRating,
              outcomeText: input.outcomeText ?? null,
              reviewedAt: new Date().toISOString(),
            }
            return updated
          }),
        )
        return updated!
      }
      return decisionApi.review(input.id, input.outcomeRating, input.outcomeText)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: [...DECISIONS_KEY] }),
  })

  return {
    addDecision: (decisionText: string, decidedOn?: string) => addM.mutateAsync({ decisionText, decidedOn }),
    reviewDecision: (id: string, outcomeRating: number, outcomeText?: string) =>
      reviewM.mutateAsync({ id, outcomeRating, outcomeText }),
    pending: addM.isPending || reviewM.isPending,
  }
}
```

Add to `frontend/src/data/hooks.ts` next to the journal line:

```ts
export { useDecisions, useDecisionActions, isDecisionDue } from '@/data/journal/decisionHooks'
```

- [ ] **Step 5: Run the tests both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test decisionHooks && pnpm test decisionHooks
```

Expected: PASS in both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data && git commit -m "feat(journal): decision data layer with dual-mode hooks (mezo-b3pp.4)"
```

---

### Task 6: „Döntés" capture mode in `JournalSheet`

**Files:**
- Modify: `frontend/src/features/me/sheets/JournalSheet.tsx`
- Modify: `frontend/src/features/me/sheets/JournalSheet.test.tsx`

**Interfaces:**
- Consumes: `useDecisionActions` from `@/data/hooks` (Task 5).
- Produces: no new exports — `JournalSheet`'s props are unchanged; the mode toggle is internal state, rendered only in create mode (`entry == null`).

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/features/me/sheets/JournalSheet.test.tsx` (reuse the file's existing render helper and mock-mode wrapper):

```tsx
  it('offers a Döntés mode in create mode and saves through the decision hook', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole('button', { name: 'Döntés' }))
    expect(screen.getByText(/visszanézzük/i)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /Döntés/i }), 'Esti edzésre váltok.')
    await user.click(screen.getByRole('button', { name: 'Mentem' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('hides the mode toggle when editing an existing note', () => {
    renderSheet({ entry: { id: 'jn1', occurredOn: '2026-08-15', text: 'Régi.', source: 'quickinput', createdAt: '2026-08-15T08:00:00Z' } })

    expect(screen.queryByRole('button', { name: 'Döntés' })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test JournalSheet
```

Expected: FAIL — no „Döntés" button.

- [ ] **Step 3: Implement the mode toggle**

In `JournalSheet.tsx`:

```tsx
import { useDecisionActions, useJournalActions } from '@/data/hooks'

type Mode = 'note' | 'decision'
```

Inside the component, next to the existing state:

```tsx
  const [mode, setMode] = useState<Mode>('note')
  const { addDecision, pending: decisionPending } = useDecisionActions()
  const busy = pending || decisionPending
```

Replace the `save` callback:

```tsx
  const save = (close: () => void) => {
    if (!text.trim() || busy) return
    const write =
      mode === 'decision'
        ? addDecision(text.trim(), date)
        : entry
          ? updateNote(entry.id, text.trim(), date)
          : addNote(text.trim(), date)
    void write.then(close)
  }
```

Render the toggle directly under the header, only when `!entry` (edit mode edits a note, never converts it into a decision):

```tsx
          {!entry && (
            <div className="row gap-sm" role="group" aria-label="Bejegyzés típusa" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={cn('chip', mode === 'note' && 'chip-active')}
                aria-pressed={mode === 'note'}
                onClick={() => setMode('note')}
              >
                Napló
              </button>
              <button
                type="button"
                className={cn('chip', mode === 'decision' && 'chip-active')}
                aria-pressed={mode === 'decision'}
                onClick={() => setMode('decision')}
              >
                Döntés
              </button>
            </div>
          )}
```

Make the title, the textarea's accessible name, the placeholder and the date label follow the mode, and add the horizon hint. The hint must NOT name a day count — the horizon lives in `mezo.companion.journal.decision-review-days` on the server, and hardcoding „30 nap" here would silently drift from it:

```tsx
              <div id="journal-title" className="h-display size-md" style={{ marginTop: 4 }}>
                {entry ? 'Bejegyzés szerkesztése' : mode === 'decision' ? 'Milyen döntést hoztál?' : 'Mi jár a fejedben?'}
              </div>
```

```tsx
                aria-label={mode === 'decision' ? 'Döntés' : undefined}
                aria-labelledby={mode === 'decision' ? undefined : 'journal-title'}
                placeholder={mode === 'decision' ? 'Mit döntöttél el — és miért?' : 'Írd le, mi jár a fejedben…'}
```

and directly under the card, when `mode === 'decision'`:

```tsx
            {mode === 'decision' && (
              <p className="text-tertiary" style={{ fontSize: 11 }}>
                Elmentjük, mit tudott rólad a rendszer ebben a pillanatban — és szólunk, amikor
                itt az ideje visszanézni, hogyan sült el.
              </p>
            )}
```

Also swap the „Dátum" row's label to „Döntés napja" in decision mode, and use `busy` instead of `pending` in the two button `disabled` props. If `chip-active` is not an existing class in the design system, use whatever active-chip class the codebase already uses (grep `aria-pressed` in `features/` for the idiom) — do not invent a new CSS class.

- [ ] **Step 4: Run the tests both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test JournalSheet && pnpm test JournalSheet
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/sheets && git commit -m "feat(journal): Döntés capture mode in JournalSheet (mezo-b3pp.4)"
```

---

### Task 7: Open decisions + review sheet on `/me/naplo`

**Files:**
- Create: `frontend/src/features/me/sheets/DecisionReviewSheet.tsx`
- Test: `frontend/src/features/me/sheets/DecisionReviewSheet.test.tsx`
- Modify: `frontend/src/features/me/pages/JournalPage.tsx`
- Modify: `frontend/src/features/me/pages/JournalPage.test.tsx`

**Interfaces:**
- Consumes: `useDecisions`, `useDecisionActions`, `isDecisionDue` from `@/data/hooks`; `Sheet`, `Icon`, `dayLabel`, `localDateString`.
- Produces: `DecisionReviewSheet({ decision, onClose }: { decision: DecisionEntry; onClose: () => void })`.

- [ ] **Step 1: Write the failing review-sheet test**

Create `frontend/src/features/me/sheets/DecisionReviewSheet.test.tsx` (copy the render/wrapper idiom from `JournalSheet.test.tsx`):

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DecisionReviewSheet } from '@/features/me/sheets/DecisionReviewSheet'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

const decision: DecisionEntry = {
  id: 'dec2',
  decidedOn: '2026-07-21',
  decisionText: 'Esti edzésre váltok a reggeli helyett.',
  reviewDue: '2026-08-20',
  reviewedAt: null,
  outcomeRating: null,
  outcomeText: null,
  createdAt: '2026-07-21T21:30:00Z',
}

function renderSheet(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <DecisionReviewSheet decision={decision} onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

describe('DecisionReviewSheet', () => {
  it('shows the decision text and the day it was made', () => {
    renderSheet()
    expect(screen.getByText('Esti edzésre váltok a reggeli helyett.')).toBeInTheDocument()
  })

  it('requires a rating before saving', async () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Mentem' })).toBeDisabled()
  })

  it('saves the rating and closes', async () => {
    const user = userEvent.setup()
    const onClose = renderSheet()

    await user.click(screen.getByRole('button', { name: '4' }))
    await user.type(screen.getByRole('textbox', { name: /Hogyan sült el/i }), 'Bejött.')
    await user.click(screen.getByRole('button', { name: 'Mentem' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test DecisionReviewSheet
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the review sheet**

`frontend/src/features/me/sheets/DecisionReviewSheet.tsx`:

```tsx
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useDecisionActions } from '@/data/hooks'
import { dayLabel } from '@/features/me/logic/growthJournal'
import { localDateString } from '@/shared/lib/dates'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

const RATINGS = [1, 2, 3, 4, 5] as const

interface DecisionReviewSheetProps {
  decision: DecisionEntry
  onClose: () => void
}

// The review half of the decision journal (mezo-b3pp.4): re-reads the decision as it was written,
// then records how it turned out (1-5 + optional prose). Re-openable on an already-reviewed
// decision — the backend PUT overwrites, so hindsight can be refined later.
export function DecisionReviewSheet({ decision, onClose }: DecisionReviewSheetProps) {
  const { reviewDecision, pending } = useDecisionActions()
  const [rating, setRating] = useState<number | null>(decision.outcomeRating)
  const [outcome, setOutcome] = useState(decision.outcomeText ?? '')

  const save = (close: () => void) => {
    if (rating === null || pending) return
    void reviewDecision(decision.id, rating, outcome.trim() || undefined).then(close)
  }

  return (
    <Sheet onClose={onClose} labelledBy="decision-review-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow">Döntés · {dayLabel(decision.decidedOn, localDateString())}</span>
              <div id="decision-review-title" className="h-display size-md" style={{ marginTop: 4 }}>
                Hogyan sült el?
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)' }}>{decision.decisionText}</p>
          </div>

          <div className="col gap-sm mt-lg">
            <span className="eyebrow text-tertiary">Mennyire vált be? (1–5)</span>
            <div className="row gap-sm" role="group" aria-label="Értékelés">
              {RATINGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn('chip flex-1', rating === value && 'chip-active')}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="card" style={{ padding: 10, marginTop: 8 }}>
              <textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                aria-label="Hogyan sült el — részletek"
                placeholder="Mi lett belőle? (nem kötelező)"
                style={{ width: '100%', minHeight: 90, resize: 'none', fontSize: 15, lineHeight: 1.45 }}
              />
            </div>
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
            <button
              className="cta-primary flex-1"
              onClick={() => save(close)}
              disabled={rating === null || pending}
            >
              Mentem
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Write the failing page test**

Add to `frontend/src/features/me/pages/JournalPage.test.tsx`:

```tsx
  it('lists open decisions with a due chip and opens the review sheet', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Döntések')
    const due = await screen.findByText(/Esti edzésre váltok/)
    await user.click(due)

    expect(await screen.findByText('Hogyan sült el?')).toBeInTheDocument()
  })

  it('does not list already-reviewed decisions among the open ones', async () => {
    renderPage()
    await screen.findByText('Döntések')

    expect(screen.queryByText(/Kihagyom a nyári versenyt/)).not.toBeInTheDocument()
  })
```

The mock seed's `dec2` (due 2026-08-20) and `dec3` (due 2026-09-17) are both open; `dec1` is reviewed. If the suite's frozen "today" makes `dec2` not-yet-due, the due CHIP assertion must key off whichever seed row is due — read the test file's date handling first and align the seed dates in `decisionMock.ts` if needed (both files are yours to keep consistent).

- [ ] **Step 5: Add the decisions block to `JournalPage`**

In `JournalPage.tsx`, add the imports and state:

```tsx
import { isDecisionDue, useDecisions, useJournalNotes } from '@/data/hooks'
import { DecisionReviewSheet } from '@/features/me/sheets/DecisionReviewSheet'
import type { DecisionEntry } from '@/data/journal/decisionTypes'
```

```tsx
  const [reviewing, setReviewing] = useState<DecisionEntry | null>(null)
  const { data: decisions } = useDecisions()
  const openDecisions = decisions.filter((d) => d.reviewedAt === null)
```

Render it above the notes list (inside the padded container, before the `isPending` branch) — decisions are a small, always-visible block, so an empty list simply renders nothing rather than a second ghost state:

```tsx
        {openDecisions.length > 0 && (
          <div className="col gap-sm" style={{ marginBottom: 20 }}>
            <span className="eyebrow text-tertiary">Döntések</span>
            {openDecisions.map((decision) => (
              <button
                key={decision.id}
                type="button"
                className="card"
                onClick={() => setReviewing(decision)}
                style={{ padding: 16, textAlign: 'left', width: '100%' }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
                    {dayLabel(decision.decidedOn, today)}
                  </span>
                  <span
                    className="chip"
                    style={
                      isDecisionDue(decision, today)
                        ? { background: 'var(--wash-amber)', color: 'var(--coral-deep)' }
                        : undefined
                    }
                  >
                    {isDecisionDue(decision, today) ? 'Nézd vissza' : `Visszanézés: ${decision.reviewDue}`}
                  </span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.65, marginTop: 10, color: 'var(--text-primary)' }}>
                  {decision.decisionText}
                </p>
              </button>
            ))}
          </div>
        )}
```

And next to the existing sheet mounts:

```tsx
      {reviewing && <DecisionReviewSheet decision={reviewing} onClose={() => setReviewing(null)} />}
```

- [ ] **Step 6: Run the tests both modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test JournalPage DecisionReviewSheet && pnpm test JournalPage DecisionReviewSheet
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/me && git commit -m "feat(journal): open decisions + review sheet on /me/naplo (mezo-b3pp.4)"
```

---

### Task 8: Wire the `decision_review` category into the frontend settings

**Files:**
- Modify: `frontend/src/data/types.ts:1290-1302` and the `NOTIFICATION_CATEGORY_META` map
- Modify: `frontend/src/data/notification/notificationMock.ts`
- Modify: `frontend/src/features/me/logic/notificationForecast.ts`
- Modify: `frontend/src/features/me/logic/notificationForecast.test.ts` (only if it asserts a category count)
- Modify: `frontend/src/features/me/pages/NotificationsPage.test.tsx` (only if it asserts a row count)

**Interfaces:**
- Consumes: nothing new.
- Produces: `NotificationCategoryKey` gains `'decision_review'`; `NOTIFICATION_CATEGORIES` gains it in backend declaration order (last, after `'memory'`); `NOTIFICATION_CATEGORY_META.decision_review`.

- [ ] **Step 1: Extend the key union, the order array and the meta map**

In `frontend/src/data/types.ts`, update the comment's count (20 → 21) and:

```ts
export type NotificationCategoryKey =
  | 'briefing' | 'gym' | 'medication' | 'ritual' | 'lights_out'
  | 'weekly' | 'memoir' | 'wind_down' | 'midday' | 'checkin' | 'fuel_slot'
  | 'evening' | 'sleep_reaction' | 'weight_reaction'
  | 'pattern' | 'knowledge' | 'prediction' | 'experiment' | 'challenge' | 'memory'
  | 'decision_review'
```

```ts
export const NOTIFICATION_CATEGORIES: NotificationCategoryKey[] = [
  'briefing', 'gym', 'medication', 'ritual', 'lights_out',
  'weekly', 'memoir', 'wind_down', 'midday', 'checkin', 'fuel_slot',
  'evening', 'sleep_reaction', 'weight_reaction',
  'pattern', 'knowledge', 'prediction', 'experiment', 'challenge', 'memory',
  'decision_review',
]
```

In `NOTIFICATION_CATEGORY_META` (the `brain` section is where the companion's derived-knowledge categories live):

```ts
  decision_review: {
    label: 'Döntés visszanézés', emoji: '⚖️', section: 'brain',
    description: 'Amikor egy döntésed esedékes visszanézni', showLeadChip: false, iconBg: '--wash-lav',
  },
```

- [ ] **Step 2: Add the forecast case**

In `frontend/src/features/me/logic/notificationForecast.ts`, inside `backendAnchorMinute`'s switch:

```ts
    case 'decision_review':
      // Depends on whether a decision falls due today — a fact the forecast's inputs don't carry.
      // An honest "no resolvable anchor", never a fabricated 09:00 that may not fire (same
      // contract as sleep_reaction/weight_reaction above).
      return null
```

- [ ] **Step 3: Add the mock pref row**

In `frontend/src/data/notification/notificationMock.ts`, add a `decision_review` entry alongside the other categories, matching the shape the file already uses (`{ category, enabled, leadMinutes }`), `enabled: true`, `leadMinutes: 0` — mirroring the backend default.

- [ ] **Step 4: Run the affected tests**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test notificationForecast NotificationsPage NotificationCategoryRow && pnpm test notificationForecast NotificationsPage NotificationCategoryRow
```

Expected: PASS. Any hard-coded "20 categories" expectation becomes 21.

- [ ] **Step 5: Commit**

```bash
git add frontend/src && git commit -m "feat(notification): decision_review category in the settings list (mezo-b3pp.4)"
```

---

### Task 9: Docs, full gates, ship

**Files:**
- Modify: `docs/features/journal.md`
- Modify: `docs/features/_platform-notifications.md`
- Modify: `docs/features/me.md`
- Modify: `docs/superpowers/plans/2026-08-18-phase5-roadmap.md` (mark the slice done if the file tracks per-slice status)

- [ ] **Step 1: Update `docs/features/journal.md`**

Overwrite in place — the feature docs are living, so edit the affected sections; do NOT add a changelog or a dated snapshot (CLAUDE.md's `features/` maintenance policy). Sections to touch:

- **Frontmatter:** `updated: 2026-08-20`; add to `key_files`:
  `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/DecisionService.java`,
  `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/DecisionEmbeddingListener.java`,
  `frontend/src/features/me/sheets/DecisionReviewSheet.tsx`. Add `_platform-notifications` to `related`.
- **Header blurb + §1 Summary:** the domain now holds **two** aggregates — `journal_entry` (W1.1) and `decision_entry` (W1.4) — and names both bd ids.
- **§2 User-facing behavior:** the `JournalSheet` mode toggle („Napló" / „Döntés"), the `/me/naplo` open-decisions block with its due chip, and the `DecisionReviewSheet`.
- **§4 API surface:** the three new endpoints, and explicitly that `context_snapshot` is server-captured and never returned.
- **§5/§10 (integrations / file map):** the `DecisionEntrySavedEvent` → `DecisionEmbeddingListener` → `MemoryEmbeddingWriter.writeDecision` seam with `kind=decision`, the re-embed-on-review rule, and the `decision_review` notification anchor (link to `_platform-notifications.md`).
- Record the two locked decisions a reader would otherwise re-litigate: **no delete endpoint** for decisions this slice, and **the review is re-runnable** (no 409).

- [ ] **Step 2: Update `docs/features/_platform-notifications.md`**

Add `decision_review` to the category catalog table: key `decision_review`, anchor `mezo.notification.decision-review-time` (09:00) on the decision's own `review_due` day while unreviewed, source `decision_entry`, default ON, no lead chip, deeplink `/me/naplo`. Note the `HH:mm:{id8}` dedup suffix (two decisions can be due the same day) and the deliberate due-day-only rule. Bump any "20 categories" count in the prose to 21. Set `updated: 2026-08-20`.

- [ ] **Step 3: Update `docs/features/me.md`**

In the `/me/naplo` surface description, add the decisions block and the review sheet; set `updated: 2026-08-20`.

- [ ] **Step 4: Run the docs lint**

```bash
node scripts/lint-docs.mjs
```

Expected: no new staleness, no broken links, no orphans. Fix anything it reports before moving on.

- [ ] **Step 5: Run the full focused backend gate**

```bash
cd backend && ./mvnw clean test -Dtest='Decision*IT,Journal*IT,AnchorResolver*IT,NotificationCategoryTest,DueEvaluatorTest,NotificationDispatchJobIT,NotificationPrefApiIT,NotificationApiIT'
```

Expected: all green. `docker compose up -d` must be running.

- [ ] **Step 6: Run the full frontend gate, both modes**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: build succeeds, both test modes green.

- [ ] **Step 7: Commit the docs**

```bash
git add docs && git commit -m "docs(journal): decision journal + review loop, decision_review push category (mezo-b3pp.4)"
```

- [ ] **Step 8: Ship through the house git flow**

```bash
git push -u origin feat/decision-journal
```

Then `gh pr create` (self-PR = the CI gate), `gh pr checks <PR#> --watch` until green, then from the primary repo: `git pull --rebase`, `git merge --no-ff feat/decision-journal`, `git push`. Finally `bd close mezo-b3pp.4 && bd dolt push`, and delete the branch locally + on the remote.

---

## Self-review notes

- **Spec §5.4 coverage:** `decision_entry` table (T1) · server-side `context_snapshot` via `ContextSnapshotAssembler.render` in a typed jsonb envelope, client-supplied value ignored (T2, asserted in `DecisionApiIT`) · `review_due = decided_on + journal.decisionReviewDays` (T2) · `PUT …/review` stamping `reviewed_at` (T2) · embed on create + re-embed on review with the outcome (T3) · `NotificationCategory.DECISION_REVIEW` anchored on `review_due` at a fixed morning slot, enum + anchor resolver only, no migration (T4) · FE capture in `JournalSheet` „Döntés" mode with a review-horizon hint (T6) · Me/Napló open-decision list with due chips + review sheet (T7).
- **Spec §11 coverage:** contract-first (T1 Steps 1–2) · `LlmCallContextHolder` tagging inside `MemoryEmbeddingWriter` (T3) · `ResetDatabase` + populator (T1 Step 5) · integration-first tests throughout · feature docs in the same change (T9) · dual-mode FE hooks with an honest mock seed (T5).
- **Known risk flagged in T2 Step 4:** two `@RestController`s implementing one generated `JournalApi` interface. The fallback (fold the decision methods into `JournalController`) is spelled out so the executing agent does not have to invent one.
