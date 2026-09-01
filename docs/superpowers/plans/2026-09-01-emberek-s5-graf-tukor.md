# Emberek S5 — gráf-tükör Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az aktív személyek megjelennek a tudásgráfban PERSON node-ként, élekkel a célok / életesemények / minták felé, és ezek az élek visszaköszönnek a személy részletek-oldalán („Kapcsolt események · gráf").

**Architecture:** A `GraphPromotionService` egy negyedik forrás-ággal bővül (`SOURCE_PERSON`), pontosan a `syncGoal`/`retractGoal` alakjában: aktív személy → aktív PERSON node, archivált/törölt/jelölt személy → archivált node. A trigger a `PeopleService` által publikált `PersonSavedEvent`/`PersonDeletedEvent`, amit a meglévő `GraphPromotionListener` fogyaszt (AFTER_COMMIT + `@Async`), és amit a `reconcile` éjszakai sweep gyógyít. Az éleket a már meglévő `GraphEdgeStructurer` húzza be: egyrészt ingyen, minden ÚJ PERSON node promóciójakor, másrészt az éjszakai `PersonExtractionService` egy szűk, determinisztikus passzában azoknak a személyeknek, akiknek van node-juk, de még nincs egyetlen élük sem. Az FE-hez a `people` feature saját portot deklarál (`PersonGraphEdgeSource`, a `NarrativeNoteSource` idióma), amit a graph-oldali adapter valósít meg — így a `companion → people` irány marad, a tiltott `people → companion` él sosem jön létre.

**Tech Stack:** Spring Boot 4 / Hibernate 7 / Liquibase, contract-first OpenAPI (openapi-generator), MapStruct, ArchUnit; React 19 + TanStack Query dual-mode, Vitest + MSW.

## Global Constraints

Ezek MINDEN taskra érvényesek, külön említés nélkül is.

- **Munkakönyvtár:** `.claude/worktrees/emberek-section-development-d4aa89`. SOSEM `cd` a primary repóba (`/Users/mrkuhne/Applications/Personal/Mezo/mezo`) — az a mainen ül.
- **Backend teszt MINDIG** `-Dmezo.test.use-testcontainers=true`, pl.
  `cd backend && ./mvnw test -Dtest=GraphPromotionPersonIT -Dmezo.test.use-testcontainers=true`.
  Soha ne fusson két `mvnw` build egyszerre (megosztott `target/`, részleges annotation processing → hamis `NoSuchMethodError`).
- **FE teszt a worktree-ben EXPLICIT mindkét módban:** `VITE_USE_MOCK=false pnpm test` ÉS `VITE_USE_MOCK=true pnpm test` (a bare `pnpm test` itt kétszer mock módban fut).
- **Kontraktus-first:** minden DTO-változás előbb `api/feature/**.yml`, aztán
  `cd api/generate && npm run generate:api` (ez írja `api/openapi.yml`-t és
  `frontend/src/data/_client/api.gen.ts`-t), és `cd backend && ./mvnw clean test-compile` a generált Java ellenőrzésére. A generált fájlokat is commitold.
- **Hibadoktrína (IDENT-3):** LLM- vagy gráf-hiba SOSEM buktat egy felhasználói írást — warn + degradálás üresre. Nyers `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` a `techcore`-on kívül TILOS (`SystemRuntimeErrorException` + `SystemMessage`).
- **Rétegszabályok (ArchUnit):** `@Service` osztály csak `..service..` csomagban; entity `..entity..`; repository `..repository..`. A `companion → people` függés LÉTEZIK és megengedett; a `people → companion` TILOS — a people oldal csak SAJÁT interfészt deklarálhat, amit a companion valósít meg.
- **Kapcsolók:** `FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH` (gráf), `COMPANION_SWITCH`, `PEOPLE_SWITCH`. A `people` feature maga NINCS kapcsoló mögött (a `PeopleService` mindig létezik) — egy eseményt, amire nincs listener, a Spring csendben eldob; ez a helyes viselkedés kikapcsolt gráf mellett.
- **Magyar UI-szöveg**, ékezetekkel. Ikonok kizárólag a clay sprite-készletből (`ClayIconName`), emoji sehol.
- **Prototípus-hűség:** `docs/design_2.0/prototypes/src/emberek-body.html` `renderDet()` + `emberek-head.html` `.lsec`/`.evt` — a px-értékek ×1,18 skálával kerülnek a `prototype.css`-be. Hardcodolt hex TILOS a `prototype.css`-ben (a `mozaikCssTokens` guard bukik rá, a kommentekben is): meglévő `--mz-*` tokent használj, vagy vegyél fel újat MINDKÉT `:root`-ba.
- **bd:** a driving issue `mezo-06o0.4`; a commit-subjectek hordozzák: `feat(api): ... (mezo-06o0.4)`.
- **Docs-kapu:** `node scripts/lint-docs.mjs --errors-only` (a bare forma a pre-existing stale baseline miatt bukik — sosem „javítunk" idegen dokumentumot emiatt).

---

## File Structure

**Backend — új:**
- `backend/src/main/resources/db/changelog/1.0.0/script/202609011000_mezo-06o0.4_knowledge_node_person_kind.sql` — PERSON felvétele a `ck_knowledge_node_kind` CHECK-be.
- `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonSavedEvent.java` — a `GoalSavedEvent` ikertestvére.
- `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonDeletedEvent.java` — a `GoalDeletedEvent` ikertestvére.
- `backend/src/main/java/io/mrkuhne/mezo/feature/people/PersonGraphEdgeSource.java` — fogyasztó-tulajdonú port (a `feature/companion/NarrativeNoteSource` helyezési precedense: a feature GYÖKERÉBEN, nem `..service..`-ben, mert nem `@Service`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/PersonGraphEdgeAdapter.java` — a port graph-oldali megvalósítása (`@Service`, ezért `..service..`-ben; és így látja a package-private `GraphEdgeLineRenderer`-t).
- ITs: `GraphPromotionPersonIT`, `PersonGraphEdgeAdapterIT` (mindkettő `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/`).

**Backend — módosítás:**
- `feature/companion/graph/entity/GraphNodeEntity.java` — `KIND_PERSON` + `@Pattern`.
- `feature/companion/graph/service/GraphPromotionService.java` — `SOURCE_PERSON`, `syncPerson`, `retractPerson`, `reconcile` 4. promóciós hurok + komplement-ág.
- `feature/companion/graph/service/GraphPromotionListener.java` — `onPersonSaved`, `onPersonDeleted`.
- `feature/companion/service/PersonExtractionService.java` — él-passz (`linkPersonEdges`), `PersonExtractionResult` bővítés.
- `feature/companion/service/PersonExtractionResult.java` — `edgeLinked` mező.
- `feature/companion/graph/service/GraphMaintenanceJob.java` — a 4. fázis logsora az új mezővel.
- `feature/people/service/PeopleService.java` — `ApplicationEventPublisher` + esemény-publikálás minden ír-úton; `graphEdges` feltöltése a bootstrapben.
- `feature/people/mapper/PeopleMapper.java` — `graphEdges` ignorálása a mappelésnél (a service tölti).
- `api/feature/knowledge-graph/knowledge-graph.yml`, `api/feature/people/people.yml`, `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`.

**Frontend — módosítás:**
- `frontend/src/data/insights/graph.ts` — `GRAPH_KIND_GROUPS` + `'PERSON'`.
- `frontend/src/data/types.ts` — `PersonGraphEdge` típus + `PersonEntry.graphEdges`.
- `frontend/src/data/me/people.ts` — mock seed élek.
- `frontend/src/data/me/peopleHooks.ts` — a real ág mappelése (ha kell).
- `frontend/src/features/me/logic/peopleVisuals.ts` — `GRAPH_KIND_META` (label + clay ikon + csempe-szín).
- `frontend/src/features/me/pages/PersonDetailPage.tsx` — „Kapcsolt események · gráf" szekció.
- `frontend/src/styles/prototype.css` — `.ppl-evt` család.
- Tesztek: `PersonDetailPage.test.tsx`, `peopleHooks.test.tsx`, `KnowledgePage.test.tsx` (kind-lista), `frontend/src/test/msw/handlers.ts` ha kell.

**Docs:** `docs/features/me.md`, `docs/features/companion.md`, `docs/CODEMAP.md`.

---

### Task 1: PERSON node kind végponttól végpontig (író nélkül)

A PERSON kind létezik a DB CHECK-ben, az entitásban, a kontraktusban és az FE
kind-listájában — de még semmi nem ír ilyen node-ot. Ez a task önmagában
regressziómentes: minden meglévő viselkedés változatlan.

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609011000_mezo-06o0.4_knowledge_node_person_kind.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (fájl vége)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/entity/GraphNodeEntity.java`
- Modify: `api/feature/knowledge-graph/knowledge-graph.yml`
- Modify: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` (generált)
- Modify: `frontend/src/data/insights/graph.ts`
- Test: `frontend/src/features/me/pages/KnowledgePage.test.tsx` (meglévő, csak ha kind-listát assertál)

**Interfaces:**
- Consumes: —
- Produces: `GraphNodeEntity.KIND_PERSON = "PERSON"`; a `GraphNodeResponse.kind` enum és az FE `GraphNodeKind` union tartalmazza a `PERSON`-t; `GRAPH_KIND_GROUPS` tartalmazza a `['PERSON', 'Emberek']` párt.

- [ ] **Step 1: Írd meg a migrációt**

`backend/src/main/resources/db/changelog/1.0.0/script/202609011000_mezo-06o0.4_knowledge_node_person_kind.sql`:

```sql
-- Emberek S5 (mezo-06o0.4): a gráf-tükör hetedik node-fajtája. Az aktív személy PERSON
-- node-ként jelenik meg a tudásgráfban, hogy a [Összefüggések] blokk és a Tudásgráf
-- felület az embereket is lássa. A kind oszlop varchar(12) — a 'PERSON' (6) elfér.
ALTER TABLE knowledge_node DROP CONSTRAINT ck_knowledge_node_kind;
ALTER TABLE knowledge_node
    ADD CONSTRAINT ck_knowledge_node_kind
        CHECK (kind IN ('PATTERN', 'PREFERENCE', 'GOAL', 'LIFE_EVENT', 'SEASON', 'INSIGHT', 'PERSON'));
```

- [ ] **Step 2: Kösd be a changelogba**

A `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` VÉGÉRE (a
`202608311600_mezo-1gim.14_create_character_run` blokk után), a meglévő behúzással:

```yaml
  - changeSet:
      id: "1.0.0:202609011000_mezo-06o0.4_knowledge_node_person_kind"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609011000_mezo-06o0.4_knowledge_node_person_kind.sql
```

- [ ] **Step 3: Bővítsd az entitást**

`GraphNodeEntity.java` — a `KIND_INSIGHT` sor UTÁN:

```java
    /** Emberek S5 (mezo-06o0.4): egy aktív személy tükre a gráfban. */
    public static final String KIND_PERSON = "PERSON";
```

és a `kind` mező `@Pattern`-je:

```java
    @Pattern(regexp = "PATTERN|PREFERENCE|GOAL|LIFE_EVENT|SEASON|INSIGHT|PERSON")
```

- [ ] **Step 4: Bővítsd a kontraktust**

`api/feature/knowledge-graph/knowledge-graph.yml`, a `GraphNodeResponse.kind` sora:

```yaml
        kind: { type: string, enum: [PATTERN, PREFERENCE, GOAL, LIFE_EVENT, SEASON, INSIGHT, PERSON] }
```

- [ ] **Step 5: Generáld újra a klienst**

Run: `cd api/generate && npm run generate:api`
Expected: `api/openapi.yml` és `frontend/src/data/_client/api.gen.ts` frissül; a `GraphNodeResponse.kind` union bővül `'PERSON'`-nal.

- [ ] **Step 6: Bővítsd az FE kind-listát**

`frontend/src/data/insights/graph.ts`, a `GRAPH_KIND_GROUPS` tömb végére:

```ts
  ['PERSON', 'Emberek'],
```

- [ ] **Step 7: Fordítás + fókuszált tesztek**

Run: `cd backend && ./mvnw clean test-compile`
Expected: BUILD SUCCESS.

Run: `cd backend && ./mvnw test -Dtest=GraphServiceIT -Dmezo.test.use-testcontainers=true`
Expected: zöld (a migráció lefut, semmi nem törik).

Run: `cd frontend && VITE_USE_MOCK=true pnpm test -- src/features/me/pages/KnowledgePage.test.tsx`
Expected: zöld. Ha a teszt a kind-csempék DARABSZÁMÁT assertálja, igazítsd 6-ról 7-re — de csak a számot, a teszt szándékát ne írd át.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(api): PERSON node kind a tudásgráfban (mezo-06o0.4)"
```

---

### Task 2: PERSON promóció és visszavonás a GraphPromotionService-ben

A `syncGoal`/`retractGoal` alakjának pontos mása. Trigger még nincs — csak a
`reconcile` sweep hívja; a listener a Task 3.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionPersonIT.java` (create)

**Interfaces:**
- Consumes: `GraphNodeEntity.KIND_PERSON` (Task 1).
- Produces:
  - `GraphPromotionService.SOURCE_PERSON = "person"`
  - `Optional<GraphNodeEntity> syncPerson(UUID userId, UUID personId)`
  - `Optional<GraphNodeEntity> retractPerson(UUID userId, UUID personId)`

- [ ] **Step 1: Írd meg a bukó ITt**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionPersonIT.java`.
A meglévő graph ITek szerkezetét kövesd (`GraphPromotionServiceIT` a minta: ugyanaz a
`@SpringBootTest` + `@ActiveProfiles` + populator-használat). A `PersonPopulator` már tud
`createCandidate(UUID owner, String name, String notes)`-t; aktív személyhez használd a
meglévő create-metódusát (nézd meg a populator publikus felületét, és ne írj újat, ha van
megfelelő).

```java
@Test
void syncPerson_shouldUpsertActiveNode_forActivePerson() {
    PersonEntity person = personPopulator.create(userId, "Petra");   // status = active
    Optional<GraphNodeEntity> node = promotionService.syncPerson(userId, person.getId());

    assertThat(node).isPresent();
    assertThat(node.get().getKind()).isEqualTo(GraphNodeEntity.KIND_PERSON);
    assertThat(node.get().getTitle()).isEqualTo("Petra");
    assertThat(node.get().getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    assertThat(node.get().getSourceKind()).isEqualTo(GraphPromotionService.SOURCE_PERSON);
    assertThat(node.get().getSourceId()).isEqualTo(person.getId());
}

@Test
void syncPerson_shouldNotPromote_forCandidate() {
    PersonEntity candidate = personPopulator.createCandidate(userId, "Marci", "idézet");
    assertThat(promotionService.syncPerson(userId, candidate.getId())).isEmpty();
}

@Test
void syncPerson_shouldBeIdempotent_andRevive() {
    PersonEntity person = personPopulator.create(userId, "Petra");
    UUID first = promotionService.syncPerson(userId, person.getId()).orElseThrow().getId();
    promotionService.retractPerson(userId, person.getId());   // nem archivál: még aktív
    UUID second = promotionService.syncPerson(userId, person.getId()).orElseThrow().getId();
    assertThat(second).isEqualTo(first);   // ugyanaz a node, sosem duplikál
}

@Test
void retractPerson_shouldArchiveNode_afterSoftDelete() {
    PersonEntity person = personPopulator.create(userId, "Petra");
    promotionService.syncPerson(userId, person.getId());
    personRepository.delete(person);   // @SQLDelete → soft

    Optional<GraphNodeEntity> archived = promotionService.retractPerson(userId, person.getId());
    assertThat(archived).isPresent();
    assertThat(archived.get().getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
}

@Test
void retractPerson_shouldBeNoOp_whilePersonStillActive() {
    PersonEntity person = personPopulator.create(userId, "Petra");
    promotionService.syncPerson(userId, person.getId());
    assertThat(promotionService.retractPerson(userId, person.getId())).isEmpty();
}

@Test
void reconcile_shouldSweepPersons_bothWays() {
    PersonEntity live = personPopulator.create(userId, "Petra");
    PersonEntity gone = personPopulator.create(userId, "Bence");
    promotionService.syncPerson(userId, gone.getId());
    personRepository.delete(gone);

    GraphReconcileResult result = promotionService.reconcile(userId);

    assertThat(result.upserted()).isGreaterThanOrEqualTo(1);   // `live` felkerült
    assertThat(result.retracted()).isGreaterThanOrEqualTo(1);  // `gone` node-ja archiválva
    assertThat(graphService.findBySource(userId, GraphPromotionService.SOURCE_PERSON, live.getId()))
        .isPresent();
}
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `cd backend && ./mvnw test -Dtest=GraphPromotionPersonIT -Dmezo.test.use-testcontainers=true`
Expected: fordítási hiba — `syncPerson`/`retractPerson`/`SOURCE_PERSON` nem létezik.

- [ ] **Step 3: Vedd fel a forrás-konstanst és a repót**

`GraphPromotionService.java` — a `SOURCE_GOAL` sor UTÁN:

```java
    /** Emberek S5 (mezo-06o0.4). A companion → people függés már létezik
     *  (PersonExtractionService); a fordított irány TILOS, ezért a people oldal nem tud
     *  a gráfról, és nem is kell tudnia: minden itt dől el. */
    public static final String SOURCE_PERSON = "person";
```

és a mezők közé (a `goalRepository` után):

```java
    private final PersonRepository personRepository;
```

import: `io.mrkuhne.mezo.feature.people.entity.PersonEntity`,
`io.mrkuhne.mezo.feature.people.repository.PersonRepository`.

- [ ] **Step 4: Írd meg a syncPerson-t**

A `syncGoal` UTÁN:

```java
    /**
     * Aktív személy -> PERSON node; minden más állapot (jelölt, archivált) archiválja a node-ját —
     * a {@link #syncGoal} alakja, ugyanazzal a „soha nem felejt, csak leveszi a színpadról"
     * szerződéssel.
     *
     * <p>A jelölt SZÁNDÉKOSAN nem kerül a gráfba: egy éjszakai extraktor-javaslat nem tény, amíg
     * a felhasználó rá nem bólint. Egy soha nem promótált, nem aktív személy tehát no-op (nincs mit
     * árnyékolni), pontosan mint a {@code syncGoal}-nál.
     *
     * <p>{@code summary} = kapcsolat + cadence (spec „Gráf-tükör"), mert ez az, amit a
     * {@code [Összefüggések]} prompt-blokk és a {@link GraphEdgeStructurer} olvas a személyről —
     * a `notes` a felhasználó szabad szövege, oda nem való.
     */
    @Transactional
    public Optional<GraphNodeEntity> syncPerson(UUID userId, UUID personId) {
        Optional<PersonEntity> found = personRepository.findByIdAndCreatedByAndDeletedFalse(personId, userId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        PersonEntity person = found.get();
        boolean active = "active".equals(person.getStatus());
        if (!active && graphService.findBySource(userId, SOURCE_PERSON, personId).isEmpty()) {
            return Optional.empty();   // sosem volt node — nincs mit árnyékolni
        }
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_PERSON,
            truncateTitle(person.getName()), personSummary(person), SOURCE_PERSON, person.getId(),
            null, Map.of("relationship", person.getRelationship(), "status", person.getStatus()));
        String status = active ? GraphNodeEntity.STATUS_ACTIVE : GraphNodeEntity.STATUS_ARCHIVED;
        if (!status.equals(node.getStatus())) {
            node.setStatus(status);
        }
        return Optional.of(node);
    }
```

és a `patternMeta` mellé, privát segédként:

```java
    /** „Élettárs · Napi" — kapcsolat, és ha van, a cadence-címke. */
    private static String personSummary(PersonEntity person) {
        String cadence = person.getContactCadenceLabel();
        return cadence == null || cadence.isBlank()
            ? person.getRelationshipHu()
            : person.getRelationshipHu() + " · " + cadence;
    }
```

- [ ] **Step 5: Írd meg a retractPerson-t**

A `retractGoal` UTÁN:

```java
    /** A {@link #syncPerson} DELETE-ági tükre, a {@link #retractGoal} mintájára: a soft-deleted
     *  személy láthatatlan a {@code ...AndDeletedFalse} finder számára, ezért a törlésnek saját
     *  visszavonása kell, különben a node örökre aktív marad. Az elvetett jelölt is ide fut
     *  (a reject soft-delete) — annak jellemzően nincs is node-ja, így ez no-op. */
    @Transactional
    public Optional<GraphNodeEntity> retractPerson(UUID userId, UUID personId) {
        boolean stillActive = personRepository.findByIdAndCreatedByAndDeletedFalse(personId, userId)
            .filter(p -> "active".equals(p.getStatus()))
            .isPresent();
        if (stillActive) {
            return Optional.empty();
        }
        return archiveBySource(userId, SOURCE_PERSON, personId);
    }
```

- [ ] **Step 6: Kösd be a reconcile-ba**

A `for (GoalEntity goal : ...)` hurok UTÁN, a komplement-sweep ELŐTT:

```java
        for (PersonEntity person : personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
            try {
                count += proxy.syncPerson(userId, person.getId()).isPresent() ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: person {} sync failed for user {}", person.getId(), userId, e);
            }
        }
```

és a komplement-sweep `switch`-ébe, a `case SOURCE_GOAL` UTÁN:

```java
                    case SOURCE_PERSON -> proxy.retractPerson(userId, sourceId).isPresent();
```

Frissítsd a `reconcile` javadoc felsorolásait is: ahol a három forrást sorolja
(„patterns / facts / goals"), ott mostantól négy van — a személyekkel együtt.

- [ ] **Step 7: Futtasd az ITt**

Run: `cd backend && ./mvnw test -Dtest=GraphPromotionPersonIT -Dmezo.test.use-testcontainers=true`
Expected: mind zöld.

- [ ] **Step 8: Regresszió + ArchUnit**

Run: `cd backend && ./mvnw test -Dtest='GraphPromotionServiceIT,GraphMaintenance*IT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: zöld. Ha az `ArchitectureTest.feature_slices_are_cycle_free` bukik, NE regeneráld a freeze store-t magadtól — jelentsd BLOCKED-ként, mert az azt jelentené, hogy új szelet-él keletkezett (a `companion → people` élnek már léteznie kell).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(be): aktív személy PERSON node-ként a gráfban (mezo-06o0.4)"
```

---

### Task 3: PersonSavedEvent / PersonDeletedEvent és a promóciós hook

A személy-írások élőben frissítik a gráfot — nem kell megvárni az éjszakát.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonSavedEvent.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonDeletedEvent.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionListener.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleContractIT.java` (bővítés)

**Interfaces:**
- Consumes: `GraphPromotionService.syncPerson/retractPerson` (Task 2).
- Produces: `PersonSavedEvent(UUID userId, UUID personId)`, `PersonDeletedEvent(UUID userId, UUID personId)`; a `PeopleService` minden ír-útja publikál.

- [ ] **Step 1: Írd meg az eseményeket**

`PersonSavedEvent.java`:

```java
package io.mrkuhne.mezo.feature.people.service;

import java.util.UUID;

/**
 * Minden olyan írás után, ami a személy nevét, kapcsolatát, cadence-ét vagy státuszát
 * megváltoztathatja (create / update / jelölt-elfogadás). A W2.2 gráf-promóciós listener
 * fogyasztja, ami szinkronban tartja a PERSON node-ot — aktív személy aktív node-ot kap,
 * minden más archiválja. A people feature semmit nem tud a gráfról: ez egyirányú esemény,
 * nincs kör (mezo-06o0.4).
 */
public record PersonSavedEvent(UUID userId, UUID personId) {
}
```

`PersonDeletedEvent.java`:

```java
package io.mrkuhne.mezo.feature.people.service;

import java.util.UUID;

/**
 * Soft-delete-et jelző esemény ({@code deletePerson}, és a jelölt-elvetés, ami szintén
 * soft-delete). A {@link PersonSavedEvent} fogyasztója a törölt sort már nem látja
 * (a findere {@code ...AndDeletedFalse}), ezért a törlésnek saját eseménye kell, különben
 * a PERSON node örökre aktív maradna (mezo-06o0.4).
 */
public record PersonDeletedEvent(UUID userId, UUID personId) {
}
```

- [ ] **Step 2: Publikálj a PeopleService minden ír-útján**

`PeopleService.java` — mező (a `mapper` után):

```java
    private final ApplicationEventPublisher eventPublisher;
```

import: `org.springframework.context.ApplicationEventPublisher`.

Publikálások (a `GoalService` mintája szerint, mindig a `save`/`delete` UTÁN, a return ELŐTT):

- `createPerson`: `eventPublisher.publishEvent(new PersonSavedEvent(userId, saved.getId()));`
- `updatePerson`: `eventPublisher.publishEvent(new PersonSavedEvent(userId, personId));` — a
  `personRepository.save(p)` után, még a stat-számolás előtt.
- `deletePerson`: a `personRepository.delete(...)` után
  `eventPublisher.publishEvent(new PersonDeletedEvent(userId, personId));`
- `decidePerson` reject-ág: a `personRepository.delete(p)` után, a `return snapshot;` ELŐTT
  `eventPublisher.publishEvent(new PersonDeletedEvent(userId, personId));`
- `decidePerson` accept-ág: a `personRepository.save(p)` után
  `eventPublisher.publishEvent(new PersonSavedEvent(userId, personId));`

Az accept-ág ezért így néz ki:

```java
        p.setStatus("active");
        PersonResponse response = mapper.toPersonResponse(personRepository.save(p), 0, 0, null);
        eventPublisher.publishEvent(new PersonSavedEvent(userId, personId));
        return response;
```

- [ ] **Step 3: Kösd be a listenert**

`GraphPromotionListener.java` — a `onGoalDeleted` UTÁN:

```java
    /** Emberek S5 (mezo-06o0.4): a személy-írás élőben frissíti a PERSON node-ot; a nightly
     *  {@code reconcile} már csak gyógyító háló (pl. ha a gráf-kapcsoló ki volt kapcsolva). */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPersonSaved(PersonSavedEvent event) {
        try {
            promotionService.syncPerson(event.userId(), event.personId());
        } catch (Exception e) {
            log.warn("Graph person sync failed for person {}", event.personId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPersonDeleted(PersonDeletedEvent event) {
        try {
            promotionService.retractPerson(event.userId(), event.personId());
        } catch (Exception e) {
            log.warn("Graph person retraction failed for person {}", event.personId(), e);
        }
    }
```

importok: `io.mrkuhne.mezo.feature.people.service.PersonSavedEvent`,
`io.mrkuhne.mezo.feature.people.service.PersonDeletedEvent`.

- [ ] **Step 4: Bizonyítsd, hogy a meglévő végpontok nem törnek**

Run: `cd backend && ./mvnw test -Dtest=PeopleContractIT -Dmezo.test.use-testcontainers=true`
Expected: mind a 20+ meglévő teszt zöld (az eseményeket senki nem hallgatja a
teszt-profilban vagy a listener bean hiányzik — mindkettő rendben).

- [ ] **Step 5: Adj hozzá egy publikálás-bizonyítékot**

A `PeopleContractIT`-be egy tesztet, ami `@MockitoSpyBean` / `ApplicationEvents` helyett a
LEGEGYSZERŰBB módon bizonyít: nézd meg, milyen esemény-assertálási idióma van már a
repóban (`grep -rn "ApplicationEvents\|@RecordApplicationEvents" backend/src/test`), és azt
használd. Ha nincs precedens, használd a Spring `@RecordApplicationEvents` +
`ApplicationEvents` párost:

```java
@Test
void createPerson_shouldPublishPersonSavedEvent() {
    // ... a meglévő create-hívás idiómája szerint
    assertThat(events.stream(PersonSavedEvent.class)).hasSize(1);
}
```

Ha a `@RecordApplicationEvents` az adott IT-osztályon nem működik (pl. a
`TestRestTemplate` másik szálon fut), akkor NE erőltesd: hagyd ki ezt a lépést, és
jelentsd DONE_WITH_CONCERNS-ként — a Task 2 ITje már bizonyítja a viselkedést, a
huzalozást a Task 4 ITje is érinti.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(be): person esemény-hookok a gráf-promócióhoz (mezo-06o0.4)"
```

---

### Task 4: Esemény-élek az éjszakai körben

Az S4 szándékosan kihagyott esemény-él-javaslat élesedik. Egy ÚJ PERSON node
promóciója már ma is fizet a `GraphEdgeStructurer`-ért (az `isNew` ág a
`promotePattern`-ben) — de a `syncPerson` szándékosan NEM hív strukturálót
(egy sima névváltás nem indokol LLM-hívást). Ezt a rést tölti be ez a passz:
az éjszakai körben azok a személyek kapnak éleket, akiknek van aktív node-juk,
volt aznap említésük, és még EGYETLEN élük sincs.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PersonExtractionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PersonExtractionResult.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PersonExtractionServiceIT.java` (bővítés)

**Interfaces:**
- Consumes: `GraphPromotionService.SOURCE_PERSON`, `GraphService.findBySource/edgesFrom/edgesTo`, `GraphEdgeStructurer.structureEdges` (mind létező).
- Produces: `PersonExtractionResult(int enriched, int candidates, int edgeLinked)` — a `ZERO` konstans is három mezős lesz.

- [ ] **Step 1: Bővítsd az eredmény-rekordot**

`PersonExtractionResult.java`: a rekord kap egy harmadik komponenst,
`int edgeLinked` (hány személy-node kapott ma éjjel él-strukturálást), a `ZERO`
konstans pedig `new PersonExtractionResult(0, 0, 0)`. A javadocot egészítsd ki egy
mondattal az új mezőről.

Minden hívóhelyet igazíts (a `PersonExtractionService` `new PersonExtractionResult(...)`
hívásai, és a `GraphMaintenanceJob` logsora):

```java
                    log.info("Person extraction for user {} on {}: {} mention(s) enriched, "
                            + "{} candidate(s) proposed, {} person node(s) edge-linked",
                        user.getId(), yesterday, r.enriched(), r.candidates(), r.edgeLinked());
```

(A pontos meglévő formátumot olvasd ki a fájlból, és csak EGY mezővel bővítsd.)

- [ ] **Step 2: Írd meg a bukó ITt**

`PersonExtractionServiceIT.java`-ba, a meglévő tesztek idiómájával
(`@ActiveProfiles("companion-fake")`, `PersonPopulator`, `MentionPopulator`):

```java
@Test
void extractFor_shouldStructureEdges_forEdgelessPersonNode() {
    // A GraphEdgeStructurer a node CÍMÉT és SUMMARY-ját küldi a modellnek; a fake a
    // user-üzenetben keresi a [fake-graph-edges:[...]] szentinelt, ezért a summary-ba
    // (relationshipHu) rejtjük.
    PersonEntity person = personPopulator.create(userId, "Petra");
    person.setRelationshipHu("Élettárs [fake-graph-edges:[{\"index\":0,\"kind\":\"SUPPORTS\",\"confidence\":0.8}]]");
    personRepository.save(person);
    // egy másik aktív node, hogy legyen mihez kötni (a strukturáló emptiness-gate-je)
    graphService.upsertNode(userId, GraphNodeEntity.KIND_LIFE_EVENT, "Nyári szabadság", null,
        "life_event_test", UUID.randomUUID(), null, Map.of());
    GraphNodeEntity personNode = promotionService.syncPerson(userId, person.getId()).orElseThrow();
    mentionPopulator.createToneless(userId, person.getId(), day, "Petrával sétáltunk.");

    PersonExtractionResult result = extractionService.extractFor(userId, day);

    assertThat(result.edgeLinked()).isEqualTo(1);
    assertThat(graphService.edgesFrom(userId, personNode.getId())).hasSize(1);
}

@Test
void extractFor_shouldSkipEdgeStructuring_whenPersonNodeAlreadyHasEdges() {
    // ugyanaz a felállás, de előbb kézzel húzunk egy élt a személy node-jából
    // → a passz nem hív modellt, edgeLinked = 0, és az él-szám marad 1
}

@Test
void extractFor_shouldSkipEdgeStructuring_whenPersonHasNoGraphNode() {
    // aktív személy, aznapi említés, DE syncPerson nélkül → nincs node → edgeLinked = 0
}
```

A második/harmadik teszt törzsét írd meg ténylegesen — az itt látható kommentek a
szándékot rögzítik, nem helyettesítik a kódot. A populator-metódusok pontos nevét a
meglévő tesztekből vedd (a `PersonExtractionServiceIT` már mindegyiket használja).

- [ ] **Step 3: Futtasd, hogy bukjon**

Run: `cd backend && ./mvnw test -Dtest=PersonExtractionServiceIT -Dmezo.test.use-testcontainers=true`
Expected: fordítási hiba (`edgeLinked` nincs) vagy `expected 1 but was 0`.

- [ ] **Step 4: Vedd fel a gráf-függéseket ObjectProviderrel**

`PersonExtractionService.java` — új mezők a `self` proxy MELLÉ:

```java
    // ObjectProvider, nem közvetlen függés: a gráf-kapcsoló (KNOWLEDGE_GRAPH) függetlenül
    // kapcsolható a COMPANION∧PEOPLE pártól, ami ezt a szervizt élteti — kikapcsolt gráfnál
    // ezek a beanek nem léteznek, és az él-passz egyszerűen kimarad.
    private final ObjectProvider<GraphService> graphService;
    private final ObjectProvider<GraphEdgeStructurer> edgeStructurer;
```

Konstansok az osztály tetején, a többi mellé:

```java
    /** Egy éjszaka legfeljebb ennyi személy-node-ért fizet él-strukturálást (cheap-tier hívás,
     *  de node-onként egy): a maradék a következő éjszakákon kerül sorra. */
    private static final int MAX_EDGE_LINKS_PER_NIGHT = 3;
    /** Az él-evidencia forrás-fajtája: a konkrét említés, ami miatt a személy aznap felmerült. */
    private static final String EDGE_EVIDENCE_KIND = "mention";
```

- [ ] **Step 5: Írd meg az él-passzt**

Új metódus a `persistNight` UTÁN:

```java
    /**
     * S5 esemény-él passz (mezo-06o0.4): a nap említett személyei közül azok kapnak
     * él-strukturálást, akiknek van AKTÍV PERSON node-juk, de még egyetlen élük sincs. A
     * {@code syncPerson} szándékosan nem hív strukturálót (egy névjavítás nem indokol LLM-hívást),
     * így ez a passz az egyetlen hely, ahol egy már promótált személy élt kap.
     *
     * <p>Az „még nincs éle" kapu az, ami ezt bezárja: egy személy legfeljebb EGYSZER fut végig
     * rajta, utána örökre kimarad — nincs éjszakánként ismétlődő költség. A napi
     * {@value #MAX_EDGE_LINKS_PER_NIGHT}-es sapka pedig egy nagy backlog első éjszakáját fogja
     * vissza.
     *
     * <p>Evidencia: a konkrét említés id-ja ({@code mention}), nem a személy — így az él
     * visszavezethető arra a mondatra, ami miatt megszületett.
     *
     * <p>IDENT-3: node-onként külön try/catch — egy személy hibája nem viszi el a többiét, és
     * SOHA nem viszi el a már commitolt gazdagítást (ez a metódus a {@code persistNight} UTÁN,
     * külön tranzakcióban fut).
     *
     * @return hány személy-node kapott ténylegesen él-strukturálást
     */
    @Transactional
    public int linkPersonEdges(UUID userId, List<MentionEntity> dayMentions) {
        GraphService graph = graphService.getIfAvailable();
        GraphEdgeStructurer structurer = edgeStructurer.getIfAvailable();
        if (graph == null || structurer == null || dayMentions.isEmpty()) {
            return 0;   // gráf kikapcsolva, vagy nincs mit nézni
        }
        Map<UUID, MentionEntity> firstMentionByPerson = new LinkedHashMap<>();
        for (MentionEntity m : dayMentions) {
            firstMentionByPerson.putIfAbsent(m.getPersonId(), m);
        }
        int linked = 0;
        for (Map.Entry<UUID, MentionEntity> entry : firstMentionByPerson.entrySet()) {
            if (linked >= MAX_EDGE_LINKS_PER_NIGHT) {
                break;
            }
            try {
                Optional<GraphNodeEntity> found =
                    graph.findBySource(userId, GraphPromotionService.SOURCE_PERSON, entry.getKey());
                if (found.isEmpty()) {
                    continue;   // jelölt vagy sosem promótált személy — nincs mit összekötni
                }
                GraphNodeEntity node = found.get();
                if (!GraphNodeEntity.STATUS_ACTIVE.equals(node.getStatus())
                        || !graph.edgesFrom(userId, node.getId()).isEmpty()
                        || !graph.edgesTo(userId, node.getId()).isEmpty()) {
                    continue;   // archivált, vagy már van éle — egyszer fut, nem éjszakánként
                }
                structurer.structureEdges(userId, node, EDGE_EVIDENCE_KIND, entry.getValue().getId());
                linked++;
            } catch (Exception e) {
                log.warn("Person edge structuring failed for person {} (user {})", entry.getKey(), userId, e);
            }
        }
        return linked;
    }
```

Importok, amik hiányoznak: `java.util.LinkedHashMap`, `java.util.Optional`,
`io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity`,
`io.mrkuhne.mezo.feature.companion.graph.service.GraphEdgeStructurer`,
`io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService`,
`io.mrkuhne.mezo.feature.companion.graph.service.GraphService`.

- [ ] **Step 6: Hívd meg az extractFor végén**

Az `extractFor`-ban, ahol ma `return self.getObject().persistNight(...)` van, előbb kösd le az
eredményt, futtasd az él-passzt a proxyn át (saját tranzakció — a gazdagítás már commitolt), és
add vissza a bővített eredményt:

```java
        PersonExtractionResult night = self.getObject().persistNight(userId, toneless, enrichments, candidates);
        // Külön tranzakció, a gazdagítás/jelölt commitja UTÁN: egy gráf-hiba nem viheti el az
        // éjszaka már megírt eredményét (a job soha nem próbál újra egy régi napot).
        int edgeLinked = self.getObject().linkPersonEdges(userId, dayMentions);
        return new PersonExtractionResult(night.enriched(), night.candidates(), edgeLinked);
```

`dayMentions` = a nap ÖSSZES mentionje (nem csak a tone-nélküliek). Ha ez a lista ma nem áll
elő az `extractFor`-ban, állítsd elő ugyanazzal a nap-ablakos lekérdezéssel, amit a
tone-nélküliekhez használ, csak a tone-szűrő nélkül; ha viszont a tone-nélküliek listáján kívül
nincs másik olvasás, akkor a `toneless` listát add át — de akkor a metódus javadocjában mondd ki,
hogy az él-passz csak a friss, még nem gazdagított említésekre néz.

Az `extractFor` korai visszatérési ágai (pre-spend kapu: nincs tone-nélküli mention ÉS üres
narratíva) SZÁNDÉKOSAN nem futtatják az él-passzt — egy teljesen üres napon nincs kit
összekötni. Ha viszont van aznapi említés, de nincs tone-nélküli, akkor az él-passznak futnia
KELL: ellenőrizd, hogy a kapu ezt nem zárja-e ki, és ha igen, told az él-passzt a kapu elé.

- [ ] **Step 7: Futtasd az ITt**

Run: `cd backend && ./mvnw test -Dtest=PersonExtractionServiceIT -Dmezo.test.use-testcontainers=true`
Expected: mind zöld (a 10 meglévő + 3 új).

Run: `cd backend && ./mvnw test -Dtest='GraphMaintenance*IT' -Dmezo.test.use-testcontainers=true`
Expected: zöld.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(be): esemény-élek a személy-node-okhoz az éjszakai körben (mezo-06o0.4)"
```

---

### Task 5: A port és a `PersonResponse.graphEdges`

Az FE-nek strukturált éllista kell személyenként. A `people` feature nem hívhatja a
gráfot, ezért SAJÁT portot deklarál, amit a graph-oldal valósít meg.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/PersonGraphEdgeSource.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/PersonGraphEdgeAdapter.java`
- Modify: `api/feature/people/people.yml`, `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/mapper/PeopleMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/PersonGraphEdgeAdapterIT.java` (create)

**Interfaces:**
- Consumes: `GraphPromotionService.SOURCE_PERSON`, `GraphService.listActive/edgesFrom/edgesTo`, package-private `GraphEdgeLineRenderer.KIND_VERBS`/`strength`.
- Produces:
  - `PersonGraphEdgeSource.edgesByPerson(UUID userId) -> Map<UUID, List<PersonGraphEdgeSource.Edge>>`
  - `record Edge(String nodeKind, String title, String relationHu, String strength)`
  - `PersonResponse.graphEdges: PersonGraphEdge[]` a kontraktusban.

- [ ] **Step 1: Deklaráld a portot**

`backend/src/main/java/io/mrkuhne/mezo/feature/people/PersonGraphEdgeSource.java`:

```java
package io.mrkuhne.mezo.feature.people;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Fogyasztó-tulajdonú port (ADR 0012, a {@code NarrativeNoteSource} idióma): a személy
 * részletek-oldala mutatja a személyhez kötött gráf-éleket, de a {@code people} feature NEM
 * függhet a {@code companion}tól (a fordított él már létezik, ez kört zárna). Ezért a people
 * deklarálja, mire van szüksége, lapos rekordokban, és a graph-oldali adapter tölti fel.
 *
 * <p>Kikapcsolt gráfnál nincs implementáció — a {@code PeopleService} {@code ObjectProvider}-en
 * át kéri, és üres térképpel dolgozik tovább.
 */
public interface PersonGraphEdgeSource {

    /**
     * Egy él a személy node-jából (vagy felé) nézve, a felhasználónak megmutatható alakban.
     *
     * @param nodeKind a MÁSIK végpont node-fajtája (GOAL, LIFE_EVENT, PATTERN, …)
     * @param title    a másik végpont címe
     * @param relationHu magyar kapcsolat-ige a személy felől nézve („támogatja", „kapcsolódik")
     * @param strength „erős" | „közepes" | „gyenge"
     */
    record Edge(String nodeKind, String title, String relationHu, String strength) {
    }

    /** Személy-id → élei, súly szerint csökkenő sorrendben, személyenként legfeljebb 3. */
    Map<UUID, List<Edge>> edgesByPerson(UUID userId);
}
```

- [ ] **Step 2: Írd meg a bukó ITt**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/PersonGraphEdgeAdapterIT.java` —
a meglévő graph ITek szerkezetével:

```java
@Test
void edgesByPerson_shouldReturnRenderedEdges_forActivePersonNode() {
    PersonEntity person = personPopulator.create(userId, "Ádám");
    GraphNodeEntity personNode = promotionService.syncPerson(userId, person.getId()).orElseThrow();
    GraphNodeEntity goalNode = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
        "Futóblokk · 8 hét", null, "goal_test", UUID.randomUUID(), null, Map.of());
    graphService.upsertEdge(userId, personNode.getId(), goalNode.getId(),
        GraphEdgeEntity.KIND_SUPPORTS, new BigDecimal("0.800"), List.of());

    List<PersonGraphEdgeSource.Edge> edges = adapter.edgesByPerson(userId).get(person.getId());

    assertThat(edges).hasSize(1);
    assertThat(edges.getFirst().nodeKind()).isEqualTo(GraphNodeEntity.KIND_GOAL);
    assertThat(edges.getFirst().title()).isEqualTo("Futóblokk · 8 hét");
    assertThat(edges.getFirst().relationHu()).isEqualTo("támogatja");
    assertThat(edges.getFirst().strength()).isEqualTo("erős");
}

@Test
void edgesByPerson_shouldDropEdge_whenOtherEndpointIsArchived() {
    // ugyanaz, de a goal node status='archived' → az él nem jelenik meg
}

@Test
void edgesByPerson_shouldCapAtThree_orderedByWeightDesc() {
    // négy él, súlyok 0.9 / 0.7 / 0.5 / 0.3 → 3 elem, a 0.3-as kimarad, a sorrend csökkenő
}
```

A második/harmadik teszt törzsét ténylegesen írd meg.

- [ ] **Step 3: Írd meg az adaptert**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/PersonGraphEdgeAdapter.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.people.PersonGraphEdgeSource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A {@link PersonGraphEdgeSource} graph-oldali megvalósítása (Emberek S5, mezo-06o0.4): a
 * személy PERSON node-jának legerősebb éleit adja vissza a részletek-oldalnak, ugyanazzal a
 * magyar szótárral, amit a {@code [Összefüggések]} prompt-blokk és a {@code
 * GraphNodeResponse.topEdges} használ ({@link GraphEdgeLineRenderer}) — ezért él ebben a
 * package-ben: a renderer package-private.
 *
 * <p>Egy él csak akkor számít, ha a MÁSIK végpontja is aktív node — egy archivált csomópontot
 * megnevező csempe zavarna, nem tájékoztatna (a {@code listActiveWithTopEdges} ugyanezt a
 * szabályt követi).
 *
 * <p>{@code @ConditionalOnProperty}: kikapcsolt gráfnál ez a bean nem létezik, és a
 * {@code PeopleService} üres térképpel dolgozik tovább.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class PersonGraphEdgeAdapter implements PersonGraphEdgeSource {

    /** Ugyanaz a megjelenítési sapka, mint a Tudásgráf csomópont-kártyáin. */
    private static final int MAX_EDGES_PER_PERSON = 3;

    private final GraphService graphService;

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<Edge>> edgesByPerson(UUID userId) {
        List<GraphNodeEntity> active = graphService.listActive(userId);
        Map<UUID, GraphNodeEntity> activeById = new HashMap<>();
        for (GraphNodeEntity node : active) {
            activeById.put(node.getId(), node);
        }
        Map<UUID, List<Edge>> byPerson = new HashMap<>();
        for (GraphNodeEntity node : active) {
            if (!GraphPromotionService.SOURCE_PERSON.equals(node.getSourceKind()) || node.getSourceId() == null) {
                continue;
            }
            List<GraphEdgeEntity> touching = new ArrayList<>(graphService.edgesFrom(userId, node.getId()));
            touching.addAll(graphService.edgesTo(userId, node.getId()));
            // A rendezés a NYERS élsúlyon történik, MIELŐTT Edge-re mappelnénk: az Edge már csak
            // a durva „erős/közepes/gyenge" szót hordozza, azon rendezni elveszítené a sorrendet.
            List<Edge> edges = touching.stream()
                .sorted(Comparator.comparing(GraphEdgeEntity::getWeight,
                    Comparator.nullsLast(Comparator.reverseOrder())))
                .map(e -> toEdge(node, e, activeById))
                .filter(java.util.Objects::nonNull)
                .limit(MAX_EDGES_PER_PERSON)
                .toList();
            if (!edges.isEmpty()) {
                byPerson.put(node.getSourceId(), edges);
            }
        }
        return byPerson;
    }

    /** null, ha a másik végpont nem aktív node (archivált/jelölt/törölt). */
    private Edge toEdge(GraphNodeEntity personNode, GraphEdgeEntity edge, Map<UUID, GraphNodeEntity> activeById) {
        UUID otherId = personNode.getId().equals(edge.getFromNodeId()) ? edge.getToNodeId() : edge.getFromNodeId();
        GraphNodeEntity other = activeById.get(otherId);
        if (other == null) {
            return null;
        }
        return new Edge(other.getKind(), other.getTitle(),
            GraphEdgeLineRenderer.KIND_VERBS.getOrDefault(edge.getKind(), edge.getKind()),
            GraphEdgeLineRenderer.strength(edge.getWeight()));
    }
}
```

- [ ] **Step 4: Futtasd az adapter ITt**

Run: `cd backend && ./mvnw test -Dtest=PersonGraphEdgeAdapterIT -Dmezo.test.use-testcontainers=true`
Expected: mind zöld.

- [ ] **Step 5: Bővítsd a kontraktust**

`api/feature/people/people.yml` — a `PersonResponse.properties`-be:

```yaml
        graphEdges:
          type: array
          description: >-
            A személy PERSON node-jának legerősebb gráf-élei (legfeljebb 3, súly szerint
            csökkenő). Üres, ha a gráf ki van kapcsolva, vagy a személynek nincs node-ja/éle.
          items: { $ref: '#/components/schemas/PersonGraphEdge' }
```

és a `PersonResponse` `required` listájába: `- graphEdges`.

Új séma a `PersonResponse` MELLÉ (ugyanabban a `components/schemas` blokkban):

```yaml
    PersonGraphEdge:
      type: object
      description: Egy gráf-él a személy felől nézve — a másik végpont, és hogy hogyan kapcsolódik.
      required: [nodeKind, title, relationHu, strength]
      properties:
        nodeKind:
          type: string
          description: A másik végpont node-fajtája (PATTERN | PREFERENCE | GOAL | LIFE_EVENT | SEASON | INSIGHT | PERSON).
        title:
          type: string
        relationHu:
          type: string
          description: Magyar kapcsolat-ige (kiváltja | megelőzte | támogatja | ütközik vele | kapcsolódik).
        strength:
          type: string
          description: erős | közepes | gyenge
```

`nodeKind`/`relationHu`/`strength` SZÁNDÉKOSAN sima `string`, nem `enum`: az ékezetes
enum-értékek generált Java konstansnevei törékenyek, és ezek a mezők megjelenítési szövegek,
nem vezérlő-értékek.

- [ ] **Step 6: Generálj + töltsd fel a service-ben**

Run: `cd api/generate && npm run generate:api`

`PeopleMapper.java` — a `toPersonResponse` fölé:

```java
    @Mapping(target = "graphEdges", ignore = true)   // a service tölti a gráf-portból
```

`PeopleService.java` — új mező:

```java
    // ObjectProvider: kikapcsolt gráfnál nincs implementáció, és a személy-lista attól még teljes.
    private final ObjectProvider<PersonGraphEdgeSource> graphEdgeSource;
```

a `getBootstrap`-ban, a `personResponses` építése ELŐTT:

```java
        Map<UUID, List<PersonGraphEdgeSource.Edge>> edgesByPerson = graphEdgeSource
            .getIfAvailable(() -> u -> Map.of())
            .edgesByPerson(userId);
```

és a személy-mappelésben, a `mapper.toPersonResponse(...)` UTÁN (a `.map(p -> {...})` blokkban):

```java
                PersonResponse response = mapper.toPersonResponse(p, own.size(), thisWeek, lastAt);
                response.setGraphEdges(edgesByPerson.getOrDefault(p.getId(), List.of()).stream()
                    .map(e -> new PersonGraphEdge(e.nodeKind(), e.title(), e.relationHu(), e.strength()))
                    .toList());
                return response;
```

A generált `PersonGraphEdge` konstruktor-alakját ellenőrizd a generált forrásban
(`backend/target/generated-sources/openapi`) — ha nem all-args, használd a setterek/builder
alakot, amit a generátor ad.

A `createPerson`/`updatePerson`/`decidePerson` válaszaiban a `graphEdges` maradjon üres lista
(nem null): ott a `mapper.toPersonResponse` után `response.setGraphEdges(List.of())`. Ezt a
három helyet is írd meg — a `required` mező sosem hiányozhat a wire-ról.

- [ ] **Step 7: Fordítás + kontraktus-tesztek**

Run: `cd backend && ./mvnw test -Dtest='PeopleContractIT,PersonGraphEdgeAdapterIT' -Dmezo.test.use-testcontainers=true`
Expected: zöld.

Adj a `PeopleContractIT`-hez EGY tesztet, ami bizonyítja, hogy a bootstrap `graphEdges`-e
üres tömb (nem null) egy gráf nélküli személyre.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(api): personRe graph-élek a bootstrap válaszban (mezo-06o0.4)"
```

---

### Task 6: „Kapcsolt események · gráf" a részletek-oldalon

**Files:**
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/me/people.ts`
- Modify: `frontend/src/data/me/peopleHooks.ts` (csak ha a real ág explicit mappelést végez)
- Modify: `frontend/src/features/me/logic/peopleVisuals.ts`
- Modify: `frontend/src/features/me/pages/PersonDetailPage.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Test: `frontend/src/features/me/pages/PersonDetailPage.test.tsx`

**Interfaces:**
- Consumes: `PersonResponse.graphEdges` (Task 5).
- Produces: `PersonEntry.graphEdges: PersonGraphEdge[]`; `GRAPH_KIND_META` a `peopleVisuals.ts`-ben.

- [ ] **Step 1: Bővítsd a típust**

`frontend/src/data/types.ts` — a `PersonEntry` interfész ELŐTT:

```ts
export interface PersonGraphEdge {
  nodeKind: string
  title: string
  relationHu: string
  strength: string
}
```

és a `PersonEntry`-be, a `ties: string[]` UTÁN:

```ts
  graphEdges: PersonGraphEdge[]
```

- [ ] **Step 2: Írd meg a bukó tesztet**

`PersonDetailPage.test.tsx`-be (a meglévő `createMemoryRouter(routes)` idiómával — a
`useNavigate`-mock TILOS):

```ts
it('rendereli a kapcsolt gráf-eseményeket', async () => {
  renderPersonDetail('pp-petra')   // a fájl meglévő helper-idiómája szerint
  expect(await screen.findByText('Kapcsolt események · gráf')).toBeInTheDocument()
  expect(screen.getByText('Futóblokk · 8 hét')).toBeInTheDocument()
  expect(screen.getByText(/Cél · támogatja/)).toBeInTheDocument()
})

it('elhagyja a szekciót, ha nincs gráf-él', async () => {
  renderPersonDetail('pp-reka')    // seed: graphEdges: []
  expect(await screen.findByText('Hangulat-ív')).toBeInTheDocument()
  expect(screen.queryByText('Kapcsolt események · gráf')).not.toBeInTheDocument()
})
```

Run: `cd frontend && VITE_USE_MOCK=true pnpm test -- src/features/me/pages/PersonDetailPage.test.tsx`
Expected: bukik (nincs ilyen szöveg).

- [ ] **Step 3: Bővítsd a mock seedet**

`frontend/src/data/me/people.ts` — MINDEN személynek adj `graphEdges` mezőt (a `ties` után),
a prototípus `events` tömbjeinek megfelelően:

```ts
    graphEdges: [
      { nodeKind: 'LIFE_EVENT', title: 'Nyári szabadság · júl 14–21', relationHu: 'kapcsolódik', strength: 'erős' },
      { nodeKind: 'GOAL', title: 'Esti rutin', relationHu: 'támogatja', strength: 'közepes' },
    ],
```

Petra: a fenti kettő. Bence: `[{ nodeKind: 'PATTERN', title: 'Lemondott programok × hangulat', relationHu: 'kapcsolódik', strength: 'közepes' }]`.
Ádám: `[{ nodeKind: 'GOAL', title: 'Futóblokk · 8 hét', relationHu: 'támogatja', strength: 'erős' }]`.
Réka / Mama / a többi: `graphEdges: []` (a prototípus is üres eseménylistát ad nekik) — és a
`pp-marci` jelöltnek is üres.

- [ ] **Step 4: Vedd fel a kind-metát**

`frontend/src/features/me/logic/peopleVisuals.ts` — a meglévő `TONE_META`/`CTX_META`/`SRC_META`
mintájára:

```ts
/** Gráf-node fajta → magyar címke, clay ikon és csempe-tónus. A prototípus renderDet()
 *  `.evt.amber` / `.evt.sage` / `.evt.lav` osztályai: életesemény = arany, cél = zsálya,
 *  minden más (minta, preferencia, szezon, belátás, személy) = levendula. */
export const GRAPH_KIND_META: Record<string, { label: string; clay: ClayIconName; tone: 'amber' | 'sage' | 'lav' }> = {
  LIFE_EVENT: { label: 'Életesemény', clay: 'i-nap', tone: 'amber' },
  GOAL: { label: 'Cél', clay: 'i-cel', tone: 'sage' },
  PATTERN: { label: 'Minta', clay: 'i-minta', tone: 'lav' },
  PREFERENCE: { label: 'Preferencia', clay: 'i-tudas', tone: 'lav' },
  SEASON: { label: 'Szezon', clay: 'i-termes', tone: 'lav' },
  INSIGHT: { label: 'Belátás', clay: 'i-kristaly', tone: 'lav' },
  PERSON: { label: 'Ember', clay: 'i-emberek', tone: 'lav' },
}

/** Ismeretlen fajta (egy jövőbeli node-kind) nem tünteti el a csempét: semleges levendula. */
export const GRAPH_KIND_FALLBACK = { label: 'Csomópont', clay: 'i-tudas', tone: 'lav' } as const
```

(`ClayIconName` importját a fájl meglévő importjaihoz igazítsd.)

- [ ] **Step 5: Írd meg a szekciót**

`PersonDetailPage.tsx` — a „Milyen helyzetekben" (`ppl-ctxcard`) blokk UTÁN, az „Amit Mezo tud"
ELŐTT (a prototípus `renderDet()` sorrendje):

```tsx
          {person.graphEdges.length > 0 && (
            <>
              <div className="ppl-lsec rise">
                <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>
                  Kapcsolt események · gráf
                </span>
                <span className="ppl-lcnt">{person.graphEdges.length}</span>
              </div>
              {person.graphEdges.map((edge, i) => {
                const meta = GRAPH_KIND_META[edge.nodeKind] ?? GRAPH_KIND_FALLBACK
                return (
                  <button
                    key={`${edge.nodeKind}-${edge.title}`}
                    type="button"
                    className={`ppl-evt ppl-evt-${meta.tone} rise`}
                    style={{ '--d': `${130 + i * 30}ms` } as CSSProperties}
                    onClick={() => navigate(`/me/knowledge?kind=${edge.nodeKind}`)}
                  >
                    <span className="ppl-evtpic"><ClayIcon name={meta.clay} size={18} /></span>
                    <span className="grow">
                      <b>{edge.title}</b>
                      <span className="ppl-evtmt">{meta.label} · {edge.relationHu} · {edge.strength}</span>
                    </span>
                    <Icon name="chevron-right" size={10} />
                  </button>
                )
              })}
            </>
          )}
```

Két dolgot ellenőrizz, mielőtt ezt beírod:
1. Az `Icon` sprite-készletében van-e `chevron-right`. Ha nincs, használd a repóban máshol
   használt jobbra-mutató ikon nevét (`grep -rn 'name="chevron' frontend/src`), vagy — ha nincs
   ilyen — egy `<span aria-hidden="true">›</span>`-t a prototípus szerint.
2. Van-e `--mz-cell-lav-ink` token. Ha nincs, keresd meg a levendula tónus meglévő
   ink-tokenjét (`grep -n 'lav' frontend/src/styles/*.css`), és azt használd.

Az importokat egészítsd ki: `GRAPH_KIND_META, GRAPH_KIND_FALLBACK` a `peopleVisuals`-ból.

- [ ] **Step 6: Írd meg a CSS-t**

`frontend/src/styles/prototype.css`, a meglévő `ppl-` szekcióba (a `.ppl-ctxcard` közelébe).
A prototípus `.lsec`/`.evt` értékei ×1,18 skálával. HARDCODOLT HEX TILOS — a gradiensekhez
a meglévő `--mz-*` tónus-tokeneket használd (arany/zsálya/levendula cellák tokenjei már
léteznek; `grep -n 'mz-cell-lav\|mz-cell-sage\|mz-cell-amber' frontend/src/styles/*.css`).
Ha egy pontos árnyalathoz nincs token, vegyél fel újat MINDKÉT `:root`-ba (`--mz-evt-*`),
a dark ág a meglévő wash-tokenek deriválása legyen.

```css
/* Emberek S5 (mezo-06o0.4) — „Kapcsolt események · gráf" a személy részletek-oldalán.
   Forrás: emberek-head.html .lsec / .evt (×1,18). */
.ppl-lsec { display: flex; align-items: center; gap: 7px; padding: 12px 2px 7px; }
.ppl-lcnt {
  margin-left: auto; font-size: 10.6px; font-weight: 700;
  color: var(--mz-ink-soft); font-variant-numeric: tabular-nums;
}
.ppl-evt {
  display: flex; gap: 11px; align-items: center; width: 100%; text-align: left;
  border: 0.5px solid var(--mz-hairline); border-radius: 19px; padding: 13px 14px;
  margin-bottom: 11px; cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.3, 0.8, 0.4, 1.4);
}
.ppl-evt:active { transform: scale(0.97); }
.ppl-evtpic {
  width: 35px; height: 35px; border-radius: 12px; display: grid; place-items: center;
  flex: none; background: var(--mz-surface-raised);
}
.ppl-evt b { font-size: 11.6px; font-weight: 700; }
.ppl-evtmt {
  display: block; font-size: 8.9px; color: var(--mz-ink-soft); margin-top: 1px;
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) { .ppl-evt { transition: none; } }
```

A `.ppl-evt-amber` / `.ppl-evt-sage` / `.ppl-evt-lav` háttér-gradienseket a meglévő
cella-tokenekkel írd meg. A fenti tokennevek (`--mz-ink-soft`, `--mz-hairline`,
`--mz-surface-raised`) ILLUSZTRATÍVAK: a fájlban ténylegesen létező neveket használd,
és ha egy sincs, vegyél fel újat mindkét `:root`-ba.

- [ ] **Step 7: Futtasd a tesztet mindkét módban**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test -- src/features/me/pages/PersonDetailPage.test.tsx`
Run: `cd frontend && VITE_USE_MOCK=false pnpm test -- src/features/me/pages/PersonDetailPage.test.tsx src/data/me/peopleHooks.test.tsx`
Expected: mind zöld. Real módban a MSW `GET /api/people` válasza is kap `graphEdges`-t —
ha a handler fix fixtúrát ad vissza, egészítsd ki (`frontend/src/test/msw/handlers.ts`).

- [ ] **Step 8: Teljes FE-kapu**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test`
Run: `cd frontend && VITE_USE_MOCK=false pnpm test`
Run: `cd frontend && pnpm build`
Expected: mind zöld. A `mozaikCssTokens` guard KÜLÖNÖSEN fontos: ha bukik, az új CSS-ben
(vagy a KOMMENTJEIBEN) hardcodolt hex van — cseréld tokenre, ne az exemption-listát bővítsd.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(fe): Kapcsolt események · gráf a személy részletek-oldalon (mezo-06o0.4)"
```

---

### Task 7: Dokumentáció és teljes kapu

**Files:**
- Modify: `docs/features/me.md`
- Modify: `docs/features/companion.md`
- Modify: `docs/CODEMAP.md` (regenerált)

**Interfaces:**
- Consumes: minden korábbi task.
- Produces: —

- [ ] **Step 1: Frissítsd a me.md-t**

Az Emberek szakaszban rögzítsd az S5 valóságát, és keress rá KIFEJEZETTEN olyan mondatokra,
amiket az S5 hazuggá tett (az S4-nél pontosan ez volt a review egyik fogása):

- az aktív személy PERSON node-ként megjelenik a tudásgráfban, és a chat
  `[Összefüggések]` blokkjában is felbukkanhat;
- a jelölt SZÁNDÉKOSAN nem kerül a gráfba, csak az elfogadott személy;
- a törlés / archiválás / jelölt-elvetés archiválja a node-ot (a gráf nem felejt, csak
  leveszi a színpadról);
- a részletek-oldal „Kapcsolt események · gráf" szekciója a `PersonResponse.graphEdges`-ből
  jön, legfeljebb 3 él, súly szerint;
- kikapcsolt `KNOWLEDGE_GRAPH` mellett a szekció egyszerűen nincs — az oldal minden más része
  változatlan.

Ha a doc bárhol azt állítja, hogy „az emberek nem szerepelnek a gráfban" vagy „ez S5 ígérete",
írd át jelen időbe.

- [ ] **Step 2: Frissítsd a companion.md-t**

- `GraphPromotionService`: negyedik forrás (`SOURCE_PERSON`), `syncPerson`/`retractPerson`,
  a `reconcile` négy promóciós hurka + a komplement-sweep `person` ága;
- `GraphPromotionListener`: két új hook (`PersonSavedEvent`/`PersonDeletedEvent`);
- `PersonExtractionService`: az él-passz — MIT csinál, mikor marad ki (nincs node, archivált
  node, már van éle), és hogy a napi sapka 3;
- `PersonGraphEdgeAdapter`: hol él (`feature/companion/graph/service`, mert a
  `GraphEdgeLineRenderer` package-private) és miért port-alapú (a `people → companion` él tilos).

- [ ] **Step 3: Regeneráld a CODEMAP-et**

Run: `node scripts/gen-codemap.mjs`
Expected: `docs/CODEMAP.md` frissül az új fájlokkal.

- [ ] **Step 4: Docs-kapu**

Run: `node scripts/lint-docs.mjs --errors-only`
Expected: `result: PASS` (a stale findingok tanácsadóak e zászló alatt). A kimenet utolsó
sorait idézd be a jelentésedbe.

- [ ] **Step 5: Teljes backend-kapu**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true`
Expected: BUILD SUCCESS. Ez a futás tartalmazza az `ArchitectureTest`-et is (a fókuszált
futások nem) — ha a `feature_slices_are_cycle_free` bukik, NE regeneráld a freeze store-t,
jelentsd BLOCKED-ként.

- [ ] **Step 6: Teljes FE-kapu**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test`
Run: `cd frontend && VITE_USE_MOCK=true pnpm test`
Run: `cd frontend && pnpm build`
Expected: mind zöld.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "docs: Emberek S5 gráf-tükör dokumentálása (mezo-06o0.4)"
```

---

## Self-Review

**Spec-lefedettség** (spec „Gráf-tükör" + §8/5. szelet):
- „`GraphPromotionService` bővül `SOURCE_PERSON`-nal, aktív személy → PERSON node upsert
  (title = név, summary = kapcsolat + cadence)" → Task 2, `syncPerson` + `personSummary`.
- „archiválás/törlés → node archive" → Task 2, `retractPerson` + a `syncPerson` archived-ága.
- „Trigger: `PersonSavedEvent` a goal-minta szerint" → Task 3.
- „PERSON node kind a kontraktusban/entitásban" → Task 1.
- „A `GraphTraversalService` és a ref-chip pipeline változatlanul, ingyen szolgálja ki" →
  szándékosan NINCS task: a traversal `status='active'` node-okat olvas kind-független módon,
  tehát a PERSON node a promóció pillanatától benne van. A Task 7 dokumentálja.
- „ekkor élesedik a `PersonExtractionService` esemény-él javaslata (`GraphEdgeStructurer`-mintára,
  evidencia a mention id-vel)" → Task 4.
- „FE: »Kapcsolt események · gráf« él-csempék a `PersonDetailPage`-en" → Task 5 + 6.
- „Teszt: `GraphPromotionServiceIT` bővítés, `PersonExtractionServiceIT` él-javaslat ág,
  FE mindkét mód" → Task 2 (külön IT-fájlban, hogy a meglévő ne nőjön tovább), Task 4, Task 6.

**Amit ez a szelet SZÁNDÉKOSAN nem csinál** (és amit a review-nak nem szabad hiányként
felrónia): nincs új REST-végpont a gráfra; a `GraphEdgeStructurer` promptja változatlan (a
PERSON node ugyanúgy egy címmel és summary-val jelenik meg neki, mint bármely másik); a
`MentionDetectionService` és a heti/összegző fogyasztók érintetlenek; a chat
kontextus-snapshotba az emberek bekötése továbbra is külön issue (spec §3).

**Típus-konzisztencia:** `SOURCE_PERSON = "person"` (Task 2) ugyanaz a string a Task 4
`findBySource` hívásában és a Task 5 adapterében. `PersonExtractionResult` három mezős a
Task 4 után — a `GraphMaintenanceJob` logsora ugyanabban a taskban igazodik.
`PersonGraphEdgeSource.Edge` négy mezője (`nodeKind`, `title`, `relationHu`, `strength`)
egy az egyben a kontraktus `PersonGraphEdge` mezőneveivel és az FE `PersonGraphEdge`
típusával.

**Ismert kockázat, amit a végrehajtónak látnia kell:** a Task 4 él-passza LLM-hívást
tesz egy `@Transactional` metóduson belül (a `GraphEdgeStructurer` szerződése ezt kívánja,
lásd az osztály „Transaction shape" javadocját) — egy DB-kapcsolat nyitva marad a hívás
idejére, éjszakánként legfeljebb 3×. Ez tudatos, a `promotePattern` pontosan ugyanezt teszi.
