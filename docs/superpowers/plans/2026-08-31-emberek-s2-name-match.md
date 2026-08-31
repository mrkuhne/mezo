# Emberek S2 — azonnali név-match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Minden narratív forrás (napló, hála, döntés, reflexió, chat, jegyzet-sweep) mentése után determinisztikus, hajtogatott név+alias match automatikusan `mention` sort ír (tone=NULL, source_ref kitöltve, dedup), a feedben forrás-jelzéssel és ✕ visszavonással.

**Architecture:** Egy tiszta domain-szolgáltatás (`MentionDetectionService`, feature/people) végzi a hajtogatott matchet és a dedupolt írást; vékony `@Async @TransactionalEventListener(AFTER_COMMIT)` listenerek kötik rá a forrás-eseményeket. ArchUnit-él-térkép miatt a journal/ritual-leg a people-ben él (új, ciklusmentes people→journal, people→ritual élek), a chat-leg és a jegyzet-sweep a companionban (companion→people él már létezik — a fordított irány ciklust zárna). A kontraktus lazul: `MentionResponse.tone` optional, `source` enum +`chat`, új `DELETE …/mentions/{mentionId}` végpont a ✕-hez.

**Tech Stack:** Spring Boot 4, Spring events + `@Async`, JPA/Hibernate (soft delete `@SQLDelete`), OpenAPI contract-first (generált `PeopleApi`), React + TanStack Query dual-mode, MSW, Vitest, Awaitility az IT-kben.

**bd issue:** `mezo-06o0.1` (parent: mezo-06o0). Branch: `feat/emberek-s2-name-match`.

## Global Constraints

- Backend teszt MINDIG: `cd backend && ./mvnw test -Dtest=<X> -Dmezo.test.use-testcontainers=true` (a fixed-DB mód versenyez és hamis hibát ad).
- Kontraktus-módosítás után: `cd api/generate && npm run generate:api`, majd `cd backend && ./mvnw clean test-compile -Dmezo.test.use-testcontainers=true` (a generate-sources önmagában nem elég); FE: `cd frontend && pnpm generate:api`.
- FE kapu (worktree-ben explicit mindkét mód): `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`.
- IDENT-3: minden async detektálási út hibája `log.warn` + swallow — a felhasználói írás SOHA nem sérülhet.
- Hibák a házi mintán: `SystemRuntimeErrorException` + `SystemMessage.error("RESOURCE_NOT_FOUND")` / `SystemMessage.field(code, fieldName)`; nyers RuntimeException/IllegalStateException tilos a techcore-on kívül (ArchUnit).
- ArchUnit: ÚJ feature-él csak ciklusmentesen. Tilos: `feature.people` → `feature.companion` import (companion→people már létezik). Megengedett új élek: people→journal, people→ritual (ellenőrizve: journal csak önmagát importálja; ritual→biometrics→{goal,llmlog,train}→{auth,progression} — egyik sem éri el a people-t).
- `mention` dedup-kulcs (S1 migráció, már él): `uq_mention_source_ref` partial unique index `(created_by, person_id, source_ref_kind, source_ref_id) WHERE source IN ('text','chat') AND is_deleted = false`.
- `source_ref_kind` zárt készlet (DB CHECK): `journal_entry|reflection|gratitude|decision|activity_note|checkin_note|chat_turn`.
- Commit-subjectek: conventional, a bd id-vel — pl. `feat(api): mention tone optional + delete végpont (mezo-06o0.1)`.
- Task-tracking bd-vel; TodoWrite/markdown TODO tilos.
- Single-user app: `createdBy` a principaltól, sosem a klienstől.

## Áttekintő fájltérkép

| Fájl | Szerep |
|---|---|
| `api/feature/people/people.yml` | tone optional, source +chat, DELETE mention op |
| `backend/.../techcore/text/TextFold.java` (új) | fold() promóció (SafeTruncate-precedens) |
| `backend/.../feature/companion/tools/ToolText.java` | fold() delegál a TextFold-ra |
| `backend/.../feature/people/entity/MentionEntity.java` | tone @NotNull le |
| `backend/.../feature/people/repository/MentionRepository.java` | native exists (deleted sorokkal együtt) |
| `backend/.../feature/people/service/MentionDetectionService.java` (új) | match + excerpt + dedupolt írás |
| `backend/.../feature/people/service/MentionDetectionListener.java` (új) | journal/hála/döntés események |
| `backend/.../feature/people/service/ReflectionMentionListener.java` (új) | RitualClosedEvent |
| `backend/.../feature/companion/service/ChatMentionListener.java` (új) | ChatTurnCompleted |
| `backend/.../feature/companion/embedding/NoteMentionCatchUp.java` (új) | activity_note/checkin_note sweep |
| `backend/.../feature/companion/service/DailySummaryJob.java` | sweep bekötés |
| `backend/.../techcore/configuration/FeaturesConfiguration.java` | PEOPLE_SWITCH |
| `backend/src/main/resources/application.yml` | `mezo.feature.people.enabled: true` |
| `backend/.../feature/people/service/PeopleService.java` | deleteMention |
| `backend/.../feature/people/controller/PeopleController.java` | deleteMention op |
| `frontend/src/data/types.ts` | MentionSource +'chat', tone opcionális |
| `frontend/src/data/me/peopleApi.ts` | deleteMention + toMention tone |
| `frontend/src/data/me/peopleHooks.ts` | undoMention mutáció |
| `frontend/src/data/me/people.ts` | mock seed: automata mention |
| `frontend/src/test/msw/handlers.ts` | DELETE mention handler |
| `frontend/src/features/me/components/MentionRow.tsx` | chat ikon + ✕ visszavonás |
| `frontend/src/features/me/pages/PeoplePage.tsx` | undoMention átadás |
| `docs/features/me.md`, `docs/CODEMAP.md` | doksi + codemap |

---

### Task 1: Kontraktus-lazítás + mention-törlés végpont (BE)

**Files:**
- Modify: `api/feature/people/people.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/entity/MentionEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/controller/PeopleController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/repository/MentionRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleContractIT.java`

**Interfaces:**
- Consumes: S1 kontraktus és entitások (a fájlok a repóban vannak, olvasd el őket).
- Produces: `PeopleService.deleteMention(UUID userId, UUID personId, UUID mentionId)`; `MentionRepository.findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy)`; generált `deleteMention` op a `PeopleApi`-n; `MentionResponse.tone` nullable a wire-on; `source` enum: `voice|camera|chip|text|chat`.

- [ ] **Step 1: people.yml szerkesztés.** A `MentionResponse` sémában: (a) a `required` listából töröld a `- tone` sort (a többi marad); (b) a `source` enum legyen `[voice, camera, chip, text, chat]`. Vedd fel az új műveletet a `/api/people/{personId}/mentions/{mentionId}` path alá (a `DELETE /api/people/{personId}` meglévő blokkjának mintájára — paraméterek, 204-es válasz, security ugyanúgy):

```yaml
  /api/people/{personId}/mentions/{mentionId}:
    delete:
      tags: [people]
      summary: Egy említés visszavonása (soft delete)
      operationId: deleteMention
      parameters:
        - name: personId
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: mentionId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        "204":
          description: Törölve
```

(Igazítsd a fájl meglévő stílusához: ha a szomszédos műveletek hordoznak `security` blokkot vagy hibaválaszokat, ez is ugyanúgy.)

- [ ] **Step 2: Generálás + fordítás-ellenőrzés.**

Run: `cd api/generate && npm run generate:api && cd ../../backend && ./mvnw clean test-compile -Dmezo.test.use-testcontainers=true 2>&1 | tail -5`
Expected: BUILD SUCCESS; a `PeopleApi` interfészen megjelenik a `deleteMention(UUID personId, UUID mentionId)` — a `PeopleController` innentől NEM fordul, amíg nem implementálod (ez a "failing test" fázis).

- [ ] **Step 3: Failing IT-k megírása.** A `PeopleContractIT`-be (a meglévő helperek: `postForBody`, `putForBody`, `deleteAndExpect`, `ownerAuthHeaders`; a bootstrap-olvasás meglévő mintáját kövesd a fájlból):

```java
@Test
void testDeleteMention_shouldSoftDeleteAndVanishFromBootstrap() {
    // arrange: hozz létre személyt + logolj rá egy mentiont a meglévő POST-okkal
    // (a fájl createPerson/logMention tesztjeinek request-építését másold)
    // act:
    deleteAndExpect("/api/people/" + personId + "/mentions/" + mentionId,
            ownerAuthHeaders(), HttpStatus.NO_CONTENT);
    // assert: a GET /api/people mentions feedjében a mentionId már nincs benne,
    // és a person mentionCount eggyel kevesebb
}

@Test
void testDeleteMention_shouldReturn404_whenMentionBelongsToOtherPerson() {
    // két személy, mention az egyiken; DELETE a MÁSIK personId-vel + a mention id-vel
    deleteAndExpect("/api/people/" + otherPersonId + "/mentions/" + mentionId,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND);
}

@Test
void testBootstrap_shouldServeToneLessMention() {
    // arrange: közvetlenül a MentionRepository-val (autowire) írj egy sort:
    // source="text", tone=null, sourceRefKind="journal_entry", sourceRefId=UUID.randomUUID(),
    // excerpt="Ádámmal futottam", ts=Instant.now(), personId, createdBy=ownerId, flagged=false
    // assert: GET /api/people 200; a feedben a sor tone == null, source == TEXT (nem 500)
}
```

- [ ] **Step 4: Futtatás — bukniuk kell.**

Run: `cd backend && ./mvnw test -Dtest=PeopleContractIT -Dmezo.test.use-testcontainers=true 2>&1 | tail -15`
Expected: FAIL — a controller nem implementálja a `deleteMention`-t (fordítási hiba után az implementáció-stub megírásáig), a tone=null írás pedig a `MentionEntity` `@NotNull` miatt bukik.

- [ ] **Step 5: Implementáció.**
  - `MentionEntity.tone`: vedd le a `@NotNull`-t és a `nullable = false`-t (`@Column private String tone; // affect (DB CHECK), NULL amíg az éjszakai kör nem tölti (S4)`).
  - `MentionRepository`: `Optional<MentionEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);`
  - `PeopleService`:

```java
/** ✕ visszavonás: bármely saját mention soft-deletálható; a személy-scope a 404-hez kell. */
@Transactional
public void deleteMention(UUID userId, UUID personId, UUID mentionId) {
    MentionEntity m = mentionRepository.findByIdAndCreatedByAndDeletedFalse(mentionId, userId)
        .filter(x -> x.getPersonId().equals(personId))
        .orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    mentionRepository.delete(m); // @SQLDelete → soft
}
```

  - `PeopleController`: implementáld a generált op-ot a meglévő végpontok mintájára (principal-ból userId, delegálás, 204).

- [ ] **Step 6: Zöldre futtatás.**

Run: `cd backend && ./mvnw test -Dtest=PeopleContractIT -Dmezo.test.use-testcontainers=true 2>&1 | tail -5`
Expected: PASS (a meglévő 13 + 3 új teszt).

- [ ] **Step 7: Commit.**

```bash
git add api/feature/people/people.yml backend/src/main/java/io/mrkuhne/mezo/feature/people backend/src/test/java/io/mrkuhne/mezo/feature/people
git commit -m "feat(api): mention tone optional, source +chat, delete-mention végpont (mezo-06o0.1)"
```

---

### Task 2: TextFold promóció + MentionDetectionService

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/text/TextFold.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolText.java` (fold delegál)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/repository/MentionRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/MentionDetectionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/MentionDetectionServiceIT.java`

**Interfaces:**
- Consumes: `PersonRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(UUID)`; `SafeTruncate.truncate(String, int)` (techcore/text); Task 1 `MentionRepository`.
- Produces: `TextFold.fold(String) : String`; `MentionDetectionService.detect(UUID userId, String text, String source, String sourceRefKind, UUID sourceRefId, Instant ts) : int` (a beszúrt mentionök száma); `MentionRepository.existsSourceRefIncludingDeleted(UUID userId, UUID personId, String kind, UUID refId) : boolean`.

- [ ] **Step 1: TextFold létrehozása** (a `SafeTruncate` cross-slice precedensével — companion→people él létezik, ezért a people nem importálhat companiont; a fold ezért techcore-ba emelkedik):

```java
package io.mrkuhne.mezo.techcore.text;

import java.text.Normalizer;

/**
 * Lowercase + NFD ékezet-strip — "Túrós" → "turos". A {@code ToolText.fold} (mezo-sxe) promóciója
 * (bd mezo-06o0.1): a mention-detektálás a {@code feature.people}-ben él, amely nem importálhat
 * {@code feature.companion}-t (companion→people él már létezik — a fordított irány új slice-ciklust
 * zárna a FreezingArchRule alatt), ezért a tiszta helper techcore-ba került, a {@code SafeTruncate}
 * mintájára. {@code ToolText.fold} ide delegál.
 */
public final class TextFold {

    private TextFold() {
    }

    public static String fold(String text) {
        return text == null ? ""
                : Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
```

- [ ] **Step 2: ToolText.fold delegál.** A `ToolText.fold` törzse legyen `return TextFold.fold(text);` (import `io.mrkuhne.mezo.techcore.text.TextFold`; a javadoc maradjon, egy sorral kiegészítve, hogy a törzs a techcore-ba promótálódott).

- [ ] **Step 3: Repository exists-finder** — natív, hogy a `@SQLRestriction` NE szűrje ki a soft-deleted sorokat (egy ✕-szel visszavont automata mentiont egy újramentés ne támasszon fel):

```java
/** Dedup-ellenőrzés az automata úthoz — NATÍV, mert a soft-deleted (✕-szel visszavont) sort is
 *  látni kell: a partial unique index (is_deleted=false) a visszavont sort már nem védi, és a
 *  forrás újramentése különben feltámasztaná, amit a user kifejezetten eltüntetett. */
@Query(value = "select exists(select 1 from mention where created_by = :userId and person_id = :personId"
        + " and source_ref_kind = :kind and source_ref_id = :refId)", nativeQuery = true)
boolean existsSourceRefIncludingDeleted(@Param("userId") UUID userId, @Param("personId") UUID personId,
        @Param("kind") String kind, @Param("refId") UUID refId);
```

(Importok: `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param`.)

- [ ] **Step 4: Failing IT megírása.** `MentionDetectionServiceIT extends ApiIntegrationTest` (az owner-user feloldásához kövesd a meglévő service-szintű IT-k mintáját — pl. ahogy a `PeopleContractIT` vagy a Populator-alapú tesztek jutnak owner id-hez; ha HTTP-n kényelmesebb, hozz létre személyt POST-tal és olvasd vissza az id-t, a `detect`-et pedig autowire-olt service-en hívd az owner id-jével). Esetek:

```java
@Test void testDetect_shouldMatchNameFoldedAndAccentless()
// person "Ádám"; detect(owner, "Tegnap Adammal futottam egy jót.", "text", "journal_entry", refId, now)
// → 1 mention: personId=Ádám, source="text", tone=null, sourceRefKind="journal_entry",
//   sourceRefId=refId, excerpt="Tegnap Adammal futottam egy jót."

@Test void testDetect_shouldMatchAlias()
// person "Márk", aliases=["Marcika"]; szöveg "Marcika átjött vacsorára." → 1 mention Márkra

@Test void testDetect_shouldMatchHungarianSuffixedName()
// person "Réka"; szöveg "Rékának segítettem a költözésben." → 1 mention (szó-eleji illeszkedés)

@Test void testDetect_shouldNotMatchInsideWord()
// person "Ada"... nem: rövid név. Inkább: person "Réka"; szöveg "A kréta elfogyott." → 0 mention
// (a needle nem szóhatáron kezdődik)

@Test void testDetect_shouldPickMatchingSentenceAsExcerpt()
// "Reggel edzés volt. Ádám hívott telefonon. Este pihenés." → excerpt == "Ádám hívott telefonon."

@Test void testDetect_shouldDedupOnSecondRun()
// ugyanaz a (person, kind, refId) kétszer → összesen 1 élő mention, a visszatérési érték másodszor 0

@Test void testDetect_shouldNotResurrectUndoneMention()
// detect → mentionRepository.delete(m) (soft) → detect újra → 0 élő mention marad

@Test void testDetect_shouldSkipBlankTextAndUnknownNames()
// blank szöveg → 0; "Valaki idegen járt itt." (nincs ilyen person) → 0
```

- [ ] **Step 5: Futtatás — bukik.**

Run: `cd backend && ./mvnw test -Dtest=MentionDetectionServiceIT -Dmezo.test.use-testcontainers=true 2>&1 | tail -5`
Expected: FAIL (nincs `MentionDetectionService`).

- [ ] **Step 6: Implementáció.**

```java
package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.techcore.text.SafeTruncate;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Determinisztikus név+alias match a szabad szövegen (spec §3.2, bd mezo-06o0.1). Hajtogatott
 * (ékezet-strip + lowercase, {@link TextFold}) keresés, a needle-nek SZÓHATÁRON kell kezdődnie,
 * de a szó folytatódhat — a magyar ragozás miatt ("Ádámmal", "Rékának") a szóvégi határ-őrzés
 * a valódi említések zömét dobná el. Excerpt = az első találó mondat. tone=NULL (az éjszakai
 * kör tölti, S4). Dedup: {@code existsSourceRefIncludingDeleted} — a ✕-szel visszavont sort egy
 * forrás-újramentés nem támasztja fel; a maradék versenyt a partial unique index zárja
 * ({@link DataIntegrityViolationException} → skip).
 *
 * <p>Csak {@code status='active'} személyre ír (a candidate/archived kör nem szennyezi a feedet).
 * A hívó listenerek felelnek az IDENT-3 nyelésért; ez a service dobhat.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MentionDetectionService {

    /** Feed-barát plafon; a mention.excerpt oszlopnak nincs DB-hossza, ez UX-cap. */
    private static final int EXCERPT_MAX_CHARS = 240;
    /** 1–2 betűs needle szinte mindenre illik — sosem az, amire a user gondolt. */
    private static final int MIN_NEEDLE_LENGTH = 3;

    private final PersonRepository personRepository;
    private final MentionRepository mentionRepository;

    @Transactional
    public int detect(UUID userId, String text, String source, String sourceRefKind,
            UUID sourceRefId, Instant ts) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        List<PersonEntity> persons = personRepository
                .findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId).stream()
                .filter(p -> "active".equals(p.getStatus()))
                .toList();
        if (persons.isEmpty()) {
            return 0;
        }
        List<String> sentences = splitSentences(text);
        int written = 0;
        for (PersonEntity person : persons) {
            String excerpt = firstMatchingSentence(sentences, needlesFor(person));
            if (excerpt == null) {
                continue;
            }
            if (mentionRepository.existsSourceRefIncludingDeleted(
                    userId, person.getId(), sourceRefKind, sourceRefId)) {
                continue;
            }
            MentionEntity m = new MentionEntity();
            m.setCreatedBy(userId);
            m.setPersonId(person.getId());
            m.setTs(ts);
            m.setSource(source);
            m.setExcerpt(SafeTruncate.truncate(excerpt, EXCERPT_MAX_CHARS));
            m.setTone(null); // az éjszakai kör tölti (S4)
            m.setContextLabel(null);
            m.setSourceRefKind(sourceRefKind);
            m.setSourceRefId(sourceRefId);
            m.setFlagged(false);
            try {
                mentionRepository.save(m);
                written++;
            } catch (DataIntegrityViolationException raceLost) {
                // Egyidejű detektálás ugyanarra a (person, kind, ref) kulcsra — a nyertes sora él.
                log.warn("Mention dedup race lost for person {} ref {}/{}",
                        person.getId(), sourceRefKind, sourceRefId);
            }
        }
        return written;
    }

    private static List<String> needlesFor(PersonEntity person) {
        List<String> needles = new ArrayList<>();
        addNeedle(needles, person.getName());
        if (person.getAliases() != null) {
            person.getAliases().forEach(a -> addNeedle(needles, a));
        }
        return needles;
    }

    private static void addNeedle(List<String> needles, String raw) {
        String folded = TextFold.fold(raw).strip();
        if (folded.length() >= MIN_NEEDLE_LENGTH) {
            needles.add(folded);
        }
    }

    /** Mondathatár: záró írásjel vagy sortörés után vágunk; a delimiter a mondatnál marad. */
    private static List<String> splitSentences(String text) {
        return java.util.Arrays.stream(text.split("(?<=[.!?\\n])"))
                .map(String::strip)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private static String firstMatchingSentence(List<String> sentences, List<String> needles) {
        for (String sentence : sentences) {
            String folded = TextFold.fold(sentence);
            for (String needle : needles) {
                if (containsAtWordStart(folded, needle)) {
                    return sentence;
                }
            }
        }
        return null;
    }

    /** A needle szóhatáron kezdődik; a szó vége szabad (magyar ragok: "adammal", "rekanak"). */
    private static boolean containsAtWordStart(String foldedHaystack, String foldedNeedle) {
        int i = -1;
        while ((i = foldedHaystack.indexOf(foldedNeedle, i + 1)) >= 0) {
            if (i == 0 || !Character.isLetterOrDigit(foldedHaystack.charAt(i - 1))) {
                return true;
            }
        }
        return false;
    }
}
```

- [ ] **Step 7: Zöldre futtatás.**

Run: `cd backend && ./mvnw test -Dtest=MentionDetectionServiceIT -Dmezo.test.use-testcontainers=true 2>&1 | tail -5`
Expected: PASS (8 teszt).

- [ ] **Step 8: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/text/TextFold.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolText.java backend/src/main/java/io/mrkuhne/mezo/feature/people backend/src/test/java/io/mrkuhne/mezo/feature/people
git commit -m "feat(people): MentionDetectionService — hajtogatott név+alias match dedupolt írással (mezo-06o0.1)"
```

---

### Task 3: PEOPLE_SWITCH + esemény-listenerek (journal/hála/döntés/reflexió/chat)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/MentionDetectionListener.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/ReflectionMentionListener.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatMentionListener.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/MentionDetectionListenerIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/MentionDetectionSwitchOffIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/ChatMentionListenerIT.java`

**Interfaces:**
- Consumes: `MentionDetectionService.detect(UUID, String, String, String, UUID, Instant)` (Task 2); események: `JournalEntrySavedEvent(entryId)`, `GratitudeEntrySavedEvent(entryId)`, `DecisionEntrySavedEvent(decisionId)` (feature/journal/service), `RitualClosedEvent(ritualDayId)` (feature/ritual/service — TX-en BELÜL publikált, AFTER_COMMIT listener kötelező), `ChatTurnCompleted(userId, userMessageId, userContent, assistantMessageId, assistantContent)` (feature/companion/service); repók: `JournalEntryRepository`, `GratitudeEntryRepository`, `DecisionEntryRepository`, `RitualDayRepository`.
- Produces: `FeaturesConfiguration.PEOPLE_SWITCH = "mezo.feature.people.enabled"`; a három listener-bean (Task 4 és a doksi hivatkozik rájuk).

- [ ] **Step 1: Switch felvétele.** `FeaturesConfiguration`-be (a többi konstans mintájára, javadoc-kal):

```java
/** Emberek szekció (mezo-06o0) — az automata mention-detektálás rétege. Off ⇒ egyetlen
 *  detektáló listener-bean sem létezik; a kézi /api/people felület ettől függetlenül él. */
public static final String PEOPLE_SWITCH = "mezo.feature.people.enabled";
```

`application.yml` `mezo.feature:` blokkjába (a szomszédok kommentstílusában):

```yaml
    # Emberek (mezo-06o0) — automata mention-detektálás a narratív forrásokból (név+alias match).
    # Off ⇒ nincs detektáló listener; a kézi people CRUD + chip-log felület változatlanul él.
    people:
      enabled: true
```

- [ ] **Step 2: Failing IT-k.** (a) `MentionDetectionListenerIT extends ApiIntegrationTest` — a `JournalEmbeddingEventIT` / `TurnEmbeddingListenerIT` mintája: HTTP-írás + Awaitility:

```java
@Test void testJournalSave_shouldWriteMention()
// arrange: POST /api/people (person "Ádám"); act: POST /api/journal (a JournalEmbeddingEventIT
// request-mintája) szöveggel "Ádámmal kávéztunk délután."
// assert: await().atMost(5, SECONDS) → a MentionRepository-ban 1 sor:
//   source="text", sourceRefKind="journal_entry", sourceRefId=<entry id>, tone=null,
//   excerpt="Ádámmal kávéztunk délután."

@Test void testJournalEdit_shouldNotDuplicateMention()
// POST majd PUT (vagy második mentés) ugyanarra az entry-re ugyanazzal a névvel
// → await után is pontosan 1 élő mention a (person, journal_entry, entryId) kulcson

@Test void testGratitudeSave_shouldWriteMention()   // sourceRefKind="gratitude"
@Test void testDecisionSave_shouldWriteMention()    // sourceRefKind="decision"
```

(b) `MentionDetectionSwitchOffIT` — a `TurnEmbeddingSwitchOffIT` mintája: `@TestPropertySource(properties = "mezo.feature.people.enabled=false")`, POST journal ismert névvel, rövid fix várakozás után assert: 0 mention, ÉS a kontextusban nincs `MentionDetectionListener` bean (`assertThat(context.getBeansOfType(MentionDetectionListener.class)).isEmpty()`).

(c) `ChatMentionListenerIT` — a `TurnEmbeddingListenerIT` másolata people-irányban: `@ActiveProfiles("companion-fake")`, conversation + message POST "Ádám ma sokat segített" tartalommal (előtte person "Ádám" felvétele) → await: 1 mention `source="chat"`, `sourceRefKind="chat_turn"`, `sourceRefId=<userMessageId>` (a user-üzenet az, amit a match olvas — a válasz a gép szava).

- [ ] **Step 3: Futtatás — buknak.**

Run: `cd backend && ./mvnw test -Dtest='MentionDetectionListenerIT,MentionDetectionSwitchOffIT,ChatMentionListenerIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -8`
Expected: FAIL (nincsenek listenerek).

- [ ] **Step 4: Listener-implementációk.** Mindhárom a `JournalEmbeddingListener` idiómán: `@Async @TransactionalEventListener(AFTER_COMMIT)`, entity újraolvasás id-ből (a `@SQLRestriction` a soft-deletet is lefedi), teljes törzs try/catch → `log.warn` + swallow (IDENT-3).

`feature/people/service/MentionDetectionListener.java`:

```java
package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.DecisionEntrySavedEvent;
import io.mrkuhne.mezo.feature.journal.service.GratitudeEntrySavedEvent;
import io.mrkuhne.mezo.feature.journal.service.JournalEntrySavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * S2 azonnali név-match a journal-forrásokra (napló/hála/döntés — spec §3.2, bd mezo-06o0.1), a
 * {@code JournalEmbeddingListener} idiómán. Kapuzás: PEOPLE ∧ JOURNAL switch — bármelyik off,
 * és a bean nem létezik. IDENT-3: minden hiba warn + swallow, a user írása sosem sérül. Az új
 * people→journal él ciklusmentes (a journal semmit nem importál kifelé).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.PEOPLE_SWITCH, FeaturesConfiguration.JOURNAL_SWITCH},
        havingValue = "true")
public class MentionDetectionListener {

    private final MentionDetectionService mentionDetectionService;
    private final JournalEntryRepository journalEntryRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;
    private final DecisionEntryRepository decisionEntryRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onJournalEntrySaved(JournalEntrySavedEvent event) {
        try {
            journalEntryRepository.findById(event.entryId()).ifPresent(entry ->
                    mentionDetectionService.detect(entry.getCreatedBy(), entry.getText(),
                            "text", "journal_entry", entry.getId(), Instant.now()));
        } catch (Exception e) {
            log.warn("Mention detection failed for journal entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGratitudeEntrySaved(GratitudeEntrySavedEvent event) {
        try {
            gratitudeEntryRepository.findById(event.entryId()).ifPresent(entry ->
                    mentionDetectionService.detect(entry.getCreatedBy(), entry.getText(),
                            "text", "gratitude", entry.getId(), Instant.now()));
        } catch (Exception e) {
            log.warn("Mention detection failed for gratitude entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDecisionEntrySaved(DecisionEntrySavedEvent event) {
        try {
            decisionEntryRepository.findById(event.decisionId()).ifPresent(decision ->
                    mentionDetectionService.detect(decision.getCreatedBy(),
                            decisionText(decision), "text", "decision", decision.getId(),
                            Instant.now()));
        } catch (Exception e) {
            log.warn("Mention detection failed for decision {}", event.decisionId(), e);
        }
    }

    /** A döntés-szöveg + (ha már van) a kimenet — mindkettő a user szava, mindkettő matchelhető. */
    private static String decisionText(DecisionEntryEntity decision) {
        return decision.getOutcomeText() == null
                ? decision.getDecisionText()
                : decision.getDecisionText() + "\n" + decision.getOutcomeText();
    }
}
```

`feature/people/service/ReflectionMentionListener.java` — ugyanez a váz `RitualClosedEvent`-re: `@ConditionalOnProperty(name = {PEOPLE_SWITCH, RITUAL_SWITCH})`, `ritualDayRepository.findById(event.ritualDayId())`, `detect(day.getCreatedBy(), day.getReflectionText(), "text", "reflection", day.getId(), Instant.now())` — a `detect` blank-guardja lefedi az üres reflexiót. Javadocba: a `RitualClosedEvent` TX-en belül publikált, ezért kötelező az AFTER_COMMIT fázis (az esemény-osztály javadocja mondja ki).

`feature/companion/service/ChatMentionListener.java` — `@ConditionalOnProperty(name = {PEOPLE_SWITCH, COMPANION_SWITCH})`, a `ChatTurnCompleted` payloadból NEM olvas vissza DB-t (a payload hordozza a szöveget): `detect(event.userId(), event.userContent(), "chat", "chat_turn", event.userMessageId(), Instant.now())`. Javadocba: a listener azért él a companionban, mert companion→people él már létezik, people→companion új ciklust zárna; csak a USER szövegét matcheljük (a gép válasza nem a user említése); ref = `userMessageId`.

- [ ] **Step 5: Zöldre futtatás.**

Run: `cd backend && ./mvnw test -Dtest='MentionDetectionListenerIT,MentionDetectionSwitchOffIT,ChatMentionListenerIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -5`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(people): PEOPLE_SWITCH + mention-detektáló listenerek a narratív forrásokra (mezo-06o0.1)"
```

---

### Task 4: NoteMentionCatchUp — jegyzet-sweep (activity_note / checkin_note)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/NoteMentionCatchUp.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DailySummaryJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteMentionCatchUpIT.java`

**Interfaces:**
- Consumes: `NarrativeNoteSource` port (`kind()`, `notesToEmbed(UUID userId, LocalDate through, int minChars)`, `Note(id, createdBy, text, occurredOn)`); `MentionDetectionService.detect(...)` (Task 2, companion→people él legális); `FeaturesConfiguration.PEOPLE_SWITCH` (Task 3).
- Produces: `NoteMentionCatchUp.run(UUID userId, LocalDate through) : int` — a `DailySummaryJob` hívja.

- [ ] **Step 1: Failing IT.** `NoteMentionCatchUpIT extends ApiIntegrationTest`: hozz létre személyt ("Ádám") és egy activity-jegyzetet a meglévő activity írási úton (nézd meg, hogyan ír az `ActivityNoteSourceAdapter` forrás-táblája — kövesd egy meglévő activity-IT beszúrási mintáját; ha HTTP-n körülményes, írd a repository-val). Hívd `noteMentionCatchUp.run(ownerId, LocalDate.now())` (autowire), assert: 1 mention `source="text"`, `sourceRefKind="activity_note"`, `sourceRefId=<note id>`, `ts == occurredOn` napkezdete (UTC). Második `run` → továbbra is 1 (idempotens). Blank/no-match jegyzet → 0.

- [ ] **Step 2: Futtatás — bukik.**

Run: `cd backend && ./mvnw test -Dtest=NoteMentionCatchUpIT -Dmezo.test.use-testcontainers=true 2>&1 | tail -5`
Expected: FAIL (nincs bean).

- [ ] **Step 3: Implementáció.**

```java
package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * S2 jegyzet-leg (spec §3.2 "jegyzet-catchup"): a jegyzeteknek nincs mentés-eseményük — a
 * {@code NoteEmbeddingCatchUp} nightly mintájára a {@code NarrativeNoteSource} port teljes élő
 * állományán fut a név-match, és a dedup ({@code existsSourceRefIncludingDeleted} + partial
 * unique index) teszi idempotenssé az ismételt éjszakai futást. minChars=1: a mention-matchnek
 * a rövid jegyzet is számít (az embedding-küszöb az embedding gazdaságossága, nem a miénk).
 * ts = a jegyzet {@code occurredOn} napkezdete (UTC) — egy régi jegyzet első sweepje ne
 * árassza el "mai" említésekkel a feedet. A bean a companionban él (companion→people él már
 * létezik; people→companion ciklust zárna), kapuzás PEOPLE ∧ COMPANION.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.PEOPLE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class NoteMentionCatchUp {

    private final ObjectProvider<NarrativeNoteSource> noteSources;
    private final MentionDetectionService mentionDetectionService;

    /** Végigmegy minden forrás élő jegyzetein {@code through}-ig; visszaadja az új mentionök számát. */
    public int run(UUID userId, LocalDate through) {
        int written = 0;
        for (NarrativeNoteSource source : noteSources.orderedStream().toList()) {
            String kind = source.kind();
            for (NarrativeNoteSource.Note note : source.notesToEmbed(userId, through, 1)) {
                try {
                    written += mentionDetectionService.detect(userId, note.text(), "text", kind,
                            note.id(), note.occurredOn().atStartOfDay(ZoneOffset.UTC).toInstant());
                } catch (Exception e) {
                    log.warn("Note mention detection failed for {} {}", kind, note.id(), e);
                }
            }
        }
        return written;
    }
}
```

FIGYELEM: a `notesToEmbed` javadocja szerint "live notes ... whose text is at least minChars long" — ha az implementációk kihagynák az embedding-státusz szűrést (tehát tényleg MINDEN élő jegyzetet adnak), jó; ha a metódus valójában "still-unembedded"-re szűr (olvasd el mindkét adapter implementációját: `activity/service/ActivityNoteSourceAdapter`, `companion/embedding/CheckInNoteSourceAdapter`), akkor az embedded jegyzet kimaradna a mention-sweepből — ez esetben a portra NEM nyúlunk rá: jelezd BLOCKED/DONE_WITH_CONCERNS státuszban, és a sweep az adapterek tényleges szemantikájával megy be, a korlátot a javadocban kimondva.

- [ ] **Step 4: DailySummaryJob bekötés.** A `noteEmbeddingCatchUp.run(...)` hívása UTÁN, per-user, ugyanabban a try-védelemben, `ObjectProvider<NoteMentionCatchUp>`-on át (a bean PEOPLE-switch-off esetén nem létezik):

```java
noteMentionCatchUp.ifAvailable(catchUp -> {
    int mentions = catchUp.run(user.getId(), yesterday);
    if (mentions > 0) {
        log.info("Note mention catch-up wrote {} mentions for user {}", mentions, user.getId());
    }
});
```

(Konstruktor-injektálás: `private final ObjectProvider<NoteMentionCatchUp> noteMentionCatchUp;` — a job meglévő field-stílusában.)

- [ ] **Step 5: Zöldre futtatás.**

Run: `cd backend && ./mvnw test -Dtest=NoteMentionCatchUpIT -Dmezo.test.use-testcontainers=true 2>&1 | tail -5`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(people): NoteMentionCatchUp — jegyzet-sweep a nightly körben (mezo-06o0.1)"
```

---

### Task 5: FE — típusok, undo-mutáció, forrás-jelzés, mock seed

**Files:**
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/me/peopleApi.ts`
- Modify: `frontend/src/data/me/peopleHooks.ts`
- Modify: `frontend/src/data/me/people.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Modify: `frontend/src/features/me/components/MentionRow.tsx`
- Modify: `frontend/src/features/me/pages/PeoplePage.tsx`
- Test: `frontend/src/data/me/peopleHooks.test.ts` (vagy a meglévő hooks-teszt fájl bővítése), `frontend/src/features/me/pages/PeoplePage.test.tsx`

**Interfaces:**
- Consumes: Task 1 kontraktus (`pnpm generate:api` után `deleteMention` a generált kliensben, `MentionResponse.tone?`).
- Produces: `usePeople()` visszatérésében új `undoMention: (mention: Mention) => void` (a teljes mention megy át — így a mutáció nem keres a cache-ben stale closure-ből); `Mention.tone?: Affect`; `MentionSource` +`'chat'`; `MentionRow` új opcionális prop: `onUndo?: (mention: Mention) => void`.

- [ ] **Step 1: Generálás.**

Run: `cd frontend && pnpm generate:api`
Expected: a generált people-kliensben megjelenik a `deleteMention`, a `MentionResponse.tone` optionalra vált.

- [ ] **Step 2: Failing tesztek.**
  - Hooks (mindkét mód fut a suite-ban; a meglévő people hooks-teszt mintájára): real módban `undoMention(id)` → MSW DELETE hívás + invalidálás (a feedből eltűnik a sor); mock módban `undoMention(id)` → a cache-ből eltűnik a sor.
  - `PeoplePage.test.tsx`: a seed automata mentionje (lásd Step 3 seed-bővítés) mellett megjelenik a ✕ gomb (`aria-label="Említés visszavonása"`), kattintásra a sor eltűnik; chip-forrású soron NINCS ✕.

- [ ] **Step 3: Implementáció.**
  - `types.ts`: `export type MentionSource = 'voice' | 'camera' | 'chip' | 'text' | 'chat'`; a `Mention.tone` legyen `tone?: Affect`.
  - `peopleApi.ts`: `toMention`-ben `tone: (m.tone ?? undefined) as Affect | undefined`; új kliens-metódus a meglévők mintájára: `deleteMention(personId: string, mentionId: string)` → generált `deleteMention` hívás.
  - `peopleHooks.ts` — a `delM` mintájára:

```typescript
const undoM = useMutation({
  mutationFn: async (m: Mention) => {
    if (mock) { mockUndoMention(qc, m.id); return }
    await peopleApi.deleteMention(m.person_id, m.id)
  },
  onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }),
})
// return blokkba: undoMention: (m: Mention) => undoM.mutate(m),

function mockUndoMention(qc: QueryClient, mentionId: string) {
  qc.setQueryData<PeopleBootstrap>(PEOPLE_KEY, (old) => {
    const base = old ?? MOCK_PEOPLE
    return { ...base, mentions: base.mentions.filter(m => m.id !== mentionId) }
  })
}
```

  - `people.ts` mock seed: vegyél fel EGY automata mentiont a meglévő seed-sorok stílusában — `source: 'text'`, NINCS `tone` mező, `sourceRefKind: 'journal_entry'`, valamelyik seed-személyre, magyar idézettel (pl. „Ádámmal átbeszéltük a hétvégi túrát.”).
  - `handlers.ts` (MSW): `http.delete('*/api/people/:personId/mentions/:mentionId', ...)` → 204, a handler-fájl meglévő in-memory people-state mintájára (a mention kerüljön ki a bootstrap-válaszból).
  - `MentionRow.tsx`: (a) `sourceIconFor` kap `case 'chat': return 'me'` ágat; (b) új opcionális prop `onUndo?: (mention: Mention) => void`; a `ppl-mtop` sor végére, CSAK ha `onUndo` van ÉS (`mention.source === 'text' || mention.source === 'chat'`):

```tsx
<button type="button" className="ppl-mundo" aria-label="Említés visszavonása"
        onClick={() => onUndo(mention)}>✕</button>
```

  (Stílus: a page CSS-fájljában, ahol a `.ppl-mrowt` él, vegyél fel egy diszkrét `.ppl-mundo` szabályt a meglévő tokenekkel — kis, halvány, jobbra igazított gomb; kövesd a fájl meglévő muted-gomb mintáit. A ✕ szövegkarakter itt elfogadott — a clay-készletben van `close`/`x` ikon? Ellenőrizd az `IconName` uniót: ha van `close` vagy `x` nevű ikon, HASZNÁLD azt `<Icon name=... size={10} />`-zel, mert a ház szabálya a clay-ikonográfia.)
  - `PeoplePage.tsx`: `const { people, mentions, logMention, undoMention } = usePeople()`; `<MentionRow ... onUndo={undoMention} />`.

- [ ] **Step 4: Kapu zöldre.**

Run: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build OK, mindkét mód zöld.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src api/
git commit -m "feat(fe): automata mention forrás-jelzés + visszavonás a people feedben (mezo-06o0.1)"
```

---

### Task 6: Doksi + CODEMAP + ArchUnit + teljes fókuszált kapu

**Files:**
- Modify: `docs/features/me.md` (People szakasz)
- Modify: `docs/CODEMAP.md` (regenerálás)
- Test: futtatások (nincs új tesztfájl)

**Interfaces:**
- Consumes: az összes előző task eredménye.
- Produces: merge-kész branch.

- [ ] **Step 1: `docs/features/me.md`** People-szakaszának frissítése: az S2 valóság — automata mention-detektálás forrásai és kapuzása (PEOPLE_SWITCH ∧ forrás-switch), tone=NULL amíg az S4 éjszakai kör nem tölti, dedup-kulcs és a ✕ visszavonás fel-nem-támadási szabálya, a `MentionDetectionService` szóhatár-szemantikája (magyar ragok). A doksi-fájl meglévő szerkezetét kövesd; "LLM-filled" ígéretet NE írj (az S4 dolga).

- [ ] **Step 2: CODEMAP regenerálás** — a repo szokásos codemap-parancsával (nézd meg: `scripts/` vagy a `docs/CODEMAP.md` fejléce mondja meg a generátort; az S1 ugyanígy regenerálta).

- [ ] **Step 3: ArchUnit + fókuszált teljes kör.**

Run: `cd backend && ./mvnw test -Dtest='io.mrkuhne.mezo.ArchitectureTest,PeopleContractIT,MentionDetectionServiceIT,MentionDetectionListenerIT,MentionDetectionSwitchOffIT,ChatMentionListenerIT,NoteMentionCatchUpIT,JournalEmbeddingEventIT,TurnEmbeddingListenerIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -10`
Expected: PASS mindenhol. Ha az ArchitectureTest frozen-store diffet jelez, ELŐSZÖR `git status`-szal ellenőrizd a `backend/src/test/resources/archunit-store` állapotát (flaky-compile korrupció ellen `git checkout --`), és csak valódi új él esetén állj meg — új ciklus TILOS, a terv élei ciklusmentesek.

- [ ] **Step 4: FE kapu még egyszer** (regen-drift ellen): `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test` — zöld.

- [ ] **Step 5: Commit.**

```bash
git add docs/
git commit -m "docs(me): Emberek S2 — automata mention-detektálás dokumentálása + codemap (mezo-06o0.1)"
```

---

## Kifejezett terv-döntések (reviewer-nek)

1. **Listener-elhelyezés az él-térkép szerint**: journal/reflexió-leg a `feature/people`-ben (új people→journal, people→ritual élek — ellenőrzötten ciklusmentesek), chat-leg és jegyzet-sweep a `feature/companion`-ban (companion→people él már létezik; people→companion ciklust zárna a FreezingArchRule alatt).
2. **Szó-eleji illeszkedés, szabad szóvég**: a magyar ragozás ("Ádámmal", "Rékának") miatt a needle csak szóhatáron KEZDŐDJÖN; min. 3 karakteres needle a zaj ellen.
3. **✕ nem támad fel**: a dedup-ellenőrzés natív SQL-lel a soft-deleted sort is látja — a forrás újramentése nem hozza vissza a visszavont automata mentiont.
4. **Chat: csak a user szövege** matchelődik, ref = `userMessageId`.
5. **Jegyzet-ts = occurredOn napkezdet**, hogy az első sweep ne árassza el "mai" említésekkel a feedet.
6. **A spec §3.2 "minden narratív forrás" követelménye teljes**: napló+hála+döntés (esemény), reflexió (esemény), chat (esemény), activity_note+checkin_note (nightly sweep a NarrativeNoteSource porton).
