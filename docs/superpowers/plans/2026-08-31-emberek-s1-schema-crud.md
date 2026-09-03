# Emberek S1 — séma + kontraktus + person CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `person`/`mention` séma felkészítése a teljes Emberek-vízióra, és a person CRUD (create/update/soft-delete + aliasok) végpont-hármas + FE sheetek leszállítása — LLM és detektálás nélkül is teljes értékű termék.

**Architecture:** Contract-first bővítés a meglévő `feature/people` szeleten: Liquibase-migráció → `people.yml` bővítés → codegen → entity/mapper/service/controller → FE data-réteg (`useDualQuery`-s hookok, mock+real mutációk) → `PersonEditSheet`. A spec: `docs/superpowers/specs/2026-08-31-emberek-section-design.md` (§2, §3.1, §8/S1).

**Tech Stack:** SpringBoot + Liquibase + MapStruct + generated `PeopleApi`; React + TanStack Query + MSW + vitest.

## Global Constraints

- Hajtó bd issue: `mezo-06o0`; az S1 al-issue-t a Task 0 hozza létre — commit-subjectbe az al-issue id-ja kerül.
- Kontraktus-módosítás UTÁN mindig: `cd api/generate && npm run generate:api`, majd `cd frontend && pnpm generate:api`. Boundary DTO-t kézzel írni tilos; a generált DTO-k setterei void-ok (nincs chaining).
- Backend: konstruktor-injektálás, `@Transactional` csak metóduson, hibák `SystemRuntimeErrorException` + `SystemMessage`, `created_by` mindig a principálból. Soft delete `repository.delete(entity)`-n át.
- Backend teszt futtatás MINDIG: `cd backend && ./mvnw test -Dtest=<IT> -Dmezo.test.use-testcontainers=true` (a fixed-DB mód versenyhelyzetes).
- Frontend gate: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test` (worktree-ben a VITE_USE_MOCK-ot explicit kell adni).
- UI-szöveg magyar; ikon csak clay sprite, emoji tilos.
- `mention.tone` DB-szinten nullable lesz (S2 készül rá), de az entity `@NotNull`-ja és a `MentionResponse.tone` required marad S1-ben — a chip-út mindig ír tónust.
- Kontextus-címke zárt készlet mindenhol: `munka|csalad|baratok|edzes|konfliktus|kozos_program|segitseg|egyeb`.
- Relationship készlet bővül: `partner|friend|family|colleague|teammate|mentee` (DB CHECK + kontraktus-enum + FE type azonosan).

---

### Task 0: bd al-issue + branch ellenőrzés

**Files:** none (bd + git)

- [ ] **Step 1:** `bd create "Emberek S1: séma + kontraktus + person CRUD" -t task --deps mezo-06o0 -d "Spec: docs/superpowers/specs/2026-08-31-emberek-section-design.md §2 §3.1 §8/S1; plan: docs/superpowers/plans/2026-08-31-emberek-s1-schema-crud.md"` — jegyezd fel a kapott id-t (a továbbiakban `<S1>`), majd `bd update <S1> --claim`.
- [ ] **Step 2:** `git status` — a `claude/emberek-section-development-d4aa89` branchen dolgozunk, tiszta fával.

### Task 1: Liquibase-migráció — person + mention bővítés

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608311300_mezo-06o0.s1_person_mention_enrichment.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (végére új changeSet)

**Interfaces:**
- Produces: `person.aliases text[]`, `person.status`, `person.source_kind`; `mention.intensity`, `mention.context_label`, `mention.source_ref_kind`, `mention.source_ref_id`; bővített CHECK-ek; `uq_mention_source_ref` partial unique index.

- [ ] **Step 1: Írd meg a migrációt**

```sql
-- Emberek S1 (mezo-06o0): person CRUD + detektálás-kész séma (spec §2).
ALTER TABLE person
    ADD COLUMN aliases     TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN status      TEXT   NOT NULL DEFAULT 'active',
    ADD COLUMN source_kind TEXT   NOT NULL DEFAULT 'manual';
ALTER TABLE person
    ADD CONSTRAINT ck_person_status CHECK (status IN ('candidate','active','archived'));
ALTER TABLE person
    ADD CONSTRAINT ck_person_source_kind CHECK (source_kind IN ('manual','extractor','seed'));
ALTER TABLE person DROP CONSTRAINT ck_person_relationship;
ALTER TABLE person
    ADD CONSTRAINT ck_person_relationship
        CHECK (relationship IN ('partner','friend','family','colleague','teammate','mentee'));

ALTER TABLE mention
    ADD COLUMN intensity       SMALLINT,
    ADD COLUMN context_label   TEXT,
    ADD COLUMN source_ref_kind TEXT,
    ADD COLUMN source_ref_id   UUID;
ALTER TABLE mention
    ADD CONSTRAINT ck_mention_intensity CHECK (intensity BETWEEN 1 AND 3);
ALTER TABLE mention
    ADD CONSTRAINT ck_mention_context_label CHECK (context_label IN
        ('munka','csalad','baratok','edzes','konfliktus','kozos_program','segitseg','egyeb'));
ALTER TABLE mention
    ADD CONSTRAINT ck_mention_source_ref_kind CHECK (source_ref_kind IN
        ('journal_entry','reflection','gratitude','decision','activity_note','checkin_note','chat_turn'));
ALTER TABLE mention DROP CONSTRAINT ck_mention_source;
ALTER TABLE mention
    ADD CONSTRAINT ck_mention_source CHECK (source IN ('voice','camera','chip','text','chat'));
-- S2 (auto-mention) tónus nélkül ír; az enrichment tölti. Entity-szinten S1-ben még @NotNull.
ALTER TABLE mention ALTER COLUMN tone DROP NOT NULL;
-- Automata útvonal dedup-horgonya (S2 használja; már most létezik, hogy a séma egyben legyen).
CREATE UNIQUE INDEX uq_mention_source_ref
    ON mention (created_by, person_id, source_ref_kind, source_ref_id)
    WHERE source IN ('text','chat') AND is_deleted = false;
```

- [ ] **Step 2: Regisztráld a master yml-ben** (a fájl legvégére, a meglévő minta szerint):

```yaml
  - changeSet:
      id: "1.0.0:202608311300_mezo-06o0.s1_person_mention_enrichment"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608311300_mezo-06o0.s1_person_mention_enrichment.sql
```

- [ ] **Step 3: Futtasd a meglévő People IT-ket — a migrációnak tisztán kell lefutnia**

Run: `cd backend && ./mvnw test -Dtest='PeopleContractIT,PeopleServiceIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS (a Testcontainers-Postgres az új changesettel áll fel; regresszió nincs).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/changelog
git commit -m "feat(db): person/mention séma-bővítés az Emberek-vízióhoz (<S1>)"
```

### Task 2: Kontraktus-bővítés + codegen + olvasó-út (entity/mapper/DTO)

**Files:**
- Modify: `api/feature/people/people.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/entity/PersonEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/entity/MentionEntity.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/PersonPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleContractIT.java`
- Generated (ne kézzel): `api/openapi.yml`, backend `api.dto.*`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (kontraktus): `PersonResponse` + `aliases: string[]` (required), `status` enum required, `sourceKind` enum required; `MentionResponse` + `intensity?`, `contextLabel?`, `sourceRefKind?`; `relationship` enum mindkét irányban `[partner, friend, family, colleague, teammate, mentee]`; új sémák: `CreatePersonRequest`, `UpdatePersonRequest` (Task 3–4 használja); `LogMentionRequest` + `contextLabel?`.
- Produces (Java): `PersonEntity.aliases/status/sourceKind` getterek; `MentionEntity.intensity/contextLabel/sourceRefKind/sourceRefId`.

- [ ] **Step 1: Írd meg a bukó IT-t** — a `PeopleContractIT`-be új teszt:

```java
@Test
void testGetPeopleBootstrap_shouldCarryAliasesStatusAndSourceKind() {
    UUID owner = ownerId();
    PersonEntity p = personPopulator.createPerson(owner, "Marci", "friend", "positive");

    PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);

    assertThat(res.getPersons().getFirst().getAliases()).containsExactly("Marcika");
    assertThat(res.getPersons().getFirst().getStatus()).isEqualTo(PersonResponse.StatusEnum.ACTIVE);
    assertThat(res.getPersons().getFirst().getSourceKind()).isEqualTo(PersonResponse.SourceKindEnum.MANUAL);
    assertThat(res.getPersons().getFirst().getRelationship()).isEqualTo(PersonResponse.RelationshipEnum.FRIEND);
}
```

- [ ] **Step 2: Futtasd — fordítási hibával bukik** (nincs `getAliases`): `./mvnw test -Dtest=PeopleContractIT -Dmezo.test.use-testcontainers=true` → COMPILE ERROR.

- [ ] **Step 3: Bővítsd a `people.yml`-t.** `PersonResponse`: a `required` listába `aliases`, `status`, `sourceKind` kerül; properties-be:

```yaml
        relationship:
          type: string
          enum: [partner, friend, family, colleague, teammate, mentee]
        aliases:
          type: array
          items: { type: string, maxLength: 60 }
        status:
          type: string
          enum: [candidate, active, archived]
        sourceKind:
          type: string
          enum: [manual, extractor, seed]
```

`MentionResponse` properties-be (nem required):

```yaml
        intensity: { type: integer, minimum: 1, maximum: 3 }
        contextLabel:
          type: string
          enum: [munka, csalad, baratok, edzes, konfliktus, kozos_program, segitseg, egyeb]
        sourceRefKind: { type: string }
```

`LogMentionRequest` properties-be:

```yaml
        contextLabel:
          type: string
          enum: [munka, csalad, baratok, edzes, konfliktus, kozos_program, segitseg, egyeb]
```

Új sémák a `components.schemas` alá (Task 3–4 végpontjai használják):

```yaml
    CreatePersonRequest:
      type: object
      required: [name, relationship, relationshipHu]
      properties:
        name: { type: string, minLength: 1, maxLength: 120 }
        aliases:
          type: array
          maxItems: 8
          items: { type: string, minLength: 1, maxLength: 60 }
        relationship:
          type: string
          enum: [partner, friend, family, colleague, teammate, mentee]
        relationshipHu: { type: string, minLength: 1, maxLength: 120 }
        affectBaseline:
          type: string
          enum: [positive, neutral, mixed, negative]
        contactCadenceLabel: { type: string, maxLength: 120 }
        notes: { type: string, maxLength: 500 }
    UpdatePersonRequest:
      type: object
      required: [name, relationship, relationshipHu]
      properties:
        name: { type: string, minLength: 1, maxLength: 120 }
        aliases:
          type: array
          maxItems: 8
          items: { type: string, minLength: 1, maxLength: 60 }
        relationship:
          type: string
          enum: [partner, friend, family, colleague, teammate, mentee]
        relationshipHu: { type: string, minLength: 1, maxLength: 120 }
        affectBaseline:
          type: string
          enum: [positive, neutral, mixed, negative]
        contactCadenceLabel: { type: string, maxLength: 120 }
        notes: { type: string, maxLength: 500 }
```

És a paths alá a három új művelet (Task 3–4 implementálja; a goal.yml verb-konvenciói szerint):

```yaml
  /api/people:
    # ... a meglévő get mellé:
    post:
      tags: [People]
      operationId: createPerson
      summary: Create an owned person (initial derived server-side; status=active, sourceKind=manual)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreatePersonRequest' }
      responses:
        '201':
          description: Person created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PersonResponse' }
        '400':
          description: Validation failure
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/people/{personId}:
    put:
      tags: [People]
      operationId: updatePerson
      summary: Full update of the editable person fields (knownFacts/ties/affectTrend are AI-curated, untouched)
      parameters:
        - name: personId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UpdatePersonRequest' }
      responses:
        '200':
          description: Person updated
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PersonResponse' }
        '400':
          description: Validation failure
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Person missing or foreign (indistinguishable)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    delete:
      tags: [People]
      operationId: deletePerson
      summary: Soft-delete an owned person (mentions stay stored, leave the feed)
      parameters:
        - name: personId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '204': { description: Deleted }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Person missing or foreign (indistinguishable)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

- [ ] **Step 4: Codegen mindkét oldalra**

Run: `cd api/generate && npm install && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` + `api.gen.ts` frissül; a backend most NEM fordul (a `PeopleController` nem implementálja az új interfész-metódusokat) — ez várt, a Step 5–6 oldja.

- [ ] **Step 5: Entity-bővítés.** `PersonEntity`-be (a meglévő array-mezők mintájára):

```java
    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> aliases = new ArrayList<>();

    @NotNull @Column(nullable = false) private String status = "active"; // candidate|active|archived (DB CHECK)
    @NotNull @Column(name = "source_kind", nullable = false) private String sourceKind = "manual"; // manual|extractor|seed (DB CHECK)
```

`MentionEntity`-be:

```java
    @Column private Integer intensity; // 1..3 (DB CHECK) — az éjszakai kör tölti (S4)
    @Column(name = "context_label") private String contextLabel; // zárt készlet (DB CHECK)
    @Column(name = "source_ref_kind") private String sourceRefKind; // memory_embedding.kind nevezéktan
    @Column(name = "source_ref_id", columnDefinition = "uuid") private UUID sourceRefId;
```

- [ ] **Step 6: Controller-stubok, hogy forduljon** — a `PeopleController`-be ideiglenes implementációk, amiket a Task 3–4 vált ki élesre (a generált interfész kényszeríti őket):

```java
    @Override
    public PersonResponse createPerson(CreatePersonRequest createPersonRequest) {
        return service.createPerson(currentUserId.get(), createPersonRequest);
    }

    @Override
    public PersonResponse updatePerson(UUID personId, UpdatePersonRequest updatePersonRequest) {
        return service.updatePerson(currentUserId.get(), personId, updatePersonRequest);
    }

    @Override
    public void deletePerson(UUID personId) {
        service.deletePerson(currentUserId.get(), personId);
    }
```

és a `PeopleService`-be a hozzájuk tartozó minimál implementáció (Task 3–4 tesztjei ezt vezetik tovább):

```java
    @Transactional
    public PersonResponse createPerson(UUID userId, CreatePersonRequest req) {
        PersonEntity p = new PersonEntity();
        p.setCreatedBy(userId);
        applyEditableFields(p, req.getName(), req.getAliases(), req.getRelationship().getValue(),
            req.getRelationshipHu(),
            req.getAffectBaseline() == null ? "neutral" : req.getAffectBaseline().getValue(),
            req.getContactCadenceLabel(), req.getNotes());
        PersonEntity saved = personRepository.save(p);
        return mapper.toPersonResponse(saved, 0, 0, null);
    }

    @Transactional
    public PersonResponse updatePerson(UUID userId, UUID personId, UpdatePersonRequest req) {
        PersonEntity p = requireOwnedPerson(userId, personId);
        applyEditableFields(p, req.getName(), req.getAliases(), req.getRelationship().getValue(),
            req.getRelationshipHu(),
            req.getAffectBaseline() == null ? p.getAffectBaseline() : req.getAffectBaseline().getValue(),
            req.getContactCadenceLabel(), req.getNotes());
        PersonEntity saved = personRepository.save(p);
        List<MentionEntity> own = mentionRepository
            .findAllByCreatedByAndDeletedFalseOrderByTsDesc(userId).stream()
            .filter(m -> m.getPersonId().equals(personId)).toList();
        Instant weekAgo = Instant.now().minus(WEEK);
        int thisWeek = (int) own.stream().filter(m -> !m.getTs().isBefore(weekAgo)).count();
        return mapper.toPersonResponse(saved, own.size(), thisWeek,
            own.isEmpty() ? null : own.getFirst().getTs());
    }

    @Transactional
    public void deletePerson(UUID userId, UUID personId) {
        personRepository.delete(requireOwnedPerson(userId, personId)); // @SQLDelete → soft
    }

    /** Az AI-kurálta mezők (knownFacts/ties/affectTrend) szándékosan érintetlenek. */
    private void applyEditableFields(PersonEntity p, String name, List<String> aliases,
        String relationship, String relationshipHu, String affectBaseline,
        String contactCadenceLabel, String notes) {
        p.setName(name.strip());
        p.setInitial(p.getName().substring(0, 1).toUpperCase());
        p.setAliases(aliases == null ? new ArrayList<>() : new ArrayList<>(aliases));
        p.setRelationship(relationship);
        p.setRelationshipHu(relationshipHu);
        p.setAffectBaseline(affectBaseline);
        p.setContactCadenceLabel(contactCadenceLabel);
        p.setNotes(notes);
    }
```

(Importok: `CreatePersonRequest`, `UpdatePersonRequest` az `api.dto`-ból; `ArrayList`.)

- [ ] **Step 7: Populator-bővítés** — a Step 1 tesztje elvárja az aliast: a `PersonPopulator.createPerson(owner,name,relationship,affect)` törzsébe `p.setAliases(List.of("Marcika"));` (a defaultos 2-argos változat viselkedése változatlan).

- [ ] **Step 8: Futtasd az IT-t** — `./mvnw test -Dtest=PeopleContractIT -Dmezo.test.use-testcontainers=true` → PASS (az összes régi teszt is).

- [ ] **Step 9: Commit**

```bash
git add api/ backend/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): people kontraktus-bővítés — CRUD sémák, aliases/status/sourceKind, contextLabel (<S1>)"
```

### Task 3: createPerson — teljes viselkedés

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java` (már áll a Task 2-ből — itt csak teszt-vezérelt finomítás, ha bukik)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleContractIT.java`

**Interfaces:**
- Consumes: `POST /api/people` + `CreatePersonRequest` (Task 2).
- Produces: 201-es válasz `PersonResponse`-szal; `initial` szerver-derivált; default `affectBaseline=neutral`, `status=active`, `sourceKind=manual`.

- [ ] **Step 1: Bukó tesztek**

```java
@Test
void testCreatePerson_shouldPersistWithDerivedInitialAndDefaults() {
    CreatePersonRequest req = new CreatePersonRequest("Ádám", "friend", "Barát");
    req.setAliases(java.util.List.of("Adi", "Ádámka"));

    PersonResponse created = postForBody("/api/people", req, ownerAuthHeaders(),
        HttpStatus.CREATED, PersonResponse.class);

    assertThat(created.getInitial()).isEqualTo("Á");
    assertThat(created.getAliases()).containsExactly("Adi", "Ádámka");
    assertThat(created.getAffectBaseline()).isEqualTo(PersonResponse.AffectBaselineEnum.NEUTRAL);
    assertThat(created.getStatus()).isEqualTo(PersonResponse.StatusEnum.ACTIVE);
    assertThat(created.getSourceKind()).isEqualTo(PersonResponse.SourceKindEnum.MANUAL);
    assertThat(created.getMentionCount()).isZero();

    PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
    assertThat(res.getPersons()).extracting(PersonResponse::getName).contains("Ádám");
}

@Test
void testCreatePerson_shouldReturn400_whenNameBlank() {
    String body = postForBody("/api/people",
        java.util.Map.of("name", "", "relationship", "friend", "relationshipHu", "Barát"),
        ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    assertHasFieldError(body, "name", "VALIDATION_INVALID_VALUE");
}
```

Megjegyzés: a generált `CreatePersonRequest` konstruktor-argumentumsorrendjét az `api.dto` osztályból ellenőrizd (required mezők: name, relationship, relationshipHu); ha a generátor no-arg konstruktort ad, settereld ugyanezeket.

- [ ] **Step 2: Futtasd** — `./mvnw test -Dtest=PeopleContractIT -Dmezo.test.use-testcontainers=true`. Ha a Task 2-es implementáció már jó, PASS; ha bukik (pl. enum-mapping), minimál javítás a service-ben/mapperben.
- [ ] **Step 3: Commit**

```bash
git add backend/src/test backend/src/main
git commit -m "feat(api): createPerson végpont viselkedés-tesztekkel (<S1>)"
```

### Task 4: updatePerson + deletePerson — viselkedés és feed-higiénia

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleContractIT.java`

**Interfaces:**
- Consumes: `PUT/DELETE /api/people/{personId}` (Task 2), `requireOwnedPerson` 404-gate.
- Produces: törölt személy sem a persons-listában, sem a mention-feedben nem szerepel (a mention-sorok megmaradnak az adatbázisban).

- [ ] **Step 1: Bukó tesztek**

```java
@Test
void testUpdatePerson_shouldReplaceEditableFields_andKeepCuratedOnes() {
    UUID owner = ownerId();
    PersonEntity p = personPopulator.createPerson(owner, "Réka", "colleague", "neutral");

    UpdatePersonRequest req = new UpdatePersonRequest("Réka B.", "colleague", "Kolléga · Q3");
    req.setAliases(java.util.List.of("Réki"));
    req.setNotes("Projekt lezárva.");

    PersonResponse updated = putForBody("/api/people/" + p.getId(), req, ownerAuthHeaders(),
        HttpStatus.OK, PersonResponse.class);

    assertThat(updated.getName()).isEqualTo("Réka B.");
    assertThat(updated.getAliases()).containsExactly("Réki");
    assertThat(updated.getKnownFacts()).isNotEmpty(); // AI-kurálta mező érintetlen
}

@Test
void testUpdatePerson_shouldReturn404_whenForeign() {
    UUID other = userPopulator.createUser("stranger-people-upd@test.hu").getId();
    PersonEntity foreign = personPopulator.createPerson(other, "Idegen");
    putForBody("/api/people/" + foreign.getId(),
        new UpdatePersonRequest("X", "friend", "Barát"),
        ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
}

@Test
void testDeletePerson_shouldSoftDelete_andDropFromBootstrapWithMentions() {
    UUID owner = ownerId();
    PersonEntity p = personPopulator.createPerson(owner, "Törlendő");
    mentionPopulator.createMention(owner, p.getId(), Instant.now(), "positive");

    deleteForStatus("/api/people/" + p.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

    PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
    assertThat(res.getPersons()).extracting(PersonResponse::getName).doesNotContain("Törlendő");
    assertThat(res.getMentions()).extracting(MentionResponse::getPersonId).doesNotContain(p.getId());
}
```

Ha az `ApiIntegrationTest` nem ad `putForBody`/`deleteForStatus` helpert, nézd meg a meglévő goal-IT-k hívásmintáit és azt használd (ugyanazok a helperek a teljes IT-parkban).

- [ ] **Step 2: Futtasd — a delete-teszt feed-állítása bukik** (a mai bootstrap a törölt személy mentionjét üres névvel adja vissza).
- [ ] **Step 3: Minimál javítás a `getBootstrap`-ban** — a feed csak élő személyhez tartozó mentiont ad ki:

```java
        List<MentionResponse> mentionResponses = mentions.stream()
            .filter(m -> nameById.containsKey(m.getPersonId())) // törölt személy sora nem szivárog
            .limit(MENTION_FEED_LIMIT)
            .map(m -> mapper.toMentionResponse(m, nameById.get(m.getPersonId())))
            .toList();
```

- [ ] **Step 4: Futtasd újra** — PASS.
- [ ] **Step 5: Commit**

```bash
git add backend/src/test backend/src/main
git commit -m "feat(api): update/delete person + feed-higiénia törölt személyre (<S1>)"
```

### Task 5: logMention contextLabel

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java:75-86`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleContractIT.java`

**Interfaces:**
- Consumes: `LogMentionRequest.getContextLabel()` (Task 2 generálta enum).
- Produces: `MentionResponse.contextLabel` a chip-úton is kitöltve, ha a kliens küldte.

- [ ] **Step 1: Bukó teszt**

```java
@Test
void testLogMention_shouldPersistContextLabel_whenProvided() {
    UUID owner = ownerId();
    PersonEntity p = personPopulator.createPerson(owner, "Petra", "partner", "positive");

    LogMentionRequest req = new LogMentionRequest("positive", "Közös vacsora.");
    req.setContextLabel(LogMentionRequest.ContextLabelEnum.KOZOS_PROGRAM);

    MentionResponse created = postForBody("/api/people/" + p.getId() + "/mentions", req,
        ownerAuthHeaders(), HttpStatus.CREATED, MentionResponse.class);

    assertThat(created.getContextLabel()).isEqualTo(MentionResponse.ContextLabelEnum.KOZOS_PROGRAM);
}
```

(A generált `LogMentionRequest` konstruktor/setter alakját az `api.dto`-ból ellenőrizd — a `tone` pattern-es String marad.)

- [ ] **Step 2: Futtasd** — FAIL (`contextLabel` null).
- [ ] **Step 3: Implementáció** — a `logMention`-ben a `m.setFlagged(false);` sor elé:

```java
        m.setContextLabel(req.getContextLabel() == null ? null : req.getContextLabel().getValue());
```

és a `PeopleMapper`-be a szokásos enum-híd:

```java
    default MentionResponse.ContextLabelEnum mapContextLabel(String value) {
        return value == null ? null : MentionResponse.ContextLabelEnum.fromValue(value);
    }
```

- [ ] **Step 4: Futtasd** — PASS.
- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(api): logMention kontextus-címkével (<S1>)"
```

### Task 6: ArchUnit + codemap + feature-doc

**Files:**
- Modify: `docs/CODEMAP.md` (generált), `docs/features/me.md` (People-szakasz + §7)

- [ ] **Step 1:** `cd backend && ./mvnw test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true` → PASS (nincs új osztály rossz csomagban).
- [ ] **Step 2:** `node scripts/gen-codemap.mjs` — ha van diff, commitba kerül.
- [ ] **Step 3:** `docs/features/me.md` People-részének frissítése: a §5.4 "no person CRUD" és "tiedTo label-only" állítások helyére az új állapot (CRUD-hármas, aliases/status/sourceKind, mention context/source_ref oszlopok, S2+ tervek a specre hivatkozva). A §7 "extend it here" receptjéből a már-megvalósult sorok kihúzása.
- [ ] **Step 4: Commit**

```bash
git add docs/CODEMAP.md docs/features/me.md
git commit -m "docs(me): People-szakasz az S1 utáni állapotra (<S1>)"
```

### Task 7: FE data-réteg — típusok, api, mock, hookok

**Files:**
- Modify: `frontend/src/data/types.ts` (PersonEntry/Mention/Relationship + új input-típusok)
- Modify: `frontend/src/data/me/peopleApi.ts`
- Modify: `frontend/src/data/me/people.ts` (mock seed)
- Modify: `frontend/src/data/me/peopleHooks.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/me/peopleHooks.test.tsx` (a meglévő hook-teszt fájl mellé/kiegészítve — nézd meg a tényleges nevét a `data/me` alatt és azt bővítsd)

**Interfaces:**
- Consumes: `api.gen.ts` friss sémái (Task 2), `useDualQuery`, `isMockMode`.
- Produces: `usePeople()` visszatérése bővül: `{ people, mentions, logMention, savePerson, deletePerson, isPending }`, ahol `savePerson(input: PersonSaveInput)` (id nélkül create, id-val update) és `deletePerson(personId: string)`. `PersonSaveInput` a `data/types.ts`-ből exportálva — a Task 8 sheetje ezt hívja.

- [ ] **Step 1: Típusok.** `data/types.ts`-ben:

```ts
export type Relationship = 'partner' | 'friend' | 'family' | 'colleague' | 'teammate' | 'mentee'
export type PersonStatus = 'candidate' | 'active' | 'archived'
export type PersonSourceKind = 'manual' | 'extractor' | 'seed'
export type MentionContext =
  | 'munka' | 'csalad' | 'baratok' | 'edzes'
  | 'konfliktus' | 'kozos_program' | 'segitseg' | 'egyeb'
```

`PersonEntry`-be új mezők: `aliases: string[]`, `status: PersonStatus`, `sourceKind: PersonSourceKind`. `Mention`-be: `intensity?: number`, `contextLabel?: MentionContext`, `sourceRefKind?: string`. `MentionLogInput`-ba: `contextLabel?: MentionContext`. Új export:

```ts
export interface PersonSaveInput {
  id?: string
  name: string
  aliases: string[]
  relationship: Relationship
  relationshipHu: string
  affectBaseline?: Affect
  contactCadenceLabel?: string
  notes?: string
}
```

(A meglévő `Relationship`-fogyasztókat — pl. relationship-alapú címkék — a build hibái mutatják meg; a HU címke-térkép: partner→Társ, friend→Barát, family→Család, colleague→Kolléga, teammate→Csapattárs, mentee→Mentee.)

- [ ] **Step 2: `peopleApi.ts`.** `toPersonEntry`-be: `aliases: p.aliases`, `status: p.status`, `sourceKind: p.sourceKind`; `toMention`-be: `intensity: m.intensity ?? undefined`, `contextLabel: m.contextLabel as MentionContext | undefined`, `sourceRefKind: m.sourceRefKind ?? undefined`. Az api-objektumba:

```ts
export type CreatePersonRequest = components['schemas']['CreatePersonRequest']
export type UpdatePersonRequest = components['schemas']['UpdatePersonRequest']

  createPerson: (input: PersonSaveInput) =>
    apiFetch<PersonResponse>(PEOPLE, {
      method: 'POST',
      body: JSON.stringify({
        name: input.name, aliases: input.aliases, relationship: input.relationship,
        relationshipHu: input.relationshipHu, affectBaseline: input.affectBaseline,
        contactCadenceLabel: input.contactCadenceLabel, notes: input.notes,
      } satisfies CreatePersonRequest),
    }),
  updatePerson: (id: string, input: PersonSaveInput) =>
    apiFetch<PersonResponse>(`${PEOPLE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name, aliases: input.aliases, relationship: input.relationship,
        relationshipHu: input.relationshipHu, affectBaseline: input.affectBaseline,
        contactCadenceLabel: input.contactCadenceLabel, notes: input.notes,
      } satisfies UpdatePersonRequest),
    }),
  deletePerson: (id: string) => apiFetch<void>(`${PEOPLE}/${id}`, { method: 'DELETE' }),
```

és a `logMention` body-ja bővül: `{ tone, text, contextLabel } satisfies LogMentionRequest` (a hívó szignatúra: `logMention(personId, tone, text?, contextLabel?)`).

- [ ] **Step 3: Mock seed.** `data/me/people.ts` minden személyére: `aliases: []` (Petránál `['Peti', 'Petus']` a demó kedvéért), `status: 'active'`, `sourceKind: 'seed'`; a mention-seedek közül kettőre `contextLabel` (pl. `'kozos_program'`, `'edzes'`).

- [ ] **Step 4: Hookok.** `peopleHooks.ts`-ben a `logM` mintájára:

```ts
  const saveM = useMutation({
    mutationFn: async (input: PersonSaveInput) => {
      if (mock) { mockSavePerson(qc, input); return }
      if (input.id) await peopleApi.updatePerson(input.id, input)
      else await peopleApi.createPerson(input)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })
  const delM = useMutation({
    mutationFn: async (personId: string) => {
      if (mock) { mockDeletePerson(qc, personId); return }
      await peopleApi.deletePerson(personId)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })
```

visszatérésben: `savePerson: (i: PersonSaveInput) => saveM.mutate(i)`, `deletePerson: (id: string) => delM.mutate(id)`. Mock-írók a `mockLogMention` mintájára:

```ts
function mockSavePerson(qc: QueryClient, input: PersonSaveInput) {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    if (input.id) {
      return { ...base, people: base.people.map(p => p.id === input.id
        ? { ...p, ...editable(input), initial: input.name.slice(0, 1).toUpperCase() } : p) }
    }
    const fresh: PersonEntry = {
      id: crypto.randomUUID(), initial: input.name.slice(0, 1).toUpperCase(),
      affect_baseline: input.affectBaseline ?? 'neutral',
      mentionCount: 0, mentionsThisWeek: 0, last_mentioned_at: '',
      lastMentionLabel: 'Még nincs említés', affectTrend: [], knownFacts: [], ties: [],
      status: 'active', sourceKind: 'manual', ...editable(input),
    }
    return { ...base, people: [...base.people, fresh] }
  })
}
function editable(i: PersonSaveInput) {
  return { name: i.name, aliases: i.aliases, relationship: i.relationship,
    relationshipHu: i.relationshipHu, contactCadenceLabel: i.contactCadenceLabel ?? '',
    notes: i.notes ?? '' }
}
function mockDeletePerson(qc: QueryClient, personId: string) {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    return {
      people: base.people.filter(p => p.id !== personId),
      mentions: base.mentions.filter(m => m.person_id !== personId),
    }
  })
}
```

- [ ] **Step 5: MSW.** `frontend/src/test/msw/handlers.ts`-be a meglévő people-handler mellé `POST /api/people` (201, a kérésből épített `PersonResponse` a required mezőkkel: `id: crypto.randomUUID(), initial: name[0], status: 'active', sourceKind: 'manual', aliases: req.aliases ?? [], mentionCount: 0, mentionsThisWeek: 0, knownFacts: [], ties: [], affectTrend: []`), `PUT /api/people/:id` (200, echo az új mezőkkel) és `DELETE /api/people/:id` (204).

- [ ] **Step 6: Hook-tesztek.** A meglévő people hook-teszt fájlba (real mód, MSW):

```tsx
it('savePerson creates then refetches (real mode)', async () => {
  const { result } = renderHook(() => usePeople(), { wrapper })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  result.current.savePerson({
    name: 'Marci', aliases: ['Marcika'], relationship: 'friend', relationshipHu: 'Barát',
  })
  await waitFor(() => expect(result.current.people.map(p => p.name)).toContain('Marci'))
})

it('deletePerson removes person and their mentions (mock mode)', async () => {
  // VITE_USE_MOCK=true futásban él
  const { result } = renderHook(() => usePeople(), { wrapper })
  const victim = result.current.people[0]
  result.current.deletePerson(victim.id)
  await waitFor(() => {
    expect(result.current.people.map(p => p.id)).not.toContain(victim.id)
    expect(result.current.mentions.every(m => m.person_id !== victim.id)).toBe(true)
  })
})
```

(A fájl meglévő wrapper/waitFor mintáit kövesd; a mock-módú assert csak `VITE_USE_MOCK=true` futásban fut — a fájl meglévő mód-gate mintája szerint, pl. `isMockMode()` alapú `describe.skipIf`.)

- [ ] **Step 7: Futtasd mindkét módban**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS mindkétszer (a `dualMode.guard.test.ts` is).

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): people data-réteg — savePerson/deletePerson, új mezők, mock+MSW (<S1>)"
```

### Task 8: PersonEditSheet + bekötés

**Files:**
- Create: `frontend/src/features/me/sheets/PersonEditSheet.tsx`
- Modify: `frontend/src/features/me/pages/PeoplePage.tsx` (fejléc-akció + sheet-state)
- Modify: `frontend/src/features/me/sheets/PersonDetailSheet.tsx` (Szerkesztés + Törlés gombok)
- Test: `frontend/src/features/me/sheets/PersonEditSheet.test.tsx`

**Interfaces:**
- Consumes: `usePeople().savePerson/deletePerson` (Task 7), a meglévő sheet-komponens minta (nézd meg a `PersonLogSheet.tsx` vázát: overlay + panel + close), clay ikonok.
- Produces: `<PersonEditSheet person={PersonEntry | null} onClose={() => void} />` — `person=null` → létrehozás, különben szerkesztés.

- [ ] **Step 1: Bukó komponens-teszt**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { PersonEditSheet } from '@/features/me/sheets/PersonEditSheet'

const savePerson = vi.fn()
vi.mock('@/data/hooks', async (orig) => ({
  ...(await orig()),
  usePeople: () => ({ people: [], mentions: [], savePerson, deletePerson: vi.fn(),
    logMention: vi.fn(), isPending: false }),
}))

it('gyűjti az aliasokat és menti az új személyt', () => {
  render(<PersonEditSheet person={null} onClose={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText('pl. Marci'), { target: { value: 'Marci' } })
  fireEvent.change(screen.getByPlaceholderText('pl. Marcika'), { target: { value: 'Marcika' } })
  fireEvent.click(screen.getByRole('button', { name: '＋' }))
  fireEvent.click(screen.getByRole('button', { name: 'Barát' }))
  fireEvent.click(screen.getByRole('button', { name: /Felveszem/ }))
  expect(savePerson).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Marci', aliases: ['Marcika'], relationship: 'friend', relationshipHu: 'Barát',
  }))
})

it('mentés-gomb tiltott, amíg nincs név', () => {
  render(<PersonEditSheet person={null} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: /Felveszem/ })).toBeDisabled()
})
```

- [ ] **Step 2: Futtasd** — FAIL (nincs komponens).
- [ ] **Step 3: Implementáld a sheetet** a prototípus `sh-new` anatómiája szerint (`docs/design_2.0/prototypes/emberek.html`), a `PersonLogSheet.tsx` overlay/panel/close kompozícióját átvéve (nyisd meg és másold a wrapper-elemeit — az alábbi váz a tartalomra fókuszál):

```tsx
import { useState } from 'react'
import { usePeople } from '@/data/hooks'
import type { PersonEntry, PersonSaveInput, Relationship } from '@/data/types'

const RELS: Array<{ value: Relationship; hu: string }> = [
  { value: 'partner', hu: 'Társ' }, { value: 'friend', hu: 'Barát' },
  { value: 'family', hu: 'Család' }, { value: 'colleague', hu: 'Kolléga' },
  { value: 'teammate', hu: 'Csapattárs' }, { value: 'mentee', hu: 'Mentee' },
]

export function PersonEditSheet({ person, onClose }: { person: PersonEntry | null; onClose: () => void }) {
  const { savePerson, deletePerson } = usePeople()
  const [name, setName] = useState(person?.name ?? '')
  const [aliasInput, setAliasInput] = useState('')
  const [aliases, setAliases] = useState<string[]>(person?.aliases ?? [])
  const [rel, setRel] = useState<Relationship>(person?.relationship ?? 'friend')
  const [notes, setNotes] = useState(person?.notes ?? '')
  const [armDelete, setArmDelete] = useState(false)

  const addAlias = () => {
    const v = aliasInput.trim()
    if (!v || aliases.includes(v)) return
    setAliases([...aliases, v]); setAliasInput('')
  }
  const submit = () => {
    const input: PersonSaveInput = {
      id: person?.id, name: name.trim(), aliases,
      relationship: rel,
      relationshipHu: person && person.relationship === rel
        ? person.relationshipHu // kézzel pontosított HU címkét nem írunk felül
        : RELS.find(r => r.value === rel)!.hu,
      notes: notes.trim() || undefined,
    }
    savePerson(input); onClose()
  }
  // ...a PersonLogSheet sheet-kerete; a törzs:
  // Név: <input placeholder="pl. Marci" value={name} onChange={...} />
  // Becenevek: <input placeholder="pl. Marcika" value={aliasInput} ... />
  //            <button onClick={addAlias}>＋</button> + alias-chipek ✕-szel (setAliases(filter))
  // Kapcsolat: RELS.map(r => <button aria-pressed={rel === r.value} onClick={() => setRel(r.value)}>{r.hu}</button>)
  // Jegyzet: <textarea value={notes} ... />
  // CTA: <button disabled={!name.trim()} onClick={submit}>{person ? '✓ Mentés' : '✓ Felveszem'}</button>
  // Szerkesztésnél Törlés: első tap setArmDelete(true) → „Biztos? Az említések megmaradnak,
  //   a személy eltűnik" felirat; második tap: deletePerson(person.id); onClose()
  // Lábjegyzet: „mentés után a napló · reflexió · chat szövegében minden név- és
  //   becenév-találat magától említés lesz"
}
```

A JSX-et a `PersonLogSheet` tényleges osztályaival/elrendezésével írd meg (chipsor, input, CTA ugyanaz a vizuális nyelv); emoji nem kerülhet a UI-ba.
- [ ] **Step 4: Bekötés.** `PeoplePage` fejlécébe `＋ Új személy` akció (a meglévő `🎤 Log` akció mintájára, de clay/plain szöveggel — emoji nélkül), ami `PersonEditSheet person={null}`-t nyit; `PersonDetailSheet`-be `Szerkesztés` gomb, ami ugyanazt a sheetet nyitja a személlyel.
- [ ] **Step 5: Futtasd a teszteket mindkét módban + build**

Run: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): PersonEditSheet — kézi személy-felvétel/szerkesztés aliasokkal (mezo-06o0 <S1>)"
```

### Task 9: kapuzárás + bd

**Files:** none (futtatás + bd)

- [ ] **Step 1:** Backend fókuszált kör: `cd backend && ./mvnw test -Dtest='PeopleContractIT,PeopleServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` → PASS.
- [ ] **Step 2:** Frontend teljes kapu: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test` → PASS.
- [ ] **Step 3:** `bd close <S1>` + rövid megjegyzés a maradékról (S2–S6 a mezo-06o0 alatt).
- [ ] **Step 4:** `git status` tiszta; a push/PR a session-completion protokoll szerint (self-PR → CI green → `--no-ff` merge) a szelet-sor végén történik.
