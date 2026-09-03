# Emberek S4 — éjszakai LLM-kör Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `PersonExtractionService` éjszakai LLM-kör: a nap tone-nélküli mention-jeinek gazdagítása (tónus + intenzitás + kontextus), ismeretlen visszatérő nevekre `person(status='candidate', source_kind='extractor')` javaslat; hozzá a `POST /api/people/{personId}/decision` végpont és a FE jelölt-inbox (arany kártyák a PeopleJeloltekPage-en).

**Architecture:** A `PersonExtractionService` a `LifeEventExtractionService` ikertestvére a `feature/companion/service`-ben (companion→people él már létezik az S2 óta; people→companion TILOS — ArchUnit ciklus). Egy olcsó-LLM hívás/nap/user, a `GraphMaintenanceJob` 4. fázisaként (`ObjectProvider`, mert a kapcsolói eltérnek a job-étól). Bizonytalan utalás SOHA nem ír: a jelölt-javaslatot a szerviz maga újra-validálja fold-alapú előfordulás-számlálással (nap ≥2 vagy hét ≥3), és az ismert/elvetett neveket natív (soft-deleted sorokat is látó) lekérdezéssel szűri. A decision végpont a `LifeEventCandidateService.decide` mintája a people feature-ben.

**Tech Stack:** Spring Boot 4, contract-first OpenAPI (openapi-generator), `CompanionLlm` port + `FakeCompanionLlm` marker-dispatch IT-k, `LlmCallContext` audit, React + TanStack Query dual-mode (useDualQuery), MSW, Vitest.

## Global Constraints

- Backend teszt MINDIG: `./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=...` (a fix-DB mód hamis hibákat ad).
- Soha ne fusson két mvnw build egyszerre.
- FE dual-mode gate a worktree-ben MINDIG explicit: `VITE_USE_MOCK=false pnpm test` ÉS `VITE_USE_MOCK=true pnpm test` (a bare `pnpm test` itt kétszer mock).
- FE navigáció-teszt: `createMemoryRouter` a valós `routes` exporttal (`frontend/src/app/routes.tsx`) — useNavigate-mock TILOS.
- Prototípus-hűség 1:1, ×1,18 px-skála; forrás: `docs/design_2.0/prototypes/emberek.html` (CSS) + `docs/design_2.0/prototypes/src/emberek-body.html` (markup/logika, `renderJel()`).
- Új CSS-tokent mindkét `:root` blokkban fel kell venni a `frontend/src/styles/prototype.css`-ben (mozaikCssTokens guard tesztel rá). Ikon: kizárólag clay sprite (`ClayIcon`), emoji sehol.
- Kontraktus: request-mezőn `pattern` az enum helyett (`^(accept|reject)$` — invalid enum 500-at adna, pattern 400-at); kontraktus-módosítás után `./mvnw clean test-compile` a bizonyíték, a `generate-sources` önmagában nem elég.
- Nyers RuntimeException/IllegalStateException/IllegalArgumentException tilos a techcore-on kívül (ArchUnit `no_raw_generic_exceptions_outside_techcore`); ház-kivétel: `SystemRuntimeErrorException` + `SystemMessage`.
- IDENT-3: az éjszakai kör minden hibaága warn + degrade-to-zero, kivétel sosem szökik ki az `extractFor`-ból.
- Kapuzás: `PersonExtractionService` = `COMPANION_SWITCH` ∧ `PEOPLE_SWITCH` (`@ConditionalOnProperty` tömb-AND); a decision végpont sima people-út (nincs extra switch).
- Switch-konstansok: `FeaturesConfiguration.COMPANION_SWITCH`, `FeaturesConfiguration.PEOPLE_SWITCH` (`mezo.feature.people.enabled`).
- Feladatkövetés: bd (driving issue: `mezo-06o0.3`); TodoWrite/markdown TODO tilos.
- Commit subject: conventional + bd id, pl. `feat(api): people decision végpont (mezo-06o0.3)`.

## Kulcs-mintafájlok (olvasd, mielőtt kódolsz)

- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/LifeEventExtractionService.java` — az ikertestvér: pre-spend kapuk, `LlmCallContextHolder.runWith`, self-proxy `@Transactional` persist, IDENT-3.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceJob.java` — a fázis-izolált éjszakai lánc.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/LifeEventCandidateService.java` (60–85. sor) — a decide minta (already-decided 400, reject = snapshot + soft delete).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — marker-dispatch (`LIFE_EVENTS_SENTINEL` ág, ~655. sor).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/LifeEventExtractionServiceIT.java` — a szentinel-a-narratívában IT-idióma.
- `api/feature/knowledge-graph/knowledge-graph.yml` 65–100. sor — a decision kontraktus-precedens.
- `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/MentionDetectionService.java` — fold-match ház-szabályai (szó-ELEJI illeszkedés, szabad szóvég a magyar ragokhoz).

---

### Task 1: Kontraktus — `POST /api/people/{personId}/decision`

**Files:**
- Modify: `api/feature/people/people.yml`
- Generated (BE): `./mvnw clean test-compile` regenerálja az api.dto/api.controller osztályokat
- Generated (FE): `cd frontend && pnpm generate:api` (frissíti `frontend/src/data/_client/api.gen.ts`-t)

**Interfaces:**
- Produces: `PeopleApi.decidePerson(UUID personId, PersonDecisionRequest)` generált controller-interfész; `PersonDecisionRequest{ decision: String }` DTO; FE `components['schemas']['PersonDecisionRequest']`.

- [ ] **Step 1: people.yml bővítés.** A `/api/people/{personId}/mentions/{mentionId}` path-blokk UTÁN új path (a knowledge-graph decision precedens szerkezetével, People tag):

```yaml
  /api/people/{personId}/decision:
    post:
      tags: [People]
      operationId: decidePerson
      summary: >-
        Decide a candidate person (S4 nightly extractor inbox) — accept activates the person,
        reject soft-deletes it (the soft-deleted row is the extractor's reject list: the name
        is never re-proposed). One decision per candidate.
      parameters:
        - { name: personId, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/PersonDecisionRequest' }
      responses:
        '200':
          description: The decided person (status active on accept; the soft-deleted row snapshot on reject)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PersonResponse' }
        '400':
          description: PEOPLE_CANDIDATE_ALREADY_DECIDED / validation error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: RESOURCE_NOT_FOUND
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

  A `components/schemas` alá (a `UpdatePersonRequest` után):

```yaml
    PersonDecisionRequest:
      type: object
      required: [decision]
      properties:
        decision: { type: string, pattern: '^(accept|reject)$' }
```

  Figyelem: a fájl többi részének stílusát kövesd (idézőjelezés, behúzás); a `SystemMessageList` sémát ugyanúgy hivatkozd, ahogy a fájl többi 4xx-válasza teszi (nézd meg a meglévő `deletePerson` blokkot).

- [ ] **Step 2: BE regen + fordítás-bizonyíték.** Futtasd: `cd backend && ./mvnw clean test-compile`. Elvárt: BUILD SUCCESS, és a `target/generated-sources/openapi` alatt megjelenik a `PersonDecisionRequest` DTO. (Ha a merge-elt `api/openapi.yml`-t generátor állítja elő: `cd api/generate && npm ci --no-audit 2>/dev/null || npm install; npm run generate:api`, majd nézd meg a `git diff api/openapi.yml`-t — csak a decision blokk jelenhet meg benne.)

- [ ] **Step 3: FE regen.** `cd frontend && pnpm generate:api`, majd `pnpm exec tsc --noEmit` (gyors típus-gate). Elvárt: `api.gen.ts`-ben megjelenik a `PersonDecisionRequest`.

- [ ] **Step 4: Commit.**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): people jelölt-decision végpont a kontraktusban (mezo-06o0.3)"
```

---

### Task 2: BE — `PeopleService.decidePerson` + controller + `PeopleContractIT` bővítés

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/controller/PeopleController.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/PersonPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleContractIT.java`

**Interfaces:**
- Consumes: Task 1 `PersonDecisionRequest` DTO-ja; meglévő `requireOwnedPerson`, `PeopleMapper.toPersonResponse(PersonEntity, int, int, Instant)`.
- Produces: `PersonResponse decidePerson(UUID userId, UUID personId, PersonDecisionRequest req)` — Task 3/5 erre nem épül, a FE (Task 5) a wire-viselkedésre igen: accept → 200 + `status=active`; reject → 200 (soft-deleted snapshot); nem-candidate → 400 `PEOPLE_CANDIDATE_ALREADY_DECIDED`; idegen/nem létező → 404. Plusz: `PersonPopulator.createCandidate(UUID owner, String name, String notes)`.

- [ ] **Step 1: Populator-bővítés.** A `PersonPopulator`-ba új metódus (a meglévő `createPerson` mellé):

```java
    /** S4 extractor-candidate row — status/sourceKind exercise the DB CHECKs. */
    public PersonEntity createCandidate(UUID owner, String name, String notes) {
        PersonEntity p = new PersonEntity();
        p.setCreatedBy(owner);
        p.setName(name);
        p.setInitial(name.substring(0, 1).toUpperCase());
        p.setRelationship("friend");
        p.setRelationshipHu("Ismerős");
        p.setAffectBaseline("neutral");
        p.setNotes(notes);
        p.setStatus("candidate");
        p.setSourceKind("extractor");
        return personRepository.saveAndFlush(p);
    }
```

- [ ] **Step 2: Bukó tesztek.** A `PeopleContractIT`-be (a fájl meglévő auth/URL-idiómáját követve — nézd meg, hogyan hívja a többi teszt a végpontokat) négy teszt:
  - `testDecidePerson_shouldActivate_whenAccepted`: candidate létrehozása populatorral → `POST /api/people/{id}/decision` `{"decision":"accept"}` → 200, body `status=="active"`, `sourceKind=="extractor"` marad; utána `GET /api/people` bootstrapban a személy szerepel `status=active`-val.
  - `testDecidePerson_shouldSoftDeleteAndKeepRow_whenRejected`: candidate → `{"decision":"reject"}` → 200; utána `GET /api/people` bootstrapban a személy NEM szerepel; és a sor fizikailag megvan: `personRepository.findById(id)` üres (SQLRestriction), de natív count (`JdbcTemplate` vagy a Task 3-ban készülő natív név-lekérdezés helyett itt elég: a bootstrap-hiány + egy második `POST` 404-e) — a 404 bizonyítja a soft-delete-et (a `findByIdAndCreatedByAndDeletedFalse` már nem látja).
  - `testDecidePerson_shouldReturn400_whenPersonIsNotCandidate`: sima aktív person (meglévő `createPerson`) → decision accept → 400, hibakód `PEOPLE_CANDIDATE_ALREADY_DECIDED`.
  - `testDecidePerson_shouldReturn404_whenPersonIsForeignOrMissing`: random UUID → 404.
- [ ] **Step 3: Futtasd, bukjanak.** `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=PeopleContractIT`. Elvárt: az új tesztek FAIL (a végpont 501/405), a régiek zöldek.
- [ ] **Step 4: Implementáció.** `PeopleService`-be (a `deleteMention` után), a `LifeEventCandidateService.decide` mintájára:

```java
    /** S4 jelölt-döntés: accept aktivál, reject soft-delete-tel elvet — a soft-deleted candidate
     *  sor az extraktor reject-listája (a nevet nem javasolja újra). Egy döntés per jelölt. */
    @Transactional
    public PersonResponse decidePerson(UUID userId, UUID personId, PersonDecisionRequest req) {
        PersonEntity p = requireOwnedPerson(userId, personId);
        if (!"candidate".equals(p.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PEOPLE_CANDIDATE_ALREADY_DECIDED").build());
        }
        if ("reject".equals(req.getDecision())) {
            PersonResponse snapshot = mapper.toPersonResponse(p, 0, 0, null);
            personRepository.delete(p);   // @SQLDelete → soft; a sor marad reject-listának
            return snapshot;
        }
        p.setStatus("active");
        return mapper.toPersonResponse(personRepository.save(p), 0, 0, null);
    }
```

  (A stat-mezők 0/null-lal mennek: friss jelöltnek nincs mentionje; a FE úgyis invalidál és a bootstrapból olvas. Import: `io.mrkuhne.mezo.api.dto.PersonDecisionRequest`.)

  `PeopleController`-be a generált interfész-metódus delegálása a fájl meglévő idiómájával (nézd meg, hogyan oldja fel a principálból a userId-t a többi metódus):

```java
    @Override
    public PersonResponse decidePerson(UUID personId, PersonDecisionRequest personDecisionRequest) {
        return peopleService.decidePerson(currentUserId(), personId, personDecisionRequest);
    }
```

  (A pontos szignatúra/annotációk a generált `PeopleApi`-ból jönnek — másold a szomszéd metódusok formáját; ha a controller más néven éri el a user-t, azt kövesd.)
- [ ] **Step 5: Zöldre.** `./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=PeopleContractIT` — mind zöld.
- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/people backend/src/test/java
git commit -m "feat(people): jelölt-decision végpont — accept aktivál, reject soft-delete (mezo-06o0.3)"
```

---

### Task 3: BE — `PersonExtractionService` + FakeCompanionLlm ág + GraphMaintenanceJob lánc + IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PersonExtractionService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PersonExtractionResult.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/repository/PersonRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PersonExtractionServiceIT.java`

**Interfaces:**
- Consumes: `CompanionLlm.complete(system,user)`; `TextFold.fold(String)` (`io.mrkuhne.mezo.techcore.text.TextFold`); `MentionRepository.findByCreatedByAndTsGreaterThanEqualAndTsLessThanAndDeletedFalse`; `JournalEntryRepository`/`RitualDayRepository`/`DailySummaryRepository` napi finderei (másold a `LifeEventExtractionService.gatherNarrative` hívásait szó szerint); `LlmCallContextHolder.runWith`; `PersonPopulator.createCandidate` (Task 2), `MentionPopulator.createMention(owner, personId, ts, tone)` — tone-nélküli mentionhez nézd meg a populátort, és ha a `tone` paraméter `null`-t nem visel el, sette-ld null-ra mentés előtt vagy adj hozzá overloadot.
- Produces: `PersonExtractionResult extractFor(UUID userId, LocalDate day)` (`record PersonExtractionResult(int enriched, int candidates)`); `PersonExtractionService.EXTRACTOR_MARKER = "[person-extractor]"`; FakeCompanionLlm `PEOPLE_SENTINEL` / `PEOPLE_BROKEN`.

- [ ] **Step 1: PersonRepository natív név-lekérdezés** (reject-lista + dedup — a soft-deleted candidate sorokat IS látja, ez a lényege):

```java
    /** S4 extractor dedup + reject-lista: MINDEN név és alias, a soft-deleted (elvetett jelölt)
     *  sorokét is beleértve — natív, mert a @SQLRestriction a JPQL-utakat szűri. Az elvetett név
     *  így sosem kerül újra javaslatba. */
    @Query(value = "select name from person where created_by = :userId"
            + " union all select unnest(aliases) from person where created_by = :userId",
        nativeQuery = true)
    List<String> findAllNamesAndAliasesIncludingDeleted(@Param("userId") UUID userId);
```

- [ ] **Step 2: `PersonExtractionResult` record** (`feature/companion/service`):

```java
package io.mrkuhne.mezo.feature.companion.service;

/** Az éjszakai people-kör egy user/nap kimenete (GraphMaintenanceJob logsora). */
public record PersonExtractionResult(int enriched, int candidates) {
    public static final PersonExtractionResult ZERO = new PersonExtractionResult(0, 0);
}
```

- [ ] **Step 3: `PersonExtractionService`.** A teljes osztály (a javadoc-sűrűség a LifeEvent-mintát követi; minden metódus itt van, ne találj ki mást):

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Emberek S4 (bd mezo-06o0.3, spec §3 harmadik írási út): az éjszakai people-kör — a
 * {@code LifeEventExtractionService} ikertestvére. Egy olcsó-LLM hívás a nap narratív szövegeire
 * és tone-nélküli mention-jeire, két feladattal: (1) a nap tone-nélküli mention-jeinek gazdagítása
 * (tónus + intenzitás + kontextus-címke); (2) ismeretlen, VISSZATÉRŐ nevekre
 * {@code person(status='candidate', source_kind='extractor')} javaslat, evidencia-idézetekkel a
 * {@code notes}-ban. Az esemény-él javaslat (PERSON↔LIFE_EVENT) S5 után élesedik — ez a kör
 * szándékosan nem ír gráfot.
 *
 * <p><b>Bizonytalan utalás SOHA nem ír.</b> A modell javaslata csak jelölt: a szerviz maga
 * validál — a név foldja nem eshet egybe egyetlen ismert névvel/aliasszal sem (a soft-deleted,
 * azaz elvetett jelölt sorokat IS beleértve — reject-lista), és a névnek ténylegesen vissza kell
 * térnie a saját szövegekben: a nap narratívájában legalább {@value #DAY_MIN_OCCURRENCES}, vagy a
 * záró 7 nap narratívájában legalább {@value #WEEK_MIN_OCCURRENCES} szó-eleji előfordulás.
 *
 * <p><b>Pre-spend kapu:</b> ha a napnak se tone-nélküli mentionje, se narratívája — nincs hívás.
 * Nap-kapu nem kell a LifeEvent-féle {@code countExtractorNodesOnDay} formában: az újrafutás
 * önmagában idempotens (a gazdagított mention már nem tone-nélküli; a javasolt/elvetett név a
 * dedup-listán van).
 *
 * <p>IDENT-3: minden hibaág (modell, parse, persist) warn + {@link PersonExtractionResult#ZERO},
 * kivétel sosem szökik ki. A persist a LifeEvent-minta szerint EGY tranzakció a self-proxyn át
 * ({@link #persistNight}) — fél éjszaka sosem íródik.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PEOPLE_SWITCH},
    havingValue = "true")
public class PersonExtractionService {

    /** Dispatch key for FakeCompanionLlm (a GraphEdgeStructurer.STRUCTURER_MARKER idióma). */
    public static final String EXTRACTOR_MARKER = "[person-extractor]";

    /** person.source_kind for extractor-born candidates. */
    public static final String SOURCE_EXTRACTOR = "extractor";

    static final int DAY_MIN_OCCURRENCES = 2;
    static final int WEEK_MIN_OCCURRENCES = 3;
    private static final int MAX_CANDIDATES = 3;
    private static final int MAX_QUOTES = 3;
    private static final int QUOTE_MAX_CHARS = 200;
    private static final int MIN_NAME_FOLD_LENGTH = 3;

    private static final Set<String> TONES = Set.of("positive", "neutral", "mixed", "negative");
    private static final Set<String> CONTEXTS = Set.of("munka", "csalad", "baratok", "edzes",
        "konfliktus", "kozos_program", "segitseg", "egyeb");

    private static final String SYSTEM_PROMPT = EXTRACTOR_MARKER + """

        Te egy kapcsolat-figyelő vagy. Bemenet: Daniel egy napjának saját szövegei, a nap
        tónus nélküli említéseinek számozott listája, és az ismert személynevek listája.
        Két feladatod van:

        1. GAZDAGÍTÁS: minden számozott említéshez döntsd el a szöveg alapján a tónust,
           az intenzitást és a kontextust.
        2. ÚJ ARCOK: ha a nap szövegeiben VISSZATÉRŐ, az ismert listán NEM szereplő
           személynév bukkan fel, javasold jelöltnek, szó szerinti idézetekkel.

        Válasz KIZÁRÓLAG JSON objektum, magyarázat nélkül:
        {"mentions": [{"index": 0, "tone": "positive", "intensity": 2, "context": "munka"}],
         "candidates": [{"name": "Név", "quotes": ["szó szerinti mondat a szövegből"]}]}

        - tone ∈ positive | neutral | mixed | negative; intensity ∈ 1 | 2 | 3
        - context ∈ munka | csalad | baratok | edzes | konfliktus | kozos_program | segitseg | egyeb
        - Bizonytalan utalást ("a főnököm", vezetéknév nélkül több emberre illő név) HAGYJ KI
          mindkét listából. Ha nincs mit írni, a mező üres tömb.
        - Jelöltet csak ténylegesen visszatérő névre javasolj, legfeljebb 3-at.
        """;

    private final CompanionLlm companionLlm;
    private final PersonRepository personRepository;
    private final MentionRepository mentionRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final RitualDayRepository ritualDayRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    // Self-injected proxy — lásd LifeEventExtractionService: a persistNight csak a proxyn át kap
    // tranzakciós advice-t.
    private final ObjectProvider<PersonExtractionService> self;

    public PersonExtractionResult extractFor(UUID userId, LocalDate day) {
        Instant from = day.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<MentionEntity> toneless = mentionRepository
            .findByCreatedByAndTsGreaterThanEqualAndTsLessThanAndDeletedFalse(userId, from, to)
            .stream().filter(m -> m.getTone() == null).toList();
        String narrative = gatherNarrative(userId, day);
        if (toneless.isEmpty() && narrative.isBlank()) {
            return PersonExtractionResult.ZERO;   // pre-spend kapu — üres éjszaka = nincs hívás
        }
        List<PersonEntity> persons = personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId);
        NightAnswer answer;
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("people_extraction", "enrich_and_candidates", "day", null),
                () -> companionLlm.complete(SYSTEM_PROMPT, buildUserMessage(narrative, toneless, persons)));
            answer = parse(raw);
        } catch (Exception e) {
            log.warn("Person extraction failed for {} on {}", userId, day, e);
            return PersonExtractionResult.ZERO;
        }
        List<Enrichment> enrichments = validEnrichments(answer, toneless);
        List<CandidateProposal> candidates = validCandidates(answer, userId, day, narrative);
        if (enrichments.isEmpty() && candidates.isEmpty()) {
            return PersonExtractionResult.ZERO;
        }
        try {
            return self.getObject().persistNight(userId, toneless, enrichments, candidates);
        } catch (Exception e) {
            log.warn("Person-extraction persistence failed for {} on {} — degrading to zero so the"
                + " night stays reprocessable", userId, day, e);
            return PersonExtractionResult.ZERO;
        }
    }

    /** Az éjszaka minden írása EGY tranzakcióban (LifeEvent-minta, self-proxyn át hívva). */
    @Transactional
    public PersonExtractionResult persistNight(UUID userId, List<MentionEntity> toneless,
            List<Enrichment> enrichments, List<CandidateProposal> candidates) {
        int enriched = 0;
        for (Enrichment e : enrichments) {
            MentionEntity m = toneless.get(e.index());
            m.setTone(e.tone());
            m.setIntensity(e.intensity());
            if (m.getContextLabel() == null) {
                m.setContextLabel(e.context());
            }
            mentionRepository.save(m);
            enriched++;
        }
        int created = 0;
        for (CandidateProposal c : candidates) {
            PersonEntity p = new PersonEntity();
            p.setCreatedBy(userId);
            p.setName(c.name());
            p.setInitial(c.name().substring(0, 1).toUpperCase());
            p.setRelationship("friend");
            p.setRelationshipHu("Ismerős");
            p.setAffectBaseline("neutral");
            p.setStatus("candidate");
            p.setSourceKind(SOURCE_EXTRACTOR);
            p.setNotes(String.join("\n", c.quotes()));
            personRepository.save(p);
            created++;
        }
        return new PersonExtractionResult(enriched, created);
    }

    /** Ugyanaz a nap-narratíva, mint a LifeEvent-extraktoré: napló + esti reflexió + napi összefoglaló. */
    private String gatherNarrative(UUID userId, LocalDate day) {
        StringBuilder sb = new StringBuilder();
        for (JournalEntryEntity entry : journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(userId, day, day)) {
            append(sb, "NAPLÓ", entry.getText());
        }
        ritualDayRepository.findByCreatedByAndRitualDate(userId, day)
            .ifPresent(r -> append(sb, "ESTI REFLEXIÓ", r.getReflectionText()));
        dailySummaryRepository.findByCreatedByAndSummaryDate(userId, day)
            .ifPresent(s -> append(sb, "NAPI ÖSSZEFOGLALÓ", s.getNarrative()));
        return sb.toString().trim();
    }

    private static void append(StringBuilder sb, String label, String text) {
        if (text != null && !text.isBlank()) {
            sb.append(label).append(": ").append(text.trim()).append('\n');
        }
    }

    private String buildUserMessage(String narrative, List<MentionEntity> toneless,
            List<PersonEntity> persons) {
        StringBuilder sb = new StringBuilder("A NAP SZÖVEGEI:\n").append(narrative).append('\n');
        sb.append("\nTÓNUS NÉLKÜLI EMLÍTÉSEK:\n");
        for (int i = 0; i < toneless.size(); i++) {
            sb.append(i).append(". ").append(nameOf(persons, toneless.get(i).getPersonId()))
                .append(": ").append(toneless.get(i).getExcerpt()).append('\n');
        }
        sb.append("\nISMERT SZEMÉLYEK:\n");
        for (PersonEntity p : persons) {
            sb.append("- ").append(p.getName());
            if (!p.getAliases().isEmpty()) {
                sb.append(" (").append(String.join(", ", p.getAliases())).append(')');
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    private static String nameOf(List<PersonEntity> persons, UUID personId) {
        return persons.stream().filter(p -> p.getId().equals(personId))
            .map(PersonEntity::getName).findFirst().orElse("?");
    }

    /** Index-en kívüli, ismeretlen tónusú/kontextusú vagy sávon kívüli intenzitású gazdagítás
     *  DOBVA, sosem csonkolva (a LifeEvent drop-never-clamp szabálya); egy indexre az első nyer. */
    private List<Enrichment> validEnrichments(NightAnswer answer, List<MentionEntity> toneless) {
        List<Enrichment> valid = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        for (Enrichment e : answer.mentions() == null ? List.<Enrichment>of() : answer.mentions()) {
            if (e == null || e.index() == null || e.index() < 0 || e.index() >= toneless.size()
                || !seen.add(e.index())
                || e.tone() == null || !TONES.contains(e.tone())
                || e.intensity() == null || e.intensity() < 1 || e.intensity() > 3
                || e.context() == null || !CONTEXTS.contains(e.context())) {
                continue;
            }
            valid.add(e);
        }
        return valid;
    }

    /** A jelölt-kapu: ismert/elvetett név ki (fold-egyenlőség a nevek+aliasok ellen, soft-deleted
     *  sorokkal együtt), és csak ténylegesen visszatérő név marad (nap ≥2 vagy 7 nap ≥3 szó-eleji
     *  előfordulás a narratívában). */
    private List<CandidateProposal> validCandidates(NightAnswer answer, UUID userId, LocalDate day,
            String dayNarrative) {
        List<CandidateProposal> raw = answer.candidates() == null ? List.of() : answer.candidates();
        if (raw.isEmpty()) {
            return List.of();
        }
        Set<String> knownFolds = new HashSet<>();
        for (String known : personRepository.findAllNamesAndAliasesIncludingDeleted(userId)) {
            knownFolds.add(TextFold.fold(known));
        }
        String dayFold = TextFold.fold(dayNarrative);
        String weekFold = null;   // lustán: csak ha a nap-küszöb nem elég
        List<CandidateProposal> valid = new ArrayList<>();
        Set<String> proposedFolds = new HashSet<>();
        for (CandidateProposal c : raw) {
            if (valid.size() >= MAX_CANDIDATES || c == null || c.name() == null) {
                continue;
            }
            String name = c.name().strip();
            String fold = TextFold.fold(name);
            if (name.isEmpty() || name.length() > 120 || fold.length() < MIN_NAME_FOLD_LENGTH
                || knownFolds.contains(fold) || !proposedFolds.add(fold)) {
                continue;
            }
            boolean recurring = countAtWordStart(dayFold, fold) >= DAY_MIN_OCCURRENCES;
            if (!recurring) {
                if (weekFold == null) {
                    StringBuilder week = new StringBuilder();
                    for (int i = 6; i >= 0; i--) {
                        week.append(gatherNarrative(userId, day.minusDays(i))).append('\n');
                    }
                    weekFold = TextFold.fold(week.toString());
                }
                recurring = countAtWordStart(weekFold, fold) >= WEEK_MIN_OCCURRENCES;
            }
            if (!recurring) {
                continue;
            }
            valid.add(new CandidateProposal(name, cleanQuotes(c.quotes())));
        }
        return valid;
    }

    /** Szó-ELEJI előfordulások száma szabad szóvéggel (a magyar ragok miatt) — a
     *  MentionDetectionService.containsAtWordStart számláló párja. */
    static int countAtWordStart(String foldedHaystack, String foldedNeedle) {
        int count = 0;
        int idx = foldedHaystack.indexOf(foldedNeedle);
        while (idx >= 0) {
            if (idx == 0 || !Character.isLetterOrDigit(foldedHaystack.charAt(idx - 1))) {
                count++;
            }
            idx = foldedHaystack.indexOf(foldedNeedle, idx + 1);
        }
        return count;
    }

    private static List<String> cleanQuotes(List<String> quotes) {
        List<String> clean = new ArrayList<>();
        for (String q : quotes == null ? List.<String>of() : quotes) {
            if (q == null || q.isBlank() || clean.size() >= MAX_QUOTES) {
                continue;
            }
            String s = q.strip();
            clean.add(s.length() <= QUOTE_MAX_CHARS ? s : s.substring(0, QUOTE_MAX_CHARS - 1) + "…");
        }
        return clean;
    }

    private NightAnswer parse(String raw) throws Exception {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return new NightAnswer(List.of(), List.of());
        }
        return objectMapper.readValue(raw.substring(start, end + 1), NightAnswer.class);
    }

    /** A modellválasz alakja — ismeretlen mezőkre toleráns rekordok. */
    public record NightAnswer(List<Enrichment> mentions, List<CandidateProposal> candidates) { }

    public record Enrichment(Integer index, String tone, Integer intensity, String context) { }

    public record CandidateProposal(String name, List<String> quotes) { }
}
```

  Megjegyzés az implementernek: ha a Jackson 3 `ObjectMapper` az ismeretlen JSON-mezőkön elhasal, a `parse` catch-e (a hívóban) úgyis ZERO-ra degradál — de nézd meg, hogyan olvas a `LifeEventExtractionService.parse` (`LifeEventSuggestion` rekord), és kövesd ugyanazt a konfigurációt. Ha a rekordokra `@JsonIgnoreProperties`-szerű tolerancia kell, azt a LifeEventSuggestion mintájából vedd át.

- [ ] **Step 4: FakeCompanionLlm ág.** A konstansok közé (a `LIFE_EVENTS_SENTINEL` mellé):

```java
    /** Scripted people-extraction (S4, mezo-06o0.3): a [fake-people:{json}] planted in the
     *  narrative is returned verbatim; no sentinel → "{}" (üres éjszaka). */
    public static final Pattern PEOPLE_SENTINEL =
            Pattern.compile("\\[fake-people:(\\{.*})]", Pattern.DOTALL);
    public static final String PEOPLE_BROKEN = "[fake-people-broken]";
```

  A `complete` dispatch-lánc LifeEvent-ága UTÁN (import: `io.mrkuhne.mezo.feature.companion.service.PersonExtractionService`):

```java
        if (systemPrompt.startsWith(PersonExtractionService.EXTRACTOR_MARKER)) {
            if (userMessage.contains(PEOPLE_BROKEN)) {
                // matching braces, invalid JSON inside — a catch-and-log ág, nem az üres-válasz ág
                return "{\"mentions\":[{\"index\":0,\"tone\":}],\"candidates\":[]}";
            }
            Matcher m = PEOPLE_SENTINEL.matcher(userMessage);
            // default = üres éjszaka: script nélkül se gazdagítás, se jelölt
            return m.find() ? m.group(1) : "{}";
        }
```

- [ ] **Step 5: GraphMaintenanceJob 4. fázis.** Új mező (`ObjectProvider`, mert a people-kör kapcsolói mások, mint a jobéi — PEOPLE off mellett a bean nem létezik):

```java
    private final ObjectProvider<PersonExtractionService> personExtractionService;
```

  (import: `io.mrkuhne.mezo.feature.companion.service.PersonExtractionService`, `io.mrkuhne.mezo.feature.companion.service.PersonExtractionResult`, `org.springframework.beans.factory.ObjectProvider`). A user-cikluson belül, a LifeEvent-fázis UTÁN:

```java
            PersonExtractionService peopleExtractor = personExtractionService.getIfAvailable();
            if (peopleExtractor != null) {
                try {
                    PersonExtractionResult r = peopleExtractor.extractFor(user.getId(), yesterday);
                    log.info("Person extraction for user {} on {}: {} mention(s) enriched, "
                        + "{} candidate(s)", user.getId(), yesterday, r.enriched(), r.candidates());
                } catch (Exception e) {
                    log.warn("Person extraction failed for user {} on {}", user.getId(), yesterday, e);
                }
            }
```

  A class-javadocba egy mondat: a negyedik fázis a people-kör, `ObjectProvider`-rel, mert kapcsolói (COMPANION ∧ PEOPLE) eltérnek a job hármasától.

- [ ] **Step 6: `PersonExtractionServiceIT`** (`backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/`, `@ActiveProfiles("companion-fake")`, `extends AbstractIntegrationTest` — a LifeEventExtractionServiceIT szerkezete). Populátorok: `DatabasePopulator`+`OwnerProperties` (ownerId), `JournalPopulator`, `PersonPopulator`, `MentionPopulator`, `FakeCompanionLlm`, repók. Fix nap: `LocalDate.of(2026, 8, 21)`. A szentinelt a napló-szövegbe ültesd (a scripted idióma). Tesztek:
  - `testExtractFor_shouldMakeNoLlmCall_whenTheDayIsEmpty`: se mention, se narratíva → ZERO és `fakeCompanionLlm.completeCallCount()` változatlan.
  - `testExtractFor_shouldEnrichTonelessMention_whenScripted`: person + tone-nélküli mention a napon (ts = `DAY.atStartOfDay(ZoneOffset.UTC).toInstant()`; ha a MentionPopulator nem tud null tónust, sette-ld és mentsd újra a repóval) + napló a szentinellel: `[fake-people:{"mentions":[{"index":0,"tone":"positive","intensity":2,"context":"munka"}],"candidates":[]}]` → `enriched()==1`, a mention frissül (tone=positive, intensity=2, contextLabel=munka).
  - `testExtractFor_shouldDropInvalidEnrichment_neverClamp`: scripted tone="lelkes" (ismeretlen) és egy másik index=7 (sávon kívül) → ZERO, a mention érintetlen (tone marad null).
  - `testExtractFor_shouldCreateCandidate_whenUnknownNameRecursInTheDay`: napló-szöveg, amelyben a "Marci" név kétszer szerepel + szentinel `{"mentions":[],"candidates":[{"name":"Marci","quotes":["délben futottam Marcival a gáton"]}]}` → `candidates()==1`; a person-sor: status=candidate, sourceKind=extractor, relationship=friend, relationshipHu=Ismerős, notes tartalmazza az idézetet. (A repók @SQLRestriction-nel élnek — a candidate NEM deleted, a `findAllByCreatedByAndDeletedFalseOrderByNameAsc` látja.)
  - `testExtractFor_shouldDropCandidate_whenTheNameDoesNotRecur`: a név csak egyszer szerepel a napban (és a héten sincs több) → ZERO, nincs új person-sor.
  - `testExtractFor_shouldNotReproposeKnownAliasOrRejectedName`: (a) létező aktív person aliasszal "Marcika" → jelölt "Marcika" (kétszer a szövegben) NEM jön létre; (b) `personPopulator.createCandidate(owner, "Dóri", "…")` majd `personRepository.delete(...)` (soft — ez az elvetett jelölt) → jelölt "Dóri" (kétszer a szövegben) NEM jön létre újra.
  - `testExtractFor_shouldCountWeekWindow_whenDayIsBelowThreshold`: a "Berci" név a napon 1×, de az előző napokon még 2× (JournalPopulator, day.minusDays(1..2)) → hét ≥3 → jelölt létrejön.
  - `testExtractFor_shouldDegradeToZero_whenTheAnswerIsBroken`: napló `[fake-people-broken]` markerrel (+ elég narratíva) → ZERO, semmi nem íródik.
  - `testExtractorMarker_shouldStayInSyncWithTheFakeDispatch`: `assertThat(PersonExtractionService.EXTRACTOR_MARKER).isEqualTo("[person-extractor]")` (a rename-drift őrszem, a LifeEvent IT mintája).
- [ ] **Step 7: Futtasd bukóra, implementálj, zöldre.** TDD-sorrend: előbb az IT-váz (Step 6) a Step 3 implementáció ELŐTT is mehet — de a fordíthatóság miatt praktikusan: Step 1–5 megírása után futtasd: `./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=PersonExtractionServiceIT`. Minden zöld. Utána a szomszédság: `./mvnw test -Dmezo.test.use-testcontainers=true -Dtest='io.mrkuhne.mezo.feature.people.*IT'` és `-Dtest=GraphMaintenanceJobSwitchOffIT,GraphMaintenanceServiceIT,LifeEventExtractionServiceIT`.
- [ ] **Step 8: ArchUnit.** `./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=ArchitectureTest` — a companion→people él nem új (S2 óta él), zöldnek kell lennie. Ha a freeze-store ürül/változik indokolatlanul: `git checkout -- backend/src/test/resources/archunit-store/` és futtasd újra tisztán.
- [ ] **Step 9: Commit.**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(companion): PersonExtractionService — éjszakai gazdagítás + jelölt-javaslat a GraphMaintenanceJob láncában (mezo-06o0.3)"
```

---

### Task 4: FE — decision API + `usePeople` jelölt-ág + mock seed + MSW + hook-tesztek

**Files:**
- Modify: `frontend/src/data/me/peopleApi.ts`
- Modify: `frontend/src/data/me/peopleHooks.ts`
- Modify: `frontend/src/data/me/people.ts` (mock seed)
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/me/peopleHooks.test.tsx`

**Interfaces:**
- Consumes: Task 1 `PersonDecisionRequest` a generált `api.gen.ts`-ből.
- Produces: `peopleApi.decidePerson(personId: string, decision: 'accept' | 'reject')`; `usePeople()` visszatérése BŐVÜL: `candidates: PersonEntry[]` (status==='candidate') és `decidePerson(personId: string, decision: 'accept' | 'reject')`; a meglévő `people` mostantól CSAK a nem-jelölt sorok (a hub/kör/heti oldalak így automatikusan tiszták maradnak). Task 5 ezekre épül.

- [ ] **Step 1: Bukó hook-tesztek.** A `peopleHooks.test.tsx` meglévő idiómájával (mindkét mód fut a dual-mode gate alatt; a mock-ági asserthez `isMockMode()`-ra figyelj, ahogy a fájl teszi):
  - `usePeople splits candidates from the circle`: mock módban a seed jelöltje a `candidates`-ben van és NINCS a `people`-ben; a `people` hossza = aktív seedek száma (5).
  - `decidePerson accept activates the candidate (mock)`: `decidePerson(id,'accept')` után a személy a `people`-ben van `status:'active'`-val és eltűnt a `candidates`-ből.
  - `decidePerson reject removes the candidate (mock)`: reject után sem `people`-ben, sem `candidates`-ben.
  - real mód: MSW-vel `decidePerson` POST-ol a `/api/people/:personId/decision`-re és invalidál (a meglévő real-módú mutáció-teszt mintája — ha a fájl a POST-hívás tényét asserteli spy-jal/msw-request-loggal, kövesd azt).
- [ ] **Step 2: Futtasd bukóra:** `cd frontend && VITE_USE_MOCK=true pnpm test -- src/data/me/peopleHooks.test.tsx` (FAIL: nincs candidates/decidePerson).
- [ ] **Step 3: `peopleApi.decidePerson`:**

```ts
export type PersonDecisionRequest = components['schemas']['PersonDecisionRequest']
```

  és a `peopleApi` objektumba:

```ts
  decidePerson: (personId: string, decision: 'accept' | 'reject') =>
    apiFetch<PersonResponse>(`${PEOPLE}/${personId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision } satisfies PersonDecisionRequest),
    }),
```

- [ ] **Step 4: mock seed jelölt.** A `people.ts` seed-tömbjébe (a végére) egy jelölt a prototípus CANDS[0]-jából:

```ts
  {
    id: 'pp-marci',
    name: 'Marci',
    initial: 'M',
    relationship: 'friend',
    relationshipHu: 'Ismerős',
    aliases: [],
    status: 'candidate',
    sourceKind: 'extractor',
    affect_baseline: 'neutral',
    mentionCount: 0,
    mentionsThisWeek: 0,
    last_mentioned_at: '',
    lastMentionLabel: 'Még nincs említés',
    contactCadenceLabel: '',
    notes: '„…délben futottam Marcival a gáton, jó volt kimozdulni…"',
    affectTrend: [],
    knownFacts: [],
    ties: [],
  },
```

  (A mezőnevek a `PersonEntry` típust követik — nézd meg a fájl meglévő elemeit és igazodj hozzájuk mező-sorrendben is.)
- [ ] **Step 5: `usePeople` bővítés.** A visszatérés előtt:

```ts
  const decideM = useMutation({
    mutationFn: async (input: { personId: string; decision: 'accept' | 'reject' }) => {
      if (mock) { mockDecidePerson(qc, input.personId, input.decision); return }
      await peopleApi.decidePerson(input.personId, input.decision)
    },
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
  })
```

  a return-ben:

```ts
  return {
    people: data.people.filter(p => p.status !== 'candidate'),
    candidates: data.people.filter(p => p.status === 'candidate'),
    mentions: data.mentions,
    ...
    decidePerson: (personId: string, decision: 'accept' | 'reject') =>
      decideM.mutate({ personId, decision }),
```

  és a fájl aljára a mock-mutátor (a többi mock* minta mellé):

```ts
function mockDecidePerson(qc: QueryClient, personId: string, decision: 'accept' | 'reject') {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    if (decision === 'reject') {
      return { ...base, people: base.people.filter(p => p.id !== personId) }
    }
    return { ...base, people: base.people.map(p => p.id === personId ? { ...p, status: 'active' } : p) }
  })
}
```

  A hook fejléc-kommentjét egészítsd ki egy mondattal (S4: candidates ág + decidePerson).
- [ ] **Step 6: MSW handler.** A people-blokk végére:

```ts
  http.post(`${API_BASE}/api/people/:personId/decision`, async ({ params, request }) => {
    const body = await request.json() as { decision: string }
    return HttpResponse.json({
      id: params.personId, name: 'Marci', initial: 'M', relationship: 'friend',
      relationshipHu: 'Ismerős', aliases: [], status: body.decision === 'accept' ? 'active' : 'candidate',
      sourceKind: 'extractor', affectBaseline: 'neutral', knownFacts: [], ties: [], affectTrend: [],
      mentionCount: 0, mentionsThisWeek: 0,
    })
  }),
```

  (Igazodj a fájl meglévő people-handler stílusához — pl. ahogy a `POST /api/people` építi a választ.)
- [ ] **Step 7: Zöldre mindkét módban:** `VITE_USE_MOCK=false pnpm test -- src/data/me/peopleHooks.test.tsx && VITE_USE_MOCK=true pnpm test -- src/data/me/peopleHooks.test.tsx`.
- [ ] **Step 8: Gyors regressziós kör** — az S3 oldalak a szűkített `people`-t kapják: `VITE_USE_MOCK=true pnpm test -- src/features/me` (zöld; ha egy S3 teszt a seed-hosszra épült és elesik, a teszt elvárását igazítsd az aktív-only számhoz, és jelezd a reportban).
- [ ] **Step 9: Commit.**

```bash
git add frontend/src
git commit -m "feat(fe): people decision API + jelölt-ág a usePeople-ben, mock seed jelölttel (mezo-06o0.3)"
```

---

### Task 5: FE — jelölt-inbox kártyák + hub-badge (prototípus ×1,18)

**Files:**
- Modify: `frontend/src/features/me/pages/PeopleJeloltekPage.tsx`
- Modify: `frontend/src/features/me/pages/PeoplePage.tsx` (Jelöltek csempe)
- Modify: `frontend/src/styles/prototype.css` (`.ppl-candt` család + `.ppl-hub-badge`)
- Test: `frontend/src/features/me/pages/PeopleJeloltekPage.test.tsx` (ha nem létezik, hozd létre a testvér-oldalak teszt-mintájára — VITE_USE_MOCK stub kötelező, lásd a testvéreket), `frontend/src/features/me/pages/PeoplePage.test.tsx` bővítés

**Interfaces:**
- Consumes: `usePeople().candidates`, `.decidePerson` (Task 4); `.ppl-figy` meglévő chip-osztály; `ClayIcon`, `MozaikPage/PageHead/PageHero/PageBody`, `EntranceGroup`.
- Produces: kész jelölt-inbox UI; hub-csempe badge + élő tile-line.

- [ ] **Step 1: CSS.** A `prototype.css` ppl-szekciójába (az `.ppl-empty`/`.ppl-foot` mellé). A prototípus px-értékei ×1,18-cal (forrás: `docs/design_2.0/prototypes/emberek.html` 107–127. és 249–256. sor):

```css
/* S4 jelölt-kártya (prototípus .candt, ×1.18) */
.ppl-candt {
  border-radius: 21px; padding: 13px 14px; margin-bottom: 12px;
  background: linear-gradient(150deg, #FDF0DA, #FFFCF5);
  border: 1px solid #C9962E;
  box-shadow: 0 19px 35px -17px rgba(201, 150, 46, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.75);
  animation: ppl-candpulse 3s ease-in-out 1.2s infinite;
  text-align: left;
}
@keyframes ppl-candpulse {
  0%, 100% { box-shadow: 0 19px 35px -17px rgba(201, 150, 46, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.75); }
  50% { box-shadow: 0 19px 35px -12px rgba(201, 150, 46, 0.75), 0 0 0 5px rgba(201, 150, 46, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.75); }
}
.ppl-candt-head { display: flex; align-items: center; gap: 7px; }
.ppl-candt-head b { font-size: 13px; }
.ppl-candt-q { font-family: "Fraunces", Georgia, serif; font-style: italic; font-size: 11.2px; font-weight: 300; color: #6E6257; margin-top: 6px; line-height: 1.5; }
.ppl-candt-ev { font-size: 8.9px; color: #A8801F; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
.ppl-candbtns { display: flex; gap: 7px; margin-top: 11px; }
.ppl-cta-gold {
  background: linear-gradient(135deg, #E5C46B, #C9962E); color: #fff;
  border-radius: 999px; padding: 7px 17px; font-size: 11.8px; font-weight: 600; flex: none;
  box-shadow: 0 9px 19px -7px rgba(201, 150, 46, 0.55); border: none; font-family: inherit; cursor: pointer;
}
.ppl-ghost { background: rgba(43, 33, 24, 0.06); color: #6E6257; border: none; font-family: inherit; border-radius: 999px; padding: 7px 14px; font-size: 11.8px; font-weight: 600; flex: none; cursor: pointer; }
/* S4 hub-badge (prototípus .badge, ×1.18) */
.ppl-hub-badge {
  position: absolute; top: -6px; right: -11px; min-width: 20px; height: 20px;
  border-radius: 999px; background: linear-gradient(135deg, #E5C46B, #C9962E);
  color: #fff; font-size: 11.2px; font-weight: 700;
  display: grid; place-items: center; padding: 0 5px;
  box-shadow: 0 4px 9px -2px rgba(201, 150, 46, 0.7);
  animation: ppl-badgepulse 2.8s ease-in-out 1.2s infinite;
}
```

  A `@keyframes ppl-badgepulse`-t a prototípus 256. sora környéki `badgepulse` definícióból vedd át változatlan időzítéssel (nézd meg és másold; ha csak box-shadow/transform pulzus, ×1,18 nem kell rá). Prefers-reduced-motion: a fájl meglévő `.ppl-figy { animation: none; }` blokkjába vedd fel a `.ppl-candt` és `.ppl-hub-badge` animáció-tiltását is. Ha bármelyik szín-literál már létezik `--ppl-*` tokenként, használd a tokent; ÚJ tokent csak akkor vezess be, ha mindkét `:root`-ba felveszed (mozaikCssTokens guard). A `.ppl-hub-badge` pozicionálásához az anchor: a Jelöltek csempe `.ppl-hub-spot`-ján belül egy `position: relative` wrapper (`.ppl-hub-anchor { position: relative; display: inline-flex; }`) — vedd fel ezt is a CSS-be.

- [ ] **Step 2: Bukó komponens-tesztek.**
  - `PeopleJeloltekPage.test.tsx`: (a) seed-jelölttel a kártya renderel: „Új arc · Marci", JELÖLT chip, idézet a notes-ból, „Felveszem" és „Nem ő az / nem kell" gombok, foot-szöveg „Jelöltet csak visszatérő, ismeretlen név kap. Az elvetett nevet nem javasolja újra."; (b) „Felveszem" után a kártya eltűnik és az üres állapot jelenik meg („Nincs több jelölt — az éjszakai kör hajnalban néz újra."); (c) „Nem ő az / nem kell" után ugyanígy; (d) hero big = jelöltszám. Router: `createMemoryRouter(routes, { initialEntries: ['/me/people/jeloltek'] })` a valós routes-szal.
  - `PeoplePage.test.tsx` bővítés: jelölt mellett a Jelöltek csempén badge „1" és tile-line „Marci · visszatérő név"; (mock-cache manipulációval vagy a decidePerson útján) jelölt nélkül nincs badge és a sor „nincs új arc — az éjszakai kör figyel".
- [ ] **Step 3: Futtasd bukóra** (`VITE_USE_MOCK=true pnpm test -- src/features/me/pages/PeopleJeloltekPage.test.tsx src/features/me/pages/PeoplePage.test.tsx`).
- [ ] **Step 4: `PeopleJeloltekPage` implementáció.** A `renderJel()` hű portja: `usePeople()`-ből `candidates` + `decidePerson`; `PageHero big={candidates.length}`; a body:

```tsx
        <EntranceGroup>
          {candidates.length === 0 && (
            <div className="ppl-empty rise">
              Nincs több jelölt — az éjszakai kör hajnalban néz újra.
            </div>
          )}
          {candidates.map((c, i) => (
            <div key={c.id} className="ppl-candt rise" style={{ '--d': `${i * 40}ms` } as React.CSSProperties}>
              <div className="ppl-candt-head">
                <ClayIcon name="i-kristaly" size={16} />
                <b>Új arc · {c.name}</b>
                <span className="ppl-figy" style={{ marginLeft: 'auto' }}>JELÖLT</span>
              </div>
              <div className="ppl-candt-q">{c.notes.split('\n')[0]}</div>
              <div className="ppl-candt-ev">visszatérő név · éjszakai kör</div>
              <div className="ppl-candbtns">
                <button type="button" className="ppl-cta-gold" onClick={() => decidePerson(c.id, 'accept')}>
                  Felveszem
                </button>
                <button type="button" className="ppl-ghost" onClick={() => decidePerson(c.id, 'reject')}>
                  Nem ő az / nem kell
                </button>
              </div>
            </div>
          ))}
          <p className="ppl-foot rise" style={{ '--d': '120ms' } as React.CSSProperties}>
            Jelöltet csak visszatérő, ismeretlen név kap. Az elvetett nevet nem javasolja újra.
          </p>
        </EntranceGroup>
```

  (Az S3-as, csak-üres-állapotra írt foot-bekezdés HELYÉRE a prototípus foot-szövege kerül, mindig látszik — a prototípus a forrás-igazság. A fejléc-komment „S4's job" mondatát frissítsd: az adatfolyam most készült el. Ikonméret: a prototípus 14px-e ×1,18 ≈ 16.)
- [ ] **Step 5: `PeoplePage` Jelöltek csempe.** `usePeople()`-ből a `candidates`-t is vedd ki; a csempében:

```tsx
              <div className="ppl-hub-spot">
                <span className="ppl-hub-anchor">
                  <ClayIcon name="i-kristaly" size={40} />
                  {candidates.length > 0 && <span className="ppl-hub-badge">{candidates.length}</span>}
                </span>
              </div>
              <div className="ppl-hub-line">
                {candidates.length > 0
                  ? `${candidates[0].name} · visszatérő név`
                  : 'nincs új arc — az éjszakai kör figyel'}
              </div>
```

  A fájl tetején az S3-as „the Jelöltek tile carries NO badge in S3" komment-mondatot töröld/frissítsd.
- [ ] **Step 6: Zöldre mindkét módban:** `VITE_USE_MOCK=false pnpm test -- src/features/me && VITE_USE_MOCK=true pnpm test -- src/features/me`.
- [ ] **Step 7: Commit.**

```bash
git add frontend/src
git commit -m "feat(fe): jelölt-inbox arany kártyák + hub-badge a prototípus szerint (mezo-06o0.3)"
```

---

### Task 6: Docs + teljes kapuk

**Files:**
- Modify: `docs/features/me.md` (Emberek szakasz: S4 valóság — éjszakai kör, decision végpont, jelölt-inbox)
- Modify: `docs/features/companion.md` VAGY a companion-releváns doc (GraphMaintenanceJob 4. fázis egy mondatban — nézd meg, melyik doc írja le a jobot: `grep -rn "GraphMaintenanceJob" docs/features/`)
- Regenerate: `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`)

**Interfaces:** —

- [ ] **Step 1: me.md.** Az Emberek szakaszban: (a) a mention-gazdagítás már nem „S4 tölti majd" — az éjszakai kör él (PersonExtractionService, GraphMaintenanceJob-lánc, COMPANION∧PEOPLE); (b) decision végpont + reject-lista szemantika (soft-deleted candidate sor); (c) PeopleJeloltekPage: jelölt-kártyák + hub-badge; (d) a `usePeople` people/candidates kettéválasztás. Rövid, tényszerű — a fájl meglévő hangján.
- [ ] **Step 2: companion-doc.** A GraphMaintenanceJob fázislistájához a 4. fázis (person extraction, ObjectProvider-gated).
- [ ] **Step 3: CODEMAP regen:** `node scripts/gen-codemap.mjs`.
- [ ] **Step 4: Docs-lint (CI-hű forma):** `node scripts/lint-docs.mjs --errors-only` — PASS kell (a stale-baseline advisory).
- [ ] **Step 5: Teljes lokális kapuk.**
  - Backend focused: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest='io.mrkuhne.mezo.feature.people.*IT,PersonExtractionServiceIT,GraphMaintenanceJobSwitchOffIT,ArchitectureTest'`
  - Frontend: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`
- [ ] **Step 6: Commit.**

```bash
git add docs
git commit -m "docs: Emberek S4 valóság — éjszakai kör + jelölt-inbox (mezo-06o0.3)"
```

---

## Self-Review jegyzetek (megtörtént)

- **Spec-lefedettség:** spec §3/3. írási út → Task 3 (gazdagítás + jelöltek + pre-spend + bizonytalan-nem-ír + reject-lista); esemény-él javaslat explicit KIHAGYVA (spec: „csak S5 után élesedik"); §1 decision kontraktus → Task 1–2; §5 becsületes állapotok (üres inbox szöveg marad; elvetett név nem tér vissza) → Task 3+5; §6 kapuzás (COMPANION∧PEOPLE, IDENT-3, llm_log adapter) → Task 3; §7 tesztek (PersonExtractionServiceIT marker-mintával, PeopleContractIT decision, FE mindkét mód, ArchUnit) → Task 2/3/6.
- **Placeholder-scan:** nincs TBD/TODO; minden kód-lépés tényleges kóddal.
- **Típus-konzisztencia:** `PersonDecisionRequest` (Task 1) = Task 2 service-szignatúra = Task 4 FE típus; `PersonExtractionResult(enriched, candidates)` a job-logsorban (Task 3 Step 5) ugyanazzal a két accessorral; `usePeople().candidates/decidePerson` (Task 4) = Task 5 fogyasztás; `PersonPopulator.createCandidate` (Task 2) = Task 3 IT fogyasztás.
- **Tudott kockázatok az implementernek:** (1) a generált controller-szignatúra pontos alakját mindig a generált `PeopleApi`-ból másold; (2) Jackson 3 rekord-parse toleranciát a `LifeEventSuggestion`-ból vedd át; (3) a `MentionPopulator.createMention` tone-null viselkedését ellenőrizd; (4) S3-tesztek, amelyek a seed-létszámra épülnek, az aktív-only szűrés után igazításra szorulhatnak (Task 4 Step 8).
