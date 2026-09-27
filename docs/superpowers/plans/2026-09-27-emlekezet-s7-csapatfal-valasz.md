# S7 · Csapatfal-válasz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user replies to a csapatfal ügy, the owner character answers, and a concrete
explanation closes the ügy and becomes durable knowledge. That knowledge is honoured the next
time the rule fires (silent excuse, one-tap question, capped review). Every csapatfal line then
reads the Tudástár through a real knowledge adapter.

**Architecture:** The spec is `docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md` §"S7 delta".
- **Engine.** The work stays in the character feature's `service/chat` package, in three new beans:
  - `TeamChatReplyService`: the answer pipeline.
  - `TeamChatExceptionService`: the open-time gate plus the quick answers and undo.
  - `TeamChatReplyVoiceWriter`: the LLM call.

  All three follow the existing claim (short tx) → voice (no tx) → write (short tx) shape.
- **Knowledge.** Durable knowledge is a `knowledge_fact` written via new `KnowledgeFactService`
  methods (companion, called from character; character → companion is the legal direction).
- **Contract.** The API grows in `api/feature/character/character.yml` only.
- **Frontend.** The FE extends `TeamChatPage` and the `teamChat*` data modules.

**Tech Stack:** Spring Boot 3 / Java 21 / JPA / Liquibase (PostgreSQL), OpenAPI-generated DTOs,
React + TypeScript + react-query (useDualQuery), Vitest + msw, Playwright layout specs.

## Global Constraints

- **Server-written text.** The server writes every sentence (ADR 0049); the FE composes nothing.
- **No transaction during an LLM call.** Claim → voice → write, via the `self` ObjectProvider proxy.
- **Code decides, the LLM proposes.** The close decision is a pure function of the parsed verdict plus DB state.
- **No push anywhere in the reply path.** EXCUSE and REVIEW ügyek open with `pushAllowed=false`.
- **Copy.** Every user-visible string is Hungarian, business-language, and never moralizing.
- **Visual canon.** Üveg canon, dark only. Titanium `Icon3D` sprites, never emoji in UI chrome. §3.4 ranking: one glass per surface.
- **Feature switches.** There is no new feature switch: every new bean carries the same `@ConditionalOnProperty` as the team chat beans (CHARACTER + COMPANION + PROACTIVE + INTERVENTION + TEAM_CHAT).
- **Enums.** Enum-like OpenAPI fields use `enum:`, never `pattern:` (lesson 21).
- **Contract regeneration.** The pipeline runs in order: `npm run generate:api` in `api/`, then maven generate-sources, then FE `pnpm generate:api` (lesson 22).
- **Admin label.** Every LLM slug needs an admin label (lesson 14). The `team_chat` label is missing today.
- **Backend tests.** Run with `-Dmezo.test.use-testcontainers=true` (lesson 27). Anchor fixtures to the local day (no now-minus-hours).
- **Frontend tests.** Run in both modes with `CI=true`: `VITE_USE_MOCK` unset AND `VITE_USE_MOCK=false`.
- **Defaults** (new `TeamChatProperties` fields):
  - `reply-voiced-per-thread-day: 4`
  - `reply-daily-cap: 20`
  - `exception-window-days: 30`
  - `exception-review-hits: 4` (the gate opens a REVIEW when 4 hits already sit in the window, so the 5th occurrence asks).
- **Length caps.**
  - Close tag ≤ 40 chars; fact ≤ 160 chars; keywords 1–6, each 2–24 chars, lowercase.
  - A reply is 1–2 sentences, enforced by `EditionVoiceGuard.checkGuest`, with the user's own text passed as `recordText` so its numbers are allowed.

## File map

**Backend: create**
- `backend/src/main/resources/db/changelog/1.1.0/script/202609271000_mezo-d6ivw.7_team_chat_reply.sql`: the schema delta.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/TeamChatExceptionEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/TeamChatExceptionHitEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/KeywordsEnvelope.java`: jsonb list holder.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/TeamChatExceptionRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/TeamChatExceptionHitRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatKnowledgeAdapter.java`: replaces `NoopTeamChatKnowledge`, which is deleted.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatReplyVoiceWriter.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatReplyDraft.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatReplyDecision.java`: the pure close decision.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatExceptionMatcher.java`: pure tag normalisation + keyword matching.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatRepliedEvent.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatReplyListener.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatReplyService.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatExceptionService.java`
- Tests under `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/`:
  - `TeamChatReplyDecisionTest`
  - `TeamChatExceptionMatcherTest`
  - `TeamChatReplyVoiceWriterTest`
  - `TeamChatKnowledgeAdapterIT`
  - `TeamChatReplyIT`
  - `TeamChatExceptionIT`
  - `TeamChatAnswerControllerIT`
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactTeamChatIT.java`

**Backend: modify**
- `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml`: register the script.
- `.../character/entity/TeamChatThreadEntity.java`: gains `closeReason`, `closeNote`, `offer`, `exceptionId`.
- `.../character/entity/TeamChatLineEntity.java`: the `@Pattern` gains `REPLY`.
- `.../character/repository/TeamChatLineRepository.java`: new count/find queries.
- `.../character/repository/TeamChatThreadRepository.java`: `findFirstByCreatedByAndExceptionIdAndOfferAndOpenedAtGreaterThanEqualAndDeletedFalse`.
- `.../character/config/TeamChatProperties.java` + `application.yml` `mezo.character.team-chat`: the four new fields.
- `.../character/service/chat/TeamChatService.java`:
  - `reply()` publishes the event;
  - `claimThread` consults the gate;
  - `capReached` excludes REPLY;
  - `closeThread` sets `closeReason=DATA`;
  - `writeLine` becomes package-private.
- `.../character/service/chat/TeamChatReads.java`:
  - `THREAD_BEARING` gains `REPLY`;
  - `toThread` maps the new fields plus `remembered`;
  - `toThread`'s caller passes the exception.
- `.../character/controller/CharacterController.java`: two new operations.
- `.../companion/entity/KnowledgeFactEntity.java`: `SOURCE_TEAM_CHAT`.
- `.../companion/memory/entity/MemoryProvenanceEnvelope.java`: the `teamChat(...)` factory.
- `.../companion/service/KnowledgeFactService.java`: `captureFromTeamChat`, `muteFromTeamChat`, `promptFactsForOwners`.
- `.../companion/repository/KnowledgeFactRepository.java`: the owner query.
- `.../companion/llm/FakeCompanionLlm.java`: the reply marker mirror, sentinel and answer.
- `api/feature/character/character.yml`: new fields, the `REPLY` kind, two operations, reply summary.

**Frontend**
- Modify:
  - `frontend/src/data/character/teamChatApi.ts`
  - `teamChatHooks.ts`
  - `teamChatMock.ts`
  - `frontend/src/test/msw/handlers.ts`
  - `frontend/src/features/insights/pages/TeamChatPage.tsx`
  - `frontend/src/features/insights/boop-world.css`
  - `frontend/src/features/admin/lib/labels.ts`
  - `labels.completeness.test.ts`
- Create:
  - `frontend/src/features/insights/components/teamchat/ReplyAfterlife.tsx` (typing row, close tag, remembered chip)
  - `frontend/src/features/insights/components/teamchat/OfferButtons.tsx`
  - their tests
  - `frontend/tests/layout/team-chat-reply.spec.ts`

**Docs:**
- `docs/features/character.md` §Csapat-chat
- `docs/features/insights.md` (reply row)
- `docs/superpowers/specs/2026-09-26-csapat-elo-beszelgetes-design.md` (close rule amendment)
- `docs/features/admin-hub.md` if key_files are touched
- `docs/CODEMAP.md` (regenerate)

---

### Task 1: Schema, entities, properties

**Files:**
- Create:
  - `backend/src/main/resources/db/changelog/1.1.0/script/202609271000_mezo-d6ivw.7_team_chat_reply.sql`
  - `TeamChatExceptionEntity.java`
  - `TeamChatExceptionHitEntity.java`
  - `KeywordsEnvelope.java`
  - `TeamChatExceptionRepository.java`
  - `TeamChatExceptionHitRepository.java`
- Modify:
  - `1.1.0_master.yml`
  - `TeamChatThreadEntity.java`
  - `TeamChatLineEntity.java`
  - `TeamChatLineRepository.java`
  - `TeamChatThreadRepository.java`
  - `TeamChatProperties.java`
  - `application.yml`
  - `KnowledgeFactEntity.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatRepositoryIT.java` (extend)

**Interfaces:**
- Produces:
  - Thread constants on `TeamChatService` (package-private, next to `STATUS_*`): `CLOSE_DATA="DATA"`, `CLOSE_REPLY="REPLY"`, `CLOSE_EXCUSED="EXCUSED"`, `OFFER_EXCUSE="EXCUSE"`, `OFFER_REVIEW="REVIEW"`, `KIND_REPLY="REPLY"`.
  - `TeamChatExceptionEntity` fields: `id, flagKey, ownerCharacter, contextTag, normalizedTag, keywords (KeywordsEnvelope), knowledgeFactId, sourceThreadId, sourceLineId, active (Boolean), windowStartedAt (Instant)`.
  - `TeamChatExceptionHitEntity` fields: `id, exceptionId, hitOn (LocalDate), source (NOTES|TAP|REPLY), threadId`.
  - `TeamChatExceptionRepository`:
    - `List<TeamChatExceptionEntity> findByCreatedByAndFlagKeyAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(UUID, String)`
    - `Optional<TeamChatExceptionEntity> findFirstByCreatedByAndFlagKeyAndNormalizedTagAndDeletedFalse(UUID, String, String)`
    - `Optional<TeamChatExceptionEntity> findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(UUID, UUID)`
    - `Optional<TeamChatExceptionEntity> findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`
  - `TeamChatExceptionHitRepository`:
    - `long countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(UUID, LocalDate)`
    - `boolean existsByExceptionIdAndHitOnAndDeletedFalse(UUID, LocalDate)`
    - `Optional<TeamChatExceptionHitEntity> findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(UUID, UUID, String)`
  - `TeamChatLineRepository`:
    - `long countByCreatedByAndCharacterIsNotNullAndKindNotAndOccurredAtBetweenAndDeletedFalse(UUID, String, Instant, Instant)`
    - `long countByThreadIdAndKindAndVoicedTrueAndOccurredAtBetweenAndDeletedFalse(UUID, String, Instant, Instant)`
    - `long countByCreatedByAndKindAndOccurredAtBetweenAndDeletedFalse(UUID, String, Instant, Instant)`
    - `List<TeamChatLineEntity> findByThreadIdAndDeletedFalseOrderByOccurredAtAsc(UUID)`
    - `List<TeamChatLineEntity> findByCreatedByAndKindAndOccurredAtBetweenAndDeletedFalse(UUID, String, Instant, Instant)`
  - `TeamChatProperties` new components: `int replyVoicedPerThreadDay, int replyDailyCap, int exceptionWindowDays, int exceptionReviewHits`.
  - `KnowledgeFactEntity.SOURCE_TEAM_CHAT = "team_chat"`.

- [ ] **Step 1: Write the migration**

```sql
-- S7 (mezo-d6ivw.7): the csapatfal reply — the character answers, a concrete explanation
-- closes the ügy and becomes a durable exception. Spec 2026-09-24-mezo-emlekezete-design.md §S7.
alter table team_chat_thread add column close_reason varchar(8);
alter table team_chat_thread add column close_note varchar(60);
alter table team_chat_thread add column offer varchar(8);
alter table team_chat_thread add column exception_id uuid;
update team_chat_thread set close_reason = 'DATA' where status = 'RESOLVED';
alter table team_chat_thread add constraint ck_team_chat_thread_close_reason
    check (close_reason is null or close_reason in ('DATA','REPLY','EXCUSED'));
alter table team_chat_thread add constraint ck_team_chat_thread_offer
    check (offer is null or offer in ('EXCUSE','REVIEW'));

alter table team_chat_line drop constraint ck_team_chat_line_kind;
alter table team_chat_line add constraint ck_team_chat_line_kind
    check (kind in ('OPEN','GUEST','RESOLVE','SKEPTIC','USER','REPLY'));

create table team_chat_exception (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    flag_key varchar(24) not null,
    owner_character varchar(16) not null,
    context_tag varchar(40) not null,
    normalized_tag varchar(40) not null,
    keywords jsonb not null,
    knowledge_fact_id uuid,
    source_thread_id uuid,
    source_line_id uuid,
    active boolean not null default true,
    window_started_at timestamptz not null,
    created_at timestamptz not null default now(),
    is_deleted boolean not null default false,
    constraint pk_team_chat_exception_id primary key (id),
    constraint fk_team_chat_exception_created_by foreign key (created_by) references app_user(id) on delete cascade,
    constraint fk_team_chat_exception_source_thread_id foreign key (source_thread_id) references team_chat_thread(id)
);
-- One row per (user, rule, tag) ever: an inactive row is the durable veto (never re-captured).
create unique index uq_team_chat_exception_tag on team_chat_exception (created_by, flag_key, normalized_tag)
    where is_deleted = false;

alter table team_chat_thread add constraint fk_team_chat_thread_exception_id
    foreign key (exception_id) references team_chat_exception(id);

create table team_chat_exception_hit (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    exception_id uuid not null,
    hit_on date not null,
    source varchar(8) not null,
    thread_id uuid,
    created_at timestamptz not null default now(),
    is_deleted boolean not null default false,
    constraint pk_team_chat_exception_hit_id primary key (id),
    constraint fk_team_chat_exception_hit_created_by foreign key (created_by) references app_user(id) on delete cascade,
    constraint fk_team_chat_exception_hit_exception_id foreign key (exception_id) references team_chat_exception(id),
    constraint ck_team_chat_exception_hit_source check (source in ('NOTES','TAP','REPLY'))
);
create unique index uq_team_chat_exception_hit_day on team_chat_exception_hit (exception_id, hit_on)
    where is_deleted = false;

alter table knowledge_fact drop constraint ck_knowledge_fact_source;
alter table knowledge_fact add constraint ck_knowledge_fact_source
    check (source in ('chat','pattern','manual','weekly_review','question','team_chat'));
```

Before writing the last statement, open the latest `ck_knowledge_fact_source` script
(`grep -rn ck_knowledge_fact_source backend/src/main/resources/db/changelog | tail -3`) and
copy its CURRENT list verbatim, then add `'team_chat'`. S6 may have widened it on main
meanwhile: rebase first, and if S6 added a value, keep it. Run
`node scripts/lint-liquibase.mjs` for naming.

Register it at the END of `1.1.0_master.yml`:

```yaml
  - changeSet:
      id: "1.1.0:202609271000_mezo-d6ivw.7_team_chat_reply"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609271000_mezo-d6ivw.7_team_chat_reply.sql
```

- [ ] **Step 2: Entities + envelope**

`KeywordsEnvelope`:

```java
package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** S7 (mezo-d6ivw.7): an exception's lowercase match stems, stored as jsonb. */
public record KeywordsEnvelope(List<String> keywords) {
    public KeywordsEnvelope {
        keywords = keywords == null ? List.of() : List.copyOf(keywords);
    }
}
```

`TeamChatExceptionEntity` copies the `TeamChatThreadEntity` shape: `@Entity @Table(name = "team_chat_exception")`, `extends OwnedEntity`, Lombok `@Getter @Setter`. The column annotations mirror the SQL above:
- `keywords` is `@JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)`;
- `active` is `@NotNull Boolean active = true`.

`TeamChatExceptionHitEntity` uses the same shape; `source` gets `@Pattern(regexp = "NOTES|TAP|REPLY")`.

In `TeamChatThreadEntity`, append:

```java
    /** S7: why a RESOLVED ügy closed — DATA (a clear), REPLY (the user's explanation), EXCUSED
     *  (a known exception confirmed). Null while OPEN and on EXPIRED. */
    @Size(max = 8)
    @Pattern(regexp = "DATA|REPLY|EXCUSED")
    @Column(name = "close_reason", length = 8)
    private String closeReason;

    /** S7: the short context tag shown as „Falat lezárta: meccsnap". */
    @Size(max = 60)
    @Column(name = "close_note", length = 60)
    private String closeNote;

    /** S7: EXCUSE (the known-exception question) or REVIEW (the capped re-check); null otherwise. */
    @Size(max = 8)
    @Pattern(regexp = "EXCUSE|REVIEW")
    @Column(length = 8)
    private String offer;

    @Column(name = "exception_id", columnDefinition = "uuid")
    private UUID exceptionId;
```

In `TeamChatLineEntity`, set `@Pattern(regexp = "OPEN|GUEST|RESOLVE|SKEPTIC|USER|REPLY")`.

- [ ] **Step 3: Repositories + properties**

Add the query methods listed under **Produces**. In `TeamChatProperties`, add the four fields, each with javadoc and `@Min(1) @Max(...)` (`replyVoicedPerThreadDay` ≤ 20, `replyDailyCap` ≤ 200, `exceptionWindowDays` ≤ 120, `exceptionReviewHits` ≤ 30). In `application.yml` under `team-chat:`, add:

```yaml
      # S7 (mezo-d6ivw.7): voiced (LLM) answers per ügy per local day; past it a template answers.
      reply-voiced-per-thread-day: 4
      # S7: all REPLY lines per user per local day (their own cap — they never eat daily-line-cap).
      reply-daily-cap: 20
      # S7: an exception's hit window, and the hits already in it that turn the next occurrence
      # into a one-time review question („ez még rendben van így?").
      exception-window-days: 30
      exception-review-hits: 4
```

Grep every `new TeamChatProperties(` in tests (`grep -rn "new TeamChatProperties(" backend/src/test`) and add the four args `4, 20, 30, 4`.

Add `public static final String SOURCE_TEAM_CHAT = "team_chat";` to `KnowledgeFactEntity`, and widen its `source` `@Pattern` if it has one.

- [ ] **Step 4: Extend TeamChatRepositoryIT**

```java
    @Test
    void exceptionAndHit_roundTrip_andTheDayIsUniquePerException() {
        UUID owner = userPopulator.createUser().getId();
        TeamChatExceptionEntity e = new TeamChatExceptionEntity();
        e.setCreatedBy(owner);
        e.setFlagKey("late_eating");
        e.setOwnerCharacter("falat");
        e.setContextTag("meccsnap");
        e.setNormalizedTag("meccsnap");
        e.setKeywords(new KeywordsEnvelope(List.of("meccs", "kupa")));
        e.setWindowStartedAt(Instant.now());
        TeamChatExceptionEntity saved = exceptions.saveAndFlush(e);
        assertThat(exceptions.findByCreatedByAndFlagKeyAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(owner, "late_eating"))
                .extracting(TeamChatExceptionEntity::getKeywords).containsExactly(new KeywordsEnvelope(List.of("meccs", "kupa")));

        LocalDate today = LocalDate.now();
        hits.saveAndFlush(hit(owner, saved.getId(), today, "NOTES"));
        assertThatThrownBy(() -> hits.saveAndFlush(hit(owner, saved.getId(), today, "TAP")))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(saved.getId(), today.minusDays(29))).isEqualTo(1);
    }
```

(`hit(...)` is a small private builder in the test. Autowire `TeamChatExceptionRepository exceptions` and `TeamChatExceptionHitRepository hits`.)

- [ ] **Step 5: Run**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest='TeamChatRepositoryIT,TeamChatServiceIT'`
Expected: PASS. Liquibase applies; Hibernate `validate` accepts the entities.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/KnowledgeFactEntity.java backend/src/main/resources/application.yml backend/src/test
git commit -m "feat(character): S7 schema — close reason, offers, exceptions + hits (mezo-d6ivw.7)"
```

---

### Task 2: Contract + reads

**Files:**
- Modify:
  - `api/feature/character/character.yml`
  - `TeamChatReads.java`
  - `CharacterController.java` (stubs that throw 501 are NOT allowed; the two new operations go in Task 7, so this task adds only the schema fields)
- Test: `TeamChatControllerIT.java` (extend)

**Interfaces:**
- Produces:
  - `TeamChatLine.kind` enum gains `REPLY`.
  - `TeamChatThread` gains:
    - `closeReason` (nullable enum DATA/REPLY/EXCUSED)
    - `closeNote` (nullable string)
    - `offer` (nullable enum EXCUSE/REVIEW)
    - `remembered` (nullable `TeamChatRemembered {text, contextTag, active}`)
  - `TeamChatReads.toThread(TeamChatThreadEntity, TeamChatExceptionEntity /*nullable*/)`. The one-arg overload stays and passes null.

- [ ] **Step 1: Contract**

In `TeamChatLine.kind`: `enum: [OPEN, GUEST, RESOLVE, SKEPTIC, USER, REPLY]`. In `TeamChatThread.properties`, add:

```yaml
        closeReason:
          type: string
          nullable: true
          enum: [DATA, REPLY, EXCUSED]
          description: Why a RESOLVED ügy closed — its data cleared, the user's explanation, or a known exception confirmed
        closeNote: { type: string, nullable: true, description: 'The short context tag, e.g. meccsnap' }
        offer:
          type: string
          nullable: true
          enum: [EXCUSE, REVIEW]
          description: A known-exception question (one tap) or the capped re-check (two taps)
        remembered: { $ref: '#/components/schemas/TeamChatRemembered' }
```

Add the schema:

```yaml
    TeamChatRemembered:
      type: object
      nullable: true
      required: [text, contextTag, active]
      properties:
        text: { type: string, description: The remembered sentence (the knowledge fact's text) }
        contextTag: { type: string }
        active: { type: boolean, description: false once undone or switched off }
```

Change the reply op's summary to: `The user's reply on their own ügy — a USER line; the owner character answers shortly after (a REPLY line), and a concrete explanation may close the ügy`. Update the `getTeamChatDay` summary: `(OPEN, RESOLVE and REPLY lines embed their ügy)`.

Then: `cd api && npm run generate:api && cd ../backend && ./mvnw -q generate-sources`.

- [ ] **Step 2: Reads**

In `TeamChatReads`:
- `THREAD_BEARING = Set.of(KIND_OPEN, KIND_RESOLVE, KIND_REPLY)`.
- Inject `TeamChatExceptionRepository exceptions`.
- In `day()`, load the exceptions once for the embedded thread ids: `exceptions.findBySourceThreadIdInAndCreatedByAndDeletedFalse(ids, userId)`. Add that repository method, returning `List<TeamChatExceptionEntity>`.
- Build a `Map<UUID threadId, TeamChatExceptionEntity>` and pass it into `toLine(line, thread, exception)` / `toThread(thread, exception)`.

```java
    public static TeamChatThread toThread(TeamChatThreadEntity thread, TeamChatExceptionEntity born) {
        // ...existing builder...
                .closeReason(thread.getCloseReason() == null ? null
                        : TeamChatThread.CloseReasonEnum.fromValue(thread.getCloseReason()))
                .closeNote(thread.getCloseNote())
                .offer(thread.getOffer() == null ? null : TeamChatThread.OfferEnum.fromValue(thread.getOffer()))
                .remembered(born == null ? null : TeamChatRemembered.builder()
                        .text(born.getRememberedText()).contextTag(born.getContextTag())
                        .active(Boolean.TRUE.equals(born.getActive())).build())
                .build();
    }
```

`getRememberedText()` needs the fact's text, and the fact lives in companion. Store it on the exception too: add `fact_text varchar(160) not null` to the Task 1 SQL + entity (`factText`). Then `remembered.text = born.getFactText()`. If Task 1 is already committed, fold this into the same migration file BEFORE it has ever been pushed (it is unreleased on this branch).

The `openThreads` list in `day()` must also pass exceptions: include the open thread ids in the same lookup.

- [ ] **Step 3: Test (extend TeamChatControllerIT)**

```java
    @Test
    void day_embedsCloseReasonNoteAndRemembered_onAReplyLine() throws Exception {
        UUID owner = /* existing helper creating the authed user */;
        TeamChatThreadEntity t = /* persist a RESOLVED thread: closeReason REPLY, closeNote "meccsnap" */;
        /* persist a REPLY line (character falat) on it, and an exception with sourceThreadId=t.id,
           factText "Meccsnapokon későn eszel — ez rendben van.", contextTag "meccsnap" */
        mockMvc.perform(get("/api/character/team-chat").header(AUTH, bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines[0].kind").value("REPLY"))
                .andExpect(jsonPath("$.lines[0].thread.closeReason").value("REPLY"))
                .andExpect(jsonPath("$.lines[0].thread.closeNote").value("meccsnap"))
                .andExpect(jsonPath("$.lines[0].thread.remembered.text").value("Meccsnapokon későn eszel — ez rendben van."))
                .andExpect(jsonPath("$.lines[0].thread.remembered.active").value(true));
    }
```

Follow the file's existing auth/populator helpers exactly (read its first 80 lines first).

- [ ] **Step 4: Run** `./mvnw test -Dmezo.test.use-testcontainers=true -Dtest='TeamChatControllerIT'` → PASS. Also run `node scripts/check-contract-drift.mjs` if present (`ls scripts | grep -i drift`); otherwise the drift check runs in CI via `api` merge. It must be clean after regeneration.

- [ ] **Step 5: Commit** `feat(api): team chat thread close reason, offer, remembered + REPLY kind (mezo-d6ivw.7)`

---

### Task 3: Knowledge seam (companion) + the real csapatfal knowledge adapter

**Files:**
- Modify:
  - `MemoryProvenanceEnvelope.java`
  - `KnowledgeFactService.java`
  - `KnowledgeFactRepository.java`
- Create: `TeamChatKnowledgeAdapter.java`
- Delete: `NoopTeamChatKnowledge.java`
- Modify javadoc: `TeamChatKnowledgePort.java`
- Test:
  - `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactTeamChatIT.java`
  - `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatKnowledgeAdapterIT.java`

**Interfaces:**
- Produces:
  - `MemoryProvenanceEnvelope.teamChat(UUID lineId, UUID threadId)`: `sourceTable="team_chat_line"`, `conversationId=threadId`, `patternId=lineId`. Reuse the existing slots and document the mapping in the javadoc; no new record component.
  - `KnowledgeFactService.captureFromTeamChat(UUID userId, String text, String owner, UUID lineId, UUID threadId) → UUID`
  - `KnowledgeFactService.muteFromTeamChat(UUID userId, UUID factId) → void`: fail-open, mute-not-delete.
  - `KnowledgeFactService.promptFactsForOwners(UUID userId, List<String> owners, int limit) → List<String>`
  - `TeamChatKnowledgeAdapter implements TeamChatKnowledgePort`

- [ ] **Step 1: Failing IT for the companion methods**

```java
@ActiveProfiles("companion-fake")
class KnowledgeFactTeamChatIT extends AbstractIntegrationTest {
    @Autowired private KnowledgeFactService service;
    @Autowired private KnowledgeFactRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void capture_writesAnOwnedTeamChatFact_inPrompt_withProvenance() {
        UUID owner = userPopulator.createUser().getId();
        UUID line = UUID.randomUUID(), thread = UUID.randomUUID();
        UUID id = service.captureFromTeamChat(owner, "Meccsnapokon későn eszel — ez rendben van.", "falat", line, thread);
        KnowledgeFactEntity f = repository.findByIdAndCreatedByAndDeletedFalse(id, owner).orElseThrow();
        assertThat(f.getSource()).isEqualTo("team_chat");
        assertThat(f.getOwner()).isEqualTo("falat");
        assertThat(f.getCategory()).isEqualTo("fuel");
        assertThat(f.isIncludeInPrompt()).isTrue();
        assertThat(f.getProvenance().sourceTable()).isEqualTo("team_chat_line");
        assertThat(service.renderPromptBlock(owner)).contains("Meccsnapokon későn eszel");
    }

    @Test
    void mute_takesItOutOfEveryPrompt_andNeverDeletes() {
        UUID owner = userPopulator.createUser().getId();
        UUID id = service.captureFromTeamChat(owner, "Meccsnapokon későn eszel.", "falat", UUID.randomUUID(), UUID.randomUUID());
        service.muteFromTeamChat(owner, id);
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(id, owner)).get()
                .extracting(KnowledgeFactEntity::isIncludeInPrompt).isEqualTo(false);
        assertThat(service.promptFactsForOwners(owner, List.of("falat"), 6)).isEmpty();
        service.muteFromTeamChat(owner, UUID.randomUUID()); // unknown id: fail-open, no throw
    }

    @Test
    void promptFactsForOwners_filtersByOwner_capsAndSkipsSuperseded() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 0; i < 8; i++) {
            service.captureFromTeamChat(owner, "Falat-tény " + i + ".", "falat", UUID.randomUUID(), UUID.randomUUID());
        }
        service.captureFromTeamChat(owner, "Szunya-tény.", "szunya", UUID.randomUUID(), UUID.randomUUID());
        assertThat(service.promptFactsForOwners(owner, List.of("falat"), 6)).hasSize(6).allMatch(s -> s.startsWith("Falat-tény"));
        assertThat(service.promptFactsForOwners(owner, List.of("szunya"), 6)).containsExactly("Szunya-tény.");
    }
}
```

(Check the actual accessor names on `KnowledgeFactEntity`, e.g. `isIncludeInPrompt()` vs `getIncludeInPrompt()`, before running.)

- [ ] **Step 2: Run** `./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=KnowledgeFactTeamChatIT`. Expected: FAIL to compile (the methods don't exist).

- [ ] **Step 3: Implement**

Add to `KnowledgeFactRepository`:

```java
    List<KnowledgeFactEntity> findByCreatedByAndOwnerInAndIncludeInPromptTrueAndSupersededByIsNullAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
            UUID createdBy, Collection<String> owners, Pageable page);
```

Add to `KnowledgeFactService`:

```java
    /** Owner → category: the inverse of {@link FactOwner}'s category fallback (szunya is sleep → health). */
    private static final Map<String, String> CATEGORY_BY_OWNER =
            Map.of("mocor", "train", "falat", "fuel", "deru", "health", "szunya", "health", "mezo", "life");

    /**
     * S7 (mezo-d6ivw.7): the user's own explanation on a csapatfal ügy, remembered as a fact owned
     * by the ügy's character — in every prompt (chat, proactive, csapatfal) from now on. The
     * {@code QuestionAnswerService} precedent: the user said it, so no Tudástár accept step.
     * Publishes {@link KnowledgeFactChangedEvent} so the graph syncs through its one consumer.
     */
    @Transactional
    public UUID captureFromTeamChat(UUID userId, String text, String owner, UUID lineId, UUID threadId) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(text);
        fact.setOwner(FactOwner.OWNERS.contains(owner) ? owner : "mezo");
        fact.setCategory(CATEGORY_BY_OWNER.getOrDefault(fact.getOwner(), "life"));
        fact.setSource(KnowledgeFactEntity.SOURCE_TEAM_CHAT);
        fact.setLastReinforcedAt(Instant.now());
        fact.setProvenance(MemoryProvenanceEnvelope.teamChat(lineId, threadId));
        KnowledgeFactEntity saved = repository.saveAndFlush(fact);
        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, saved.getId()));
        return saved.getId();
    }

    /** S7: undo / "Nem, figyelj rá" — the S2 mute-not-delete idiom, fail-open. */
    @Transactional
    public void muteFromTeamChat(UUID userId, UUID factId) {
        muteFromRefutedPattern(userId, factId);
    }

    /** S7: the csapatfal knowledge block — active, in-prompt, non-superseded facts of the given
     *  owners, strongest first, as plain sentences. */
    @Transactional(readOnly = true)
    public List<String> promptFactsForOwners(UUID userId, List<String> owners, int limit) {
        return repository
                .findByCreatedByAndOwnerInAndIncludeInPromptTrueAndSupersededByIsNullAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                        userId, owners, PageRequest.of(0, limit))
                .stream().map(KnowledgeFactEntity::getFactText).toList();
    }
```

`muteFromRefutedPattern` is `@Transactional` on the same bean. The self-call is fine here because the outer method is already transactional. Rename nothing; add a javadoc line on `muteFromRefutedPattern`: "also the S7 team-chat undo".

Add to `MemoryProvenanceEnvelope`:

```java
    /** S7 (mezo-d6ivw.7): a knowledge fact born from a csapatfal reply — {@code patternId} carries
     *  the USER line id and {@code conversationId} the ügy id (the record's existing slots). */
    public static MemoryProvenanceEnvelope teamChat(UUID lineId, UUID threadId) {
        return new MemoryProvenanceEnvelope("team_chat_line", null, null, threadId, null, lineId, null);
    }
```

- [ ] **Step 4: Run** the IT → PASS.

- [ ] **Step 5: Adapter IT (failing)**

```java
@ActiveProfiles("companion-fake")
class TeamChatKnowledgeAdapterIT extends AbstractIntegrationTest {
    @Autowired private TeamChatKnowledgePort port;
    @Autowired private KnowledgeFactService facts;
    @Autowired private UserPopulator userPopulator;

    @Test
    void theRealAdapterIsWired_andServesTheAreaOwnersFactsPlusUpToTwoMezoFacts() {
        assertThat(port).isInstanceOf(TeamChatKnowledgeAdapter.class);
        UUID owner = userPopulator.createUser().getId();
        facts.captureFromTeamChat(owner, "Meccsnapokon későn eszel.", "falat", UUID.randomUUID(), UUID.randomUUID());
        facts.captureFromTeamChat(owner, "Hétvégén többet alszol.", "szunya", UUID.randomUUID(), UUID.randomUUID());
        for (int i = 0; i < 3; i++) {
            facts.captureFromTeamChat(owner, "Általános " + i + ".", "mezo", UUID.randomUUID(), UUID.randomUUID());
        }
        List<String> falat = port.forArea(owner, TeamCharacter.FALAT);
        assertThat(falat).contains("Meccsnapokon későn eszel.").doesNotContain("Hétvégén többet alszol.");
        assertThat(falat.stream().filter(s -> s.startsWith("Általános"))).hasSize(2);
        assertThat(falat).hasSizeLessThanOrEqualTo(6);
    }
}
```

- [ ] **Step 6: Implement the adapter, delete the Noop**

```java
package io.mrkuhne.mezo.feature.character.service.chat;

/**
 * S7 (mezo-d6ivw.7): the csapatfal reads the ONE memory engine — the user's active, prompt-included
 * knowledge facts owned by the speaking character's area (confirmed observations, chat facts,
 * question answers, csapatfal exceptions), plus up to {@value #MEZO_MAX} of Mezo's general ones.
 * Replaces NoopTeamChatKnowledge. Fail-open: an error is an empty block, never a lost line.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {/* the five team chat switches, verbatim from TeamChatService */}, havingValue = "true")
public class TeamChatKnowledgeAdapter implements TeamChatKnowledgePort {

    static final int MAX = 6;
    static final int MEZO_MAX = 2;

    private final KnowledgeFactService facts;

    @Override
    public List<String> forArea(UUID owner, TeamCharacter area) {
        try {
            String key = area.key();
            List<String> own = "mezo".equals(key) ? List.of() : facts.promptFactsForOwners(owner, List.of(key), MAX);
            List<String> mezo = facts.promptFactsForOwners(owner, List.of("mezo"), "mezo".equals(key) ? MAX : MEZO_MAX);
            return Stream.concat(own.stream().limit(MAX - Math.min(MEZO_MAX, mezo.size())), mezo.stream())
                    .limit(MAX).toList();
        } catch (RuntimeException e) {
            log.warn("Team chat knowledge block failed for user {} area {} — empty", owner, area, e);
            return List.of();
        }
    }
}
```

The SZKEPTIKUS area's `key()` is `szkeptikus`, which matches no owner: it just gets Mezo facts. Update the `TeamChatKnowledgePort` javadoc ("Emlékezet S7 (mezo-d6ivw.7) implements it: {@link TeamChatKnowledgeAdapter}"). `git rm` the Noop. Grep tests for `NoopTeamChatKnowledge` and update them.

- [ ] **Step 7: Run** `-Dtest='TeamChatKnowledgeAdapterIT,TeamChatContextIT,TeamChatVoiceWriterTest,TeamChatSwitchOffIT,TeamChatApiSwitchOffIT,ArchitectureTest'` → PASS. ArchitectureTest matters: character → companion.service only.

- [ ] **Step 8: Commit** `feat(character): csapatfal reads the Tudástár — real knowledge adapter + team_chat facts (mezo-d6ivw.7)`

---

### Task 4: Pure logic: decision + matcher

**Files:**
- Create: `TeamChatReplyDecision.java`, `TeamChatExceptionMatcher.java`, `TeamChatReplyDraft.java`
- Test: `TeamChatReplyDecisionTest.java`, `TeamChatExceptionMatcherTest.java`

**Interfaces:**
- Produces:

```java
/** The parsed model answer — every field already trimmed/validated by the writer; verdict null = unknown. */
public record TeamChatReplyDraft(String reply, boolean voiced, String verdict, String contextTag,
        String factText, List<String> keywords) {
    public static final String CONCRETE = "concrete_context";
    public static TeamChatReplyDraft template(String reply) {
        return new TeamChatReplyDraft(reply, false, null, null, null, List.of());
    }
}

final class TeamChatReplyDecision {
    enum Outcome { ANSWER_ONLY, CLOSE_NEW_EXCEPTION, CLOSE_AS_HIT_ON_ACTIVE, EXCUSE_TAP_EQUIVALENT }
    /** activeSameTag: an active exception for (rule, normalizedTag); vetoed: an INACTIVE one. */
    static Outcome decide(String threadStatus, String offer, TeamChatReplyDraft draft,
            boolean activeSameTag, boolean vetoed, String offerExceptionNormalizedTag) { ... }
}

final class TeamChatExceptionMatcher {
    static String normalize(String tag);                       // lowercase, accent-folded, [a-z0-9 ] collapsed, trimmed, ≤40
    static List<String> cleanKeywords(List<String> raw);       // lowercase, 2..24 chars, distinct, ≤6
    static boolean matches(List<String> keywords, List<String> dayTexts); // accent-folded substring
}
```

- [ ] **Step 1: Failing decision tests**

```java
class TeamChatReplyDecisionTest {
    private static TeamChatReplyDraft concrete() {
        return new TeamChatReplyDraft("Értem, meccsnap volt.", true, "concrete_context", "meccsnap",
                "Meccsnapokon későn eszel — ez rendben van.", List.of("meccs"));
    }

    @Test void concreteOnOpenPlainThread_closesWithANewException() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null, concrete(), false, false, null))
                .isEqualTo(Outcome.CLOSE_NEW_EXCEPTION);
    }
    @Test void concreteWithAnActiveSameTag_closesAsAHit() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null, concrete(), true, false, null))
                .isEqualTo(Outcome.CLOSE_AS_HIT_ON_ACTIVE);
    }
    @Test void vetoedTag_onlyAnswers() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null, concrete(), false, true, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
    }
    @ParameterizedTest @ValueSource(strings = {"mood", "disagreement", "question", "other"})
    void nonConcreteVerdicts_onlyAnswer(String verdict) {
        var d = new TeamChatReplyDraft("Értem.", true, verdict, "meccsnap", "x", List.of("meccs"));
        assertThat(TeamChatReplyDecision.decide("OPEN", null, d, false, false, null)).isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void templateOrUnvoiced_neverCloses() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null, TeamChatReplyDraft.template("Láttam."), false, false, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
        var unvoiced = new TeamChatReplyDraft("x", false, "concrete_context", "meccsnap", "f", List.of("meccs"));
        assertThat(TeamChatReplyDecision.decide("OPEN", null, unvoiced, false, false, null)).isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void missingTagFactOrKeywords_onlyAnswers() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null,
                new TeamChatReplyDraft("x", true, "concrete_context", " ", "f", List.of("meccs")), false, false, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
        assertThat(TeamChatReplyDecision.decide("OPEN", null,
                new TeamChatReplyDraft("x", true, "concrete_context", "meccsnap", null, List.of("meccs")), false, false, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
        assertThat(TeamChatReplyDecision.decide("OPEN", null,
                new TeamChatReplyDraft("x", true, "concrete_context", "meccsnap", "f", List.of()), false, false, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void alreadyResolvedThread_onlyAnswers() {
        assertThat(TeamChatReplyDecision.decide("RESOLVED", null, concrete(), false, false, null)).isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void excuseOffer_sameTagActsAsTheTap_otherTagOnlyAnswers() {
        assertThat(TeamChatReplyDecision.decide("OPEN", "EXCUSE", concrete(), true, false, "meccsnap"))
                .isEqualTo(Outcome.EXCUSE_TAP_EQUIVALENT);
        var other = new TeamChatReplyDraft("x", true, "concrete_context", "utazás", "f", List.of("utaz"));
        assertThat(TeamChatReplyDecision.decide("OPEN", "EXCUSE", other, false, false, "meccsnap")).isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void reviewOffer_freeTextNeverDecides() {
        assertThat(TeamChatReplyDecision.decide("OPEN", "REVIEW", concrete(), true, false, "meccsnap")).isEqualTo(Outcome.ANSWER_ONLY);
    }
}
```

- [ ] **Step 2: Failing matcher tests**

```java
class TeamChatExceptionMatcherTest {
    @Test void normalize_lowercasesFoldsAccentsAndCollapses() {
        assertThat(TeamChatExceptionMatcher.normalize("  Meccs-Nap! ")).isEqualTo("meccs nap");
        assertThat(TeamChatExceptionMatcher.normalize("Röplabda kupa")).isEqualTo("roplabda kupa");
    }
    @Test void cleanKeywords_trimsFiltersDedupesCaps() {
        assertThat(TeamChatExceptionMatcher.cleanKeywords(List.of("Meccs", "meccs", "x", "kupa", "a".repeat(30),
                "r1", "r2", "r3", "r4", "r5"))).containsExactly("meccs", "kupa", "r1", "r2", "r3", "r4");
    }
    @Test void matches_isAccentFoldedCaseInsensitiveSubstring() {
        assertThat(TeamChatExceptionMatcher.matches(List.of("röpi"), List.of("Ma RÖPI-kupa volt este"))).isTrue();
        assertThat(TeamChatExceptionMatcher.matches(List.of("ropi"), List.of("röpimeccs"))).isTrue();
        assertThat(TeamChatExceptionMatcher.matches(List.of("meccs"), List.of("nyugis nap"))).isFalse();
        assertThat(TeamChatExceptionMatcher.matches(List.of(), List.of("meccs"))).isFalse();
    }
}
```

- [ ] **Step 3: Run both** → FAIL (classes missing).

- [ ] **Step 4: Implement**

```java
final class TeamChatExceptionMatcher {
    static final int TAG_MAX = 40;
    static final int KEYWORDS_MAX = 6;
    private TeamChatExceptionMatcher() {}

    static String fold(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT);
    }
    static String normalize(String tag) {
        String out = fold(tag).replaceAll("[^a-z0-9]+", " ").strip();
        return out.length() > TAG_MAX ? out.substring(0, TAG_MAX).strip() : out;
    }
    static List<String> cleanKeywords(List<String> raw) {
        if (raw == null) return List.of();
        return raw.stream().filter(Objects::nonNull).map(k -> k.strip().toLowerCase(Locale.ROOT))
                .filter(k -> k.length() >= 2 && k.length() <= 24).distinct().limit(KEYWORDS_MAX).toList();
    }
    static boolean matches(List<String> keywords, List<String> dayTexts) {
        if (keywords == null || keywords.isEmpty() || dayTexts == null) return false;
        String hay = fold(String.join(" \n ", dayTexts));
        return keywords.stream().map(TeamChatExceptionMatcher::fold).anyMatch(hay::contains);
    }
}
```

```java
final class TeamChatReplyDecision {
    enum Outcome { ANSWER_ONLY, CLOSE_NEW_EXCEPTION, CLOSE_AS_HIT_ON_ACTIVE, EXCUSE_TAP_EQUIVALENT }
    static final int FACT_MAX = 160;
    private TeamChatReplyDecision() {}

    static Outcome decide(String threadStatus, String offer, TeamChatReplyDraft d, boolean activeSameTag,
            boolean vetoed, String offerExceptionNormalizedTag) {
        if (!"OPEN".equals(threadStatus) || d == null || !d.voiced() || !TeamChatReplyDraft.CONCRETE.equals(d.verdict())) {
            return Outcome.ANSWER_ONLY;
        }
        if (d.contextTag() == null || d.contextTag().isBlank() || d.contextTag().strip().length() > TeamChatExceptionMatcher.TAG_MAX
                || d.factText() == null || d.factText().isBlank() || d.factText().strip().length() > FACT_MAX
                || d.keywords() == null || d.keywords().isEmpty()) {
            return Outcome.ANSWER_ONLY;
        }
        String tag = TeamChatExceptionMatcher.normalize(d.contextTag());
        if (TeamChatService.OFFER_REVIEW.equals(offer)) return Outcome.ANSWER_ONLY;
        if (TeamChatService.OFFER_EXCUSE.equals(offer)) {
            return tag.equals(offerExceptionNormalizedTag) ? Outcome.EXCUSE_TAP_EQUIVALENT : Outcome.ANSWER_ONLY;
        }
        if (vetoed) return Outcome.ANSWER_ONLY;
        return activeSameTag ? Outcome.CLOSE_AS_HIT_ON_ACTIVE : Outcome.CLOSE_NEW_EXCEPTION;
    }
}
```

(`OFFER_*` constants are package-private on `TeamChatService`, and this class is in the same package.)

- [ ] **Step 5: Run** → PASS. **Step 6: Commit** `feat(character): reply close decision + exception matcher (mezo-d6ivw.7)`

---

### Task 5: The reply voice writer + fake LLM + admin label

**Files:**
- Create: `TeamChatReplyVoiceWriter.java`
- Modify:
  - `FakeCompanionLlm.java`
  - `frontend/src/features/admin/lib/labels.ts`
  - `frontend/src/features/admin/lib/labels.completeness.test.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatReplyVoiceWriterTest.java`

**Interfaces:**
- Consumes: `TeamChatReplyDraft`, `TeamChatContext.build`, `TeamChatBudget.hasRoom`, `EditionVoiceGuard.checkGuest`.
- Produces:
  - `TeamChatReplyVoiceWriter.MARKER = "CSAPATFAL-VALASZ"`
  - `TeamChatReplyDraft write(UUID owner, TeamChatThreadEntity thread, List<String> userTexts, List<String> threadFacts, String offerNote /*nullable*/)`: never throws; the fallback is `TeamChatReplyDraft.template(templateFor(ownerCharacter))`.
  - `static String templateFor(TeamCharacter c)`: a fixed per-character one-sentence acknowledgement, e.g. FALAT: `"Köszönöm, hogy elmondtad — ezt figyelembe veszem."`. All five characters use the same honest sentence, and SZKEPTIKUS never owns an ügy.
  - FakeCompanionLlm:
    - `TEAM_CHAT_REPLY_MARKER_MIRROR = "CSAPATFAL-VALASZ"`
    - `TEAM_CHAT_REPLY_BODY = "Értem, köszönöm, hogy elmondtad."`
    - sentinel `[fake-team-chat-reply:BASE64JSON]` returns the decoded JSON verbatim
    - `[fake-team-chat-reply-malformed]` returns `not-json`

- [ ] **Step 1: Failing unit test** (mirror `TeamChatVoiceWriterTest`'s construction; read it first. It builds the writer over a lambda `CompanionLlm`, a stub budget and a stub context.)

```java
class TeamChatReplyVoiceWriterTest {
    @Test void markerMirror_matches() {
        assertThat(FakeCompanionLlm.TEAM_CHAT_REPLY_MARKER_MIRROR).isEqualTo(TeamChatReplyVoiceWriter.MARKER);
        assertThat(TeamChatReplyVoiceWriter.MARKER).doesNotStartWith(TeamChatVoiceWriter.MARKER);
        assertThat(TeamChatVoiceWriter.MARKER).doesNotStartWith(TeamChatReplyVoiceWriter.MARKER);
    }
    @Test void parsesVerdictAndProposal_andAllowsTheUsersOwnNumbers() {
        var writer = writerAnswering("{\"reply\":\"Értem, a 10 órás kupa után ez természetes.\",\"verdict\":\"concrete_context\","
                + "\"contextTag\":\"meccsnap\",\"factText\":\"Meccsnapokon későn eszel — ez rendben van.\",\"keywords\":[\"Meccs\",\"kupa\"]}");
        var d = writer.write(owner, falatThread, List.of("10-kor ért véget a röpi kupa"), List.of(), null);
        assertThat(d.voiced()).isTrue();
        assertThat(d.verdict()).isEqualTo("concrete_context");
        assertThat(d.keywords()).containsExactly("meccs", "kupa");
    }
    @Test void inventedNumber_fallsBackToTemplate_withNoVerdict() {
        var d = writerAnswering("{\"reply\":\"Ez már a 3. alkalom.\",\"verdict\":\"concrete_context\",\"contextTag\":\"x\",\"factText\":\"y\",\"keywords\":[\"x1\"]}")
                .write(owner, falatThread, List.of("későn ettem"), List.of(), null);
        assertThat(d.voiced()).isFalse();
        assertThat(d.verdict()).isNull();
        assertThat(d.reply()).isEqualTo(TeamChatReplyVoiceWriter.templateFor(TeamCharacter.FALAT));
    }
    @Test void threeSentences_rejected() { /* reply with 3 sentences → template */ }
    @Test void malformedJson_or_llmThrows_or_budgetSpent_template() { /* three cases */ }
    @Test void unknownVerdict_isNulled() { /* verdict "banana" → draft.verdict() == null, reply still voiced */ }
}
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement the writer**

```java
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(/* the five team chat switches */)
public class TeamChatReplyVoiceWriter {

    public static final String MARKER = "CSAPATFAL-VALASZ";
    static final Set<String> VERDICTS = Set.of("concrete_context", "mood", "disagreement", "question", "other");

    private static final String RULES = """
            A felhasználó ({{NÉV}}) válaszolt egy csapat-ügyre. Te az ügy gazdájaként felelsz, a saját hangodon.
            Szabályok: 1–2 mondat; nyugtázd, amit mondott, NE ismételd meg a tanácsot, NE moralizálj; ha konkrét
            okot mond (esemény, program, betegség, utazás, munka), fogadd el természetesen; hangulatra ("nem volt
            kedvem") megértően reagálj, szabályt ne csinálj belőle; kérdésre röviden válaszolj; egyet nem értésre
            ne vitatkozz. Számot csak a „tények:” sorokból vagy a felhasználó saját szövegéből írhatsz. Emoji csak a
            karakter készletéből, mértékkel. Szaknyelv tilos.
            Minősítsd a választ: concrete_context | mood | disagreement | question | other. Ha concrete_context:
            contextTag = 1–3 szavas címke (pl. „meccsnap”), factText = egy mondat, amit érdemes megjegyezni
            (pl. „Meccsnapokon későn eszel — ez rendben van.”), keywords = 1–6 kisbetűs szótő, amivel egy napi
            jegyzetben felismerhető (pl. ["meccs","kupa","röpi"]).""";

    private static final String ANSWER_CONTRACT = "\nVálasz: KIZÁRÓLAG JSON objektum: "
            + "{\"reply\":\"…\",\"verdict\":\"…\",\"contextTag\":\"…vagy null\",\"factText\":\"…vagy null\",\"keywords\":[…]}\n";

    static final String SYSTEM_PROMPT = MARKER + "\n" + RULES + PromptPersona.VOICE_HU + ANSWER_CONTRACT;

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;
    private final TeamChatBudget budget;
    private final TeamChatContext context;
    private final ObjectMapper objectMapper;

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Answer(String reply, String verdict, String contextTag, String factText, List<String> keywords) {}

    public TeamChatReplyDraft write(UUID owner, TeamChatThreadEntity thread, List<String> userTexts,
            List<String> threadFacts, String offerNote) {
        TeamCharacter who = TeamCharacter.valueOf(thread.getOwnerCharacter().toUpperCase(Locale.ROOT));
        TeamChatReplyDraft fallback = TeamChatReplyDraft.template(templateFor(who));
        Answer a;
        try {
            if (!budget.hasRoom(owner)) return fallback;
            TeamChatContextBlock background = context.build(owner, thread, Instant.now());
            String system = promptPersona.render(owner, SYSTEM_PROMPT);
            String user = userMessage(who, thread, userTexts, threadFacts, offerNote, background);
            String raw = llmCallContextHolder.runWith(
                    new LlmCallContext(TeamChatBudget.FEATURE, "reply", "team_chat_thread", thread.getId()),
                    () -> companionLlm.complete(system, user));
            a = objectMapper.readValue(stripFences(raw), Answer.class);
        } catch (RuntimeException | JsonProcessingException e) {
            log.warn("Team chat reply voice failed on ügy {} — template", thread.getId(), e);
            return fallback;
        }
        if (a == null || a.reply() == null || a.reply().isBlank()) return fallback;
        String body = a.reply().strip();
        String userText = String.join(" ", userTexts);
        if (EditionVoiceGuard.checkGuest(who, body, threadFacts, userText).isPresent()) return fallback;
        String verdict = a.verdict() != null && VERDICTS.contains(a.verdict().strip()) ? a.verdict().strip() : null;
        return new TeamChatReplyDraft(body, true, verdict, blankToNull(a.contextTag()), blankToNull(a.factText()),
                TeamChatExceptionMatcher.cleanKeywords(a.keywords()));
    }
    // templateFor, userMessage (prefixes: "karakter:", "ügy:", "tények:" + "- " lines, "a felhasználó írta:"
    // + "- " lines, "ajánlat:" (offerNote), "háttér — számot innen NE írj:" + sections), stripFences, blankToNull
}
```

`objectMapper.readValue` throws `JsonProcessingException` (checked) under Jackson 2. Match whatever `TeamChatVoiceWriter` catches (it catches `RuntimeException` only, which means it uses a Jackson 3 / unchecked variant). Copy its exact exception handling. Also copy its `stripFences` and `section` helpers: make `TeamChatVoiceWriter.stripFences`/`section`/`oneLine` package-private static and reuse them rather than duplicating.

`userMessage` must emit the user's texts under `a felhasználó írta:` as `- ` lines. The fake reads them.

- [ ] **Step 4: Fake LLM branch** (place it BEFORE the `TEAM_CHAT_MARKER_MIRROR` branch; the prefixes differ anyway):

```java
    /** Mirror of TeamChatReplyVoiceWriter.MARKER — LITERAL (cycle rule); TeamChatReplyVoiceWriterTest asserts equality. */
    public static final String TEAM_CHAT_REPLY_MARKER_MIRROR = "CSAPATFAL-VALASZ";
    public static final String TEAM_CHAT_REPLY_BODY = "Értem, köszönöm, hogy elmondtad.";
    public static final String TEAM_CHAT_REPLY_MALFORMED = "[fake-team-chat-reply-malformed]";
    private static final Pattern TEAM_CHAT_REPLY_SCRIPT = Pattern.compile("\\[fake-team-chat-reply:([A-Za-z0-9+/=]+)]");

    /** Scripts a whole reply answer from a test: plant the result in the user's reply text. */
    public static String teamChatReplyScript(String json) {
        return "[fake-team-chat-reply:" + Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8)) + "]";
    }
    // dispatch:
        if (systemPrompt.startsWith(TEAM_CHAT_REPLY_MARKER_MIRROR)) {
            if (userMessage.contains(TEAM_CHAT_REPLY_MALFORMED)) return "not-json";
            Matcher m = TEAM_CHAT_REPLY_SCRIPT.matcher(userMessage);
            if (m.find()) return new String(Base64.getDecoder().decode(m.group(1)), StandardCharsets.UTF_8);
            return "{\"reply\":\"" + jsonEscape(TEAM_CHAT_REPLY_BODY) + "\",\"verdict\":\"other\",\"contextTag\":null,\"factText\":null,\"keywords\":[]}";
        }
```

- [ ] **Step 5: Admin label + gate fix.** In `labels.ts` `FEATURE_LABELS`, add `team_chat: 'Csapat-chat (élő beszélgetés)'`, keeping alphabetical order if the file uses it. In `labels.completeness.test.ts`, extend the const-slug scan: also collect `FEATURE[A-Z_]*\s*=\s*"…"` constants from any Java file whose simple class name appears as `<ClassName>.FEATURE` inside a file that contains `new LlmCallContext(`. Two passes: first map className → const slug for every file, then for each file with `new LlmCallContext(`, find `(\w+)\.FEATURE[A-Z_]*` references and add the mapped slugs. Then run it and confirm it now reports `team_chat` if the label is temporarily removed (sanity), with the label present → PASS.

- [ ] **Step 6: Run**
  - `./mvnw test -Dtest='TeamChatReplyVoiceWriterTest,TeamChatVoiceWriterTest'` → PASS
  - `cd frontend && CI=true pnpm vitest run src/features/admin/lib/labels.completeness.test.ts` → PASS

- [ ] **Step 7: Commit** `feat(character): guarded reply voice (CSAPATFAL-VALASZ) + team_chat admin label (mezo-d6ivw.7)`

---

### Task 6: The reply pipeline (answer + close + remember)

**Files:**
- Create:
  - `TeamChatRepliedEvent.java`
  - `TeamChatReplyListener.java`
  - `TeamChatReplyService.java`
- Modify: `TeamChatService.java` (`reply()` publishes; `capReached` excludes REPLY; `closeThread` sets `closeReason=DATA`; `writeLine` becomes package-private; the constants)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatReplyIT.java`

**Interfaces:**
- Consumes:
  - `TeamChatReplyVoiceWriter.write`
  - `TeamChatReplyDecision.decide`
  - `TeamChatExceptionMatcher.normalize`
  - `KnowledgeFactService.captureFromTeamChat`
  - the repositories from Task 1
- Produces:
  - `record TeamChatRepliedEvent(UUID userId, UUID threadId)`
  - `TeamChatReplyService.answer(UUID userId, UUID threadId)`: public, NOT `@Transactional`, never throws.
  - `TeamChatExceptionService.recordHit(...)` is defined in Task 7. Here the hit is written directly via `TeamChatExceptionHitRepository` with source `REPLY`.

- [ ] **Step 1: Failing IT** (`@ActiveProfiles("companion-fake")`, no class-level `@Transactional`, `TeamChatServiceIT` style). Seed an OPEN `late_eating` thread directly via the repositories: owner falat, `openedAt` = today 12:00 local, plus its OPEN line. Then:

```java
    private static final String MECCS = FakeCompanionLlm.teamChatReplyScript(
            "{\"reply\":\"Értem, meccsnap volt — ez teljesen rendben van.\",\"verdict\":\"concrete_context\","
            + "\"contextTag\":\"meccsnap\",\"factText\":\"Meccsnapokon későn eszel — ez rendben van.\",\"keywords\":[\"meccs\",\"kupa\"]}");

    @Test
    void concreteReply_answers_closesAsReply_remembers_andNeverPushes() {
        UUID owner = owner(); TeamChatThreadEntity t = openLateEating(owner);
        service.reply(owner, t.getId(), "10-kor ért véget a kupa " + MECCS);
        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(linesOf(t.getId())).extracting(TeamChatLineEntity::getKind).containsExactly("OPEN", "USER", "REPLY"));
        TeamChatLineEntity reply = linesOf(t.getId()).get(2);
        assertThat(reply.getCharacter()).isEqualTo("falat");
        assertThat(reply.getVoiced()).isTrue();
        TeamChatThreadEntity closed = threads.findById(t.getId()).orElseThrow();
        assertThat(closed.getStatus()).isEqualTo("RESOLVED");
        assertThat(closed.getCloseReason()).isEqualTo("REPLY");
        assertThat(closed.getCloseNote()).isEqualTo("meccsnap");
        TeamChatExceptionEntity ex = exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(t.getId(), owner).orElseThrow();
        assertThat(ex.getActive()).isTrue();
        assertThat(ex.getKeywords().keywords()).containsExactly("meccs", "kupa");
        assertThat(knowledge.findByIdAndCreatedByAndDeletedFalse(ex.getKnowledgeFactId(), owner)).get()
                .extracting(KnowledgeFactEntity::getSource).isEqualTo("team_chat");
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), LocalDate.now().minusDays(1))).isEqualTo(1);
        assertThat(teamChatPushes(owner)).isEmpty();
    }

    @Test void moodReply_answersButStaysOpen_andRemembersNothing() { /* default fake → verdict other */ }
    @Test void burstOfThreeUserLines_getsOneReply() {
        // call reply() 3× quickly; await; exactly one REPLY line after the 3 USER lines (the listener
        // for replies 2 and 3 finds no unanswered USER line after the REPLY, or the claim sees one pending burst)
    }
    @Test void voicedCapPerThreadDay_thenTemplate_neverCloses() {
        // set 4 voiced REPLY lines today on the thread via repo, then reply MECCS → REPLY voiced=false, thread OPEN
    }
    @Test void replyLines_doNotEatTheDailyLineCap() {
        // 12 REPLY lines today → service.open(...) of another rule still opens
    }
    @Test void secondSameTagReplyOnAnotherThread_recordsAHit_noSecondFact() { }
    @Test void llmCallRunsOutsideAnyTransaction() {
        // TeamChatVoiceOutsideTransactionIT precedent: a CompanionLlm @MockitoBean/@Primary test bean
        // asserting !TransactionSynchronizationManager.isActualTransactionActive() for the reply marker
    }
```

Write all of these out fully. The comments above describe the arrange/act/assert, and each test must be concrete code before running.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`TeamChatService` changes:

```java
    static final String KIND_REPLY = "REPLY";
    static final String CLOSE_DATA = "DATA";
    static final String CLOSE_REPLY = "REPLY";
    static final String CLOSE_EXCUSED = "EXCUSED";
    static final String OFFER_EXCUSE = "EXCUSE";
    static final String OFFER_REVIEW = "REVIEW";

    private final ApplicationEventPublisher events; // add to the constructor fields

    /** The user's reply — a USER line; the owner answers asynchronously (S7, TeamChatReplyService). */
    @Transactional
    public TeamChatLineEntity reply(UUID userId, UUID threadId, String text) {
        // ...unchanged validation + owned()...
        TeamChatLineEntity line = writeLine(thread, KIND_USER, null, body, false, List.of(), Instant.now());
        events.publishEvent(new TeamChatRepliedEvent(userId, threadId));
        return line;
    }
```

- In `closeThread`, add `thread.setCloseReason(CLOSE_DATA);`.
- In `capReached`, switch to `countByCreatedByAndCharacterIsNotNullAndKindNotAndOccurredAtBetweenAndDeletedFalse(userId, KIND_REPLY, from, to)`.
- Change `writeLine` from `private` to package-private.

`TeamChatReplyListener`:

```java
@Slf4j @Component @RequiredArgsConstructor @ConditionalOnProperty(/* five switches */)
public class TeamChatReplyListener {
    private final TeamChatReplyService replies;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReplied(TeamChatRepliedEvent event) {
        try {
            LlmActorContext.runAs(event.userId(), () -> replies.answer(event.userId(), event.threadId()));
        } catch (Exception e) {
            log.warn("Team chat answer failed for user {} ügy {}", event.userId(), event.threadId(), e);
        }
    }
}
```

`TeamChatReplyService`:

```java
/**
 * S7 (mezo-d6ivw.7): the owner character answers the user's reply — and a concrete explanation
 * closes the ügy and becomes durable knowledge. Claim (short tx) → voice (no tx) → commit (short
 * tx, row-locked), the TeamChatService.openThread shape. Answers every unanswered USER line of the
 * ügy at once (one REPLY per burst). Never pushes.
 */
@Slf4j @Service @RequiredArgsConstructor @ConditionalOnProperty(/* five switches */)
public class TeamChatReplyService {

    private final TeamChatThreadRepository threads;
    private final TeamChatLineRepository lines;
    private final TeamChatExceptionRepository exceptions;
    private final TeamChatExceptionHitRepository hits;
    private final TeamChatProperties properties;
    private final TeamChatReplyVoiceWriter voiceWriter;
    private final TeamChatService teamChat;              // writeLine
    private final KnowledgeFactService knowledge;
    private final ObjectProvider<TeamChatReplyService> self;

    record Claim(TeamChatThreadEntity thread, List<TeamChatLineEntity> pending, boolean mayVoice,
            List<String> threadFacts, String offerNote, String offerTag) {}

    public void answer(UUID userId, UUID threadId) {
        Optional<Claim> claim = self.getObject().claim(userId, threadId);
        if (claim.isEmpty()) return;
        Claim c = claim.get();
        List<String> texts = c.pending().stream().map(TeamChatLineEntity::getBody).toList();
        TeamChatReplyDraft draft = c.mayVoice()
                ? voiceWriter.write(userId, c.thread(), texts, c.threadFacts(), c.offerNote())
                : TeamChatReplyDraft.template(TeamChatReplyVoiceWriter.templateFor(owner(c.thread())));
        self.getObject().commit(userId, threadId, c.pending().getLast().getId(), draft);
    }

    /** Pending = USER lines after the ügy's last REPLY. Empty when nothing is pending (a burst's
     *  later events find the earlier answer already written) or the day's REPLY cap is spent. */
    @Transactional(readOnly = true)
    Optional<Claim> claim(UUID userId, UUID threadId) { /* load thread (owned, not deleted); lines by thread asc;
        pending = USER lines after last REPLY; if empty → empty; day bounds (properties.zone());
        if countByCreatedByAndKind(REPLY, day) >= replyDailyCap → warn + empty;
        mayVoice = countByThreadIdAndKindAndVoicedTrue(REPLY, day) < replyVoicedPerThreadDay;
        threadFacts = facts of the OPEN line; offerNote/offerTag from the thread's exception when offer != null:
          EXCUSE → "ismert kivétel: <factText> — kérdezd meg röviden, ma is ez volt-e", REVIEW → "felülvizsgálat: <contextTag>" */ }

    /** Writes the REPLY line and applies the code decision, under the ügy's row lock. A pending
     *  USER line newer than {@code lastUserLineId} is fine — its own event claims it next. */
    @Transactional
    void commit(UUID userId, UUID threadId, UUID lastUserLineId, TeamChatReplyDraft draft) {
        TeamChatThreadEntity thread = threads.lockOwned(threadId, userId).orElse(null);
        if (thread == null) return;
        // Idempotence under a burst: if a REPLY already follows lastUserLineId, another event won — skip.
        if (alreadyAnswered(thread.getId(), lastUserLineId)) return;
        Instant now = Instant.now();
        TeamChatLineEntity replyLine = teamChat.writeLine(thread, TeamChatService.KIND_REPLY,
                thread.getOwnerCharacter(), draft.reply(), draft.voiced(), List.of(), now);

        String tag = draft.contextTag() == null ? "" : TeamChatExceptionMatcher.normalize(draft.contextTag());
        Optional<TeamChatExceptionEntity> sameTag = tag.isEmpty() ? Optional.empty()
                : exceptions.findFirstByCreatedByAndFlagKeyAndNormalizedTagAndDeletedFalse(userId, thread.getFlagKey(), tag);
        boolean active = sameTag.map(e -> Boolean.TRUE.equals(e.getActive())).orElse(false);
        boolean vetoed = sameTag.isPresent() && !active;
        String offerTag = thread.getExceptionId() == null ? null
                : exceptions.findById(thread.getExceptionId()).map(TeamChatExceptionEntity::getNormalizedTag).orElse(null);

        switch (TeamChatReplyDecision.decide(thread.getStatus(), thread.getOffer(), draft, active, vetoed, offerTag)) {
            case ANSWER_ONLY -> { }
            case CLOSE_NEW_EXCEPTION -> {
                UUID userLine = lastUserLineId;
                UUID factId = knowledge.captureFromTeamChat(userId, draft.factText().strip(), thread.getOwnerCharacter(), userLine, thread.getId());
                TeamChatExceptionEntity e = new TeamChatExceptionEntity();
                e.setCreatedBy(userId); e.setFlagKey(thread.getFlagKey()); e.setOwnerCharacter(thread.getOwnerCharacter());
                e.setContextTag(draft.contextTag().strip()); e.setNormalizedTag(tag); e.setFactText(draft.factText().strip());
                e.setKeywords(new KeywordsEnvelope(draft.keywords())); e.setKnowledgeFactId(factId);
                e.setSourceThreadId(thread.getId()); e.setSourceLineId(userLine); e.setWindowStartedAt(now);
                TeamChatExceptionEntity saved = exceptions.saveAndFlush(e);
                hit(userId, saved.getId(), thread.getId(), "REPLY", now);
                close(thread, TeamChatService.CLOSE_REPLY, draft.contextTag().strip(), now);
            }
            case CLOSE_AS_HIT_ON_ACTIVE -> {
                hit(userId, sameTag.get().getId(), thread.getId(), "REPLY", now);
                close(thread, TeamChatService.CLOSE_REPLY, sameTag.get().getContextTag(), now);
            }
            case EXCUSE_TAP_EQUIVALENT -> {
                hit(userId, thread.getExceptionId(), thread.getId(), "TAP", now);
                close(thread, TeamChatService.CLOSE_EXCUSED, sameTag.map(TeamChatExceptionEntity::getContextTag).orElse(draft.contextTag()), now);
            }
        }
        log.info("Team chat ügy {} answered for user {} (voiced={}, verdict={})", threadId, userId, draft.voiced(), draft.verdict());
    }
    // hit(): skip when existsByExceptionIdAndHitOnAndDeletedFalse(exceptionId, localDay(now)); else save a hit row.
    // close(): status RESOLVED, closedAt, closeReason, closeNote (≤60), saveAndFlush.
}
```

`CLOSE_AS_HIT_ON_ACTIVE` intentionally writes no new exception. The ügy's `remembered` then comes from the exception whose `source_thread_id` is this thread, which is none. So the chip does not re-show a fact already remembered, and the close tag still shows. This is intended.

- [ ] **Step 4: Run** `-Dtest='TeamChatReplyIT,TeamChatServiceIT,TeamChatVoiceOutsideTransactionIT,TeamChatListenerActorIT'` → PASS. `TeamChatServiceIT` has a test asserting "a reply never resolves". Update its name/assertion to "reply writes a USER line synchronously" (the async answer is `TeamChatReplyIT`'s domain), and say so in the commit body.

- [ ] **Step 5: Commit** `feat(character): the owner answers a reply; a concrete explanation closes the ügy and is remembered (mezo-d6ivw.7)`

---

### Task 7: Known exceptions at open + quick answers + undo (API)

**Files:**
- Create: `TeamChatExceptionService.java`
- Modify:
  - `TeamChatService.java` (`claimThread` gate + offer-aware template + `pushAllowed=false`)
  - `TeamChatThreadRepository.java`
  - `character.yml` (two operations)
  - `CharacterController.java`
- Test: `TeamChatExceptionIT.java`, `TeamChatAnswerControllerIT.java`

**Interfaces:**
- Produces:
  - `TeamChatExceptionService.Gate gate(UUID userId, String flagKey, Instant at)`
    - `record Gate(Kind kind, TeamChatExceptionEntity exception, long hits)`
    - `enum Kind { NONE, SKIP, EXCUSE, REVIEW }`
  - `TeamChatThreadEntity answer(UUID userId, UUID threadId, String choice)`: choice ∈ `EXCUSED | KEEP | STOP`.
  - `TeamChatThreadEntity undoRemembered(UUID userId, UUID threadId)`
  - Contract:
    - `POST /api/character/team-chat/threads/{threadId}/answer` with body `TeamChatAnswerRequest {choice: enum[EXCUSED, KEEP, STOP]}` → `TeamChatThread`, with 404/409.
    - `DELETE /api/character/team-chat/threads/{threadId}/remembered` → `TeamChatThread`, with 404.
    - operationIds `answerTeamChatThread`, `undoTeamChatRemembered`.

- [ ] **Step 1: Failing IT**

```java
    @Test void keywordInTodaysCheckInNote_silentHit_noThread_noPush() {
        UUID owner = owner(); TeamChatExceptionEntity ex = activeException(owner, "late_eating", List.of("meccs"));
        checkInPopulator.withNote(owner, LocalDate.now(zone), "Este meccs volt, későn vacsiztam"); // use the real check-in populator; find it via NarrativeNoteSource CHECKIN_NOTE adapter
        raiseLateEatingLog(owner);
        service.open(owner, FlagKey.LATE_EATING, todayAt(20, 0));
        assertThat(threadsOf(owner)).isEmpty();
        assertThat(hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(ex.getId(), LocalDate.now(zone))).isEqualTo(1);
        // idempotent: a second open the same day (catch-up sweep) records no second hit and opens nothing
        service.open(owner, FlagKey.LATE_EATING, todayAt(20, 30));
        assertThat(threadsOf(owner)).isEmpty();
    }
    @Test void noKeywordToday_opensAnExcuseOffer_silently() {
        // → one OPEN thread, offer EXCUSE, exceptionId set, pushed=false, no TEAM_CHAT notification,
        //   OPEN line body mentions the known exception (template path: contains ex.getContextTag())
    }
    @Test void fourHitsInWindow_nextOccurrenceIsAReview_onlyOncePerWindow() {
        // seed 4 hits within 30 days → open → offer REVIEW; answer(KEEP) → windowStartedAt≈now, thread RESOLVED EXCUSED;
        // a later open that day with no keyword → EXCUSE offer again (window restarted)
    }
    @Test void hitsOlderThanTheWindow_doNotCount() { /* 4 hits 31+ days ago → EXCUSE, not REVIEW (lesson 25: floor = day − (window−1)) */ }
    @Test void answerExcused_closesExcused_withTapHit() { }
    @Test void answerStop_onReview_deactivatesMutesAndCloses() {
        // exception inactive, knowledge fact includeInPrompt=false, thread RESOLVED REPLY closeNote "kivétel kikapcsolva",
        // the next raise → a normal (non-offer) ügy WITH push eligibility (pushAllowed from the library pick)
    }
    @Test void answerWrongChoiceForOffer_is409_andIdempotentRepeat_isNoop() { }
    @Test void undo_reopens_mutes_vetoes_andBlocksRecapture() {
        // after a Task-6 style concrete close: undoRemembered → thread OPEN, closeReason/closeNote null,
        // exception inactive, fact muted, REPLY hit deleted (soft); a new same-tag concrete reply → ANSWER_ONLY (veto)
    }
    @Test void undo_withANewerOpenThreadForTheRule_staysClosed_butWithdrawsKnowledge() { }
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `TeamChatExceptionService`**

```java
@Slf4j @Service @RequiredArgsConstructor @ConditionalOnProperty(/* five switches */)
public class TeamChatExceptionService {
    private final TeamChatExceptionRepository exceptions;
    private final TeamChatExceptionHitRepository hits;
    private final TeamChatThreadRepository threads;
    private final TeamChatLineRepository lines;
    private final TeamChatProperties properties;
    private final KnowledgeFactService knowledge;
    private final List<NarrativeNoteSource> noteSources;   // companion port; empty list when none

    public record Gate(Kind kind, TeamChatExceptionEntity exception, long hits) {
        public enum Kind { NONE, SKIP, EXCUSE, REVIEW }
        static Gate none() { return new Gate(Kind.NONE, null, 0); }
    }

    /** Joins claimThread's transaction. Order: review (cap reached, not yet reviewed this window)
     *  → day texts name the context (silent hit) → excuse question. */
    @Transactional
    public Gate gate(UUID userId, String flagKey, Instant at) {
        List<TeamChatExceptionEntity> active =
                exceptions.findByCreatedByAndFlagKeyAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(userId, flagKey);
        if (active.isEmpty()) return Gate.none();
        LocalDate day = at.atZone(properties.zone()).toLocalDate();
        for (TeamChatExceptionEntity e : active) {
            long n = windowHits(e, day);
            if (n >= properties.exceptionReviewHits() && !reviewedThisWindow(userId, e)) {
                return new Gate(Gate.Kind.REVIEW, e, n);
            }
        }
        List<String> texts = dayTexts(userId, day);
        for (TeamChatExceptionEntity e : active) {
            if (TeamChatExceptionMatcher.matches(e.getKeywords().keywords(), texts)) {
                if (!hits.existsByExceptionIdAndHitOnAndDeletedFalse(e.getId(), day)) {
                    saveHit(userId, e.getId(), day, "NOTES", null);
                }
                return new Gate(Gate.Kind.SKIP, e, 0);
            }
        }
        // An exception already hit today (e.g. tapped) also skips — the rule fired again the same day.
        for (TeamChatExceptionEntity e : active) {
            if (hits.existsByExceptionIdAndHitOnAndDeletedFalse(e.getId(), day)) return new Gate(Gate.Kind.SKIP, e, 0);
        }
        return new Gate(Gate.Kind.EXCUSE, active.getFirst(), 0);
    }

    /** Hits since max(windowStartedAt's day, day − (window − 1)) — lesson 25's floor. */
    long windowHits(TeamChatExceptionEntity e, LocalDate day) {
        LocalDate floor = day.minusDays(properties.exceptionWindowDays() - 1L);
        LocalDate started = e.getWindowStartedAt().atZone(properties.zone()).toLocalDate();
        return hits.countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(e.getId(), started.isAfter(floor) ? started : floor);
    }

    private boolean reviewedThisWindow(UUID userId, TeamChatExceptionEntity e) {
        return threads.findFirstByCreatedByAndExceptionIdAndOfferAndOpenedAtGreaterThanEqualAndDeletedFalse(
                userId, e.getId(), TeamChatService.OFFER_REVIEW, e.getWindowStartedAt()).isPresent();
    }

    private List<String> dayTexts(UUID userId, LocalDate day) {
        List<String> out = new ArrayList<>();
        for (NarrativeNoteSource s : noteSources) {
            try { s.notesOn(userId, day).forEach(n -> out.add(n.text())); }
            catch (RuntimeException ex) { log.warn("Note source {} failed for exception match", s.kind(), ex); }
        }
        Instant from = day.atStartOfDay(properties.zone()).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(properties.zone()).toInstant().minusNanos(1000);
        lines.findByCreatedByAndKindAndOccurredAtBetweenAndDeletedFalse(userId, TeamChatService.KIND_USER, from, to)
                .forEach(l -> out.add(l.getBody()));
        return out;
    }

    /** The one-tap answers. Row-locked; idempotent per choice; 409 on a mismatched offer. */
    @Transactional
    public TeamChatThreadEntity answer(UUID userId, UUID threadId, String choice) { /*
        thread = threads.lockOwned(threadId, userId).orElseThrow(404 CHARACTER_TEAM_CHAT_NOT_FOUND);
        expected: EXCUSED ↔ offer EXCUSE; KEEP|STOP ↔ offer REVIEW; else 409 CHARACTER_TEAM_CHAT_ANSWER_CONFLICT.
        if thread RESOLVED: if the recorded outcome matches the choice (EXCUSED→closeReason EXCUSED;
          KEEP→EXCUSED; STOP→REPLY) return it (idempotent), else 409.
        e = exceptions.findById(thread.exceptionId);
        EXCUSED: hit TAP (skip if today has one), close EXCUSED closeNote e.contextTag,
                 write REPLY line voiced=false body "Rendben, így már értem. ✔" — NO emoji: use
                 "Rendben, akkor ez most is kivétel volt."
        KEEP: e.windowStartedAt = now; close EXCUSED closeNote e.contextTag; REPLY "Rendben, akkor marad így — tovább figyelek."
        STOP: e.active=false; knowledge.muteFromTeamChat(userId, e.knowledgeFactId); close REPLY closeNote
              "kivétel kikapcsolva"; REPLY "Rendben, akkor újra szólok, ha előjön."
        return thread; */ }

    /** Undo the chip: withdraw the knowledge (durable veto) and, when possible, reopen. */
    @Transactional
    public TeamChatThreadEntity undoRemembered(UUID userId, UUID threadId) { /*
        thread = lockOwned or 404; e = exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(threadId, userId) or 404;
        if e.active: e.active=false; knowledge.muteFromTeamChat(userId, e.knowledgeFactId);
           hits.findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(e.id, threadId, "REPLY").ifPresent(h → h.setDeleted(true));
        if thread.status RESOLVED ∧ closeReason REPLY ∧ no OTHER OPEN thread for (user, flagKey):
           status OPEN, closedAt null, closeReason null, closeNote null.
        idempotent: a second call finds e inactive and the thread already OPEN → returns it unchanged. */ }
}
```

The REPLY-line bodies in `answer()` are fixed, server-written, number-free and emoji-free. Use exactly:
- EXCUSED: `Rendben, akkor ez most is kivétel volt.`
- KEEP: `Rendben, akkor marad így — tovább figyelek.`
- STOP: `Rendben, akkor újra szólok, ha előjön.`

They are written via `teamChat.writeLine(thread, KIND_REPLY, owner, body, false, List.of(), now)`.

`OwnedEntity` exposes the soft-delete flag; check its setter name (`setDeleted`) before use.

- [ ] **Step 4: Wire the gate into `claimThread`**

After the OPEN-dedupe check and before `capReached`:

```java
        TeamChatExceptionService.Gate gate = exceptionGate.getIfAvailable() == null
                ? TeamChatExceptionService.Gate.none() : exceptionGate.getObject().gate(userId, flagKey, at);
        if (gate.kind() == TeamChatExceptionService.Gate.Kind.SKIP) {
            log.info("Team chat {} for user {} skipped — known exception '{}' named today", flagKey, userId,
                    gate.exception().getContextTag());
            return Optional.empty();
        }
```

`exceptionGate` is an `ObjectProvider<TeamChatExceptionService>` field, which avoids a constructor cycle since `TeamChatExceptionService` doesn't depend on `TeamChatService`.

When building the draft thread and `gate.kind()` is EXCUSE or REVIEW: set `draft.setOffer(...)` and `draft.setExceptionId(gate.exception().getId())`. The `Claim` then carries an overridden template text and `pushAllowed=false`. Extend `Claim` with `String templateOverride` and `boolean silent`; `openThread` uses `c.templateOverride() != null ? c.templateOverride() : c.picked().textHu()` for voicing, and `new Opened(..., c.silent() ? false : c.picked().pushAllowed(), ...)`.

Templates, with numbers only from these strings so the guard allows them. They are sentences the voice rephrases.
- EXCUSE: `"Tudom, hogy " + lowerFirst(e.getFactText()) + " Ma is ez volt a helyzet?"`. If `factText` does not end in punctuation, add `.`.
- REVIEW: `"Az utóbbi időben " + gate.hits() + " alkalommal jött elő ez a kivétel: " + e.getContextTag() + ". Ez még rendben van így?"`

The voice's `helyzet:` stays "most kapcsolt be" (open). The template is the teendő the model rephrases, so no voice-writer change is needed.

Pass the template in the facts list too, so its number is whitelisted: `facts = concat(picked.facts(), [templateOverride])` for REVIEW only.

- [ ] **Step 5: Contract + controller**

Add the two operations to `character.yml` (copy the reply op's response blocks; add a 409 to `answer`). Add the schema:

```yaml
    TeamChatAnswerRequest:
      type: object
      required: [choice]
      properties:
        choice: { type: string, enum: [EXCUSED, KEEP, STOP] }
```

Regenerate (`api` → maven → later FE). Controller:

```java
    @Override
    public TeamChatThread answerTeamChatThread(UUID threadId, TeamChatAnswerRequest request) {
        TeamChatThreadEntity t = exceptionService().answer(currentUserId.get(), threadId, request.getChoice().getValue());
        return teamChatReads.getObject().thread(currentUserId.get(), t);
    }

    @Override
    public TeamChatThread undoTeamChatRemembered(UUID threadId) {
        TeamChatThreadEntity t = exceptionService().undoRemembered(currentUserId.get(), threadId);
        return teamChatReads.getObject().thread(currentUserId.get(), t);
    }
```

Add `TeamChatReads.thread(UUID userId, TeamChatThreadEntity t)`, which looks up the born exception and calls `toThread(t, born)`. `exceptionService()` mirrors `teamChat()` (404 when absent). Add the message key `CHARACTER_TEAM_CHAT_ANSWER_CONFLICT` wherever `CHARACTER_TEAM_CHAT_ACTION_CONFLICT` is defined (`grep -rn CHARACTER_TEAM_CHAT_ACTION_CONFLICT backend/src/main/resources`).

`TeamChatAnswerControllerIT`:
- `POST .../answer {choice: EXCUSED}` on an EXCUSE ügy → 200 `status RESOLVED`, `closeReason EXCUSED`;
- `{choice: KEEP}` on it → 409;
- `DELETE .../remembered` on a foreign ügy → 404;
- both endpoints → 404 when the team chat is switched off (extend `TeamChatApiSwitchOffIT`).

- [ ] **Step 6: Run** `-Dtest='TeamChatExceptionIT,TeamChatAnswerControllerIT,TeamChatApiSwitchOffIT,TeamChatServiceIT,TeamChatReplyIT,ArchitectureTest'` → PASS.

- [ ] **Step 7: Commit** `feat(character): known exceptions at open — silent hit, one-tap question, capped review + undo (mezo-d6ivw.7)`

---

### Task 8: Frontend data layer (api, hooks, mock, msw)

**Files:**
- Modify:
  - `frontend/src/data/character/teamChatApi.ts`
  - `teamChatHooks.ts`
  - `teamChatMock.ts`
  - `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/character/teamChatHooks.test.ts` (create or extend)

**Interfaces:**
- Produces:
  - `teamChatApi.answer(threadId, choice: 'EXCUSED' | 'KEEP' | 'STOP'): Promise<TeamChatThread>`
  - `teamChatApi.undoRemembered(threadId): Promise<TeamChatThread>`
  - `useTeamChatActions()` gains `answer(threadId, choice)` and `undoRemembered(threadId)`.
  - `reply` now also sets an "awaiting answer" marker: `awaiting: ReadonlySet<string>` (thread ids) is returned from `useTeamChatActions`. That marker is shared via a tiny module-level store or react-query cache key `['teamChat','awaiting']`; use the cache key.
  - `useTeamChat(date)`: while `awaiting` is non-empty, `refetchInterval` follows `TURN_FACT_POLL_DELAYS`. Import it from `data/me/peopleHooks.ts` and export it if it is not exported. After those delays run out, it falls back to 60s. A thread leaves `awaiting` when the day contains a REPLY line on it newer than the user's line.
  - `teamChatMock.ts`: `mockReplyAfter(day, threadId, text): TeamChatDay` appends a USER line and a synthetic falat REPLY. When `/meccs|kupa|meccsnap/i` matches, the thread gets `status RESOLVED`, `closeReason REPLY`, `closeNote 'meccsnap'` and `remembered {text:'Meccsnapokon későn eszel — ez rendben van.', contextTag:'meccsnap', active:true}`. Otherwise it gets a plain acknowledgement: `'Értem, köszönöm, hogy elmondtad.'`. Also add `mockAnswer` and `mockUndo` builders, plus one seeded EXCUSE-offer ügy in the mock day (a falat `late_eating` OPEN with `offer: 'EXCUSE'`) so the button is visible in mock mode.

- [ ] **Step 1: Regenerate types** `cd frontend && pnpm generate:api`, then confirm `TeamChatThread` has `closeReason`/`offer`/`remembered`.

- [ ] **Step 2: Failing hook tests** (msw for real mode, and the mock-mode branch):

```ts
it('mock reply with a concrete reason appends USER + REPLY and closes with remembered', async () => {
  const day = mockReplyAfter(MOCK_TEAM_CHAT_DAY, OPEN_ID, '10-kor ért véget a röpi kupa')
  const reply = day.lines.at(-1)!
  expect(reply.kind).toBe('REPLY')
  expect(reply.thread?.closeReason).toBe('REPLY')
  expect(reply.thread?.remembered?.text).toMatch(/Meccsnapokon/)
})
it('mock reply without a reason answers and keeps the ügy open', () => { /* status OPEN, body 'Értem, köszönöm…' */ })
it('real answer() posts the choice and invalidates the day', async () => { /* msw handler asserts body {choice:'EXCUSED'} */ })
it('real undoRemembered() sends DELETE', async () => { })
```

- [ ] **Step 3: Implement.**
  - Mock mode: `reply`, `answer` and `undoRemembered` update every cached `['teamChat', *]` day with `qc.setQueriesData({ queryKey: ['teamChat'] }, d => d && mockX(d, ...))`. They don't no-op anymore; the synthetic anchor idiom follows lesson 16.
  - Real mode: invalidate as today; `reply` also adds the thread id to `awaiting`.
  - msw `handlers.ts`: `POST */threads/:id/answer` returns a RESOLVED thread; `DELETE */threads/:id/remembered` returns an OPEN thread.

- [ ] **Step 4: Run** `cd frontend && CI=true pnpm vitest run src/data/character` and `CI=true VITE_USE_MOCK=false pnpm vitest run src/data/character` → PASS.

- [ ] **Step 5: Commit** `feat(fe): team chat answer/undo actions, awaiting-answer polling, mock reply flow (mezo-d6ivw.7)`

---

### Task 9: Frontend UI (after the prototype OK)

**Gate:** this task starts only after the owner approved the S7 prototype
(`docs/design_2.0/prototypes/uveg-uzenofal.html` `#elo` reply states). The prototype's markup and
CSS classes are the source for the class names below. If the prototype named them differently,
follow the prototype.

**Files:**
- Create:
  - `frontend/src/features/insights/components/teamchat/ReplyAfterlife.tsx`
  - `OfferButtons.tsx`
  - `ReplyAfterlife.test.tsx`
  - `OfferButtons.test.tsx`
  - `frontend/tests/layout/team-chat-reply.spec.ts`
- Modify:
  - `TeamChatPage.tsx`
  - `frontend/src/features/insights/boop-world.css`
  - `frontend/src/features/insights/pages/TeamChatPage.test.tsx` (if present)

**Interfaces:**
- Consumes: `useTeamChatActions().{answer, undoRemembered, awaiting}`, `TeamChatThread.{closeReason, closeNote, offer, remembered}`.
- Produces:
  - `<TypingRow character={TeamCharacterId} />`: `"Falat ír…"` with three dots. Its animation follows the reduced-motion branch (static dots).
  - `<CloseTag thread />`: rendered under a REPLY line whose thread is RESOLVED.
    - `closeReason REPLY` renders `"{Name} lezárta: {closeNote}"`.
    - `EXCUSED` renders `"Kivétel: {closeNote}"`.
    - Both carry the `csendben` pill.
  - `<RememberedChip thread onUndo />`: `"Megjegyeztem: {remembered.text}"` + `Visszavonom` (the `RememberedChips` visual idiom, reusing its CSS classes `mzc-remchip` etc.). It shows only while `remembered.active`. After undo it shows a single muted line `"Visszavonva — nem jegyeztem meg."`.
  - `<OfferButtons thread onAnswer busy />`:
    - EXCUSE: one button `"Igen, {contextTag} volt"`. `contextTag` comes from the remembered/exception. The thread's `closeNote` is null while OPEN, so the backend must also expose the offer's tag: add `offerTag` (nullable string) to `TeamChatThread` in Task 2's contract, mapped from the thread's exception `contextTag`. **Go back and add it in Task 2 if it is not there.**
    - REVIEW: two buttons, `"Rendben van"` (KEEP) and `"Nem, figyelj rá"` (STOP).
    - An error line on failure, using the `applyFailed` idiom.

- [ ] **Step 1: Failing component tests**

```tsx
it('shows the typing row while an answer is awaited', () => {
  render(<TypingRow character="falat" />)
  expect(screen.getByRole('status')).toHaveTextContent('Falat ír…')
})
it('renders the close tag and the remembered chip, and undo calls back', async () => {
  const onUndo = vi.fn().mockResolvedValue(undefined)
  render(<RememberedChip thread={{ ...resolvedThread, remembered: { text: 'Meccsnapokon későn eszel — ez rendben van.', contextTag: 'meccsnap', active: true } }} onUndo={onUndo} />)
  expect(screen.getByText(/Megjegyeztem:/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
  expect(onUndo).toHaveBeenCalledWith(resolvedThread.id)
})
it('excuse offer shows one tap with the tag; review shows two', async () => { /* … */ })
it('never renders offer buttons on a closed ügy', () => { /* … */ })
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement + wire into `TeamChatPage`**:
  - `ChatLine` renders `line.kind === 'REPLY'` as the owner's bubble (same markup as an owner line, no trio).
  - A REPLY line with `thread?.status === 'RESOLVED' && thread.closeReason` renders `CloseTag`, plus `RememberedChip` when `thread.remembered`.
  - `live && thread.offer` renders `OfferButtons` above the trio.
  - After the last line of a thread id in `awaiting`, render `TypingRow`.
  - Replace `REPLY_INTRO.tell` with `'Mi az, amit csak te tudhatsz erről? {Karakter} válaszol rá — ha konkrét okot mondasz (meccs, utazás, betegség), le is zárja az ügyet, és megjegyzi.'`. It is built from the thread owner's name, so `REPLY_INTRO` becomes a function of `(mode, ownerName)`.
  - Change the RESOLVE tag's `a lezárás sosem értesít` to `csendben`.
  - Follow the prototype's CSS; add styles to `boop-world.css` under a `/* S7 csapatfal-válasz */` block. Dark only. No glass inside glass: the chip and tag are flat.

- [ ] **Step 4: Layout spec** `frontend/tests/layout/team-chat-reply.spec.ts`: in mock mode, open `/mezo/elo` at 320px. Reply with "10-kor ért véget a röpi kupa". Expect:
  - the REPLY bubble, the close tag and the chip to be visible;
  - no horizontal overflow (`document.documentElement.scrollWidth <= 320`).

  Copy the setup from an existing `frontend/tests/layout/*.spec.ts` that visits `/mezo/elo`; grep for it first.

- [ ] **Step 5: Run**
  - `CI=true pnpm vitest run src/features/insights` in both modes → PASS
  - `pnpm build` → PASS
  - `pnpm exec playwright test tests/layout/team-chat-reply.spec.ts` → PASS

- [ ] **Step 6: Commit** `feat(fe): the csapatfal answers — typing row, close tag, Megjegyeztem chip, one-tap offers (mezo-d6ivw.7)`

---

### Task 10: Docs, stale claims, codemap, runtime verify

**Files:**
- `docs/features/character.md`: the Csapat-chat §:
  - reply → answer → close/remember;
  - exceptions, gate order, review cap;
  - the knowledge adapter;
  - fix `:374-375,406-407,468-470`.
- `docs/features/insights.md`: reply row (~845): it renders whenever an OPEN ügy exists; typing row, chip, offer buttons.
- `docs/superpowers/specs/2026-09-26-csapat-elo-beszelgetes-design.md`: at `:224-225`, add a dated amendment note ("2026-09-27, owner decision: a concrete explanation may close — see emlékezete spec §S7").
- `docs/features/companion.md`: the `team_chat` knowledge source + provenance.
- `docs/features/admin-hub.md`: if the labels files are in its key_files, touch its date/notes (lesson 14).
- `docs/CODEMAP.md`: `node scripts/gen-codemap.mjs`.

- [ ] **Step 1:** Write the doc updates (knowledge-base skill conventions: the 10-section feature doc shape; edit the existing sections, don't append a changelog).
- [ ] **Step 2:** Run `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs` → clean.
- [ ] **Step 3: Runtime verify** (the `verify` skill, mock mode, in-app browser via an HTTP-served preview; dark, 320px, and reduced motion). Checks:
  - reply with a concrete reason → typing row → answer → close tag → chip → undo reopens;
  - EXCUSE offer tap closes;
  - REVIEW shows two buttons.

  Screenshot each state for the owner report.
- [ ] **Step 4: Full backend suite** `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true` → green (this touches migrations and a shared entity, so it is warranted).
- [ ] **Step 5: Commit** `docs: S7 csapatfal reply — character/insights/companion docs, stale claims fixed, codemap (mezo-d6ivw.7)`

---

## Merge notes (for the executor)

- **S6 (`mezo-d6ivw.6`) is in flight on `knowledge_fact`.** Before merging:
  - `git fetch && git rebase origin/main`;
  - if S6 landed a `ck_knowledge_fact_source` change, keep its values in the S7 migration's list;
  - ask the owner for a short merge window (memory: ask-for-a-merge-window-up-front).
- After every merge: `node scripts/gen-codemap.mjs` (CODEMAP entries silently drop).
- Merge: `git checkout --detach origin/main && git merge --no-ff feat/emlekezet-s7 && node scripts/gen-codemap.mjs && git push origin HEAD:main`, then watch `deploy`.
