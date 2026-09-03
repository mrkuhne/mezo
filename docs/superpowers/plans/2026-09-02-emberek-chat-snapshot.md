# Emberek a chat kontextus-pillanatképben — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A companion chat rendszerpromptja kapjon egy `[Emberek]` blokkot — az aktív emberi kör név · kapcsolat · e heti említésszám · hangulat-irány sorokkal —, hogy egy említett nevet felismerjen és óvatosan utaljon rá, de magától sose hozza szóba.

**Architecture:** Két oldal, egy irányú él. A `people` oldalon egy új, tiszta olvasó (`PeopleService.chatContext`) ad lapos `PersonChatContext` rekordokat csak az aktív személyekről, a bootstrap heti-szám és `PersonAffectTrendCalculator` képletével. A `companion` oldalon egy új `PeopleSnapshotBlock` service rendereli belőle a blokkot (cap a `CompanionProperties.Snapshot.peopleMaxPersons`-ból, IDENT-3 hibaelnyelés), és a `ContextSnapshotAssembler.render` fűzi be a `[Napi gyakorlat]` után — a `renderWithoutBiometrics` (reggeli üzenet) NEM. A `SYSTEM_PROMPT` egy grounding-bekezdést kap. Nincs új port, nincs új ArchUnit-él: `companion → people` már létezik.

**Tech Stack:** Spring Boot 4 / Hibernate 7, Lombok, ArchUnit, JUnit 5 + Mockito + Testcontainers. FE nem érintett.

**Spec:** `docs/superpowers/specs/2026-09-02-emberek-chat-snapshot-design.md`. **bd:** `mezo-x6oa`.

## Global Constraints

Ezek MINDEN taskra érvényesek, külön említés nélkül is.

- **Munkakönyvtár:** `.claude/worktrees/emberek-section-development-d4aa89`, branch `feat/emberek-chat-snapshot`. SOSEM `cd` a primary repóba (`/Users/mrkuhne/Applications/Personal/Mezo/mezo`) — az a mainen ül. A bash cwd egy korábbi `cd` után elcsúszhat: minden parancsot abszolút úttal vagy `cd <worktree>`-vel indíts.
- **Backend teszt MINDIG** `-Dmezo.test.use-testcontainers=true`. Soha ne fusson két `mvnw` egyszerre.
- **Hibadoktrína (IDENT-3):** a snapshot a `ChatService.prepareTurn` tranzakciójában épül — a blokk SOSEM dobhat, SOSEM teheti rollback-only-vá a tranzakciót; hiba → `log.warn` + `[Emberek] nincs adat`. Nyers `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` a `techcore`-on kívül TILOS.
- **Rétegszabályok (ArchUnit):** `@Service` csak `..service..`-ben. `companion → people` LÉTEZIK (`ChatMentionListener`, `PersonGraphEdgeAdapter`); `people → companion` TILOS — a `feature/people` alatt semmilyen `feature.companion` import nem jelenhet meg. A `feature_slices_are_cycle_free` FreezingArchRule azonnal bukik rá.
- **Kapcsolók:** `PEOPLE_SWITCH` (`mezo.feature.people.enabled`) független a `COMPANION_SWITCH`-től → a companion oldal `ObjectProvider<PeopleService>` + `getIfAvailable()`-lel olvas (a `HabitService`/`TodayQuestSource` precedens), sosem bare injektálással.
- **Becsületes állapotok (ADR 0010):** hiányzó adat → `nincs adat`; kitalált tartalom sosem. Nyers idézet, `knownFacts`, `notes`, `contactCadenceLabel` SOSEM kerül a blokkba. Jelölt (`candidate`) és archivált személy egyetlen ágon sem.
- **Formátum (spec §4.3), szó szerint:** fejléc `[Emberek] (aktív kör, utolsó említés szerint, max N)`; sor `<név> — <relationshipHu> · <heti> · <irány>`; `<heti>` = `k× e héten` ha k>0, különben `e héten nem került szóba`; `<irány>` = `up` → `felfelé (<indok>)`, `down` → `lefelé (<indok>)`, `flat` → `<indok>` önmagában; `null` indoknál `felfelé`/`lefelé`/`kiegyensúlyozott`.
- **Konfig:** `mezo.companion.snapshot.people-max-persons`, `@Min(0) @Max(30)`, alap **12**; `0` → a blokk teljesen elmarad (üres string, plusz sortörés nélkül).
- **Tiszta számítás:** a `today` PARAMÉTER a kalkulátornak; a heti ablak a bootstrap képlete (`Instant.now().minus(WEEK)`), hogy a két hely sose térjen el.
- **bd:** a driving issue `mezo-x6oa`; a commit-subjectek hordozzák: `feat(be): ... (mezo-x6oa)`. Commit-body vége: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Docs-kapu:** `node scripts/lint-docs.mjs --errors-only` (a bare forma a pre-existing stale baseline miatt bukik — sosem „javítunk" idegen dokumentumot emiatt). CODEMAP: `node scripts/gen-codemap.mjs` az új osztályok után.
- **Fókuszált backend-kapu (a végén):** `-Dtest='PeopleChatContextIT,PeopleMezoNoteIT,PeopleContractIT,PeopleSnapshotBlockTest,ContextSnapshotAssemblerIT,CompanionPropertiesIT,GeminiCompanionLlmPromptOrderTest,ArchitectureTest'`.

---

## File Structure

**Backend — új:**
- `feature/people/service/PersonChatContext.java` — a chat-kontextus egy sora, lapos rekord (nincs entity, nincs DTO).
- `feature/companion/service/PeopleSnapshotBlock.java` — `@Service`, COMPANION_SWITCH; az `[Emberek]` blokk renderelése, cap, IDENT-3.
- Tesztek: `feature/people/PeopleChatContextIT.java` (Testcontainers, service-szint), `feature/companion/PeopleSnapshotBlockTest.java` (tiszta Mockito unit — a spec §6 `PeopleSnapshotBlockIT` eseteit fedi, Spring-kontextus nélkül, mert a hiány/kivétel ágak így determinisztikusan állíthatók elő), a `ContextSnapshotAssemblerIT` és a `CompanionPropertiesIT` bővítése.

**Backend — módosítás:**
- `feature/people/service/PeopleService.java` — `chatContext` + a heti-szám/trend számítás közös privát segédfüggvénybe.
- `feature/companion/config/CompanionProperties.java` — `Snapshot.peopleMaxPersons`.
- `backend/src/main/resources/application.yml` — `people-max-persons: 12`.
- `backend/src/test/java/.../companion/llm/GeminiCompanionLlmPromptOrderTest.java:95` — a `new Snapshot(7, 200, 180)` konstruktor 4-argumentumúra.
- `feature/companion/service/ContextSnapshotAssembler.java` — `PeopleSnapshotBlock` bekötése a `render`-be.
- `feature/companion/service/ChatService.java` — `SYSTEM_PROMPT` `[Mit szabad állítani]` bekezdés.
- `docs/features/companion.md`, `docs/features/me.md`, `docs/CODEMAP.md`.

---

### Task 1: `PersonChatContext` + `PeopleService.chatContext`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonChatContext.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java` (a `getBootstrap` L62–107 környéke; új publikus metódus a `derivedMezoNote` előtt)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleChatContextIT.java`

**Interfaces:**
- Consumes: `PersonRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(UUID)`, `MentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(UUID)`, `PersonAffectTrendCalculator.calculate(List<MentionEntity>, LocalDate) → PersonAffectTrend(readings, startWeek, direction, reason)`; `PersonEntity.getStatus()` (`candidate|active|archived`), `getRelationshipHu()`; `MentionEntity.getTs()`.
- Produces (Task 2 erre épít):
  ```java
  package io.mrkuhne.mezo.feature.people.service;
  public record PersonChatContext(String name, String relationshipHu, int mentionsThisWeek,
      Instant lastMentionAt /*nullable*/, String direction /*up|down|flat*/, String directionReason /*nullable*/) {}

  // PeopleService
  @Transactional(readOnly = true)
  public List<PersonChatContext> chatContext(UUID userId, LocalDate today)
  ```
  Rendezés: `lastMentionAt` csökkenő, `null` a végén, azon belül név szerint növekvő. Nincs limit.

- [ ] **Step 1: Írd meg a bukó IT-t**

```java
package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.people.service.PersonChatContext;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-x6oa: a chat kontextus-pillanatkép people-oldali olvasója — csak aktív személyek, utolsó
 * említés szerint, a bootstrap heti-szám/irány képletével. Service-level, a
 * {@code PeopleMezoNoteIT} idiómája: fresh user per teszt, {@code @Transactional}, HTTP nélkül.
 */
@Transactional
class PeopleChatContextIT extends AbstractIntegrationTest {

    @Autowired private PeopleService peopleService;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private PersonRepository personRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testChatContext_shouldReturnOnlyActivePersons_whenCandidateAndArchivedExist() {
        UUID owner = userPopulator.createUser("owner-chatctx-status@test.hu").getId();
        personPopulator.createPerson(owner, "Anna");
        personPopulator.createCandidate(owner, "Jelölt Jenő", "extractor");
        PersonEntity archived = personPopulator.createPerson(owner, "Archivált Ágnes");
        archived.setStatus("archived");
        personRepository.saveAndFlush(archived);

        List<PersonChatContext> ctx = peopleService.chatContext(owner, LocalDate.now());

        assertThat(ctx).extracting(PersonChatContext::name).containsExactly("Anna");
        assertThat(ctx.getFirst().relationshipHu()).isEqualTo("Mentee · teszt");
    }

    @Test
    void testChatContext_shouldOrderByLastMentionDesc_withUnmentionedLastByName() {
        UUID owner = userPopulator.createUser("owner-chatctx-order@test.hu").getId();
        PersonEntity zita = personPopulator.createPerson(owner, "Zita");
        PersonEntity bela = personPopulator.createPerson(owner, "Béla");
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        personPopulator.createPerson(owner, "Néma Nóra");
        personPopulator.createPerson(owner, "Csendes Csaba");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(3)), "positive");
        mentionPopulator.createMention(owner, zita.getId(), now.minus(Duration.ofHours(1)), "positive");
        mentionPopulator.createMention(owner, bela.getId(), now.minus(Duration.ofDays(1)), "neutral");

        List<PersonChatContext> ctx = peopleService.chatContext(owner, LocalDate.now());

        assertThat(ctx).extracting(PersonChatContext::name)
            .containsExactly("Zita", "Béla", "Anna", "Csendes Csaba", "Néma Nóra");
        assertThat(ctx.get(3).lastMentionAt()).isNull();
        assertThat(ctx.get(3).mentionsThisWeek()).isZero();
    }

    @Test
    void testChatContext_shouldCountOnlyLastSevenDays_andSkipDeletedMentions() {
        UUID owner = userPopulator.createUser("owner-chatctx-week@test.hu").getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(1)), "positive");
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(6)), "positive");
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(9)), "positive");
        MentionEntity deleted = mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofHours(2)), "negative");
        mentionRepository.delete(deleted); // @SQLDelete → soft delete
        mentionRepository.flush();

        List<PersonChatContext> ctx = peopleService.chatContext(owner, LocalDate.now());

        assertThat(ctx).hasSize(1);
        assertThat(ctx.getFirst().mentionsThisWeek()).isEqualTo(2);
        assertThat(ctx.getFirst().lastMentionAt()).isEqualTo(now.minus(Duration.ofDays(1)).truncatedTo(java.time.temporal.ChronoUnit.MICROS));
    }

    @Test
    void testChatContext_shouldAgreeWithBootstrapDirection_forTheSameMentions() {
        UUID owner = userPopulator.createUser("owner-chatctx-dir@test.hu").getId();
        PersonEntity bence = personPopulator.createPerson(owner, "Bence");
        Instant now = Instant.now();
        // 4 hét: két jó, majd két nehéz hét → a kalkulátor 'down'-t ad
        mentionPopulator.createMention(owner, bence.getId(), now.minus(Duration.ofDays(24)), "positive");
        mentionPopulator.createMention(owner, bence.getId(), now.minus(Duration.ofDays(17)), "positive");
        mentionPopulator.createMention(owner, bence.getId(), now.minus(Duration.ofDays(10)), "negative");
        mentionPopulator.createMention(owner, bence.getId(), now.minus(Duration.ofDays(3)), "negative");

        List<PersonChatContext> ctx = peopleService.chatContext(owner, LocalDate.now());
        PeopleResponse bootstrap = peopleService.getBootstrap(owner);
        PersonResponse fromBootstrap = bootstrap.getPersons().getFirst();

        assertThat(ctx.getFirst().direction()).isEqualTo(fromBootstrap.getDirection().getValue());
        assertThat(ctx.getFirst().directionReason()).isEqualTo(fromBootstrap.getDirectionReason());
        assertThat(ctx.getFirst().mentionsThisWeek()).isEqualTo(fromBootstrap.getMentionsThisWeek());
    }

    @Test
    void testChatContext_shouldReturnEmptyList_whenUserHasNoPerson() {
        UUID owner = userPopulator.createUser("owner-chatctx-empty@test.hu").getId();

        assertThat(peopleService.chatContext(owner, LocalDate.now())).isEmpty();
    }
}
```

Megjegyzés a `lastMentionAt` assertre: a Postgres `timestamptz` mikroszekundumra vág; ha az `isEqualTo` emiatt bukna, az `isCloseTo(now.minus(Duration.ofDays(1)), within(1, ChronoUnit.MILLIS))` forma is elfogadott — a lényeg, hogy a LEGFRISSEBB nem törölt említés ideje jöjjön vissza.

A `PeopleResponse.getPersons()` a kontraktus `persons` mezője (`api/feature/people/people.yml:237`).

- [ ] **Step 2: Futtasd — bukjon fordítási hibával**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89/backend && ./mvnw -q test -Dtest=PeopleChatContextIT -Dmezo.test.use-testcontainers=true 2>&1 | tail -20
```
Expected: COMPILATION ERROR — `PersonChatContext` / `chatContext` nem létezik.

- [ ] **Step 3: A rekord**

```java
package io.mrkuhne.mezo.feature.people.service;

import java.time.Instant;

/**
 * Egy személy sora a companion chat kontextus-pillanatképéhez (mezo-x6oa). Lapos, számított
 * mezők — pontosan az, amit a rendszerprompt megkaphat: nyers idézet, ismert tények, jegyzet
 * SOSEM utazik itt (a spec §4.3 „felismerés + óvatos utalás" határa).
 *
 * @param name             a személy neve
 * @param relationshipHu   magyar kapcsolat-címke (pl. „barát")
 * @param mentionsThisWeek említések száma az elmúlt 7 napban (a bootstrap képlete)
 * @param lastMentionAt    a legfrissebb nem törölt említés ideje; {@code null}, ha sosem került szóba
 * @param direction        {@code up} | {@code down} | {@code flat} ({@link PersonAffectTrend})
 * @param directionReason  magyar indoklás; {@code null}, ha nincs olvasat
 */
public record PersonChatContext(String name, String relationshipHu, int mentionsThisWeek,
    Instant lastMentionAt, String direction, String directionReason) {}
```

- [ ] **Step 4: `chatContext` a `PeopleService`-ben + közös segéd**

A `getBootstrap` lambdájában ma inline van a heti szám és a trend. Emeld ki egy privát segédbe, és használd mindkét helyen (a bootstrap viselkedése változatlan marad):

```java
    /** A bootstrap és a chat-kontextus KÖZÖS heti számítása — a két hely sosem térhet el. */
    private record WeekStats(int mentionsThisWeek, Instant lastMentionAt, PersonAffectTrend trend) {}

    private WeekStats weekStats(List<MentionEntity> ownTsDesc, Instant weekAgo, LocalDate today) {
        int thisWeek = (int) ownTsDesc.stream().filter(m -> !m.getTs().isBefore(weekAgo)).count();
        Instant lastAt = ownTsDesc.isEmpty() ? null : ownTsDesc.getFirst().getTs(); // list is ts-desc
        return new WeekStats(thisWeek, lastAt, affectTrendCalculator.calculate(ownTsDesc, today));
    }
```

A `getBootstrap` lambdájában:

```java
                List<MentionEntity> own = byPerson.getOrDefault(p.getId(), List.of());
                WeekStats stats = weekStats(own, weekAgo, LocalDate.now());
                PersonResponse response = mapper.toPersonResponse(p, own.size(), stats.mentionsThisWeek(), stats.lastMentionAt());
                // ... graphEdges változatlan ...
                response.setAffectTrend(stats.trend().readings());
                response.setAffectTrendStart(stats.trend().startWeek());
                response.setDirection(PersonResponse.DirectionEnum.fromValue(stats.trend().direction()));
                response.setDirectionReason(stats.trend().reason());
```

Az új publikus metódus (a `derivedMezoNote` elé):

```java
    /**
     * A companion chat kontextus-pillanatképének people-oldali olvasója (mezo-x6oa): CSAK aktív
     * személyek (jelölt és archivált soha — a proaktív felületek ugyanígy), utolsó említés szerint
     * csökkenő, a sosem említettek a végén név szerint. Nincs limit — a cap a fogyasztó
     * (companion, {@code snapshot.people-max-persons}) döntése. A heti szám és az irány a
     * {@link #getBootstrap} képlete ({@link #weekStats}), tehát a chat és az Emberek hub sosem
     * mond mást ugyanarról a személyről. Csak olvas.
     */
    @Transactional(readOnly = true)
    public List<PersonChatContext> chatContext(UUID userId, LocalDate today) {
        List<PersonEntity> persons = personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId);
        if (persons.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<MentionEntity>> byPerson = mentionRepository
            .findAllByCreatedByAndDeletedFalseOrderByTsDesc(userId).stream()
            .collect(Collectors.groupingBy(MentionEntity::getPersonId));
        Instant weekAgo = Instant.now().minus(WEEK);
        return persons.stream()
            .filter(p -> STATUS_ACTIVE.equals(p.getStatus()))
            .map(p -> {
                WeekStats stats = weekStats(byPerson.getOrDefault(p.getId(), List.of()), weekAgo, today);
                return new PersonChatContext(p.getName(), p.getRelationshipHu(), stats.mentionsThisWeek(),
                    stats.lastMentionAt(), stats.trend().direction(), stats.trend().reason());
            })
            .sorted(Comparator.comparing(PersonChatContext::lastMentionAt,
                    Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(PersonChatContext::name))
            .toList();
    }
```

Konstans a `WEEK` mellé: `private static final String STATUS_ACTIVE = "active";` — a fájlban ma csak egy literál van (`decidePerson`, `p.setStatus("active")`, ~L241): azt is cseréld a konstansra, hogy egy helyen éljen.

- [ ] **Step 5: Futtasd az új IT-t + a people-kaput**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89/backend && ./mvnw -q test -Dtest='PeopleChatContextIT,PeopleMezoNoteIT,PeopleContractIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -30
```
Expected: mind zöld (a bootstrap-refaktor a `PeopleContractIT`/`PeopleMezoNoteIT` állításain nem változtat).

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89 && git add backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonChatContext.java backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleChatContextIT.java && git commit -m "feat(be): PeopleService.chatContext — aktív kör lapos sorai a chat pillanatképhez (mezo-x6oa)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `Snapshot.peopleMaxPersons` + `PeopleSnapshotBlock`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:56-69` (`Snapshot` rekord)
- Modify: `backend/src/main/resources/application.yml:435-443` (`snapshot:` szakasz)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmPromptOrderTest.java:95`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java:27-30`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PeopleSnapshotBlock.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PeopleSnapshotBlockTest.java`

**Interfaces:**
- Consumes (Task 1): `PeopleService.chatContext(UUID, LocalDate) → List<PersonChatContext>`; `PersonAffectTrend.DIRECTION_UP/DOWN/FLAT`.
- Produces (Task 3 erre épít):
  ```java
  package io.mrkuhne.mezo.feature.companion.service;
  @Service @ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
  public class PeopleSnapshotBlock {
      static final String HEADER_PREFIX = "[Emberek]";
      /** "" ha peopleMaxPersons == 0; különben a teljes blokk, sortörés NÉLKÜL a végén. */
      public String render(UUID userId, LocalDate today)
  }
  ```
  és `CompanionProperties.Snapshot(int digestDays, int checkinNoteMaxChars, int workoutNoteMaxChars, int peopleMaxPersons)`.

- [ ] **Step 1: Konfig-mező + yml + a két meglévő teszt**

`CompanionProperties.Snapshot` — a `workoutNoteMaxChars` után:

```java
        @Min(0) @Max(1000) int workoutNoteMaxChars,
        /**
         * mezo-x6oa: how many ACTIVE people (newest mention first) the [Emberek] block of the chat
         * snapshot lists — name, relationship, this week's mention count and mood direction, one
         * line each, never quotes. 0 turns the block off entirely (it is omitted, not "nincs adat").
         */
        @Min(0) @Max(30) int peopleMaxPersons
    ) {}
```

`application.yml` a `workout-note-max-chars: 180` után:

```yaml
      # mezo-x6oa: how many active people the [Emberek] chat-snapshot block lists (newest mention
      # first; name · relationship · this week's count · mood direction). 0 = the block is omitted.
      people-max-persons: 12
```

`GeminiCompanionLlmPromptOrderTest.java:95`: `new Snapshot(7, 200, 180)` → `new Snapshot(7, 200, 180, 12)`.

`CompanionPropertiesIT.testSnapshotConfig_shouldBindWindowsFromYaml_whenContextStarts` bővítése:

```java
        assertThat(properties.snapshot().peopleMaxPersons()).isEqualTo(12);
```

- [ ] **Step 2: Írd meg a bukó unit tesztet**

Tiszta Mockito — a Spring Boot test starter hozza a Mockito 5-öt (inline mock maker: a `CompanionProperties` rekord mockolható). Nem IT: a „bean hiányzik" és a „forrás kivételt dob" ágakat így lehet determinisztikusan előállítani.

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.service.PeopleSnapshotBlock;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.people.service.PersonChatContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;

/**
 * mezo-x6oa: az [Emberek] blokk renderelése — formátum, cap, becsületes hiány, IDENT-3. Tiszta
 * unit (Mockito): a PEOPLE_SWITCH-off (bean hiányzik) és a forrás-hiba ág itt determinisztikus.
 */
class PeopleSnapshotBlockTest {

    private static final UUID USER = UUID.randomUUID();
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 2);

    @SuppressWarnings("unchecked")
    private final ObjectProvider<PeopleService> provider = mock(ObjectProvider.class);
    private final PeopleService peopleService = mock(PeopleService.class);
    private final CompanionProperties properties = mock(CompanionProperties.class);
    private PeopleSnapshotBlock block;

    @BeforeEach
    void setUp() {
        when(provider.getIfAvailable()).thenReturn(peopleService);
        withMax(12);
        block = new PeopleSnapshotBlock(provider, properties);
    }

    private void withMax(int max) {
        when(properties.snapshot()).thenReturn(new CompanionProperties.Snapshot(7, 200, 180, max));
    }

    private static PersonChatContext row(String name, String rel, int week, String dir, String reason) {
        return new PersonChatContext(name, rel, week, week > 0 ? Instant.parse("2026-09-01T10:00:00Z") : null, dir, reason);
    }

    @Test
    void testRender_shouldRenderHeaderAndOneLinePerPerson_inTheSpecFormat() {
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of(
            row("Bence", "barát", 3, "down", "többször nehéz tónus, mint korábban"),
            row("Réka", "partner", 1, "flat", "kiegyensúlyozott hetek"),
            row("Ádám", "mentorált", 0, "flat", "még kevés hét az irányhoz"),
            row("Dóra", "kolléga", 2, "up", "jobb hetek, mint korábban")));

        String out = block.render(USER, TODAY);

        assertThat(out).isEqualTo("""
            [Emberek] (aktív kör, utolsó említés szerint, max 12)
            Bence — barát · 3× e héten · lefelé (többször nehéz tónus, mint korábban)
            Réka — partner · 1× e héten · kiegyensúlyozott hetek
            Ádám — mentorált · e héten nem került szóba · még kevés hét az irányhoz
            Dóra — kolléga · 2× e héten · felfelé (jobb hetek, mint korábban)""");
    }

    @Test
    void testRender_shouldFallBackToPlainDirectionWord_whenReasonIsNull() {
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of(
            row("Anna", "barát", 0, "flat", null),
            row("Bea", "barát", 1, "up", null),
            row("Cili", "barát", 1, "down", null)));

        String out = block.render(USER, TODAY);

        assertThat(out)
            .contains("Anna — barát · e héten nem került szóba · kiegyensúlyozott")
            .contains("Bea — barát · 1× e héten · felfelé")
            .contains("Cili — barát · 1× e héten · lefelé")
            .doesNotContain("(");
    }

    @Test
    void testRender_shouldCapAtPeopleMaxPersons_keepingSourceOrder() {
        withMax(2);
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of(
            row("Első", "barát", 3, "flat", "kiegyensúlyozott hetek"),
            row("Második", "barát", 2, "flat", "kiegyensúlyozott hetek"),
            row("Harmadik", "barát", 1, "flat", "kiegyensúlyozott hetek")));

        String out = block.render(USER, TODAY);

        assertThat(out).startsWith("[Emberek] (aktív kör, utolsó említés szerint, max 2)\n")
            .contains("Első —").contains("Második —").doesNotContain("Harmadik");
        assertThat(out.lines().count()).isEqualTo(3);
    }

    @Test
    void testRender_shouldRenderNincsAdat_whenNoActivePerson() {
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of());

        assertThat(block.render(USER, TODAY)).isEqualTo("[Emberek] nincs adat");
    }

    @Test
    void testRender_shouldRenderNincsAdat_whenPeopleBeanIsAbsent() {
        when(provider.getIfAvailable()).thenReturn(null);

        assertThat(block.render(USER, TODAY)).isEqualTo("[Emberek] nincs adat");
    }

    @Test
    void testRender_shouldRenderNincsAdat_whenSourceThrows() {
        when(peopleService.chatContext(eq(USER), any()))
            .thenThrow(new DataAccessResourceFailureException("boom"));

        assertThat(block.render(USER, TODAY)).isEqualTo("[Emberek] nincs adat");
    }

    @Test
    void testRender_shouldReturnEmptyString_whenMaxIsZero() {
        withMax(0);
        when(peopleService.chatContext(eq(USER), any())).thenReturn(List.of(
            row("Bence", "barát", 3, "down", "többször nehéz tónus, mint korábban")));

        assertThat(block.render(USER, TODAY)).isEmpty();
    }
}
```

- [ ] **Step 3: Futtasd — bukjon fordítási hibával**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89/backend && ./mvnw -q test -Dtest=PeopleSnapshotBlockTest -Dmezo.test.use-testcontainers=true 2>&1 | tail -20
```
Expected: COMPILATION ERROR — `PeopleSnapshotBlock` nem létezik.

- [ ] **Step 4: A blokk**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrend;
import io.mrkuhne.mezo.feature.people.service.PersonChatContext;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * mezo-x6oa: az {@code [Emberek]} blokk a chat kontextus-pillanatképében — az aktív emberi kör,
 * soronként név · kapcsolat · e heti említésszám · hangulat-irány (indok), hogy a companion egy
 * említett nevet felismerjen és óvatosan utaljon rá. Nyers idézet, ismert tény, jegyzet SOSEM
 * kerül ide (a prompt-szabály a {@code ChatService.SYSTEM_PROMPT}-ban tiltja a kitalálást).
 *
 * <p>A {@code companion → people} él már létezik ({@code ChatMentionListener}), ezért közvetlen
 * import; de a PEOPLE_SWITCH független a COMPANION_SWITCH-től, így a {@link PeopleService} bean
 * hiányozhat — {@link ObjectProvider} + {@code getIfAvailable()}, a {@code HabitService}
 * precedens. Csak a chat-variáns hívja ({@code ContextSnapshotAssembler#render}); a reggeli
 * üzenet ({@code renderWithoutBiometrics}) szándékosan nem — az proaktív felhozás lenne.
 *
 * <p>IDENT-3: a pillanatkép a {@code ChatService.prepareTurn} tranzakciójában épül — ez a blokk
 * sosem dob; bármely hiba warn + {@code nincs adat}. A cap ({@code snapshot.people-max-persons})
 * a fogyasztó döntése; {@code 0} → a blokk teljesen elmarad (üres string).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PeopleSnapshotBlock {

    static final String HEADER_PREFIX = "[Emberek]";
    static final String NO_DATA = HEADER_PREFIX + " " + ContextSnapshotAssembler.NO_DATA;

    private final ObjectProvider<PeopleService> peopleService;
    private final CompanionProperties properties;

    /** "" when the block is configured off; otherwise the full block WITHOUT a trailing newline. */
    public String render(UUID userId, LocalDate today) {
        int max = properties.snapshot().peopleMaxPersons();
        if (max == 0) {
            return "";
        }
        try {
            PeopleService service = peopleService.getIfAvailable();
            if (service == null) {
                return NO_DATA;
            }
            List<PersonChatContext> circle = service.chatContext(userId, today);
            if (circle.isEmpty()) {
                return NO_DATA;
            }
            StringBuilder b = new StringBuilder(HEADER_PREFIX)
                .append(" (aktív kör, utolsó említés szerint, max ").append(max).append(')');
            circle.stream().limit(max).forEach(p -> b.append('\n').append(line(p)));
            return b.toString();
        } catch (RuntimeException e) {
            log.warn("[Emberek] block skipped for user {} — the turn continues without it", userId, e);
            return NO_DATA;
        }
    }

    static String line(PersonChatContext p) {
        String week = p.mentionsThisWeek() > 0
            ? p.mentionsThisWeek() + "× e héten"
            : "e héten nem került szóba";
        return p.name() + " — " + p.relationshipHu() + " · " + week + " · " + direction(p);
    }

    private static String direction(PersonChatContext p) {
        String reason = p.directionReason();
        return switch (p.direction()) {
            case PersonAffectTrend.DIRECTION_UP -> reason == null ? "felfelé" : "felfelé (" + reason + ")";
            case PersonAffectTrend.DIRECTION_DOWN -> reason == null ? "lefelé" : "lefelé (" + reason + ")";
            default -> reason == null ? "kiegyensúlyozott" : reason;
        };
    }
}
```

`ContextSnapshotAssembler.NO_DATA` package-private (`static final String NO_DATA = "nincs adat";` L86) — ugyanabban a csomagban vagyunk, olvasható. A `catch (RuntimeException e)` itt elnyelés, nem dobás — az ArchUnit nyers-kivétel szabálya a `throw`-ra vonatkozik, a `GraphPromptAssembler` L91 ugyanezt csinálja.

- [ ] **Step 5: Futtasd a unit tesztet + a két konfig-tesztet**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89/backend && ./mvnw -q test -Dtest='PeopleSnapshotBlockTest,CompanionPropertiesIT,GeminiCompanionLlmPromptOrderTest' -Dmezo.test.use-testcontainers=true 2>&1 | tail -30
```
Expected: mind zöld. Ha a `CompanionProperties` mockolása `Mockito cannot mock this class` hibát ad (nincs inline mock maker), a tesztben építs valódi példányt helyette: a `GeminiCompanionLlmPromptOrderTest.java:80-110` mutatja, hogyan konstruálják a teljes `CompanionProperties`-t — másold át egy `props(int max)` segédbe.

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89 && git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PeopleSnapshotBlock.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/PeopleSnapshotBlockTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmPromptOrderTest.java && git commit -m "feat(be): PeopleSnapshotBlock — [Emberek] blokk renderelése cappel és IDENT-3-mal (mezo-x6oa)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Bekötés az assemblerbe + prompt-szabály

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java:93-135` (mezők + `render`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:82-88` (`[Mit szabad állítani]`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java` (+2 teszt; a `testRender_shouldRenderAllBlocksWithNincsAdat_whenUserHasNoData` bővül)

**Interfaces:**
- Consumes (Task 2): `PeopleSnapshotBlock.render(UUID, LocalDate)` — `""` ha ki van kapcsolva, különben a blokk sortörés nélkül.
- Produces: a `render` kimenetében a `[Napi gyakorlat]` és a `[Mai üzemanyag]` KÖZÖTT az `[Emberek]` blokk; `renderWithoutBiometrics` változatlan.

- [ ] **Step 1: Bővítsd a meglévő üres-adat tesztet és írd meg a két újat**

A `testRender_shouldRenderAllBlocksWithNincsAdat_whenUserHasNoData`-ban a nyolc index után vedd fel a kilencediket, és az `.contains` láncba az abszenciát:

```java
        int gyakorlat = block.indexOf("[Napi gyakorlat]");
        int emberek = block.indexOf("[Emberek]");
        int fuel = block.indexOf("[Mai üzemanyag]");
        // ...
        assertThat(gyakorlat).isGreaterThan(novekedes);
        assertThat(emberek).isGreaterThan(gyakorlat);
        assertThat(fuel).isGreaterThan(emberek);
        // ... és a contains-láncba:
            .contains("[Emberek] nincs adat")
```

A fájl `// all eight blocks present` kommentjét írd át `// all nine blocks present`-re.

Új importok a fájl tetejére: `io.mrkuhne.mezo.support.populator.PersonPopulator`, `io.mrkuhne.mezo.support.populator.MentionPopulator`, `java.time.Duration` (ha még nincs), és a két `@Autowired` mező a többi populator mellé:

```java
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
```

A két új teszt (a fájl végére, a többi `@Test` után):

```java
    /** mezo-x6oa: the chat variant carries the active circle, one line per person, newest mention first. */
    @Test
    void testRender_shouldRenderEmberekBlock_whenActivePersonsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var anna = personPopulator.createPerson(owner, "Anna");
        var zita = personPopulator.createPerson(owner, "Zita");
        personPopulator.createCandidate(owner, "Jelölt Jenő", "extractor");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(2)), "positive");
        mentionPopulator.createMention(owner, zita.getId(), now.minus(Duration.ofHours(1)), "positive");
        mentionPopulator.createMention(owner, zita.getId(), now.minus(Duration.ofDays(1)), "positive");

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("[Emberek] (aktív kör, utolsó említés szerint, max 12)\n"
            + "Zita — Mentee · teszt · 2× e héten · még kevés hét az irányhoz\n"
            + "Anna — Mentee · teszt · 1× e héten · még kevés hét az irányhoz");
        assertThat(snapshot).doesNotContain("Jelölt Jenő").doesNotContain("Teszt említés.");
        assertThat(snapshot.indexOf("[Emberek]")).isGreaterThan(snapshot.indexOf("[Napi gyakorlat]"))
            .isLessThan(snapshot.indexOf("[Mai üzemanyag]"));
    }

    /** The morning message must NOT know the circle — that would be the companion bringing people up unprompted. */
    @Test
    void testRenderWithoutBiometrics_shouldOmitEmberekBlock_evenWhenActivePersonsExist() {
        UUID owner = userPopulator.createUser().getId();
        var anna = personPopulator.createPerson(owner, "Anna");
        mentionPopulator.createMention(owner, anna.getId(), Instant.now(), "positive");

        String morning = assembler.renderWithoutBiometrics(owner, LocalDate.now());

        assertThat(morning).doesNotContain("[Emberek]").doesNotContain("Anna");
    }
```

Az irány-szöveg a fenti tesztben: két személynél egy-egy tónusozott hét → a kalkulátor 1 olvasatot ad, `flat` + „még kevés hét az irányhoz" (a `PersonAffectTrendCalculator` szabálya: ≥3 olvasat kell az irányhoz). Ha az implementer futtatáskor más indokot lát, a KALKULÁTOR az igazság — a teszt-string igazodik, nem a képlet.

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89/backend && ./mvnw -q test -Dtest=ContextSnapshotAssemblerIT -Dmezo.test.use-testcontainers=true 2>&1 | tail -30
```
Expected: 3 bukás — `[Emberek]` sehol.

- [ ] **Step 3: Bekötés az assemblerbe**

`ContextSnapshotAssembler` mezők közé (a `CompanionProperties properties` elé):

```java
    private final PeopleSnapshotBlock peopleSnapshotBlock;
```

`render`:

```java
    public String render(UUID userId, LocalDate today) {
        return HEADER + today + "):\n"
                + profileBlock(userId, today, true) + '\n'
                + goalBlock(userId, today) + '\n'
                + trainBlock(userId, today) + '\n'
                + growthBlock(userId, today) + '\n'
                + practiceBlock(userId, today) + '\n'
                + peopleLine(userId, today)
                + fuelBlock(userId, today) + '\n'
                + medicationBlock(userId, today) + '\n'
                + recoveryBlock(userId, today, true);
    }

    /**
     * mezo-x6oa: the [Emberek] block ({@link PeopleSnapshotBlock}) — CHAT variant only. The
     * morning message ({@link #renderWithoutBiometrics}) deliberately never sees the circle:
     * that would be the companion bringing people up unprompted. "" when configured off, so no
     * stray blank line is left behind.
     */
    private String peopleLine(UUID userId, LocalDate today) {
        String block = peopleSnapshotBlock.render(userId, today);
        return block.isEmpty() ? "" : block + '\n';
    }
```

A `render` Javadocját (ha van a metódus fölött) egészítsd ki: „nine blocks" / `[Emberek]` a `[Napi gyakorlat]` után. `renderWithoutBiometrics` NEM változik — a Javadocjába egy mondat: „and never the [Emberek] block (mezo-x6oa)".

- [ ] **Step 4: Prompt-szabály a `SYSTEM_PROMPT`-ban**

`ChatService.SYSTEM_PROMPT`, a `[Mit szabad állítani]` szakasz utolsó sora (`Ha valamit nem tudsz, mondd ki őszintén, hogy nem tudod.`) UTÁN, még a `[Példa a hangnemre]` üres sora előtt:

```java
            Ha valamit nem tudsz, mondd ki őszintén, hogy nem tudod.
            Az [Emberek] sorai Daniel emberi köre: ha egy nevet említ, onnan tudod, ki ő (kapcsolat) \
            és hogyan áll most (e heti említés, hangulat-irány). Ennyit mondhatsz róluk, mást nem: \
            harmadik félről eseményt, tulajdonságot, véleményt nem találsz ki. Magadtól ne hozd szóba \
            őket — csak ha Daniel említi, vagy a téma egyértelműen róluk szól.
```

(A text block `\` sorvég-folytatását a meglévő sorok mintájára használd.)

- [ ] **Step 5: Futtasd az assembler IT-t + a companion-kaput**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89/backend && ./mvnw -q test -Dtest='ContextSnapshotAssemblerIT,ChatServiceIT,GeminiCompanionLlmPromptOrderTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true 2>&1 | tail -30
```
Expected: mind zöld. Ha az `ArchitectureTest` bukik: ellenőrizd, hogy `feature/people` alatt NINCS `feature.companion` import (Task 1 nem hozhatott be), és hogy a freeze-store fájl nem lett 0 bájtos (`git status backend/src/test/resources/archunit-store/` — ha igen, `git checkout -- backend/src/test/resources/archunit-store/` és újra).

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89 && git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java && git commit -m "feat(be): [Emberek] blokk a chat pillanatképben + grounding-szabály a rendszerpromptban (mezo-x6oa)

Csak a chat-variáns; a reggeli üzenet (renderWithoutBiometrics) szándékosan nem
kapja meg az emberi kört.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Docs + CODEMAP + fókuszált kapu

**Files:**
- Modify: `docs/features/companion.md` (V0.3 snapshot-bekezdés ~L57-68; a `snapshot.*` konfig-lista ~L2914-2920; az „Emberek S5" szakasz ~L2126 után új „Emberek a chat pillanatképben" alszakasz)
- Modify: `docs/features/me.md:590` (§9 „People backend" döntés (4))
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:** nincs kód.

- [ ] **Step 1: `companion.md`**

(a) A V0.3 bekezdésben (`ContextSnapshotAssembler` felsorolás, ~L59-68) az „eight Hungarian-labelled blocks" → „nine Hungarian-labelled blocks", és a felsorolásba a „today's quest count + habit chains + creed/foci/reflection + napzárás state" után: „the active people circle (`[Emberek]`, **mezo-x6oa**, chat variant only)".

(b) A `snapshot.*` konfig-listába (~L2918 után):

```markdown
- `mezo.companion.snapshot.people-max-persons` = **12** (`@Min(0) @Max(30)`) — how many ACTIVE
  people the `[Emberek]` chat-snapshot block lists (newest mention first). `0` omits the block.
```

(c) Új alszakasz az „Emberek S5 — gráf-tükör" szakasz UTÁN (szerkezetében ugyanaz a `###` szint):

```markdown
### Emberek a chat pillanatképben (✅ `mezo-x6oa`)

Spec: [`2026-09-02-emberek-chat-snapshot-design.md`](../superpowers/specs/2026-09-02-emberek-chat-snapshot-design.md).
Until this slice the companion chat knew nothing of the user's people — names only leaked in
opportunistically through the `[Összefüggések]` graph block, for graph-promoted persons, with no
weekly direction. Now every CHAT turn's snapshot carries an **`[Emberek]`** block:

- **`PeopleService.chatContext(userId, today)`** (`feature/people/service`, read-only) — flat
  `PersonChatContext(name, relationshipHu, mentionsThisWeek, lastMentionAt, direction,
  directionReason)` rows for ACTIVE persons only (candidate/archived never), newest mention
  first, unmentioned last by name, no limit. The weekly count and the direction come from the
  SAME private helper the bootstrap uses, so the chat and the Emberek hub can never disagree.
- **`PeopleSnapshotBlock`** (`feature/companion/service`, COMPANION_SWITCH) renders it:
  header `[Emberek] (aktív kör, utolsó említés szerint, max N)`, one line per person
  `<név> — <kapcsolat> · <k× e héten | e héten nem került szóba> · <felfelé (indok) | lefelé
  (indok) | indok>`, capped at `snapshot.people-max-persons`. `PEOPLE_SWITCH` is independent of
  the companion switch, so the `PeopleService` is read through `ObjectProvider` (the
  `HabitService` precedent) — absent bean, empty circle or any `RuntimeException` all render
  `[Emberek] nincs adat` (IDENT-3: the block never escapes into `prepareTurn`'s transaction);
  `people-max-persons = 0` omits the block entirely. Raw quotes, `knownFacts`, `notes` never ride.
- **Chat variant only:** `ContextSnapshotAssembler.render` inserts it after `[Napi gyakorlat]`;
  `renderWithoutBiometrics` (the morning message) deliberately does not — that would be the
  companion bringing people up unprompted.
- **Grounding rule** in `ChatService.SYSTEM_PROMPT` (`[Mit szabad állítani]`): the model may
  recognise a mentioned name and refer to the relationship and this week's direction, must not
  invent anything else about a third party, and must not raise people on its own.
- No new port, no new slice edge: `companion → people` already existed (`ChatMentionListener`).
- Tests: `PeopleChatContextIT`, `PeopleSnapshotBlockTest`, `ContextSnapshotAssemblerIT`
  (+2: block present in `render`, absent in `renderWithoutBiometrics`), `CompanionPropertiesIT`.
```

- [ ] **Step 2: `me.md` §9 (4)**

A `docs/features/me.md:590` sorában a `**(4)** mentions do NOT feed the companion snapshot (proactive epic);` részt cseréld erre:

```markdown
**(4)** mentions feed the companion CHAT snapshot since `mezo-x6oa` via `PeopleService.chatContext` → the `[Emberek]` block ([`companion.md`](companion.md) „Emberek a chat pillanatképben"); the morning-message variant stays without it;
```

- [ ] **Step 3: CODEMAP + docs-kapu**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89 && node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only 2>&1 | tail -3
```
Expected: CODEMAP frissül (`PersonChatContext`, `PeopleSnapshotBlock` bekerül), `--check` csendes, lint `PASS`.

- [ ] **Step 4: Fókuszált backend-kapu a teljes szeletre**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89/backend && ./mvnw -q test -Dtest='PeopleChatContextIT,PeopleMezoNoteIT,PeopleContractIT,PeopleSnapshotBlockTest,ContextSnapshotAssemblerIT,CompanionPropertiesIT,GeminiCompanionLlmPromptOrderTest,ChatServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true 2>&1 | tail -30
```
Expected: mind zöld.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/emberek-section-development-d4aa89 && git add docs/features/companion.md docs/features/me.md docs/CODEMAP.md && git commit -m "docs: Emberek a chat pillanatképben — companion.md, me.md §9 (4), CODEMAP (mezo-x6oa)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Önellenőrzés (a terv írójától)

- **Spec-lefedettség:** §4.1 → T1; §4.2 + §4.5 → T2; §4.2 assembler-bekötés + §4.3 formátum + §4.4 prompt → T2/T3; §5 táblázat minden sora → T2 unit-esetek + T3 IT; §6 tesztlista → T1/T2/T3 (a `PeopleSnapshotBlockIT` unit tesztként, azonos esetekkel — szándékos, indokolva a File Structure-ben); §7 docs → T4. ArchUnit a T3 és T4 kapuban.
- **Típus-konzisztencia:** `PersonChatContext(name, relationshipHu, mentionsThisWeek, lastMentionAt, direction, directionReason)` T1-ben definiálva, T2 tesztjében és renderelőjében ugyanez a sorrend; `Snapshot(digestDays, checkinNoteMaxChars, workoutNoteMaxChars, peopleMaxPersons)` T2-ben, a `GeminiCompanionLlmPromptOrderTest` 4-arg hívása ugyanez; `PeopleSnapshotBlock.render(UUID, LocalDate)` T2 → T3.
- **Placeholder:** nincs.
