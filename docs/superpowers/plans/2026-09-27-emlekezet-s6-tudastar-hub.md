# S6 · Tudástár hub + forget controls Implementation Plan (mezo-d6ivw.6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/mezo/knowledge` into the four-section Tudástár hub (Rólad · Emberek ·
Észrevételek · Hatások) with one verb contract on every item — *Honnan tudom?* ·
*Elhallgattatom / Visszakapcsolom* · *Elfelejtem* (5 s undo, permanent, vetoed) · *Javítom* —
plus drift supersession, the recheck trace, the pre-S2 promotion backfill (mezo-4rh4r) and
per-subject effect muting that survives the nightly recompute.

**Architecture:** Backend first (Part A): additive schema (`knowledge_fact.muted_reason/muted_at`,
`pattern.rechecked_at` + status `forgotten`, new `memory_forget_veto` and `effect_mute`
tables), a `ForgetService` in `companion.service` that is the ONE place a forget happens,
veto checks at every text-minting fact writer, a reflection-side read for the hub's
observations and a fact-evidence endpoint that reuse `ObservationFeedService`'s evidence
builder, and mute filters inside `EffectLinkService`'s shared gate. Part B (frontend) starts
only after the parallel facts-always slice (mezo-d6ivw.8) is on main and builds the hub on its
two-state model (bekapcsolva / elhallgattatva) with one shared row building block, one pure
copy module and one undo hook. Part C runs the gates, docs, runtime verify and the merge.

**Tech Stack:** Spring Boot 4 + JPA + Liquibase + PostgreSQL (Testcontainers ITs), OpenAPI
contract (`api/feature/*/*.yml` → `api/generate` merge → openapi-generator (backend, maven) +
openapi-typescript (FE)), React 19 + TanStack Query (`useDualQuery`) + Vitest + MSW +
Playwright layout specs, Üveg kit (`tf-*`, `.glass`, `Icon3D`, `Toggle glass`, `EntranceGroup`).

## Global Constraints

- Every commit subject: conventional, carrying `(mezo-d6ivw.6)`; the backfill task also names `mezo-4rh4r`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Forget = soft delete + veto; the FE shows a ~5 s undo toast (`UNDO_MS = 5000`) and sends the DELETE / forget PUT **only on expiry**; there is **no restore endpoint**.
- Veto table `memory_forget_veto` — domains `fact_text` (normalized text: `trim().toLowerCase().replaceAll("\\s+", " ")`, the `FactExtractionService.normalize` rule) and `pattern` (pattern id).
- `knowledge_fact.muted_reason` ∈ `user|refuted|superseded` (null when active) + `muted_at`; re-enable clears both.
- Drift confirm → a NEW fact (source `pattern`, provenance → the drift row) + the original muted `superseded` with `superseded_by = <new id>`; missing/already-gone original → promote only (fail-open, logged).
- `pattern.rechecked_at` is stamped on every row the recheck actually evaluated (verdict `holds` or `drift`).
- Observations and effects are computed: their "Elfelejtem" = never shown or used again (status `forgotten` / `effect_mute.mode = forgotten`), never a hard delete.
- `effect_mute` is per SUBJECT (all its metrics), survives the nightly recompute; `gatedEffects`, `promptBlock` and the csapatfal edition source (all three read `EffectLinkService.gatedRows`) skip muted AND forgotten subjects; the person page and the hub skip forgotten and see muted ones flagged.
- Row evidence is capped at 5 (`ROW_EVIDENCE_LIMIT`, lesson 3) and rendered ONLY through `shared/ui/evidence` (`mapEvidence` + `EvidenceList`, lesson 6) — never re-parsed or re-formatted server-side.
- OpenAPI enum-like fields use `enum:` (lesson 21); `UpdateFactRequest.category` is converted to `enum:` in this slice. A contract edit reaches code only via `cd api/generate && npm run generate:api` → maven → `cd frontend && pnpm generate:api` (lesson 22); block scalars for any text with an apostrophe.
- ArchUnit/house direction: `companion.service` never imports `companion.reflection.*`; `people` never imports `companion`; switch-gated beans are reached via `ObjectProvider` from ungated callers (lesson 19). Effects + recheck + hub-observation code is gated COMPANION ∧ REFLECTION.
- Per-row write loops use per-row `TransactionTemplate` + `REQUIRES_NEW` (lesson 11); no class-level `@Transactional` (ArchitectureTest).
- Liquibase scripts: `backend/src/main/resources/db/changelog/1.1.0/script/{YYYYMMDDHHMM}_mezo-d6ivw.6_{snake}.sql`, registered in `1.1.0/1.1.0_master.yml` with id `1.1.0:{filename-without-.sql}`; constraint prefixes `pk_ fk_ uq_ ck_ idx_`; no `INSERT`; never a bare jsonb `?` (use `jsonb_exists()`); `node scripts/lint-liquibase.mjs` green.
- Backend ITs run with `-Dmezo.test.use-testcontainers=true` (lessons 27); command form: `cd backend && ./mvnw test -Dtest='<Classes>' -Dmezo.test.use-testcontainers=true`.
- FE tests: `CI=true` in BOTH modes — `VITE_USE_MOCK` unset AND `VITE_USE_MOCK=false`; file arguments to `pnpm test` do NOT scope — use `CI=true pnpm vitest run <path>` for focused runs.
- UI: Üveg canon, dark only; all Hungarian copy in pure, unit-tested modules; Titanium 3D sprite icons, never emojis; §3.4 ranking — rows are flat, one glass card per section tile / per effect subject, no glass inside glass; honest pending/error/degraded per section (no invented numbers); works at 320 px; reduced-motion branch for every animation.
- Non-goals: chat "ezt ne jegyezd meg" intent (S6b); mute/forget of character claims; cascade from deleting a source record; archived graph nodes (mezo-fp95); any new LLM call or `LlmCallContext` slug.
- **Sequencing:** Part A may run now. `KnowledgeFactService` is ALSO edited by mezo-d6ivw.8 (prompt block/top-N/header only) — S6 touches `list()`, `update()`, `muteFromRefutedPattern()` and the constructor fields only; expect a trivial rebase. Part B starts with a hard gate on mezo-d6ivw.8 being on `origin/main`.

## Resolved spec ambiguities (plan decisions)

1. **Fact writers that check the `fact_text` veto:** `FactExtractionService` (chat candidates) and `WeeklyLessonService` (weekly candidates) — both mint from model text. NOT checked: `KnowledgeFactService.create` (manual, the user typed it), `FactCandidateService.decide` (the user accepted/refined a candidate), `QuestionAnswerService.record` (a one-tap answer to a once-ever question is itself a fresh confirmation). `PatternService.promoteIfFirst` checks the `pattern` veto.
2. **Observation forget carrier:** a new pattern status `forgotten`. The publisher's dedupe (`GroundedHypothesisPublisher.publish`: a live row matching key/topic in any status other than proposed/monitoring ⇒ "kept closed") already makes a forgotten row permanent — exactly the refuted-never-resurfaces model; a soft delete would instead let the publisher mint a fresh row. The `pattern` veto is written as well (belt and braces for promotion). No `pattern_event` is appended (forgetting must not write a new story entry; the veto row carries the timestamp).
3. **Forgetting a pattern-sourced fact from Rólad** also forgets its observation (one thing, two views — the prototype's `removeItem` does the same), so Észrevételek never shows a confirmed observation without its fact.
4. **Endpoint cut for observations:** a hub-specific `GET /api/companion/observation/knowledge` in the reflection-gated `CompanionObservationController`. `GET /pattern` lives in `companion.service` (cannot reach the reflection evidence builder) and serves Minták incl. statistical rows.
5. **Fact evidence is lazy:** `KnowledgeFactResponse` carries provenance (`sourceKind`, `patternId`, `sourceMessageId`) but not evidence; "Honnan tudom?" calls `GET /api/companion/fact/{factId}/evidence` (≤5 items). Eager evidence would cost one source lookup per fact per list load (~200 facts after half a year).
6. **Drift claim text:** the recheck answer gains a `claim` field (same call, same slug — lesson 17: only the fake's default JSON changes); the drift row's `title` becomes the claim (fallback: first sentence as today), so the superseding fact reads "Mostanában a randis napok estéje is feltölt.", not "Korábban megerősítetted, hogy…".
7. **`rechecked_at`** is stamped on the SOURCE (original confirmed) row when the verdict is `holds` or `drift`; `unknown`, an LLM failure and every skip leave it untouched ("még nem ellenőriztem újra" stays honest).
8. **Backfill (mezo-4rh4r):** an unprofiled `CommandLineRunner` (`KnowledgeBackfillRunner`, the `ExpenditureRolloutRunner` idiom), not Liquibase — promotion must go through `PatternService.applyUserConfirm` (events, provenance, graph event), which SQL cannot do. Idempotent by construction: a promoted row leaves the candidate set.
9. **person_fact provenance:** `PersonFactResponse` gains `sourceRefId` only; no resolved evidence item (people ↛ companion, and a chat quote would need the companion message store). The FE shows kind + date.
10. **`?view=` + effect-mute paths:** `PUT|DELETE /api/companion/effects/{subjectKind}/{subjectKey}/mute` (PUT body `{mode: muted|forgotten}`); `forgotten` is sticky — a later `muted` PUT or a DELETE never revives it.
11. **Dossier door count:** the character wire has no honest total claim count, so the door reads "A csapat véleménye rólad" without a number and links to `/mezo/karakter`.
12. **Recheck cadence copy:** the prototype says "Hetente újra megnézem"; the job is quarterly — the copy says "Negyedévente újra megnézem, igaz-e még." (honesty rule).
13. **Person fact mute date:** `person_fact` has no mute timestamp; its why-line is "te hallgattattad el" without a date (no new column for a date nobody asked for).
14. **Backfilled `muted_at`:** null (the old toggle was never timestamped); the FE omits the date then.

## File Structure

**Backend — create**
- `backend/src/main/resources/db/changelog/1.1.0/script/202609271200_mezo-d6ivw.6_memory_forget.sql` — knowledge_fact mute columns, pattern `rechecked_at` + status, `memory_forget_veto`, `effect_mute`.
- `backend/src/main/resources/db/changelog/1.1.0/script/202609271201_mezo-d6ivw.6_fact_mute_reason_backfill.sql` — idempotent UPDATEs only (re-runnable by the IT).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryForgetVetoEntity.java` — the veto row + `normalizeFactText`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryForgetVetoRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/entity/EffectMuteEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/repository/EffectMuteRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ForgetService.java` — forgetFact / forgetObservation.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/KnowledgeObservationService.java` — hub observations + fact evidence.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectMuteService.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/KnowledgeBackfillRunner.java` — mezo-4rh4r.
- Tests: `MemoryForgetSchemaIT`, `KnowledgeFactMuteReasonIT`, `CompanionFactProvenanceApiIT`, `ForgetServiceIT`, `CompanionForgetApiIT`, `ForgetVetoWritersIT`, `KnowledgeRecheckTraceIT`, `DriftSupersessionIT`, `KnowledgeObservationServiceIT`, `KnowledgeObservationApiIT`, `KnowledgeBackfillRunnerIT`, `EffectMuteIT`, `CompanionEffectsHubApiIT`, `MemoryForgetVetoEntityTest` (paths in the tasks).

**Backend — modify**
- `entity/KnowledgeFactEntity.java`, `entity/PatternEntity.java`, `mapper/CompanionMapper.java`, `service/KnowledgeFactService.java`, `service/PatternService.java`, `service/FactExtractionService.java`, `repository/LearnedFactRepository.java`, `repository/PatternRepository.java`, `controller/CompanionController.java`, `controller/CompanionObservationController.java`, `controller/CompanionEffectsController.java`, `reflection/service/KnowledgeRecheckService.java`, `reflection/service/ObservationFeedService.java`, `reflection/service/EffectLinkService.java`, `reflection/service/ReflectionReplyService.java`, `reflection/service/ReflectionDigestService.java`, `service/PatternPairDetailService.java`, `service/HypothesisPipelineService.java`, `llm/FakeCompanionLlm.java`, `feature/proactive/service/WeeklyLessonService.java`, `feature/people/service/PersonFactService.java`, `feature/people/controller/PeopleController.java`, `1.1.0/1.1.0_master.yml`.

**Contract — modify:** `api/feature/companion/companion.yml`, `api/feature/people/people.yml`; generated `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`.

**Frontend — create**
- `frontend/src/data/insights/knowledgeHubApi.ts` (+ `.test.ts`) — wire→domain for observations/effects/evidence + forget/mute/edit calls.
- `frontend/src/data/insights/knowledgeHubHooks.ts` (+ `.test.tsx`) — `useKnowledgeObservations`, `useEffectSubjects`, `useFactEvidence`, `useKnowledgeHubActions`.
- `frontend/src/data/insights/knowledgeHub.ts` — mock seeds (observations, effect subjects, fact evidence).
- `frontend/src/features/insights/logic/hubCopy.ts` (+ `.test.ts`) — every Hungarian string of the hub.
- `frontend/src/features/insights/logic/hubSearch.ts` (+ `.test.ts`) — accent-insensitive match + highlight segments.
- `frontend/src/features/insights/logic/hubTopics.ts` (+ `.test.ts`) — observation topic derivation + grouping/sorting helpers.
- `frontend/src/features/insights/hooks/useForgetUndo.ts` (+ `.test.tsx`).
- `frontend/src/features/insights/components/hub/` — `HubRow.tsx`, `HubFold.tsx`, `HubSearch.tsx`, `ForgetUndoBar.tsx`, `HubTiles.tsx`, `TenyekSection.tsx`, `EmberekSection.tsx`, `EszrevetelekSection.tsx`, `HatasokSection.tsx` (+ one `.test.tsx` per component).
- `frontend/src/features/me/logic/effectCopy.ts` (+ `.test.ts`) and `frontend/src/features/me/components/EffectRows.tsx` — the S4 effect sentences/dots, extracted so the person page and the hub share one source.
- `frontend/tests/layout/tudastar-hub.spec.ts` — 320 px invariants.

**Frontend — modify:** `data/types.ts`, `data/insights/knowledgeApi.ts`, `data/insights/knowledgeHooks.ts`, `data/insights/knowledge.ts` (mock facts gain mute fields), `data/me/peopleApi.ts`, `data/me/peopleHooks.ts`, `data/me/personEffectsApi.ts`, `data/hooks.ts`, `test/msw/handlers.ts`, `features/insights/pages/KnowledgeListPage.tsx` (+ test), `features/insights/components/KnowledgeBaseView.tsx`, `features/me/pages/PersonDetailPage.tsx`, `shared/ui/clay/index.tsx` + `titanium-icons.svg` (generated) + `Icon3D.test.tsx`, `docs/design_2.0/assets/titanium-custom.svg`, `styles/prototype.css`. **Delete:** `features/insights/components/FactsView.tsx`, `KnowledgeFactRow.tsx` (+ its test) once no importer remains.

**Docs — modify:** `docs/features/insights.md`, `docs/features/companion.md`, `docs/features/me.md`, `docs/CODEMAP.md` (generated), spec "Slice lessons".

---

# Part A — backend + contract (may run now)

### Task A1: Schema + entities for mute reasons, forgotten status, vetoes and effect mutes

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609271200_mezo-d6ivw.6_memory_forget.sql`
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609271201_mezo-d6ivw.6_fact_mute_reason_backfill.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append two changeSets at the end)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/KnowledgeFactEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/PatternEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryForgetVetoEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryForgetVetoRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/entity/EffectMuteEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/repository/EffectMuteRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MemoryForgetSchemaIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/entity/MemoryForgetVetoEntityTest.java`

**Interfaces:**
- Produces: `KnowledgeFactEntity.MUTED_USER|MUTED_REFUTED|MUTED_SUPERSEDED` (`"user"|"refuted"|"superseded"`), fields `String mutedReason`, `Instant mutedAt`, methods `void mute(String reason, Instant at)`, `void unmute()`.
- Produces: `PatternEntity.STATUS_FORGOTTEN = "forgotten"`, field `Instant recheckedAt`, `boolean isForgotten()`.
- Produces: `MemoryForgetVetoEntity` (`DOMAIN_FACT_TEXT = "fact_text"`, `DOMAIN_PATTERN = "pattern"`, fields `UUID id`, `String domain`, `String vetoKey`; `static String normalizeFactText(String)`), `MemoryForgetVetoRepository.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(UUID, String, String)`, `findByCreatedByAndDomainAndDeletedFalse(UUID, String)`.
- Produces: `EffectMuteEntity` (`MODE_MUTED = "muted"`, `MODE_FORGOTTEN = "forgotten"`, fields `subjectKind`, `subjectKey`, `mode`), `EffectMuteRepository.findByCreatedByAndDeletedFalse(UUID)`, `findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(UUID, String, String)`.

- [ ] **Step 1: Write the failing unit test for the normalizer**

```java
package io.mrkuhne.mezo.feature.companion.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MemoryForgetVetoEntityTest {

    @Test
    void normalizeFactText_shouldTrimLowercaseAndCollapseWhitespace() {
        assertThat(MemoryForgetVetoEntity.normalizeFactText("  Laktózérzékeny   VAGY\n\tsajnos "))
                .isEqualTo("laktózérzékeny vagy sajnos");
    }

    @Test
    void normalizeFactText_shouldMatchTheExtractionDedupeRule() {
        // FactExtractionService.normalize and WeeklyLessonService.normalize use exactly this rule —
        // a veto that normalized differently would silently never match.
        String raw = "Reggel  7-kor edzel.";
        assertThat(MemoryForgetVetoEntity.normalizeFactText(raw))
                .isEqualTo(raw.trim().toLowerCase().replaceAll("\\s+", " "));
    }
}
```

- [ ] **Step 2: Write the failing schema IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectMuteEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectMuteRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/** S6 (mezo-d6ivw.6) Task A1: the forget/mute schema round-trips, its constraints bite, and the
 *  mute-reason backfill is idempotent (the backfill script is re-run here on seeded rows). */
class MemoryForgetSchemaIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeFactRepository facts;
    @Autowired private PatternRepository patterns;
    @Autowired private MemoryForgetVetoRepository vetoes;
    @Autowired private EffectMuteRepository mutes;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DataSource dataSource;

    @Test
    void knowledgeFact_shouldPersistMuteReasonAndTimestamp() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Kávé 14 előtt", "fuel", 1);
        Instant at = Instant.parse("2026-09-27T08:00:00Z");
        fact.mute(KnowledgeFactEntity.MUTED_USER, at);
        facts.saveAndFlush(fact);

        KnowledgeFactEntity reread = facts.findById(fact.getId()).orElseThrow();
        assertThat(reread.isIncludeInPrompt()).isFalse();
        assertThat(reread.getMutedReason()).isEqualTo("user");
        assertThat(reread.getMutedAt()).isEqualTo(at);

        reread.unmute();
        facts.saveAndFlush(reread);
        KnowledgeFactEntity back = facts.findById(fact.getId()).orElseThrow();
        assertThat(back.isIncludeInPrompt()).isTrue();
        assertThat(back.getMutedReason()).isNull();
        assertThat(back.getMutedAt()).isNull();
    }

    @Test
    void pattern_shouldAcceptForgottenStatusAndRecheckedAt() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        row.setStatus(PatternEntity.STATUS_FORGOTTEN);
        row.setRecheckedAt(Instant.parse("2026-09-20T09:20:00Z"));
        patternPopulator.save(row);

        PatternEntity reread = patterns.findById(row.getId()).orElseThrow();
        assertThat(reread.isForgotten()).isTrue();
        assertThat(reread.getRecheckedAt()).isEqualTo(Instant.parse("2026-09-20T09:20:00Z"));
    }

    @Test
    void veto_shouldBeUniquePerUserDomainAndKey() {
        UUID owner = userPopulator.createUser().getId();
        vetoes.saveAndFlush(veto(owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, "kávé 14 előtt"));
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, "kávé 14 előtt")).isTrue();
        assertThatThrownBy(() -> vetoes.saveAndFlush(
                veto(owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, "kávé 14 előtt")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void effectMute_shouldBeUniquePerSubject() {
        UUID owner = userPopulator.createUser().getId();
        mutes.saveAndFlush(mute(owner, "event", "munka", EffectMuteEntity.MODE_MUTED));
        assertThatThrownBy(() -> mutes.saveAndFlush(mute(owner, "event", "munka", EffectMuteEntity.MODE_FORGOTTEN)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void backfill_shouldMarkOldMutesUserOrRefuted_andBeIdempotent() throws Exception {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity plainOff = factPopulator.fact(owner, "Régi kikapcsolt", "life", 0, false,
                KnowledgeFactEntity.SOURCE_CHAT);
        KnowledgeFactEntity refutedOff = factPopulator.fact(owner, "Cáfolt minta ténye", "health", 0, false,
                KnowledgeFactEntity.SOURCE_PATTERN);
        PatternEntity refuted = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_REFUTED);
        refuted.setPromotedFactId(refutedOff.getId());
        patternPopulator.save(refuted);
        KnowledgeFactEntity on = factPopulator.fact(owner, "Bekapcsolt", "life", 0);

        runBackfill();
        runBackfill(); // idempotent: the second pass changes nothing

        assertThat(facts.findById(plainOff.getId()).orElseThrow().getMutedReason()).isEqualTo("user");
        assertThat(facts.findById(refutedOff.getId()).orElseThrow().getMutedReason()).isEqualTo("refuted");
        assertThat(facts.findById(on.getId()).orElseThrow().getMutedReason()).isNull();
        assertThat(facts.findById(plainOff.getId()).orElseThrow().getMutedAt()).isNull();
    }

    private void runBackfill() throws Exception {
        try (var connection = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource(
                    "db/changelog/1.1.0/script/202609271201_mezo-d6ivw.6_fact_mute_reason_backfill.sql"));
        }
    }

    private static MemoryForgetVetoEntity veto(UUID owner, String domain, String key) {
        MemoryForgetVetoEntity v = new MemoryForgetVetoEntity();
        v.setCreatedBy(owner);
        v.setDomain(domain);
        v.setVetoKey(key);
        return v;
    }

    private static EffectMuteEntity mute(UUID owner, String kind, String key, String mode) {
        EffectMuteEntity m = new EffectMuteEntity();
        m.setCreatedBy(owner);
        m.setSubjectKind(kind);
        m.setSubjectKey(key);
        m.setMode(mode);
        return m;
    }
}
```


- [ ] **Step 3: Run both to verify they fail**

Run: `cd backend && ./mvnw test -Dtest='MemoryForgetVetoEntityTest,MemoryForgetSchemaIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation FAIL — `MemoryForgetVetoEntity`, `mute(...)`, `STATUS_FORGOTTEN` do not exist.

- [ ] **Step 4: Write the migration**

`202609271200_mezo-d6ivw.6_memory_forget.sql`:

```sql
-- S6 (mezo-d6ivw.6): the Tudástár hub's forget/mute spine.
-- knowledge_fact: WHY a fact is muted (null while active) and since when.
alter table knowledge_fact add column muted_reason varchar(16);
alter table knowledge_fact add column muted_at timestamptz;
alter table knowledge_fact add constraint ck_knowledge_fact_muted_reason
    check (muted_reason is null or muted_reason in ('user', 'refuted', 'superseded'));

-- pattern: the recheck trace + the forgotten terminal status (never resurfaces, never re-promotes).
alter table pattern add column rechecked_at timestamptz;
alter table pattern drop constraint ck_pattern_status;
alter table pattern add constraint ck_pattern_status
    check (status in ('proposed', 'monitoring', 'confirmed', 'rejected', 'refuted', 'dormant', 'forgotten'));

-- The forget veto: the same thing is never re-learned from the same source.
create table memory_forget_veto (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 domain varchar(16) not null,
 veto_key varchar(500) not null,
 constraint pk_memory_forget_veto_id primary key(id),
 constraint fk_memory_forget_veto_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint ck_memory_forget_veto_domain check(domain in ('fact_text','pattern'))
);
create unique index uq_memory_forget_veto_key on memory_forget_veto(created_by, domain, veto_key) where is_deleted = false;

-- Per-subject effect mute — outlives the nightly effect_link cache (rows there are soft-deleted
-- and re-created; a flag ON the row would die with it).
create table effect_mute (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 subject_kind varchar(8) not null,
 subject_key varchar(64) not null,
 mode varchar(16) not null,
 constraint pk_effect_mute_id primary key(id),
 constraint fk_effect_mute_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint ck_effect_mute_subject_kind check(subject_kind in ('person','event')),
 constraint ck_effect_mute_mode check(mode in ('muted','forgotten'))
);
create unique index uq_effect_mute_subject on effect_mute(created_by, subject_kind, subject_key) where is_deleted = false;
```

`202609271201_mezo-d6ivw.6_fact_mute_reason_backfill.sql` (UPDATE only — lint allows it; idempotent via `muted_reason is null`):

```sql
-- S6 (mezo-d6ivw.6): facts muted before the reason existed. A fact whose promoting pattern was
-- refuted was muted BY the refute (S2); every other muted fact was the user's own toggle.
-- muted_at stays null: the old toggle was never timestamped, and a made-up date would lie.
update knowledge_fact kf set muted_reason = 'refuted'
 where kf.include_in_prompt = false and kf.muted_reason is null and kf.is_deleted = false
   and exists (select 1 from pattern p
                where p.promoted_fact_id = kf.id and p.status = 'refuted' and p.is_deleted = false);
update knowledge_fact set muted_reason = 'user'
 where include_in_prompt = false and muted_reason is null and is_deleted = false;
```

Append to `1.1.0_master.yml` (keep the existing indentation):

```yaml
  - changeSet:
      id: "1.1.0:202609271200_mezo-d6ivw.6_memory_forget"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609271200_mezo-d6ivw.6_memory_forget.sql
  - changeSet:
      id: "1.1.0:202609271201_mezo-d6ivw.6_fact_mute_reason_backfill"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609271201_mezo-d6ivw.6_fact_mute_reason_backfill.sql
```

- [ ] **Step 5: Entity changes**

`KnowledgeFactEntity` — add after the `SOURCE_QUESTION` constant and after `owner`:

```java
    /** S6 (mezo-d6ivw.6): why a fact is muted — mirrors ck_knowledge_fact_muted_reason. */
    public static final String MUTED_USER = "user";
    public static final String MUTED_REFUTED = "refuted";
    public static final String MUTED_SUPERSEDED = "superseded";
```

```java
    /** S6: null while the fact is active; set together with include_in_prompt=false. */
    @Size(max = 16)
    @Pattern(regexp = "user|refuted|superseded")
    @Column(name = "muted_reason", length = 16)
    private String mutedReason;

    /** S6: when it was muted; null when active or when a pre-S6 mute was backfilled. */
    @Column(name = "muted_at")
    private Instant mutedAt;

    /** S6: the ONE way to silence a fact — the prompt seat and the reason move together. */
    public void mute(String reason, Instant at) {
        this.includeInPrompt = false;
        this.mutedReason = reason;
        this.mutedAt = at;
    }

    /** S6: re-enable clears the reason, whatever it was (the user may revive a superseded fact). */
    public void unmute() {
        this.includeInPrompt = true;
        this.mutedReason = null;
        this.mutedAt = null;
    }
```

`PatternEntity` — add `STATUS_FORGOTTEN`, extend the `@Pattern` on `status` to `"proposed|monitoring|confirmed|rejected|refuted|dormant|forgotten"`, add the column and the predicate:

```java
    /** S6 (mezo-d6ivw.6): the user forgot this observation — terminal, never a card again, never
     *  re-published (the publisher keeps any non-open live row closed) and never re-promoted. */
    public static final String STATUS_FORGOTTEN = "forgotten";
```

```java
    /** S6: when the quarterly re-check last EVALUATED this row (holds or drift); null = never. */
    @Column(name = "rechecked_at")
    private Instant recheckedAt;
```

```java
    /** S6: see {@link #STATUS_FORGOTTEN}. */
    public boolean isForgotten() {
        return STATUS_FORGOTTEN.equals(status);
    }
```

`MemoryForgetVetoEntity.java`:

```java
package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * S6 (mezo-d6ivw.6): "Elfelejtem" is permanent — the same thing is never re-learned from the same
 * source. A {@code fact_text} row holds a forgotten fact's normalized text (every text-minting
 * candidate writer checks it); a {@code pattern} row holds a forgotten observation's pattern id
 * (promotion checks it). The normalizer lives here, on the entity, so {@code companion.service}
 * and {@code proactive} share one definition (slice lesson 12).
 */
@Getter
@Setter
@Entity
@Table(name = "memory_forget_veto")
@SQLDelete(sql = "update memory_forget_veto set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoryForgetVetoEntity extends OwnedEntity {

    public static final String DOMAIN_FACT_TEXT = "fact_text";
    public static final String DOMAIN_PATTERN = "pattern";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "fact_text|pattern")
    @Column(nullable = false, length = 16)
    private String domain;

    @NotNull
    @Size(max = 500)
    @Column(name = "veto_key", nullable = false, length = 500)
    private String vetoKey;

    /** The extraction dedupe rule (FactExtractionService / WeeklyLessonService normalize). */
    public static String normalizeFactText(String text) {
        return text.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}
```

`MemoryForgetVetoRepository.java`:

```java
package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoryForgetVetoRepository extends JpaRepository<MemoryForgetVetoEntity, UUID> {

    boolean existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(UUID createdBy, String domain, String vetoKey);

    List<MemoryForgetVetoEntity> findByCreatedByAndDomainAndDeletedFalse(UUID createdBy, String domain);
}
```

`EffectMuteEntity.java` (package `io.mrkuhne.mezo.feature.companion.reflection.entity`) — same shape as the veto entity: `@Table(name = "effect_mute")`, `@SQLDelete`/`@SQLRestriction` like above, constants `MODE_MUTED = "muted"`, `MODE_FORGOTTEN = "forgotten"`, fields:

```java
    @NotNull @Size(max = 8) @Pattern(regexp = "person|event")
    @Column(name = "subject_kind", nullable = false, length = 8)
    private String subjectKind;

    @NotNull @Size(max = 64)
    @Column(name = "subject_key", nullable = false, length = 64)
    private String subjectKey;

    @NotNull @Size(max = 16) @Pattern(regexp = "muted|forgotten")
    @Column(nullable = false, length = 16)
    private String mode;

    public boolean isForgotten() { return MODE_FORGOTTEN.equals(mode); }
```

`EffectMuteRepository.java` (package `...reflection.repository`):

```java
public interface EffectMuteRepository extends JpaRepository<EffectMuteEntity, UUID> {
    List<EffectMuteEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
    Optional<EffectMuteEntity> findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(
            UUID createdBy, String subjectKind, String subjectKey);
}
```

- [ ] **Step 6: Run tests + the liquibase linter**

Run: `node scripts/lint-liquibase.mjs && cd backend && ./mvnw test -Dtest='MemoryForgetVetoEntityTest,MemoryForgetSchemaIT' -Dmezo.test.use-testcontainers=true`
Expected: lint PASS; 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog/1.1.0 backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryForgetVetoRepository.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/entity/EffectMuteEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/repository/EffectMuteRepository.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/MemoryForgetSchemaIT.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/entity/MemoryForgetVetoEntityTest.java
git commit -m "feat(companion): felejtés/elhallgattatás séma — ok, vétó, effect_mute, forgotten státusz (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A2: Mute reasons on every knowledge_fact mute path

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java:131-133` (`update`) and `:241-251` (`muteFromRefutedPattern`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/KnowledgeFactMuteReasonIT.java` (new class — `KnowledgeFactServiceIT` is being edited by mezo-d6ivw.8)

**Interfaces:**
- Consumes: A1 `KnowledgeFactEntity.mute/unmute`, `MUTED_*`.
- Produces: `update(..., includeInPrompt=false)` ⇒ `mutedReason="user"`, `mutedAt=now`; `includeInPrompt=true` ⇒ both cleared; `muteFromRefutedPattern` ⇒ `mutedReason="refuted"`. A repeated `includeInPrompt=false` on an already-muted fact keeps the ORIGINAL reason and date (a no-op toggle must not rewrite "felülírta" into "te hallgattattad el").

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S6 (mezo-d6ivw.6) Task A2: every muted fact says WHY. */
class KnowledgeFactMuteReasonIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeFactService service;
    @Autowired private KnowledgeFactRepository repository;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void update_shouldMarkUserMute_andReEnableClearsIt() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Reggel edzel", "train", 1);

        service.update(owner, fact.getId(), UpdateFactRequest.builder().includeInPrompt(false).build());
        KnowledgeFactEntity muted = repository.findById(fact.getId()).orElseThrow();
        assertThat(muted.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_USER);
        assertThat(muted.getMutedAt()).isNotNull();

        service.update(owner, fact.getId(), UpdateFactRequest.builder().includeInPrompt(true).build());
        KnowledgeFactEntity back = repository.findById(fact.getId()).orElseThrow();
        assertThat(back.isIncludeInPrompt()).isTrue();
        assertThat(back.getMutedReason()).isNull();
        assertThat(back.getMutedAt()).isNull();
    }

    @Test
    void update_shouldKeepAnExistingReason_whenMutedAgain() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Régi állítás", "life", 0);
        Instant at = Instant.parse("2026-09-21T09:20:00Z");
        fact.mute(KnowledgeFactEntity.MUTED_SUPERSEDED, at);
        repository.saveAndFlush(fact);

        service.update(owner, fact.getId(), UpdateFactRequest.builder().includeInPrompt(false).build());

        KnowledgeFactEntity reread = repository.findById(fact.getId()).orElseThrow();
        assertThat(reread.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_SUPERSEDED);
        assertThat(reread.getMutedAt()).isEqualTo(at);
    }

    @Test
    void update_shouldNotTouchMuteState_whenOnlyTextChanges() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Elütés", "life", 0);

        service.update(owner, fact.getId(), UpdateFactRequest.builder().factText("Javított szöveg").build());

        KnowledgeFactEntity reread = repository.findById(fact.getId()).orElseThrow();
        assertThat(reread.getFactText()).isEqualTo("Javított szöveg");
        assertThat(reread.isIncludeInPrompt()).isTrue();
        assertThat(reread.getMutedReason()).isNull();
    }

    @Test
    void muteFromRefutedPattern_shouldMarkRefuted() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Cáfolt", "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);

        service.muteFromRefutedPattern(owner, fact.getId());

        KnowledgeFactEntity reread = repository.findById(fact.getId()).orElseThrow();
        assertThat(reread.isIncludeInPrompt()).isFalse();
        assertThat(reread.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_REFUTED);
        assertThat(reread.getMutedAt()).isNotNull();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=KnowledgeFactMuteReasonIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `getMutedReason()` is null after the toggles.

- [ ] **Step 3: Implement**

In `update(...)` replace the `includeInPrompt` block:

```java
        if (request.getIncludeInPrompt() != null) {
            boolean include = request.getIncludeInPrompt();
            if (include && !fact.isIncludeInPrompt()) {
                fact.unmute();
            } else if (!include && fact.isIncludeInPrompt()) {
                // S6 (mezo-d6ivw.6): the user's own toggle — "te hallgattattad el". An already
                // muted fact keeps its original reason (a no-op toggle never rewrites history).
                fact.mute(KnowledgeFactEntity.MUTED_USER, Instant.now());
            }
        }
```

In `muteFromRefutedPattern` replace `fact.setIncludeInPrompt(false);` with:

```java
        fact.mute(KnowledgeFactEntity.MUTED_REFUTED, Instant.now());
```

- [ ] **Step 4: Run to verify it passes (plus the existing refute path)**

Run: `cd backend && ./mvnw test -Dtest='KnowledgeFactMuteReasonIT,ReflectionReplyServiceIT,CompanionFactApiIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/KnowledgeFactMuteReasonIT.java
git commit -m "feat(companion): minden elhallgattatott tény megmondja, miért (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A3: Fact wire — mute state + provenance on `KnowledgeFactResponse`, `UpdateFactRequest.category` enum

**Files:**
- Modify: `api/feature/companion/companion.yml` (`KnowledgeFactResponse` ~L1078, `UpdateFactRequest` ~L1099, new `KnowledgeFactProvenance` schema)
- Modify (generated): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java:129-156`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java` (`list`, `update` category line, constructor field)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/LearnedFactRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionFactProvenanceApiIT.java`

**Interfaces:**
- Produces wire: `KnowledgeFactResponse` + `mutedReason: 'user'|'refuted'|'superseded'|null`, `mutedAt: date-time|null`, `supersededBy: uuid|null`, `provenance: KnowledgeFactProvenance` (required) = `{ sourceKind: 'chat'|'pattern'|'manual'|'weekly_review'|'question', patternId: uuid|null, sourceMessageId: uuid|null }`. `UpdateFactRequest.category` becomes `enum [train, fuel, health, life]` (generated `UpdateFactRequest.CategoryEnum`).
- Produces: `LearnedFactRepository.findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(UUID)` and `findFirstByCreatedByAndPromotedFactIdAndDeletedFalse(UUID, UUID)`; mapper overload `toKnowledgeFactResponse(KnowledgeFactEntity, String patternTitle, Integer citedWeeks, UUID sourceMessageId)`.

- [ ] **Step 1: Contract edit**

In `KnowledgeFactResponse.properties` append (and add `provenance` to `required`):

```yaml
        mutedReason:
          type: string
          nullable: true
          enum: [user, refuted, superseded]
          description: >-
            S6 (mezo-d6ivw.6) — miért hallgat a tény: user = te hallgattattad el, refuted = később
            nem igazolódott (S2 cáfolat), superseded = felülírta egy újabb észrevétel. Null, ha
            bekapcsolt.
        mutedAt: { type: string, format: date-time, nullable: true, description: 'S6 — mikor hallgattatták el; null, ha bekapcsolt vagy S6 előtti némítás.' }
        supersededBy: { type: string, format: uuid, nullable: true, description: 'S6 — a tény, ami felülírta (drift-megerősítés).' }
        provenance: { $ref: '#/components/schemas/KnowledgeFactProvenance' }
```

New schema next to it:

```yaml
    KnowledgeFactProvenance:
      type: object
      description: >-
        S6 (mezo-d6ivw.6) — honnan jön a tény. A bizonyíték-elemeket a
        GET /api/companion/fact/{factId}/evidence adja lustán (Honnan tudom?).
      required: [sourceKind]
      properties:
        sourceKind: { type: string, enum: [chat, pattern, manual, weekly_review, question] }
        patternId: { type: string, format: uuid, nullable: true, description: 'Az észrevétel, amiből a tény született (source=pattern).' }
        sourceMessageId: { type: string, format: uuid, nullable: true, description: 'A beszélgetés-üzenet, amiből a jelölt született (chat).' }
```

`UpdateFactRequest.category` → `{ type: string, enum: [train, fuel, health, life], nullable: true }`.

Regenerate:

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

- [ ] **Step 2: Write the failing API IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** S6 (mezo-d6ivw.6) Task A3: the fact list says where each fact came from and why it is muted. */
class CompanionFactProvenanceApiIT extends ApiIntegrationTest {

    private static final String FACTS = "/api/companion/fact";

    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private KnowledgeFactRepository factRepository;
    @Autowired private LearnedFactRepository learnedFactRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void list_shouldCarryChatSourceMessage_andPatternId() {
        UUID owner = ownerId();
        UUID messageId = UUID.randomUUID();
        KnowledgeFactEntity chat = factPopulator.fact(owner, "Laktózérzékeny vagy", "fuel", 1, true,
                KnowledgeFactEntity.SOURCE_CHAT);
        LearnedFactEntity candidate = learnedFactPopulator.candidate(owner, "Laktózérzékeny vagy", messageId);
        candidate.setUserDecision(LearnedFactEntity.DECISION_ACCEPT);
        candidate.setPromotedFactId(chat.getId());
        learnedFactRepository.saveAndFlush(candidate);

        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fromPattern = factPopulator.fact(owner, row.getTitle(), "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        fromPattern.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        factRepository.saveAndFlush(fromPattern);

        List<KnowledgeFactResponse> facts = getForList(FACTS, ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);

        KnowledgeFactResponse c = facts.stream().filter(f -> f.getId().equals(chat.getId())).findFirst().orElseThrow();
        assertThat(c.getProvenance().getSourceKind().getValue()).isEqualTo("chat");
        assertThat(c.getProvenance().getSourceMessageId()).isEqualTo(messageId);
        assertThat(c.getMutedReason()).isNull();

        KnowledgeFactResponse p = facts.stream().filter(f -> f.getId().equals(fromPattern.getId())).findFirst().orElseThrow();
        assertThat(p.getProvenance().getPatternId()).isEqualTo(row.getId());
    }

    @Test
    void patch_shouldReturnUserMuteReason_andAcceptEnumCategory() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Esti futás", "train", 0);

        KnowledgeFactResponse muted = patchForBody(FACTS + "/" + fact.getId(),
                UpdateFactRequest.builder().includeInPrompt(false).category(UpdateFactRequest.CategoryEnum.LIFE).build(),
                ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);

        assertThat(muted.getMutedReason().getValue()).isEqualTo("user");
        assertThat(muted.getMutedAt()).isNotNull();
        assertThat(muted.getCategory()).isEqualTo("life");
    }
}
```

(If `appUserRepository`/`ownerProperties` are not visible from `ApiIntegrationTest` subclasses, use `registerUser("s6")` and its `headers()`/`id()` instead — `registerUser` is protected there, `ApiIntegrationTest.java:75`.)

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=CompanionFactProvenanceApiIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `getProvenance()` null / `update` does not compile against `CategoryEnum` (`request.getCategory()` is no longer a `String`).

- [ ] **Step 4: Implement**

`LearnedFactRepository` — add:

```java
    /** S6 (mezo-d6ivw.6): accepted candidates → the chat turn each fact came from (provenance). */
    List<LearnedFactEntity> findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(UUID createdBy);

    Optional<LearnedFactEntity> findFirstByCreatedByAndPromotedFactIdAndDeletedFalse(UUID createdBy, UUID promotedFactId);
```

`KnowledgeFactService` — add field `private final LearnedFactRepository learnedFactRepository;` (import `io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository`, `io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity`); in `update` the category branch becomes:

```java
        if (request.getCategory() != null) {
            String category = request.getCategory().getValue();
            if (fact.getOwner().equals(FactOwner.forCategory(fact.getCategory()))) {
                fact.setOwner(FactOwner.forCategory(category));
            }
            fact.setCategory(category);
        }
```

`list(...)`:

```java
    public List<KnowledgeFactResponse> list(UUID userId) {
        Map<UUID, String> patternTitleByFactId = patternRepository
                .findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId).stream()
                .collect(Collectors.toMap(PatternEntity::getPromotedFactId, PatternEntity::getTitle,
                        (first, second) -> first));
        // S6 (mezo-d6ivw.6): the chat turn behind each accepted candidate — one read, not one per fact
        Map<UUID, UUID> sourceMessageByFactId = learnedFactRepository
                .findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId).stream()
                .filter(c -> c.getDerivedFromMessageId() != null)
                .collect(Collectors.toMap(LearnedFactEntity::getPromotedFactId,
                        LearnedFactEntity::getDerivedFromMessageId, (first, second) -> first));
        Map<UUID, Integer> cited = citedWeeks(userId);
        return repository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)
                .stream()
                .map(fact -> mapper.toKnowledgeFactResponse(fact, patternTitleByFactId.get(fact.getId()),
                        citedWeeksOf(cited, fact.getId()), sourceMessageByFactId.get(fact.getId())))
                .toList();
    }
```

`CompanionMapper` — the 3-arg overload delegates to a new 4-arg one:

```java
    default KnowledgeFactResponse toKnowledgeFactResponse(
            KnowledgeFactEntity entity, String patternTitle, Integer citedWeeks) {
        return toKnowledgeFactResponse(entity, patternTitle, citedWeeks, null);
    }

    /** S6 (mezo-d6ivw.6): + mute state and provenance. The pattern id comes from the S2
     *  promotion envelope; the chat message id from the accepted candidate (list-time join). */
    default KnowledgeFactResponse toKnowledgeFactResponse(
            KnowledgeFactEntity entity, String patternTitle, Integer citedWeeks, UUID sourceMessageId) {
        MemoryProvenanceEnvelope envelope = entity.getProvenance();
        return KnowledgeFactResponse.builder()
                .citedWeeks(citedWeeks)
                .id(entity.getId())
                .factText(entity.getFactText())
                .category(entity.getCategory())
                .source(entity.getSource())
                .owner(KnowledgeFactResponse.OwnerEnum.fromValue(entity.getOwner()))
                .reinforcementCount(entity.getReinforcementCount())
                .includeInPrompt(entity.isIncludeInPrompt())
                .lastReinforcedAt(toOffset(entity.getLastReinforcedAt()))
                .createdAt(toOffset(entity.getCreatedAt()))
                .patternTitle(patternTitle)
                .mutedReason(entity.getMutedReason() == null ? null
                        : KnowledgeFactResponse.MutedReasonEnum.fromValue(entity.getMutedReason()))
                .mutedAt(toOffset(entity.getMutedAt()))
                .supersededBy(entity.getSupersededBy())
                .provenance(KnowledgeFactProvenance.builder()
                        .sourceKind(KnowledgeFactProvenance.SourceKindEnum.fromValue(entity.getSource()))
                        .patternId(envelope == null ? null : envelope.patternId())
                        .sourceMessageId(sourceMessageId)
                        .build())
                .build();
    }
```

(import `io.mrkuhne.mezo.api.dto.KnowledgeFactProvenance`, `io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope`, `java.util.UUID`.)

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='CompanionFactProvenanceApiIT,CompanionFactApiIT,KnowledgeFactMuteReasonIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/ backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionFactProvenanceApiIT.java frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): tény-provenancia és elhallgattatás-ok a dróton (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A4: `ForgetService.forgetFact` + `DELETE /api/companion/fact/{factId}`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ForgetService.java`
- Modify: `api/feature/companion/companion.yml` (`/api/companion/fact/{factId}` gains `delete`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ForgetServiceIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionForgetApiIT.java`

**Interfaces:**
- Consumes: A1 veto repo + entity, `PatternEntity.STATUS_FORGOTTEN`.
- Produces: `ForgetService.forgetFact(UUID userId, UUID factId)` — 404 (`RESOURCE_NOT_FOUND`) for missing/foreign; soft-deletes the fact; writes veto `fact_text` (normalized); if the fact came from a pattern (envelope `patternId`, or any live pattern whose `promotedFactId` equals it) also writes veto `pattern` and sets that pattern (and any live, not-yet-decided drift row `drift-<patternId>`) to `forgotten`; publishes `KnowledgeFactChangedEvent(userId, factId)` and, when a pattern was forgotten, `PatternRetractedEvent(userId, patternId)`. Idempotent veto writes (exists-check first).
- Later: Task A9 adds `ForgetService.forgetObservation(UUID userId, UUID patternId)` to this class (no stub now — `ArchitectureTest.no_raw_generic_exceptions_outside_techcore` forbids a throwing placeholder).
- Produces wire: `DELETE /api/companion/fact/{factId}` → 204 / 401 / 404, operationId `forgetFact`, tag `Companion`.

- [ ] **Step 1: Write the failing service IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ForgetService;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S6 (mezo-d6ivw.6) Task A4: "Elfelejtem" on a fact is permanent and vetoed. */
class ForgetServiceIT extends AbstractIntegrationTest {

    @Autowired private ForgetService forgetService;
    @Autowired private KnowledgeFactService knowledgeFactService;
    @Autowired private KnowledgeFactRepository facts;
    @Autowired private PatternRepository patterns;
    @Autowired private MemoryForgetVetoRepository vetoes;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void forgetFact_shouldSoftDeleteAndVetoItsText() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "  Mázli a  macskád ", "life", 2, true,
                KnowledgeFactEntity.SOURCE_CHAT);

        forgetService.forgetFact(owner, fact.getId());

        assertThat(facts.findByIdAndCreatedByAndDeletedFalse(fact.getId(), owner)).isEmpty();
        assertThat(knowledgeFactService.list(owner)).noneMatch(f -> f.getId().equals(fact.getId()));
        assertThat(knowledgeFactService.renderPromptBlock(owner)).doesNotContain("Mázli");
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, "mázli a macskád")).isTrue();
    }

    @Test
    void forgetFact_shouldAlsoForgetItsObservation_whenPatternSourced() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fact = factPopulator.fact(owner, row.getTitle(), "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        facts.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        patternPopulator.save(row);

        forgetService.forgetFact(owner, fact.getId());

        assertThat(patterns.findById(row.getId()).orElseThrow().isForgotten()).isTrue();
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_PATTERN, row.getId().toString())).isTrue();
    }

    @Test
    void forgetFact_shouldReturn404_forForeignFact() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Az enyém", "life", 0);

        assertThatThrownBy(() -> forgetService.forgetFact(stranger, fact.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(facts.findById(fact.getId())).isPresent();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=ForgetServiceIT -Dmezo.test.use-testcontainers=true`
Expected: compilation FAIL — `ForgetService` missing.

- [ ] **Step 3: Implement `ForgetService`**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S6 (mezo-d6ivw.6): the ONE place "Elfelejtem" happens. A forget is permanent — there is no
 * restore endpoint; the FE's ~5 s undo toast sends the request only when it expires.
 *
 * <p>A fact forget soft-deletes the row and vetoes its normalized text, so no text-minting writer
 * re-proposes it. A pattern-sourced fact is the same knowledge as its observation, so both go:
 * the pattern moves to {@code forgotten} (the publisher keeps it closed for good) and its id is
 * vetoed (promotion never re-mints it). Every consumer re-derives from the rows through the
 * already-wired events — graph archives the node, prompt channels simply stop seeing it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ForgetService {

    private final KnowledgeFactRepository factRepository;
    private final PatternRepository patternRepository;
    private final MemoryForgetVetoRepository vetoRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public void forgetFact(UUID userId, UUID factId) {
        KnowledgeFactEntity fact = factRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        Optional<PatternEntity> source = sourcePattern(userId, fact);
        deleteAndVeto(userId, fact);
        source.ifPresent(pattern -> forgetPatternRow(userId, pattern));
    }

    private Optional<PatternEntity> sourcePattern(UUID userId, KnowledgeFactEntity fact) {
        UUID viaEnvelope = fact.getProvenance() == null ? null : fact.getProvenance().patternId();
        if (viaEnvelope != null) {
            Optional<PatternEntity> row = patternRepository.findByIdAndCreatedByAndDeletedFalse(viaEnvelope, userId);
            if (row.isPresent()) return row;
        }
        // pre-S2 promotions carry no envelope — the loose back-reference still finds them
        return patternRepository.findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId).stream()
                .filter(p -> fact.getId().equals(p.getPromotedFactId()))
                .findFirst();
    }

    void deleteAndVeto(UUID userId, KnowledgeFactEntity fact) {
        veto(userId, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT,
                MemoryForgetVetoEntity.normalizeFactText(fact.getFactText()));
        factRepository.delete(fact); // @SQLDelete → soft delete
        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, fact.getId()));
    }

    void forgetPatternRow(UUID userId, PatternEntity pattern) {
        veto(userId, MemoryForgetVetoEntity.DOMAIN_PATTERN, pattern.getId().toString());
        pattern.setStatus(PatternEntity.STATUS_FORGOTTEN);
        patternRepository.save(pattern);
        // an open drift card about a forgotten claim must not ask about it any more
        patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(userId, PatternEntity.KIND_REFLECTION,
                        PatternEntity.PAIR_KEY_DRIFT_PREFIX + pattern.getId())
                .filter(drift -> !drift.isUserFrozen())
                .ifPresent(drift -> {
                    drift.setStatus(PatternEntity.STATUS_FORGOTTEN);
                    patternRepository.save(drift);
                });
        eventPublisher.publishEvent(new PatternRetractedEvent(userId, pattern.getId()));
    }

    private void veto(UUID userId, String domain, String key) {
        if (vetoRepository.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(userId, domain, key)) return;
        MemoryForgetVetoEntity veto = new MemoryForgetVetoEntity();
        veto.setCreatedBy(userId);
        veto.setDomain(domain);
        veto.setVetoKey(key.length() > 500 ? key.substring(0, 500) : key);
        vetoRepository.save(veto);
    }
}
```

(`PatternEntity.isUserFrozen()` is `confirmed|rejected` — a CONFIRMED drift row is itself an observation that the hub lists; it is only forgotten by its own "Elfelejtem".)

- [ ] **Step 4: Contract + controller + API IT**

companion.yml, under `/api/companion/fact/{factId}` next to `patch`:

```yaml
    delete:
      tags: [Companion]
      operationId: forgetFact
      summary: >-
        S6 (mezo-d6ivw.6) — Elfelejtem: a tény törlődik, és ugyanebből a forrásból soha nem
        tanulódik újra (vétó). Nincs visszaállítás — a FE visszavonás-ablaka után hívódik.
      parameters:
        - name: factId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '204': { description: Forgotten }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Fact not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Regenerate (`cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`), then in `CompanionController` add the field `private final ForgetService forgetService;` and:

```java
    @Override
    public void forgetFact(UUID factId) {
        forgetService.forgetFact(currentUserId.get(), factId);
    }
```

(If the generated method returns `ResponseEntity<Void>`, return `ResponseEntity.noContent().build()` — check the generated `CompanionApi.forgetFact` signature; `undoPersonFact` in `PeopleController` returns `void` for the same 204 shape.)

`CompanionForgetApiIT`:

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateFactRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CompanionForgetApiIT extends ApiIntegrationTest {

    private static final String FACTS = "/api/companion/fact";

    @Test
    void delete_shouldForgetAndDisappearFromTheList() {
        KnowledgeFactResponse created = postForBody(FACTS,
                CreateFactRequest.builder().factText("Felejtsd el").category("life").build(),
                ownerAuthHeaders(), HttpStatus.CREATED, KnowledgeFactResponse.class);

        deleteAndExpect(FACTS + "/" + created.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        List<KnowledgeFactResponse> facts = getForList(FACTS, ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);
        assertThat(facts).noneMatch(f -> f.getId().equals(created.getId()));
    }

    @Test
    void delete_shouldReturn404_forUnknownFact() {
        deleteAndExpect(FACTS + "/" + UUID.randomUUID(), ownerAuthHeaders(), HttpStatus.NOT_FOUND);
    }

    @Test
    void delete_shouldReturn401_withoutToken() {
        deleteAndExpect(FACTS + "/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED);
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='ForgetServiceIT,CompanionForgetApiIT,CompanionSwitchOffIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS (switch-off IT proves the new bean is gated like its siblings).

- [ ] **Step 6: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ForgetService.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ForgetServiceIT.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionForgetApiIT.java
git commit -m "feat(companion): Elfelejtem — tény törlése vétóval, forrás-észrevétellel együtt (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A5: Every text-minting writer honours the veto; promotion honours the pattern veto

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactExtractionService.java:92-97`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyLessonService.java:95-101`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternService.java:181-188` (`promoteIfFirst`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ForgetVetoWritersIT.java`

**Interfaces:**
- Consumes: A1 `MemoryForgetVetoRepository.findByCreatedByAndDomainAndDeletedFalse`, `existsBy…`.
- Produces: chat extraction and weekly lessons skip vetoed texts silently (no candidate, no reinforcement, no notification); `promoteIfFirst` on a vetoed pattern id promotes nothing (the confirm itself still records).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.FactExtractionService;
import io.mrkuhne.mezo.feature.companion.service.ForgetService;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyLessonService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** S6 (mezo-d6ivw.6) Task A5: a forgotten thing is never re-learned from the same source. */
@ActiveProfiles("companion-fake")
class ForgetVetoWritersIT extends AbstractIntegrationTest {

    @Autowired private FactExtractionService extraction;
    @Autowired private WeeklyLessonService weeklyLessons;
    @Autowired private ForgetService forgetService;
    @Autowired private PatternService patternService;
    @Autowired private LearnedFactRepository candidates;
    @Autowired private PatternRepository patterns;
    @Autowired private MemoryForgetVetoRepository vetoes;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void chatExtraction_shouldNotProposeAForgottenText() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Laktózérzékeny vagy.", "fuel", 1, true,
                KnowledgeFactEntity.SOURCE_CHAT);
        forgetService.forgetFact(owner, fact.getId());

        // FakeCompanionLlm's extraction branch echoes a scripted fact list — see the
        // FactExtractionServiceIT idiom for the marker; script the SAME text, different case/spacing.
        int persisted = extraction.extractFromTurn(owner, UUID.randomUUID(),
                "[fake-facts:[{\"fact\":\"laktózérzékeny  vagy.\",\"category\":\"fuel\"}]]", "Rendben.");

        assertThat(persisted).isZero();
        assertThat(candidates.findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(owner)).isEmpty();
    }

    @Test
    void weeklyLessons_shouldSkipAForgottenText() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Hétvégén kevesebb a fehérje.", "fuel", 0);
        forgetService.forgetFact(owner, fact.getId());

        int written = weeklyLessons.propose(owner, LocalDate.of(2026, 9, 21), List.of(
                new WeeklyLessonService.LessonProposal("Hétvégén kevesebb a fehérje.", "fuel", null, null)));

        assertThat(written).isZero();
    }

    @Test
    void promotion_shouldNotRemintAVetoedPattern() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        MemoryForgetVetoEntity veto = new MemoryForgetVetoEntity();
        veto.setCreatedBy(owner);
        veto.setDomain(MemoryForgetVetoEntity.DOMAIN_PATTERN);
        veto.setVetoKey(row.getId().toString());
        vetoes.saveAndFlush(veto);

        patternService.applyUserConfirm(owner, row);
        patterns.saveAndFlush(row);

        assertThat(patterns.findById(row.getId()).orElseThrow().getPromotedFactId()).isNull();
    }
}
```

`[fake-facts:<json-array>]` is `FakeCompanionLlm`'s real extraction script marker (`FakeCompanionLlm.java:190-192`, returned verbatim to extraction calls whose system prompt starts with `FactExtractionService.EXTRACTION_MARKER`); `FactExtractionServiceIT:64` is the call-shape precedent.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=ForgetVetoWritersIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — a candidate is persisted / a lesson is written / a fact is promoted.

- [ ] **Step 3: Implement**

`FactExtractionService` — inject `private final MemoryForgetVetoRepository vetoRepository;` and after the pending-candidate loop that fills `known`:

```java
        // S6 (mezo-d6ivw.6): a forgotten text is never proposed again from the chat. Added to
        // `known` (not to `confirmed`), so a hit is silent — no candidate, no reinforcement.
        vetoRepository.findByCreatedByAndDomainAndDeletedFalse(userId, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT)
                .forEach(v -> known.add(v.getVetoKey()));
```

`WeeklyLessonService` — inject the same repository and, after the two `known` fills:

```java
        // S6 (mezo-d6ivw.6): the weekly review never re-offers what the user made Mezo forget.
        vetoRepository.findByCreatedByAndDomainAndDeletedFalse(userId, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT)
                .forEach(v -> known.add(v.getVetoKey()));
```

`PatternService` — inject `private final MemoryForgetVetoRepository vetoRepository;` and guard `promoteIfFirst`:

```java
    private void promoteIfFirst(UUID userId, PatternEntity pattern, String source) {
        if (pattern.getPromotedFactId() != null) return;
        // S6 (mezo-d6ivw.6): a forgotten observation's knowledge is never re-minted.
        if (vetoRepository.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                userId, MemoryForgetVetoEntity.DOMAIN_PATTERN, pattern.getId().toString())) return;
        pattern.setPromotedFactId(promote(userId, pattern, source));
        recordEvent(pattern, PatternEventEntity.KIND_PROMOTED,
                PatternEventPayloadEnvelope.promoted(pattern.getPromotedFactId()));
        eventPublisher.publishEvent(new KnowledgeFactPromotedEvent(userId, pattern.getPromotedFactId()));
    }
```

(The veto keys are stored already normalized — `WeeklyLessonService.normalize` and `FactExtractionService.normalize` use the same rule, pinned by `MemoryForgetVetoEntityTest`.)

- [ ] **Step 4: Run to verify it passes (plus the writers' own suites)**

Run: `cd backend && ./mvnw test -Dtest='ForgetVetoWritersIT,FactExtractionServiceIT,ChatExtractionFlowIT,FactCandidateServiceIT,CompanionPatternApiIT,ReflectionReplyServiceIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS. Also run the weekly lesson IT: `cd backend && ./mvnw test -Dtest='WeeklyLesson*' -Dmezo.test.use-testcontainers=true`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyLessonService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ForgetVetoWritersIT.java
git commit -m "feat(companion): a vétó minden szövegből tanuló írónál és a promóciónál él (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A6: Recheck trace (`rechecked_at`) + the drift claim

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/KnowledgeRecheckService.java` (`RECHECK_PROMPT`, `RecheckAnswer`, `recheckRow`, `driftRow`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java:1085-1092` (default recheck JSON)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/KnowledgeRecheckTraceIT.java`

**Interfaces:**
- Produces: after `runFor`, the SOURCE row's `recheckedAt` is set for verdict `holds` and `drift`, untouched for `unknown` / unparseable / skipped rows. `RecheckAnswer(String verdict, String text, String claim)`; the drift row's `title` = `claim` (trimmed, ≤200) when non-blank, else the first sentence of `text`.

- [ ] **Step 1: Write the failing IT** (copy the class header, `@ActiveProfiles`, `@TestPropertySource` and the `confirmedPlanlessPromoted` helper verbatim from `KnowledgeRecheckServiceIT` lines 1-82)

```java
    @Test
    void runFor_shouldStampRecheckedAt_whenHolds() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"holds\",\"text\":\"\"}]]" + DEFAULT_CLAIM);

        recheckService.runFor(owner);

        assertThat(patternRepository.findById(row.getId()).orElseThrow().getRecheckedAt()).isNotNull();
    }

    @Test
    void runFor_shouldStampRecheckedAtAndUseTheClaimAsDriftTitle_whenDrift() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"drift\",\"text\":\"Korábban megerősítetted, hogy X. Mostanában másképp.\","
                        + "\"claim\":\"Mostanában a randis napok estéje is feltölt.\"}]]" + DEFAULT_CLAIM);

        recheckService.runFor(owner);

        assertThat(patternRepository.findById(row.getId()).orElseThrow().getRecheckedAt()).isNotNull();
        PatternEntity drift = patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                owner, PatternEntity.KIND_REFLECTION, "drift-" + row.getId()).orElseThrow();
        assertThat(drift.getTitle()).isEqualTo("Mostanában a randis napok estéje is feltölt.");
    }

    @Test
    void runFor_shouldFallBackToFirstSentence_whenClaimMissing() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"drift\",\"text\":\"Első mondat. Második.\"}]]" + DEFAULT_CLAIM);

        recheckService.runFor(owner);

        PatternEntity drift = patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                owner, PatternEntity.KIND_REFLECTION, "drift-" + row.getId()).orElseThrow();
        assertThat(drift.getTitle()).isEqualTo("Első mondat.");
    }

    @Test
    void runFor_shouldNotStamp_whenUnknown() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"unknown\",\"text\":\"\"}]]" + DEFAULT_CLAIM);

        recheckService.runFor(owner);

        assertThat(patternRepository.findById(row.getId()).orElseThrow().getRecheckedAt()).isNull();
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=KnowledgeRecheckTraceIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `getRecheckedAt()` is null; drift title is the first sentence.

- [ ] **Step 3: Implement**

`RECHECK_PROMPT` — replace the JSON line and the drift paragraph ending with:

```java
            JSON-nal: {"verdict":"holds|drift|unknown","text":"...","claim":"..."}
            drift esetén a text egy rövid, hedged megfigyelés legyen, ami így indul:
            „Korábban megerősítetted, hogy …” és úgy folytatódik, hogy az utóbbi hetekben
            mintha másképp alakulna — kérdésként, nem ítéletként. drift esetén a claim egyetlen
            rövid, kijelentő mondat arról, ami MOST igaznak tűnik (pl. „Mostanában a randis
            napok estéje is feltölt.”) — ez lesz az új tény, ha megerősíti. holds/unknown
            esetén a text és a claim lehet üres.
```

`record RecheckAnswer(String verdict, String text, String claim) {}`

In `recheckRow`, right after `RecheckAnswer answer = ask(userId, row, fact);`:

```java
        if (answer != null && ("holds".equals(answer.verdict()) || "drift".equals(answer.verdict()))) {
            // S6 (mezo-d6ivw.6): the hub's "legutóbb ellenőrizve <dátum>" — only an actual verdict
            // counts as a check; unknown/failed/skipped rows keep their honest older date.
            row.setRecheckedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            patternRepository.save(row);
        }
```

In `driftRow`, replace `row.setTitle(firstSentence(answer.text()));` with:

```java
        String claim = answer.claim() == null ? "" : answer.claim().strip();
        row.setTitle(claim.isEmpty() ? firstSentence(answer.text())
                : claim.length() > MAX_TITLE_CHARS ? claim.substring(0, MAX_TITLE_CHARS) : claim);
```

`FakeCompanionLlm` default drift JSON gains a claim:

```java
                    : "{\"verdict\":\"drift\",\"text\":\"Korábban megerősítetted, hogy"
                            + " ez így van — az utóbbi hetekben mintha másképp"
                            + " alakulna. Figyeljem tovább?\","
                            + "\"claim\":\"Mostanában ez másképp alakul.\"}";
```

- [ ] **Step 4: Run to verify it passes (plus the existing recheck suites)**

Run: `cd backend && ./mvnw test -Dtest='KnowledgeRecheckTraceIT,KnowledgeRecheckServiceIT,KnowledgeRecheckServiceBudgetOffIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS. If a `KnowledgeRecheckServiceIT` assertion pins the drift title of the default fake answer, update it to `"Mostanában ez másképp alakul."`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/KnowledgeRecheckService.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/
git commit -m "feat(reflection): újraellenőrzés nyoma (rechecked_at) és a drift-állítás mint cím (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A7: Drift supersession on confirm

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternService.java:155-179`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/DriftSupersessionIT.java`

**Interfaces:**
- Consumes: A1 `KnowledgeFactEntity.mute`, A5 veto guard in `promoteIfFirst`.
- Produces: `applyUserConfirm` on a drift row ⇒ drift row `confirmed`, a NEW fact (source `pattern`, provenance `patternPromotion(driftRowId, "user")`, text = drift title) linked as the drift row's `promotedFactId`; the original row's fact muted `superseded` with `supersededBy = newFactId`; `KnowledgeFactPromotedEvent(new)` + `KnowledgeFactChangedEvent(old)` published; `PatternConfirmedEvent(drift)` published. Original row missing / its fact gone / already superseded ⇒ promote only, `log.info`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

/** S6 (mezo-d6ivw.6) Task A7: confirming a drift card replaces the old knowledge, visibly. */
class DriftSupersessionIT extends AbstractIntegrationTest {

    @Autowired private PatternService patternService;
    @Autowired private PatternRepository patterns;
    @Autowired private KnowledgeFactRepository facts;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TransactionTemplate tx;

    private PatternEntity original(UUID owner) {
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Randi után estére lemerülsz.", "life", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        facts.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        return patternPopulator.save(row);
    }

    private PatternEntity drift(UUID owner, UUID originalId) {
        PatternEntity drift = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        drift.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + originalId);
        drift.setTitle("Mostanában a randis napok estéje is feltölt.");
        return patternPopulator.save(drift);
    }

    private void confirm(UUID owner, UUID patternId) {
        tx.executeWithoutResult(s -> {
            PatternEntity row = patterns.findById(patternId).orElseThrow();
            patternService.applyUserConfirm(owner, row);
            patterns.saveAndFlush(row);
        });
    }

    @Test
    void confirmDrift_shouldMintNewFactAndMuteTheOriginalAsSuperseded() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity original = original(owner);
        PatternEntity drift = drift(owner, original.getId());

        confirm(owner, drift.getId());

        PatternEntity confirmedDrift = patterns.findById(drift.getId()).orElseThrow();
        assertThat(confirmedDrift.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fresh = facts.findById(confirmedDrift.getPromotedFactId()).orElseThrow();
        assertThat(fresh.getFactText()).isEqualTo("Mostanában a randis napok estéje is feltölt.");
        assertThat(fresh.isIncludeInPrompt()).isTrue();
        assertThat(fresh.getProvenance().patternId()).isEqualTo(drift.getId());

        KnowledgeFactEntity old = facts.findById(original.getPromotedFactId()).orElseThrow();
        assertThat(old.isIncludeInPrompt()).isFalse();
        assertThat(old.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_SUPERSEDED);
        assertThat(old.getSupersededBy()).isEqualTo(fresh.getId());
        assertThat(old.getMutedAt()).isNotNull();
    }

    @Test
    void confirmDrift_shouldPromoteOnly_whenOriginalFactIsGone() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity original = original(owner);
        facts.deleteById(original.getPromotedFactId()); // soft delete
        PatternEntity drift = drift(owner, original.getId());

        confirm(owner, drift.getId());

        assertThat(patterns.findById(drift.getId()).orElseThrow().getPromotedFactId()).isNotNull();
    }

    @Test
    void confirmDrift_shouldPromoteOnly_whenPairKeyIsNotAUuid() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity drift = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        drift.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + "not-a-uuid");
        patternPopulator.save(drift);

        confirm(owner, drift.getId());

        assertThat(patterns.findById(drift.getId()).orElseThrow().getPromotedFactId()).isNotNull();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=DriftSupersessionIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `getPromotedFactId()` null (today's drift confirm freezes only).

- [ ] **Step 3: Implement** — replace `applyUserConfirm`'s drift call and `applyDriftConfirm`:

```java
            if (pattern.isDrift()) {
                applyDriftConfirm(userId, pattern);
                return;
            }
```

```java
    /**
     * S6 (mezo-d6ivw.6, owner decision 4): confirming a drift card is an automatic replacement.
     * The drifted claim (the row's title — the recheck's {@code claim}) becomes a NEW fact through
     * the normal confirm path, and the ORIGINAL fact is muted with a visible reason and a link to
     * its successor. The user may re-enable the old one from the hub. Fail-open: a missing or
     * already-gone original means promote only.
     */
    private void applyDriftConfirm(UUID userId, PatternEntity drift) {
        applyConfirm(userId, drift, CONFIRM_SOURCE_USER);
        UUID freshFactId = drift.getPromotedFactId();
        if (freshFactId == null) return; // vetoed or already promoted — nothing to supersede with
        originalFactOf(userId, drift).ifPresentOrElse(old -> {
            if (!old.isIncludeInPrompt() && KnowledgeFactEntity.MUTED_SUPERSEDED.equals(old.getMutedReason())) return;
            old.mute(KnowledgeFactEntity.MUTED_SUPERSEDED, Instant.now());
            old.setSupersededBy(freshFactId);
            knowledgeFactRepository.save(old);
            eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, old.getId()));
        }, () -> log.info("Drift supersession: no live original fact for drift row {} of user {} — promote only",
                drift.getId(), userId));
    }

    private Optional<KnowledgeFactEntity> originalFactOf(UUID userId, PatternEntity drift) {
        UUID originalId;
        try {
            originalId = UUID.fromString(drift.getPairKey().substring(PatternEntity.PAIR_KEY_DRIFT_PREFIX.length()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        return patternRepository.findByIdAndCreatedByAndDeletedFalse(originalId, userId)
                .map(PatternEntity::getPromotedFactId)
                .flatMap(factId -> knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId));
    }
```

Add `@Slf4j` to the class, imports `java.time.Instant`, `java.util.Optional`, `lombok.extern.slf4j.Slf4j`. Update the stale S2 javadoc on `applyUserConfirm` ("…see {@link #applyDriftConfirm}" stays; drop "must NOT mint a fact"). `applyConfirm` already appends the confirmed event, promotes via `promoteIfFirst` (so the veto applies) and publishes `PatternConfirmedEvent`.

- [ ] **Step 4: Run to verify it passes (plus S2's drift/confirm suites)**

Run: `cd backend && ./mvnw test -Dtest='DriftSupersessionIT,ReflectionReplyServiceIT,CompanionPatternApiIT,KnowledgeRecheckServiceIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS. An S2 test that pinned "drift confirm mints no fact" must be inverted to the S6 behaviour — say so in the commit body.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/
git commit -m "feat(companion): drift-megerősítés felülírja a régi tényt, látható okkal (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A8: Forgotten rows never surface — every user-facing pattern reader filters them

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternService.java:61-68` (`list`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/ObservationFeedService.java:94-99,132,174-178`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/ReflectionReplyService.java:93-96`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/ReflectionDigestService.java:207-210`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternPairDetailService.java:115-121`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/HypothesisPipelineService.java:474` (`closedHypotheses`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/ForgottenPatternInvisibleIT.java`

**Interfaces:**
- Produces: a `forgotten` row is absent from `GET /api/companion/pattern`, from every `GET /api/companion/observation` group (fresh/return/watching/confirmed) and from pending release; a reply to it is 404; the digest skips it; pair detail 404s; `closedHypotheses` lists it (so a reworded duplicate dies at PROPOSE). `GroundedHypothesisPublisher` needs no change (it already keeps non-open rows closed) — the IT proves it.

- [ ] **Step 1: Write the failing IT** (header copied from `KnowledgeRecheckServiceIT`: `@ActiveProfiles("companion-fake")`, quiet hours disabled)

```java
    @Test
    void forgottenRow_shouldNotAppearInThePatternListOrTheFeed() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED, Instant.now());
        row.setStatus(PatternEntity.STATUS_FORGOTTEN);
        patternPopulator.save(row);

        assertThat(patternService.list(owner)).noneMatch(p -> p.getId().equals(row.getId()));
        assertThat(feed.forDay(owner, null)).noneMatch(c -> c.getPatternId().equals(row.getId()));
    }

    @Test
    void forgottenRow_shouldRejectReplies() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_FORGOTTEN);

        assertThatThrownBy(() -> replyService.reply(owner, row.getId(), "watch", null))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void forgottenRow_shouldBeListedAsClosedForThePipeline() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_FORGOTTEN);

        assertThat(pipeline.closedHypotheses(owner)).contains(row.getTitle());
    }
```

(`closedHypotheses` is package-private in `io.mrkuhne.mezo.feature.companion.service` — put this third test in `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ForgottenClosedHypothesesIT.java` in that package, or call it through the nightly prompt capture the `HypothesisPipelineServiceIT` already uses; pick the one that compiles without widening visibility.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='ForgottenPatternInvisibleIT,ForgottenClosedHypothesesIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL on the list and the closed-hypotheses assertions (the reply may already fail for other reasons — check the message is `COMPANION_PATTERN_NOT_FOUND` after the fix).

- [ ] **Step 3: Implement the filters**

`PatternService.list`: add `.filter(pattern -> !pattern.isForgotten())` before `.map`.

`ObservationFeedService`: in the event loop condition (L94) add `|| row.isForgotten()` as its own clause (NOT only under `inbox &&` — a forgotten row is gone from history too); in the confirmed loop (L132) `if (row == null || row.isForgotten() || !row.isReflectionOwned() || !validEvidence(userId, row))`; in `releasePending` (L174) add `|| row.isForgotten()`. The watching query is status-scoped to `monitoring`, so it needs nothing.

`ReflectionReplyService.reply`: `.filter(PatternEntity::isReflectionOwned).filter(p -> !p.isForgotten())`.

`ReflectionDigestService.row`: `.filter(PatternEntity::isReflectionOwned).filter(p -> !p.isForgotten())`.

`PatternPairDetailService.reflectionDetail`: `if (row == null || row.isForgotten() || row.getTestPlan() == null)`.

`HypothesisPipelineService.closedHypotheses`: `Set.of(PatternEntity.STATUS_REFUTED, PatternEntity.STATUS_REJECTED, PatternEntity.STATUS_FORGOTTEN)`.

- [ ] **Step 4: Run to verify it passes (plus the touched readers' suites)**

Run: `cd backend && ./mvnw test -Dtest='ForgottenPatternInvisibleIT,ForgottenClosedHypothesesIT,CompanionObservationApiIT,ReflectionReplyServiceIT,ReflectionDigestServiceIT,CompanionPatternPairDetailApiIT,HypothesisPipelineServiceIT,GroundedHypothesisPipelineIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(reflection): elfelejtett észrevétel sehol nem bukkan fel újra (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A9: Hub observations read + observation forget + fact evidence

**Files:**
- Modify: `api/feature/companion/companion.yml` (3 new operations, 1 new schema)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/ObservationFeedService.java` (extract `rowEvidence`, `refEvidence`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/KnowledgeObservationService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ForgetService.java` (`forgetObservation`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionObservationController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/KnowledgeObservationServiceIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/companion/KnowledgeObservationApiIT.java`

**Interfaces:**
- Produces wire (tag `CompanionObservation`, reflection-gated controller):
  - `GET /api/companion/observation/knowledge` → `KnowledgeObservationResponse[]`, operationId `listKnowledgeObservations`.
  - `DELETE /api/companion/observation/{patternId}` → 204/401/404, operationId `forgetObservation`.
  - `GET /api/companion/fact/{factId}/evidence` → `ObservationEvidenceItem[]` (≤5 records), operationId `getFactEvidence`; 404 for a missing/foreign fact.
  - `KnowledgeObservationResponse { patternId: uuid, title: string, confirmedAt: date-time, recheckedAt: date-time|null, status: 'confirmed'|'refuted', factId: uuid|null, factMutedReason: 'user'|'refuted'|'superseded'|null, factMutedAt: date-time|null, replacesPatternId: uuid|null, replacedByPatternId: uuid|null, topicKey: string|null, evidence: ObservationEvidenceItem[] }` (required: patternId, title, confirmedAt, status, evidence).
- Produces: `ObservationFeedService.rowEvidence(UUID, PatternEntity)` and `refEvidence(UUID, List<String>)` (public); `KnowledgeObservationService.list(UUID)`, `factEvidence(UUID userId, UUID factId)`; `ForgetService.forgetObservation(UUID, UUID)`.
- Rows listed: reflection-owned, status `confirmed`, or `refuted` with a `promotedFactId`; newest confirm first. `confirmedAt` = newest `KIND_CONFIRMED` event, else `lastDetectedAt`. Fact evidence: chat/weekly facts → the accepted candidate's `derivedFromMessageId` as `ai_message:<id>`; pattern facts → the source pattern's `rowEvidence`; manual/question → `[]`.

- [ ] **Step 1: Contract**

```yaml
  /api/companion/observation/knowledge:
    get:
      tags: [CompanionObservation]
      operationId: listKnowledgeObservations
      summary: >-
        S6 (mezo-d6ivw.6) — a Tudástár Észrevételek szakasza: a megerősített (és a cáfolt, de
        tényt hagyó) észrevételek, a belőlük tanult tény állapotával, a drift-párral és a sor
        saját bizonyítékaival (legfeljebb 5).
      responses:
        '200':
          description: Observations, newest confirmation first
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/KnowledgeObservationResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/companion/observation/{patternId}:
    delete:
      tags: [CompanionObservation]
      operationId: forgetObservation
      summary: >-
        S6 — Elfelejtem egy észrevételre: a belőle tanult tény törlődik (vétóval), az
        észrevétel soha többé nem jelenik meg és nem tanulódik újra.
      parameters:
        - name: patternId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '204': { description: Forgotten }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Not found, foreign, or not a reflection-owned observation
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/companion/fact/{factId}/evidence:
    get:
      tags: [CompanionObservation]
      operationId: getFactEvidence
      summary: >-
        S6 — Honnan tudom? egy tényre: a forrás strukturált bizonyítékai (chat → a
        beszélgetés-üzenet; észrevétel → a sor bizonyítékai), legfeljebb 5 elem.
      parameters:
        - name: factId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Evidence items (may be empty for manual facts)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/ObservationEvidenceItem' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Fact not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

```yaml
    KnowledgeObservationResponse:
      type: object
      description: >-
        S6 (mezo-d6ivw.6) — egy észrevétel a Tudástárban. A némítás a belőle tanult TÉNYEN él
        (factMutedReason); a drift-pár a replacesPatternId / replacedByPatternId mezőkön.
      required: [patternId, title, confirmedAt, status, evidence]
      properties:
        patternId: { type: string, format: uuid }
        title: { type: string }
        confirmedAt: { type: string, format: date-time, description: 'A legutóbbi megerősítés ideje.' }
        recheckedAt: { type: string, format: date-time, nullable: true, description: 'A negyedéves újraellenőrzés legutóbbi ítélete (holds/drift); null = még nem.' }
        status: { type: string, enum: [confirmed, refuted] }
        factId: { type: string, format: uuid, nullable: true }
        factMutedReason: { type: string, nullable: true, enum: [user, refuted, superseded] }
        factMutedAt: { type: string, format: date-time, nullable: true }
        replacesPatternId: { type: string, format: uuid, nullable: true, description: 'Drift-sor: az eredeti észrevétel, amit felülírt.' }
        replacedByPatternId: { type: string, format: uuid, nullable: true, description: 'Eredeti sor: a megerősített drift-sor, ami felülírta.' }
        topicKey: { type: string, nullable: true, description: 'A normalizált observation-topic-key (a FE téma-csoportosításához).' }
        evidence:
          type: array
          items: { $ref: '#/components/schemas/ObservationEvidenceItem' }
```

Regenerate both sides (`cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`). The build now fails until the three controller methods exist — Steps 3-4 add them.

- [ ] **Step 2: Write the failing service IT** (`@ActiveProfiles("companion-fake")`; populators as in earlier tasks plus `PatternEventPopulator`, `LearnedFactPopulator`, `AiMessagePopulator`; read `AiMessagePopulator` for its user-message factory before writing the chat case)

```java
    @Test
    void list_shouldPairADriftWithItsOriginal_andCarryTheFactState() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity original = confirmedWithFact(owner, "Randi után estére lemerülsz.");
        PatternEntity drift = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        drift.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + original.getId());
        drift.setTitle("Mostanában a randis napok estéje is feltölt.");
        patternPopulator.save(drift);
        confirmAsUser(owner, drift.getId()); // TransactionTemplate + PatternService.applyUserConfirm (A7)

        List<KnowledgeObservationResponse> list = service.list(owner);

        KnowledgeObservationResponse newer = byId(list, drift.getId());
        KnowledgeObservationResponse older = byId(list, original.getId());
        assertThat(newer.getReplacesPatternId()).isEqualTo(original.getId());
        assertThat(older.getReplacedByPatternId()).isEqualTo(drift.getId());
        assertThat(older.getFactMutedReason().getValue()).isEqualTo("superseded");
        assertThat(newer.getFactMutedReason()).isNull();
    }

    @Test
    void list_shouldSkipForgottenStatisticalAndOpenRows() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity kept = confirmedWithFact(owner, "Megtartott");
        patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_FORGOTTEN);
        patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        patternPopulator.statistical(owner, "pair-s6", PatternEntity.STATUS_CONFIRMED);

        List<KnowledgeObservationResponse> list = service.list(owner);

        assertThat(list).extracting(KnowledgeObservationResponse::getPatternId).containsExactly(kept.getId());
    }

    @Test
    void factEvidence_shouldResolveTheChatTurn_forAChatFact() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        AiMessageEntity message = messagePopulator.message(conversation, "user", "Laktózérzékeny vagyok, csak laktózmentes jöhet.");
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Laktózérzékeny vagy.", "fuel", 1, true,
                KnowledgeFactEntity.SOURCE_CHAT);
        LearnedFactEntity candidate = learnedFactPopulator.candidate(owner, "Laktózérzékeny vagy.", message.getId());
        candidate.setUserDecision(LearnedFactEntity.DECISION_ACCEPT);
        candidate.setPromotedFactId(fact.getId());
        learnedFactRepository.saveAndFlush(candidate);

        List<ObservationEvidenceItem> items = service.factEvidence(owner, fact.getId());

        assertThat(items).singleElement().satisfies(item -> {
            assertThat(item.getType()).isEqualTo("record");
            assertThat(item.getSource()).isEqualTo("ai_message");
            assertThat(item.getRef()).isEqualTo("ai_message:" + message.getId());
        });
    }

    @Test
    void factEvidence_shouldBeEmpty_forAManualFact() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity manual = factPopulator.fact(owner, "Kézi", "life", 0);
        assertThat(service.factEvidence(owner, manual.getId())).isEmpty();
    }
```

Autowire `AiConversationPopulator conversationPopulator`, `AiMessagePopulator messagePopulator`, `LearnedFactPopulator learnedFactPopulator`, `LearnedFactRepository learnedFactRepository` (the catalogue serves `ai_message` rows with `role = 'user'` only — `ObservationContextService.java:147`). `confirmedWithFact(owner, title)` = `reflectionNoPlan(CONFIRMED)` + title + a `SOURCE_PATTERN` fact with the S2 envelope + `promotedFactId` + a `KIND_CONFIRMED` event via `patternEventPopulator.decision(...)`.

Plus `ForgetServiceIT` gains:

```java
    @Test
    void forgetObservation_shouldForgetTheRowAndItsFact_andNeverRepromote() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fact = factPopulator.fact(owner, row.getTitle(), "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        row.setPromotedFactId(fact.getId());
        patternPopulator.save(row);

        forgetService.forgetObservation(owner, row.getId());

        PatternEntity reread = patterns.findById(row.getId()).orElseThrow();
        assertThat(reread.isForgotten()).isTrue();
        assertThat(facts.findByIdAndCreatedByAndDeletedFalse(fact.getId(), owner)).isEmpty();
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_PATTERN, row.getId().toString())).isTrue();
    }

    @Test
    void forgetObservation_shouldReturn404_forAStatisticalRow() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity stat = patternPopulator.statistical(owner);
        assertThatThrownBy(() -> forgetService.forgetObservation(owner, stat.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd backend && ./mvnw test -Dtest='KnowledgeObservationServiceIT,ForgetServiceIT' -Dmezo.test.use-testcontainers=true`
Expected: compile FAIL (`KnowledgeObservationService`, controller methods missing).

- [ ] **Step 4: Implement**

`ObservationFeedService` — extract, and make `rowCard` use it:

```java
    /** S6 (mezo-d6ivw.6): a row's own evidence exactly as the row cards render it — capped at
     *  {@link #ROW_EVIDENCE_LIMIT} records (slice lesson 3). Shared with the Tudástár hub. */
    public List<ObservationEvidenceItem> rowEvidence(UUID userId, PatternEntity row) {
        return capToNewestRecords(evidenceItems(userId,
                row.getEvidence() == null ? null : row.getEvidence().items()));
    }

    /** S6: canonical refs (e.g. {@code ai_message:<uuid>}) resolved losslessly, capped at 5. */
    public List<ObservationEvidenceItem> refEvidence(UUID userId, List<String> refs) {
        return capToNewestRecords(evidenceItems(userId, refs));
    }
```

and in `rowCard`: `.evidence(rowEvidence(userId, row))`.

`KnowledgeObservationService`:

```java
package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.api.dto.KnowledgeObservationResponse;
import io.mrkuhne.mezo.api.dto.ObservationEvidenceItem;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S6 (mezo-d6ivw.6): the Tudástár's two reflection-side reads — the Észrevételek section and a
 * fact's "Honnan tudom?". Evidence always comes from {@link ObservationFeedService}'s builder
 * (slice lesson 6: never re-format server-side); the mute state lives on the linked FACT.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class KnowledgeObservationService {

    private static final String TOPIC_KEY_PREFIX = "observation-topic-key:";

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final LearnedFactRepository learnedFactRepository;
    private final ObservationFeedService feed;

    @Transactional(readOnly = true)
    public List<KnowledgeObservationResponse> list(UUID userId) {
        List<PatternEntity> rows = patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)
                .stream()
                .filter(PatternEntity::isReflectionOwned)
                .filter(r -> PatternEntity.STATUS_CONFIRMED.equals(r.getStatus())
                        || (PatternEntity.STATUS_REFUTED.equals(r.getStatus()) && r.getPromotedFactId() != null))
                .toList();
        Map<UUID, KnowledgeFactEntity> facts = knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId).stream()
                .collect(Collectors.toMap(KnowledgeFactEntity::getId, Function.identity()));
        Map<UUID, UUID> replacedBy = new HashMap<>();
        for (PatternEntity r : rows) {
            originalIdOf(r).ifPresent(originalId -> replacedBy.put(originalId, r.getId()));
        }
        return rows.stream()
                .map(r -> toResponse(userId, r, facts.get(r.getPromotedFactId()), replacedBy.get(r.getId())))
                .sorted(Comparator.comparing(KnowledgeObservationResponse::getConfirmedAt).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ObservationEvidenceItem> factEvidence(UUID userId, UUID factId) {
        KnowledgeFactEntity fact = knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (KnowledgeFactEntity.SOURCE_PATTERN.equals(fact.getSource())) {
            UUID patternId = fact.getProvenance() == null ? null : fact.getProvenance().patternId();
            Optional<PatternEntity> row = patternId != null
                    ? patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                    : patternRepository.findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId).stream()
                            .filter(p -> factId.equals(p.getPromotedFactId())).findFirst();
            return row.map(r -> feed.rowEvidence(userId, r)).orElse(List.of());
        }
        return learnedFactRepository.findFirstByCreatedByAndPromotedFactIdAndDeletedFalse(userId, factId)
                .map(c -> c.getDerivedFromMessageId())
                .map(messageId -> feed.refEvidence(userId, List.of("ai_message:" + messageId)))
                .orElse(List.of());
    }

    private KnowledgeObservationResponse toResponse(UUID userId, PatternEntity row, KnowledgeFactEntity fact,
                                                    UUID replacedById) {
        Instant confirmedAt = patternEventRepository
                .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, row.getId(), PatternEventEntity.KIND_CONFIRMED)
                .map(PatternEventEntity::getOccurredAt)
                .orElse(row.getLastDetectedAt());
        return KnowledgeObservationResponse.builder()
                .patternId(row.getId())
                .title(row.getTitle())
                .confirmedAt(toOffset(confirmedAt))
                .recheckedAt(toOffset(row.getRecheckedAt()))
                .status(KnowledgeObservationResponse.StatusEnum.fromValue(row.getStatus()))
                .factId(fact == null ? null : fact.getId())
                .factMutedReason(fact == null || fact.getMutedReason() == null ? null
                        : KnowledgeObservationResponse.FactMutedReasonEnum.fromValue(fact.getMutedReason()))
                .factMutedAt(fact == null ? null : toOffset(fact.getMutedAt()))
                .replacesPatternId(originalIdOf(row).orElse(null))
                .replacedByPatternId(replacedById)
                .topicKey(topicKey(row))
                .evidence(feed.rowEvidence(userId, row))
                .build();
    }

    private static Optional<UUID> originalIdOf(PatternEntity row) {
        if (!row.isDrift()) return Optional.empty();
        try {
            return Optional.of(UUID.fromString(row.getPairKey().substring(PatternEntity.PAIR_KEY_DRIFT_PREFIX.length())));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static String topicKey(PatternEntity row) {
        if (row.getEvidence() == null || row.getEvidence().items() == null) return null;
        return row.getEvidence().items().stream()
                .filter(i -> i != null && i.startsWith(TOPIC_KEY_PREFIX))
                .map(i -> i.substring(TOPIC_KEY_PREFIX.length()))
                .findFirst().orElse(null);
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

`ForgetService.forgetObservation` (new method):

```java
    @Transactional
    public void forgetObservation(UUID userId, UUID patternId) {
        PatternEntity pattern = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                .filter(PatternEntity::isReflectionOwned)
                .filter(p -> !p.isForgotten())
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("COMPANION_PATTERN_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (pattern.getPromotedFactId() != null) {
            factRepository.findByIdAndCreatedByAndDeletedFalse(pattern.getPromotedFactId(), userId)
                    .ifPresent(fact -> deleteAndVeto(userId, fact));
        }
        forgetPatternRow(userId, pattern);
    }
```

`CompanionObservationController` — add fields `KnowledgeObservationService knowledgeObservationService`, `ForgetService forgetService` and:

```java
    @Override
    public List<KnowledgeObservationResponse> listKnowledgeObservations() {
        return knowledgeObservationService.list(currentUserId.get());
    }

    @Override
    public void forgetObservation(UUID patternId) {
        forgetService.forgetObservation(currentUserId.get(), patternId);
    }

    @Override
    public List<ObservationEvidenceItem> getFactEvidence(UUID factId) {
        return knowledgeObservationService.factEvidence(currentUserId.get(), factId);
    }
```

`KnowledgeObservationApiIT` (extends `ApiIntegrationTest`): GET `/api/companion/observation/knowledge` returns 200 + an array for the owner; DELETE `/api/companion/observation/{random}` → 404; GET `/api/companion/fact/{random}/evidence` → 404; all three → 401 without token.

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='KnowledgeObservationServiceIT,KnowledgeObservationApiIT,ForgetServiceIT,CompanionObservationApiIT,ReflectionJobSwitchOffIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(api): Tudástár-észrevételek, észrevétel-felejtés és tény-bizonyíték végpont (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A10: Backfill — pre-S2 confirmed plan-less rows get their fact (mezo-4rh4r)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/PatternRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/KnowledgeBackfillRunner.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/KnowledgeBackfillRunnerIT.java`

**Interfaces:**
- Consumes: `PatternService.applyUserConfirm` (and so A5's veto guard + A7's drift branch — drift rows are excluded here anyway).
- Produces: `PatternRepository.findByKindInAndStatusAndPromotedFactIdIsNullAndDeletedFalse(Collection<String> kinds, String status)`; `KnowledgeBackfillRunner.backfill()` → `int` promoted count. Candidates: reflection-owned, `monitoring`, plan-less, not drift, `promotedFactId` null, whose NEWEST `user_reply` choice is `watch`. One `REQUIRES_NEW` transaction per row.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S6 (mezo-d6ivw.6) folds in mezo-4rh4r: stuck pre-S2 "Igen, ez igaz rám" rows are promoted once. */
class KnowledgeBackfillRunnerIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeBackfillRunner runner;
    @Autowired private PatternRepository patterns;
    @Autowired private KnowledgeFactRepository facts;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator eventPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void backfill_shouldPromoteAStuckWatchedRowExactlyOnce() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity stuck = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);
        eventPopulator.userReply(owner, stuck.getId(), "chip", "watch", null);

        runner.backfill();
        UUID factId = patterns.findById(stuck.getId()).orElseThrow().getPromotedFactId();
        runner.backfill(); // idempotent

        PatternEntity reread = patterns.findById(stuck.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
        assertThat(factId).isNotNull();
        assertThat(reread.getPromotedFactId()).isEqualTo(factId);
        assertThat(facts.findByCreatedByAndSourceAndDeletedFalse(owner, "pattern")).hasSize(1);
    }

    @Test
    void backfill_shouldLeaveRowsWhoseNewestReplyIsNotWatch() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);
        eventPopulator.userReply(owner, row.getId(), "chip", "watch", null, Instant.now().minusSeconds(60));
        eventPopulator.userReply(owner, row.getId(), "chip", "reject", null, Instant.now());

        runner.backfill();

        assertThat(patterns.findById(row.getId()).orElseThrow().getPromotedFactId()).isNull();
    }

    @Test
    void backfill_shouldLeaveDriftAndPlannedRows() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity drift = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);
        drift.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + UUID.randomUUID());
        patternPopulator.save(drift);
        eventPopulator.userReply(owner, drift.getId(), "chip", "watch", null);

        runner.backfill();

        assertThat(patterns.findById(drift.getId()).orElseThrow().getPromotedFactId()).isNull();
    }
}
```

(`PatternEventPopulator.userReply(createdBy, patternId, channel, choice, text[, occurredAt])` — `PatternEventPopulator.java:34,41`; the explicit instants keep "newest reply" deterministic.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=KnowledgeBackfillRunnerIT -Dmezo.test.use-testcontainers=true`
Expected: compile FAIL — `KnowledgeBackfillRunner` missing.

- [ ] **Step 3: Implement**

`PatternRepository`:

```java
    /** S6 (mezo-d6ivw.6, mezo-4rh4r): the one-off backfill's work list, across all users. */
    List<PatternEntity> findByKindInAndStatusAndPromotedFactIdIsNullAndDeletedFalse(
            Collection<String> kinds, String status);
```

`KnowledgeBackfillRunner`:

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * S6 (mezo-d6ivw.6) folds in mezo-4rh4r: before S2, "Igen, ez igaz rám" on a PLAN-LESS grounded
 * row only moved it to {@code monitoring} — nothing was left to measure, so it never promoted and
 * the user's confirmed knowledge never became a fact. On every start this runner re-applies the
 * S2 confirm (PatternService.applyUserConfirm — events, provenance, graph event, veto guard) to
 * exactly those rows. Idempotent by construction: a promoted row is {@code confirmed} with a
 * {@code promotedFactId} and leaves the work list. One REQUIRES_NEW transaction per row (slice
 * lesson 11), so one bad row never rolls back the others.
 */
@Slf4j
@Component
@Order(220)
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class KnowledgeBackfillRunner implements CommandLineRunner {

    private static final String CHOICE_WATCH = "watch";

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final PatternService patternService;
    private final PlatformTransactionManager transactionManager;

    @Override
    public void run(String... args) {
        int promoted = backfill();
        if (promoted > 0) {
            log.info("Knowledge backfill (mezo-4rh4r): {} stuck confirmed observation(s) promoted", promoted);
        }
    }

    public int backfill() {
        List<PatternEntity> work = patternRepository.findByKindInAndStatusAndPromotedFactIdIsNullAndDeletedFalse(
                        PatternEntity.REFLECTION_OWNED_KINDS, PatternEntity.STATUS_MONITORING).stream()
                .filter(row -> row.getTestPlan() == null)
                .filter(row -> !row.isDrift())
                .toList();
        int promoted = 0;
        for (PatternEntity row : work) {
            try {
                if (promoteOne(row.getCreatedBy(), row.getId())) promoted++;
            } catch (Exception e) {
                log.warn("Knowledge backfill skipped pattern {} — {}", row.getId(), e.getMessage());
            }
        }
        return promoted;
    }

    private boolean promoteOne(UUID userId, UUID patternId) {
        TransactionTemplate own = new TransactionTemplate(transactionManager);
        own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return Boolean.TRUE.equals(own.execute(status -> {
            PatternEntity row = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId).orElse(null);
            if (row == null || row.getPromotedFactId() != null || !newestReplyIsWatch(userId, patternId)) return false;
            patternService.applyUserConfirm(userId, row);
            patternRepository.saveAndFlush(row);
            return row.getPromotedFactId() != null;
        }));
    }

    private boolean newestReplyIsWatch(UUID userId, UUID patternId) {
        return patternEventRepository
                .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, patternId, PatternEventEntity.KIND_USER_REPLY)
                .map(e -> CHOICE_WATCH.equals(e.getPayload().choice()))
                .orElse(false);
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='KnowledgeBackfillRunnerIT,CompanionSwitchOffIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (ArchitectureTest: the runner is not a `*Service`, lives outside `service/`, no class-level `@Transactional`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion/KnowledgeBackfillRunnerIT.java
git commit -m "feat(companion): S2 előtti megerősített, terv nélküli sorok egyszeri promóciója (mezo-d6ivw.6, mezo-4rh4r)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A11: person_fact — `sourceRefId` on the wire + PATCH `factText`

**Files:**
- Modify: `api/feature/people/people.yml` (`PersonFactResponse`, `UpdatePersonFactRequest`, the PATCH summary)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonFactService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/controller/PeopleController.java:84-89`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PersonFactControllerIT.java` (extend)

**Interfaces:**
- Produces wire: `PersonFactResponse.sourceRefId: string` (required, maxLength 64 — the chat message id or the nightly day); `UpdatePersonFactRequest { includeInPrompt?: boolean, factText?: string (1..300) }` (no `required`; at least one expected — both null is a no-op 200).
- Produces: `PersonFactService.update(UUID userId, UUID personId, UUID factId, Boolean includeInPrompt, String factText) → PersonFactEntity`. An edit to a text equal to a vetoed (inactive) row's text is ALLOWED — the user typed it.

- [ ] **Step 1: Contract edit**

```yaml
    UpdatePersonFactRequest:
      type: object
      description: >-
        Részleges frissítés — csak a megadott mezők érvényesülnek (S6: szöveg-javítás is).
        Egy korábban visszavont szöveg beírása megengedett: azt a felhasználó maga írta.
      properties:
        includeInPrompt: { type: boolean, nullable: true }
        factText: { type: string, minLength: 1, maxLength: 300, nullable: true }
```

`PersonFactResponse`: add `sourceRefId` to `required` and `sourceRefId: { type: string, maxLength: 64, description: 'S6 — a forrás azonosítója (chat_turn: az üzenet; nightly_day: a nap).' }`. PATCH summary → `Per-fact prompt toggle and text edit (S6)`. Regenerate both sides.

- [ ] **Step 2: Write the failing IT cases** (add to `PersonFactControllerIT`; reuse its existing fixture helpers for a person + a captured fact)

```java
    @Test
    void patch_shouldEditTheText_andKeepThePromptFlag() {
        // given a captured fact on a person (existing fixture helper of this class)
        PersonFactResponse edited = patchForBody("/api/people/" + personId + "/facts/" + factId,
                UpdatePersonFactRequest.builder().factText("  Szereti a társasjátékokat. ").build(),
                ownerAuthHeaders(), HttpStatus.OK, PersonFactResponse.class);

        assertThat(edited.getFactText()).isEqualTo("Szereti a társasjátékokat.");
        assertThat(edited.getIncludeInPrompt()).isTrue();
        assertThat(edited.getSourceRefId()).isNotBlank();
    }

    @Test
    void patch_shouldReturn400_whenTextIsTooLong() {
        String body = patchForBody("/api/people/" + personId + "/facts/" + factId,
                UpdatePersonFactRequest.builder().factText("x".repeat(301)).build(),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "factText", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void bootstrap_shouldCarrySourceRefIdOnEveryFact() {
        PeopleResponse people = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        assertThat(people.getPersons()).flatExtracting(PersonResponse::getFacts)
                .allSatisfy(f -> assertThat(f.getSourceRefId()).isNotBlank());
    }
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=PersonFactControllerIT -Dmezo.test.use-testcontainers=true`
Expected: compile FAIL (`factText` on the request) then assertion FAIL.

- [ ] **Step 4: Implement**

`PersonFactService` — replace `setIncludeInPrompt` with (keep the old method as a delegating one-liner only if another caller uses it — grep first):

```java
    /** S6 (mezo-d6ivw.6): partial update — prompt toggle and/or the user's own text fix. */
    @Transactional
    public PersonFactEntity update(UUID userId, UUID personId, UUID factId, Boolean includeInPrompt, String factText) {
        PersonFactEntity fact = requireOwnedFact(userId, personId, factId);
        if (includeInPrompt != null) {
            fact.setIncludeInPrompt(includeInPrompt);
        }
        if (factText != null && !factText.isBlank()) {
            fact.setFactText(factText.trim());
        }
        return personFactRepository.save(fact);
    }
```

`PeopleController.updatePersonFact`:

```java
        return mapper.toFactResponse(facts().update(currentUserId.get(), personId, factId,
                updatePersonFactRequest.getIncludeInPrompt(), updatePersonFactRequest.getFactText()));
```

`PeopleMapper.toFactResponse` maps `sourceRefId` by name automatically (the entity field is `sourceRefId`); the four hand-assembled `PersonResponse` paths (lesson 18) set `facts` via this mapper or to `List.of()`, so no path is left without the field — the bootstrap IT above proves it.

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='PersonFactControllerIT,PersonFactServiceIT,PeopleContractIT,PeopleServiceIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/people backend/src/test/java/io/mrkuhne/mezo/feature/people
git commit -m "feat(people): személy-tény forrás-azonosító a dróton + szöveg-javítás (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A12: Effect mute — the engine side (filters that survive the recompute)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectMuteService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectLinkService.java` (`gatedRows`, `effectsForPerson`, new `effectViews`, new field)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/EffectMuteIT.java`

**Interfaces:**
- Consumes: A1 `EffectMuteEntity`/`EffectMuteRepository`.
- Produces: `EffectMuteService.mute(UUID userId, String subjectKind, String subjectKey, String mode)` (upsert; `forgotten` sticky), `unmute(UUID, String, String)` (removes a `muted` row, never a `forgotten` one); `EffectLinkService.record EffectView(EffectLinkEntity row, String subjectLabel, boolean muted)`; `List<EffectView> effectViews(UUID userId, UUID personIdOrNull)` — forgotten subjects excluded, muted flagged, strongest first, person rows whose person is not active are excluded when `personIdOrNull == null`; `gatedRows` excludes muted AND forgotten subjects (so `promptBlock`, `gatedEffects`, the apropó block and the edition source all skip them); `effectsForPerson` excludes forgotten.

- [ ] **Step 1: Write the failing IT** — open `EffectLinkServiceIT` first and reuse its fixture helpers verbatim (how it seeds mentions + check-ins so a person subject clears the gate, and how it calls `recompute(owner, today)`).

```java
    @Test
    void mutedSubject_shouldBeSkippedByEveryPromptReader_butStayVisibleFlagged() {
        UUID owner = seededOwnerWithStrongPersonEffect(); // EffectLinkServiceIT helper: ≥ közepes/közepes
        String personKey = strongPersonId.toString();
        muteService.mute(owner, "person", personKey, EffectMuteEntity.MODE_MUTED);

        assertThat(effectLinkService.gatedEffects(owner)).noneMatch(g -> g.subjectKey().equals(personKey));
        assertThat(effectLinkService.promptBlock(owner)).doesNotContain(personName);
        assertThat(effectLinkService.effectViews(owner, null))
                .filteredOn(v -> v.row().getSubjectKey().equals(personKey))
                .isNotEmpty().allMatch(EffectLinkService.EffectView::muted);
    }

    @Test
    void forgottenSubject_shouldVanishEverywhere_andSurviveTheNightlyRecompute() {
        UUID owner = seededOwnerWithStrongPersonEffect();
        String personKey = strongPersonId.toString();
        muteService.mute(owner, "person", personKey, EffectMuteEntity.MODE_FORGOTTEN);

        effectLinkService.recompute(owner, TODAY); // soft-deletes and re-creates the rows

        assertThat(effectLinkService.effectViews(owner, null)).noneMatch(v -> v.row().getSubjectKey().equals(personKey));
        assertThat(effectLinkService.effectsForPerson(owner, strongPersonId)).isEmpty();
        assertThat(effectLinkService.gatedEffects(owner)).noneMatch(g -> g.subjectKey().equals(personKey));
    }

    @Test
    void forgotten_shouldBeSticky() {
        UUID owner = userPopulator.createUser().getId();
        muteService.mute(owner, "event", "munka", EffectMuteEntity.MODE_FORGOTTEN);
        muteService.mute(owner, "event", "munka", EffectMuteEntity.MODE_MUTED);
        muteService.unmute(owner, "event", "munka");

        assertThat(muteRepository.findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(owner, "event", "munka"))
                .get().extracting(EffectMuteEntity::getMode).isEqualTo(EffectMuteEntity.MODE_FORGOTTEN);
    }

    @Test
    void unmute_shouldRestoreAMutedSubject() {
        UUID owner = userPopulator.createUser().getId();
        muteService.mute(owner, "event", "pihenes", EffectMuteEntity.MODE_MUTED);
        muteService.unmute(owner, "event", "pihenes");

        assertThat(muteRepository.findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(owner, "event", "pihenes")).isEmpty();
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=EffectMuteIT -Dmezo.test.use-testcontainers=true`
Expected: compile FAIL (`EffectMuteService`, `effectViews` missing).

- [ ] **Step 3: Implement**

`EffectMuteService`:

```java
package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectMuteEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectMuteRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** S6 (mezo-d6ivw.6): per-SUBJECT effect silence, outliving the nightly effect_link cache.
 *  {@code forgotten} is permanent — neither a later mute nor an unmute revives it. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class EffectMuteService {

    private final EffectMuteRepository repository;

    @Transactional
    public void mute(UUID userId, String subjectKind, String subjectKey, String mode) {
        EffectMuteEntity row = repository
                .findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(userId, subjectKind, subjectKey)
                .orElseGet(() -> {
                    EffectMuteEntity fresh = new EffectMuteEntity();
                    fresh.setCreatedBy(userId);
                    fresh.setSubjectKind(subjectKind);
                    fresh.setSubjectKey(subjectKey);
                    return fresh;
                });
        if (row.isForgotten()) return;
        row.setMode(mode);
        repository.save(row);
    }

    @Transactional
    public void unmute(UUID userId, String subjectKind, String subjectKey) {
        repository.findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(userId, subjectKind, subjectKey)
                .filter(row -> !row.isForgotten())
                .ifPresent(repository::delete);
    }
}
```

`EffectLinkService` — add `private final EffectMuteRepository effectMuteRepository;`, the record and helpers:

```java
    /** S6 (mezo-d6ivw.6): one effect row as the hub / person page sees it. */
    public record EffectView(EffectLinkEntity row, String subjectLabel, boolean muted) {}

    /** {@code kind:key} → mode, for the user's live mutes. */
    private Map<String, String> muteModes(UUID userId) {
        return effectMuteRepository.findByCreatedByAndDeletedFalse(userId).stream()
                .collect(Collectors.toMap(m -> m.getSubjectKind() + ':' + m.getSubjectKey(),
                        EffectMuteEntity::getMode, (a, b) -> a));
    }

    private static String subjectId(EffectLinkEntity row) {
        return row.getSubjectKind() + ':' + row.getSubjectKey();
    }
```

`gatedRows`:

```java
    private List<EffectLinkEntity> gatedRows(UUID userId) {
        Map<String, String> mutes = muteModes(userId);
        return effectLinkRepository.findByCreatedByAndDeletedFalse(userId).stream()
                .filter(r -> !mutes.containsKey(subjectId(r))) // S6: muted AND forgotten are silent
                .filter(r -> PROMPT_STRENGTHS.contains(r.getStrengthBand()))
                .filter(r -> PROMPT_CONFIDENCES.contains(r.getConfidenceTier()))
                .sorted(byStrength())
                .toList();
    }
```

`effectsForPerson` — after loading `rows`, drop them all when the person subject is forgotten:

```java
        if (EffectMuteEntity.MODE_FORGOTTEN.equals(muteModes(userId).get(EffectLinkEntity.SUBJECT_PERSON + ':' + personId))) {
            return List.of();
        }
```

`effectViews`:

```java
    /**
     * S6 (mezo-d6ivw.6): the hub/person read. Forgotten subjects never appear; muted ones come
     * back flagged. With a person id: that person's rows (label = their name if active). Without:
     * every live subject whose label resolves — an inactive/unknown person is skipped, exactly
     * like the prompt readers do. Strongest first; the confirmed-observation bump applies.
     */
    @Transactional(readOnly = true)
    public List<EffectView> effectViews(UUID userId, UUID personIdOrNull) {
        Map<String, String> mutes = muteModes(userId);
        Map<String, String> names = activePersonNames(userId);
        Set<String> confirmedKeys = confirmedTopicKeys(userId);
        List<EffectLinkEntity> rows = personIdOrNull == null
                ? effectLinkRepository.findByCreatedByAndDeletedFalse(userId)
                : effectLinkRepository.findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(
                        userId, EffectLinkEntity.SUBJECT_PERSON, personIdOrNull.toString());
        return rows.stream()
                .filter(r -> !EffectMuteEntity.MODE_FORGOTTEN.equals(mutes.get(subjectId(r))))
                .map(r -> {
                    String label = EffectLinkEntity.SUBJECT_PERSON.equals(r.getSubjectKind())
                            ? names.get(r.getSubjectKey()) : EVENT_LABELS_HU.get(r.getSubjectKey());
                    return new EffectView(confirmedKeys.contains(GroundedHypothesisPublisher.normalizedTopicKey(
                            topicKey(r.getSubjectKind(), r.getSubjectKey(), r.getMetric()))) ? bumped(r) : r,
                            label == null ? null : oneLine(label), mutes.containsKey(subjectId(r)));
                })
                .filter(v -> personIdOrNull != null || v.subjectLabel() != null)
                .sorted(Comparator.comparing((EffectView v) -> v.row().getCliffsDelta().abs()).reversed())
                .toList();
    }
```

(imports: `io.mrkuhne.mezo.feature.companion.reflection.entity.EffectMuteEntity`, `io.mrkuhne.mezo.feature.companion.reflection.repository.EffectMuteRepository`.)

- [ ] **Step 4: Run to verify it passes (plus every effect reader's suite)**

Run: `cd backend && ./mvnw test -Dtest='EffectMuteIT,EffectLinkServiceIT,CompanionMessageGeneratorApropoIT,ReflectionDigestMorningIT' -Dmezo.test.use-testcontainers=true`
Then the edition source: `cd backend && ./mvnw test -Dtest='*Edition*IT' -Dmezo.test.use-testcontainers=true`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/EffectMuteIT.java
git commit -m "feat(reflection): hatás-alany elhallgattatása/felejtése, túléli az éjszakai újraszámolást (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A13: Effects wire — optional `personId`, subject fields, mute endpoints

**Files:**
- Modify: `api/feature/companion/companion.yml` (`/api/companion/effects`, `EffectResponse`, new mute path + `EffectMuteRequest`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionEffectsController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionEffectsHubApiIT.java`

**Interfaces:**
- Produces wire: `GET /api/companion/effects[?personId=]` (`required: false`); `EffectResponse` + `subjectKind: 'person'|'event'` (required), `subjectKey: string` (required), `subjectLabel: string|null`, `muted: boolean` (required); `PUT /api/companion/effects/{subjectKind}/{subjectKey}/mute` body `EffectMuteRequest { mode: 'muted'|'forgotten' }` → 204 (operationId `muteEffectSubject`); `DELETE` same path → 204 (operationId `unmuteEffectSubject`). Path `subjectKind` schema `enum: [person, event]`, `subjectKey` `maxLength: 64`.

- [ ] **Step 1: Contract** — set the `personId` parameter `required: false` and update the description ("Nélküle: minden élő személy- és esemény-alany — a Tudástár Hatások szakasza (S6)."); add to `EffectResponse.properties` (and to `required`: `subjectKind`, `subjectKey`, `muted`):

```yaml
        subjectKind: { type: string, enum: [person, event], description: 'S6 — az alany fajtája.' }
        subjectKey: { type: string, description: 'S6 — személy-uuid vagy esemény-kulcs (edzes, munka, csalad, kozos_program, konfliktus, pihenes).' }
        subjectLabel: { type: string, nullable: true, description: 'S6 — a személy neve / az esemény magyar címkéje.' }
        muted: { type: boolean, description: 'S6 — az alany el van hallgattatva (a prompt nem látja).' }
```

New path + schema:

```yaml
  /api/companion/effects/{subjectKind}/{subjectKey}/mute:
    put:
      tags: [CompanionEffects]
      operationId: muteEffectSubject
      summary: >-
        S6 (mezo-d6ivw.6) — egy hatás-alany elhallgattatása (muted) vagy végleges elfelejtése
        (forgotten). Az elfelejtés végleges: sem egy későbbi muted, sem a DELETE nem hozza vissza.
      parameters:
        - { name: subjectKind, in: path, required: true, schema: { type: string, enum: [person, event] } }
        - { name: subjectKey, in: path, required: true, schema: { type: string, maxLength: 64 } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/EffectMuteRequest' }
      responses:
        '204': { description: Stored }
        '400':
          description: Validation error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    delete:
      tags: [CompanionEffects]
      operationId: unmuteEffectSubject
      summary: S6 — Visszakapcsolom egy elhallgattatott hatás-alanyra (egy elfelejtettre nem hat).
      parameters:
        - { name: subjectKind, in: path, required: true, schema: { type: string, enum: [person, event] } }
        - { name: subjectKey, in: path, required: true, schema: { type: string, maxLength: 64 } }
      responses:
        '204': { description: Unmuted (or nothing to do) }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

```yaml
    EffectMuteRequest:
      type: object
      required: [mode]
      properties:
        mode: { type: string, enum: [muted, forgotten] }
```

Regenerate both sides.

- [ ] **Step 2: Write the failing API IT**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.EffectMuteRequest;
import io.mrkuhne.mezo.api.dto.PersonEffectsResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CompanionEffectsHubApiIT extends ApiIntegrationTest {

    private static final String EFFECTS = "/api/companion/effects";

    @Test
    void list_shouldWorkWithoutPersonId() {
        PersonEffectsResponse all = getForBody(EFFECTS, ownerAuthHeaders(), HttpStatus.OK, PersonEffectsResponse.class);
        assertThat(all.getEffects()).isNotNull();
    }

    @Test
    void mute_thenUnmute_shouldReturn204() {
        putForBody(EFFECTS + "/event/munka/mute",
                EffectMuteRequest.builder().mode(EffectMuteRequest.ModeEnum.MUTED).build(),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
        deleteAndExpect(EFFECTS + "/event/munka/mute", ownerAuthHeaders(), HttpStatus.NO_CONTENT);
    }

    @Test
    void mute_shouldReturn400_forUnknownSubjectKind() {
        putForBody(EFFECTS + "/planet/mars/mute",
                EffectMuteRequest.builder().mode(EffectMuteRequest.ModeEnum.MUTED).build(),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }
}
```

Add one seeded case (reuse `EffectLinkServiceIT`'s seeding through the owner account, or seed an `effect_link` row directly via `EffectLinkRepository` with a strong event subject `edzes`): the GET without `personId` returns that row with `subjectKind == EVENT`, `subjectKey == "edzes"`, `subjectLabel == "Edzésnapok"`, `muted == false`; after the PUT `muted` it returns `muted == true`; after PUT `forgotten` it is absent.

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=CompanionEffectsHubApiIT -Dmezo.test.use-testcontainers=true`
Expected: compile FAIL (controller does not implement the new methods).

- [ ] **Step 4: Implement the controller**

```java
    private final EffectLinkService effectLinkService;
    private final EffectMuteService effectMuteService;
    private final CurrentUserId currentUserId;

    @Override
    public PersonEffectsResponse listPersonEffects(UUID personId) {
        return new PersonEffectsResponse()
                .effects(effectLinkService.effectViews(currentUserId.get(), personId).stream()
                        .map(CompanionEffectsController::toResponse)
                        .toList());
    }

    @Override
    public void muteEffectSubject(String subjectKind, String subjectKey, EffectMuteRequest request) {
        effectMuteService.mute(currentUserId.get(), subjectKind, subjectKey, request.getMode().getValue());
    }

    @Override
    public void unmuteEffectSubject(String subjectKind, String subjectKey) {
        effectMuteService.unmute(currentUserId.get(), subjectKind, subjectKey);
    }

    private static EffectResponse toResponse(EffectLinkService.EffectView view) {
        EffectLinkEntity row = view.row();
        return new EffectResponse()
                .metric(EffectResponse.MetricEnum.fromValue(row.getMetric()))
                .direction(row.getCliffsDelta().signum() > 0
                        ? EffectResponse.DirectionEnum.HIGHER : EffectResponse.DirectionEnum.LOWER)
                .strengthBand(EffectResponse.StrengthBandEnum.fromValue(row.getStrengthBand()))
                .confidenceTier(EffectResponse.ConfidenceTierEnum.fromValue(row.getConfidenceTier()))
                .meanDiff(row.getMeanDiff().doubleValue())
                .subjectDays(row.getSubjectDays())
                .complementDays(row.getComplementDays())
                .computedAt(OffsetDateTime.ofInstant(row.getComputedAt(), ZoneOffset.UTC))
                .subjectKind(EffectResponse.SubjectKindEnum.fromValue(row.getSubjectKind()))
                .subjectKey(row.getSubjectKey())
                .subjectLabel(view.subjectLabel())
                .muted(view.muted());
    }
```

(Check the generated signatures in `target/generated-sources/.../CompanionEffectsApi.java`: path enums are generated as `String` in this repo — `PeopleController.getFactsBySource(String sourceRefKind, …)` is the precedent; a `void` return for 204 as in `undoPersonFact`. An invalid `subjectKind` is rejected by the generated `@Pattern`/enum validation as 400; if the generator does not validate path enums, add an explicit `SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE","subjectKind"))` guard for anything other than `person|event`.)

- [ ] **Step 5: Run to verify it passes (plus the S4 controller IT)**

Run: `cd backend && ./mvnw test -Dtest='CompanionEffectsHubApiIT,CompanionEffectsControllerIT,EffectMuteIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS (if the S4 IT's class name differs, run `-Dtest='CompanionEffects*IT'`).

- [ ] **Step 6: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionEffectsController.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionEffectsHubApiIT.java
git commit -m "feat(api): hatások az összes alanyra + elhallgattatás/felejtés végpontok (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A14: Part A checkpoint — ArchUnit, codemap, contract drift, focused backend run

**Files:**
- Modify (generated): `docs/CODEMAP.md`

- [ ] **Step 1: ArchUnit + liquibase lint**

Run: `node scripts/lint-liquibase.mjs && cd backend && ./mvnw test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true`
Expected: PASS. Grep proof of the house direction: `grep -rn "companion.reflection" backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/` → no hits; `grep -rn "feature.companion" backend/src/main/java/io/mrkuhne/mezo/feature/people/` → no hits.

- [ ] **Step 2: Contract drift**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd .. && git status --porcelain api/openapi.yml frontend/src/data/_client/api.gen.ts`
Expected: no output (committed artifacts already current). `cd frontend && pnpm tsc -b` — the FE still compiles against the new wire (new fields are additive; if `personEffectsHooks` tests typed fixtures as `EffectResponse`, add `subjectKind/subjectKey/subjectLabel/muted` to them now).

- [ ] **Step 3: Full companion + people + proactive backend slice**

Run: `cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**,io.mrkuhne.mezo.feature.people.**,io.mrkuhne.mezo.feature.proactive.**,io.mrkuhne.mezo.feature.character.**,ArchitectureTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"`
Expected: PASS.

- [ ] **Step 4: Codemap + commit**

```bash
node scripts/gen-codemap.mjs
git add docs/CODEMAP.md
git commit -m "docs(codemap): S6 backend — ForgetService, KnowledgeObservationService, EffectMuteService (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
# Part B — frontend (starts only after mezo-d6ivw.8 is on main)

### Task B0: Gate — rebase onto main after facts-always (mezo-d6ivw.8)

**Files:** none (git only).

- [ ] **Step 1: Check that mezo-d6ivw.8 has merged**

Run: `git fetch origin && git log origin/main --oneline --grep 'mezo-d6ivw.8' | head -5`
Expected: at least the `feat(insights): Tények nézet — két vödör…` and `feat(companion): facts prompt-cap 200…` commits. **If the output is empty: STOP. Do not start any Part B task; report "mezo-d6ivw.8 not on main yet — Part B blocked" to the controller.**

- [ ] **Step 2: Rebase and resolve**

Run: `git rebase origin/main`
Expected conflicts (resolve by keeping BOTH sides' intent):
- `KnowledgeFactService.java` — .8 rewrote `FACTS_HEADER`, `renderPromptBlock` javadoc and `topFactsForPrompt` (+ removed the `PageRequest` import); S6 changed `list()`, `update()`, `muteFromRefutedPattern()` and added the `LearnedFactRepository` field. Take .8's prompt-block code verbatim and S6's other hunks verbatim.
- `docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md` — both slices appended sections; keep both.
- Regenerate after the rebase: `node scripts/gen-codemap.mjs` (lesson: a merge silently drops CODEMAP entries).

- [ ] **Step 3: Re-run the Part A gate on the rebased tree**

Run: `cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**,io.mrkuhne.mezo.feature.people.**,ArchitectureTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"` and `cd frontend && pnpm tsc -b`
Expected: PASS. Confirm the FE is on the two-state model: `grep -rn "waiting\|PROMPT_TOP_N" frontend/src/features/insights frontend/src/data/insights` → no hits.

- [ ] **Step 4: Commit any conflict-resolution follow-up**

```bash
git add -A && git commit -m "chore(emlekezet): S6 rebase a facts-always után — codemap újragenerálva (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Skip the commit if the rebase produced no follow-up changes.)

---

### Task B1: Four new Titanium icons (t-mute, t-eraser, t-source, t-cowave)

**Files:**
- Modify: `docs/design_2.0/assets/titanium-custom.svg` (append 4 `<symbol>`s)
- Modify (generated): `frontend/src/shared/ui/clay/titanium-icons.svg` via `node scripts/gen-titanium-sprite.mjs`
- Modify: `frontend/src/shared/ui/clay/index.tsx:64-99` (`Icon3DName`)
- Test: `frontend/src/shared/ui/clay/Icon3D.test.tsx`

**Interfaces:**
- Produces: `Icon3DName` gains `'t-mute' | 't-eraser' | 't-source' | 't-cowave'`.

- [ ] **Step 1: Write the failing test** (append to `Icon3D.test.tsx`, the U-slice idiom)

```tsx
// S6 (mezo-d6ivw.6): the Tudástár hub verbs the owner approved on prototypes/uveg-tudastar-hub.html#ikonok —
// Elhallgattatom, Elfelejtem, Honnan tudom?, and the Hatások tile (két hullám együtt mozog).
test('the sprite carries the S6 Tudástár hub icons', () => {
  const ids = symbolIds()
  for (const id of ['t-mute', 't-eraser', 't-source', 't-cowave'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && CI=true pnpm vitest run src/shared/ui/clay/Icon3D.test.tsx`
Expected: FAIL — type error on the new names / ids missing.

- [ ] **Step 3: Add the symbols**

Copy the four `<symbol id="t-mute" …>`, `<symbol id="t-eraser" …>`, `<symbol id="t-source" …>`, `<symbol id="t-cowave" …>` elements VERBATIM from `docs/design_2.0/prototypes/uveg-tudastar-hub.html` lines 1996-1999 into `docs/design_2.0/assets/titanium-custom.svg` (before `</svg>`, under a `<!-- S6 (mezo-d6ivw.6) — owner OK on uveg-tudastar-hub.html#ikonok -->` comment). They reference only `tg-shadow`, `tg-purple`, `tg-titanium`, `tg-rose`, `tg-gold`, `tg-blue`, all already defined in the shipped sprite. Then:

```bash
node scripts/gen-titanium-sprite.mjs
```

Extend `Icon3DName`:

```ts
  // S6 (mezo-d6ivw.6) — owner OK on prototypes/uveg-tudastar-hub.html#ikonok
  | 't-mute' | 't-eraser' | 't-source' | 't-cowave'
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && CI=true pnpm vitest run src/shared/ui/clay/`
Expected: PASS (incl. `titaniumSpriteSource.test.ts` — the generator was re-run, every shipped symbol has a source).

- [ ] **Step 5: Commit**

```bash
git add docs/design_2.0/assets/titanium-custom.svg frontend/src/shared/ui/clay
git commit -m "feat(ui): négy új 3D ikon a Tudástár igéihez (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B2: Domain types + wire mapping for facts, person facts, observations, effects

**Files:**
- Modify: `frontend/src/data/types.ts` (`KnowledgeFact`, `PersonFact`, new `FactMuteReason`, `KnowledgeObservation`, `EffectSubject`)
- Modify: `frontend/src/data/insights/knowledgeApi.ts` (`toKnowledgeFact`)
- Modify: `frontend/src/data/me/peopleApi.ts` (`toPersonFact`, `editFact`)
- Modify: `frontend/src/data/me/personEffectsApi.ts` (`EffectResponse` fields ride along; `toPersonEffect` unchanged)
- Create: `frontend/src/data/insights/knowledgeHubApi.ts`
- Test: `frontend/src/data/insights/knowledgeHubApi.test.ts`, extend `frontend/src/data/insights/knowledgeApi.test.ts`

**Interfaces:**
- Produces types:

```ts
export type FactMuteReason = 'user' | 'refuted' | 'superseded'
// KnowledgeFact gains (optional so the 15 mock seeds stay valid; the wire mapper always sets them):
//   mutedReason?: FactMuteReason | null; mutedAt?: string | null; supersededBy?: string | null
//   patternId?: string | null; sourceMessageId?: string | null
// PersonFact gains: sourceRefId: string
export interface EffectSubject {
  kind: 'person' | 'event'
  key: string
  label: string
  muted: boolean
  effects: PersonEffect[]
}
```

`KnowledgeObservation` lives in `data/insights/knowledgeHubApi.ts` (it carries `EvidenceItem` from `@/shared/ui/evidence/observationEvidence`, and `data/types.ts` stays free of `shared/` imports); `EffectSubject` goes to `data/types.ts` beside `PersonEffect`. `KnowledgeObservation` also carries `evidenceSources: string[]` — the RAW wire `source` keys of its `record` items (`sleep_log`, `meal`, …), captured BEFORE `mapEvidence` turns them into display names ("Check-in"); Task B4's topic rule reads these.

- Produces functions (`knowledgeHubApi.ts`): `toKnowledgeObservation(w: KnowledgeObservationResponse): KnowledgeObservation`, `groupEffectSubjects(rows: EffectResponse[]): EffectSubject[]`, and

```ts
export const knowledgeHubApi = {
  listObservations: () => Promise<KnowledgeObservation[]>,
  factEvidence: (factId: string) => Promise<EvidenceItem[]>,
  forgetFact: (factId: string) => Promise<void>,
  forgetObservation: (patternId: string) => Promise<void>,
  editFact: (factId: string, text: string) => Promise<KnowledgeFactResponse>,
  listEffects: () => Promise<EffectSubject[]>,
  muteEffect: (kind: 'person' | 'event', key: string, mode: 'muted' | 'forgotten') => Promise<void>,
  unmuteEffect: (kind: 'person' | 'event', key: string) => Promise<void>,
}
```

- `peopleApi.editFact(personId: string, factId: string, text: string)`.

- [ ] **Step 1: Write the failing tests**

`knowledgeHubApi.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { groupEffectSubjects, toKnowledgeObservation } from '@/data/insights/knowledgeHubApi'
import type { components } from '@/data/_client/api.gen'

type EffectResponse = components['schemas']['EffectResponse']
const row = (over: Partial<EffectResponse>): EffectResponse => ({
  metric: 'mental', direction: 'higher', strengthBand: 'kozepes', confidenceTier: 'kozepes',
  meanDiff: 0.6, subjectDays: 11, complementDays: 40, computedAt: '2026-09-27T03:40:00Z',
  subjectKind: 'person', subjectKey: 'p-anya', subjectLabel: 'Anya', muted: false, ...over,
})

describe('groupEffectSubjects', () => {
  it('folds the flat rows into one subject per (kind, key), keeping row order inside', () => {
    const subjects = groupEffectSubjects([
      row({ metric: 'mental' }),
      row({ subjectKind: 'event', subjectKey: 'edzes', subjectLabel: 'Edzésnapok', metric: 'stress', direction: 'lower' }),
      row({ metric: 'stress' }),
    ])
    expect(subjects).toHaveLength(2)
    expect(subjects[0]).toMatchObject({ kind: 'person', key: 'p-anya', label: 'Anya', muted: false })
    expect(subjects[0].effects.map((e) => e.metric)).toEqual(['mental', 'stress'])
    expect(subjects[1]).toMatchObject({ kind: 'event', key: 'edzes', label: 'Edzésnapok' })
  })

  it('drops rows without a label (the server already does; the FE never invents a name)', () => {
    expect(groupEffectSubjects([row({ subjectLabel: null })])).toEqual([])
  })

  it('a subject is muted when any of its rows says so', () => {
    expect(groupEffectSubjects([row({ muted: true })])[0].muted).toBe(true)
  })
})

describe('toKnowledgeObservation', () => {
  it('maps the wire and runs evidence through mapEvidence', () => {
    const o = toKnowledgeObservation({
      patternId: 'o1', title: 'A késői vacsora és a felszínes alvás együtt mozog.',
      confirmedAt: '2026-08-30T08:00:00Z', recheckedAt: null, status: 'confirmed',
      factId: 'f1', factMutedReason: null, factMutedAt: null, replacesPatternId: null,
      replacedByPatternId: null, topicKey: 'alvas-vacsora',
      evidence: [{ type: 'tag', text: 'r=0,4' }, { type: 'record', source: 'sleep_log', date: '2026-09-20', fields: {} }],
    })
    expect(o).toMatchObject({ patternId: 'o1', factId: 'f1', topicKey: 'alvas-vacsora' })
    expect(o.evidence[0]).toEqual({ kind: 'tag', text: 'r=0,4' })
    expect(o.evidence[1]).toMatchObject({ kind: 'record', date: '2026-09-20' })
    expect(o.evidenceSources).toEqual(['sleep_log'])
  })
})
```

Add to `knowledgeApi.test.ts`:

```ts
it('toKnowledgeFact carries the mute state and provenance', () => {
  const f = toKnowledgeFact({
    id: 'f1', factText: 'X', category: 'life', source: 'pattern', owner: 'mezo', reinforcementCount: 0,
    includeInPrompt: false, createdAt: '2026-09-01T00:00:00Z', lastReinforcedAt: null,
    mutedReason: 'superseded', mutedAt: '2026-09-21T09:20:00Z', supersededBy: 'f2',
    provenance: { sourceKind: 'pattern', patternId: 'o3old', sourceMessageId: null },
  })
  expect(f).toMatchObject({ mutedReason: 'superseded', supersededBy: 'f2', patternId: 'o3old', sourceMessageId: null })
})
```

(`mapEvidence` — `shared/ui/evidence/observationEvidence.ts:114` — maps a non-record to `{ kind: 'tag', text }` and renames a record's `source` to its display name, which is why `evidenceSources` is captured from the wire.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/data/insights/`
Expected: FAIL — module / fields missing.

- [ ] **Step 3: Implement**

`toKnowledgeFact` gains:

```ts
    mutedReason: f.mutedReason ?? null,
    mutedAt: f.mutedAt ?? null,
    supersededBy: f.supersededBy ?? null,
    patternId: f.provenance?.patternId ?? null,
    sourceMessageId: f.provenance?.sourceMessageId ?? null,
```

`toPersonFact` gains `sourceRefId: f.sourceRefId,`; `peopleApi`:

```ts
  editFact: (personId: string, factId: string, text: string) =>
    apiFetch<PersonFactResponse>(`${PEOPLE}/${personId}/facts/${factId}`, {
      method: 'PATCH',
      body: JSON.stringify({ factText: text } satisfies UpdatePersonFactRequest),
    }),
```

`knowledgeHubApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import { toPersonEffect } from '@/data/me/personEffectsApi'
import type { EffectSubject, FactMuteReason } from '@/data/types'
import { mapEvidence, type EvidenceItem } from '@/shared/ui/evidence/observationEvidence'

export type KnowledgeObservationResponse = components['schemas']['KnowledgeObservationResponse']
type EffectResponse = components['schemas']['EffectResponse']
type PersonEffectsResponse = components['schemas']['PersonEffectsResponse']
type ObservationEvidenceItem = components['schemas']['ObservationEvidenceItem']
type KnowledgeFactResponse = components['schemas']['KnowledgeFactResponse']
type UpdateFactRequest = components['schemas']['UpdateFactRequest']
type EffectMuteRequest = components['schemas']['EffectMuteRequest']

export interface KnowledgeObservation {
  patternId: string
  title: string
  confirmedAt: string
  recheckedAt: string | null
  status: 'confirmed' | 'refuted'
  factId: string | null
  factMutedReason: FactMuteReason | null
  factMutedAt: string | null
  replacesPatternId: string | null
  replacedByPatternId: string | null
  topicKey: string | null
  evidence: EvidenceItem[]
  /** Raw wire source keys of the record items (mapEvidence renames them for display). */
  evidenceSources: string[]
}

export function toKnowledgeObservation(w: KnowledgeObservationResponse): KnowledgeObservation {
  return {
    patternId: w.patternId,
    title: w.title,
    confirmedAt: w.confirmedAt,
    recheckedAt: w.recheckedAt ?? null,
    status: w.status,
    factId: w.factId ?? null,
    factMutedReason: w.factMutedReason ?? null,
    factMutedAt: w.factMutedAt ?? null,
    replacesPatternId: w.replacesPatternId ?? null,
    replacedByPatternId: w.replacedByPatternId ?? null,
    topicKey: w.topicKey ?? null,
    evidence: w.evidence.map(mapEvidence),
    evidenceSources: w.evidence.flatMap((e) => (e.type === 'record' && e.source ? [e.source] : [])),
  }
}

/** The wire is flat (one row per subject×metric); the hub is per SUBJECT (one card, one mute). */
export function groupEffectSubjects(rows: EffectResponse[]): EffectSubject[] {
  const byId = new Map<string, EffectSubject>()
  for (const r of rows) {
    if (!r.subjectLabel) continue
    const id = `${r.subjectKind}:${r.subjectKey}`
    const subject = byId.get(id) ?? { kind: r.subjectKind, key: r.subjectKey, label: r.subjectLabel, muted: false, effects: [] }
    subject.muted = subject.muted || r.muted
    subject.effects.push(toPersonEffect(r))
    byId.set(id, subject)
  }
  return [...byId.values()]
}

const FACT = '/api/companion/fact'
const OBSERVATION = '/api/companion/observation'
const EFFECTS = '/api/companion/effects'

export const knowledgeHubApi = {
  listObservations: async () =>
    (await apiFetch<KnowledgeObservationResponse[]>(`${OBSERVATION}/knowledge`)).map(toKnowledgeObservation),
  factEvidence: async (factId: string) =>
    (await apiFetch<ObservationEvidenceItem[]>(`${FACT}/${factId}/evidence`)).map(mapEvidence),
  forgetFact: (factId: string) => apiFetch<void>(`${FACT}/${factId}`, { method: 'DELETE' }),
  forgetObservation: (patternId: string) => apiFetch<void>(`${OBSERVATION}/${patternId}`, { method: 'DELETE' }),
  editFact: (factId: string, text: string) =>
    apiFetch<KnowledgeFactResponse>(`${FACT}/${factId}`, {
      method: 'PATCH',
      body: JSON.stringify({ factText: text } satisfies UpdateFactRequest),
    }),
  listEffects: async () => groupEffectSubjects((await apiFetch<PersonEffectsResponse>(EFFECTS)).effects),
  muteEffect: (kind: 'person' | 'event', key: string, mode: 'muted' | 'forgotten') =>
    apiFetch<void>(`${EFFECTS}/${kind}/${encodeURIComponent(key)}/mute`, {
      method: 'PUT',
      body: JSON.stringify({ mode } satisfies EffectMuteRequest),
    }),
  unmuteEffect: (kind: 'person' | 'event', key: string) =>
    apiFetch<void>(`${EFFECTS}/${kind}/${encodeURIComponent(key)}/mute`, { method: 'DELETE' }),
}
```

(Check `apiFetch<void>` handles a 204 without a body — `peopleApi.undoFact` is the precedent; copy its exact call shape.)

- [ ] **Step 4: Run to verify it passes + typecheck**

Run: `cd frontend && CI=true pnpm vitest run src/data/ && pnpm tsc -b`
Expected: PASS; tsc flags every mock/fixture that builds a `PersonFact` without `sourceRefId` — add `sourceRefId: 'mock-turn-1'` (chat_turn) / `'2026-09-20'` (nightly_day) to those seeds (`data/me/people.ts`, `test/msw/handlers.ts` people fixtures).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data
git commit -m "feat(data): Tudástár drót — tény-provenancia, észrevételek, hatás-alanyok (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B3: Hub hooks (dual-mode) + mock seeds + MSW handlers

**Files:**
- Create: `frontend/src/data/insights/knowledgeHub.ts` (mock seeds)
- Create: `frontend/src/data/insights/knowledgeHubHooks.ts`
- Modify: `frontend/src/data/insights/knowledge.ts` (mock `f9` gains `mutedReason: 'user', mutedAt: '2026-09-12T08:00:00Z'`; `f8` gains `patternId: 'o1'`)
- Modify: `frontend/src/data/me/peopleHooks.ts` (`editFact`, expose `isError`, `refetch`)
- Modify: `frontend/src/data/hooks.ts` (re-export)
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/insights/knowledgeHubHooks.test.tsx`

**Interfaces:**
- Produces (`knowledgeHubHooks.ts`, re-exported from `@/data/hooks`):
  - `useKnowledgeObservations(): { observations: KnowledgeObservation[]; degraded: boolean; isPending: boolean; isError: boolean; refetch: () => void }` — real 404 ⇒ `degraded` (reflection or companion switch off).
  - `useEffectSubjects(): { subjects: EffectSubject[]; degraded: boolean; isPending: boolean; isError: boolean; refetch: () => void }` — same 404 rule.
  - `useFactEvidence(factId: string | null): { evidence: EvidenceItem[]; isPending: boolean; unavailable: boolean }` — `enabled: !!factId`; 404 ⇒ `unavailable`.
  - `useKnowledgeHubActions(): { muteFact(id: string, on: boolean): void; editFact(id: string, text: string): void; forgetFact(id: string): Promise<void>; forgetObservation(patternId: string): Promise<void>; muteEffect(kind, key, on: boolean): void; forgetEffect(kind, key): Promise<void> }` — real mode invalidates `['knowledge']`, `['knowledge-observations']`, `['effect-subjects']`, `['person-effects']`; mock mode patches the caches (the `knowledgeHooks.mockToggle` idiom). `muteFact` sets/clears `mutedReason: 'user'` + `mutedAt` in mock mode.
  - `usePeople()` additionally returns `isError`, `refetch`, `editFact(personId, factId, text)`.
- Query keys: `['knowledge-observations']`, `['effect-subjects']`, `['fact-evidence', factId]`.

- [ ] **Step 1: Write the failing hook tests**

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { isMockMode } from '@/data/_client/mode'
import {
  useEffectSubjects, useFactEvidence, useKnowledgeHubActions, useKnowledgeObservations,
} from '@/data/insights/knowledgeHubHooks'
import { MOCK_OBSERVATIONS, MOCK_EFFECT_SUBJECTS } from '@/data/insights/knowledgeHub'

describe('useKnowledgeObservations', () => {
  it('serves the seed (mock) or the MSW fixture (real) — same observations in both modes', async () => {
    const { result } = renderHook(() => useKnowledgeObservations(), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.observations.map((o) => o.patternId)).toEqual(MOCK_OBSERVATIONS.map((o) => o.patternId))
  })

  it.runIf(!isMockMode())('maps a 404 to degraded, never to an error', async () => {
    server.use(http.get(`${API_BASE}/api/companion/observation/knowledge`, () => HttpResponse.json([], { status: 404 })))
    const { result } = renderHook(() => useKnowledgeObservations(), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.isError).toBe(false)
  })
})

describe('useEffectSubjects', () => {
  it('groups the effects per subject in both modes', async () => {
    const { result } = renderHook(() => useEffectSubjects(), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.subjects.map((s) => s.key)).toEqual(MOCK_EFFECT_SUBJECTS.map((s) => s.key))
  })
})

describe('useFactEvidence', () => {
  it('does not fetch without a fact id', () => {
    const { result } = renderHook(() => useFactEvidence(null), { wrapper: QueryWrapper })
    expect(result.current.evidence).toEqual([])
  })
})

describe('useKnowledgeHubActions', () => {
  it.runIf(!isMockMode())('forgetFact sends exactly one DELETE', async () => {
    let calls = 0
    server.use(http.delete(`${API_BASE}/api/companion/fact/:id`, () => { calls++; return new HttpResponse(null, { status: 204 }) }))
    const { result } = renderHook(() => useKnowledgeHubActions(), { wrapper: QueryWrapper })
    await act(() => result.current.forgetFact('f9'))
    expect(calls).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails (both modes)**

Run: `cd frontend && CI=true pnpm vitest run src/data/insights/knowledgeHubHooks.test.tsx && CI=true VITE_USE_MOCK=false pnpm vitest run src/data/insights/knowledgeHubHooks.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the seeds** (`knowledgeHub.ts`) — small but covering every state the UI renders: 5 observations (one plain `confirmed` with `recheckedAt`, one never rechecked, one refuted with `factMutedReason: 'refuted'`, a drift pair `o3old` superseded by `o3` with `replacesPatternId`/`replacedByPatternId`, topic keys that hit at least two topics — see Task B4's topic rule), 5 effect subjects (3 persons incl. one `muted: true`, 2 events), and a `MOCK_FACT_EVIDENCE: Record<string, EvidenceItem[]>` keyed by fact id (one chat quote record for `f2`, the `o1` row evidence reused for `f8`). Write the evidence items in the `EvidenceItem` shape (`kind: 'record' | 'tag'`, see `observationEvidence.ts:31-49`) and give every seed a matching `evidenceSources` array; the MSW `observationWire(o)` rebuilds wire records from `evidenceSources[i]` + the record's `date/time/quote` so real mode maps back to the same items. Person-effect seeds reuse `MOCK_PERSON_EFFECTS`'s person id so the person page and the hub agree.

- [ ] **Step 4: Implement the hooks** (`knowledgeHubHooks.ts`)

```ts
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { knowledgeHubApi, type KnowledgeObservation } from '@/data/insights/knowledgeHubApi'
import { knowledgeApi } from '@/data/insights/knowledgeApi'
import { MOCK_EFFECT_SUBJECTS, MOCK_FACT_EVIDENCE, MOCK_OBSERVATIONS } from '@/data/insights/knowledgeHub'
import type { EffectSubject, KnowledgeFact } from '@/data/types'
import type { EvidenceItem } from '@/shared/ui/evidence/observationEvidence'

const OBS_KEY = ['knowledge-observations'] as const
const EFFECTS_KEY = ['effect-subjects'] as const
const KNOWLEDGE_KEY = ['knowledge'] as const

interface Section<T> { items: T; degraded: boolean }

async function orDegraded<T>(fetch: () => Promise<T>, empty: T): Promise<Section<T>> {
  try {
    return { items: await fetch(), degraded: false }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { items: empty, degraded: true }
    throw err
  }
}

export function useKnowledgeObservations() {
  const { data, isPending, isError, refetch } = useDualQuery<Section<KnowledgeObservation[]>>({
    queryKey: OBS_KEY,
    mockData: { items: MOCK_OBSERVATIONS, degraded: false },
    realFetch: () => orDegraded(knowledgeHubApi.listObservations, []),
    realEmpty: { items: [], degraded: false },
  })
  return { observations: data.items, degraded: data.degraded, isPending, isError, refetch }
}

export function useEffectSubjects() {
  const { data, isPending, isError, refetch } = useDualQuery<Section<EffectSubject[]>>({
    queryKey: EFFECTS_KEY,
    mockData: { items: MOCK_EFFECT_SUBJECTS, degraded: false },
    realFetch: () => orDegraded(knowledgeHubApi.listEffects, []),
    realEmpty: { items: [], degraded: false },
  })
  return { subjects: data.items, degraded: data.degraded, isPending, isError, refetch }
}

export function useFactEvidence(factId: string | null) {
  const { data, isPending } = useDualQuery<Section<EvidenceItem[]>>({
    queryKey: ['fact-evidence', factId],
    mockData: { items: factId ? (MOCK_FACT_EVIDENCE[factId] ?? []) : [], degraded: false },
    realFetch: () => orDegraded(() => knowledgeHubApi.factEvidence(factId!), []),
    realEmpty: { items: [], degraded: false },
    enabled: !!factId,
  })
  return { evidence: data.items, isPending: !!factId && isPending, unavailable: data.degraded }
}

export function useKnowledgeHubActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidateAll = () => Promise.all([
    qc.invalidateQueries({ queryKey: KNOWLEDGE_KEY }),
    qc.invalidateQueries({ queryKey: OBS_KEY }),
    qc.invalidateQueries({ queryKey: EFFECTS_KEY }),
    qc.invalidateQueries({ queryKey: ['person-effects'] }),
  ])

  const muteFactM = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      if (mock) { mockPatchFact(qc, id, on ? { active: false, mutedReason: 'user', mutedAt: new Date().toISOString() } : { active: true, mutedReason: null, mutedAt: null }); return }
      await knowledgeApi.toggleFact(id, !on)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const editFactM = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      if (mock) { mockPatchFact(qc, id, { text }); return }
      await knowledgeHubApi.editFact(id, text)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const forgetFactM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) { mockRemoveFact(qc, id); return }
      await knowledgeHubApi.forgetFact(id)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const forgetObsM = useMutation({
    mutationFn: async (patternId: string) => {
      if (mock) { mockRemoveObservation(qc, patternId); return }
      await knowledgeHubApi.forgetObservation(patternId)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const effectM = useMutation({
    mutationFn: async (i: { kind: 'person' | 'event'; key: string; mode: 'muted' | 'forgotten' | 'on' }) => {
      if (mock) { mockPatchEffect(qc, i.kind, i.key, i.mode); return }
      if (i.mode === 'on') await knowledgeHubApi.unmuteEffect(i.kind, i.key)
      else await knowledgeHubApi.muteEffect(i.kind, i.key, i.mode)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })

  return {
    muteFact: (id: string, on: boolean) => muteFactM.mutate({ id, on }),
    editFact: (id: string, text: string) => editFactM.mutate({ id, text }),
    forgetFact: (id: string) => forgetFactM.mutateAsync(id),
    forgetObservation: (patternId: string) => forgetObsM.mutateAsync(patternId),
    muteEffect: (kind: 'person' | 'event', key: string, on: boolean) =>
      effectM.mutate({ kind, key, mode: on ? 'muted' : 'on' }),
    forgetEffect: (kind: 'person' | 'event', key: string) => effectM.mutateAsync({ kind, key, mode: 'forgotten' }),
  }
}
```

Implement the four `mock*` helpers below it with `qc.setQueryData` on `['knowledge']` (`KnowledgeBootstrap.facts`), `OBS_KEY` and `EFFECTS_KEY`: `mockRemoveFact` also removes an observation whose `factId` matches (one thing, two views); `mockRemoveObservation` also removes its fact; `mockPatchEffect` with `'forgotten'` removes the subject, otherwise sets `muted`. `usePeople` gains an `editFactM` mutation (mock: `mapPersonFacts(qc, personId, fs => fs.map(f => f.id === factId ? { ...f, text } : f))`; real: `peopleApi.editFact` + invalidate `PEOPLE_KEY`) and returns `isError`, `refetch` from its `useDualQuery`. Re-export the four hooks from `data/hooks.ts`.

MSW (`test/msw/handlers.ts`, beside the fact handlers): `GET /api/companion/observation/knowledge` → `MOCK_OBSERVATIONS` converted back to wire (write a local `observationWire(o)` that maps `EvidenceItem` → wire item; for `kind: 'tag'` → `{ type: 'tag', text }`; for records reuse the fields); `GET /api/companion/effects` → flat rows from `MOCK_EFFECT_SUBJECTS` (one wire row per effect, with `subjectKind/subjectKey/subjectLabel/muted`; honour `?personId=` by filtering person rows to that key); `GET /api/companion/fact/:id/evidence` → `MOCK_FACT_EVIDENCE[id]` in wire form or `[]`; `DELETE /api/companion/fact/:id`, `DELETE /api/companion/observation/:id`, `PUT|DELETE /api/companion/effects/:kind/:key/mute` → 204; `PATCH /api/people/:personId/facts/:factId` echoes `factText`. The existing `GET /api/companion/fact` handler adds `mutedReason`, `mutedAt`, `supersededBy`, `provenance: { sourceKind: f.source, patternId: f.patternId ?? null, sourceMessageId: null }`.

- [ ] **Step 5: Run to verify it passes (both modes)**

Run: `cd frontend && CI=true pnpm vitest run src/data/ && CI=true VITE_USE_MOCK=false pnpm vitest run src/data/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data frontend/src/test/msw/handlers.ts
git commit -m "feat(data): Tudástár hookok két módban — észrevételek, hatás-alanyok, bizonyíték, műveletek (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B4: Pure logic — search/highlight + observation topics

**Files:**
- Create: `frontend/src/features/insights/logic/hubSearch.ts` (+ `hubSearch.test.ts`)
- Create: `frontend/src/features/insights/logic/hubTopics.ts` (+ `hubTopics.test.ts`)

**Interfaces:**
- Produces (`hubSearch.ts`): `fold(s: string): string` (per-character NFD strip + lowercase, index-aligned with `Array.from(s)`), `matches(text: string, query: string): boolean` (empty query matches), `highlight(text: string, query: string): Array<{ text: string; hit: boolean }>`, `byNameHu(a: string, b: string): number` (`localeCompare(b, 'hu')`).
- Produces (`hubTopics.ts`): `type ObsTopic = 'Alvás' | 'Edzés' | 'Étkezés' | 'Kapcsolatok' | 'Hangulat' | 'Egyéb'`, `OBS_TOPICS: ObsTopic[]` (that display order), `TOPIC_ICON: Record<ObsTopic, Icon3DName>` (`t-sleep`, `t-dumbbell`, `t-bowl`, `t-people`, `t-spark`, `t-pattern`), `topicOf(o: KnowledgeObservation): ObsTopic`, `groupBy<T, K extends string>(items: T[], key: (t: T) => K, order: K[]): Array<{ key: K; items: T[] }>` (empty groups dropped, `order` respected).
- Topic rule (deterministic, documented in the module): a `topicKey` whose tokens include `person` ⇒ Kapcsolatok; else the majority raw source key in `o.evidenceSources`: `sleep_log` ⇒ Alvás; `workout_session|exercise|exercise_set|exercise_feedback|run_session_log|sport_session|sport_event|activity_log` ⇒ Edzés; `meal|meal_item|water_log|weight_log` ⇒ Étkezés; `check_in|journal_entry|gratitude_entry|ai_message|ritual_day|daily_intention|intention_focus|habit_day` ⇒ Hangulat; no records ⇒ Egyéb. Ties resolve in `OBS_TOPICS` order.

- [ ] **Step 1: Write the failing tests**

```ts
// hubSearch.test.ts
import { describe, expect, it } from 'vitest'
import { byNameHu, fold, highlight, matches } from '@/features/insights/logic/hubSearch'

describe('hubSearch', () => {
  it('is accent- and case-insensitive', () => {
    expect(matches('Laktózérzékeny vagy', 'LAKTOZ')).toBe(true)
    expect(matches('Kávé 14 előtt', 'kave')).toBe(true)
    expect(matches('Kávé', '')).toBe(true)
    expect(matches('Kávé', 'tea')).toBe(false)
  })

  it('fold keeps the character count, so highlight indices line up', () => {
    const s = 'Őszi ülés'
    expect(Array.from(fold(s))).toHaveLength(Array.from(s).length)
  })

  it('highlight returns the ORIGINAL characters with hit flags', () => {
    expect(highlight('A kávé után', 'kave')).toEqual([
      { text: 'A ', hit: false }, { text: 'kávé', hit: true }, { text: ' után', hit: false },
    ])
    expect(highlight('semmi', '')).toEqual([{ text: 'semmi', hit: false }])
  })

  it('byNameHu sorts Hungarian names alphabetically', () => {
    expect(['Zoli', 'Ádám', 'Anya', 'Éva'].sort(byNameHu)).toEqual(['Ádám', 'Anya', 'Éva', 'Zoli'])
  })
})
```

```ts
// hubTopics.test.ts
import { describe, expect, it } from 'vitest'
import { groupBy, topicOf } from '@/features/insights/logic/hubTopics'
import type { KnowledgeObservation } from '@/data/insights/knowledgeHubApi'

const obs = (over: Partial<KnowledgeObservation>): KnowledgeObservation => ({
  patternId: 'o', title: 't', confirmedAt: '2026-09-01T00:00:00Z', recheckedAt: null, status: 'confirmed',
  factId: null, factMutedReason: null, factMutedAt: null, replacesPatternId: null, replacedByPatternId: null,
  topicKey: null, evidence: [], evidenceSources: [], ...over,
})

describe('topicOf', () => {
  it('person topic keys are Kapcsolatok', () => {
    expect(topicOf(obs({ topicKey: '1a2b-effect-mental-person' }))).toBe('Kapcsolatok')
  })
  it('majority evidence source decides', () => {
    expect(topicOf(obs({ evidenceSources: ['sleep_log', 'sleep_log', 'check_in'] }))).toBe('Alvás')
    expect(topicOf(obs({ evidenceSources: ['meal'] }))).toBe('Étkezés')
    expect(topicOf(obs({ evidenceSources: ['workout_session'] }))).toBe('Edzés')
  })
  it('no records → Egyéb', () => {
    expect(topicOf(obs({}))).toBe('Egyéb')
  })
})

describe('groupBy', () => {
  it('keeps the given order and drops empty groups', () => {
    expect(groupBy([{ k: 'b' }, { k: 'a' }, { k: 'b' }], (x) => x.k as 'a' | 'b' | 'c', ['c', 'b', 'a']))
      .toEqual([{ key: 'b', items: [{ k: 'b' }, { k: 'b' }] }, { key: 'a', items: [{ k: 'a' }] }])
  })
})
```


- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/logic/hubSearch.test.ts src/features/insights/logic/hubTopics.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

```ts
// hubSearch.ts
/** A Tudástár kliens-oldali keresője (S6, mezo-d6ivw.6): ékezet- és kisbetű-független, a
 *  találatot az EREDETI karakterekkel emeli ki. Karakterenként hajtogat, így a hajtogatott és az
 *  eredeti szöveg indexei egyeznek (a prototípus `norm/hl` párja, innerHTML nélkül). */
const foldChar = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charAt(0) || ch

export function fold(s: string): string {
  return Array.from(s).map(foldChar).join('')
}

export function matches(text: string, query: string): boolean {
  const q = query.trim()
  return !q || fold(text).includes(fold(q))
}

export function highlight(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const q = query.trim()
  if (!q) return [{ text, hit: false }]
  const chars = Array.from(text)
  const hay = fold(text)
  const needle = fold(q)
  const out: Array<{ text: string; hit: boolean }> = []
  let i = 0
  let j = hay.indexOf(needle, i)
  while (j > -1) {
    if (j > i) out.push({ text: chars.slice(i, j).join(''), hit: false })
    out.push({ text: chars.slice(j, j + needle.length).join(''), hit: true })
    i = j + needle.length
    j = hay.indexOf(needle, i)
  }
  if (i < chars.length) out.push({ text: chars.slice(i).join(''), hit: false })
  return out
}

export const byNameHu = (a: string, b: string) => a.localeCompare(b, 'hu')
```

(`fold` output is char-count-aligned, so `hay.indexOf` positions are valid `chars` indices.)

```ts
// hubTopics.ts
import type { Icon3DName } from '@/shared/ui/clay'
import type { KnowledgeObservation } from '@/data/insights/knowledgeHubApi'

export type ObsTopic = 'Alvás' | 'Edzés' | 'Étkezés' | 'Kapcsolatok' | 'Hangulat' | 'Egyéb'
export const OBS_TOPICS: ObsTopic[] = ['Alvás', 'Edzés', 'Étkezés', 'Kapcsolatok', 'Hangulat', 'Egyéb']
export const TOPIC_ICON: Record<ObsTopic, Icon3DName> = {
  Alvás: 't-sleep', Edzés: 't-dumbbell', Étkezés: 't-bowl', Kapcsolatok: 't-people', Hangulat: 't-spark', Egyéb: 't-pattern',
}

const SOURCE_TOPIC: Record<string, ObsTopic> = {
  sleep_log: 'Alvás',
  workout_session: 'Edzés', exercise: 'Edzés', exercise_set: 'Edzés', exercise_feedback: 'Edzés',
  run_session_log: 'Edzés', sport_session: 'Edzés', sport_event: 'Edzés', activity_log: 'Edzés',
  meal: 'Étkezés', meal_item: 'Étkezés', water_log: 'Étkezés', weight_log: 'Étkezés',
  check_in: 'Hangulat', journal_entry: 'Hangulat', gratitude_entry: 'Hangulat', ai_message: 'Hangulat',
  ritual_day: 'Hangulat', daily_intention: 'Hangulat', intention_focus: 'Hangulat', habit_day: 'Hangulat',
}

/** Egy észrevétel témája (S6): személy-téma-kulcs ⇒ Kapcsolatok; különben a bizonyíték-rekordok
 *  többségi NYERS forrás-kulcsa (evidenceSources — a mapEvidence előtti drót-érték); rekord nélkül Egyéb. Determinisztikus: döntetlennél az OBS_TOPICS sorrend. */
export function topicOf(o: KnowledgeObservation): ObsTopic {
  if (o.topicKey && o.topicKey.split('-').includes('person')) return 'Kapcsolatok'
  const tally = new Map<ObsTopic, number>()
  for (const source of o.evidenceSources) {
    const topic = SOURCE_TOPIC[source]
    if (topic) tally.set(topic, (tally.get(topic) ?? 0) + 1)
  }
  let best: ObsTopic = 'Egyéb'
  let bestN = 0
  for (const t of OBS_TOPICS) {
    const n = tally.get(t) ?? 0
    if (n > bestN) { best = t; bestN = n }
  }
  return best
}

export function groupBy<T, K extends string>(items: T[], key: (t: T) => K, order: K[]): Array<{ key: K; items: T[] }> {
  return order
    .map((k) => ({ key: k, items: items.filter((i) => key(i) === k) }))
    .filter((g) => g.items.length > 0)
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/logic/hubSearch.test.ts src/features/insights/logic/hubTopics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/logic/hubSearch.ts frontend/src/features/insights/logic/hubSearch.test.ts frontend/src/features/insights/logic/hubTopics.ts frontend/src/features/insights/logic/hubTopics.test.ts
git commit -m "feat(insights): Tudástár kereső és észrevétel-témák tiszta logikája (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B5: The copy module — every Hungarian string of the hub

**Files:**
- Create: `frontend/src/features/insights/logic/hubCopy.ts` (+ `hubCopy.test.ts`)
- Create: `frontend/src/features/me/logic/effectCopy.ts` (+ `effectCopy.test.ts`) — extracted from `PersonDetailPage.tsx:39-67`

**Interfaces:**
- Produces (`effectCopy.ts`): `METRIC_COPY`, `STRENGTH_META`, `CONFIDENCE_META`, `formatMeanDiff(n: number): string`, `personEffectSentence(name: string, e: PersonEffect): string` (= today's `effectSentence`), `EVENT_LEAD: Record<string, string>`, `eventEffectSentence(key: string, e: PersonEffect): string`, `EVENT_ICON: Record<string, Icon3DName>`, `effectEvidenceLine(e: PersonEffect): string` (`${subjectDays} nap alapján · átlagosan ~${formatMeanDiff} ponttal`).
- Produces (`hubCopy.ts`): the exports listed in Step 3, each covered by a test.

- [ ] **Step 1: Write the failing tests** (`hubCopy.test.ts` — one expectation per exported string; the literal strings are the contract)

```ts
import { describe, expect, it } from 'vitest'
import * as C from '@/features/insights/logic/hubCopy'

describe('hubCopy · verbs & toasts', () => {
  it('names the four verbs exactly as the approved prototype', () => {
    expect(C.VERB).toEqual({
      source: 'Honnan tudom?', unmute: 'Visszakapcsolom', mute: 'Elhallgattatom', forget: 'Elfelejtem',
      edit: 'Javítom', save: 'Mentés', cancel: 'Mégse', more: 'További műveletek', undo: 'Visszavonom',
    })
    expect(C.TOAST.muted).toBe('Elhallgattattam — megőrzöm, de nem használom')
    expect(C.TOAST.unmuted).toBe('Visszakapcsoltam — újra használhatom')
    expect(C.TOAST.forgotten).toBe('Végleg elfelejtve')
    expect(C.TOAST.undone).toBe('Visszavonva — minden a helyén')
    expect(C.TOAST.edited).toBe('Javítottam')
  })

  it('undo bar lines', () => {
    expect(C.undoTitle('Mázli a macskád')).toBe('Elfelejtettem: „Mázli a macskád”')
    expect(C.undoSub(false)).toBe('ugyanebből a forrásból nem tanulom meg újra')
    expect(C.undoSub(true)).toBe('többé nem mutatom és nem használom')
  })

  it('strip notes', () => {
    expect(C.stripNote('active')).toBe('Elhallgattatva megőrzöm, de semmire nem használom. Elfelejtve törlöm — pár másodpercig visszavonható.')
    expect(C.stripNote('muted')).toBe('Elhallgattatva: megőrzöm, de semmire nem használom.')
    expect(C.stripNote('effect')).toBe('Elhallgattatva nem mutatom és nem használom, de bármikor visszakapcsolhatod. Elfelejtve soha többé.')
  })
})

describe('hubCopy · why a thing is muted', () => {
  it('reason + date, superseded with a comma', () => {
    expect(C.whyText('user', '2026-09-12T08:00:00Z')).toBe('te hallgattattad el · Szep 12')
    expect(C.whyText('refuted', '2026-09-16T08:00:00Z')).toBe('később nem igazolódott · Szep 16')
    expect(C.whyText('superseded', '2026-09-21T09:20:00Z')).toBe('felülírta egy újabb észrevétel, Szep 21')
  })
  it('no date → reason only (backfilled / person facts)', () => {
    expect(C.whyText('user', null)).toBe('te hallgattattad el')
    expect(C.whyText('superseded', null)).toBe('felülírta egy újabb észrevétel')
  })
  it('why icons', () => {
    expect(C.WHY_ICON).toEqual({ user: 't-mute', refuted: 't-down', superseded: 't-history' })
  })
})

describe('hubCopy · observation status line', () => {
  const base = { recheckedAt: null, factMutedReason: null, factMutedAt: null, replacesPatternId: null, confirmedAt: '2026-09-21T08:00:00Z' }
  it('still true, rechecked', () => {
    expect(C.obsStatus({ ...base, recheckedAt: '2026-09-20T09:20:00Z' })).toEqual({ text: 'legutóbb ellenőrizve Szep 20 · még igaz', tone: 'ok' })
  })
  it('never rechecked', () => {
    expect(C.obsStatus(base)).toEqual({ text: 'még nem ellenőriztem újra · megerősítve Szep 21', tone: 'ok' })
  })
  it('the newer half of a drift pair', () => {
    expect(C.obsStatus({ ...base, replacesPatternId: 'o3old' })).toEqual({ text: 'ez váltotta a régit · Szep 21', tone: 'gold' })
  })
  it('superseded', () => {
    expect(C.obsStatus({ ...base, factMutedReason: 'superseded', factMutedAt: '2026-09-21T09:20:00Z' }))
      .toEqual({ text: 'felülírta egy újabb észrevétel, Szep 21', tone: 'off' })
  })
  it('refuted and user-muted', () => {
    expect(C.obsStatus({ ...base, factMutedReason: 'refuted' }).text).toBe('elhallgattatva · később nem igazolódott')
    expect(C.obsStatus({ ...base, factMutedReason: 'user', factMutedAt: '2026-09-09T08:00:00Z' }).text)
      .toBe('elhallgattatva · te hallgattattad el, Szep 9')
  })
})

describe('hubCopy · hub, tiles, sections', () => {
  it('hero + notes', () => {
    expect(C.HERO.title).toBe('dolgot tud rólad Mezo')
    expect(C.HERO.sub).toBe('és te döntöd el, mit használhat belőle.')
    expect(C.heroNote('ok')).toBe('Egy észrevételt a belőle tanult ténnyel együtt egyszer számolok.')
    expect(C.heroNote('off')).toBe('A társ most ki van kapcsolva: a tények, az észrevételek és a hatások most nem elérhetők, ezért a szám csak az embereket számolja.')
    expect(C.heroNote('partial')).toBe('Néhány szakasz most nem töltődött be, ezért a szám nélkülük áll.')
  })
  it('tile subs', () => {
    expect(C.tileSub.facts(12, 3)).toBe('12 bekapcsolva · 3 elhallgattatva')
    expect(C.tileSub.people(9, 2)).toBe('9 ember · 2 elhallgattatva')
    expect(C.tileSub.observations(20, 1, 4)).toBe('20 még igaz · 1 felülírva · 4 elhallgattatva')
    expect(C.tileSub.effects(7, 5, 1)).toBe('7 ember · 5 esemény · 1 elhallgattatva')
    expect(C.TILE_STATE.off).toBe('A társ most nincs bekapcsolva.')
    expect(C.TILE_STATE.offFacts).toBe('A társ most nincs bekapcsolva — a tények most nem elérhetők.')
    expect(C.TILE_STATE.error).toBe('Most nem sikerült betölteni.')
    expect(C.TILE_STATE.retry).toBe('Újrapróbálom ›')
    expect(C.TILE_STATE.loading).toBe('Betöltés…')
  })
  it('section leads and footers', () => {
    expect(C.lead.facts(52, 4, 49, 3)).toBe('52 tény, 4 témában · 49 bekapcsolva · 3 elhallgattatva')
    expect(C.lead.people(14, 60)).toBe('14 ember · 60 tény — ábécérendben, nincs rangsor. Keresni névre és arra is lehet, amit tudok róluk.')
    expect(C.lead.observations).toBe('Amit a napjaidból vettem észre, és te megerősítetted — témák szerint. Negyedévente újra megnézem, igaz-e még.')
    expect(C.lead.effects).toBe('Milyenek a napjaid — hangulatban, energiában, nyugalomban —, amikor valaki vagy valami felbukkan bennük.')
    expect(C.FACTS_NOTE).toBe('Ami be van kapcsolva, azt a társ minden beszélgetésben és üzenetben tudja rólad.')
  })
  it('search, groups, empties', () => {
    expect(C.SEARCH.facts).toBe('Keresés a tények között…')
    expect(C.SEARCH.people).toBe('Keresés név vagy tény szerint…')
    expect(C.SEARCH.person('Barbi')).toBe('Keresés Barbi tényei között…')
    expect(C.SEARCH.observations).toBe('Keresés az észrevételek között…')
    expect(C.SEARCH.effects).toBe('Keresés ember vagy esemény szerint…')
    expect(C.noHits('kávé')).toBe('Nincs találat erre: „kávé”.')
    expect(C.CLEAR_SEARCH).toBe('Keresés törlése')
    expect(C.groupCount('', 7)).toBe('7')
    expect(C.groupCount('ká', 2)).toBe('2 találat')
    expect(C.MUTED_GROUP).toBe('Elhallgattatott')
  })
})
```

`effectCopy.test.ts`: the three `METRIC_COPY` sentences for `higher`/`lower` exactly as today (`'jobb a hangulatod'`, `'nyomottabb a hangulatod'`, `'több az energiád'`, `'kevesebb az energiád'`, `'feszültebb vagy'`, `'nyugodtabb vagy'`), `personEffectSentence('Anya', {metric:'mental',direction:'higher',…})` = `'Úgy tűnik, azokon a napokon, amikor Anya szóba kerül, jobb a hangulatod.'`, `eventEffectSentence('edzes', {metric:'stress',direction:'lower',…})` = `'Úgy tűnik, az edzésnapokon nyugodtabb vagy.'`, `formatMeanDiff(-0.55)` = `'0,6'` (today's `toFixed(1)` rounding — assert the value the existing helper really returns), `effectEvidenceLine({subjectDays: 11, meanDiff: 0.5,…})` = `'11 nap alapján · átlagosan ~0,5 ponttal'`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/logic/hubCopy.test.ts src/features/me/logic/effectCopy.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `hubCopy.ts`**

```ts
import type { FactMuteReason, FactSource, PersonFact } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'
import { huMonthDay } from '@/shared/lib/dates'

/** A Tudástár hub MINDEN magyar szövege (S6, mezo-d6ivw.6) — a factCopy/roladCopy idióma:
 *  tiszta, tesztelt modul; a komponensek csak ebből olvasnak. Forrás: a jóváhagyott
 *  docs/design_2.0/prototypes/uveg-tudastar-hub.html (a negyedéves újraellenőrzés szóhasználata
 *  a valós ütemhez igazítva). */

const day = (iso: string | null) => (iso ? huMonthDay(iso.slice(0, 10)) : null)

export const VERB = {
  source: 'Honnan tudom?', unmute: 'Visszakapcsolom', mute: 'Elhallgattatom', forget: 'Elfelejtem',
  edit: 'Javítom', save: 'Mentés', cancel: 'Mégse', more: 'További műveletek', undo: 'Visszavonom',
} as const

export const TOAST = {
  muted: 'Elhallgattattam — megőrzöm, de nem használom',
  unmuted: 'Visszakapcsoltam — újra használhatom',
  forgotten: 'Végleg elfelejtve',
  undone: 'Visszavonva — minden a helyén',
  edited: 'Javítottam',
} as const

export const undoTitle = (label: string) => `Elfelejtettem: „${label}”`
export const undoSub = (computed: boolean) =>
  computed ? 'többé nem mutatom és nem használom' : 'ugyanebből a forrásból nem tanulom meg újra'

export function stripNote(kind: 'active' | 'muted' | 'effect'): string {
  if (kind === 'muted') return 'Elhallgattatva: megőrzöm, de semmire nem használom.'
  if (kind === 'effect') return 'Elhallgattatva nem mutatom és nem használom, de bármikor visszakapcsolhatod. Elfelejtve soha többé.'
  return 'Elhallgattatva megőrzöm, de semmire nem használom. Elfelejtve törlöm — pár másodpercig visszavonható.'
}

const WHY_LABEL: Record<FactMuteReason, string> = {
  user: 'te hallgattattad el', refuted: 'később nem igazolódott', superseded: 'felülírta egy újabb észrevétel',
}
export const WHY_ICON: Record<FactMuteReason, Icon3DName> = { user: 't-mute', refuted: 't-down', superseded: 't-history' }

export function whyText(reason: FactMuteReason, at: string | null): string {
  const d = day(at)
  if (!d) return WHY_LABEL[reason]
  return reason === 'superseded' ? `${WHY_LABEL.superseded}, ${d}` : `${WHY_LABEL[reason]} · ${d}`
}

export interface ObsStatusInput {
  recheckedAt: string | null
  confirmedAt: string
  factMutedReason: FactMuteReason | null
  factMutedAt: string | null
  replacesPatternId: string | null
}
export function obsStatus(o: ObsStatusInput): { text: string; tone: 'ok' | 'gold' | 'off' } {
  if (o.factMutedReason === 'superseded') return { text: whyText('superseded', o.factMutedAt), tone: 'off' }
  if (o.factMutedReason === 'refuted') return { text: `elhallgattatva · ${WHY_LABEL.refuted}`, tone: 'off' }
  if (o.factMutedReason === 'user') {
    const d = day(o.factMutedAt)
    return { text: `elhallgattatva · ${WHY_LABEL.user}${d ? `, ${d}` : ''}`, tone: 'off' }
  }
  if (o.replacesPatternId) return { text: `ez váltotta a régit · ${day(o.confirmedAt)}`, tone: 'gold' }
  if (o.recheckedAt) return { text: `legutóbb ellenőrizve ${day(o.recheckedAt)} · még igaz`, tone: 'ok' }
  return { text: `még nem ellenőriztem újra · megerősítve ${day(o.confirmedAt)}`, tone: 'ok' }
}

export const OBS_FILTERS = [['mind', 'Mind'], ['igaz', 'Még igaz'], ['felul', 'Felülírva'], ['elh', 'Elhallgattatva']] as const
export type ObsFilter = (typeof OBS_FILTERS)[number][0]

export const DRIFT_EYEBROW = {
  bothOn: 'A RÉGI IS BE VAN KAPCSOLVA',
  older: (confirmedAt: string) => `KORÁBBAN · MEGERŐSÍTVE ${String(day(confirmedAt)).toUpperCase()}`,
  bothOnLine: 'újra bekapcsoltad — mindkettőt használom',
} as const

export const HERO = { title: 'dolgot tud rólad Mezo', sub: 'és te döntöd el, mit használhat belőle.', on: 'bekapcsolva', off: 'elhallgattatva' } as const
export function heroNote(state: 'ok' | 'off' | 'partial'): string {
  if (state === 'off') return 'A társ most ki van kapcsolva: a tények, az észrevételek és a hatások most nem elérhetők, ezért a szám csak az embereket számolja.'
  if (state === 'partial') return 'Néhány szakasz most nem töltődött be, ezért a szám nélkülük áll.'
  return 'Egy észrevételt a belőle tanult ténnyel együtt egyszer számolok.'
}

export const TILE = { facts: 'Rólad', people: 'Emberek', observations: 'Észrevételek', effects: 'Hatások' } as const
export const tileSub = {
  facts: (on: number, muted: number) => `${on} bekapcsolva · ${muted} elhallgattatva`,
  people: (people: number, muted: number) => `${people} ember · ${muted} elhallgattatva`,
  observations: (holds: number, superseded: number, muted: number) => `${holds} még igaz · ${superseded} felülírva · ${muted} elhallgattatva`,
  effects: (people: number, events: number, muted: number) => `${people} ember · ${events} esemény · ${muted} elhallgattatva`,
}
export const TILE_STATE = {
  off: 'A társ most nincs bekapcsolva.',
  offFacts: 'A társ most nincs bekapcsolva — a tények most nem elérhetők.',
  error: 'Most nem sikerült betölteni.',
  retry: 'Újrapróbálom ›',
  loading: 'Betöltés…',
} as const

export const LINKS = {
  pending: (n: number) => `${n} javaslat vár rád a Rólad oldalon`,
  pendingSub: 'ott döntesz róluk',
  kategoriak: 'Kategóriák', kategoriakSub: 'ugyanennek a tudásnak a térképe',
  hogyan: 'Hogyan tanul?', hogyanSub: 'honnan jön, amit tud, és mi kerül a beszélgetésbe',
  dossier: 'A csapat véleménye rólad', dossierSub: 'a karakterek dossziéjában — ebben a körben csak megnézni lehet',
  teamSection: 'A csapatról',
} as const

export const lead = {
  facts: (total: number, topics: number, on: number, muted: number) => `${total} tény, ${topics} témában · ${on} bekapcsolva · ${muted} elhallgattatva`,
  people: (people: number, facts: number) => `${people} ember · ${facts} tény — ábécérendben, nincs rangsor. Keresni névre és arra is lehet, amit tudok róluk.`,
  observations: 'Amit a napjaidból vettem észre, és te megerősítetted — témák szerint. Negyedévente újra megnézem, igaz-e még.',
  effects: 'Milyenek a napjaid — hangulatban, energiában, nyugalomban —, amikor valaki vagy valami felbukkan bennük.',
} as const
export const FACTS_NOTE = 'Ami be van kapcsolva, azt a társ minden beszélgetésben és üzenetben tudja rólad.'
export const FOOT = {
  people: ['Az ember lapja változatlan', 'ott továbbra is kapcsolóval és „Visszavonom”-mal kezelheted ugyanezeket.'],
  observations: ['Javítani itt nem lehet', 'egy észrevétel a napjaidból számolódik — elhallgattatni vagy elfelejteni lehet. A belőle tanult mondatot a Tények között javíthatod.'],
  effects: ['Együttjárás, nem ok-okozat', 'azt mutatja, mi szokott együtt járni a napjaidban — nem azt, hogy mi okozza. Két külön jelzés: mennyire jár együtt (telt pöttyök), és mennyi nap támasztja alá (üres karikák).'],
} as const

export const SEARCH = {
  facts: 'Keresés a tények között…', people: 'Keresés név vagy tény szerint…',
  person: (name: string) => `Keresés ${name} tényei között…`,
  observations: 'Keresés az észrevételek között…', effects: 'Keresés ember vagy esemény szerint…',
} as const
export const noHits = (q: string) => `Nincs találat erre: „${q}”.`
export const CLEAR_SEARCH = 'Keresés törlése'
export const groupCount = (q: string, n: number) => (q.trim() ? `${n} találat` : String(n))
export const MUTED_GROUP = 'Elhallgattatott'
export const MUTED_HINT = { facts: 'megőrzöm, de semmire nem használom', effects: 'nem mutatom és nem használom' } as const
export const onHint = (n: number) => (n ? `${n} bekapcsolva` : '')

export const EMPTY = {
  personNone: 'Most egy tényt sem használok róla.',
  obsState: 'Ebben az állapotban most nincs észrevétel.',
  effectsPeople: 'Most egy emberről sem mutatok hatást.',
  effectsEvents: 'Most egy eseményről sem mutatok hatást.',
  facts: 'Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni.',
  people: 'Még senkiről nem tudok semmit — ahogy mesélsz róluk, itt jelennek meg.',
  observations: 'Még nincs megerősített észrevétel.',
  effects: 'Még nincs elég nap ahhoz, hogy együttjárást mutassak.',
} as const

export const ORIGIN: Record<FactSource, string> = {
  pattern: 'Megerősített észrevételből tanultam — amikor az egyik változik, a másik jellemzően követi.',
  chat: 'A beszélgetéseitekből szűrtem ki.',
  manual: 'Te vetted fel kézzel.',
  weekly_review: 'A heti áttekintésből derült ki.',
  question: 'Egy kérdésre válaszoltál rá.',
}
export const CHIP: Record<FactSource, string> = {
  pattern: 'észrevételből', chat: 'beszélgetésből', manual: 'kézzel', weekly_review: 'heti áttekintésből', question: 'kérdésre válaszoltál',
}
export const OBS_ORIGIN = 'A napjaidból számoltam ki, és te erősítetted meg. Ezekből a napokból látszik:'
export const GO_TO_OBSERVATION = 'Az észrevétel, amiből tanultam ›'
export const SOURCE_EYEBROW = 'HONNAN TUDOM'
export const EVIDENCE_UNAVAILABLE = 'A részletes forrás most nem elérhető.'
export const reinforced = (n: number) => `${n}× visszaigazolva`
export const confirmedOn = (iso: string) => `megerősítve ${day(iso)}`

export function personFactOrigin(kind: PersonFact['sourceKind']): string {
  return kind === 'chat_turn' ? 'A beszélgetéseitekből szűrtem ki.' : 'Egy éjszakai jegyzetből szűrtem ki.'
}
export function personFactSub(kindLabel: string, f: Pick<PersonFact, 'sourceKind' | 'createdAt'>): string {
  return `${kindLabel} · ${f.sourceKind === 'chat_turn' ? 'chatből' : 'éjszakai jegyzetből'} · ${day(f.createdAt)}`
}
export const personRowSub = (on: number, muted: number) => ({ main: `${on} tény`, muted: muted ? `${muted} elhallgattatva` : '' })
export const PERSON_PAGE_LINK = 'A lapja ›'
export const personHead = (on: number, muted: number) => `${on} tény bekapcsolva${muted ? ` · ${muted} elhallgattatva` : ''}`

export const EFFECT_GROUPS = { people: 'Emberek', peopleHint: 'ábécérendben', events: 'Események', eventsHint: 'erősség szerint' } as const
export const effectSubjectKindLabel = (kind: 'person' | 'event', n: number) => `${kind === 'person' ? 'ember' : 'esemény'} · ${n} jelzés`
export const EFFECT_SIGNAL = { strength: 'EGYÜTTJÁRÁS', confidence: 'BIZONYOSSÁG', foot: 'Együttjárás, nem ok-okozat.' } as const
export const DEGRADED = {
  facts: 'A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.',
  section: 'A társ most nincs bekapcsolva — ez a szakasz most nem elérhető.',
  error: 'Most nem sikerült betölteni ezt a szakaszt.',
  loading: 'A szakasz betöltése…',
} as const
```

Add the matching expectations for `CHIP`, `ORIGIN`, `EMPTY`, `DEGRADED`, `personFactSub`, `personHead`, `effectSubjectKindLabel`, `DRIFT_EYEBROW` to `hubCopy.test.ts` (one `it` each — the literal strings above are the expected values).

`effectCopy.ts`: move `METRIC_COPY`, `STRENGTH_META`, `CONFIDENCE_META`, `formatMeanDiff`, `effectSentence` (renamed `personEffectSentence`) out of `PersonDetailPage.tsx` verbatim, and add:

```ts
export const EVENT_LEAD: Record<string, string> = {
  edzes: 'az edzésnapokon', munka: 'a munkás napokon', csalad: 'a családi napokon',
  kozos_program: 'a közös programok napjain', konfliktus: 'a konfliktusos napokon', pihenes: 'a pihenős napokon',
}
export const EVENT_ICON: Record<string, Icon3DName> = {
  edzes: 't-dumbbell', munka: 't-flame', csalad: 't-people', kozos_program: 't-calendar', konfliktus: 't-bolt', pihenes: 't-moon',
}
export function eventEffectSentence(key: string, e: PersonEffect): string {
  return `Úgy tűnik, ${EVENT_LEAD[key] ?? 'ezeken a napokon'} ${METRIC_COPY[e.metric][e.direction]}.`
}
export const effectEvidenceLine = (e: PersonEffect) => `${e.subjectDays} nap alapján · átlagosan ~${formatMeanDiff(e.meanDiff)} ponttal`
```

`PersonDetailPage.tsx` imports these instead of its local copies (no behaviour change; its tests stay green).

- [ ] **Step 4: Run to verify they pass**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/logic/hubCopy.test.ts src/features/me/logic/effectCopy.test.ts src/features/me/pages/PersonDetailPage.test.tsx`
Expected: PASS. (If `huMonthDay` produces a different month abbreviation than `Szep`, update the test literals to what `huMonthDay('2026-09-12')` returns — the app-wide date style wins over the prototype's `szept.`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/logic/hubCopy.ts frontend/src/features/insights/logic/hubCopy.test.ts frontend/src/features/me/logic frontend/src/features/me/pages/PersonDetailPage.tsx
git commit -m "feat(insights): a Tudástár minden szövege egy tesztelt modulban; a hatás-szöveg közös (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B6: `useForgetUndo` + `ForgetUndoBar` (5 s, commit on expiry only)

**Files:**
- Create: `frontend/src/features/insights/hooks/useForgetUndo.ts` (+ `useForgetUndo.test.tsx`)
- Create: `frontend/src/features/insights/components/hub/ForgetUndoBar.tsx` (+ `ForgetUndoBar.test.tsx`)

**Interfaces:**
- Produces:

```ts
export const UNDO_MS = 5000
export interface ForgetRequest { key: string; label: string; computed: boolean; commit: () => void | Promise<unknown> }
export function useForgetUndo(): {
  pending: (ForgetRequest & { startedAt: number }) | null
  start: (req: ForgetRequest) => void   // commits a still-pending previous forget first
  undo: () => void                      // cancels: commit never runs
  isHidden: (key: string) => boolean    // sections hide the row while pending
}
// ForgetUndoBar({ pending, onUndo }): renders nothing when pending is null
```

- Semantics: `commit` runs exactly once — on the 5 s expiry, when a NEW forget starts, or when the owner unmounts (the user asked to forget; leaving the page is not an undo). `undo` inside the window: `commit` never runs and the "Visszavonva" toast fires; expiry fires the "Végleg elfelejtve" toast.

- [ ] **Step 1: Write the failing tests**

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UNDO_MS, useForgetUndo } from '@/features/insights/hooks/useForgetUndo'

describe('useForgetUndo', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('undo inside the window sends nothing', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useForgetUndo())
    act(() => result.current.start({ key: 'f:1', label: 'x', computed: false, commit }))
    expect(result.current.isHidden('f:1')).toBe(true)
    act(() => { vi.advanceTimersByTime(UNDO_MS - 1) })
    act(() => result.current.undo())
    act(() => { vi.advanceTimersByTime(UNDO_MS * 2) })
    expect(commit).not.toHaveBeenCalled()
    expect(result.current.isHidden('f:1')).toBe(false)
  })

  it('expiry sends exactly one commit', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useForgetUndo())
    act(() => result.current.start({ key: 'f:1', label: 'x', computed: false, commit }))
    act(() => { vi.advanceTimersByTime(UNDO_MS) })
    act(() => { vi.advanceTimersByTime(UNDO_MS) })
    expect(commit).toHaveBeenCalledTimes(1)
    expect(result.current.pending).toBeNull()
  })

  it('a second forget commits the first immediately', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result } = renderHook(() => useForgetUndo())
    act(() => result.current.start({ key: 'f:1', label: 'a', computed: false, commit: first }))
    act(() => result.current.start({ key: 'f:2', label: 'b', computed: false, commit: second }))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(result.current.isHidden('f:2')).toBe(true)
  })

  it('unmount commits a pending forget (leaving is not an undo)', () => {
    const commit = vi.fn()
    const { result, unmount } = renderHook(() => useForgetUndo())
    act(() => result.current.start({ key: 'e:event:munka', label: 'Munka', computed: true, commit }))
    unmount()
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
```

`ForgetUndoBar.test.tsx`: renders `undoTitle(label)`, `undoSub(computed)`, a "Visszavonom" button whose click calls `onUndo`, a countdown number starting at `5` (fake timers: after 2 s it shows `3`), `role="status"`; renders nothing for `pending={null}`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/hooks/useForgetUndo.test.tsx src/features/insights/components/hub/ForgetUndoBar.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

```ts
// useForgetUndo.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/shared/ui/ToastProvider'
import { TOAST } from '@/features/insights/logic/hubCopy'

export const UNDO_MS = 5000

export interface ForgetRequest {
  key: string
  label: string
  /** Computed items (observations, effects) are suppressed, not deleted — the bar says so. */
  computed: boolean
  commit: () => void | Promise<unknown>
}
type Pending = ForgetRequest & { startedAt: number }

/**
 * S6 (mezo-d6ivw.6): "Elfelejtem" is permanent, so the ONLY undo is this window — the request is
 * sent when it closes (never before), exactly once. A purpose-built rich confirmation (countdown +
 * bar), hence feature-local rather than the shared toast (frontend_conventions §7a).
 */
export function useForgetUndo() {
  const toast = useToast()
  const [pending, setPending] = useState<Pending | null>(null)
  const ref = useRef<Pending | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const commitNow = useCallback((expired: boolean) => {
    const p = ref.current
    if (!p) return
    clear()
    ref.current = null
    setPending(null)
    void p.commit()
    if (expired) toast.show({ kind: 'info', text: TOAST.forgotten })
  }, [toast])

  const start = useCallback((req: ForgetRequest) => {
    commitNow(false)
    const next = { ...req, startedAt: Date.now() }
    ref.current = next
    setPending(next)
    timer.current = setTimeout(() => commitNow(true), UNDO_MS)
  }, [commitNow])

  const undo = useCallback(() => {
    if (!ref.current) return
    clear()
    ref.current = null
    setPending(null)
    toast.show({ kind: 'info', text: TOAST.undone })
  }, [toast])

  useEffect(() => () => {
    // leaving the page is not an undo: commit what the user asked for
    const p = ref.current
    clear()
    ref.current = null
    if (p) void p.commit()
  }, [])

  const isHidden = useCallback((key: string) => pending?.key === key, [pending])
  return { pending, start, undo, isHidden }
}
```

```tsx
// ForgetUndoBar.tsx
import { useEffect, useState } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { undoSub, undoTitle, VERB } from '@/features/insights/logic/hubCopy'
import { UNDO_MS, type ForgetRequest } from '@/features/insights/hooks/useForgetUndo'

/** The prototype's `#undo` bar: glass, fixed above the tab bar, a 5→0 countdown and a draining
 *  bar (CSS keyframes; the reduced-motion branch in prototype.css steps it per second). */
export function ForgetUndoBar({ pending, onUndo }: {
  pending: (ForgetRequest & { startedAt: number }) | null
  onUndo: () => void
}) {
  const [left, setLeft] = useState(UNDO_MS / 1000)
  useEffect(() => {
    if (!pending) return
    const tick = () => setLeft(Math.max(0, Math.ceil((UNDO_MS - (Date.now() - pending.startedAt)) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [pending])
  if (!pending) return null
  return (
    <div className="th-undo glass on" role="status" aria-live="polite" key={pending.key}>
      <div className="r"><Icon3D name="t-eraser" size={22} /><b>{undoTitle(pending.label)}</b></div>
      <div className="r2">
        <small>{undoSub(pending.computed)}</small>
        <button type="button" className="u" onClick={onUndo}>{VERB.undo}<i aria-hidden="true">{left}</i></button>
      </div>
      <div className="bar2" aria-hidden="true"><b style={{ animationDuration: `${UNDO_MS}ms` }} /></div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/hooks/useForgetUndo.test.tsx src/features/insights/components/hub/ForgetUndoBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/hooks/useForgetUndo.ts frontend/src/features/insights/hooks/useForgetUndo.test.tsx frontend/src/features/insights/components/hub/ForgetUndoBar.tsx frontend/src/features/insights/components/hub/ForgetUndoBar.test.tsx
git commit -m "feat(insights): Elfelejtem visszavonási ablak — csak lejáratkor küld, pontosan egyszer (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B7: The shared row building block — `HubRow`, `HubFold`, `HubSearch` + the `th-*` CSS

**Files:**
- Create: `frontend/src/features/insights/components/hub/HubRow.tsx` (+ `HubRow.test.tsx`)
- Create: `frontend/src/features/insights/components/hub/HubFold.tsx` (+ `HubFold.test.tsx`)
- Create: `frontend/src/features/insights/components/hub/HubSearch.tsx` (includes `Highlight`)
- Modify: `frontend/src/styles/prototype.css` (new `.tud9 .th-*` block after the existing `.tud9` block, ~L27455)

**Interfaces:**
- Produces:

```tsx
export interface HubRowProps {
  rowKey: string                       // 'f:<id>' | 'p:<id>' | 'o:<patternId>' | 'e:<kind>:<key>'
  icon: Icon3DName
  accent: string                       // CSS color for --c, e.g. 'var(--dv-sky)'
  text: string
  query?: string                       // highlight target
  sub?: ReactNode
  status?: ReactNode                   // e.g. the observation status line
  why?: { text: string; icon: Icon3DName } | null
  muted: boolean
  canEdit?: boolean                    // Javítom (facts only)
  canMute?: boolean                    // default true
  source?: () => ReactNode             // rendered only while "Honnan tudom?" is open (lazy fetch lives inside)
  onMute: (on: boolean) => void
  onForget: () => void
  onEdit?: (text: string) => void
  after?: ReactNode
  highlight?: boolean                  // the ?fact= deep-link one-shot highlight (tud9-hl)
}
export function HubRow(props: HubRowProps): JSX.Element
export function HubFold(props: { id: string; icon: Icon3DName; label: string; count: string; hint?: string; open: boolean; onToggle: () => void; children: ReactNode }): JSX.Element
export function HubSearch(props: { value: string; onChange: (v: string) => void; placeholder: string }): JSX.Element
export function Highlight(props: { text: string; query: string }): JSX.Element
export function NoHits(props: { query: string; onClear: () => void }): JSX.Element
```

- Behaviour: the row shows `Honnan tudom?` (hidden when `source` is undefined), `Visszakapcsolom` when muted, and `⋯` (`aria-expanded`) opening the strip: `Javítom` (if `canEdit`), `Elhallgattatom` (if not muted and `canMute !== false`), `Elfelejtem` (`warn`), plus `stripNote(muted ? 'muted' : 'active')`. `Javítom` swaps the title for a textarea + Mégse / Mentés; Mentés with unchanged or blank text is a no-op close. Only one of `acts` / `src` / `edit` is open at a time per row. Rows are flat (`th-row`), never `.glass` (§3.4).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HubRow } from '@/features/insights/components/hub/HubRow'

const base = { rowKey: 'f:1', icon: 't-bowl' as const, accent: 'var(--dv-sage)', text: 'Laktózérzékeny vagy', muted: false, onMute: vi.fn(), onForget: vi.fn() }

describe('HubRow', () => {
  it('opens the ⋯ strip with the verbs, and Elhallgattatom calls onMute(true)', async () => {
    const onMute = vi.fn()
    render(<HubRow {...base} canEdit onMute={onMute} onEdit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    expect(screen.getByRole('button', { name: /Javítom/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Elhallgattatom/ }))
    expect(onMute).toHaveBeenCalledWith(true)
  })

  it('a muted row offers Visszakapcsolom and shows why', async () => {
    const onMute = vi.fn()
    render(<HubRow {...base} muted why={{ text: 'te hallgattattad el', icon: 't-mute' }} onMute={onMute} />)
    expect(screen.getByText('te hallgattattad el')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Visszakapcsolom/ }))
    expect(onMute).toHaveBeenCalledWith(false)
  })

  it('Elfelejtem calls onForget', async () => {
    const onForget = vi.fn()
    render(<HubRow {...base} onForget={onForget} />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    await userEvent.click(screen.getByRole('button', { name: /Elfelejtem/ }))
    expect(onForget).toHaveBeenCalledTimes(1)
  })

  it('Javítom edits inline and saves the trimmed text', async () => {
    const onEdit = vi.fn()
    render(<HubRow {...base} canEdit onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: 'További műveletek' }))
    await userEvent.click(screen.getByRole('button', { name: /Javítom/ }))
    const box = screen.getByRole('textbox', { name: 'A tény szövege' })
    await userEvent.clear(box)
    await userEvent.type(box, '  Laktózérzékeny vagy, csak laktózmentes jöhet ')
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(onEdit).toHaveBeenCalledWith('Laktózérzékeny vagy, csak laktózmentes jöhet')
  })

  it('Honnan tudom? renders the source lazily, only while open', async () => {
    const source = vi.fn(() => <p>forrás</p>)
    render(<HubRow {...base} source={source} />)
    expect(source).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Honnan tudom\?/ }))
    expect(screen.getByText('forrás')).toBeInTheDocument()
  })

  it('highlights the query inside the title', () => {
    render(<HubRow {...base} query="laktoz" />)
    expect(screen.getByText('Laktóz', { selector: 'mark' })).toBeInTheDocument()
  })

  it('a row is flat, never a glass card (§3.4)', () => {
    const { container } = render(<HubRow {...base} />)
    expect(container.querySelector('.th-row.glass')).toBeNull()
  })
})
```

`HubFold.test.tsx`: the fold button carries `aria-expanded`, shows `label · count` and the hint, renders children only when `open`, calls `onToggle` on click.

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/components/hub/`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement the components**

```tsx
// HubSearch.tsx
import { Icon3D } from '@/shared/ui/clay'
import { highlight } from '@/features/insights/logic/hubSearch'
import { CLEAR_SEARCH, noHits } from '@/features/insights/logic/hubCopy'

export function Highlight({ text, query }: { text: string; query: string }) {
  return <>{highlight(text, query).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>
}

export function HubSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className={`th-search rise${value ? ' has' : ''}`}>
      <Icon3D name="t-lens" size={20} />
      <input type="text" value={value} placeholder={placeholder} aria-label={placeholder}
        autoComplete="off" spellCheck={false} enterKeyHint="search" onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" className="x" aria-label={CLEAR_SEARCH} onClick={() => onChange('')}>✕</button>}
    </label>
  )
}

export function NoHits({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="th-empty">
      <Icon3D name="t-lens" size={22} />
      {noHits(query)} <button type="button" className="th-link" onClick={onClear}>{CLEAR_SEARCH}</button>
    </div>
  )
}
```

```tsx
// HubFold.tsx
import type { ReactNode } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

export function HubFold({ id, icon, label, count, hint, open, onToggle, children }: {
  id: string; icon: Icon3DName; label: string; count: string; hint?: string; open: boolean; onToggle: () => void; children: ReactNode
}) {
  return (
    <>
      <button type="button" className="th-fold" data-g={id} aria-expanded={open} onClick={onToggle}>
        <Icon3D name={icon} size={24} />
        <span>{label} · {count}{hint ? <small>{hint}</small> : null}</span>
        <span aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && children}
    </>
  )
}
```

```tsx
// HubRow.tsx
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { stripNote, VERB } from '@/features/insights/logic/hubCopy'
import { Highlight } from '@/features/insights/components/hub/HubSearch'

export interface HubRowProps { /* exactly the Interfaces block above */ }

type Open = null | 'acts' | 'src' | 'edit'

/**
 * S6 (mezo-d6ivw.6): the ONE row every Tudástár section uses (Rólad, Emberek, Észrevételek,
 * elhallgattatott hatások) — the prototype's `row()`/`acts()` pair. Flat, never glass (§3.4).
 */
export function HubRow(p: HubRowProps) {
  const [open, setOpen] = useState<Open>(null)
  const [draft, setDraft] = useState(p.text)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (p.highlight) ref.current?.scrollIntoView({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount-centring (the T10 idiom)
  }, [])
  const toggle = (next: Exclude<Open, null>) => setOpen((cur) => (cur === next ? null : next))
  const save = () => {
    const t = draft.trim()
    if (t && t !== p.text) p.onEdit?.(t)
    setOpen(null)
  }
  return (
    <div ref={ref} data-row={p.rowKey} className={cn('th-row', p.muted && 'is-muted', p.highlight && 'tud9-hl')}
      style={{ '--c': p.accent } as CSSProperties}>
      <div className="th-rm">
        <Icon3D name={p.icon} size={24} />
        <div className="th-tx">
          {open === 'edit' ? (
            <div className="th-edit">
              <textarea aria-label="A tény szövege" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="b">
                <button type="button" className="th-pill" onClick={() => { setDraft(p.text); setOpen(null) }}>{VERB.cancel}</button>
                <button type="button" className="th-pill main" onClick={save}><Icon3D name="t-tick" size={18} />{VERB.save}</button>
              </div>
            </div>
          ) : (
            <b><Highlight text={p.text} query={p.query ?? ''} /></b>
          )}
          {p.sub && <small>{p.sub}</small>}
          {p.status}
          {p.why && <span className="th-why"><Icon3D name={p.why.icon} size={16} />{p.why.text}</span>}
        </div>
      </div>
      {open !== 'edit' && (
        <div className="th-act">
          {p.source && (
            <button type="button" className="th-link" aria-expanded={open === 'src'} onClick={() => toggle('src')}>
              <Icon3D name="t-source" size={18} />{VERB.source}
            </button>
          )}
          {p.muted && (
            <button type="button" className="th-link" onClick={() => p.onMute(false)}>
              <Icon3D name="t-repeat" size={18} />{VERB.unmute}
            </button>
          )}
          <button type="button" className="th-more" aria-label={VERB.more} aria-expanded={open === 'acts'} onClick={() => toggle('acts')}>⋯</button>
        </div>
      )}
      {open === 'acts' && (
        <div className="th-strip">
          {p.canEdit && p.onEdit && (
            <button type="button" className="th-pill" onClick={() => { setDraft(p.text); setOpen('edit') }}>
              <Icon3D name="t-pencil" size={18} />{VERB.edit}
            </button>
          )}
          {!p.muted && p.canMute !== false && (
            <button type="button" className="th-pill" onClick={() => { setOpen(null); p.onMute(true) }}>
              <Icon3D name="t-mute" size={18} />{VERB.mute}
            </button>
          )}
          <button type="button" className="th-pill warn" onClick={() => { setOpen(null); p.onForget() }}>
            <Icon3D name="t-eraser" size={18} />{VERB.forget}
          </button>
          <span className="th-strip-n">{stripNote(p.muted ? 'muted' : 'active')}</span>
        </div>
      )}
      {open === 'src' && p.source?.()}
      {p.after}
    </div>
  )
}
```

(Write out the `HubRowProps` interface in full in the file — the block above lists it.)

- [ ] **Step 4: Port the CSS**

Copy the prototype's hub rules — `docs/design_2.0/prototypes/uveg-tudastar-hub.html` lines 1737-1989 (`.th-dh` … `.th-undo`, `.th-eff`, `.th-drift`, `.th-chips`, `.th-tiles`, `.th-hero`, `.th-split`, `.th-links`, `.th-lk`, `.th-prow`, `.th-mono`, `.th-pg`, `.th-empty`, `.th-foot`, `.th-lead`, `.th-fn`, `.th-sec`, `.th-search`, `.th-fold`, `.th-list`, `.th-row`, `.th-act`, `.th-strip`, `.th-pill`, `.th-src`, `.th-edit`, `.th-why`, `.th-st`, `.th-tag`) into `styles/prototype.css` as ONE new block headed:

```css
/* ── S6 · Tudástár hub (mezo-d6ivw.6) — ported from prototypes/uveg-tudastar-hub.html, scoped to
   the .tud9 page root. Ranking (§3.4): tiles, the hero halo and one card per effect subject are the
   only glass; rows, folds, lists and the drift pair are flat. Tokens: --lav→--dv-lav,
   --gold→--dv-amber, --sky→--dv-sky, --rose→--dv-rose, --sage→--dv-sage, --coral→--dv-coral,
   --sub→--text-secondary, --faint→--text-muted, --hair→--divider. */
```

Rules while porting: prefix every selector with `.tud9 ` (the undo bar is rendered inside `.tud9` too); swap the prototype tokens per the header comment (never raw hex — `mozaikCssTokens.test.ts` / `prototypeCssStructure.test.ts` must stay green); drop the prototype-only chrome (`.topbar`, `.aurora`, `#scroll`, `.phone`, `.notes`, `#jump`); keep `.th-undo` `position: fixed` with `bottom: calc(var(--tabbar-h, 84px) + 12px)` so it floats above the dock; the `.bar2 b` drain is a `@keyframes th-drain { from { width: 100% } to { width: 0 } }` animation (`animation: th-drain linear forwards`), and under `@media (prefers-reduced-motion: reduce)` it becomes `animation-timing-function: steps(5, end)`; extend the existing `.ppl-detail .ppl-eff*` selectors (prototype.css ~L24667-24678) with `, .tud9 .ppl-eff*` twins so the hub's effect cards reuse the person page's indicator styles (`EffectRows`, Task B12). Add a 320 px block: `@media (max-width: 340px) { .tud9 .th-tiles { gap: 8px } .tud9 .th-hero .big { font-size: 54px } .tud9 .th-strip { flex-wrap: wrap } }`.

- [ ] **Step 5: Run to verify they pass**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/components/hub/ src/shared/ui/mozaik/`
Expected: PASS (incl. the CSS structure/token guards).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/components/hub frontend/src/styles/prototype.css
git commit -m "feat(insights): közös Tudástár-sor (Honnan tudom?/Elhallgattatom/Elfelejtem/Javítom) + üveg CSS (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B8: The hub base view + the four-view router

**Files:**
- Create: `frontend/src/features/insights/components/hub/HubTiles.tsx` (+ `HubTiles.test.tsx`)
- Create: `frontend/src/features/insights/logic/hubCounts.ts` (+ `hubCounts.test.ts`)
- Modify: `frontend/src/features/insights/components/KnowledgeBaseView.tsx` (becomes the hub: hero + tiles + quiet links)
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx` (`VIEWS`, eyebrow/title maps, `?person=`, section routing, the page-level `useForgetUndo` + `ForgetUndoBar`)
- Test: `frontend/src/features/insights/pages/KnowledgeListPage.test.tsx` (rewrite the base-view + T10 cases; keep kategoriak/hogyan/profil/degraded/pending/error cases)

**Interfaces:**
- Consumes: B3 hooks, B5 copy, B6 undo.
- Produces: `type KnowledgeView = 'base' | 'tenyek' | 'emberek' | 'eszrevetelek' | 'hatasok' | 'kategoriak' | 'profil' | 'hogyan'`; `?view=emberek&person=<id>` selects the person sub-view; `VIEW_EYEBROW`/`VIEW_TITLE` gain `emberek: 'Tudástár · Emberek' / 'Emberek az életedben'`, `eszrevetelek: 'Tudástár · Észrevételek' / 'Észrevételek'`, `hatasok: 'Tudástár · Hatások' / 'Hatások'`, `tenyek: 'Tudástár · Rólad' / 'Tények rólad'`. The person sub-view's back control returns to `?view=emberek` (not the base). `HubTiles` props:

```ts
interface SectionState { state: 'ok' | 'loading' | 'error' | 'off'; total: number; sub: string; retry?: () => void }
export function HubTiles(p: { facts: SectionState; people: SectionState; observations: SectionState; effects: SectionState; onOpen: (v: 'tenyek' | 'emberek' | 'eszrevetelek' | 'hatasok') => void }): JSX.Element
```

- Counting rule (hero): sum `total` over sections in state `ok`, except Észrevételek counts 0 when Rólad is `ok` (an observation and its fact are counted once); `muted` sum likewise; the note is `heroNote('off')` when the companion switch is off (facts degraded), `heroNote('partial')` when any section is `error`/`loading`, else `heroNote('ok')`.

- [ ] **Step 1: Write the failing tests**

`HubTiles.test.tsx`:

```tsx
it('renders four glass tiles with honest numbers, a dashed tile for an unavailable section', async () => {
  const onOpen = vi.fn()
  render(<HubTiles onOpen={onOpen}
    facts={{ state: 'ok', total: 52, sub: '49 bekapcsolva · 3 elhallgattatva' }}
    people={{ state: 'ok', total: 60, sub: '14 ember · 2 elhallgattatva' }}
    observations={{ state: 'off', total: 0, sub: '' }}
    effects={{ state: 'error', total: 0, sub: '', retry: vi.fn() }} />)
  expect(screen.getByRole('button', { name: /Rólad/ })).toHaveTextContent('52')
  expect(screen.getByText('A társ most nincs bekapcsolva.')).toBeInTheDocument()
  expect(screen.getByText('Most nem sikerült betölteni.')).toBeInTheDocument()
  expect(screen.queryByText('0')).toBeNull() // never an invented zero
  await userEvent.click(screen.getByRole('button', { name: /Emberek/ }))
  expect(onOpen).toHaveBeenCalledWith('emberek')
})
```

`KnowledgeListPage.test.tsx` — replace the base-view cases (a)/(g)/hero and add:

```tsx
test('the base view is the hub: four section tiles, secondary links, no search', () => {
  renderPage()
  for (const name of ['Rólad', 'Emberek', 'Észrevételek', 'Hatások']) {
    expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument()
  }
  expect(screen.getByText('Kategóriák')).toBeInTheDocument()
  expect(screen.getByText('Hogyan tanul?')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByText('dolgot tud rólad Mezo')).toBeInTheDocument()
})

test.each([['tenyek', 'Tények rólad'], ['emberek', 'Emberek az életedben'], ['eszrevetelek', 'Észrevételek'], ['hatasok', 'Hatások']])(
  '?view=%s opens its section', (view, title) => {
    renderPage(`/?view=${view}`)
    expect(screen.getByText(title, { selector: 'strong' })).toBeInTheDocument()
  })

test('?view=emberek&person=<id> opens the person sub-view; back returns to Emberek', async () => {
  const person = personSeed.find((p) => p.facts.length > 0)!
  renderPageWithProbe(`/?view=emberek&person=${person.id}`)
  expect(screen.getByText(person.name, { selector: 'strong' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza: Emberek' }))
  expect(screen.getByTestId('loc-probe').textContent).toBe('?view=emberek')
})
```

Keep the existing T10 `?fact=` tests but point them at the new Rólad rows: the highlighted row carries `.tud9-hl` and `data-row="f:<id>"`, and a highlighted MUTED fact opens the Elhallgattatott fold (replace the old "Kikapcsolva vödör" case). Keep the degraded/pending/error cases, adjusted to the hub's per-section states: companion switch off (`/api/companion/fact` 404) ⇒ the Rólad tile is dashed with `TILE_STATE.offFacts`, Emberek still counts; a 500 on facts ⇒ the Rólad tile shows the retry, other tiles unaffected; unresolved facts ⇒ `TILE_STATE.loading`, never a number.

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/components/hub/HubTiles.test.tsx src/features/insights/pages/KnowledgeListPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `HubTiles`**

```tsx
import type { CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { TILE, TILE_STATE } from '@/features/insights/logic/hubCopy'

export interface SectionState { state: 'ok' | 'loading' | 'error' | 'off'; total: number; sub: string; retry?: () => void }
type Key = 'tenyek' | 'emberek' | 'eszrevetelek' | 'hatasok'

const SKIN: Record<Key, { title: string; icon: Icon3DName; c: string; offText: string }> = {
  tenyek: { title: TILE.facts, icon: 't-person', c: 'var(--dv-rose)', offText: TILE_STATE.offFacts },
  emberek: { title: TILE.people, icon: 't-people', c: 'var(--dv-lav)', offText: TILE_STATE.off },
  eszrevetelek: { title: TILE.observations, icon: 't-pattern', c: 'var(--dv-amber)', offText: TILE_STATE.off },
  hatasok: { title: TILE.effects, icon: 't-cowave', c: 'var(--dv-sky)', offText: TILE_STATE.off },
}

export function HubTiles(p: { facts: SectionState; people: SectionState; observations: SectionState; effects: SectionState; onOpen: (v: Key) => void }) {
  const tiles: Array<[Key, SectionState]> = [['tenyek', p.facts], ['emberek', p.people], ['eszrevetelek', p.observations], ['hatasok', p.effects]]
  return (
    <div className="th-tiles">
      {tiles.map(([key, s], i) => {
        const skin = SKIN[key]
        const style = { '--c': skin.c, '--i': i + 1 } as CSSProperties
        if (s.state === 'ok') {
          return (
            <button key={key} type="button" className="th-tile glass lift rise" style={style} onClick={() => p.onOpen(key)}>
              <span className="top"><Icon3D name={skin.icon} size={34} /><b>{s.total}</b></span>
              <strong>{skin.title}</strong><small>{s.sub}</small>
            </button>
          )
        }
        const text = s.state === 'off' ? skin.offText : s.state === 'error' ? TILE_STATE.error : TILE_STATE.loading
        return (
          <div key={key} className="th-tile is-dash rise" style={style}>
            <span className="top"><Icon3D name={skin.icon} size={34} /><b aria-hidden="true">—</b></span>
            <strong>{skin.title}</strong><small>{text}</small>
            {s.state === 'error' && s.retry && <button type="button" className="retry" onClick={s.retry}>{TILE_STATE.retry}</button>}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Implement the base view + router**

`KnowledgeBaseView.tsx` is rewritten to compose: the hero (`th-hero` with the `t-brain` art icon, the count-up number `useCountUp(counts.total)`, `HERO.title`, `HERO.sub`, the `th-split` pair `counts.total - counts.muted` `HERO.on` / `counts.muted` `HERO.off`), `counts.note` as a `th-fn` line, `<HubTiles {...counts.sections} onOpen={onNavigate} />`, and `th-links`: the pending pointer (`LINKS.pending(n)` / `LINKS.pendingSub` → `/mezo/rolad`, `t-bell`, only when `pendingCount > 0`), `Kategóriák` (`t-graph` → `onNavigate('kategoriak')`), `Hogyan tanul?` (`t-info` → `onNavigate('hogyan')`). While every section is still loading, the hero shows `TILE_STATE.loading` instead of a number (never a fabricated 0). Props become:

```ts
export function KnowledgeBaseView(props: {
  pendingCount: number
  counts: ReturnType<typeof hubCounts>
  onNavigate: (view: 'tenyek' | 'emberek' | 'eszrevetelek' | 'hatasok' | 'kategoriak' | 'hogyan') => void
})
```

`KnowledgeListPage.tsx`:
- `VIEWS = new Set(['tenyek', 'emberek', 'eszrevetelek', 'hatasok', 'kategoriak', 'profil', 'hogyan'])`; add the eyebrow/title entries listed in Interfaces; `TudasFrame` gains an optional `backTo?: { label: string; params: Record<string, string> }` used by the person sub-view (`{ label: 'Emberek', params: { view: 'emberek' } }`) and a `title` override (the person's name).
- Load all four sources at the page top (hooks stay ABOVE every early return): `useKnowledge()`, `usePeople()`, `useKnowledgeObservations()`, `useEffectSubjects()`, plus `useForgetUndo()`; compute the four `SectionState`s with the pure helper in `logic/hubCounts.ts` (below, + `hubCounts.test.ts`) — keep the page thin.
- Remove the page-wide `isPending`/`isError` early returns for the hub: each section owns its state now (the kategoriak/hogyan/profil branches are unchanged). Remove the `hero big/sub` for `base` (the hero lives in the body now).
- Section branches: `tenyek` → `<TenyekSection …/>` (B9), `emberek` → `<EmberekSection …/>` (B10), `eszrevetelek` → `<EszrevetelekSection …/>` (B11), `hatasok` → `<HatasokSection …/>` (B12); each inside `TudasFrame` + `EntranceGroup className="tud9-flow"` with `replayKey={view + (person ?? '')}`. Until B9-B12 land, render `null` for those branches (the tests for them come with their tasks).
- Render `<ForgetUndoBar pending={undo.pending} onUndo={undo.undo} />` once, inside the page root, on every view.
- `?fact=` keeps its T10 behaviour (`highlightFactId` state + the one-shot URL rewrite to `?view=tenyek`), passed to `TenyekSection`.
- `MezoHubPage.tsx:98` keeps using `bucketFacts` (post-.8 signature) — untouched.

`logic/hubCounts.ts`:

```ts
import type { EffectSubject, KnowledgeFact, PersonEntry } from '@/data/types'
import type { KnowledgeObservation } from '@/data/insights/knowledgeHubApi'
import { heroNote, tileSub } from '@/features/insights/logic/hubCopy'

export interface Loadable<T> { items: T; degraded: boolean; isPending: boolean; isError: boolean; refetch: () => void }
export interface SectionCount { state: 'ok' | 'loading' | 'error' | 'off'; total: number; muted: number; sub: string; retry?: () => void }

function state(l: { degraded: boolean; isPending: boolean; isError: boolean }): SectionCount['state'] {
  return l.isPending ? 'loading' : l.isError ? 'error' : l.degraded ? 'off' : 'ok'
}

export function hubCounts(facts: Loadable<KnowledgeFact[]>, people: Loadable<PersonEntry[]>,
                          obs: Loadable<KnowledgeObservation[]>, effects: Loadable<EffectSubject[]>) {
  const f = facts.items, pf = people.items.flatMap((p) => p.facts), o = obs.items, e = effects.items
  const fMuted = f.filter((x) => !x.active).length
  const pMuted = pf.filter((x) => !x.includeInPrompt).length
  const oSup = o.filter((x) => x.factMutedReason === 'superseded').length
  const oMuted = o.filter((x) => x.factMutedReason && x.factMutedReason !== 'superseded').length
  const eMuted = e.filter((x) => x.muted).length
  const sections = {
    facts: { state: state(facts), total: f.length, muted: fMuted, sub: tileSub.facts(f.length - fMuted, fMuted), retry: facts.refetch },
    people: { state: state(people), total: pf.length, muted: pMuted, sub: tileSub.people(people.items.filter((p) => p.facts.length).length, pMuted), retry: people.refetch },
    observations: { state: state(obs), total: o.length, muted: oMuted + oSup, sub: tileSub.observations(o.length - oMuted - oSup, oSup, oMuted), retry: obs.refetch },
    effects: { state: state(effects), total: e.length, muted: eMuted, sub: tileSub.effects(e.filter((x) => x.kind === 'person' && !x.muted).length, e.filter((x) => x.kind === 'event' && !x.muted).length, eMuted), retry: effects.refetch },
  } satisfies Record<string, SectionCount>
  // An observation and the fact learned from it are ONE thing — counted once (via the fact).
  const counted = (['facts', 'people', 'observations', 'effects'] as const)
    .filter((k) => sections[k].state === 'ok' && !(k === 'observations' && sections.facts.state === 'ok'))
  const total = counted.reduce((n, k) => n + sections[k].total, 0)
  const muted = counted.reduce((n, k) => n + sections[k].muted, 0)
  const note = sections.facts.state === 'off' ? heroNote('off')
    : Object.values(sections).some((s) => s.state === 'loading' || s.state === 'error') ? heroNote('partial')
    : heroNote('ok')
  return { sections, total, muted, note }
}
```

`hubCounts.test.ts` (one `it` each): with all four `ok`, `total` = facts + people facts + effect subjects (observations excluded) and `muted` likewise; with facts `off` the observations are counted and the note is `heroNote('off')`; with effects `error` the effect section is excluded and the note is `heroNote('partial')`; `sections.observations.sub` for the mock seeds reads `tileSub.observations(igaz, 1, elh)`.

- [ ] **Step 5: Run to verify they pass (both modes)**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/ && CI=true VITE_USE_MOCK=false pnpm vitest run src/features/insights/`
Expected: PASS (section-view tests for B9-B12 are added in those tasks).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights
git commit -m "feat(insights): Tudástár hub — négy szakasz-csempe őszinte számokkal, nézet-router (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B9: Rólad section (`?view=tenyek`) — topics, search, Elhallgattatott, dossier door

**Files:**
- Create: `frontend/src/features/insights/components/hub/TenyekSection.tsx` (+ `TenyekSection.test.tsx`)
- Delete: `frontend/src/features/insights/components/FactsView.tsx`, `KnowledgeFactRow.tsx`, `KnowledgeFactRow.test.tsx` (grep first: `grep -rn "FactsView\|KnowledgeFactRow" frontend/src` must show only these files and the page)
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx` (render it)

**Interfaces:**
- Consumes: `KnowledgeFact[]` (with B2 fields), `useKnowledgeHubActions`, `useFactEvidence`, `HubRow`/`HubFold`/`HubSearch`/`NoHits`, `hubCopy`, `humanizeFactText` + `sortFacts` from `factCopy`, `FACT_CATEGORIES`, `useForgetUndo().start/isHidden` (passed down as props `forget` and `isHidden`), `useToast`.
- Produces: `TenyekSection({ facts, degraded, isPending, isError, refetch, highlightFactId, forget, isHidden })`.
- Layout (prototype `tenyek()`): lead `lead.facts(total, topicCount, on, muted)`; search; `FACTS_NOTE` when no query; one `HubFold` per live category (`FACT_CATEGORIES` order, icon/accent from the U9 `CATEGORY_SKIN` map — move that map from the deleted `KnowledgeFactRow.tsx` into this file), count = `groupCount`, hint `onHint(activeInGroup)`; active facts sorted by `sortFacts`; a `MUTED_GROUP` fold (icon `t-mute`, hint `MUTED_HINT.facts`) holding every muted fact with `why = whyText(mutedReason ?? 'user', mutedAt)`, icon `WHY_ICON[...]`; the "A csapatról" section with the dossier door (`LINKS.dossier` / `LINKS.dossierSub` → `/mezo/karakter`, `t-council`). Folds start closed; while a query is active every fold with hits is open (the prototype's `S.gq` rule: a user may still close one during the search). A `?fact=` target opens its fold and passes `highlight` to its row.
- Row wiring: `sub = [reinforced(n), tag, muted ? category label : '']` where `tag` for `source === 'pattern'` with a `patternId` is a `th-tag` button "észrevételből" (`t-pattern`) that navigates to `?view=eszrevetelek&obs=<patternId>`, else `CHIP[source]`; `source={() => <FactSource fact={f} />}` where `FactSource` renders `SOURCE_EYEBROW`, `ORIGIN[source]` (manual: `ORIGIN.manual` only) and `<EvidenceList evidence={evidence.slice(0, 5)} today={todayIso} />` from `useFactEvidence(f.id)`, `EVIDENCE_UNAVAILABLE` when `unavailable`, and for pattern facts the `GO_TO_OBSERVATION` link; `onMute(on)` → `muteFact(id, on)` + toast `TOAST.muted|unmuted`; `onEdit(text)` → `editFact` + toast `TOAST.edited`; `onForget()` → `forget({ key: 'f:'+id, label: humanizeFactText(text), computed: false, commit: () => forgetFact(id) })`; rows whose key `isHidden` are filtered out.

- [ ] **Step 1: Write the failing tests** (`TenyekSection.test.tsx`, rendered through `KnowledgeListPage` at `/?view=tenyek` with `QueryWrapper`, both modes)

```tsx
test('groups facts by topic (collapsed) and lists muted ones under Elhallgattatott with their reason', async () => {
  renderPage('/?view=tenyek')
  expect(screen.getByRole('button', { name: /Étkezés ·/ })).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(screen.getByRole('button', { name: /Elhallgattatott ·/ }))
  expect(screen.getByText(/te hallgattattad el/)).toBeInTheDocument() // mock f9
})

test('search opens every fold with hits and highlights the match', async () => {
  renderPage('/?view=tenyek')
  await userEvent.type(screen.getByRole('textbox', { name: 'Keresés a tények között…' }), 'KIFLI')
  expect(screen.getByText('kifli', { selector: 'mark' })).toBeInTheDocument() // f9 is muted
  expect(screen.getByRole('button', { name: /Elhallgattatott ·/ })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('button', { name: /Elhallgattatott ·/ })).toHaveTextContent('1 találat')
})

describe('Elfelejtem', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
  afterEach(() => { vi.useRealTimers() })

  const openStrip = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /Étkezés ·/ }))
    const row = document.querySelector('[data-row="f:f10"]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'További műveletek' }))
    await user.click(within(row).getByRole('button', { name: /Elfelejtem/ }))
  }

  test('hides the row at once and sends exactly one DELETE, only after 5 s', async () => {
    let deletes = 0
    server.use(http.delete(`${API_BASE}/api/companion/fact/:id`, () => { deletes++; return new HttpResponse(null, { status: 204 }) }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage('/?view=tenyek')
    await openStrip(user)
    expect(document.querySelector('[data-row="f:f10"]')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Elfelejtettem: „MyProtein supplement supplier”')
    await act(() => vi.advanceTimersByTimeAsync(4900))
    expect(deletes).toBe(0)
    await act(() => vi.advanceTimersByTimeAsync(200))
    if (!isMockMode()) await waitFor(() => expect(deletes).toBe(1))
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    if (!isMockMode()) expect(deletes).toBe(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  test('Visszavonom inside the window brings the row back and sends nothing', async () => {
    let deletes = 0
    server.use(http.delete(`${API_BASE}/api/companion/fact/:id`, () => { deletes++; return new HttpResponse(null, { status: 204 }) }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage('/?view=tenyek')
    await openStrip(user)
    await user.click(screen.getByRole('button', { name: /Visszavonom/ }))
    expect(document.querySelector('[data-row="f:f10"]')).not.toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(deletes).toBe(0)
  })
})

test('the dossier door links to the character dossier', () => {
  renderPage('/?view=tenyek')
  expect(screen.getByRole('link', { name: /A csapat véleménye rólad/ })).toHaveAttribute('href', '/mezo/karakter')
})

test('a pattern-sourced fact carries the "észrevételből" tag that opens the observation', async () => {
  renderPageWithProbe('/?view=tenyek')
  await userEvent.click(screen.getByRole('button', { name: /Étkezés ·/ }))
  await userEvent.click(screen.getByRole('button', { name: /észrevételből/ }))
  expect(screen.getByTestId('loc-probe').textContent).toContain('view=eszrevetelek')
})
```

(Imports for this file: `render, screen, within, act, waitFor` from `@testing-library/react`, `userEvent`, `http, HttpResponse` from `msw`, `server`, `API_BASE`, `isMockMode`, `vi, beforeEach, afterEach`, plus the `renderPage`/`renderPageWithProbe` helpers copied from `KnowledgeListPage.test.tsx`. In mock mode the DELETE counter stays 0 by design — the mock path patches the cache — so the count assertions are real-mode-only while the row/undo assertions run in both.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/components/hub/TenyekSection.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `TenyekSection.tsx`** following the Interfaces block (state: `query`, `openGroups: Record<string, boolean>`, `closedWhileSearching: Record<string, boolean>`; derive `active = facts.filter(f => f.active && !isHidden('f:'+f.id))`, `muted = facts.filter(f => !f.active && !isHidden(...))`, groups via `FACT_CATEGORIES.map(([cat]) => …)` filtered by `matches(humanizeFactText(f.text) + ' ' + (f.patternTitle ?? ''), query)`; `NoHits` when a query yields nothing anywhere). Degraded → the `DEGRADED.facts` dashed card (`tf-dash tud9-dash`, `t-info`); `isPending` → `<GhostState message={DEGRADED.loading} />`; `isError` → `<GhostState message={DEGRADED.error} ctaLabel="Újra" onCta={refetch} />`; no facts → `EMPTY.facts`.

- [ ] **Step 4: Delete the retired components** and remove their imports; `grep -rn "FactsView\|KnowledgeFactRow" frontend/src` → no hits.

- [ ] **Step 5: Run to verify it passes (both modes)**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/ && CI=true VITE_USE_MOCK=false pnpm vitest run src/features/insights/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/features/insights
git commit -m "feat(insights): Rólad szakasz — témák, kereső, Elhallgattatott okkal, négy ige, dosszié-ajtó (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B10: Emberek section (`?view=emberek`, `&person=<id>`)

**Files:**
- Create: `frontend/src/features/insights/components/hub/EmberekSection.tsx` (+ `EmberekSection.test.tsx`)
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx`

**Interfaces:**
- Consumes: `usePeople()` (`people`, `isPending`, `isError`, `refetch`, `toggleFact`, `undoFact`, `editFact`), `byNameHu`, `matches`, `HubRow`, `hubCopy` (`lead.people`, `SEARCH`, `personRowSub`, `personHead`, `PERSON_PAGE_LINK`, `FOOT.people`, `EMPTY.personNone`, `MUTED_GROUP`, `personFactSub`, `personFactOrigin`, `whyText`).
- Produces: `EmberekSection({ personId, onOpenPerson, forget, isHidden })`.
- List view (prototype `emberek()`): lead; search over name, `relationshipHu` AND fact texts; one `th-prow` per person that has at least one fact, **alphabetical** (`byNameHu`), mono initial with the person's accent, `personRowSub(on, muted)` (or `${hits} találat` while searching fact texts); click → `onOpenPerson(id)` (→ `?view=emberek&person=<id>`); footer `FOOT.people`.
- Person view (prototype `person()`): `th-pg` head (mono, `relationshipHu`, `personHead(on, muted)`, `PERSON_PAGE_LINK` → `/me/people/<id>`); search `SEARCH.person(name)`; active facts as `HubRow`s (icon per kind: preference `t-thumb-up`, relationship_state `t-person`, shared_activity `t-link`, important_date `t-calendar`, sensitivity `t-shield`; `sub = personFactSub(FACT_KIND_LABEL[kind], f)` — move `FACT_KIND_LABEL` out of `PersonDetailPage.tsx` into `features/me/logic/effectCopy.ts`'s sibling `features/me/logic/personFactCopy.ts` and import it from both; `canEdit`; `source = () => <p className="o">{personFactOrigin(f.sourceKind)}</p>` inside a `th-src` box (no evidence items — plan decision 9)); muted facts under a `MUTED_GROUP` fold with `why = { text: whyText('user', null), icon: 't-mute' }`; `EMPTY.personNone` when nothing is on. Verbs: mute → `toggleFact(pid, id, !on)`; edit → `editFact`; forget → `forget({ key: 'p:'+id, label: text, computed: false, commit: () => undoFact(pid, id) })` (the existing DELETE is already the veto).

- [ ] **Step 1: Write the failing tests** — mock mode seeds via `personSeed` (`data/me/people.ts`): alphabetical order of `th-prow` names equals `[...names].sort(byNameHu)`; a fact-text search shows "N találat" on the matching person; opening a person shows its facts; Javítom on a person fact calls PATCH with `factText` (real mode `server.use` capture) / updates the cache (mock); Elfelejtem sends the existing `DELETE /api/people/:pid/facts/:fid` only after 5 s.

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/components/hub/EmberekSection.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** per the Interfaces block; honest states: `isPending` → `GhostState(DEGRADED.loading)`, `isError` → retry `GhostState`, no person with facts → `EMPTY.people`. (People are ungated by the companion switch — no degraded branch.)

- [ ] **Step 4: Run to verify it passes (both modes)**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/ src/features/me/ && CI=true VITE_USE_MOCK=false pnpm vitest run src/features/insights/ src/features/me/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights frontend/src/features/me
git commit -m "feat(insights): Emberek szakasz — névsor, kereső, emberenkénti tények a négy igével (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B11: Észrevételek section (`?view=eszrevetelek`)

**Files:**
- Create: `frontend/src/features/insights/components/hub/EszrevetelekSection.tsx` (+ `EszrevetelekSection.test.tsx`)
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx` (`&obs=<patternId>` deep link: open its topic, `arrive` highlight, filter reset to Mind)

**Interfaces:**
- Consumes: `useKnowledgeObservations()`, `useKnowledgeHubActions().muteFact/forgetObservation`, `topicOf`/`groupBy`/`OBS_TOPICS`/`TOPIC_ICON`, `obsStatus`, `OBS_FILTERS`, `DRIFT_EYEBROW`, `OBS_ORIGIN`, `EvidenceList`.
- Produces: `EszrevetelekSection({ highlightPatternId, forget, isHidden })`.
- State per item: `igaz` (fact active or no fact), `felul` (`factMutedReason === 'superseded'`), `elh` (refuted/user). Chips `OBS_FILTERS` with counts (`Mind` = all live items). In `Mind` the OLDER half of a drift pair (it has `replacedByPatternId` whose target is in the list) is rendered INSIDE its newer row as the `th-drift` block (not as its own row); other filters list every matching item flat within topics.
- Row: icon `TOPIC_ICON[topicOf(o)]`, accent `var(--dv-amber)`, `sub = confirmedOn(confirmedAt)`, `status = <span className="th-st" data-tone={tone}><i/>{text}</span>`, `muted = !!factMutedReason`, `canEdit = false`, `canMute = !!factId` (mute acts on the linked fact: `muteFact(factId, on)`), `source = () => <th-src with OBS_ORIGIN + EvidenceList(o.evidence.slice(0, 5))>`, forget → `forget({ key: 'o:'+patternId, label: title, computed: true, commit: () => forgetObservation(patternId) })`; the drift block has its own mute/forget acts on the older item (the prototype's inner `acts(k2, …)`), and when the old fact is re-enabled its eyebrow is `DRIFT_EYEBROW.bothOn` + `bothOnLine`. Footer `FOOT.observations`.

- [ ] **Step 1: Write the failing tests** — against `MOCK_OBSERVATIONS`: topic folds exist for the seeded topics; the `Felülírva` chip count is 1 and shows the superseded status line; in `Mind` the drift pair renders as ONE row with the inner `th-drift` block (`KORÁBBAN · MEGERŐSÍTVE …`); a row never rechecked says `még nem ellenőriztem újra`; Elhallgattatom on an observation PATCHes its FACT (`/api/companion/fact/<factId>` with `includeInPrompt: false`) in real mode; Elfelejtem sends `DELETE /api/companion/observation/<id>` only after 5 s and the undo bar says `többé nem mutatom és nem használom`; the `Javítom` pill never appears here.

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/components/hub/EszrevetelekSection.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** per the Interfaces block. Honest states: `degraded` → `DEGRADED.section`; `isPending` → loading; `isError` → retry; empty → `EMPTY.observations`; a filter with no items → `EMPTY.obsState`.

- [ ] **Step 4: Run to verify it passes (both modes)**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/ && CI=true VITE_USE_MOCK=false pnpm vitest run src/features/insights/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights
git commit -m "feat(insights): Észrevételek szakasz — témák, állapot-chipek, drift-pár, ellenőrzés-nyom (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B12: Hatások section (`?view=hatasok`) + person page hides muted effects

**Files:**
- Create: `frontend/src/features/me/components/EffectRows.tsx` (+ `EffectRows.test.tsx`) — the `.ppl-effrow` block + `EffectDots`, extracted from `PersonDetailPage.tsx:230-249`
- Create: `frontend/src/features/insights/components/hub/HatasokSection.tsx` (+ `HatasokSection.test.tsx`)
- Modify: `frontend/src/features/me/pages/PersonDetailPage.tsx` (use `EffectRows`; filter muted)
- Modify: `frontend/src/data/me/personEffectsApi.ts` + `personEffectsHooks.ts` (the person hook now drops rows with `muted: true` — "nem mutatom és nem használom")

**Interfaces:**
- Produces: `EffectRows({ effects: PersonEffect[]; sentence: (e: PersonEffect) => string })` rendering `ppl-effrow`/`ppl-effsent`/`ppl-effmeta`/`ppl-effsig`/`ppl-effdots` + `ppl-efffoot` ("Együttjárás, nem ok-okozat."); `HatasokSection({ forget, isHidden })`.
- Layout (prototype `hatasok()`): lead `lead.effects`; search over subject labels; `HubFold` "Emberek" (hint `ábécérendben`, `t-people`) with one `th-eff glass` card per unmuted person subject sorted `byNameHu`; `HubFold` "Események" (hint `erősség szerint`, `t-calendar`) with event subjects sorted by their strongest `|meanDiff|`-independent strength (the server's order: max strength band, then subject days); `MUTED_GROUP` fold (hint `MUTED_HINT.effects`) with a flat `HubRow` per muted subject (`source` omitted, `sub = effectSubjectKindLabel(kind, effects.length)`, `why = { text: whyText('user', null), icon: 't-mute' }`, Visszakapcsolom → `muteEffect(kind, key, false)`). Card: head with mono initial (person) or `EVENT_ICON[key]` well (event), label, `⋯` strip with Elhallgattatom / Elfelejtem + `stripNote('effect')`; body `<EffectRows effects sentence={kind === 'person' ? (e) => personEffectSentence(label, e) : (e) => eventEffectSentence(key, e)} />`. Forget → `forget({ key: 'e:'+kind+':'+key, label: `${label} — hatás`, computed: true, commit: () => forgetEffect(kind, key) })`. Footer `FOOT.effects`. One glass card per subject; nothing inside the card is glass.

- [ ] **Step 1: Write the failing tests** — `EffectRows` renders the S4 sentence and both dot rows (move the matching assertions out of `PersonDetailPage.test.tsx`, keep one there proving it still renders); `HatasokSection` against `MOCK_EFFECT_SUBJECTS`: person cards alphabetical, events present, the muted subject sits only under Elhallgattatott, Elhallgattatom calls `PUT …/mute {mode:'muted'}` immediately (real mode), Elfelejtem calls `PUT …/mute {mode:'forgotten'}` only after 5 s, the non-causal footnote is always visible; `PersonDetailPage` hides an effect whose subject is muted (MSW row with `muted: true`).

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm vitest run src/features/insights/components/hub/HatasokSection.test.tsx src/features/me/components/EffectRows.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** per the Interfaces block. `toPersonEffect` stays; add `muted: boolean` to the wire→domain path only where needed (`usePersonEffects` real fetch: `res.effects.filter((e) => !e.muted).map(toPersonEffect)`). Honest states: `degraded` → `DEGRADED.section`, `isPending` → loading, `isError` → retry (the prototype's `hub==='err'` state), empty → `EMPTY.effects`.

- [ ] **Step 4: Run to verify it passes (both modes)**

Run: `cd frontend && CI=true pnpm vitest run src/features/ src/data/ && CI=true VITE_USE_MOCK=false pnpm vitest run src/features/ src/data/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features frontend/src/data
git commit -m "feat(insights): Hatások szakasz — alanyonként egy kártya, két jelzés, elhallgattatás/felejtés (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B13: Layout invariants at 320 px

**Files:**
- Create: `frontend/tests/layout/tudastar-hub.spec.ts`

**Interfaces:**
- Consumes: the mock-mode app (`pnpm test:layout` serves it), `seedKalauzSeen`, `seedSplashSkipped`.

- [ ] **Step 1: Write the spec** (the `NAPOM_ROUTES` idiom from `layout.spec.ts:628-679`)

```ts
import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

const HUB_ROUTES: Array<[string, string, string]> = [
  ['hub', '/mezo/knowledge', '.th-tile'],
  ['Rólad', '/mezo/knowledge?view=tenyek', '.th-fold, .th-row'],
  ['Emberek', '/mezo/knowledge?view=emberek', '.th-prow'],
  ['Észrevételek', '/mezo/knowledge?view=eszrevetelek', '.th-fold, .th-row'],
  ['Hatások', '/mezo/knowledge?view=hatasok', '.th-fold, .th-eff'],
]

for (const [name, path, rows] of HUB_ROUTES) {
  test(`Tudástár · ${name} stays contained and its last row clears the tab bar @ 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 })
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const last = page.locator(rows).last()
    await last.scrollIntoViewIfNeeded()
    await last.evaluate((element) => {
      const scroller = document.querySelector('.screen-content') as HTMLElement
      const tabbar = document.querySelector('.tab-bar')?.getBoundingClientRect()
      if (!tabbar) return
      const overlap = element.getBoundingClientRect().bottom - tabbar.top
      scroller.style.scrollBehavior = 'auto'
      if (overlap > 0) scroller.scrollTop += overlap + 4
    })
    await expect(last).toBeVisible()
  })
}

test('Tudástár · the ⋯ strip wraps inside the row at 320px (no horizontal scroll)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('/mezo/knowledge?view=tenyek')
  await page.getByRole('button', { name: /Étkezés ·/ }).click()
  await page.getByRole('button', { name: 'További műveletek' }).first().click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('Tudástár · the undo bar floats above the tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('/mezo/knowledge?view=tenyek')
  await page.getByRole('button', { name: /Étkezés ·/ }).click()
  await page.getByRole('button', { name: 'További műveletek' }).first().click()
  await page.getByRole('button', { name: /Elfelejtem/ }).click()
  const bar = await page.locator('.th-undo').boundingBox()
  const tab = await page.locator('.tab-bar').boundingBox()
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(tab!.y)
})
```

- [ ] **Step 2: Run it**

Run: `cd frontend && pnpm test:layout -- tests/layout/tudastar-hub.spec.ts`
Expected: PASS (fix CSS in `prototype.css`'s S6 block for any failure — never loosen the assertion).

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/layout/tudastar-hub.spec.ts frontend/src/styles/prototype.css
git commit -m "test(layout): Tudástár hub 320 px-en — nincs vízszintes görgetés, a sáv a dock fölött (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
# Part C — gates, docs, runtime verify, merge

### Task C1: Full local gates

**Files:** none new (fixes land where a gate points).

- [ ] **Step 1: Backend — focused slice + ArchUnit + lint**

Run:
```bash
node scripts/lint-liquibase.mjs
cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**,io.mrkuhne.mezo.feature.people.**,io.mrkuhne.mezo.feature.proactive.**,io.mrkuhne.mezo.feature.character.**,ArchitectureTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```
Expected: PASS. Because the schema changed (a new `pattern` status, two tables) and a startup runner was added, also run the full suite once on this machine: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -DreuseForks=false -DargLine="-Xmx1500m"` → PASS.

- [ ] **Step 2: Contract drift**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd .. && git status --porcelain api/openapi.yml frontend/src/data/_client/api.gen.ts`
Expected: no output.

- [ ] **Step 3: Frontend — both modes + build**

Run:
```bash
cd frontend && CI=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build
```
Expected: PASS, build clean.

- [ ] **Step 4: Layout specs**

Run: `cd frontend && pnpm test:layout`
Expected: PASS (the whole layout suite — the S6 CSS block is global to `.tud9`, so `KnowledgeNodePage` and the rest must stay green too).

- [ ] **Step 5: Codemap**

Run: `node scripts/gen-codemap.mjs && git status --porcelain docs/CODEMAP.md`
If changed: `git add docs/CODEMAP.md && git commit -m "docs(codemap): S6 frontend hub (mezo-d6ivw.6)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.

---

### Task C2: Feature docs + spec slice lessons + follow-up beads

**Files:**
- Modify: `docs/features/insights.md` (Tudástár = the four-section hub; `?view=` values incl. `&person=` / `&obs=`; the verb contract; the undo window; key_files: `components/hub/*`, `logic/hubCopy.ts`, `logic/hubSearch.ts`, `logic/hubTopics.ts`, `logic/hubCounts.ts`, `hooks/useForgetUndo.ts`, `data/insights/knowledgeHub*.ts`; retire `FactsView`/`KnowledgeFactRow`)
- Modify: `docs/features/companion.md` (forget = soft delete + `memory_forget_veto`; which writers check it and which deliberately do not; `muted_reason`; drift supersession; `rechecked_at`; `pattern.status = forgotten` and every reader that filters it; `KnowledgeBackfillRunner`; `effect_mute` and the three prompt readers; the four new endpoints + the changed `/effects`)
- Modify: `docs/features/me.md` (person fact `sourceRefId`, PATCH `factText`, person page hides muted effects, `effectCopy.ts`/`EffectRows.tsx` shared with the hub)
- Modify: `docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md` (append S6 lessons to "## Slice lessons", numbered from 30)

- [ ] **Step 1: Load the knowledge-base skill and follow its feature-doc conventions**

Invoke the `knowledge-base` skill; update the three docs in its 10-section format (touch only the sections the change affects; refresh `key_files` and the "last verified" stamp).

- [ ] **Step 2: Lint docs**

Run: `node scripts/lint-docs.mjs`
Expected: PASS.

- [ ] **Step 3: Append slice lessons** (only what a later slice would otherwise pay for again; write the ones that actually happened during execution — the list below is the candidate set to confirm or drop)

```markdown
30. **(S6)** `mapEvidence` renames a record's `source` to its display name ("Check-in"); any FE
    logic keyed on the raw catalogue source (topic grouping, icons by source) must capture the
    wire value BEFORE mapping (`KnowledgeObservation.evidenceSources`).
31. **(S6)** A pattern that must never resurface is NOT soft-deleted: `GroundedHypothesisPublisher`
    only dedupes against LIVE rows, so a deleted row lets the next night mint a fresh one. A
    terminal status (`refuted`, `forgotten`) on a live row is what keeps a topic closed.
32. **(S6)** Adding a pattern status means auditing every user-facing reader (list, feed incl.
    pending release, reply, digest, pair detail) AND `closedHypotheses` — the status column is
    read in ~15 places and only some are status-scoped queries.
33. **(S6)** Undo-by-delay (send the DELETE when the toast expires) needs an explicit unmount
    policy: leaving the page commits, a second forget commits the first — otherwise a forget the
    user asked for silently never happens.
```

- [ ] **Step 4: File the follow-up beads** (skip any that already exist — `bd list --status open | grep -i -E 'S6b|claim|kaszkád|cascade'` first)

```bash
bd create "S6b · „ezt ne jegyezd meg” chat-szándék a Tudástár felejtés-igéire" -t task -p 2 -l epic:mezo-emlekezete -d "Spec §S6 delta döntés 1: a beszélgetésből kimondott felejtés ugyanazt a ForgetService-t hívja (mezo-d6ivw.6 után)."
bd create "Karakter-állítások elhallgattatása/felejtése a Tudástárból" -t task -p 3 -l epic:mezo-emlekezete -d "Spec §S6 delta döntés 3: S6-ban csak ajtó a dossziéra; a claim mute/forget külön szelet."
bd create "Forrásrekord törlése → a belőle tanult tények kaszkádja" -t task -p 3 -l epic:mezo-emlekezete -d "Spec §S6 non-goal (prior-art lecke, ChatGPT memory): napló/check-in törlésekor a származtatott tények sorsa."
bd create "person_fact elhallgattatás-időbélyeg (muted_at) a Tudástár „miért” sorához" -t task -p 4 -l epic:mezo-emlekezete -d "S6 terv-döntés 13: ma dátum nélkül jelenik meg."
```

- [ ] **Step 5: Refresh the tracker backup and commit**

```bash
node scripts/check-beads-backup.mjs --fix
git add docs/features docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md .beads/issues.jsonl
git commit -m "docs(emlekezet): S6 Tudástár hub — feature docok, szelet-tanulságok, követő beadek (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task C3: Runtime verification (mock-mode PWA, dark, 320 px, reduced motion)

**Files:** none (evidence goes into the controller's report).

- [ ] **Step 1: Load the `verify` skill and follow its build/launch/drive recipe**

Drive, in the in-app browser over `http://localhost:5180` (mock mode), and record what you saw:
1. `/mezo/knowledge` — hero number = facts + person facts + effect subjects; four glass tiles; secondary links; no invented zero while anything loads.
2. `?view=tenyek` — topic folds closed; search "kifli" opens Elhallgattatott and highlights; ⋯ → Javítom edits inline; Elhallgattatom moves the row under Elhallgattatott with "te hallgattattad el · <dátum>"; Visszakapcsolom brings it back; Elfelejtem shows the undo bar above the dock counting 5→0, Visszavonom restores; letting it expire removes the row for good (reload: still gone); Honnan tudom? shows the evidence list; the "észrevételből" tag jumps to the observation.
3. `?view=emberek` — alphabetical, search by a fact word, open a person, edit/mute/forget a fact; "A lapja ›" opens `/me/people/<id>`.
4. `?view=eszrevetelek` — chips with counts; the drift pair renders as one row with the older claim inside; statuses read "legutóbb ellenőrizve … · még igaz" / "felülírta egy újabb észrevétel, …" / "elhallgattatva · később nem igazolódott".
5. `?view=hatasok` — Emberek (ABC) and Események groups; one glass card per subject; two separate dot signals; non-causal footnote; mute/forget per subject.
6. Repeat 1-5 at 320 px width (`resize_window` width 320) — no horizontal scroll, the ⋯ strip wraps, the undo bar clears the dock.
7. Emulate `prefers-reduced-motion: reduce` — no rise/arrive animation, the undo bar drains in steps.
8. `/me/people/<id>` of a person whose effect subject is muted — the Hatás card does not show it.

- [ ] **Step 2: Real-mode smoke (backend on :8090)** — with `VITE_USE_MOCK=false pnpm dev` and the local backend: forget a fact, wait 5 s, then `curl -s -H "Authorization: Bearer <dev token>" localhost:8090/api/companion/fact | jq 'map(.id)'` no longer lists it; mute an effect subject and confirm `GET /api/companion/effects` returns it with `"muted": true`. (Lesson 7: after deploy the first PWA open may still run the precached bundle — accepted knowingly for this single-user app; mention it in the hand-off.)

- [ ] **Step 3: Record findings** — any defect found here is fixed in a new commit on the branch with its own test, then Steps 1-2 are repeated for the affected view.

---

### Task C4: Close out and merge to main (the controller executes this task)

**Files:** none.

- [ ] **Step 1: Close the beads**

```bash
bd close mezo-4rh4r --reason "Folded into S6 (mezo-d6ivw.6): KnowledgeBackfillRunner promotes stuck pre-S2 confirmed plan-less rows once."
bd close mezo-d6ivw.6 --reason "S6 Tudástár hub + forget controls shipped: four sections, provenance, mute/forget/edit, drift supersession, recheck trace, effect mutes."
node scripts/check-beads-backup.mjs --fix
git add .beads/issues.jsonl && git commit -m "chore(beads): S6 lezárva (mezo-d6ivw.6, mezo-4rh4r)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Main must be green before merging**

Run: `gh run list --branch main --limit 1`
Expected: the latest run is `completed success`. If it is red: stop and fix main first (house rule: a red main outranks everything).

- [ ] **Step 3: Rebase, regenerate, re-gate the merge result**

```bash
git fetch origin && git pull --rebase origin main
node scripts/gen-codemap.mjs && git add docs/CODEMAP.md && git diff --cached --quiet || git commit -m "docs(codemap): regenerate after rebase (mezo-d6ivw.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd frontend && CI=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build && cd ..
cd backend && ./mvnw test -Dtest='io.mrkuhne.mezo.feature.companion.**,io.mrkuhne.mezo.feature.people.**,ArchitectureTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g" && cd ..
```
Expected: PASS.

- [ ] **Step 4: No-wait merge from the worktree (detached HEAD — `main` is checked out by the primary repo)**

```bash
git checkout --detach origin/main
git merge --no-ff feat/emlekezet-s6 -m "Merge feat/emlekezet-s6: S6 Tudástár hub + felejtés-vezérlők (mezo-d6ivw.6)"
node scripts/gen-codemap.mjs && git add docs/CODEMAP.md && git diff --cached --quiet || git commit -m "docs(codemap): regenerate on the merge (mezo-d6ivw.6)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin HEAD:main
bd dolt push
git push origin --delete feat/emlekezet-s6 2>/dev/null; git branch -D feat/emlekezet-s6
```

- [ ] **Step 5: Safety net + hand-off**

Run: `gh run list --branch main --limit 1` (do not wait on it; a later red main is fixed before any new work). Hand off: plan path, merged SHA, the lesson-7 PWA note, the follow-up beads filed in C2, and the Hungarian one-screen summary for the owner (CLAUDE.md communication rule).

---

## Self-review (done while writing; kept for the reviewer)

**Spec coverage (§S6 delta → task):** vocabulary/four verbs → B5 (copy) + B7 (row) + B9-B12; forget permanent + undo toast + no restore endpoint → A4, A9, A13 (server) + B6 (window) ; veto store + writers → A1, A4, A5 (plan decision 1); `muted_reason/muted_at` + backfill → A1, A2; `KnowledgeFactResponse` mute + provenance + evidence → A3 + A9 (lazy evidence, decision 5); `UpdateFactRequest.category` enum → A3; drift supersession → A6 (claim) + A7; recheck trace → A6; observations list + mute-via-fact + forget + publisher dedupe → A8, A9 (decisions 2-4); backfill mezo-4rh4r → A10 (decision 8); person_fact `sourceRefId` + PATCH `factText` + four `PersonResponse` paths → A11; effects `personId` optional + `effect_mute` per subject + three readers + mute endpoints → A1, A12, A13; FE base view (four tiles, quiet secondary links, honest states) → B8; Rólad (topics, Elhallgattatott with reasons, "észrevételből" tag, dossier door) → B9; Emberek (ABC, `/me/people/<id>`, `&person=`) → B10; Észrevételek (status line, Honnan tudom?, mute, forget) → B11; Hatások (Emberek ABC / Események by strength, `.effrow/.effdots`, non-causal footnote) → B12; one shared row block + one pure copy module → B5, B7; search + topic groups (scale decision) → B4, B9-B12; facts-always two-state model → B0 gate + B9 (no "in prompt now" marker, no bucket); icons → B1; 320 px + reduced motion → B7 CSS, B13, C3; testing section (unit, ITs, contract, both modes, build, layout, runtime) → every task + C1, C3. Non-goals respected: no chat intent, no claim mute, no cascade, no graph-archive UI, no new LLM call/slug (A6 extends the existing recheck answer only).

**Placeholder scan:** every code step carries real code; where a generated signature must be confirmed (`CompanionApi.forgetFact`, `CompanionEffectsApi` path params) the task names the precedent that decides it (`PeopleController.undoPersonFact`, `getFactsBySource`).

**Type consistency:** `KnowledgeFactEntity.mute/unmute` + `MUTED_*` (A1) used in A2, A7; `PatternEntity.STATUS_FORGOTTEN/isForgotten/recheckedAt` (A1) used in A4, A6, A8, A9; `ForgetService.forgetFact/forgetObservation` (A4/A9) used by `CompanionController`/`CompanionObservationController`; `EffectLinkService.EffectView/effectViews` (A12) used in A13; FE `KnowledgeObservation` (+`evidenceSources`) defined in B2, consumed in B3, B4, B8, B11; `useForgetUndo().start/isHidden/undo/pending` (B6) consumed in B8-B12; `hubCounts` (B8) feeds `KnowledgeBaseView` and `HubTiles`.
