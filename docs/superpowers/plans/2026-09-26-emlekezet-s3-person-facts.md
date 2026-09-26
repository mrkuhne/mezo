# S3 Person Fact Memory Implementation Plan (mezo-d6ivw.3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalized per-fact person memory: a `person_fact` table (5 kinds), extraction from chat turns and the nightly pipeline, a post-hoc "Megjegyeztem" chip with undo in chat, consumption in the `[Emberek]` snapshot block, and management on the person page.

**Architecture:** Storage + service live in `feature/people` (`PersonFactService` is the people-owned write port); both extraction writers live in `feature/companion` and reach people beans via `ObjectProvider` (ArchUnit: companion → people only, never reverse). The chip is FE state fed by a polling fetch endpoint — **no `MessageResponse` change**; only `people.yml` changes.

**Tech Stack:** Spring Boot + Liquibase + JPA (OwnedEntity/soft-delete idiom), contract-first OpenAPI (`api/feature/people/people.yml`), React + TanStack Query dual-mode data layer.

**Spec:** `docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md` §S3 + "S3 delta" section (owner-approved 2026-09-26).

## Global Constraints

- Kinds, verbatim: `preference | relationship_state | shared_activity | important_date | sensitivity`. Volatile kinds (supersede-not-append): `relationship_state` only.
- Facts ONLY about existing **active** persons; unresolved/low-confidence names → NO fact (the nightly candidate path already covers new names, incl. from chat — `gatherNarrative` reads CHAT).
- `sensitivity` facts: chat context yes, proactive/message pipeline NEVER (S5 enforces; S3 exposes the rule as a constant).
- Undo = `active=false` (NOT soft delete); an undone fact's normalized text is a durable per-person veto — never re-captured.
- No new feature switch. Chat writer: `COMPANION ∧ COMPANION_EXTRACTION` bean gate + `ObjectProvider<PersonFactService>` (PEOPLE). Nightly inherits `COMPANION ∧ PEOPLE`.
- New LLM slug `companion_person_fact_extract` needs an FE admin label (`labels.completeness.test.ts` gates it).
- `person.known_facts` stays read-only legacy/seed.
- Contract-first: edit `people.yml`, then `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. Never hand-write boundary DTOs.
- Backend tests: `./mvnw test -Dtest=<Class>` (focused). FE tests: `CI=true pnpm test` in BOTH modes (`VITE_USE_MOCK` unset AND `=false`). Midnight-safe fixtures (anchor to queried day).
- Commit subjects carry the bead id `(mezo-d6ivw.3)` + the Claude attribution trailer.
- UI is Üveg canon, dark only. **The chip + person-card prototype was owner-approved before FE tasks run** (session gate, not a subagent task).

---

### Task 1: `person_fact` table + entity + repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609261000_mezo-d6ivw.3_person_fact.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/entity/PersonFactEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/repository/PersonFactRepository.java`
- Test: covered by Task 2's service IT (repository has no logic of its own; a standalone entity round-trip test would duplicate it)

**Interfaces:**
- Produces: `PersonFactEntity` (getters/setters for all columns; constants `KIND_PREFERENCE`, `KIND_RELATIONSHIP_STATE`, `KIND_SHARED_ACTIVITY`, `KIND_IMPORTANT_DATE`, `KIND_SENSITIVITY`, `Set<String> KINDS`, `Set<String> VOLATILE_KINDS = Set.of(KIND_RELATIONSHIP_STATE)`, `SOURCE_CHAT_TURN = "chat_turn"`, `SOURCE_NIGHTLY_DAY = "nightly_day"`), `PersonFactRepository`.

- [ ] **Step 1: SQL changelog**

```sql
create table person_fact (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 person_id uuid not null,
 kind varchar(24) not null,
 fact_text varchar(300) not null,
 confidence varchar(8) not null,
 source_ref_kind varchar(24) not null,
 source_ref_id varchar(64) not null,
 active boolean not null default true,
 include_in_prompt boolean not null default true,
 seen_at timestamptz,
 constraint pk_person_fact_id primary key(id),
 constraint fk_person_fact_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_person_fact_person_id foreign key(person_id) references person(id) on delete cascade,
 constraint ck_person_fact_kind check(kind in ('preference','relationship_state','shared_activity','important_date','sensitivity')),
 constraint ck_person_fact_confidence check(confidence in ('low','medium','high')),
 constraint ck_person_fact_source_ref_kind check(source_ref_kind in ('chat_turn','nightly_day'))
);
create index idx_person_fact_person_id on person_fact(person_id);
create index idx_person_fact_source_ref on person_fact(created_by, source_ref_kind, source_ref_id);
```

- [ ] **Step 2: register in `1.1.0_master.yml`** (same shape as the `team_edition` entry):

```yaml
  - changeSet:
      id: "1.1.0:202609261000_mezo-d6ivw.3_person_fact"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609261000_mezo-d6ivw.3_person_fact.sql
```

- [ ] **Step 3: entity** — mirror `PersonEntity`'s idioms exactly (`OwnedEntity`, `@SQLDelete`/`@SQLRestriction`):

```java
package io.mrkuhne.mezo.feature.people.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * S3 (mezo-d6ivw.3): egy normalizált, forrás-hivatkozott tény egy ismert személyről. Az
 * {@code active} flag a visszavonás/nyugdíjazás célpontja (a soft delete-et csak a hub teljes
 * törlése használja majd, S6); egy inaktív sor normalizált szövege tartós vétó — a capture soha
 * nem menti újra. A legacy {@code person.known_facts} tömb read-only seed-adat marad.
 */
@Getter
@Setter
@Entity
@Table(name = "person_fact")
@SQLDelete(sql = "update person_fact set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PersonFactEntity extends OwnedEntity {

    public static final String KIND_PREFERENCE = "preference";
    public static final String KIND_RELATIONSHIP_STATE = "relationship_state";
    public static final String KIND_SHARED_ACTIVITY = "shared_activity";
    public static final String KIND_IMPORTANT_DATE = "important_date";
    public static final String KIND_SENSITIVITY = "sensitivity";
    public static final Set<String> KINDS = Set.of(KIND_PREFERENCE, KIND_RELATIONSHIP_STATE,
        KIND_SHARED_ACTIVITY, KIND_IMPORTANT_DATE, KIND_SENSITIVITY);
    /** Supersede-not-append: új azonos-fajta tény ugyanarról a személyről a régit deaktiválja. */
    public static final Set<String> VOLATILE_KINDS = Set.of(KIND_RELATIONSHIP_STATE);
    public static final String SOURCE_CHAT_TURN = "chat_turn";
    public static final String SOURCE_NIGHTLY_DAY = "nightly_day";
    public static final int FACT_TEXT_MAX_CHARS = 300;

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(name = "person_id", nullable = false, columnDefinition = "uuid") private UUID personId;
    @NotNull @Column(nullable = false) private String kind;
    @NotNull @Column(name = "fact_text", nullable = false) private String factText;
    @NotNull @Column(nullable = false) private String confidence; // low|medium|high (DB CHECK)
    @NotNull @Column(name = "source_ref_kind", nullable = false) private String sourceRefKind;
    @NotNull @Column(name = "source_ref_id", nullable = false) private String sourceRefId;
    @NotNull @Column(nullable = false) private boolean active = true;
    @NotNull @Column(name = "include_in_prompt", nullable = false) private boolean includeInPrompt = true;
    @Column(name = "seen_at") private Instant seenAt;
}
```

- [ ] **Step 4: repository**

```java
package io.mrkuhne.mezo.feature.people.repository;

import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonFactRepository extends JpaRepository<PersonFactEntity, UUID> {

    /** MINDEN nem törölt sor (aktív + visszavont) — a dedupe/vétó-ellenőrzés bemenete. */
    List<PersonFactEntity> findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, UUID personId);

    /** A chip-fetch: egy forrás (pl. egy chat-forduló) aktív tényei. */
    List<PersonFactEntity> findByCreatedByAndSourceRefKindAndSourceRefIdAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(
        UUID createdBy, String sourceRefKind, String sourceRefId);

    /** A snapshot-blokk: az aktív kör bekapcsolt tényei. */
    List<PersonFactEntity> findByCreatedByAndPersonIdInAndActiveTrueAndIncludeInPromptTrueAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, Collection<UUID> personIds);

    Optional<PersonFactEntity> findByIdAndCreatedByAndPersonIdAndDeletedFalse(
        UUID id, UUID createdBy, UUID personId);
}
```

- [ ] **Step 5: compile** — `./mvnw compile -q`. Expected: BUILD SUCCESS.
- [ ] **Step 6: commit** — `feat(people): person_fact table + entity + repository (mezo-d6ivw.3)`

---

### Task 2: `PersonFactService` — the people-owned write port

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonFactService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PersonFactServiceIT.java`

**Interfaces:**
- Consumes: Task 1's entity/repository; `PersonRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc` (existing).
- Produces (exact signatures — the writers and controller depend on these):

```java
public record PersonFactCapture(UUID personId, String kind, String text, String confidence) {}
public record KnownPerson(UUID id, String name, List<String> aliases) {}

List<PersonFactEntity> capture(UUID userId, String sourceRefKind, String sourceRefId,
        List<PersonFactCapture> captures);
void undo(UUID userId, UUID personId, UUID factId);           // active=false; 404 if foreign/missing
PersonFactEntity setIncludeInPrompt(UUID userId, UUID personId, UUID factId, boolean include);
List<PersonFactEntity> bySourceRef(UUID userId, String sourceRefKind, String sourceRefId);
void markSeen(UUID userId, UUID personId);                    // seen_at=now() where null
List<PersonFactEntity> promptFacts(UUID userId, Collection<UUID> personIds); // active && includeInPrompt
List<KnownPerson> knownPersons(UUID userId);                  // status=active persons (id, name, aliases)
List<PersonFactEntity> byPerson(UUID userId, UUID personId);  // ACTIVE rows, newest first (bootstrap)
```

- [ ] **Step 1: write the failing IT** (`@SpringBootTest` IT idiom of `FactExtractionServiceIT` — copy its class-level harness). Cases:

```java
// 1. capture persists a fact for an active person; kind/confidence/sourceRef stored; active+includeInPrompt true
// 2. capture SKIPS: unknown kind, blank text, text > 300 chars (dropped, others still saved)
// 3. normalized-text dedupe: same fact text (case/whitespace-insensitive) for the same person → not saved again
// 4. durable veto: undo(fact) then capture(same text) → still absent (only the inactive row exists)
// 5. supersede: capture relationship_state F2 when active relationship_state F1 exists → F1.active=false, F2 active
//    (non-volatile kinds accumulate: two different preference texts both stay active)
// 6. per-source cap: 4 captures in one call → only 3 persisted (MAX_FACTS_PER_SOURCE = 3)
// 7. undo on a foreign/missing fact → ResourceNotFoundException (house 404 exception)
// 8. setIncludeInPrompt flips the flag and returns the row; promptFacts excludes flipped-off and inactive rows
// 9. markSeen stamps only null seen_at rows; knownPersons returns only status='active' persons
```

- [ ] **Step 2: run it** — `./mvnw test -Dtest=PersonFactServiceIT` — expect compile failure / red.
- [ ] **Step 3: implement.** Key logic (mirror `PeopleService` idioms — `@Service`, `@ConditionalOnProperty(FeaturesConfiguration.PEOPLE_SWITCH)`, `@Transactional` on mutators, the house `ResourceNotFoundException` for 404s):

```java
static final int MAX_FACTS_PER_SOURCE = 3;

@Transactional
public List<PersonFactEntity> capture(UUID userId, String sourceRefKind, String sourceRefId,
        List<PersonFactCapture> captures) {
    List<PersonFactEntity> saved = new ArrayList<>();
    for (PersonFactCapture c : captures) {
        if (saved.size() >= MAX_FACTS_PER_SOURCE) break;
        if (c.text() == null || c.text().isBlank() || c.text().trim().length() > PersonFactEntity.FACT_TEXT_MAX_CHARS
                || !PersonFactEntity.KINDS.contains(c.kind())) continue;
        List<PersonFactEntity> existing = personFactRepository
            .findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(userId, c.personId());
        String normalized = normalize(c.text());
        boolean duplicate = existing.stream().anyMatch(f -> normalize(f.getFactText()).equals(normalized));
        if (duplicate) continue; // aktív duplum VAGY visszavont vétó — egyik sem íródik újra
        if (PersonFactEntity.VOLATILE_KINDS.contains(c.kind())) {
            existing.stream().filter(f -> f.isActive() && c.kind().equals(f.getKind()))
                .forEach(f -> { f.setActive(false); personFactRepository.save(f); });
        }
        PersonFactEntity fact = new PersonFactEntity();
        fact.setCreatedBy(userId);
        fact.setPersonId(c.personId());
        fact.setKind(c.kind());
        fact.setFactText(c.text().trim());
        fact.setConfidence(PersonFactEntity /* low|medium|high whitelist */.KINDS.contains(c.confidence())
            ? "medium" : c.confidence()); // see note below
        fact.setSourceRefKind(sourceRefKind);
        fact.setSourceRefId(sourceRefId);
        saved.add(personFactRepository.save(fact));
    }
    return saved;
}
private static String normalize(String text) { return text.trim().toLowerCase().replaceAll("\\s+", " "); }
```

  Note on confidence: whitelist is `Set.of("low","medium","high")` (a private constant `CONFIDENCES` in the service — the snippet above marks the spot); an unknown value falls back to `"medium"`, never rejects the fact.
  `knownPersons` filters `personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc` on `"active".equals(p.getStatus())`.
- [ ] **Step 4: run** — `./mvnw test -Dtest=PersonFactServiceIT` — expect PASS.
- [ ] **Step 5: commit** — `feat(people): PersonFactService capture/undo/toggle/supersede (mezo-d6ivw.3)`

---

### Task 3: contract + controller + mapper (`people.yml`)

**Files:**
- Modify: `api/feature/people/people.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/controller/PeopleController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/mapper/PeopleMapper.java` (add fact mapping; follow its existing style)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java` (bootstrap gains facts per person)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PersonFactControllerIT.java` (the house controller-IT idiom — copy the harness of the existing people controller IT)

**Interfaces:**
- Consumes: Task 2's `PersonFactService`.
- Produces (wire, exact): `PersonFactResponse {id, personId, kind, factText, confidence, sourceRefKind, active, includeInPrompt, seen: boolean, createdAt}`; `PersonResponse.facts: PersonFactResponse[]` (required, ACTIVE facts only); endpoints `getFactsBySource`, `undoPersonFact`, `updatePersonFact`, `markPersonFactsSeen`.

- [ ] **Step 1: extend `people.yml`.** New paths (response/error shapes copied from the `deleteMention` / `decidePerson` entries — 401/404 with `SystemMessageList`):

```yaml
  /api/people/facts:
    get:
      tags: [People]
      operationId: getFactsBySource
      summary: Active person facts captured from one source (the chat chip's post-hoc fetch)
      parameters:
        - { name: sourceRefKind, in: query, required: true, schema: { type: string, enum: [chat_turn, nightly_day] } }
        - { name: sourceRefId, in: query, required: true, schema: { type: string, maxLength: 64 } }
      responses:
        '200':
          description: Facts captured from that source (empty array while extraction is still running)
          content:
            application/json:
              schema: { type: array, items: { $ref: '#/components/schemas/PersonFactResponse' } }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/people/{personId}/facts/{factId}:
    delete:
      tags: [People]
      operationId: undoPersonFact
      summary: Undo/retire a person fact (active=false; its text becomes a durable no-recapture veto)
      parameters:
        - { name: personId, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: factId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Deactivated }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Fact missing, foreign, or belongs to a different person (indistinguishable), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    patch:
      tags: [People]
      operationId: updatePersonFact
      summary: Per-fact prompt toggle
      parameters:
        - { name: personId, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: factId, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UpdatePersonFactRequest' }
      responses:
        '200':
          description: The updated fact
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PersonFactResponse' }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Fact missing or foreign, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/people/{personId}/facts/seen:
    post:
      tags: [People]
      operationId: markPersonFactsSeen
      summary: Mark the person's unseen (nightly-captured) facts as seen
      parameters:
        - { name: personId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Stamped }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

  New schemas + `PersonResponse` change:

```yaml
    UpdatePersonFactRequest:
      type: object
      required: [includeInPrompt]
      properties:
        includeInPrompt: { type: boolean }
    PersonFactResponse:
      type: object
      required: [id, personId, kind, factText, confidence, sourceRefKind, active, includeInPrompt, seen, createdAt]
      properties:
        id: { type: string, format: uuid }
        personId: { type: string, format: uuid }
        kind: { type: string, enum: [preference, relationship_state, shared_activity, important_date, sensitivity] }
        factText: { type: string, maxLength: 300 }
        confidence: { type: string, enum: [low, medium, high] }
        sourceRefKind: { type: string, enum: [chat_turn, nightly_day] }
        active: { type: boolean }
        includeInPrompt: { type: boolean }
        seen: { type: boolean }
        createdAt: { type: string, format: date-time }
```

  In `PersonResponse`: add `facts` to the `required` list and `facts: { type: array, items: { $ref: '#/components/schemas/PersonFactResponse' } }` to properties. Also fix the stale copy in the SAME edit (S3 doc-staleness mandate): the `updatePerson` summary (line ~56) and the `knownFacts` description become "legacy/seed, read-only" instead of "AI-curated".
- [ ] **Step 2: regenerate** — `cd api/generate && npm run generate:api`, then `./mvnw compile -q` (backend now implements the new `PeopleApi` methods — expect compile error until Step 3).
- [ ] **Step 3: implement controller + service + mapper.** Controller delegates like every sibling:

```java
@Override
public List<PersonFactResponse> getFactsBySource(String sourceRefKind, String sourceRefId) {
    return service.factsBySource(currentUserId.get(), sourceRefKind, sourceRefId);
}
@Override
public void undoPersonFact(UUID personId, UUID factId) {
    personFactService.undo(currentUserId.get(), personId, factId);
}
@Override
public PersonFactResponse updatePersonFact(UUID personId, UUID factId, UpdatePersonFactRequest req) {
    return mapper.toFactResponse(personFactService.setIncludeInPrompt(
        currentUserId.get(), personId, factId, req.getIncludeInPrompt()));
}
@Override
public void markPersonFactsSeen(UUID personId) {
    personFactService.markSeen(currentUserId.get(), personId);
}
```

  (`factsBySource` on `PeopleService` simply maps `personFactService.bySourceRef(...)` via the mapper — or put the mapping call in the controller; follow whichever direction `PeopleMapper` is already used from. Wire mapping: `seen = f.getSeenAt() != null`.) `PeopleService.getBootstrap` fills `facts` per person from `personFactService.byPerson(...)` — ACTIVE rows only; also fix the stale `:301` javadoc line here (Task 9 covers the doc files, this line is code).
- [ ] **Step 4: write + run the controller IT** — happy path per endpoint, 404 on foreign fact, bootstrap carries facts. `./mvnw test -Dtest=PersonFactControllerIT` → PASS.
- [ ] **Step 5: commit** — `feat(people): person-fact endpoints + bootstrap facts (mezo-d6ivw.3)`

---

### Task 4: chat writer — `PersonFactExtractionListener` + service

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PersonFactExtractionListener.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PersonFactExtractionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (marker dispatch branch)
- Modify: `frontend/src/features/admin/lib/labels.ts` (slug label)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PersonFactExtractionServiceIT.java`

**Interfaces:**
- Consumes: `ChatTurnCompleted` event; `PersonFactService.knownPersons/capture` via `ObjectProvider` (Task 2).
- Produces: `PersonFactExtractionService.PERSON_FACT_MARKER = "SZEMÉLYTÉNY"` (FakeCompanionLlm keys on it).

- [ ] **Step 1: failing IT** (harness copied from `FactExtractionServiceIT`). Cases:

```java
// 1. turn mentioning a known active person with a durable statement → one person_fact row (via FakeCompanionLlm's canned answer)
// 2. name not among known persons → no fact row (and no person row — the nightly path owns candidates)
// 3. PEOPLE off (PersonFactService bean absent) → extraction is a silent no-op, no exception
// 4. LLM garbage answer → zero facts, no exception
```

- [ ] **Step 2: run** — `./mvnw test -Dtest=PersonFactExtractionServiceIT` — red.
- [ ] **Step 3: implement.** Listener = verbatim `FactExtractionListener` shape (same `@ConditionalOnProperty` pair `COMPANION_SWITCH` + `COMPANION_EXTRACTION_SWITCH`, `@Async` AFTER_COMMIT, `LlmActorContext.runAsCaptured`, swallow-and-warn), delegating to `personFactExtractionService.extractFromTurn(event.userId(), event.userMessageId(), event.userContent(), event.assistantContent())`.

  Service core:

```java
public static final String PERSON_FACT_MARKER = "SZEMÉLYTÉNY";

static final String PROMPT = """
        SZEMÉLYTÉNY. A beszélgetés-fordulóból gyűjtsd ki az ISMERT SZEMÉLYEKRŐL szóló ÚJ, tartós tényeket
        — kizárólag azt, amit {{NÉV}} maga állított. NEM {{NÉV}}-ről: róla más gyűjtő gondoskodik.
        Fajták: preference (mit szeret/nem szeret), relationship_state (a kapcsolat mostani állapota),
        shared_activity (közös, ismétlődő tevékenység), important_date (fontos dátum),
        sensitivity (mire érzékeny, mivel bánj óvatosan).
        Csak az ISMERT SZEMÉLYEK listáján szereplő nevekhez írj tényt; bizonytalan egyezésnél hagyd ki.
        Egyszeri eseményt, kérdést, feltételezést NE vegyél fel.
        Válaszolj KIZÁRÓLAG egy JSON tömbbel:
        [{"name":"...","kind":"preference","fact":"...","confidence":"low|medium|high"}]
        Ha nincs ilyen tény: []""";

record ExtractedPersonFact(String name, String kind, String fact, String confidence) {}

public int extractFromTurn(UUID userId, UUID userMessageId, String userContent, String assistantContent) {
    PersonFactService facts = personFactService.getIfAvailable();
    if (facts == null) return 0;
    List<PersonFactService.KnownPerson> known = facts.knownPersons(userId);
    if (known.isEmpty()) return 0;
    String names = known.stream().map(PersonFactService.KnownPerson::name).collect(Collectors.joining(", "));
    String transcript = PromptPersona.USER_TURN_LABEL + userContent + "\nMezo: " + assistantContent
        + "\n\nISMERT SZEMÉLYEK: " + names;
    String raw;
    try {
        raw = llmCallContextHolder.runWith(
            new LlmCallContext("companion_person_fact_extract", "extract", null, null),
            () -> companionLlm.complete(promptPersona.render(userId, PROMPT), transcript));
    } catch (Exception e) {
        log.warn("Person-fact extraction LLM call failed for user {}", userId, e);
        return 0;
    }
    List<PersonFactService.PersonFactCapture> captures = parse(raw).stream()
        .map(f -> resolve(known, f))       // exact case-insensitive fold on name OR alias; null if no/ambiguous match
        .filter(Objects::nonNull)
        .toList();
    return facts.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, userMessageId.toString(), captures).size();
}
```

  `parse` is the same defensive first-`[`..last-`]` idiom as `FactExtractionService.parse`. `resolve` lower-cases with `Locale.forLanguageTag("hu")` fold and requires EXACTLY one known person whose name or alias equals the returned `name` — zero or 2+ matches → drop (owner decision: never guess). Uses the `PersonFactEntity` kind whitelist before building the capture.
  FakeCompanionLlm: add a `PERSON_FACT_MARKER` branch next to the `EXTRACTION_MARKER` one (line ~807) returning a deterministic array that names a seed person (inspect the neighboring branch for the canned-answer style — it must key off the transcript so test case 2 can return an unknown name).
  Admin label (`labels.ts`, alphabetical spot): `companion_person_fact_extract: { label: 'Személy-tény kinyerés', hint: 'tények a beszélgetésben említett emberekről' },`
- [ ] **Step 4: run** — `./mvnw test -Dtest=PersonFactExtractionServiceIT` → PASS; `CI=true pnpm test -- labels` is NOT scoped (memory: file filters don't scope) — run the FE labels gate as part of Task 8's FE run instead.
- [ ] **Step 5: commit** — `feat(companion): person-fact extraction from chat turns (mezo-d6ivw.3)`

---

### Task 5: nightly writer — extend `PersonExtractionService`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PersonExtractionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (extend the `[person-extractor]` canned answer with a `facts` array)
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PersonExtractionServiceIT.java` (existing class)

**Interfaces:**
- Consumes: `PersonFactService.capture` via a new `ObjectProvider<PersonFactService>` field (same idiom as `graphService`).
- Produces: `NightAnswer` gains `List<FactProposal> facts`; `public record FactProposal(String person, String kind, String fact, String confidence) {}`.

- [ ] **Step 1: failing IT cases** (in the existing IT class, existing harness):

```java
// 1. nightly answer carrying a fact about a KNOWN person → person_fact row with sourceRefKind=nightly_day,
//    sourceRefId=day.toString(), seenAt null
// 2. fact naming an unknown person → no fact row (candidates unaffected)
// 3. a fact-persist failure (e.g. PersonFactService throwing via a broken personId) does NOT prevent
//    the night's mention enrichment from committing
```

- [ ] **Step 2: run** — `./mvnw test -Dtest=PersonExtractionServiceIT` — red.
- [ ] **Step 3: implement.**
  - `SYSTEM_PROMPT`: add a third task + the `facts` key to the JSON example:
    `3. TÉNYEK: ha a nap szövege TARTÓS tényt mond ki egy ISMERT személyről (preference | relationship_state | shared_activity | important_date | sensitivity), vedd fel a "facts" listába. Csak ismert névhez, bizonytalan egyezésnél hagyd ki.` and in the JSON sample: `"facts": [{"person":"Név","kind":"preference","fact":"...","confidence":"medium"}]`.
  - `NightAnswer(List<Enrichment> mentions, List<CandidateProposal> candidates, List<FactProposal> facts)`; `parse` tolerates a missing `facts` key (empty list).
  - New `validFacts(NightAnswer answer, List<PersonEntity> persons)`: kind ∈ `PersonFactEntity.KINDS`, non-blank fact ≤300 chars, `person` resolves to exactly one ACTIVE `PersonEntity` by hu-fold name/alias equality → maps to `PersonFactService.PersonFactCapture`.
  - In `extractFor`, AFTER the `persistNight` try/catch succeeds (and before the edge pass), its own try/catch:

```java
try {
    PersonFactService factService = personFactService.getIfAvailable();
    if (factService != null && !facts.isEmpty()) {
        factService.capture(userId, PersonFactEntity.SOURCE_NIGHTLY_DAY, day.toString(), facts);
    }
} catch (Exception e) {
    log.warn("Nightly person-fact persistence failed for {} on {} — mentions/candidates already committed", userId, day, e);
}
```

    (`capture` is itself `@Transactional` on the people side — a failure here can never mark `persistNight`'s already-committed TX; spec-lesson-11 shape.)
  - Both empty-result early-returns (`toneless.isEmpty() && narrative.isBlank()`, and the empty-enrichment/candidate gate) must ALSO attempt fact persistence when `facts` is non-empty — restructure the second gate to check `facts.isEmpty()` too.
- [ ] **Step 4: run** — `./mvnw test -Dtest=PersonExtractionServiceIT` → PASS.
- [ ] **Step 5: commit** — `feat(companion): nightly person-fact emission (mezo-d6ivw.3)`

---

### Task 6: consumption — snapshot block carries person facts

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonChatContext.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java` (`chatContext`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PeopleSnapshotBlock.java`
- Test: the existing `PeopleSnapshotBlock` unit test class + `PeopleService` IT (extend in place; find them via `grep -rl "PeopleSnapshotBlock\|chatContext" backend/src/test`)

**Interfaces:**
- Consumes: `PersonFactService.promptFacts` (Task 2) — called from `PeopleService.chatContext` (people-internal, no new companion edge).
- Produces: `PersonChatContext` gains `List<String> facts` (pre-formatted `"<hu-kind-label>: <text>"` strings, already capped).

- [ ] **Step 1: failing tests**

```java
// PeopleService.chatContext: person with 2 active+included facts → context.facts() carries both,
//   formatted "kedveli/nem szereti: …" style; inactive and includeInPrompt=false rows excluded;
//   facts capped at 3 per person (newest first)
// PeopleSnapshotBlock.line/render: a person with facts renders an indented continuation line
//   "  tudás: fact1 · fact2" (sanitized); a person without facts renders exactly as today
```

- [ ] **Step 2: run** — red.
- [ ] **Step 3: implement.**
  - `PersonChatContext`: add `List<String> facts` as the last component; update its javadoc — the "ismert tények … SOSEM utazik itt" sentence becomes: mention-quotes and notes still never travel; NORMALIZED person facts (S3, active + bekapcsolt) DO, capped.
  - `PeopleService.chatContext`: after building the circle, one `promptFacts(userId, circleIds)` call (projection-free is acceptable here — the rows are small and read-only; do NOT load them inside a write TX: `chatContext` is already `@Transactional(readOnly = true)`), group by personId, format with the hu kind labels `Map.of("preference","kedveli/nem szereti", "relationship_state","kapcsolat most", "shared_activity","közös", "important_date","fontos dátum", "sensitivity","érzékeny")`, cap 3/person.
  - `PeopleSnapshotBlock.line`: unchanged first line; when `p.facts()` non-empty append `"\n  tudás: " + facts joined with " · "` (each `sanitize`d). Update the class javadoc "ismert tény … SOSEM kerül ide" sentence the same way as the record's. Prompt budget guard: total block growth is bounded (max persons × 3 facts × 120 chars).
  - Add to the block (or `PersonFactService`) the S5 rule as a documented constant: `public static final Set<String> PROACTIVE_EXCLUDED_KINDS = Set.of(PersonFactEntity.KIND_SENSITIVITY);` — lives on `PersonFactService` (people owns the policy), with a javadoc naming the owner decision (2026-09-26: kényes tény kéretlen üzenetbe soha).
- [ ] **Step 4: run both test classes** → PASS.
- [ ] **Step 5: commit** — `feat(companion): person facts in the [Emberek] snapshot block (mezo-d6ivw.3)`

---

### Task 7: FE data layer — types, api, hooks, mocks

**Files:**
- Modify: `frontend/src/data/types.ts` (add `PersonFact`, extend `PersonEntry`)
- Modify: `frontend/src/data/me/peopleApi.ts`
- Modify: `frontend/src/data/me/peopleHooks.ts`
- Modify: `frontend/src/data/me/people.ts` (mock seeds get `facts`)
- Test: `frontend/src/data/me/peopleHooks.test.tsx` (extend)

**Interfaces:**
- Consumes: regenerated `api.gen.ts` (run `cd frontend && pnpm generate:api` first — Task 3 changed the contract).
- Produces (FE domain):

```ts
export type PersonFactKind = 'preference' | 'relationship_state' | 'shared_activity' | 'important_date' | 'sensitivity'
export interface PersonFact {
  id: string
  personId: string
  kind: PersonFactKind
  text: string
  confidence: 'low' | 'medium' | 'high'
  sourceKind: 'chat_turn' | 'nightly_day'
  includeInPrompt: boolean
  seen: boolean
  createdAt: string
}
// PersonEntry gains: facts: PersonFact[]
```

  Hook surface (consumed by Tasks 8–9): `usePeople()` additionally returns `undoFact(personId, factId)`, `toggleFact(personId, factId, includeInPrompt)`, `markFactsSeen(personId)`; new standalone hook `useTurnFacts(userMessageId: string | null)` returning `{ facts: PersonFact[], pending: boolean }`.

- [ ] **Step 1: regenerate types** — `cd frontend && pnpm generate:api`; commit the `api.gen.ts` diff together with this task.
- [ ] **Step 2: failing hook tests** (extend `peopleHooks.test.tsx`, its existing renderHook harness):

```ts
// mock mode: usePeople().people carry facts from the seed; undoFact removes the fact from the cache;
//   toggleFact flips includeInPrompt in place; markFactsSeen sets seen=true on that person's facts
// real mode (fetch mocked): undoFact DELETEs /api/people/:pid/facts/:fid then invalidates PEOPLE_KEY
// useTurnFacts: with a userMessageId, polls getFactsBySource; pending=true until a non-empty
//   response or the schedule (2s/5s/10s) is exhausted; null id → {facts: [], pending: false}
```

- [ ] **Step 3: implement.**
  - `peopleApi` additions:

```ts
getFactsBySource: (sourceRefKind: 'chat_turn' | 'nightly_day', sourceRefId: string) =>
  apiFetch<PersonFactResponse[]>(`${PEOPLE}/facts?sourceRefKind=${sourceRefKind}&sourceRefId=${sourceRefId}`),
undoFact: (personId: string, factId: string) =>
  apiFetch<void>(`${PEOPLE}/${personId}/facts/${factId}`, { method: 'DELETE' }),
toggleFact: (personId: string, factId: string, includeInPrompt: boolean) =>
  apiFetch<PersonFactResponse>(`${PEOPLE}/${personId}/facts/${factId}`, {
    method: 'PATCH', body: JSON.stringify({ includeInPrompt } satisfies UpdatePersonFactRequest) }),
markFactsSeen: (personId: string) =>
  apiFetch<void>(`${PEOPLE}/${personId}/facts/seen`, { method: 'POST' }),
```

    plus `toPersonFact(f: PersonFactResponse): PersonFact` (factText→text, sourceRefKind→sourceKind) wired into `toPersonEntry` (`facts: p.facts.map(toPersonFact)`).
  - `peopleHooks`: three mutations in the `usePeople` mock/real shape already used by `undoMention` (mock = cache surgery on `PEOPLE_KEY`, real = api + invalidate).
  - `useTurnFacts` (new export in `peopleHooks.ts`): real mode `useQuery` with `refetchInterval` stepping through 2000/3000/5000ms (a ref counting attempts; returns `false` to stop after the third empty response — facts found also stops), `enabled: !!userMessageId && !isMockMode()`. Mock mode: return the scripted fixture — `{facts: MOCK_TURN_FACTS, pending: false}` when `userMessageId` is set (the ChatPage mock flow supplies one after each send), so the chip is demonstrable offline.
  - `people.ts` seed: give two seed persons 2–3 facts each (id-stable strings, one with `seen: false` + `sourceKind: 'nightly_day'` to demo the "új" badge, one `sensitivity` kind), export `MOCK_TURN_FACTS: PersonFact[]` (one `preference` fact for a seed person).
- [ ] **Step 4: run** — `CI=true pnpm test` (mock) — the suite is unscopeable, expect full run green; then `CI=true VITE_USE_MOCK=false pnpm test`.
- [ ] **Step 5: commit** — `feat(fe): person-fact data layer + turn-facts polling hook (mezo-d6ivw.3)`

---

### Task 8: FE chip — "Megjegyeztem" in ChatPage (prototype-approved markup)

**Files:**
- Create: `frontend/src/features/insights/components/RememberedChips.tsx`
- Modify: `frontend/src/features/insights/pages/ChatPage.tsx`
- Modify: the chat page stylesheet it already uses (colocated css — follow the prototype's classes)
- Test: `frontend/src/features/insights/chatRemembered.test.tsx` (new)

**Interfaces:**
- Consumes: `useTurnFacts`, `usePeople().undoFact` (Task 7). The approved prototype's markup/classes are canon — copy them, do not redesign.

- [ ] **Step 1: failing component test**

```tsx
// after a completed turn (mock flow), the RememberedChips row renders "Megjegyeztem: <text>" with
//   a "Visszavonom" button; clicking it calls undoFact and removes the chip
// while pending=true a minimal indicator renders (the prototype's shimmer dot line, aria-label
//   "Mezo még figyel"); pending=false + no facts → nothing renders
// sensitivity-kind fact chip carries the discreet "érzékeny" tag from the prototype
```

- [ ] **Step 2: run** — red.
- [ ] **Step 3: implement.** `RememberedChips({ userMessageId })`: `useTurnFacts(userMessageId)` + local `undone: Set<string>` state; renders the pending indicator or the chip row per the prototype. In `ChatPage`, derive after each completed turn: `const lastUserMsgId = !turn ? [...messages].reverse().find(m => m.role === 'user' && m.id)?.id ?? null : null`, and render `<RememberedChips userMessageId={lastUserMsgId} />` after the message list (only when the last message overall is an assistant reply — no chip archaeology on old conversations: keep a `sessionSentRef` flag that arms the component only after a send in THIS session).
- [ ] **Step 4: run tests both modes** (`CI=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`) + `pnpm build`.
- [ ] **Step 5: commit** — `feat(fe): Megjegyeztem chip with undo + pending indicator (mezo-d6ivw.3)`

---

### Task 9: FE person page facts card + docs staleness fixes

**Files:**
- Modify: `frontend/src/features/me/pages/PersonDetailPage.tsx` (the "Amit Mezo tud" card, lines ~205–216)
- Modify: `docs/features/me.md` (line ~431 stale claim + key_files/behavior for facts)
- Modify: `docs/features/companion.md` (extraction writers section)
- Modify: `backend/.../people/entity/PersonEntity.java` javadoc + `PeopleService.java:301` javadoc (align on "legacy/seed, read-only" — if not already done in Task 3)
- Test: extend the existing PersonDetail layout/unit test (find via `grep -rl "PersonDetailPage" frontend/src --include=*.test.*` and `frontend/tests/layout`)

**Interfaces:**
- Consumes: `PersonEntry.facts`, `usePeople().toggleFact/undoFact/markFactsSeen` (Task 7). Prototype markup is canon.

- [ ] **Step 1: failing test** — card renders one row per ACTIVE fact (kind tag, text, provenance label "chatből · <date>" / "éjszakai jegyzetből · <date>", toggle, delete); unseen fact shows the "új" badge; mount calls `markFactsSeen(personId)` once when any fact is unseen; legacy `knownFacts` strings still render beneath as static entries.
- [ ] **Step 2: run** — red.
- [ ] **Step 3: implement** per the approved prototype (glass card, one accent, Icon3D kind icons, üveg §3.4 ranking — the card is NOT hero-glass). Delete button = `undoFact` (chip-undo semantics, same durable veto).
- [ ] **Step 4: docs.** `me.md`: fix the stale "Mentions do not feed the companion context snapshot yet" line, document the facts card + endpoints; `companion.md`: add the two person-fact writers; keep key_files ≤8. Run `node scripts/lint-docs.mjs` — the two touched docs must be clean.
- [ ] **Step 5: run** — FE tests both modes + affected `frontend/tests/layout` specs + `pnpm build`.
- [ ] **Step 6: commit** — `feat(fe): person page facts card + doc staleness fixes (mezo-d6ivw.3)`

---

### Task 10: gates, codemap, runtime verify

- [ ] **Step 1: backend focused suite** — `./mvnw test -Dtest='PersonFact*,PersonExtractionServiceIT,PeopleS*'` (adjust to actual class names) → PASS. ArchUnit: `./mvnw test -Dtest=ArchitectureTest` (companion→people direction, cycle freedom).
- [ ] **Step 2: FE gates** — `CI=true pnpm test` AND `CI=true VITE_USE_MOCK=false pnpm test` AND `pnpm build` (labels completeness runs inside the suite).
- [ ] **Step 3: codemap + docs** — `node scripts/gen-codemap.mjs` (new files moved in); `node scripts/lint-docs.mjs`.
- [ ] **Step 4: runtime verify** — the `verify` skill on the chat chip + person page, dark only, 320px, reduced motion.
- [ ] **Step 5: commit** — `chore: S3 gates + codemap (mezo-d6ivw.3)`

Merge/deploy/close follow the /emlekezet session driver (§5–6), not this plan.
