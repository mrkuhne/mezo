# Csapat-üzenőfal · II. felvonás („A hang” — az esti kiadás) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Esténként 21:00-kor a csapat 3–6 válogatott, karakterhangú posztot tesz ki a falra (az „esti kiadás”), minden forrásból (konzílium, minták, előrejelzések, kísérletek, Falat étkezés-értékelés, Derű adatkérés), kitalált szám nélkül.

**Architecture:** A `character` feature új `TeamEdition*` rétege a napi konzílium UTÁN fut (`CharacterCouncilJob`), repository-olvasással determinisztikus jelölteket gyűjt, tiszta függvénnyel válogat, két új táblába publikál, egy `GET /api/character/edition` végponton ad ki; a FE fal a kiadás-napokon ezt mutatja, egyébként az I. felvonás buildere fut. A hang (H3) egyetlen LLM-hívás kiadásonként, tény-őrrel; H4 vendég-hozzászólásokat, H5 két új jelöltforrást ad.

**Tech Stack:** Spring Boot + JPA + Liquibase (Postgres, jsonb), contract-first OpenAPI (`api/feature/*.yml`), JUnit5/AssertJ + Testcontainers ITs, `FakeCompanionLlm` (profil `companion-fake`); React + TS + TanStack Query (`useDualQuery`), vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-csapatfal-act2-esti-kiadas-design.md` (owner-jóváhagyott 2026-09-24; ahol a szülő-spec eltér, ez nyer).

## Global Constraints

- **3–6 poszt kiadásonként; 21:00 Europe/Budapest; nevek véglegesek:** Szunya · Mocor · Falat · Derű · Mezo (+ Szkeptikus, aki SOSEM posztol).
- **Csendes nap:** < 3 fő jelölt → feltöltés `sejtes`(gyűlik)/`keres` jelöltekkel 3-ig; ha így is kevesebb, annyi (akár 0). Kitalált/töltelék poszt SOHA (ADR 0049).
- **Tény-őr:** a hangos szövegben csak a `facts[]`/`recordText` számai szerepelhetnek; bukás → `voiced=false`, `body = recordText`.
- **Névütközés-tilalom:** a meglévő `character_council_edition` a konzílium lease-sora. Az új dolgok neve MINDIG `team_edition*` (tábla) / `TeamEdition*` (osztály).
- **Olvasás repository-n át:** `PredictionRepository`, `ExperimentRepository`, `PatternRepository`, `PatternMonitorService.monitor` — a `ProactivePredictionService.getPredictions`, `ProactiveExperimentService.getExperiments`, `ObservationFeedService.forDay`, `MealCoachService.generateForDay` TILOS (LLM-et/írást indítanak).
- **Függőségi irány:** `character → proactive → companion → meal`; semmi nem importálhat `character`-t.
- **`@Transactional` csak metódus-szinten**; a publikálás `self.getObject()`-en át hívódik (proxy).
- **LLM:** csak `CompanionLlm`-en át, `LlmCallContextHolder.runWith(new LlmCallContext("character_edition", …), …)`; a prompt a markerrel KEZDŐDIK, a `PromptPersona.VOICE_HU` a törzsben; minden marker `FakeCompanionLlm`-tükröt kap.
- **Migráció:** új fájl `backend/src/main/resources/db/changelog/1.1.0/script/`, bejegyzés az `1.1.0_master.yml`-be; kiadott changeset nem módosul; jsonb-feltétel `jsonb_exists()`, soha `?`.
- **Kapuk szeletenként:** fókuszált backend: `cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.character.**,io.mrkuhne.mezo.ArchitectureTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"`; FE: `CI=true VITE_USE_MOCK=true pnpm --dir frontend test` ÉS `CI=true VITE_USE_MOCK=false pnpm --dir frontend test` + `pnpm --dir frontend build`; `node scripts/gen-codemap.mjs` (merge után is); `node scripts/lint-docs.mjs`.
- **Contract-first:** `character.yml` változás után `cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`, `cd backend && ./mvnw generate-sources` — a `api.gen.ts` diffje a commitba megy (CI `contract-drift`).
- **Commit:** konvencionális subject + `(mezo-a9bo7.<szelet-bead>)` + `Co-Authored-By` sor. Merge: detached HEAD → `git merge --no-ff` → `git push origin HEAD:main` (ház-szabály).
- Kommunikáció az ownerrel: magyarul, üzleti nyelven (CLAUDE.md).

---

## File Structure

```
backend/src/main/resources/db/changelog/1.1.0/script/202609241200_mezo-a9bo7_team_edition.sql   ← ÚJ (H1)
backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml                                  ← +changeSet (H1)
backend/src/main/java/io/mrkuhne/mezo/feature/character/
  domain/TeamCharacter.java            ← ÚJ H1 (kulcs + persona/domén-leképezés), H3 (név, emoji, hang)
  domain/EditionGenre.java             ← ÚJ H1
  service/edition/EditionCandidate.java        ← ÚJ H1 record
  service/edition/EditionSelector.java         ← ÚJ H1 tiszta függvény
  service/edition/TeamEditionReads.java        ← ÚJ H1 forrás-olvasók (repository-k)
  service/edition/EditionCandidateCollector.java ← ÚJ H1 (H5 bővíti)
  service/edition/TeamEditionService.java      ← ÚJ H1 run + publish
  service/edition/EditionVoiceWriter.java      ← ÚJ H3
  service/edition/EditionVoiceGuard.java       ← ÚJ H3 tiszta függvény
  entity/TeamEditionEntity.java, entity/TeamEditionPostEntity.java,
  entity/EditionFactsEnvelope.java, entity/EditionRefsEnvelope.java, entity/EditionGuestsEnvelope.java ← ÚJ H1
  repository/TeamEditionRepository.java, repository/TeamEditionPostRepository.java ← ÚJ H1
  service/CharacterCouncilJob.java     ← MÓDOSUL H1 (council.run után edition.run)
  service/CharacterService.java        ← MÓDOSUL H1 (editions(from,to) + EDITION run-kind)
  controller/CharacterController.java  ← MÓDOSUL H1 (getTeamEditions)
backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java ← +TEAM_EDITION_SWITCH (H1)
backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java      ← +marker tükör (H3)
backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/domain/AppNotificationKind.java ← +TEAM_EDITION (H2)
backend/src/main/resources/application.yml   ← ready-at 21:00, team-edition switch, throttled slug (H1/H3)
api/feature/character/character.yml          ← GET /api/character/edition + EDITION run-kind (H1), guests (H4)
backend/src/test/java/io/mrkuhne/mezo/feature/character/edition/*Test.java, *IT.java ← ÚJ
frontend/src/data/character/{characterApi.ts,characterHooks.ts,characterMock.ts}      ← MÓDOSUL H1/H2
frontend/src/features/character/runLabels.ts (+test), pages/FutasokPage.tsx           ← MÓDOSUL H1
frontend/src/features/insights/logic/teamEdition.ts (+test)                            ← ÚJ H2 (kiadás → FeedPost, fal-összefésülés)
frontend/src/features/insights/components/feed/useTeamFeed.ts, pages/TeamFeedPage.tsx  ← MÓDOSUL H2
frontend/src/features/insights/components/feed/FeedGuests.tsx (+test)                  ← ÚJ H4
frontend/src/data/types.ts, features/notification/logic/category.ts, app/AppHeader.tsx, data/notificationKindMeta.test.ts ← MÓDOSUL H2
docs/decisions/0052-esti-kiadas.md           ← ÚJ H1 (ADR 0048 módosítása)
docs/features/character.md, docs/features/insights.md, docs/CODEMAP.md ← MÓDOSUL szeletenként
```

---

# H1 — Az esti kiadás gépezete (bead: `mezo-a9bo7.12`)

### Task 1: `TeamCharacter` + `EditionGenre` (routing-regisztry)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/domain/TeamCharacter.java`, `.../domain/EditionGenre.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/edition/TeamCharacterTest.java`

(Ha a `character` feature-nek nincs `domain` alcsomagja, ellenőrizd az `ArchitectureTest` réteg-szabályait (`:48-66`): ha a `domain` nem engedett, tedd a két enumot a `service/edition` alá.)

**Interfaces:**
- Produces: `enum TeamCharacter { SZUNYA, MOCOR, FALAT, DERU, MEZO, SZKEPTIKUS; String key(); boolean postable(); static TeamCharacter forPersona(String expertKey); static TeamCharacter forMetricDomain(String domain); static TeamCharacter postableOr(TeamCharacter) }`; `enum EditionGenre { MEGFIGYELES, SEJTES, KERDES, KISERLET, ELOREJELZES, KONZILIUM, KERES, ERTEKELES; String key() }` (kulcs = kisbetűs név, a FE `FeedPostKind` értékei).

- [ ] **Step 1: Failing tükör-teszt** — az eset-lista SZÓ SZERINT a FE `frontend/src/features/insights/logic/team.ts` táblái:

```java
class TeamCharacterTest {
    @ParameterizedTest
    @CsvSource({"szomnologus,SZUNYA","edzo,MOCOR","drill,MOCOR","taplalkozo,FALAT","pszichologus,DERU",
            "doki,DERU","antropologus,MEZO","mezo,MEZO","szkeptikus,SZKEPTIKUS","ismeretlen,MEZO"})
    void persona(String key, TeamCharacter expected) { assertThat(TeamCharacter.forPersona(key)).isEqualTo(expected); }

    @ParameterizedTest
    @CsvSource({"sleep,SZUNYA","train,MOCOR","fuel,FALAT","mind,DERU","body,DERU","other,MEZO","xyz,MEZO"})
    void domain(String d, TeamCharacter expected) { assertThat(TeamCharacter.forMetricDomain(d)).isEqualTo(expected); }

    @Test void skepticNeverPosts() {
        assertThat(TeamCharacter.SZKEPTIKUS.postable()).isFalse();
        assertThat(TeamCharacter.postableOr(TeamCharacter.SZKEPTIKUS)).isEqualTo(TeamCharacter.MEZO);
        assertThat(TeamCharacter.SZUNYA.key()).isEqualTo("szunya");
    }
}
```

- [ ] **Step 2:** futtasd: `cd backend && ./mvnw test -Dtest=TeamCharacterTest` → FAIL (nincs osztály).
- [ ] **Step 3: Implementáció**

```java
package io.mrkuhne.mezo.feature.character.domain;

import java.util.Locale;
import java.util.Map;

/** Az 5 boop + a Szkeptikus (spec 2026-09-24 §3.4). A FE `logic/team.ts` tükre — a két tábla
 *  eset-listáját a TeamCharacterTest és a team.test.ts ugyanúgy rögzíti. */
public enum TeamCharacter {
    SZUNYA, MOCOR, FALAT, DERU, MEZO, SZKEPTIKUS;

    private static final Map<String, TeamCharacter> PERSONA = Map.of(
            "szomnologus", SZUNYA, "edzo", MOCOR, "drill", MOCOR, "taplalkozo", FALAT,
            "pszichologus", DERU, "doki", DERU, "antropologus", MEZO, "mezo", MEZO, "szkeptikus", SZKEPTIKUS);
    private static final Map<String, TeamCharacter> DOMAIN = Map.of(
            "sleep", SZUNYA, "train", MOCOR, "fuel", FALAT, "mind", DERU, "body", DERU, "other", MEZO);

    public String key() { return name().toLowerCase(Locale.ROOT); }
    public boolean postable() { return this != SZKEPTIKUS; }
    public static TeamCharacter forPersona(String expertKey) { return PERSONA.getOrDefault(expertKey, MEZO); }
    public static TeamCharacter forMetricDomain(String domain) { return DOMAIN.getOrDefault(domain, MEZO); }
    public static TeamCharacter postableOr(TeamCharacter c) { return c.postable() ? c : MEZO; }
}
```

```java
package io.mrkuhne.mezo.feature.character.domain;

import java.util.Locale;

/** A kiadás-poszt műfaja — a FE `FeedPostKind` kulcsai (teamFeed.ts). */
public enum EditionGenre {
    MEGFIGYELES, SEJTES, KERDES, KISERLET, ELOREJELZES, KONZILIUM, KERES, ERTEKELES;
    public String key() { return name().toLowerCase(Locale.ROOT); }
    /** A feltöltő műfajok: csak akkor mennek ki, ha a fő jelöltek 3 alatt maradnak. */
    public boolean filler() { return this == SEJTES || this == KERES; }
}
```

- [ ] **Step 4:** zöld. **Step 5: commit** `feat(character): TeamCharacter routing-regisztry + EditionGenre (mezo-a9bo7.12)`

### Task 2: `EditionCandidate` + `EditionSelector` (a válogatás szíve, tiszta függvény)

**Files:**
- Create: `.../entity/EditionRef.java` (`public record EditionRef(String kind, String id) {}` — az `entity` csomagban, mert a Task 3 jsonb-envelope-ja is ezt tárolja), `.../service/edition/EditionCandidate.java`, `.../service/edition/PriorShowing.java`, `.../service/edition/EditionSelector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/edition/EditionSelectorTest.java`

**Interfaces:**
- Consumes: Task 1 enumok.
- Produces:
  - `record EditionRef(String kind, String id)`
  - `record EditionCandidate(String sourceKind, String sourceId, TeamCharacter character, EditionGenre genre, String title, String recordText, List<String> facts, List<EditionRef> refs, boolean waiting, boolean claimChange, Instant changedAt, String sourceRoute)` — `sourceKey()` = `sourceKind + ":" + sourceId`.
  - `record PriorShowing(String sourceKey, Instant shownAt)`
  - `final class EditionSelector { static final int MIN = 3, MAX = 6, PER_CHARACTER = 2; static List<EditionCandidate> select(List<EditionCandidate> candidates, List<PriorShowing> last7Days, Instant lastEditionAt) }` — a visszatérő lista rangsorolt (index 0 = rank 1 = a nap posztere).

Pontozás (`score`): `waiting` 100 · `claimChange` 80 · `KISERLET` 70 · `ELOREJELZES` 60 · `MEGFIGYELES` 50 · `KONZILIUM` 45 · `KERDES` (nem waiting) 40 · `ERTEKELES` 55 · `SEJTES` 20 · `KERES` 10; +15, ha `changedAt` > `lastEditionAt` (null `lastEditionAt` = minden friss). Holtverseny: `changedAt` desc, majd `sourceKey` asc (determinizmus).

- [ ] **Step 1: Failing tesztek** (egy segéd-gyárral: `c(kind, id, character, genre, waiting, changedAt)`):

```java
@Test void capsAtSixAndRanksWaitingFirst()          // 9 fő jelölt → 6, az első a waiting
@Test void atMostTwoPerCharacter()                   // 5 SZUNYA jelölt → max 2 SZUNYA
@Test void atMostOnePerSource()                      // két jelölt ugyanazzal a sourceKey-jel → 1
@Test void fillsWithFillersOnlyBelowThree()          // 2 fő + 3 SEJTES → 3 (2 fő + 1 SEJTES); 4 fő + SEJTES → a SEJTES kimarad
@Test void fewerThanThreeWhenNothingElseIsReal()      // 1 fő, 0 filler → 1
@Test void emptyInEmptyOut()                         // [] → []
@Test void repeatBanWithinSevenDaysUnlessChanged()   // PriorShowing(key, t) és changedAt <= t → kiesik; changedAt > t → marad
@Test void deterministicTieBreak()                   // két azonos score: a frissebb changedAt nyer; egyező idő → sourceKey asc
@Test void freshBonusFollowsLastEdition()            // MEGFIGYELES friss (+15=65) megelőzi a nem friss ELOREJELZES-t (60)
```

Minden teszt TELJES kóddal íródik (pl.):

```java
@Test void fillsWithFillersOnlyBelowThree() {
    var t = Instant.parse("2026-09-24T19:00:00Z");
    var main = List.of(c("pattern","a",SZUNYA,MEGFIGYELES,false,t), c("prediction","b",FALAT,ELOREJELZES,false,t));
    var fill = List.of(c("pair","x",MOCOR,SEJTES,false,t), c("pair","y",DERU,SEJTES,false,t), c("pair","z",MEZO,SEJTES,false,t));
    var picked = EditionSelector.select(concat(main, fill), List.of(), null);
    assertThat(picked).hasSize(3);
    assertThat(picked.subList(0, 2)).extracting(EditionCandidate::sourceId).containsExactly("b", "a");
    assertThat(picked.get(2).genre()).isEqualTo(SEJTES);
}
```

- [ ] **Step 2:** FAIL. **Step 3: Implementáció**

```java
public final class EditionSelector {
    public static final int MIN = 3, MAX = 6, PER_CHARACTER = 2;
    private EditionSelector() {}

    public static List<EditionCandidate> select(List<EditionCandidate> candidates, List<PriorShowing> last7Days,
            Instant lastEditionAt) {
        Map<String, Instant> shown = new HashMap<>();
        last7Days.forEach(p -> shown.merge(p.sourceKey(), p.shownAt(), (a, b) -> a.isAfter(b) ? a : b));
        Comparator<EditionCandidate> order = Comparator
                .comparingInt((EditionCandidate c) -> -score(c, lastEditionAt))
                .thenComparing(EditionCandidate::changedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(EditionCandidate::sourceKey);
        var eligible = candidates.stream()
                .filter(c -> { var at = shown.get(c.sourceKey());
                               return at == null || (c.changedAt() != null && c.changedAt().isAfter(at)); })
                .sorted(order).toList();
        var picked = new ArrayList<EditionCandidate>();
        take(eligible.stream().filter(c -> !c.genre().filler()).toList(), picked, MAX);
        if (picked.size() < MIN) take(eligible.stream().filter(c -> c.genre().filler()).toList(), picked, MIN);
        return List.copyOf(picked);
    }

    private static void take(List<EditionCandidate> pool, List<EditionCandidate> picked, int upTo) {
        for (var c : pool) {
            if (picked.size() >= upTo) return;
            if (picked.stream().anyMatch(p -> p.sourceKey().equals(c.sourceKey()))) continue;
            if (picked.stream().filter(p -> p.character() == c.character()).count() >= PER_CHARACTER) continue;
            picked.add(c);
        }
    }

    static int score(EditionCandidate c, Instant lastEditionAt) {
        int base = c.waiting() ? 100 : c.claimChange() ? 80 : switch (c.genre()) {
            case KISERLET -> 70; case ELOREJELZES -> 60; case ERTEKELES -> 55; case MEGFIGYELES -> 50;
            case KONZILIUM -> 45; case KERDES -> 40; case SEJTES -> 20; case KERES -> 10; };
        boolean fresh = lastEditionAt == null || (c.changedAt() != null && c.changedAt().isAfter(lastEditionAt));
        return base + (fresh ? 15 : 0);
    }
}
```

- [ ] **Step 4:** zöld. **Step 5: commit** `feat(character): EditionSelector — 3–6 poszt, karakter-sapka, feltöltés, ismétlés-tilalom (mezo-a9bo7.12)`

### Task 3: Séma — `team_edition`, `team_edition_post`, `character_run.kind` += EDITION

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609241200_mezo-a9bo7_team_edition.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (új changeSet a lista végére)
- Create: `entity/TeamEditionEntity.java`, `entity/TeamEditionPostEntity.java`, `entity/EditionFactsEnvelope.java` (`record(List<String> facts)`), `entity/EditionRefsEnvelope.java` (`record(List<EditionRef> refs)` — az `EditionRef`-et tedd az `entity` csomagba és a Task 2 record importálja onnan), `entity/EditionGuestsEnvelope.java` (`record(List<Guest> guests)`, `record Guest(String characterKey, String body, boolean voiced)`)
- Create: `repository/TeamEditionRepository.java`, `repository/TeamEditionPostRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/edition/TeamEditionSchemaIT.java`

**Interfaces:**
- Produces: `TeamEditionRepository extends JpaRepository<TeamEditionEntity, UUID>`: `Optional<TeamEditionEntity> findByCreatedByAndDay(UUID, LocalDate)`, `List<TeamEditionEntity> findByCreatedByAndDayBetweenOrderByDayDesc(UUID, LocalDate, LocalDate)`, `Optional<TeamEditionEntity> findFirstByCreatedByAndDayLessThanOrderByDayDesc(UUID, LocalDate)`; `TeamEditionPostRepository`: `List<TeamEditionPostEntity> findByEditionIdInOrderByEditionIdAscRankAsc(Collection<UUID>)`.
- Entitás-mezők: `TeamEditionEntity { UUID id; LocalDate day; String status /* PUBLISHED|QUIET */; Instant generatedAt; UUID conferenceId }`; `TeamEditionPostEntity { UUID id; UUID editionId; short rank; String characterKey; String genre; String sourceKind; String sourceId; String sourceRoute; String title; String body; boolean voiced; EditionFactsEnvelope facts; EditionRefsEnvelope refs; EditionGuestsEnvelope guests }` — mindkettő `extends OwnedEntity`, `@SQLDelete`/`@SQLRestriction("is_deleted = false")`, a `CharacterRunEntity` idiómája szerint (Lombok getter/setter, ahogy ott).

- [ ] **Step 1: SQL** (a `202609211040_mezo-zwy6v_daily_council.sql` stílusában):

```sql
create table team_edition (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 day date not null,
 status varchar(16) not null,
 generated_at timestamptz not null,
 conference_id uuid,
 constraint pk_team_edition_id primary key(id),
 constraint fk_team_edition_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_team_edition_conference_id foreign key(conference_id) references character_conference(id),
 constraint ck_team_edition_status check(status in ('PUBLISHED','QUIET'))
);
create unique index uq_team_edition_day on team_edition(created_by, day) where is_deleted=false;
create index idx_team_edition_conference_id on team_edition(conference_id);

create table team_edition_post (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 edition_id uuid not null,
 rank smallint not null,
 character_key varchar(16) not null,
 genre varchar(16) not null,
 source_kind varchar(24) not null,
 source_id varchar(64) not null,
 source_route varchar(160) not null,
 title text,
 body text not null,
 voiced boolean not null default false,
 facts jsonb not null default '{"facts":[]}',
 refs jsonb not null default '{"refs":[]}',
 guests jsonb not null default '{"guests":[]}',
 constraint pk_team_edition_post_id primary key(id),
 constraint fk_team_edition_post_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_team_edition_post_edition_id foreign key(edition_id) references team_edition(id) on delete cascade,
 constraint ck_team_edition_post_character check(character_key in ('szunya','mocor','falat','deru','mezo')),
 constraint ck_team_edition_post_genre check(genre in ('megfigyeles','sejtes','kerdes','kiserlet','elorejelzes','konzilium','keres','ertekeles')),
 constraint ck_team_edition_post_rank check(rank between 1 and 6)
);
create unique index uq_team_edition_post_rank on team_edition_post(edition_id, rank) where is_deleted=false;
create index idx_team_edition_post_edition_id on team_edition_post(edition_id);

alter table character_run drop constraint ck_character_run_kind;
alter table character_run add constraint ck_character_run_kind check (kind in ('NIGHTLY','WEEKLY','MONTHLY','BOOTSTRAP','EDITION'));
```

  Master-bejegyzés:

```yaml
  - changeSet:
      id: "1.1.0:202609241200_mezo-a9bo7_team_edition"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609241200_mezo-a9bo7_team_edition.sql
```

- [ ] **Step 2: Failing IT** (`@ActiveProfiles("companion-fake") extends AbstractIntegrationTest`, a `CharacterRunLogIT` user-létrehozási mintájával): menti egy kiadást 2 poszttal és visszaolvassa rank-sorrendben (jsonb envelope-okkal); második élő kiadás ugyanarra a napra → `DataIntegrityViolationException`; `character_run` `EDITION` kind mentése sikeres; `character_key='szkeptikus'` poszt → `DataIntegrityViolationException`.
- [ ] **Step 3:** entitások + repók. **Step 4:** `./mvnw clean test -Dtest=TeamEditionSchemaIT -Dmezo.test.use-testcontainers=true` zöld.
- [ ] **Step 5: commit** `feat(character): team_edition séma + EDITION run-kind (mezo-a9bo7.12)`

### Task 4: `TeamEditionReads` + `EditionCandidateCollector` (forrás → jelölt)

**Files:**
- Create: `.../service/edition/TeamEditionReads.java` (`@Service`, `@ConditionalOnProperty(name = {CHARACTER_SWITCH, COMPANION_SWITCH}, havingValue="true")`, a `CharacterMetaReads.java:39-57` mintája)
- Create: `.../service/edition/EditionCandidateCollector.java`
- Test: `.../edition/EditionCandidateCollectorTest.java` (unit, a `TeamEditionReads` mockolva Mockitóval) + `.../edition/TeamEditionReadsIT.java`

**Interfaces:**
- Consumes: `PatternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(UUID)`, `PatternMonitorService.monitor(UUID)` (→ `PatternMonitorResponse { minN; pairs[] { key, title, metricADomain, metricBDomain, n } }`), `PredictionRepository.findByCreatedByAndValidToBetweenAndDeletedFalse(UUID, LocalDate, LocalDate)`, `ExperimentRepository.findByCreatedByAndStatusOrderByGeneratedAtDesc(UUID, "active")`, `CharacterConferenceRepository` (a nap `DAILY` konferenciája: kind `DAILY`, `weekStart == day`) + annak `deliberation().threads()` és `outcome().changes()`.
- Produces: `TeamEditionReads` rekord-nézetei: `List<PatternEntity> patterns(UUID)`, `PatternMonitorResponse monitor(UUID)`, `List<PredictionEntity> resolvedPredictions(UUID, LocalDate from, LocalDate to)` (status != `pending`), `List<ExperimentEntity> activeExperiments(UUID)`, `Optional<CharacterConferenceEntity> dailyConference(UUID, LocalDate)`.
- Produces: `EditionCandidateCollector.collect(UUID owner, LocalDate day, Instant lastEditionAt) → List<EditionCandidate>`.

Leképezési szabályok (a FE `teamFeed.ts` útvonal-szabályai SZÓ SZERINT):

| Forrás | Feltétel | genre | character | recordText | facts | sourceRoute | waiting / changedAt |
|---|---|---|---|---|---|---|---|
| `PatternEntity` | `status=proposed` | `KERDES` | a pár doménje (monitor `pairs` `key==pairKey` → `forMetricDomain(metricADomain)`), különben `MEZO` | `mechanism` | `n` ha >0: `"%d nap"`; `r` ha nem null: `"r=%.2f"` NEM kerül (szaknyelv) — csak nap-szám | `/mezo/patterns/{pairKey}` | `true` / `lastDetectedAt` |
| `PatternEntity` | `status=confirmed` ÉS `lastDetectedAt > lastEditionAt` | `MEGFIGYELES` | mint fent | `mechanism` | mint fent | mint fent | `false` / `lastDetectedAt` |
| monitor pár | `5 <= n < minN` | `SEJTES` | `forMetricDomain(metricADomain)` | `title` | `"%d közös nap"`, `"%d kell"` (minN) | `/mezo/patterns/{key}` | `false` / `null` |
| `PredictionEntity` | `status in (validated, missed)`, `validTo` a [day-7, day] ablakban | `ELOREJELZES` | a `metricKey` doménje (a `MetricKey` enum domén-accessorával; ha nincs → `MEZO`) | `actual` ha nem üres, különben `basis` | — | `/mezo/predictions/{id}` | `false` / `validTo` 21:00 Budapest |
| `ExperimentEntity` | `active`, és a futó nap (`day - startDate + 1`) ∈ {1, ceil(total/2), total} | `KISERLET` | a `metricKey` doménje | `hypothesis` | `"%d. nap"`, `"%d napból"` | `/mezo/experiments/{id}` | `false` / `startDate + (dayNo-1)` 21:00 |
| DAILY konferencia szála | minden szál | `KONZILIUM` | `forPersona(szál vezető expertKey)` → `postableOr` | a szál első item szövege | — | `/mezo/karakter/konzilium` | `false` / `conference.generatedAt`; `claimChange = outcome.changes` érinti a szál dimenzióját |

(A `MetricKey` domén-accessorának pontos nevét a `feature/companion` `MetricKey` enumjában ellenőrizd; ha nincs ilyen, a `PatternMonitorService` pár-építése mutatja, honnan jön a `metricADomain`, azt használd.)

- [ ] **Step 1: Failing unit-tesztek** táblázat-soronként (1–1 teszt: minden sor feltétele teljesül → a várt mezők; feltétel nem teljesül → nincs jelölt), plusz: a Szkeptikus-vezette konzílium-szál gazdája `MEZO`.
- [ ] **Step 2:** FAIL → **Step 3:** implementáció → **Step 4:** zöld.
- [ ] **Step 5: `TeamEditionReadsIT`** a `PatternPopulator`-ral: seedelt proposed minta → `patterns()` visszaadja; a `resolvedPredictions` csak a nem-pending sorokat adja; NEM hív LLM-et (a `FakeCompanionLlm` hívásszámlálója — ha nincs ilyen, azt ellenőrizd, hogy nem jön létre új `prediction` sor).
- [ ] **Step 6: commit** `feat(character): esti kiadás jelöltgyűjtés — minták, gyűlik, előrejelzés, kísérlet, konzílium (mezo-a9bo7.12)`

### Task 5: `TeamEditionService` + job-beillesztés + kapcsoló + 21:00

**Files:**
- Create: `.../service/edition/TeamEditionService.java`
- Modify: `.../service/CharacterCouncilJob.java` (a `council.run(user.getId(), day);` után, a belső `try`-on BELÜL, de saját `try/catch`-ben)
- Modify: `FeaturesConfiguration.java` (`public static final String TEAM_EDITION_SWITCH = "mezo.feature.team-edition.enabled";`), `application.yml` (`mezo.feature.team-edition.enabled: true` a `mezo.feature.*` blokkban a `character` mellett; `mezo.character.council.ready-at: "21:00"` + a sor feletti komment: „Esti kiadás (mezo-a9bo7, ADR 0052): a konzílium és a kiadás 21:00-tól fut”)
- Test: `.../edition/TeamEditionServiceIT.java`, meglévő `CharacterCouncilJob`-tesztek frissítése, ha 05:15-re építenek (grep: `readyAt`, `05:15` a `backend/src/test`-ben)

**Interfaces:**
- Consumes: Task 2 `EditionSelector`, Task 3 repók, Task 4 `EditionCandidateCollector`, `CharacterRunLog.record(owner, "EDITION", day, postCount, 0, List.of(), characterKeys, conferenceId)`.
- Produces: `TeamEditionService.run(UUID owner, LocalDate day)` (idempotens), `@Transactional TeamEditionEntity publish(UUID owner, LocalDate day, UUID conferenceId, List<EditionCandidate> ranked, List<VoicedText> voiced)` ahol `record VoicedText(String title, String body, boolean voiced)` — H1-ben a `voiced` lista `recordText`-ből áll (`new VoicedText(c.title(), c.recordText(), false)`); H3 cseréli.
- Bean-feltétel: `@ConditionalOnProperty(name = {CHARACTER_SWITCH, COMPANION_SWITCH, TEAM_EDITION_SWITCH}, havingValue="true")`; a job `ObjectProvider<TeamEditionService>`-t kap, és `ifAvailable`-lel hívja.

```java
public void run(UUID owner, LocalDate day) {
    if (editions.findByCreatedByAndDay(owner, day).isPresent()) return;
    var last = editions.findFirstByCreatedByAndDayLessThanOrderByDayDesc(owner, day);
    Instant lastAt = last.map(TeamEditionEntity::getGeneratedAt).orElse(null);
    var prior = priorShowings(owner, day);                    // az előző 7 nap posztjainak sourceKey + generatedAt
    var ranked = EditionSelector.select(collector.collect(owner, day, lastAt), prior, lastAt);
    var conferenceId = reads.dailyConference(owner, day).map(CharacterConferenceEntity::getId).orElse(null);
    var texts = ranked.stream().map(c -> new VoicedText(c.title(), c.recordText(), false)).toList();
    TeamEditionEntity saved;
    try { saved = self.getObject().publish(owner, day, conferenceId, ranked, texts); }
    catch (DataIntegrityViolationException raced) { return; }   // egy párhuzamos futás nyert
    runLog.record(owner, "EDITION", day, ranked.size(), 0, List.of(), 
            ranked.stream().map(c -> c.character().key()).distinct().toList(), conferenceId);
}
```

`priorShowings(owner, day)`: a `[day-7, day-1]` napok kiadásai (`findByCreatedByAndDayBetweenOrderByDayDesc`) és posztjaik (`findByEditionIdInOrderByEditionIdAscRankAsc`) → `new PriorShowing(post.getSourceKind() + ":" + post.getSourceId(), edition.getGeneratedAt())`.

`publish`: `status = ranked.isEmpty() ? "QUIET" : "PUBLISHED"`, `generatedAt = Instant.now()`, posztok `rank = i+1`, `facts`/`refs` envelope-ba, `guests` üres.

- [ ] **Step 1: Failing IT-k** (`TeamEditionServiceIT`, `@ActiveProfiles("companion-fake")`):
  - seedelt proposed minta + resolved előrejelzés + aktív kísérlet (1. nap) → `run` után 1 `PUBLISHED` kiadás 3 poszttal, rank 1 = a minta (waiting), `voiced=false`, `body = mechanism`;
  - kétszeri `run` → továbbra is 1 kiadás, egy `EDITION` run-sor;
  - üres felhasználó → 1 `QUIET` kiadás 0 poszttal;
  - ismétlés-tilalom: tegnapi kiadásban ugyanaz a minta, változatlan `lastDetectedAt` → ma nincs benne;
  - kapcsoló ki (`@TestPropertySource(properties = "mezo.feature.team-edition.enabled=false")`) → nincs `TeamEditionService` bean, a job ettől nem hibázik.
- [ ] **Step 2:** FAIL → **Step 3:** implementáció + job + yml → **Step 4:** zöld (fókuszált character-csomag + ArchitectureTest, lásd Global Constraints).
- [ ] **Step 5: commit** `feat(character): esti kiadás futása 21:00-kor a konzílium után, kapcsolóval (mezo-a9bo7.12)`

### Task 6: API — `GET /api/character/edition` + EDITION a Futásokban (FE)

**Files:**
- Modify: `api/feature/character/character.yml` — új path a `getCharacterRuns` (`:173-207`) mintájára, `operationId: getTeamEditions`, `from`/`to` kötelező date query; új sémák; `CharacterRunSummary.kind` enum (`:757`) += `EDITION`
- Modify: `CharacterController.java` (`@Override getTeamEditions`), `CharacterService.java` (`editions(owner, from, to)` — a `runs` 62 napos tartomány-validációjával, `CHARACTER_RUN_RANGE_INVALID`)
- Modify (FE): `frontend/src/data/_client/api.gen.ts` (generált), `frontend/src/data/character/characterApi.ts` (`editions(from,to)`), `characterHooks.ts` (`useTeamEditions`), `data/hooks.ts` re-export, `characterMock.ts` (`MOCK_EDITIONS` + egy `EDITION` sor a `MOCK_RUNS`-ba), `features/character/runLabels.ts` (`KIND_BADGE.EDITION = 'kiadás'`, `KIND_LABEL.EDITION = 'Esti kiadás'`), `runLabels.test.ts`
- Test: `backend/.../character/CharacterApiIT.java` bővítés; FE `characterHooks` teszt (ha van `characterHooks.test.ts`, ott; különben új `useTeamEditions.test.tsx`)

Séma:

```yaml
    TeamEdition:
      type: object
      required: [day, status, posts]
      properties:
        day: { type: string, format: date }
        status: { type: string, enum: [PUBLISHED, QUIET] }
        posts: { type: array, items: { $ref: '#/components/schemas/TeamEditionPost' } }
    TeamEditionPost:
      type: object
      required: [rank, characterKey, genre, sourceKind, sourceId, sourceRoute, body, voiced, guests]
      properties:
        rank: { type: integer, minimum: 1, maximum: 6 }
        characterKey: { type: string, enum: [szunya, mocor, falat, deru, mezo] }
        genre: { type: string, enum: [megfigyeles, sejtes, kerdes, kiserlet, elorejelzes, konzilium, keres, ertekeles] }
        sourceKind: { type: string }
        sourceId: { type: string }
        sourceRoute: { type: string }
        title: { type: string, nullable: true }
        body: { type: string }
        voiced: { type: boolean }
        guests:
          type: array
          items:
            type: object
            required: [characterKey, body, voiced]
            properties:
              characterKey: { type: string, enum: [szunya, mocor, falat, deru, mezo, szkeptikus] }
              body: { type: string }
              voiced: { type: boolean }
```

FE hook (a `useCharacterRuns` sablonja szerint):

```ts
export function useTeamEditions(fromIso: string, toIso: string): { editions: TeamEdition[]; isLoading: boolean } {
  const { data, isPending } = useDualQuery<TeamEdition[]>({
    queryKey: ['teamEditions', fromIso, toIso],
    mockData: MOCK_EDITIONS.filter((e) => e.day >= fromIso && e.day <= toIso),
    realFetch: () => characterApi.editions(fromIso, toIso),
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { editions: data, isLoading: isPending }
}
```

`MOCK_EDITIONS`: EGY kiadás a mock-világ „ma” napjára (a `characterMock.ts` meglévő dátum-konstansát használd), 3 poszttal, amelyek a mock-seed MEGLÉVŐ rekordjaira mutatnak (egy minta `pairKey`, egy előrejelzés `id`, egy kísérlet `id` a mock-seedből) — `voiced:false`, `body` = a rekord mock-szövege. Kitalált rekord nincs.

- [ ] **Step 1: Failing tesztek:** `CharacterApiIT` — `GET /api/character/edition?from&to` a seedelt kiadással 200 + helyes posztsorrend; 63 napos tartomány → 400; `GET /runs` egy `EDITION` sorral 200 (nem 500). FE: `runLabels.test.ts` az `EDITION` címkére; `useTeamEditions` mock módban a `MOCK_EDITIONS`-t, real módban MSW `[]`-t ad (MSW-handler: `frontend/src/test/msw/handlers.ts`, `http.get(`${API_BASE}/api/character/edition`, () => HttpResponse.json([]))`).
- [ ] **Step 2:** FAIL → **Step 3:** contract + generálás (Global Constraints parancsai) + implementáció → **Step 4:** zöld mindkét FE módban + backend fókusz.
- [ ] **Step 5: commit** `feat(character): esti kiadás API + EDITION a Futásokban (mezo-a9bo7.12)`

### Task 7: H1 zárás — ADR, doksik, kapuk, merge

**Files:**
- Create: `docs/decisions/0052-esti-kiadas.md` (Status Accepted, Date 2026-09-24, Driver mezo-a9bo7.12; Context: ADR 0048 reggeli napi fala; Decision: a konzílium 21:00-kor fut, utána a `team_edition` kiadás 3–6 poszttal minden forrásból; a konzílium dosszié-szerepe változatlan; Consequences: D-1 detektor-késés, új táblák, név-elhatárolás a `character_council_edition`-től; Alternatives: új párhuzamos válogató, LLM-nélküli szűrés — a spec §1 szerint elvetve). Az ADR 0048 fejébe egy sor: „Részben módosítja: ADR 0052 (esti kiadás, 2026-09-24).”
- Modify: `docs/features/character.md` (új alszakasz „Esti kiadás” — táblák, futás, API, kapcsoló; a run-kind lista `+EDITION`; a tábla-/végpont-számok javítása a CODEMAP szerint), `docs/features/insights.md` §3 (a fal H2-ben fogja olvasni), `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`)
- [ ] **Step 1:** teljes backend suite: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true` → PASS. FE mindkét mód + build → PASS. `node scripts/lint-docs.mjs` → PASS.
- [ ] **Step 2: commit** `docs(character): ADR 0052 esti kiadás + character.md (mezo-a9bo7.12)`
- [ ] **Step 3:** merge a ház-szabály szerint; merge után CODEMAP-regen; bead zárás; beads-backup (`node scripts/check-beads-backup.mjs --fix`) + push.
- [ ] **Step 4: Owner-átadás magyarul:** hol látja (Gépterem › Futások „Esti kiadás” sor, ma 21:00 után), mi jön H2-ben.

---

# H2 — A fal az esti kiadást mutatja + értesítés (bead: `mezo-a9bo7.13`)

### Task 8: `teamEdition.ts` — kiadás → `FeedPost`, fal-összefésülés (tiszta FE-logika)

**Files:**
- Create: `frontend/src/features/insights/logic/teamEdition.ts`, `teamEdition.test.ts`

**Interfaces:**
- Consumes: `TeamEdition` (generált típus a `characterApi.ts`-ből), `FeedPost`, `FeedDay`, `TeamFeed` (`teamFeed.ts:34-87`).
- Produces:
  - `editionPost(e: TeamEdition, p: TeamEditionPost): FeedPost` — `id: 'edition:' + e.day + ':' + p.rank`, `kind: p.genre`, `author: p.characterKey`, `occurredAt: e.day`, `title`, `body`, `sourceRoute`, `waiting: p.genre === 'kerdes'` csak ha a forrás-rekord ma is nyitott (lásd `mergeWall`), `decision: p.sourceKind === 'pattern' && p.genre === 'kerdes' ? { patternId: p.sourceId } : undefined`.
  - `mergeWall(feed: TeamFeed, editions: TeamEdition[], today: string): TeamFeed` — szabályok:
    1. Minden napra, amelyhez van `PUBLISHED`/`QUIET` kiadás: a nap posztjai = a kiadás posztjai rank-sorrendben; `poster` = rank 1 (ha van); `QUIET` → a nap `posts: []`, és a `FeedDay` új mezőt kap: `quiet: true`.
    2. A MAI napra (akár van kiadás, akár nincs) a `feed` `waiting` posztjai hozzáadódnak a nap elejére, KIVÉVE ha ugyanaz a forrás a kiadásban is szerepel (egyezés: `sourceRoute`).
    3. Kiadás nélküli napokon a `feed` napja változatlan (I. felvonás fallback).
    4. `waitingCount` és `freshByCharacter` az összefésült napokból számolódik újra (friss = a mai napon van posztja).
- [ ] **Step 1: Failing tesztek** (a meglévő `teamFeed.fixtures.ts` + egy `edition()` gyár): kiadás-nap = csak a kiadás posztjai, rank-1 poszter; mai waiting kopogtatás megmarad és nem duplikálódik; `QUIET` nap `quiet:true`, nincs poszt; kiadás nélküli nap változatlan; `freshByCharacter` újraszámolva.
- [ ] **Step 2–4:** FAIL → implementáció → zöld (`CI=true pnpm --dir frontend exec vitest run src/features/insights/logic/teamEdition.test.ts`).
- [ ] **Step 5: commit** `feat(insights): kiadás → fal-összefésülés (mezo-a9bo7.13)`

### Task 9: A fal bekötése + csendes-nap mondat

**Files:**
- Modify: `frontend/src/features/insights/components/feed/useTeamFeed.ts` (`useTeamEditions(addDays(today,-13), today)`; `loading` bővül; `feed = mergeWall(built, editions, today)`), `pages/TeamFeedPage.tsx` (nap-szekcióban: `day.quiet` → `<p className="tf-note">Ma csendes nap volt — holnap folytatjuk.</p>`), `teamFeed.ts` (`FeedDay.quiet?: boolean`)
- Test: `TeamFeedPage.test.tsx` bővítés
- A szobák (`CharacterRoomPage`) a `buildTeamFeed` TELJES kimenetét használják tovább — NEM a `mergeWall`-t (spec §2: ami nem került be, a szobában marad). Ha a `useTeamFeed` közös, adj vissza külön `allPosts` mezőt a szobáknak, és ezt teszttel rögzítsd.
- [ ] **Step 1: Failing tesztek:** mock módban a mai nap a `MOCK_EDITIONS` 3 posztját mutatja rank-sorrendben, a poszter a rank 1; real módban MSW `QUIET` kiadással a csendes-nap mondat látszik, `article` nincs aznapra; a szoba a kiadásba NEM került rekordot is listázza.
- [ ] **Step 2–4** → **Step 5: commit** `feat(insights): a fal az esti kiadást mutatja (mezo-a9bo7.13)`

### Task 10: „Megjött az esti kiadás” értesítés

**Files:**
- Modify: `backend/.../appnotification/domain/AppNotificationKind.java` (`TEAM_EDITION("team_edition", "pattern", "/mezo")` + Javadoc: a `pattern` push-családon utazik, az `OBSERVATION_NEW` precedense), `TeamEditionService` (publish után, ha `PUBLISHED` és ≥ 1 poszt: `appNotificationEmitter.emit(owner, AppNotificationKind.TEAM_EDITION, "Megjött az esti kiadás", "<N> bejegyzés a csapattól", "/mezo", edition.getId(), "team_edition:" + day)`), `api/feature/notification/notification.yml` (ha a kind enum ott zárt listában szerepel — ellenőrizd `:212` környékén), FE: `frontend/src/data/types.ts` (a kind-unió + meta, `~:1870/~:1910`), `features/notification/logic/category.ts:44`, `data/notificationKindMeta.test.ts:20`, `app/AppHeader.tsx:36`
- Test: `TeamEditionServiceIT` (+1: PUBLISHED → 1 értesítés dedupKey-jel; QUIET → 0; kétszeri futás → 1), FE `notificationKindMeta.test.ts`
- [ ] **Step 1–4** TDD-ben → **Step 5: commit** `feat(character): „Megjött az esti kiadás” értesítés (mezo-a9bo7.13)`

### Task 11: H2 zárás

- [ ] Runtime-pass a `verify` skillel sötétben (390 + 320 px): a fal mock módban a kiadást mutatja, poszter = rank 1, szoba listázza a kimaradt ügyet, konzol tiszta, reduced-motion.
- [ ] Doksik: `insights.md` §3 (a `mergeWall` szabályai, a `quiet` nap), `notification`-doksi a `team_edition` sorral; CODEMAP; kapuk; merge; bead zárás; owner-átadás magyarul (mikor jön, hogyan néz ki, csendes nap).

---

# H3 — Saját hang (bead: `mezo-a9bo7.14`)

### Task 12: `TeamCharacter` hang-adatai + `EditionVoiceGuard` (tiszta függvény)

**Files:**
- Modify: `TeamCharacter.java` — új mezők konstruktorral: `displayName` (Szunya, Mocor, Falat, Derű, Mezo, Szkeptikus), `area` (alvás, mozgás, étkezés, közérzet, a csapat, „”), `Set<String> emoji` (Szunya `🌙`; Mocor `⚡`,`💪`; Falat `🍽️`,`🥦`,`🍳`; Derű `🌤️`; Mezo `📔`,`✅`,`👋`,`🔍`; Szkeptikus üres), `String voice` (a `docs/features/insights.md` §2.0a bekezdése karakterenként, egy mondatba sűrítve: hangnem + tiltás).
- Create: `.../service/edition/EditionVoiceGuard.java`
- Test: `EditionVoiceGuardTest.java`, `TeamCharacterTest` bővítés

**Interfaces:**
- Produces: `EditionVoiceGuard.check(TeamCharacter who, String body, List<String> facts, String recordText) → Optional<String>` (üres = átment; különben az ok: `"number"`, `"sentences"`, `"emoji"`, `"jargon"`).

Szabályok:
- **Számok:** minden `\d+(?:[.,]\d+)?` illeszkedés (vessző→pont normalizálva) szerepeljen a `facts` + `recordText` számai között.
- **Mondatszám:** `[.!?…]+(\s|$)` szerinti darabolás, 2–4 nem üres mondat.
- **Emoji:** minden emoji-grafém (`\p{So}` és a `\p{Extended_Pictographic}` tartomány, a variációs szelektort U+FE0F lehagyva) legyen a karakter `emoji` halmazában; Szkeptikusnál egy sem.
- **Szaknyelv-tiltólista** (kisbetűsített részsztring-egyezés): `["intake","7-day","korreláció","szignifikáns","p-érték","r=","±","baseline","trend line"]`. (A „deficit” szándékosan NINCS benne — a magyar köznyelvben él.)

- [ ] **Step 1: Failing tesztek:** kitalált szám („**9** nap”, facts-ben csak 5) → `number`; tizedesvessző-normalizálás („7,5 óra”, facts „7.5 óra”) átmegy; 1 és 5 mondat → `sentences`; Szunya 🍽️-vel → `emoji`; Szkeptikus bármely emojival → `emoji`; „korreláció” → `jargon`; érvényes 3 mondatos Szunya-szöveg 🌙-val → üres.
- [ ] **Step 2–4** → **Step 5: commit** `feat(character): karakterhang-adatok + tény-őr (mezo-a9bo7.14)`

### Task 13: `EditionVoiceWriter` + Fake-tükör + throttle

**Files:**
- Create: `.../service/edition/EditionVoiceWriter.java`
- Modify: `FakeCompanionLlm.java` (új `startsWith("CSAPATFAL-ESTI-KIADAS")` ág a `:700` utáni dispatchben, a `KONTEXTUSOS-MEZO-UZENET` ág mintájára: `[fake-edition-malformed]` → `"not-json"`; `[fake-edition-json:<base64>]` → dekódolt JSON; alapértelmezés: minden bemeneti posztra `{"rank":n,"body":"<a bemenet recordText-je>. Ez egy második mondat."}` — így a tény-őrön átmegy), `TeamEditionService` (a `texts` a writer + guard eredménye), `application.yml` (`throttled-features` += `character_edition`)
- Test: `EditionVoiceWriterIT.java`

**Interfaces:**
- Produces: `EditionVoiceWriter.write(UUID owner, List<EditionCandidate> ranked) → List<VoicedText>` (azonos hossz és sorrend; soha nem dob — hibánál minden elem `new VoicedText(c.title(), c.recordText(), false)`).

Prompt (rendszer), a marker az ELSŐ sor:

```
CSAPATFAL-ESTI-KIADAS
Egy öttagú csapat esti posztjait írod át a karakterek saját hangján. Minden poszt EGY forrás-rekord átfogalmazása.
Szabályok: 2–4 mondat; a megadott tényeken kívül SEMMILYEN számot nem írhatsz; tilos új állítás; a bizonytalanság
bizonytalan marad („lehet”, „kezd úgy tűnni”, „még csak sejtem”); a **kiemelés** két csillaggal; emoji csak a
karakter saját készletéből, mértékkel; a Szkeptikus nem használ emojit; szaknyelv tilos.
{VOICE_HU}
Karakterek: {minden TeamCharacter: displayName · area · emoji · voice}
Válasz: KIZÁRÓLAG JSON tömb: [{"rank":1,"title":"…vagy null","body":"…"}]
```

Felhasználói üzenet: posztonként `rank`, `karakter`, `műfaj`, `cím`, `rekord-szöveg`, `tények` listája. Hívás: `budget.run(owner, false, () -> llmCallContextHolder.runWith(new LlmCallContext("character_edition", "voice", "team_edition", null), () -> companionLlm.complete(promptPersona.render(owner, system), user)))`. A válasz rank-onként párosítva; minden elemre `EditionVoiceGuard.check`; bukás → `recordText`, `voiced=false`; átment → `voiced=true`.

- [ ] **Step 1: Failing IT-k:** alap fake → minden poszt `voiced=true`; `[fake-edition-malformed]` → mind `voiced=false`, `body = recordText`; scriptelt JSON kitalált számmal → az a poszt `voiced=false`, a többi `true`; `FAIL_COMPLETE` → a kiadás megjelenik `voiced=false`-szal; a konzílium keretét nem fogyasztja (a konzílium-futás után a writer saját ciklusban fut — `CharacterCouncilBudgetIT` mintájával ellenőrizve).
- [ ] **Step 2–4** → **Step 5: commit** `feat(character): esti kiadás karakterhangon, tény-őrrel (mezo-a9bo7.14)`

### Task 14: H3 zárás

- [ ] FE: a `voiced` posztok szövege a meglévő `renderInline(…, { boldOnly: true })`-val renderel (a `**` kiemelés már működik) — teszt egy `voiced:true` mock-poszttal (mock-szöveg: a spec hangkönyvének egy prototípus-mondata, a mock-rekord valós számaival).
- [ ] Doksik (`character.md` hang-réteg, `insights.md` §2.0a: „a generátor-prompt magja ez”), kapuk, merge, owner-átadás (hogyan szólnak most; a „csak valós szám” őr).

---

# H4 — Két karakter beszélget (bead: `mezo-a9bo7.15`)

### Task 15: Vendég-sorok a backendben

**Files:**
- Modify: `EditionCandidate` (+`List<TeamCharacter> guestCandidates`), `EditionCandidateCollector` (konzílium-szálnál a szál többi résztvevője `forPersona`-val, max 1 + a Szkeptikus, ha a skeptic-kör szólt; mintapárnál a másik domén karaktere, ha eltér), `EditionVoiceWriter` (a JSON-séma bővül: `"guests":[{"character":"falat","body":"…"}]`, max 2; a Szkeptikus-sor „alternatív magyarázat” szabállyal, emoji nélkül), `TeamEditionService.publish` (`guests` envelope), `FakeCompanionLlm` (alap válasz vendég-sorral, ha a bemenet `vendégek:` mezőt tartalmaz)
- Test: `EditionVoiceWriterIT` bővítés — vendég-sor átmegy a tény-őrön → mentve; kitalált szám a vendég-sorban → a vendég-sor kimarad (a poszt maga megmarad); konzílium-szálból a vendég a résztvevő szakértő karaktere.
- Konzílium-szálaknál, ha a writer nem ad vendég-sort, a meglévő cross-talk reakció szövege (`deliberation` item) kerül be `voiced=false`-szal.
- [ ] TDD lépések → **commit** `feat(character): két karakter beszélget az esti kiadásban (mezo-a9bo7.15)`

### Task 16: `FeedGuests` FE-komponens

**Files:**
- Create: `frontend/src/features/insights/components/feed/FeedGuests.tsx` (+ test) — a prototípus (`docs/design_2.0/prototypes/uveg-uzenofal.html`) kommentelőnézet-anatómiája: kis `FeedAvatar` + név + szöveg, max 2 sor, a Szkeptikus pala avatárral; a poszt-kártyák (`FeedPostCard`, `FeedPosterCard`) a hármas FÖLÉ renderelik, ha `post.guests?.length`.
- Modify: `teamFeed.ts` `FeedPost` (+`guests?: { author: TeamCharacterId; body: string }[]`), `teamEdition.ts` `editionPost` (guests leképezés).
- Test: render-teszt két vendéggel; a Szkeptikus sorában nincs emoji-dekoráció a UI-ban (a UI glifa sprite, soha emoji).
- [ ] TDD → verify-pass sötétben → doksik → merge → owner-átadás.

---

# H5 — Falat és Derű napi műsora (bead: `mezo-a9bo7.16`)

### Task 17: Falat — `ERTEKELES` jelölt (három szólam)

**Files:**
- Modify: `TeamEditionReads` (+ `List<MealEntity> meals(UUID, LocalDate)` a meal repository-n át — keresd a `MealRepository` napi lekérdezését; `DailyTargets targets(UUID, LocalDate)` = `FuelDayService.dailyTargets`; `List<WorkoutWindowQueryService.Window> windows(UUID, LocalDate)` = `WorkoutWindowQueryService.windowsFor`), `EditionCandidateCollector` (+`falat()`)
- Test: `EditionCandidateCollectorTest` bővítés

Szabály: 0 étkezés → nincs jelölt. Különben `genre=ERTEKELES`, `character=FALAT`, `sourceKind="fuel_day"`, `sourceId=day`, `sourceRoute="/fuel"`, `changedAt` = az utolsó étkezés ideje, `recordText` három, adatból épített mondat (csak az a szólam, amelyhez van adat):
- *tányér:* `"Eddig ma %d étkezésed van, átlagosan %d pontos."` (`MealEntity.score` átlaga, egészre kerekítve; ha minden `score` null, a szólam kimarad);
- *cél:* `"A napi célod %d kcal, eddig %d kcal ment be."` (`DailyTargets.kcal()` vs. az étkezések kcal-összege — a mező nevét a `MealEntity`-ben ellenőrizd);
- *edzés:* ha van `done` vagy ütemezett ablak: `"Ma volt edzésed (%s)."` / `"Ma %s edzés van betervezve."` (`Window.label`).
A `facts` = ezek számai szövegként.
- [ ] TDD (0 étkezés; csak tányér; mind a három; score nélküli nap) → commit `feat(character): Falat napi háromszólamú értékelése (mezo-a9bo7.16)`

### Task 18: Derű — `KERES` jelölt (adatkérés CTA-val)

**Files:**
- Modify: `TeamEditionReads` (+ `long checkinDays(UUID, LocalDate from, LocalDate to)` a `checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween` alapján, napokra deduplikálva), `EditionCandidateCollector` (+`deru()`), `teamEdition.ts`/`FeedPostCard` (a `keres` műfajú poszt CTA-gombja: „Bejelentkezem” → a meglévő bejelentkezés-útvonal — keresd a Nap fül „Hogy vagy ma?” wizard route-ját), `TeamEditionService` (heti egy: ha az előző 6 nap kiadásaiban volt `deru`/`keres` poszt, nincs új)
- Szabály: `days = checkinDays(day-13, day)`; `days < 8` → `genre=KERES`, `character=DERU`, `sourceKind="checkin_coverage"`, `sourceId=day`, `recordText = "14 napból %d napról tudom, hogy vagy. Egy rövid bejelentkezés ma este sokat segítene."`, `facts=["14", "<days>"]`, `sourceRoute` = a bejelentkezés route-ja.
- Test: 7 nap → jelölt; 8 nap → nincs; heti-egy szabály; FE: `keres` poszton a CTA a bejelentkezésre visz.
- [ ] TDD → commit `feat(character): Derű adatkérése az esti kiadásban (mezo-a9bo7.16)`

### Task 19: H5 + a II. felvonás zárása

- [ ] Kapuk (teljes backend Testcontainers-szel, FE mindkét mód + build, lint-docs, CODEMAP), verify-pass sötétben, `insights.md`/`character.md` frissítés, a szülő-spec §7 7–10 pontjainál „szállítva” jelzés, merge, bead-ek zárása.
- [ ] Owner-átadás magyarul + jelzés: a következő a `mezo-a9bo7.11` (igazi érettség-görbe) — saját rövid spec + terv.

---

## Merge-stratégia

Szeletenként egy `feat/csapatfal-h<N>` ág, a ház „no-wait, net stays” szabálya szerint (lokális kapuk → `git pull --rebase` → detached-HEAD `--no-ff` merge → `push origin HEAD:main` → ág törlése → CODEMAP-regen). H1 élesen fut, de a falat nem érinti; H2 kapcsolja be a fal-oldalt. A migráció (Task 3) és a contract-változás (Task 6) kockázatos — ezekre az opcionális `premerge.yml` felhő-ellenőrzés ajánlott (CLAUDE.md).

## Beadek

A terv elfogadása után létrehozandók az epic alatt: `mezo-a9bo7.12` H1 · `.13` H2 (függ: .12) · `.14` H3 (függ: .12) · `.15` H4 (függ: .14) · `.16` H5 (függ: .12), label `epic:boop-team-feed`. A `/csapatfal` skill „The rounds” szakasza erre a tervre mutat.
