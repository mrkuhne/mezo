# U9b · Rólad — a közös kép Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/mezo/rolad` becomes the approved „közös kép” page (quote · decision inbox · facts with owner · life-event timeline · „A te kezedben” · doors); the Tudástár's inbox moves there, with a real 14-day **Most ne** snooze and a backend **fact owner**.

**Architecture:** Backend adds two nullable-then-backfilled columns (`owner` on `learned_fact`/`knowledge_fact`, `snoozed_until` on `learned_fact`/`knowledge_node`), a `snooze` decision on both candidate endpoints, and owner-aware producers. Frontend moves the inbox state from `KnowledgeListPage` into a `useRoladInbox` hook used by a rebuilt `BoopAboutPage`, with pure copy helpers in `features/insights/logic/roladCopy.ts`; the Tudástár base view shows a pointer card instead.

**Tech Stack:** Spring Boot 3 / JPA / Liquibase SQL / OpenAPI contract-first (`api/feature/*.yml` → `api/openapi.yml` → generated `api.dto` + FE `api.gen.ts`); React 19 + TanStack Query dual mode (`useDualQuery`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-rolad-kozos-kep-design.md` · **Prototype:** `docs/design_2.0/prototypes/uveg-mezo-teljes.html#rolad` (source `prototypes/src/uveg-mezo-teljes-u9.js` `rolad()`/`tudastar()`).

## Global Constraints

- Contract-first: edit `api/feature/<name>/<name>.yml`, then `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. Never hand-write boundary DTOs.
- Owner values (exact): `szunya | mocor | falat | deru | mezo`. Category default: `train→mocor`, `fuel→falat`, `health→deru`, `life→mezo`.
- Snooze duration: **14 days** (`CandidateSnooze.DURATION = Duration.ofDays(14)`).
- User-visible copy (exact, Hungarian):
  - Buttons: `Igen, jegyezd meg` · `Pontosítom` · `Most ne` · `Nem igaz`
  - Accept afterlife: `Bekerült a rólad szóló képbe — a forrásával együtt`
  - Snooze line: `Most nem került be — kb. két hét múlva újra megkérdezzük`
  - Reject line: `Nem került be — nem kérdezzük újra`
  - Quote caption: `Így fogalmaz most rólad {Név} · a legbiztosabb állítás · javítható benyomás, nem címke`
  - Quote empty: `Még gyűjtjük, amit rólad tudni érdemes — az első kimondott benyomás ide kerül.`
  - Note: `Minden, ami itt áll, forrással együtt él — és bármit elhallgattathatsz vagy pontosíthatsz. A csapat csak azt használja, amit itt jóváhagytál.`
  - Tudástár pointer: `{N} javaslat vár rád a Rólad oldalon` / sub `Ott döntesz róluk: Igen, jegyezd meg · Pontosítom · Most ne · Nem igaz`
- Icons: Titanium sprite only (`t-tick`, `t-pencil`, `t-clock`, `t-skip`, `t-note`, `t-journal`, `t-calendar`, `t-book`, `t-shield`, `t-person`, `t-chat`, `t-graph`, `t-bell`, `t-thumb-up`). No emoji. No new glyphs.
- Dark only. CSS for Rólad under the page-owned `.kr9-rolad` root in `frontend/src/styles/prototype.css` (edit with the Edit tool / a targeted script — never `sed -i` on prototype.css, bible rule 71). No second glass recipe.
- Honest states: each data layer keeps its own 404 semantics (companion 404 → `degraded`; graph 404 → `[]`; character 404 → `overview === null`); pending → GhostState, error → retry, before any count.
- FE gates: `CI=true pnpm test` with `VITE_USE_MOCK` unset AND `VITE_USE_MOCK=false`; `pnpm build`. Backend focused ITs; full suite `./mvnw clean test -Dmezo.test.use-testcontainers=true` once before merge. `node scripts/gen-codemap.mjs` after file adds.
- Commit subjects carry `(mezo-zpxv7)`; end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File Structure

**Backend**
- Create `backend/src/main/resources/db/changelog/1.1.0/script/202609261000_mezo-zpxv7_rolad_owner_snooze.sql` (+ changeSet in `1.1.0_master.yml`)
- Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/FactOwner.java` — the owner vocabulary + category default + sleep lexicon (pure, unit-tested)
- Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/CandidateSnooze.java` — the 14-day constant
- Modify `LearnedFactEntity`, `KnowledgeFactEntity` (owner + `@PrePersist` default), `LearnedFactEntity`/`GraphNodeEntity` (`snoozedUntil`)
- Modify `FactCandidateService`, `LearnedFactRepository`, `LifeEventCandidateService`, `GraphService.listCandidates`, `GraphNodeRepository`
- Modify `FactExtractionService`, `WeeklyReviewGenerator`, `WeeklyLessonService`, `CompanionMapper`, `AppNotificationKind`
- Contracts: `api/feature/companion/companion.yml`, `api/feature/knowledge-graph/knowledge-graph.yml`

**Frontend**
- Modify `src/data/types.ts`, `src/data/insights/{knowledgeApi,knowledgeHooks,knowledge,graphApi,graphHooks,graph}.ts`
- Create `src/features/insights/logic/roladCopy.ts` (+ test)
- Create `src/features/insights/hooks/useRoladInbox.ts` (+ test) — if `features/insights/hooks/` does not exist, create it (check ArchUnit-equivalent FE lint: none).
- Create `src/features/insights/components/rolad/{RoladQuote,RoladInbox,RoladFacts,RoladTimeline}.tsx` (+ tests)
- Modify `FactCandidateCard.tsx`, `LifeEventCandidateCard.tsx`, `LifeEventAcceptedCard.tsx` (+ tests)
- Rewrite `src/features/insights/pages/BoopAboutPage.tsx` (+ test)
- Modify `KnowledgeListPage.tsx`, `KnowledgeBaseView.tsx` (+ tests)
- Repoint `src/features/me/pages/WeekLessonsPage.tsx`, `src/features/me/components/WeekDiscoveries.tsx`, `src/features/me/logic/weekHighlight.ts`, `src/data/notification/feedMock.ts`
- Modify `src/app/pageIndex.ts` hints; `src/styles/prototype.css` (`.kr9-rolad` section)

**Docs:** `docs/features/insights.md`, `docs/superpowers/specs/2026-09-23-boop-team-feed-design.md` §8 note, `docs/CODEMAP.md` (regenerated).

---

### Task 1: Backend — owner vocabulary, schema, entities

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/FactOwner.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/CandidateSnooze.java`
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609261000_mezo-zpxv7_rolad_owner_snooze.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append changeSet)
- Modify: `LearnedFactEntity.java`, `KnowledgeFactEntity.java`, `feature/companion/graph/entity/GraphNodeEntity.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/entity/FactOwnerTest.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/companion/FactOwnerPersistenceIT.java`

**Interfaces:**
- Produces: `FactOwner.OWNERS: Set<String>`, `FactOwner.forCategory(String category): String`, `FactOwner.resolve(String proposed, String category): String` (valid proposed wins, else category default), `FactOwner.backfill(String category, String text): String` (category default, but `health` + sleep lexicon → `szunya`); entity getters/setters `getOwner()/setOwner(String)` on `LearnedFactEntity` + `KnowledgeFactEntity`; `getSnoozedUntil()/setSnoozedUntil(Instant)` on `LearnedFactEntity` + `GraphNodeEntity`; `CandidateSnooze.DURATION: Duration`.

- [ ] **Step 1: Write the failing unit test**

```java
package io.mrkuhne.mezo.feature.companion.entity;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class FactOwnerTest {
    @Test
    void testForCategory_shouldMapEachCategoryToItsCharacter() {
        assertThat(FactOwner.forCategory("train")).isEqualTo("mocor");
        assertThat(FactOwner.forCategory("fuel")).isEqualTo("falat");
        assertThat(FactOwner.forCategory("health")).isEqualTo("deru");
        assertThat(FactOwner.forCategory("life")).isEqualTo("mezo");
        assertThat(FactOwner.forCategory("bogus")).isEqualTo("mezo");
    }

    @Test
    void testResolve_shouldKeepValidProposal_andFallBackOnInvalid() {
        assertThat(FactOwner.resolve("szunya", "health")).isEqualTo("szunya");
        assertThat(FactOwner.resolve("SZUNYA", "health")).isEqualTo("szunya");
        assertThat(FactOwner.resolve("doki", "health")).isEqualTo("deru");
        assertThat(FactOwner.resolve(null, "fuel")).isEqualTo("falat");
    }

    @Test
    void testBackfill_shouldGiveSleepHealthFactsToSzunya() {
        assertThat(FactOwner.backfill("health", "Sleep target: 7.5h")).isEqualTo("szunya");
        assertThat(FactOwner.backfill("health", "Későn fekszem le hétvégén")).isEqualTo("szunya");
        assertThat(FactOwner.backfill("health", "Right shoulder niggle")).isEqualTo("deru");
        assertThat(FactOwner.backfill("fuel", "alvás előtt nem eszem")).isEqualTo("falat");
    }
}
```

- [ ] **Step 2: Run it — expect compile failure**

Run: `cd backend && ./mvnw -q test -Dtest=FactOwnerTest`
Expected: FAIL — `FactOwner` does not exist.

- [ ] **Step 3: Implement `FactOwner` and `CandidateSnooze`**

```java
package io.mrkuhne.mezo.feature.companion.entity;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The team character that owns a fact (U9b, mezo-zpxv7) — mirrors ck_learned_fact_owner /
 * ck_knowledge_fact_owner and the FE `TEAM` registry ids (features/insights/logic/team.ts).
 * The category is the fallback owner; the sleep lexicon only exists for the one-time backfill
 * (the SQL migration applies the same regex) — live producers name the owner themselves.
 */
public final class FactOwner {

    public static final Set<String> OWNERS = Set.of("szunya", "mocor", "falat", "deru", "mezo");

    private static final Map<String, String> BY_CATEGORY =
            Map.of("train", "mocor", "fuel", "falat", "health", "deru", "life", "mezo");

    /** Same alternation as the migration's `~*` backfill regex. */
    static final Pattern SLEEP = Pattern.compile("alv|alsz|lefekv|fekszel|fekszem|ébred|sleep|bed", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private FactOwner() {
    }

    public static String forCategory(String category) {
        return BY_CATEGORY.getOrDefault(category, "mezo");
    }

    public static String resolve(String proposed, String category) {
        if (proposed != null) {
            String lower = proposed.trim().toLowerCase(Locale.ROOT);
            if (OWNERS.contains(lower)) {
                return lower;
            }
        }
        return forCategory(category);
    }

    public static String backfill(String category, String text) {
        if ("health".equals(category) && text != null && SLEEP.matcher(text).find()) {
            return "szunya";
        }
        return forCategory(category);
    }
}
```

```java
package io.mrkuhne.mezo.feature.companion.service;

import java.time.Duration;

/** „Most ne” (U9b, mezo-zpxv7): a snoozed candidate leaves the inbox for this long, then is re-offered. */
public final class CandidateSnooze {
    public static final Duration DURATION = Duration.ofDays(14);

    private CandidateSnooze() {
    }
}
```

- [ ] **Step 4: Run the unit test — expect PASS**

Run: `cd backend && ./mvnw -q test -Dtest=FactOwnerTest` → PASS.

- [ ] **Step 5: Write the migration**

`202609261000_mezo-zpxv7_rolad_owner_snooze.sql`:

```sql
-- U9b (mezo-zpxv7): Rólad — a közös kép. Fact owner (the team character a fact belongs to) and
-- the „Most ne” snooze on both candidate kinds. Backfill mirrors FactOwner.backfill().
alter table learned_fact add column owner varchar(16);
alter table knowledge_fact add column owner varchar(16);

update learned_fact set owner = case category
    when 'train' then 'mocor' when 'fuel' then 'falat' when 'health' then 'deru' else 'mezo' end;
update knowledge_fact set owner = case category
    when 'train' then 'mocor' when 'fuel' then 'falat' when 'health' then 'deru' else 'mezo' end;
update learned_fact set owner = 'szunya'
    where category = 'health' and candidate_text ~* '(alv|alsz|lefekv|fekszel|fekszem|ébred|sleep|bed)';
update knowledge_fact set owner = 'szunya'
    where category = 'health' and fact_text ~* '(alv|alsz|lefekv|fekszel|fekszem|ébred|sleep|bed)';

alter table learned_fact alter column owner set not null;
alter table knowledge_fact alter column owner set not null;
alter table learned_fact add constraint ck_learned_fact_owner
    check (owner in ('szunya', 'mocor', 'falat', 'deru', 'mezo'));
alter table knowledge_fact add constraint ck_knowledge_fact_owner
    check (owner in ('szunya', 'mocor', 'falat', 'deru', 'mezo'));

alter table learned_fact add column snoozed_until timestamptz;
alter table knowledge_node add column snoozed_until timestamptz;
```

Verify the fact-text column names first: `grep -n "fact_text\|candidate_text" backend/src/main/resources/db/changelog -r | head` (must be `knowledge_fact.fact_text`, `learned_fact.candidate_text`). No `?` in the SQL (Liquibase/JDBC placeholder trap).

Append to `1.1.0_master.yml`:

```yaml
  - changeSet:
      id: "1.1.0:202609261000_mezo-zpxv7_rolad_owner_snooze"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609261000_mezo-zpxv7_rolad_owner_snooze.sql
```

- [ ] **Step 6: Entities**

`LearnedFactEntity` and `KnowledgeFactEntity` each get:

```java
    /** U9b (mezo-zpxv7): the team character that owns this fact — mirrors ck_*_owner. A producer
     *  that names none gets the category default at persist time (never null in the DB). */
    @Size(max = 16)
    @Pattern(regexp = "szunya|mocor|falat|deru|mezo")
    @Column(nullable = false, length = 16)
    private String owner;

    @PrePersist
    void defaultOwner() {
        if (owner == null) {
            owner = FactOwner.forCategory(category);
        }
    }
```

(`import jakarta.persistence.PrePersist;` — if the entity or `OwnedEntity` already has a `@PrePersist`, add the owner line into that method instead; JPA allows one per class.)

`LearnedFactEntity` and `GraphNodeEntity` each get:

```java
    /** „Most ne” (U9b): hidden from the pending inbox until this instant; null = not snoozed. */
    @Column(name = "snoozed_until")
    private Instant snoozedUntil;
```

- [ ] **Step 7: Persistence IT (default owner + backfill regex parity)**

```java
package io.mrkuhne.mezo.feature.companion;

// imports: AbstractIntegrationTest, DatabasePopulator, LearnedFactPopulator, KnowledgeFactRepository,
// KnowledgeFactEntity, LearnedFactEntity, Test, Autowired, Transactional, UUID, assertThat
@Transactional
class FactOwnerPersistenceIT extends AbstractIntegrationTest {
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;

    @Test
    void testPersist_shouldDefaultOwnerFromCategory_whenProducerNamesNone() {
        UUID userId = databasePopulator.populateUser("owner-default@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Szeretem a zabkását", "fuel", null);
        assertThat(candidate.getOwner()).isEqualTo("falat");

        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText("Kedden röplabda");
        fact.setCategory("train");
        fact.setSource(KnowledgeFactEntity.SOURCE_MANUAL);
        assertThat(knowledgeFactRepository.saveAndFlush(fact).getOwner()).isEqualTo("mocor");
    }
}
```

- [ ] **Step 8: Run** `cd backend && ./mvnw -q test -Dtest='FactOwnerTest,FactOwnerPersistenceIT,FactCandidateServiceIT'` → PASS (the Liquibase changelog must apply cleanly inside the IT context).

- [ ] **Step 9: Commit** `feat(companion): fact owner + candidate snooze columns (mezo-zpxv7)`

---

### Task 2: Contract — owner on the wire, `snooze` decision

**Files:**
- Modify: `api/feature/companion/companion.yml` (`KnowledgeFactResponse`, `FactCandidateResponse`, `FactDecisionRequest`)
- Modify: `api/feature/knowledge-graph/knowledge-graph.yml` (`GraphCandidateDecisionRequest`)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/.../companion/mapper/CompanionMapper.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionFactCandidateApiIT.java`

**Interfaces:**
- Produces: wire `owner: 'szunya'|'mocor'|'falat'|'deru'|'mezo'` (required) on `KnowledgeFactResponse` and `FactCandidateResponse`; `FactDecisionRequest.decision` accepts `snooze`; `GraphCandidateDecisionRequest.decision` accepts `snooze`.

- [ ] **Step 1: Edit the contracts**

`companion.yml` — `KnowledgeFactResponse.required` gains `owner`; add property:

```yaml
        owner: { type: string, enum: [szunya, mocor, falat, deru, mezo], description: "U9b (mezo-zpxv7): the team character that owns the fact — the Rólad tag. User-authored facts are shown as TŐLED by the FE from `source`, not from this field." }
```

`FactCandidateResponse.required` gains `owner`; same property (description: `the character that brought the candidate — „<Név> hozta”`). `userDecision` description gains nothing (snooze never sets it).
`FactDecisionRequest.decision`: `pattern: '^(accept|reject|refine|snooze)$'`, description `snooze = „Most ne”: hidden for 14 days, then re-offered; stays undecided`.

`knowledge-graph.yml` — `GraphCandidateDecisionRequest.decision`: `pattern: '^(accept|reject|snooze)$'`.

- [ ] **Step 2: Regenerate**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` and `api.gen.ts` diff shows only the owner/snooze changes.

- [ ] **Step 3: Mapper** — in `CompanionMapper.toKnowledgeFactResponse(...)` add `.owner(KnowledgeFactResponse.OwnerEnum.fromValue(entity.getOwner()))` and in `toFactCandidateResponse` `.owner(FactCandidateResponse.OwnerEnum.fromValue(entity.getOwner()))`. (Check the generated enum name in `backend/target/generated-sources/openapi/.../api/dto/KnowledgeFactResponse.java` after `./mvnw -q compile`; adjust the call to the generated name.)

- [ ] **Step 4: Failing API assertion** — in `CompanionFactCandidateApiIT`, add to the existing list test (or a new test) that the JSON of `GET /api/companion/fact/candidate` has `$[0].owner` equal to the category default of the populated candidate (e.g. category `fuel` → `"falat"`), and `GET /api/companion/fact` returns `$[0].owner`.

- [ ] **Step 5: Run** `cd backend && ./mvnw -q test -Dtest='CompanionFactCandidateApiIT,KnowledgeFact*IT'` → PASS. FE: `cd frontend && pnpm exec tsc -b` must still compile (new required wire field is unused yet — fine).

- [ ] **Step 6: Commit** `feat(api): fact owner on the wire + snooze decision (mezo-zpxv7)`

---

### Task 3: Backend — fact-candidate snooze

**Files:**
- Modify: `FactCandidateService.java`, `repository/LearnedFactRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/FactCandidateServiceIT.java`

**Interfaces:**
- Consumes: `CandidateSnooze.DURATION`, `LearnedFactEntity.snoozedUntil`.
- Produces: `LearnedFactEntity.DECISION_SNOOZE = "snooze"`; `listPending` excludes snoozed-until-future rows.

- [ ] **Step 1: Failing tests** (add to `FactCandidateServiceIT`)

```java
    @Test
    void testDecide_shouldHideCandidateButKeepItUndecided_whenSnoozed() {
        UUID userId = databasePopulator.populateUser("candidate-snooze@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Randizom valakivel", "life", null);

        FactCandidateResponse decided = factCandidateService.decide(userId, candidate.getId(), decision("snooze", null));

        assertThat(decided.getUserDecision()).isNull();
        assertThat(factCandidateService.listPending(userId)).isEmpty();
        assertThat(knowledgeFactRepository.findAll()).noneMatch(f -> "Randizom valakivel".equals(f.getFactText()));
    }

    @Test
    void testListPending_shouldReofferCandidate_whenSnoozeHasExpired() {
        UUID userId = databasePopulator.populateUser("candidate-snooze-due@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Hétvégén később eszem", "fuel", null);
        candidate.setSnoozedUntil(Instant.now().minusSeconds(60));

        assertThat(factCandidateService.listPending(userId)).extracting(FactCandidateResponse::getCandidateText)
                .containsExactly("Hétvégén később eszem");
    }

    @Test
    void testDecide_shouldStillAccept_whenCandidateWasSnoozed() {
        UUID userId = databasePopulator.populateUser("candidate-snooze-accept@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Reggel edzek", "train", null);
        factCandidateService.decide(userId, candidate.getId(), decision("snooze", null));

        FactCandidateResponse accepted = factCandidateService.decide(userId, candidate.getId(), decision("accept", null));

        assertThat(accepted.getUserDecision()).isEqualTo("accept");
        assertThat(accepted.getPromotedFactId()).isNotNull();
    }
```

(`import java.time.Instant;`) Also add to the accept test: the promoted `KnowledgeFactEntity.getOwner()` equals the candidate's owner.

- [ ] **Step 2: Run** `./mvnw -q test -Dtest=FactCandidateServiceIT` → the three new tests FAIL (snooze hits the `default ->` 400 branch; `listPending` still lists).

- [ ] **Step 3: Implement**

`LearnedFactEntity`: `public static final String DECISION_SNOOZE = "snooze";`

`LearnedFactRepository` — add:

```java
    @Query("select c from LearnedFactEntity c where c.createdBy = :userId and c.userDecision is null"
            + " and c.deleted = false and (c.snoozedUntil is null or c.snoozedUntil <= :now)"
            + " order by c.createdAt desc")
    List<LearnedFactEntity> findPendingVisible(@Param("userId") UUID userId, @Param("now") Instant now);
```

(Match the entity's actual deleted-field name — `deleted` per the existing derived query `...AndDeletedFalse...`.) Keep the old derived query: `FactExtractionService` dedupe must still see snoozed candidates so the chat never re-proposes them.

`FactCandidateService.listPending` → `learnedFactRepository.findPendingVisible(userId, Instant.now())`.

`decide`: before the switch,

```java
        if (LearnedFactEntity.DECISION_SNOOZE.equals(request.getDecision())) {
            // „Most ne” (U9b): not a decision — the candidate stays open and returns in 14 days.
            candidate.setSnoozedUntil(Instant.now().plus(CandidateSnooze.DURATION));
            return mapper.toFactCandidateResponse(learnedFactRepository.saveAndFlush(candidate));
        }
```

`promote(...)`: `fact.setOwner(candidate.getOwner());`

- [ ] **Step 4: Run** `./mvnw -q test -Dtest='FactCandidateServiceIT,CompanionFactCandidateApiIT'` → PASS.

- [ ] **Step 5: Commit** `feat(companion): „Most ne” snooze for fact candidates (mezo-zpxv7)`

---

### Task 4: Backend — life-event / season candidate snooze

**Files:**
- Modify: `graph/service/LifeEventCandidateService.java`, `graph/service/GraphService.java:237`, `graph/repository/GraphNodeRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphCandidateApiIT.java`

- [ ] **Step 1: Failing tests** (follow the file's existing API-call helpers)

```java
    @Test
    void testDecideGraphCandidate_shouldHideAndKeepCandidate_whenSnoozed() {
        // populate a LIFE_EVENT candidate exactly like testListGraphCandidates_shouldReturnOnlyCandidates_*
        // POST /api/companion/graph/node/{id}/decision {"decision":"snooze"} → 200, body.status == "candidate"
        // GET  /api/companion/graph/node/candidate → does not contain id
        // node reloaded from repository: status candidate, snoozedUntil ≈ now + 14 days, not deleted, no edges
    }

    @Test
    void testListGraphCandidates_shouldReofferNode_whenSnoozeExpired() {
        // candidate with snoozedUntil = now - 1 min → listed again
    }
```

Write them out fully in the file's own idiom (mockMvc/rest helper already used by the neighbouring tests); assert with exact JSON paths.

- [ ] **Step 2: Run** → FAIL (decision pattern currently rejected at validation → 400, which Task 2 already relaxed; service then treats non-reject as accept — the test catches that status becomes `active`).

- [ ] **Step 3: Implement**

`GraphNodeRepository`:

```java
    @Query("select n from GraphNodeEntity n where n.createdBy = :userId and n.status = :status"
            + " and n.deleted = false and (n.snoozedUntil is null or n.snoozedUntil <= :now)"
            + " order by n.createdAt desc")
    List<GraphNodeEntity> findVisibleByStatus(@Param("userId") UUID userId, @Param("status") String status, @Param("now") Instant now);
```

`GraphService.listCandidates` → `nodeRepository.findVisibleByStatus(userId, GraphNodeEntity.STATUS_CANDIDATE, Instant.now())`. Grep other callers of `listCandidates` (`grep -rn "listCandidates(" backend/src/main`): any extractor dedupe that must still see snoozed nodes keeps using the old repository method directly.

`LifeEventCandidateService.decide`, after the already-decided guard:

```java
        if ("snooze".equals(request.getDecision())) {
            node.setSnoozedUntil(Instant.now().plus(CandidateSnooze.DURATION));
            return graphMapper.toResponse(nodeRepository.saveAndFlush(node));
        }
```

- [ ] **Step 4: Run** `./mvnw -q test -Dtest='GraphCandidateApiIT,GraphSwitchOffIT'` → PASS.

- [ ] **Step 5: Commit** `feat(graph): „Most ne” snooze for life-event and season candidates (mezo-zpxv7)`

---

### Task 5: Backend — producers name the owner; deeplinks point to Rólad

**Files:**
- Modify: `FactExtractionService.java` (prompt + `ExtractedFact` + persist), `proactive/service/WeeklyReviewGenerator.java:103,145,409`, `proactive/service/WeeklyLessonService.java` (`LessonProposal`, persist), `appnotification/domain/AppNotificationKind.java:20,45`
- Test: `FactExtractionServiceIT.java`, `WeeklyReviewGeneratorIT.java` (or `WeeklyLessonService` IT if present), `AppNotificationKind` test if present (`grep -rln "GRAPH_CANDIDATE" backend/src/test`)

- [ ] **Step 1: Failing tests**
  - `FactExtractionServiceIT`: the fake LLM echoes the sentinel JSON — feed `[{"fact":"Hétvégén később fekszem le","category":"health","owner":"szunya"}]` → persisted candidate owner `szunya`; feed `[{"fact":"Szeretem a zabot","category":"fuel","owner":"doki"}]` → owner `falat` (invalid falls back, fact still kept); feed without owner → category default.
  - Weekly: a proposal with `owner: "szunya"` persists with `szunya`; without → default.
  - Deeplinks: `AppNotificationKind.FACT_CANDIDATE.deeplink()` and `GRAPH_CANDIDATE.deeplink()` equal `/mezo/rolad`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**
  - `EXTRACTION_PROMPT` line becomes `[{"fact":"...","category":"train|fuel|health|life","owner":"szunya|mocor|falat|deru|mezo"}]` and add one line above it: `Az owner a csapat azon tagja, akihez a tény tartozik: szunya = alvás, mocor = mozgás/edzés, falat = étkezés, deru = közérzet és test, mezo = élet és minden más.` (keep the prompt's first word `TÉNYKINYERÉS` — the fake LLM keys on it).
  - `record ExtractedFact(String fact, String category, String owner) {}`; persist `candidate.setOwner(FactOwner.resolve(fact.owner(), fact.category()));`
  - `WeeklyReviewGenerator` prompt fragment (line 103) gains `"owner": "szunya|mocor|falat|deru|mezo"` with the same one-line gloss; `ParsedCandidate(String text, String category, String evidence, String owner)`; line 409 passes `c.owner()`.
  - `LessonProposal(String text, String category, String evidence, String owner)`; persist `candidate.setOwner(FactOwner.resolve(proposal.owner(), proposal.category()));`. Update every `new LessonProposal(` call site in tests (compile will point at them).
  - `AppNotificationKind`: `FACT_CANDIDATE("fact_candidate", "knowledge", "/mezo/rolad")`, `GRAPH_CANDIDATE("graph_candidate", null, "/mezo/rolad")`. Check `AppNotificationKind` javadoc/tests for the old paths and update them.

- [ ] **Step 4: Run** `./mvnw -q test -Dtest='FactExtractionServiceIT,WeeklyReviewGeneratorIT,WeeklyReviewControllerIT,*AppNotification*'` → PASS.

- [ ] **Step 5: Commit** `feat(companion): producers name the fact owner; candidate alerts open Rólad (mezo-zpxv7)`

---

### Task 6: Frontend data layer — owner, snooze, who/when, timeline dates

**Files:**
- Modify: `src/data/types.ts:792,838-863,867-880,890-901`
- Modify: `src/data/insights/knowledgeApi.ts`, `knowledgeHooks.ts`, `knowledge.ts` (seeds), `graphApi.ts`, `graphHooks.ts`, `graph.ts` (seeds)
- Test: `src/data/insights/knowledgeApi.test.ts`, `graphApi.test.ts`, `knowledgeHooks.test.tsx`, `graphHooks.test.tsx` (create the ones that do not exist next to the module; follow an existing `*Hooks.test.tsx` in `src/data` for the QueryClient wrapper)

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type FactSource = 'chat' | 'pattern' | 'manual' | 'weekly_review' | 'question'
  export type FactOwner = 'szunya' | 'mocor' | 'falat' | 'deru' | 'mezo'
  // KnowledgeFact gains: owner: FactOwner
  // FactCandidate gains: owner: FactOwner; source: 'chat' | 'weekly_review'; createdAt: string; evidence: string | null; weekStart: string | null
  export type FactDecision = 'accept' | 'reject' | 'refine' | 'snooze'
  // LifeEventCandidate gains: createdAt: string
  export type LifeEventDecision = 'accept' | 'reject' | 'snooze'
  // KnowledgeGraphNode gains: occurredOn: string | null
  ```
- `useLifeEventActions().decide(id, 'accept')` in real mode invalidates BOTH `['graph','candidates']` and `['graph','nodes']`.

- [ ] **Step 1: Failing tests**
  - `toFactCandidate` keeps `owner`, `source`, `createdAt`, `evidence ?? null`, `weekStart ?? null`; `conflictsWithFactId` stays `null`.
  - `toKnowledgeFact` keeps `owner`.
  - `toLifeEventCandidate` keeps `createdAt`; `toKnowledgeGraphNode` keeps `occurredOn ?? null`.
  - mock `decide(id,'snooze')` (facts): candidate leaves `candidates`, no fact is added.
  - mock life-event `decide(id,'snooze')`: candidate leaves the candidates cache, nodes cache unchanged.
  - real-mode life-event accept: `invalidateQueries` called with `['graph','nodes']` too (spy on the QueryClient).

- [ ] **Step 2: Run** `cd frontend && CI=true pnpm test` → the new tests FAIL (file filters do not scope — read the failures by name).

- [ ] **Step 3: Implement**
  - types per the interface block.
  - `toFactCandidate`: `{ id, text: c.candidateText, category, owner: c.owner, source: c.source as FactCandidate['source'], createdAt: c.createdAt, evidence: c.evidence ?? null, weekStart: c.weekStart ?? null, conflictsWithFactId: null }`.
  - `toKnowledgeFact`: `owner: f.owner`.
  - `mockDecide` (knowledge): `if (input.decision === 'reject' || input.decision === 'snooze') return { ...base, candidates: remaining }`; promoted fact carries `owner: candidate.owner`.
  - graph `mockDecide`: `if (decision !== 'accept' || !candidate) return` already covers snooze (it only removes); promoted node gets `occurredOn: candidate.occurredOn`.
  - real `onSuccess`: `() => { qc.invalidateQueries({ queryKey: GRAPH_CANDIDATE_KEY }); qc.invalidateQueries({ queryKey: GRAPH_NODE_KEY }) }`.
  - Seeds: every `facts` item gets an owner (f5 „Sleep target” → `szunya`; health others → `deru`; train → `mocor`; fuel → `falat`; life → `mezo`); `candidateSeed` c1 `{owner:'falat', source:'chat', createdAt: <today-ish fixed ISO>, evidence:null, weekStart:null}`, c2 `owner:'szunya'`, c3 `owner:'mocor'`; `lifeEventCandidateSeed` items get `createdAt`; `graphNodeSeed` items get `occurredOn` (LIFE_EVENT: a date; SEASON: quarter first day; others `null`). Use fixed ISO strings, not `Date.now()` (midnight-fragile fixtures rule).
  - `originChipLabel`/`originSentence` in `features/insights/logic/factCopy.ts`: add `weekly_review` („heti áttekintésből”) and `question` („kérdésre válaszoltál”) branches so no source returns `undefined`; extend `factCopy.test.ts`.

- [ ] **Step 4: Run** `CI=true pnpm test` and `VITE_USE_MOCK=false CI=true pnpm test` → PASS; `pnpm exec tsc -b` clean.

- [ ] **Step 5: Commit** `feat(insights): owner, snooze and who/when in the knowledge data layer (mezo-zpxv7)`

---

### Task 7: Pure copy helpers — `roladCopy.ts`

**Files:**
- Create: `src/features/insights/logic/roladCopy.ts`, `src/features/insights/logic/roladCopy.test.ts`

**Interfaces:**
- Consumes: `TEAM`, `characterForPersona` (`logic/team.ts`), `lastSeenLabel` (`logic/metricFormat.ts`), `CharacterOverviewResponse` type (from `@/data/_client/api.gen` `components['schemas']`).
- Produces:
  ```ts
  export interface RoladQuoteClaim { id: string; text: string; character: TeamCharacterId }
  export function pickQuoteClaim(overview: CharacterOverviewResponse | null): RoladQuoteClaim | null
  export interface OwnerTag { label: string; accent: TeamCharacter['accent'] }
  export function factOwnerTag(fact: Pick<KnowledgeFact, 'owner' | 'source'>): OwnerTag
  export function candidateByline(owner: FactOwner | 'mezo', createdAtIso: string): string
  export function topRoladFacts(facts: KnowledgeFact[], n?: number): KnowledgeFact[]
  export const ROLAD_COPY: { keep: string; snooze: string; reject: string; quoteEmpty: string; note: string }
  ```

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { candidateByline, factOwnerTag, pickQuoteClaim, topRoladFacts, ROLAD_COPY } from './roladCopy'

const claim = (id: string, confidence: number, proposedBy: string, sensitive = false) =>
  ({ id, text: `t-${id}`, confidence, sensitive, proposedBy, evidence: [] })

describe('pickQuoteClaim', () => {
  it('returns the highest-confidence non-sensitive claim across dimensions, with its character', () => {
    const overview = { dimensions: [
      { key: 'a', title: 'A', kind: 'CORE', maturity: 40, portrait: '', topClaims: [claim('1', 0.6, 'edzo')] },
      { key: 'b', title: 'B', kind: 'CORE', maturity: 70, portrait: '', topClaims: [claim('2', 0.9, 'szomnologus'), claim('3', 0.95, 'doki', true)] },
    ] }
    expect(pickQuoteClaim(overview as never)).toEqual({ id: '2', text: 't-2', character: 'szunya' })
  })
  it('is null without an overview or without any claim', () => {
    expect(pickQuoteClaim(null)).toBeNull()
    expect(pickQuoteClaim({ dimensions: [] } as never)).toBeNull()
  })
})

describe('factOwnerTag', () => {
  it('says TŐLED for user-authored sources, otherwise the owner name in capitals', () => {
    expect(factOwnerTag({ owner: 'falat', source: 'manual' })).toEqual({ label: 'TŐLED', accent: 'gold' })
    expect(factOwnerTag({ owner: 'falat', source: 'question' }).label).toBe('TŐLED')
    expect(factOwnerTag({ owner: 'szunya', source: 'chat' })).toEqual({ label: 'SZUNYA', accent: 'lav' })
    expect(factOwnerTag({ owner: 'deru', source: 'pattern' }).label).toBe('DERŰ')
  })
})

describe('candidateByline', () => {
  it('names who brought it and when', () => {
    expect(candidateByline('falat', new Date().toISOString())).toBe('Falat hozta · ma')
    expect(candidateByline('mezo', '2026-03-02T09:00:00Z')).toMatch(/^Mezo hozta · /)
  })
})

describe('topRoladFacts', () => {
  it('keeps active facts, most recently reinforced first, max 4', () => {
    const f = (id: string, active: boolean, last: string | null, created: string) =>
      ({ id, text: id, category: 'life', active, reinforced: 1, source: 'chat', owner: 'mezo', lastReinforcedAt: last, createdAt: created })
    const list = [f('a', true, null, '2026-01-01T00:00:00Z'), f('b', false, '2026-09-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      f('c', true, '2026-08-01T00:00:00Z', '2026-01-01T00:00:00Z'), f('d', true, '2026-09-10T00:00:00Z', '2026-01-01T00:00:00Z'),
      f('e', true, null, '2026-09-20T00:00:00Z'), f('g', true, null, '2026-02-01T00:00:00Z')]
    expect(topRoladFacts(list as never).map((x) => x.id)).toEqual(['e', 'd', 'c', 'g'])
  })
})

it('keeps the approved copy verbatim', () => {
  expect(ROLAD_COPY.keep).toBe('Bekerült a rólad szóló képbe — a forrásával együtt')
  expect(ROLAD_COPY.snooze).toBe('Most nem került be — kb. két hét múlva újra megkérdezzük')
  expect(ROLAD_COPY.reject).toBe('Nem került be — nem kérdezzük újra')
})
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
/**
 * Rólad — a közös kép (U9b, mezo-zpxv7): the page's user-facing sentences and picks, pure and
 * tested (the factCopy / CANDIDATE_COPY idiom). No invented sentence (ADR 0049): the quote is a
 * real character claim or nothing.
 */
import type { components } from '@/data/_client/api.gen'
import type { FactOwner, KnowledgeFact } from '@/data/types'
import { characterForPersona, TEAM, type TeamCharacter, type TeamCharacterId } from '@/features/insights/logic/team'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'

type CharacterOverviewResponse = components['schemas']['CharacterOverviewResponse']

export const ROLAD_COPY = {
  keep: 'Bekerült a rólad szóló képbe — a forrásával együtt',
  snooze: 'Most nem került be — kb. két hét múlva újra megkérdezzük',
  reject: 'Nem került be — nem kérdezzük újra',
  quoteEmpty: 'Még gyűjtjük, amit rólad tudni érdemes — az első kimondott benyomás ide kerül.',
  note: 'Minden, ami itt áll, forrással együtt él — és bármit elhallgattathatsz vagy pontosíthatsz. A csapat csak azt használja, amit itt jóváhagytál.',
} as const

export interface RoladQuoteClaim { id: string; text: string; character: TeamCharacterId }

export function pickQuoteClaim(overview: CharacterOverviewResponse | null): RoladQuoteClaim | null {
  if (!overview) return null
  let best: { id: string; text: string; confidence: number; proposedBy?: string } | null = null
  for (const d of overview.dimensions) {
    for (const c of d.topClaims) {
      if (c.sensitive) continue
      if (!best || c.confidence > best.confidence) best = c
    }
  }
  return best ? { id: best.id, text: best.text, character: characterForPersona(best.proposedBy ?? 'mezo') } : null
}

export interface OwnerTag { label: string; accent: TeamCharacter['accent'] }

const USER_AUTHORED = new Set(['manual', 'question'])

export function factOwnerTag(fact: Pick<KnowledgeFact, 'owner' | 'source'>): OwnerTag {
  if (USER_AUTHORED.has(fact.source)) return { label: 'TŐLED', accent: 'gold' }
  const ch = TEAM[fact.owner]
  return { label: ch.name.toLocaleUpperCase('hu-HU'), accent: ch.accent }
}

export function candidateByline(owner: FactOwner, createdAtIso: string): string {
  const day = lastSeenLabel(localDay(createdAtIso)) ?? ''
  return `${TEAM[owner].name} hozta · ${day}`
}

function localDay(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function topRoladFacts(facts: KnowledgeFact[], n = 4): KnowledgeFact[] {
  const key = (f: KnowledgeFact) => f.lastReinforcedAt ?? f.createdAt
  return facts.filter((f) => f.active).sort((a, b) => key(b).localeCompare(key(a))).slice(0, n)
}
```

(If `lastSeenLabel` already has a date helper for instants — e.g. `localDateString` in `@/shared/lib` — use that instead of `localDay`.)

- [ ] **Step 4: Run** `CI=true pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat(insights): Rólad copy + picks as pure helpers (mezo-zpxv7)`

---

### Task 8: Decision cards — four actions, byline, afterlife

**Files:**
- Modify: `src/features/insights/components/FactCandidateCard.tsx`, `LifeEventCandidateCard.tsx`
- Test: `FactCandidateCard.test.tsx`, `LifeEventCandidateCard.test.tsx`

**Interfaces:**
- `FactCandidateCard` props unchanged (`candidate`, `onDecide(decision, refinedText?)`, `conflictFact?`, `onToggleConflict?`); `LifeEventCandidateCard` props unchanged. Both render: status row `Tényjelölt` / `Életesemény-jelölt` / `Évszak-jelölt` + `<em>{candidateByline(...)}</em>` (life events: `candidateByline('mezo', candidate.createdAt)`); buttons in this order: `Igen, jegyezd meg` (is-main, `t-tick`) · `Pontosítom` (`t-pencil`, opens the existing inline refine) · `Most ne` (`t-clock`, calls `onDecide('snooze')`) · `Nem igaz` (quiet text button, class `tud9-no`, calls `onDecide('reject')`).
- Refine save button label: `Így jegyezd meg`. The conflict toggle still fires only on accept/refine (never snooze/reject).
- Remove the old footer sentence (`Elfogad → …`); the why-line stays: fact → `candidate.evidence ?? 'A beszélgetésből szűrtük ki — csak akkor jegyezzük meg, ha elfogadod.'` (weekly: evidence); life event → existing `CANDIDATE_COPY` line.

- [ ] **Step 1: Update tests first** — replace `Elfogad`/`Pontosít`/`Elvet` queries with the new names; add:
  - `Most ne` calls `onDecide('snooze')` and does NOT call `onToggleConflict` even with a conflict + ticked box;
  - `Nem igaz` calls `onDecide('reject')`;
  - the byline reads `Falat hozta · ma` for a candidate `{owner:'falat', createdAt: now}`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the markup per the interface block (keep `data-fact-candidate`, `glass tf-case tf-c-gold tf-s-gold tud9-case tud9-cand`, the `tud9-acts` grid; `Nem igaz` is `<button type="button" className="tud9-no">` spanning the full row).
- [ ] **Step 4: Run** both modes → PASS.
- [ ] **Step 5: Commit** `feat(insights): decision cards — Igen / Pontosítom / Most ne / Nem igaz (mezo-zpxv7)`

---

### Task 9: `useRoladInbox` — the inbox state leaves the Tudástár

**Files:**
- Create: `src/features/insights/hooks/useRoladInbox.ts`, `useRoladInbox.test.tsx`

**Interfaces:**
- Consumes: `useKnowledge`, `useKnowledgeActions`, `useLifeEventCandidates`, `useLifeEventActions` from `@/data/hooks`.
- Produces:
  ```ts
  export type Settled = { id: string; kind: 'FACT' | 'LIFE_EVENT' | 'SEASON'; title: string; outcome: 'keep' | 'snooze' | 'reject'; edgeCount: number }
  export function useRoladInbox(): {
    facts: KnowledgeFact[]; candidates: FactCandidate[]; lifeEvents: LifeEventCandidate[]
    settled: Settled[]; degraded: boolean; isPending: boolean; isError: boolean; refetch: () => void
    decideFact: (c: FactCandidate, decision: FactDecision, refinedText?: string) => void
    decideLifeEvent: (c: LifeEventCandidate, decision: LifeEventDecision, refined?: { title?: string; summary?: string }) => void
    toggleFact: (id: string, active: boolean) => void
  }
  ```
  `settled` is page-level state (the old `acceptedEvents` idea, now for every outcome) so the afterlife line survives the refetch; `candidates`/`lifeEvents` exclude ids already in `settled` (hides the real-mode refetch window).

- [ ] **Step 1: Failing tests** (mock mode, QueryClient wrapper): deciding a fact candidate `keep` → it leaves `candidates` and appears in `settled` with outcome `keep` and the refined text as title when refined; `snooze` on a life event → leaves `lifeEvents`, `settled` outcome `snooze`; `degraded`/`isPending`/`isError` pass through from `useKnowledge`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (map `accept`/`refine` → `keep`, `snooze` → `snooze`, `reject` → `reject`; append to `settled` BEFORE calling the mutation).
- [ ] **Step 4: Run** both modes → PASS.
- [ ] **Step 5: Commit** `feat(insights): useRoladInbox — the decision inbox as one hook (mezo-zpxv7)`

---

### Task 10: The Rólad page

**Files:**
- Create: `src/features/insights/components/rolad/RoladQuote.tsx`, `RoladInbox.tsx`, `RoladFacts.tsx`, `RoladTimeline.tsx` (+ one test file each)
- Rewrite: `src/features/insights/pages/BoopAboutPage.tsx`, `BoopAboutPage.test.tsx`
- Modify: `src/styles/prototype.css` — the `.kr9-rolad` section (next to line ~28321) and the inbox card rules (`.tud9 .tud9-acts|tud9-btn|tud9-refine|tud9-chk|tud9-conflict…`, ~28631): re-scope them to `.kr9-rolad` (the Tudástár no longer renders cards); run `grep -rn "tud9-acts\|tud9-btn" src` to confirm every consumer is now under `.kr9-rolad`. Update `src/styles/prototypeCssStructure.test.ts` if it pins section order/names (`grep -rn "kr9\|tud9" src/styles/*.test.ts`).

**Page order (prototype `rolad()`):**
1. `<header className="tf-head kr9-rhead">` — eyebrow `A közös kép · amit a csapat kimondott rólad`, h1 `Rólad`, `<Boop domain="me" size={64} alive />`.
2. Week banner — only when `?start=` matches `^\d{4}-\d{2}-\d{2}$`: `data-week-banner`, text `Heti áttekintés · {start}. A héten felmerült javaslatok is itt vannak.`, `<Link to={`/me/week?start=${start}`}>Vissza ehhez a héthez →</Link>`.
3. `RoladQuote` — `useCharacterOverview()` → `pickQuoteClaim`. `overview === null` → render nothing. No claim → `.glass tf-note` empty with `ROLAD_COPY.quoteEmpty`. Claim → `.glass kr9-quote tf-c-rose`: `<p>„{text}”</p>`, caption `Így fogalmaz most rólad <b>{TEAM[character].name}</b> · a legbiztosabb állítás · javítható benyomás, nem címke`, buttons `Talál` (`useClaimFeedback().submit(id,'TALAL')`, then shows `Megerősítetted — a benyomás erősödik`) and `Pontosítom` (toggles `<CharacterReplyThread source={{ sourceType: 'CLAIM', sourceId: id, sourceIndex: 0 }} initialOpen />` — the `ClaimTile.tsx:67,82` pattern).
4. `RoladInbox` — section head `Döntésre vár` + hint `{open} JELÖLT` (or `MIND ELDÖNTVE` when only settled items remain). Loading → `GhostState message="A javaslatok betöltése…"`; `isError` → `GhostState … ctaLabel="Újra" onCta={refetch}`; `degraded` → `tf-dash` „A társ jelenleg nincs bekapcsolva — a tényjavaslatok most nem elérhetők.” but life-event/season cards still render. Cards: `FactCandidateCard` (with `conflictFact` from `facts`, `onToggleConflict={toggleFact}`), `LifeEventCandidateCard`. Settled items: `keep` → `LifeEventAcceptedCard` for graph kinds / a sage `tf-case` with `ROLAD_COPY.keep` for facts; `snooze`/`reject` → `.kr9-gone` dashed row with `t-clock`/`t-skip` and `ROLAD_COPY.snooze|reject`. Nothing open and nothing settled → `<p className="kr9-quiet">Nincs döntésre váró javaslat.</p>`.
5. `RoladFacts` — hidden when `degraded` or no active facts. Head `A tények rólad` + `{active count} AKTÍV`; `topRoladFacts(facts)` as `glass tf-case tf-c-{accent}` rows: `tf-st` = `factOwnerTag(f).label`, `<em>` = `originChipLabel(f)` + ` · ` + `lastSeenLabel`-style date of `lastReinforcedAt ?? createdAt`; door `<Link to="/mezo/knowledge?view=tenyek">` „Mind a {facts.length} tény” / „kereséssel, forrással és Elhallgattatom-kapcsolóval”.
6. `RoladTimeline` — `useKnowledgeGraphNodes()` filtered to `LIFE_EVENT|SEASON` with `sourceKind !== PROFILE_SOURCE_KIND`, sorted by `occurredOn ?? updatedAt` DESC; SEASON date via `formatCandidateDate`. Empty → render nothing. Rows `.lifer`-style: dot, title, summary, date.
7. Note — `.glass tf-note` `t-shield`, eyebrow `A te kezedben`, `ROLAD_COPY.note`.
8. Doors (`nav.tf-rows`): `A csapat képe rólad, dimenziónként` → `/mezo/karakter/dimenziok` (`t-person`, rose); `Így beszélj velem` → `/settings/mezo/communication`; `Kapcsolatok` → `/mezo/knowledge?view=kategoriak`.

The embedded `<DimensionsPage embedded />` is removed from Rólad (it lives behind the first door). `DimensionsPage`'s back target stays `/mezo/rolad`.

- [ ] **Step 1: Tests first.** Port from `KnowledgeListPage.test.tsx` into `BoopAboutPage.test.tsx` every inbox test (the anchors `:88`, `:219`, `:265`, `:345-400`, `:402-488`, `:524-570`, `:582`), retargeted to the new copy and route `/mezo/rolad`, and add:
  - ranking: headings appear in the order quote → Döntésre vár → A tények rólad → Életesemények → A te kezedben;
  - quote: with the mock character overview seeded (use the bootstrap cache the DimensionsPage tests use) the highest claim renders with its character's name; with `overview=null` no quote section;
  - `Talál` calls the feedback mutation; `Pontosítom` opens the reply thread;
  - facts show `SZUNYA` for the seeded sleep fact and `TŐLED` for a manual one, and the door links `/mezo/knowledge?view=tenyek`;
  - doors: dimensions, communication, connections hrefs.
  Component tests for `RoladQuote` (empty, claim, null), `RoladTimeline` (date order, season quarter label, empty → null), `RoladFacts` (max 4, degraded hidden).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** components + page + CSS (glass recipe via existing `glass tf-case`/`tf-note`/`tf-c-*`; new rules only for `.kr9-quote`, `.kr9-gone`, `.kr9-quiet`, `.kr9-life` rows, `.tud9-no`), with the `--d` stagger the other csapatfal pages use and a reduced-motion branch identical to theirs.
- [ ] **Step 4: Run** both modes → PASS; `pnpm build` clean.
- [ ] **Step 5: Commit** `feat(insights): Rólad — a közös kép page (mezo-zpxv7)`

---

### Task 11: Tudástár pointer + producer repoints

**Files:**
- Modify: `KnowledgeBaseView.tsx`, `KnowledgeListPage.tsx`, their tests
- Modify: `src/features/me/pages/WeekLessonsPage.tsx:19`, `src/features/me/components/WeekDiscoveries.tsx:127`, `src/features/me/logic/weekHighlight.ts:63`, `src/data/notification/feedMock.ts:18,23`, `src/app/pageIndex.ts:111,126`, and their tests

- [ ] **Step 1: Tests first**
  - `KnowledgeListPage.test.tsx`: remove the moved inbox tests (they live in `BoopAboutPage.test.tsx` now); add: base view shows `{N} javaslat vár rád a Rólad oldalon` linking to `/mezo/rolad` where N = fact candidates + life/season candidates (companion degraded → only graph candidates count); N=0 → `Nincs döntésre váró javaslat. Ha a csapat újat hoz, a Rólad oldalon kérdez meg.`; no `data-week-banner`, no `data-fact-candidate` on the Tudástár.
  - WeekLessons/WeekDiscoveries/weekHighlight/feedMock tests: the „decide” links now point to `/mezo/rolad?start=…` (keep `?fact=` links on `/mezo/knowledge?view=tenyek`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**
  - `KnowledgeBaseView`: drop candidate/life-event props and blocks, drop dead `profileNode`/`profileLine`; new prop `pendingCount: number` renders the pointer (`glass tf-case tf-c-gold tf-s-gold`, `t-bell`, `<Link to="/mezo/rolad">`).
  - `KnowledgeListPage`: drop `acceptedEvents`, `useLifeEventActions`, the decide wiring and the week banner; pass `pendingCount = (degraded ? 0 : candidates.length) + lifeEvents.length`. Keep `withWeek` (other views still carry `?start=`).
  - Repoints per the test step; `pageIndex` hint texts: Rólad „a közös kép rólad — itt döntesz a javaslatokról”, Tudástár „a teljes tény-lista, kategóriák”.
- [ ] **Step 4: Run** both modes → PASS.
- [ ] **Step 5: Commit** `feat(insights): the Tudástár points to Rólad; decide-links repointed (mezo-zpxv7)`

---

### Task 12: Docs, codemap, gates

- [ ] `docs/features/insights.md`: §2.0 route table (Rólad = közös kép + inbox; Tudástár = archive + pointer), §2.4 rewrite of the inbox paragraph (four actions, snooze 14 days, owner tags), fix the stale „hub's fourth tile” and conflict-checkbox-real-mode notes; `docs/features/character.md:332` label clash note (DimensionsPage is „Dimenziók”, reached from Rólad).
- [ ] `docs/superpowers/specs/2026-09-23-boop-team-feed-design.md` §8: one line — „A Rólad tartalmi újratervezése: U9b (mezo-zpxv7, 2026-09-26) — spec `2026-09-26-rolad-kozos-kep-design.md`.”
- [ ] `node scripts/gen-codemap.mjs` and `node scripts/lint-docs.mjs` → 0 stale / 0 errors for the docs this change touched (pre-existing stale docs from other sessions: bump only if their key files are ours).
- [ ] Gates: `cd frontend && CI=true pnpm test && VITE_USE_MOCK=false CI=true pnpm test && pnpm build`; `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true`.
- [ ] Commit `docs(insights): Rólad — a közös kép, Tudástár as archive (mezo-zpxv7)`.
