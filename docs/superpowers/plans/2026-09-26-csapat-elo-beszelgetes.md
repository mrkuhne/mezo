# Csapatfal Act III — „A csapat élő beszélgetése" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The proactive advice becomes an all-day team chat: a character speaks when one of the 16 coaching rules turns on (an *ügy* opens) and when it clears (the ügy resolves), in its own guarded voice, with cross-talk on two-area rules, at most 2 pushes a day, entered from a live strip on the Üzenőfal and recapped by the 21:00 evening edition.

**Architecture:** A new `feature/character/service/chat/` layer listens to the companion rule engine (`FlagRaisedEvent` + a new `FlagClearedEvent`), keeps `team_chat_thread` (the ügy) and `team_chat_line` (what was said) rows, reuses proactive's library pick / action ports / feedback rollup, and serves a `GET /api/character/team-chat` endpoint. The FE adds `/mezo/elo` (the room), a live strip on `TeamFeedPage`, and a one-row hand-off on Nap → Beszélgetés; the old daily advice card is switched off behind a flag.

**Tech Stack:** Spring Boot + JPA + Liquibase (Postgres, jsonb), contract-first OpenAPI (`api/feature/*.yml`), JUnit5/AssertJ + Testcontainers ITs, `FakeCompanionLlm` (profile `companion-fake`); React + TS + TanStack Query (`useDualQuery`), vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-csapat-elo-beszelgetes-design.md` (owner-approved 2026-09-26). Prototype: `docs/design_2.0/prototypes/uveg-uzenofal.html` routes `#fal`, `#elo`, `#nap-uzenetek`.

## Global Constraints

- **Speak only on a teendő and its resolution.** Open = `FlagRaisedEvent` (fresh raise past cooldown, `logged`). Resolve = the rule's trace row changes to `clear` while its ügy is open. Nothing else writes a line. `all_healthy` never opens an ügy.
- **One open ügy per `(user, flag_key)`**; an ügy lives across days until `RESOLVED` or `EXPIRED` (7 days open).
- **Push budget:** ≤ 2 pushes per user per local day; the second only if its `flag_key` `AdvicePriority.outranks` (ORDER is keyed by flag key) every ügy already pushed today; resolutions never push. Push = `AppNotificationEmitter.emit(... AppNotificationKind.TEAM_CHAT ...)` (family `intervention`, wake-deferred by `AnchorResolver.feedAnchors`).
- **Safety cap:** ≤ 12 character lines per user per local day (all kinds); beyond it lines are dropped with a `log.warn`.
- **Voice:** one guarded LLM call per event, slug `team_chat` (added to `throttled-features`), prompt starts with marker `CSAPATFAL-ELO-BESZELGETES` (mirrored literally in `FakeCompanionLlm`), guard = `EditionVoiceGuard.check` / `checkGuest`; any failure → template line, `voiced=false`, never throw.
- **Budget:** `mezo.character.team-chat.monthly-usd-cap: 1.00` — the user's `team_chat` LLM spend over the last 30 days; at/over the cap every line is the template.
- **Honesty (ADR 0049):** numbers in a voiced line come only from the event's facts; the template texts are the library `textHu` and the `FlagTraceCopy` sentences.
- **Owner map** (`TeamChatCast`): exactly the spec §5.2 table; every `FlagKey` rule constant mapped; test enforces it.
- **Dependency direction:** `character → proactive → companion`; companion and proactive never import character (ports/events only). ArchUnit layer subpackages: `service`, `entity`, `repository`, `controller`, `domain`, `config`.
- **`@Transactional` on methods only**; self-invocation through the injected proxy (the `TeamEditionService` idiom).
- **Switch:** `FeaturesConfiguration.TEAM_CHAT_SWITCH = "mezo.feature.team-chat.enabled"`; every new bean `@ConditionalOnProperty(name = {CHARACTER_SWITCH, COMPANION_SWITCH, PROACTIVE_SWITCH, INTERVENTION_SWITCH, TEAM_CHAT_SWITCH}, havingValue = "true")` + a `*SwitchOffIT`. The advice-card retirement is a separate key `mezo.proactive.advice-card.enabled` (default `true`; prod flips it to `false` together with team-chat on).
- **Migration:** new file under `backend/src/main/resources/db/changelog/1.1.0/script/`, entry in `1.1.0_master.yml`; never edit a released changeset; jsonb predicates via `jsonb_exists()`, never `?`.
- **Contract-first:** after `api/feature/character/character.yml` changes: `cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`, `cd backend && ./mvnw generate-sources`; commit the `api.gen.ts` diff.
- **Gates per slice:** focused backend `cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.character.**,io.mrkuhne.mezo.feature.companion.flags.**,io.mrkuhne.mezo.feature.proactive.**,io.mrkuhne.mezo.ArchitectureTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"`; FE `CI=true VITE_USE_MOCK=true pnpm --dir frontend test` AND `CI=true VITE_USE_MOCK=false pnpm --dir frontend test` + `pnpm --dir frontend build`; `node scripts/gen-codemap.mjs` (again after every merge); `node scripts/lint-docs.mjs`.
- **Commits:** conventional subject + `(mezo-a9bo7.<slice bead>)` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Merge per slice: `git checkout --detach origin/main && git merge --no-ff <branch> && git push origin HEAD:main`.
- **Copy:** every user-facing string Hungarian, informal (tegező); UI glyphs are sprite icons (`Icon3D`), emoji only inside character sentences.

---

## File Structure

```
backend/src/main/resources/db/changelog/1.1.0/script/202609261400_mezo-a9bo7_team_chat.sql      ← NEW E1
backend/src/main/resources/db/changelog/1.1.0/script/202609261410_mezo-a9bo7_feedback_team_chat_kind.sql ← NEW E1
backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml                                   ← +2 changeSets E1
backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagClearedEvent.java      ← NEW E1
backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceWriter.java       ← publishes FlagClearedEvent E1
backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/TeamChatInterventionKeySource.java ← NEW port E1
backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/FeedbackLearningService.java ← merges team_chat verdicts E1
backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/entity/MessageFeedbackEntity.java ← KIND_TEAM_CHAT_LINE E1
backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionService.java         ← pick() extracted E1
backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePick.java                  ← NEW record E1
backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceApplyService.java          ← applyPort() E1
backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionEventListener.java    ← advice-card switch E4
backend/src/main/java/io/mrkuhne/mezo/feature/character/
  service/chat/TeamChatCast.java                ← NEW E1 (owner/guest map)
  service/chat/TeamChatService.java             ← NEW E1 open/resolve/expire/reply/apply; E2 voice; E3 push
  service/chat/TeamChatEventListener.java       ← NEW E1
  service/chat/TeamChatReads.java               ← NEW E1 (read model for the API)
  service/chat/TeamChatInterventionKeyAdapter.java ← NEW E1 (implements the companion port)
  service/chat/TeamChatExpiryJob.java           ← NEW E1 (daily expiry) — E3 adds the catch-up
  service/chat/TeamChatContext.java             ← NEW E2 (context assembler)
  service/chat/TeamChatVoiceWriter.java         ← NEW E2
  service/chat/TeamChatBudget.java              ← NEW E2
  service/chat/TeamChatKnowledgePort.java       ← NEW E2 (+ NoopTeamChatKnowledge)
  service/chat/TeamChatPushPolicy.java          ← NEW E3 (pure)
  entity/TeamChatThreadEntity.java, entity/TeamChatLineEntity.java, entity/TeamChatActionsEnvelope.java ← NEW E1
  repository/TeamChatThreadRepository.java, repository/TeamChatLineRepository.java ← NEW E1
  controller/CharacterController.java           ← +3 endpoints E1
  service/edition/EditionCandidateCollector.java ← team_chat_day candidate E5
backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/domain/AppNotificationKind.java    ← TEAM_CHAT E3
backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java          ← costForUserFeatureSince E2
backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java               ← marker mirror E2
backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java         ← TEAM_CHAT_SWITCH E1
backend/src/main/resources/application.yml                                                       ← switch, props, throttled slug
api/feature/character/character.yml, api/feature/<feedback yml>                                  ← contract E1
frontend/src/data/character/{teamChatApi.ts,teamChatHooks.ts,teamChatMock.ts} (+tests)          ← NEW E4
frontend/src/features/insights/pages/TeamChatPage.tsx (+test)                                    ← NEW E4
frontend/src/features/insights/components/feed/LiveStrip.tsx (+test)                             ← NEW E4
frontend/src/features/insights/logic/teamChat.ts (+test)                                         ← NEW E4 (grouping, strip text)
frontend/src/features/insights/boop-world.css                                                    ← chat + strip styles E4
frontend/src/features/insights/pages/TeamFeedPage.tsx, app/router.tsx                           ← E4
frontend/src/features/today/pages/NapMezoPage.tsx                                               ← Üzenetek row E4
frontend/src/data/types.ts, notification kind meta files                                         ← TEAM_CHAT E3/E4
docs/decisions/0053-csapat-elo-beszelgetes.md, docs/features/{character,companion,proactive,insights}.md, docs/CODEMAP.md ← E5 (+ codemap every slice)
```

---

# E1 — Az ügy-motor (bead `mezo-a9bo7.21`)

Template lines only, no LLM, no push. After E1 the backend opens/resolves ügyek and serves them.

### Task 1: `TeamChatCast` — who speaks for which rule

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatCast.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatCastTest.java`

**Interfaces:**
- Produces: `TeamChatCast.ownerOf(String flagKey) → Optional<TeamCharacter>` (empty only for `all_healthy`), `TeamChatCast.guestOf(String flagKey) → Optional<TeamCharacter>`.

- [ ] **Step 1: Write the failing test**

```java
class TeamChatCastTest {
    /** Every rule constant on FlagKey (the SOURCE_* markers are not rules). */
    static Stream<String> ruleKeys() throws IllegalAccessException {
        List<String> keys = new ArrayList<>();
        for (Field f : FlagKey.class.getFields()) {
            if (Modifier.isStatic(f.getModifiers()) && f.getType() == String.class && !f.getName().startsWith("SOURCE_")) {
                keys.add((String) f.get(null));
            }
        }
        return keys.stream();
    }

    @ParameterizedTest @MethodSource("ruleKeys")
    void everyRuleHasAnOwnerExceptAllHealthy(String key) {
        assertThat(TeamChatCast.ownerOf(key).isPresent()).isEqualTo(!FlagKey.ALL_HEALTHY.equals(key));
    }

    @Test void specTable() {
        assertThat(TeamChatCast.ownerOf(FlagKey.SLEEP_DEBT)).contains(TeamCharacter.SZUNYA);
        assertThat(TeamChatCast.ownerOf(FlagKey.IGNORED_NUDGE)).contains(TeamCharacter.SZUNYA);
        assertThat(TeamChatCast.ownerOf(FlagKey.LATE_EATING)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.guestOf(FlagKey.LATE_EATING)).contains(TeamCharacter.SZUNYA);
        assertThat(TeamChatCast.ownerOf(FlagKey.LOAD_FUEL_MISMATCH)).contains(TeamCharacter.MOCOR);
        assertThat(TeamChatCast.guestOf(FlagKey.LOAD_FUEL_MISMATCH)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.ownerOf(FlagKey.ENERGY_DIP_MEAL_TIMING)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.guestOf(FlagKey.ENERGY_DIP_MEAL_TIMING)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.ownerOf(FlagKey.PROTOCOL_LAPSE)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.ownerOf(FlagKey.MEAL_RHYTHM_DRIFT)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.ownerOf(FlagKey.JOINT_OVERUSE)).contains(TeamCharacter.MOCOR);
        assertThat(TeamChatCast.ownerOf(FlagKey.MISSED_WORKOUTS)).contains(TeamCharacter.MOCOR);
        assertThat(TeamChatCast.ownerOf(FlagKey.RAPID_WEIGHT_LOSS)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.guestOf(FlagKey.RAPID_WEIGHT_LOSS)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.ownerOf(FlagKey.ACUTE_BAD_DAY)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.ownerOf(FlagKey.SUSTAINED_STRESS)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.ownerOf(FlagKey.RECOVERY_NEEDED)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.guestOf(FlagKey.RECOVERY_NEEDED)).contains(TeamCharacter.SZUNYA);
        assertThat(TeamChatCast.ownerOf(FlagKey.MOMENTUM_AT_RISK)).contains(TeamCharacter.MEZO);
        assertThat(TeamChatCast.guestOf(FlagKey.MOMENTUM_AT_RISK)).contains(TeamCharacter.MOCOR);
        assertThat(TeamChatCast.ownerOf(FlagKey.LOGGING_GAP)).contains(TeamCharacter.MEZO);
        assertThat(TeamChatCast.guestOf(FlagKey.SLEEP_DEBT)).isEmpty();
    }
}
```

- [ ] **Step 2: Run** `cd backend && ./mvnw test -Dtest=TeamChatCastTest` → FAIL (class missing).
- [ ] **Step 3: Implement** a `final class` with two `Map.ofEntries(...)` (owner, guest) built from the `FlagKey` constants exactly as in the test; `ownerOf`/`guestOf` return `Optional.ofNullable(map.get(key))`. Javadoc: "spec 2026-09-26 §5.2 — the ONE place a rule gets a voice; FlagCatalog domains are NOT TeamCharacter.forMetricDomain keys (training ≠ train), so this map is explicit".
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(character): team chat cast — rule → owner/guest (mezo-a9bo7.21)`.

### Task 2: `FlagClearedEvent` from the trace writer

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagClearedEvent.java`
- Modify: `.../companion/flags/service/FlagTraceWriter.java` (inject `ApplicationEventPublisher`; after `repository.save(row)` publish when `"clear".equals(outcome)`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagTraceWriterClearedEventTest.java` (Mockito: repository + publisher)

**Interfaces:**
- Produces: `public record FlagClearedEvent(UUID userId, String flagKey, FlagVerdict.ClearEvidence evidence, Instant at)`.

- [ ] **Step 1: Test** three cases with a mocked `CompanionFlagTraceRepository`: (a) previous `raised` → verdict `clear` ⇒ one `FlagClearedEvent` with the verdict's `clear()` evidence and `at`; (b) previous `clear` → verdict `clear` (no change, no row) ⇒ no event; (c) previous `unavailable` → verdict `clear` ⇒ event (a resolve counts from any state; the chat side decides whether an ügy is open).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (constructor gets `ApplicationEventPublisher eventPublisher` via `@RequiredArgsConstructor`; publish inside the same transaction — listeners are AFTER_COMMIT). **Step 4: Run** the new test plus the existing `FlagTraceWriter*`/`FlagService*` tests → PASS. **Step 5: Commit** `feat(companion): publish FlagClearedEvent on a transition to clear (mezo-a9bo7.21)`.

### Task 3: Schema — `team_chat_thread`, `team_chat_line`, feedback kind

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609261400_mezo-a9bo7_team_chat.sql`, `.../202609261410_mezo-a9bo7_feedback_team_chat_kind.sql`
- Modify: `.../1.1.0/1.1.0_master.yml` (two changeSets, same shape as the neighbours)
- Create: `feature/character/entity/TeamChatThreadEntity.java`, `TeamChatLineEntity.java`, `TeamChatActionsEnvelope.java`; `feature/character/repository/TeamChatThreadRepository.java`, `TeamChatLineRepository.java`
- Modify: `feature/companion/feedback/entity/MessageFeedbackEntity.java` (`KIND_TEAM_CHAT_LINE = "team_chat_line"`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatRepositoryIT.java`

```sql
-- 202609261400_mezo-a9bo7_team_chat.sql — Csapatfal Act III (spec 2026-09-26 §5.1)
create table team_chat_thread (
    id uuid primary key,
    created_by uuid not null,
    flag_key varchar(24) not null,
    owner_character varchar(16) not null,
    guest_character varchar(16),
    advice_key varchar(64),            -- the library entry picked at open (feedback + priority)
    status varchar(10) not null check (status in ('OPEN','RESOLVED','EXPIRED')),
    opened_at timestamptz not null,
    closed_at timestamptz,
    pushed boolean not null default false,
    actions jsonb,                      -- offered AdviceActionCatalog actions
    applied jsonb,                      -- {actionKey, at} once applied
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted boolean not null default false
);
create unique index uq_team_chat_thread_open on team_chat_thread (created_by, flag_key)
    where status = 'OPEN' and deleted = false;
create index ix_team_chat_thread_owner_opened on team_chat_thread (created_by, opened_at desc);

create table team_chat_line (
    id uuid primary key,
    created_by uuid not null,
    thread_id uuid references team_chat_thread(id),
    kind varchar(8) not null check (kind in ('OPEN','GUEST','RESOLVE','SKEPTIC','USER')),
    character varchar(16),              -- null for USER
    body text not null,
    voiced boolean not null default false,
    facts jsonb,                        -- the whitelist the line was written from
    occurred_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted boolean not null default false
);
create index ix_team_chat_line_owner_time on team_chat_line (created_by, occurred_at);
create unique index uq_team_chat_line_resolve on team_chat_line (thread_id) where kind = 'RESOLVE';
```

The second file swaps `ck_message_feedback_artifact_kind` exactly like `202609...mezo-76f6` (the last one that touched it), adding `'team_chat_line'` to the list `('chat_message','feed_message','weekly_suggestion','weekly_review','memoir','prediction','day_review','meal_coach','recipe_breakdown')`.

Entities follow `TeamEditionEntity`'s base class / audit / jsonb conventions (read it first). `TeamChatActionsEnvelope` = `record(List<Action> actions)` with `record Action(String key, String label, Map<String,Object> params)`; `applied` = `record Applied(String actionKey, Instant at)` jsonb.

**Repository methods (Produces):**
- `TeamChatThreadRepository`: `Optional<TeamChatThreadEntity> findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(UUID, String, String)`, `List<TeamChatThreadEntity> findByCreatedByAndStatusAndDeletedFalseOrderByOpenedAtAsc(UUID, String)`, `List<TeamChatThreadEntity> findByStatusAndOpenedAtBeforeAndDeletedFalse(String, Instant)`, `List<TeamChatThreadEntity> findByCreatedByAndOpenedAtBetweenAndDeletedFalse(UUID, Instant, Instant)`, `Optional<TeamChatThreadEntity> findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`.
- `TeamChatLineRepository`: `List<TeamChatLineEntity> findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(UUID, Instant, Instant)`, `long countByCreatedByAndCharacterIsNotNullAndOccurredAtBetweenAndDeletedFalse(UUID, Instant, Instant)`, `List<TeamChatLineEntity> findByIdInAndCreatedBy(Collection<UUID>, UUID)`, `boolean existsByThreadIdAndKind(UUID, String)`.

- [ ] **Step 1: IT** (extends the character ITs' base): insert an OPEN thread; a second OPEN for the same `(user, flag_key)` throws `DataIntegrityViolationException`; a RESOLVED + a new OPEN coexist; a second RESOLVE line for one thread throws; a `message_feedback` row with `artifact_kind='team_chat_line'` saves.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** migration + entities + repositories. **Step 4: Run** → PASS. **Step 5: Commit** `feat(character): team chat schema — thread + line (mezo-a9bo7.21)`.

### Task 4: Proactive seams — `InterventionService.pick`, `AdviceApplyService.applyPort`

**Files:**
- Create: `feature/proactive/service/AdvicePick.java`
- Modify: `feature/proactive/service/InterventionService.java`, `AdviceApplyService.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/**/InterventionServiceTest.java` (or the existing unit test for it — find with `grep -rl InterventionService backend/src/test`), `AdviceApplyServiceTest`

**Interfaces:**
- Produces:
  - `public record AdvicePick(String flagKey, String entryKey, String textHu, List<String> facts, FlagPayloadEnvelope payload) {}`
  - `public Optional<AdvicePick> pick(UUID userId, String flagKey, BiPredicate<String, Instant> usedSince)` — the current body of `deliverForFlag` up to (not including) `adviceCardService.deliver`: library filter → `!usedSince.test(entry.key(), now − entry.cooldownHours())` → effectiveness max → payload from `companionFlagLogRepository` → `FlagFactRenderer.render(flagKey, payload)`.
  - `deliverForFlag` becomes `pick(userId, flagKey, this::usedByCard).map(p -> adviceCardService.deliver(...))` with `usedByCard(key, since)` = the old `inCooldown` body. Behaviour unchanged.
  - `AdviceApplyService.applyPort(UUID userId, String actionKey, Map<String,Object> params)` — finds the port (same `PROACTIVE_ADVICE_ACTION_PORT_MISSING` error) and calls `port.apply`; `apply(...)` calls it instead of its inline lookup.
- [ ] **Step 1:** Tests: `pick` returns the highest-effectiveness entry and honours the predicate (a key reported used → next best; all used → empty); the existing `deliverForFlag` tests still pass unmodified; `applyPort` with an unknown key throws the MISSING error.
- [ ] **Step 2–4:** red → implement → green (run the whole `io.mrkuhne.mezo.feature.proactive.**` package).
- [ ] **Step 5: Commit** `refactor(proactive): extract advice pick + port apply seams (mezo-a9bo7.21)`.

### Task 5: `TeamChatService` + listener + expiry (template voice)

**Files:**
- Create: `feature/character/service/chat/TeamChatService.java`, `TeamChatEventListener.java`, `TeamChatExpiryJob.java`, `TeamChatProperties.java` (in `feature/character/config/`, `@ConfigurationProperties("mezo.character.team-chat")`)
- Modify: `techcore/configuration/FeaturesConfiguration.java` (`TEAM_CHAT_SWITCH`), `application.yml` (`mezo.feature.team-chat.enabled: false` default next to `team-edition`; `mezo.character.team-chat: {zone: Europe/Budapest, expire-after-days: 7, daily-line-cap: 12, max-pushes-per-day: 2, monthly-usd-cap: 1.00, expiry-cron: "0 10 4 * * *"}`), test `application*.yml` used by ITs (switch on for character ITs — follow how `team-edition` is enabled there)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatServiceIT.java`, `TeamChatSwitchOffIT.java`

**Interfaces:**
- Consumes: `TeamChatCast`, `InterventionService.pick`, `AdviceActionCatalog.forCard(UUID, String adviceKey)`, `FlagTraceCopy.clearText(ClearEvidence)`, `FlagTraceCopy.clearFacts(ClearEvidence)`, repositories from Task 3, `FlagRaisedEvent`, `FlagClearedEvent`.
- Produces (later tasks call these):
  - `Optional<TeamChatThreadEntity> open(UUID userId, String flagKey, Instant at)` — `@Transactional`. No-op (empty) if no owner, an OPEN thread exists, the daily line cap is reached, or `pick` is empty. Else: thread (OPEN, owner/guest, `advice_key = pick.entryKey()`, `actions = forCard(userId, flagKey)`), then lines via `TeamChatLines lines = voice(...)` — in E1 the template: OPEN line body = `pick.textHu()`, `facts = pick.facts()`, `voiced=false`; no guest line in E1.
  - `Optional<TeamChatLineEntity> resolve(UUID userId, String flagKey, ClearEvidence evidence, Instant at)` — `@Transactional`. Only if an OPEN thread exists: status RESOLVED, `closed_at`, RESOLVE line by the owner, body = `FlagTraceCopy.clearText(evidence)`, `facts = FlagTraceCopy.clearFacts(evidence)`.
  - `int expire(Instant now)` — OPEN threads with `opened_at < now − expireAfterDays` → EXPIRED.
  - `TeamChatLineEntity reply(UUID userId, UUID threadId, String text)` — USER line (trimmed, 1..1000 chars else 400 `CHARACTER_TEAM_CHAT_REPLY_INVALID`); never resolves.
  - `TeamChatThreadEntity apply(UUID userId, UUID threadId, String actionKey)` — offered-check + idempotency exactly like `AdviceApplyService.apply` (NOT_OFFERED / CONFLICT errors with `CHARACTER_TEAM_CHAT_*` codes, 404 `CHARACTER_TEAM_CHAT_NOT_FOUND`), then `adviceApplyService.applyPort(...)`, stamps `applied`.
  - A package-private seam `TeamChatLines voice(TeamChatThreadEntity thread, String kind, List<String> facts, String templateText)` returning `record TeamChatLines(String ownerBody, boolean voiced, Optional<String> guestBody, Optional<String> skepticBody)` — E1 returns the template; E2 replaces its body with the writer.
- Listener: `@Async @TransactionalEventListener(AFTER_COMMIT)` for both events, each wrapped in try/catch → `log.warn` (the `InterventionEventListener` template). `open` uses `event`'s time = `Instant.now()`.
- Expiry job: `@Scheduled(cron = "${mezo.character.team-chat.expiry-cron}", zone = "Europe/Budapest")`, `UserFanOut`-free (one global query), switch-gated.

- [ ] **Step 1: IT** (fake LLM profile, Testcontainers): (a) publish-and-commit a `FlagRaisedEvent` for `sleep_debt` with a flag-log row → one OPEN thread owned by SZUNYA + one OPEN line whose body equals the picked library `textHu`; (b) a second raise → still one thread, one line; (c) `FlagClearedEvent` → RESOLVED + RESOLVE line = `FlagTraceCopy.clearText`; (d) cleared with no open thread → nothing; (e) `all_healthy` raise → nothing; (f) 13th line of a day is dropped; (g) `expire` closes an 8-day-old OPEN; (h) `reply` writes a USER line and leaves the thread OPEN; (i) `apply` of an offered action calls the port once and a second call is idempotent. Call the service methods directly for (b)–(i); (a) goes through the event to cover the listener.
- [ ] **Step 2: SwitchOffIT:** with `mezo.feature.team-chat.enabled=false` the context has no `TeamChatService`, `TeamChatEventListener`, `TeamChatExpiryJob` beans (copy an existing `*SwitchOffIT`).
- [ ] **Step 3–4:** red → implement → green. **Step 5: Commit** `feat(character): team chat engine — open/resolve/expire with template lines (mezo-a9bo7.21)`.

### Task 6: Contract + read API + feedback wiring

**Files:**
- Modify: `api/feature/character/character.yml` — `GET /api/character/team-chat?date=YYYY-MM-DD` → `TeamChatDay`; `POST /api/character/team-chat/threads/{id}/reply` body `{text}` → `TeamChatLine`; `POST /api/character/team-chat/threads/{id}/apply/{actionKey}` → `TeamChatThread`
- Modify: the feedback contract yml that holds the `artifactKind` enum (find with `grep -rn "recipe_breakdown" api/feature`) — add `team_chat_line`
- Create: `feature/character/service/chat/TeamChatReads.java`, `TeamChatInterventionKeyAdapter.java`; `feature/companion/feedback/service/TeamChatInterventionKeySource.java`
- Modify: `feature/character/controller/CharacterController.java`, `feature/companion/feedback/service/FeedbackLearningService.java`, the feedback write validator if it whitelists kinds (grep `KIND_RECIPE_BREAKDOWN` usages)
- Regenerate: `api.gen.ts` + backend sources (Global Constraints)
- Test: `TeamChatControllerIT.java`, extend `FeedbackLearningService` test

**Schemas (Produces — the FE builds on these names):**

```yaml
TeamChatDay:
  required: [date, lines, openThreads, pushesToday, pushBudget]
  properties:
    date: {type: string, format: date}
    lines: {type: array, items: {$ref: '#/components/schemas/TeamChatLine'}}
    openThreads: {type: array, items: {$ref: '#/components/schemas/TeamChatThread'}}   # every OPEN ügy, any day, oldest first
    pushesToday: {type: integer}
    pushBudget: {type: integer}          # mezo.character.team-chat.max-pushes-per-day
TeamChatLine:
  required: [id, threadId, kind, body, voiced, occurredAt, facts]
  properties:
    id: {type: string, format: uuid}
    threadId: {type: string, format: uuid, nullable: true}
    kind: {type: string, enum: [OPEN, GUEST, RESOLVE, SKEPTIC, USER]}
    character: {type: string, nullable: true, enum: [szunya, mocor, falat, deru, mezo, szkeptikus]}
    body: {type: string}
    voiced: {type: boolean}
    facts: {type: array, items: {type: string}}
    occurredAt: {type: string, format: date-time}
    thread: {$ref: '#/components/schemas/TeamChatThread'}   # present on OPEN and RESOLVE lines
TeamChatThread:
  required: [id, flagKey, ruleLabel, owner, status, openedAt, pushed, actions]
  properties:
    id: {type: string, format: uuid}
    flagKey: {type: string}
    ruleLabel: {type: string}            # FlagCatalog's Hungarian label, e.g. "Alvásadósság"
    owner: {type: string, enum: [szunya, mocor, falat, deru, mezo]}
    guest: {type: string, nullable: true}
    status: {type: string, enum: [OPEN, RESOLVED, EXPIRED]}
    openedAt: {type: string, format: date-time}
    closedAt: {type: string, format: date-time, nullable: true}
    pushed: {type: boolean}
    actions: {type: array, items: {$ref: '#/components/schemas/TeamChatAction'}}
    applied: {type: string, nullable: true}          # applied actionKey
TeamChatAction: {required: [key, label], properties: {key: {type: string}, label: {type: string}}}
```

Character ids are the lower-case `TeamCharacter` names the FE `team.ts` already uses (check `TeamCharacterId` in `frontend/src/features/insights/logic/team.ts` and reuse its exact spelling). `ruleLabel` comes from `FlagCatalog` (read how `FlagTraceReadService` gets the label).

- `TeamChatReads.day(UUID userId, LocalDate date) → TeamChatDay` (lines of the local day in `zone`, open threads, `pushesToday` = threads with `pushed` and `opened_at` that day).
- Controller endpoints follow the `getTeamEditions` idiom (current-user id, generated interface).
- Feedback: the FE posts 👍/👎 with `artifactKind: team_chat_line`, `artifactId = line id`. `TeamChatInterventionKeySource` (companion port): `Map<UUID, String> interventionKeysByIds(UUID userId, Collection<UUID> lineIds)`; `TeamChatInterventionKeyAdapter` (character) maps line → its thread's `advice_key`. `FeedbackLearningService` takes `ObjectProvider<TeamChatInterventionKeySource>` (absent when the switch is off) and, in the intervention loop, adds the `team_chat_line` verdicts whose key matches `entry.key()` to `verdicts` before `upsertEffectiveness`.
- [ ] **Step 1:** Controller IT: GET returns lines in time order with `thread` embedded on OPEN/RESOLVE and the open-thread list; reply → 200 + USER line; apply unknown thread → 404. Feedback test: one 👍 on a team chat line of advice key K raises `intervention:K` `up` by one.
- [ ] **Step 2–4:** red → implement → regenerate → green. **Step 5: Commit** `feat(api): team chat read/reply/apply + feedback kind (mezo-a9bo7.21)`.

### E1 gates + merge
- [ ] Focused backend gate (Global Constraints) green; `node scripts/gen-codemap.mjs`; commit codemap.
- [ ] `bd close mezo-a9bo7.21`; merge detached → push; regenerate codemap on main if the merge touched it.

---

# E2 — A hang (bead `mezo-a9bo7.22`)

### Task 7: Spend query + `TeamChatBudget`

**Files:**
- Modify: `feature/llmlog/repository/LlmLogRepository.java`
- Create: `feature/character/service/chat/TeamChatBudget.java`
- Modify: `application.yml` — add `team_chat` to the `throttled-features` list (find it next to `character_edition`)
- Test: `TeamChatBudgetIT.java`

**Interfaces:**
- Produces: `@Query("select coalesce(sum(l.costUsd), 0) from LlmLogEntity l where l.createdBy = :owner and l.feature = :feature and l.createdAt >= :since") BigDecimal costForOwnerFeatureSince(UUID owner, String feature, Instant since)` (check the entity's cost field type and match it); `TeamChatBudget.hasRoom(UUID owner) → boolean` = spend over the last 30 days `< monthlyUsdCap`.
- [ ] Test: two `llm_log` rows for `team_chat` summing 0.99 → room; adding 0.02 → no room; another feature's rows don't count. red → green → commit `feat(character): team chat monthly USD cap (mezo-a9bo7.22)`.

### Task 8: `TeamChatContext` + knowledge port

**Files:**
- Create: `feature/character/service/chat/TeamChatContext.java`, `TeamChatKnowledgePort.java`, `NoopTeamChatKnowledge.java`
- Test: `TeamChatContextIT.java`

**Interfaces:**
- Produces: `record TeamChatContextBlock(List<String> todayLines, List<String> pastEpisodes, List<String> reactions, List<String> knowledge)`; `TeamChatContext.build(UUID owner, TeamChatThreadEntity thread, Instant at) → TeamChatContextBlock`:
  - `todayLines`: today's lines as `"<Name>: <body>"`, oldest first, max 12.
  - `pastEpisodes`: this rule's threads in the last 30 days, `"<opened date> → <RESOLVED at hh:mm | EXPIRED | still open>"`, max 5.
  - `reactions`: 👍/👎 counts on this rule's past lines (`message_feedback` rows of kind `team_chat_line`) and the applied action, if any, per episode.
  - `knowledge`: `TeamChatKnowledgePort.forArea(UUID owner, TeamCharacter area) → List<String>` — `NoopTeamChatKnowledge` (`@ConditionalOnMissingBean(TeamChatKnowledgePort.class)`) returns `List.of()`. Javadoc names Emlékezet `mezo-d6ivw.5` as the implementer.
- [ ] Test the assembly with seeded threads/lines/feedback. red → green → commit `feat(character): team chat context — today, past episodes, reactions (mezo-a9bo7.22)`.

### Task 9: `TeamChatVoiceWriter` (owner + guest + Szkeptikus in one call)

**Files:**
- Create: `feature/character/service/chat/TeamChatVoiceWriter.java`
- Modify: `TeamChatService.voice(...)` → delegates to the writer; `feature/companion/llm/FakeCompanionLlm.java` (marker mirror returning a guard-passing JSON built from the prompt's facts)
- Test: `TeamChatVoiceWriterTest.java` (unit, stub `CompanionLlm`), extend `TeamChatServiceIT`

**Interfaces:**
- Consumes: `CompanionLlm` + `LlmCallContextHolder.runWith(new LlmCallContext("team_chat", …), …)` exactly like `EditionVoiceWriter` (read it and mirror its call, JSON parsing and `PromptPersona.VOICE_HU` use); `EditionVoiceGuard.check(TeamCharacter, String, List<String>, String)` and `checkGuest(...)`; `TeamChatBudget.hasRoom`; `TeamChatContext.build`.
- Produces: `TeamChatLines write(UUID owner, TeamChatThreadEntity thread, String kind /* OPEN|RESOLVE */, List<String> facts, String templateText, boolean skepticEligible)`.
- Prompt: first line `CSAPATFAL-ELO-BESZELGETES`; then persona, the owner's name + area + allowed emoji (`TeamCharacter`), the kind („most kapcsolt be: mondd el, mi a teendő" / „rendeződött: zárd le röviden"), `tények:` (one per line — the ONLY numbers allowed), `teendő:` (`templateText`), the context block (labelled „háttér — számot innen NE írj"), and when a guest exists: „<Guest> egy mondattal hozzáteszi a saját területéről" (OPEN only, and on RESOLVE only if the thread has a guest); when `skepticEligible`: „a Szkeptikus egy száraz mondatban megjegyzi, mi becsült/hiányzik (emoji nélkül)". Output JSON `{"owner": "...", "guest": "...|null", "skeptic": "...|null"}`.
- Rules: budget no room → template (no call); exception/parse failure → template; owner fails guard → template for the owner AND drop guest/skeptic; guest or skeptic failing the guard → that line dropped only. `voiced=true` only when the owner line passed.
- **Szkeptikus eligibility** (`skepticEligible`): true only when the event's facts contain a marker the rule already renders for estimated/missing inputs. Implementation step: read `FlagFactRenderer.render` for `sleep_debt`, `recovery_needed`, `load_fuel_mismatch`, `rapid_weight_loss` and list which fact strings signal an estimate/gap (e.g. an "becsült" or "hiányzik" wording); encode that as `TeamChatVoiceWriter.SKEPTIC_MARKERS` with a unit test per rule. If no rule renders such a marker, eligibility stays false everywhere and the test documents that (honest: no fabricated doubt).
- [ ] Tests: happy path (owner + guest voiced); guard rejection of owner → template, no guest; budget exhausted → no LLM call; skeptic line only when eligible; the IT shows a voiced OPEN line through the fake. red → green → commit `feat(character): team chat voice — owner, guest, Szkeptikus under guard + cap (mezo-a9bo7.22)`.

### E2 gates + merge — as E1 (bead `mezo-a9bo7.22`).

---

# E3 — A push-keret (bead `mezo-a9bo7.23`)

### Task 10: `TeamChatPushPolicy` (pure) + `TEAM_CHAT` notification kind

**Files:**
- Create: `feature/character/service/chat/TeamChatPushPolicy.java`
- Modify: `feature/appnotification/domain/AppNotificationKind.java` (`TEAM_CHAT("team_chat", "intervention", "/mezo/elo")` with a Javadoc like `TEAM_EDITION`'s), FE kind meta (`grep -rn "team_edition" frontend/src` — mirror every place: types, category mapping, `notificationKindMeta.test.ts`)
- Modify: `TeamChatService.open` — after the lines: `if (policy.shouldPush(...)) { thread.setPushed(true); appNotifications.emit(owner, TEAM_CHAT, "<Owner> · <ruleLabel>", <owner line excerpt ≤ 140 chars>, "/mezo/elo", thread.getId(), "team_chat:" + thread.getId()); }`
- Test: `TeamChatPushPolicyTest.java`, extend `TeamChatServiceIT`

**Interfaces:**
- Produces: `static boolean shouldPush(String candidateFlagKey, List<String> pushedTodayFlagKeys, int maxPerDay)` — `pushedToday.isEmpty()` → true; `size() >= maxPerDay` → false; else true iff for every pushed key `AdvicePriority.outranks(candidate, pushed)`. `AdvicePriority.ORDER` is keyed by **flag key** (acute_bad_day first … all_healthy last), so pass the threads' `flag_key`s.
- [ ] Policy tests: first → push; second outranking → push; second not outranking → silent; third → silent; resolution path never calls the policy. IT: two opens the same day with the lower-severity one first → both pushed; reversed order → only the first; `app_notification` row carries kind `team_chat` and deeplink `/mezo/elo`.
- [ ] red → green → commit `feat(character): team chat push budget — 2/day, second only if more severe (mezo-a9bo7.23)`.

### Task 11: Catch-up job

**Files:**
- Modify: `TeamChatExpiryJob.java` → add `@Scheduled(cron = "${mezo.character.team-chat.catchup-cron}")` (`"0 20 * * * *"`) calling `TeamChatService.catchUp(Instant now)`
- Modify: `TeamChatService` — `catchUp`: per active user (`UserFanOut.forEachActiveUser`), for each `companion_flag_log` raise in the last 24 h with no thread opened at/after it for that flag → `open(...)` WITHOUT push (the moment passed); for each OPEN thread whose rule's latest trace row is `clear` → `resolve(...)` with that row's evidence.
- Test: IT — a raise row with no thread → catch-up opens it, `pushed=false`; an OPEN thread whose last trace is clear → resolved; running twice changes nothing.
- [ ] red → green → commit `feat(character): team chat catch-up for missed events (mezo-a9bo7.23)`.

### E3 gates + merge — as E1 (bead `mezo-a9bo7.23`).

---

# E4 — A szoba és a sáv (bead `mezo-a9bo7.24`)

Read first: prototype `#fal` (`.lstrip`), `#elo` (`.cm`, `.ctag`, `.livebar`), `#nap-uzenetek`; `boop-world.css` (existing `tf-*` classes, `.glass`, `tf-c-*` accents); `FeedTrio` (the unified trio); `useAdviceActions` (the apply idiom).

### Task 12: Data layer — API, hooks, mock

**Files:**
- Create: `frontend/src/data/character/teamChatApi.ts`, `teamChatHooks.ts`, `teamChatMock.ts`, `teamChatHooks.test.tsx`; export the hooks via `@/data/hooks` like the other character hooks
- Types: from `api.gen` (`TeamChatDay`, `TeamChatLine`, `TeamChatThread`)

**Interfaces:**
- Produces: `useTeamChat(date?: string) → { day: TeamChatDay; loading: boolean }` (`useDualQuery`, key `['teamChat', date]`, `refetchInterval: 60_000` in real mode only, mock = `teamChatMock`, `realEmpty` = `{date, lines: [], openThreads: [], pushesToday: 0, pushBudget: 2}`); `useTeamChatActions() → { reply(threadId, text), apply(threadId, actionKey), pending }` (mutations invalidate `['teamChat']` plus `ACTION_INVALIDATES` keys — import and reuse that map from `adviceHooks.ts` by exporting it; no copy).
- Mock: the prototype's day verbatim (Szunya sleep_debt OPEN 07:40 pushed + Szkeptikus 07:41; Mocor load_fuel_mismatch 12:05 pushed + Falat guest 12:06; USER 12:40; Falat RESOLVE 13:05 + Mocor guest 13:06; Derű sustained_stress 16:20 silent), dates relative to today.
- [ ] Tests: mock mode returns the seed; real mode empty returns `realEmpty`; `reply` invalidates `teamChat`. red → green → commit `feat(insights): team chat data layer (mezo-a9bo7.24)`.

### Task 13: `teamChat.ts` logic + `TeamChatPage` (`/mezo/elo`)

**Files:**
- Create: `frontend/src/features/insights/logic/teamChat.ts` (+ `.test.ts`), `features/insights/pages/TeamChatPage.tsx` (+ `.test.tsx`)
- Modify: `app/router.tsx` (`{ path: 'mezo/elo', element: <TeamChatPage /> }` BEFORE `mezo/csapat/:id`), `features/insights/boop-world.css` (port `.cm`, `.bub`, `.ctag`, `.livebar`, `.typing` from the prototype as `tf-chat-*` classes; reduced-motion branch)

**Interfaces:**
- Produces (pure, tested): `groupByDayPart(lines) → Array<{ part: 'REGGEL'|'DÉLBEN'|'DÉLUTÁN'|'ESTE'|'ÉJJEL', lines }>` (05–11 reggel, 11–14 délben, 14–18 délután, 18–22 este, else éjjel); `stripText(day) → { speaker, text } | null` (latest character line of today, else null); `unreadCount(day, lastSeenIso)`; `chips(day) → { open: number, resolved: number, pushes: `${n} / ${budget}` }`.
- Page: header (back → `/mezo`), `livebar`, chips, ONE `.glass` „Rád vár" strip for the oldest open thread (scrolls to its OPEN line; the thread may be from an earlier day — then the text says „<ruleLabel> — <owner> figyeli"), the grouped lines (owner/guest/skeptic/user variants), under every OPEN line: the thread chip (`ruleLabel · NYITOTT|RENDEZŐDÖTT hh:mm`), push marker („értesítettünk · hh:mm" / „csendben"), „Miből látszik?" (a sheet listing `line.facts`, the rule label, and „Akkor zárul le, ha …" = `FlagTraceCopy`-style text is not available FE-side → show the facts and „A motor naplója a Gépteremben" link to the coaching observer route), the unified trio (`FeedTrio` with feedback kind `team_chat_line`) and the thread's `actions` as buttons (`apply`); a reply row (`Elmesélem` → sheet → `reply`). Stores `lastSeen` in `localStorage` (try/catch) on mount.
- [ ] Tests: grouping boundaries; strip text picks the latest character line; page renders the mock day, shows exactly one `.glass` element, renders the resolved chip, and calls `apply` on an action tap. red → green → commit `feat(insights): A csapat beszél — the team chat room (mezo-a9bo7.24)`.

### Task 14: Live strip on the wall + Nap hand-off + card retirement

**Files:**
- Create: `features/insights/components/feed/LiveStrip.tsx` (+ test)
- Modify: `features/insights/pages/TeamFeedPage.tsx` (render `<LiveStrip />` between `<StoryStrip …/>` and the waiting strip), `features/today/pages/NapMezoPage.tsx` (Üzenetek tab: when team chat is available, replace the advice card with one row „A csapat most erről beszél" + the open threads' `ruleLabel`s → `/mezo/elo`; keep the old card rendering when `useTeamChat` is empty AND a legacy advice card exists — the rollout overlap day)
- Modify (backend): `feature/proactive/service/InterventionEventListener.java` — add `mezo.proactive.advice-card.enabled` to its `@ConditionalOnProperty` names with `matchIfMissing`-safe handling (a separate `@ConditionalOnProperty(name = "mezo.proactive.advice-card.enabled", havingValue = "true", matchIfMissing = true)` on the class is not combinable with the existing one — use a nested condition or an `@Value` guard at the top of `onFlagRaised`; pick the one the codebase already uses elsewhere, `grep -rn "matchIfMissing" backend/src/main/java | head`); `application.yml` default `true`; document in the ops note that prod sets `MEZO_PROACTIVE_ADVICE_CARD_ENABLED=false` and `MEZO_FEATURE_TEAM_CHAT_ENABLED=true` together
- Test: `LiveStrip.test.tsx`, `NapMezoPage` test update, backend `InterventionEventListener` test (flag off → no delivery)

**Interfaces:**
- `LiveStrip`: hidden when `stripText(day)` is null AND `openThreads` is empty; else a flat panel (NOT glass) with the live dot (static under reduced motion), the speaker's `CharacterAvatar` (reuse the one `FeedPostCard` uses), „ÉLŐBEN · A CSAPAT BESZÉL", the one-line text, the coral unread count; the whole strip is a button → `/mezo/elo`.
- [ ] Tests: hidden on an empty day; shows speaker + text; count disappears after visiting (`lastSeen`); Nap row links to `/mezo/elo`; flag off → the listener does not call `InterventionService`.
- [ ] red → green → commit `feat(insights): live strip on the wall + Nap hand-off; advice card behind a flag (mezo-a9bo7.24)`.

### E4 gates + merge + deploy check
- [ ] FE both modes + build; focused backend; codemap. Merge. After CI deploys, flip prod config (`MEZO_FEATURE_TEAM_CHAT_ENABLED=true`, `MEZO_PROACTIVE_ADVICE_CARD_ENABLED=false`) where the other `MEZO_FEATURE_*` envs live (see `docs/infrastructure/` for the k3s Deployment); verify `/mezo` shows the strip only once a line exists.

---

# E5 — Az esti összefoglaló + doksik (bead `mezo-a9bo7.25`)

### Task 15: `team_chat_day` edition candidate

**Files:**
- Modify: `feature/character/service/edition/EditionCandidateCollector.java` (+ the genre enum if genres are enumerated), `EditionSelector` weights if needed
- Test: extend `EditionCandidateCollectorIT`

**Interfaces:**
- Candidate (only when the day had ≥ 1 thread opened or resolved): host MEZO, genre like the other „napi" candidates (read `fuel_day`'s shape at `:274` and mirror it), `recordText` = „Ma <n> ügyön dolgoztunk: <ruleLabel list>. <r> rendeződött, <o> nyitva maradt.", `facts` = `[n, r, o]` as strings, deep link `/mezo/elo?d=<date>` (the page accepts `?d=` → `useTeamChat(d)`; add that in this task if E4 did not).
- [ ] Test: a day with 2 threads (1 resolved) yields one candidate with the three facts; a day with none yields nothing. red → green → commit `feat(character): evening edition recaps the day's team chat (mezo-a9bo7.25)`.

### Task 16: Docs

**Files:**
- Create: `docs/decisions/0053-csapat-elo-beszelgetes.md` (ADR: the chat replaces the daily advice card as the advice's home; speak-on-transition; 2-push budget; guarded voice under a 1 USD cap; supersedes the "one card per day" parts of W5.2)
- Modify: `docs/features/character.md` (new §Csapat-chat: model, events, API, push, budget), `docs/features/proactive.md` + `docs/features/companion.md` (fix the stale lines the spec §4 lists: "LLM-free"/"never an LLM call", "one card per day, first raise wins", "13 rules" → 16; note the card is now behind `mezo.proactive.advice-card.enabled`), `docs/features/insights.md` (LiveStrip, TeamChatPage), `docs/CODEMAP.md` (regenerate)
- [ ] `node scripts/lint-docs.mjs` clean → commit `docs: csapat élő beszélgetés — ADR 0053 + feature docs (mezo-a9bo7.25)`.

### E5 gates + merge; close `mezo-a9bo7.20` (Act III) with a summary; beads backup (`node scripts/check-beads-backup.mjs --fix`), push.
