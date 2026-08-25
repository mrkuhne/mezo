# W5.2 Event-driven interventions (JITAI-lite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A raised W5.1 flag picks the best-weighted intervention from a config library and delivers it as a `companion_message` feed card (new kind `intervention`) plus an optional push (new `NotificationCategory.INTERVENTION`) with quiet-hours deferral and per-key cooldown; the card's „Segített?" chips close the W4.2 loop via `intervention:<key>` rollups.

**Architecture:** `FlagService` (W5.1) publishes a `FlagRaisedEvent` per written raise → an AFTER_COMMIT async listener in `feature.proactive` runs `InterventionService` (pure code, no LLM): library filter by flag → per-key cooldown → W4.2 effectiveness weighting → one `companion_message(kind=intervention)` card per day. The push rides the existing dispatcher: `AnchorResolver` anchors on the card row's own generation minute, deferred (never dropped) out of quiet hours; `DueEvaluator`/`push_log` stay unchanged. `FeedbackLearningService` gains `intervention:<key>` rollup scopes read back by the next selection.

**Tech Stack:** Spring Boot 3 (events, `@ConfigurationProperties` records, Liquibase SQL migrations), Testcontainers ITs, OpenAPI contract-first, React/TS FE (dual-mode).

**Driving bd issue:** `mezo-b3pp.19` — every commit subject carries it.

## Global Constraints (spec §11 + house rules)

- Contract-first: `api/feature/proactive/proactive.yml` changes BEFORE backend code; regen both sides (`cd api/generate && npm run generate:api`; `cd frontend && pnpm generate:api`).
- **No LLM call anywhere in this slice** — intervention text comes from config (`textHu`); therefore no `LlmCallContextHolder` tagging is needed (nothing to tag).
- Config keys exactly as the spec names them: library at `mezo.companion.interventions`, quiet hours at `mezo.notification.quiet-hours` (`start`/`end`, default 22:00–07:00).
- All tunables `@Validated` config — never code constants (one exception: the optimistic prior for unseen keys, a named constant with javadoc, spec-mandated behavior not a tunable).
- **Decision (user-approved 2026-08-24): `channel=push` ≡ `both`.** Every intervention writes the feed card (it is the push anchor AND the „Segített?" home); `channel` only decides whether a push also fires (`feed` = card only). Document this at the config site and in `companion.md`.
- **Decision (companion_message idiom):** the partial unique index allows ONE live intervention card per user+day — the first raise of the day wins; later same-day raises are skipped with a `log.info`. Documented in `companion.md`.
- No new tables ⇒ no `ResetDatabase` change; `companion_message`, `message_feedback`, `feedback_rollup`, `companion_flag_log` are already truncated.
- Integration-first tests; pure computation gets a plain unit test (the `DueEvaluator` idiom).
- Migration file name carries the bd id: `2026….._mezo-b3pp.19_….sql`.
- Backend focused tests only locally (`./mvnw clean test -Dtest='…'` with docker compose up); the full suite is CI's job.
- FE: both test modes green (`pnpm test` AND `VITE_USE_MOCK=true pnpm test`) + `pnpm build`.
- Docs in the same change: `docs/features/companion.md` (W5.2 §), `docs/features/_platform-notifications.md` (new category + quiet hours), `docs/features/proactive.md` (new feed kind); then `node scripts/lint-docs.mjs` — no new staleness.
- Commit style: `feat(companion): … (mezo-b3pp.19)`.

## File Structure (locked decomposition)

| File | Responsibility |
|---|---|
| `backend/src/main/resources/db/changelog/1.0.0/script/202608241500_mezo-b3pp.19_companion_message_intervention_kind.sql` | CK expansion: `intervention` becomes a legal `companion_message.kind` |
| `backend/…/feature/proactive/entity/CompanionMessageEntity.java` | `KIND_INTERVENTION` constant |
| `backend/…/feature/proactive/entity/CompanionMessageEnvelope.java` | new nullable `interventionKey` component + 3-arg convenience ctor |
| `api/feature/proactive/proactive.yml` | `FeedMessageResponse.kind` enum += `intervention` |
| `backend/…/techcore/configuration/FeaturesConfiguration.java` | `INTERVENTION_SWITCH` |
| `backend/…/feature/companion/config/CompanionProperties.java` | `interventions` list (`Intervention` record) |
| `backend/src/main/resources/application.yml` | feature switch + default library + quiet-hours block |
| `backend/…/feature/companion/flags/service/FlagRaisedEvent.java` | event record |
| `backend/…/feature/companion/flags/service/FlagService.java` | publish `FlagRaisedEvent` per written raise |
| `backend/…/feature/proactive/service/InterventionService.java` | selection + card write |
| `backend/…/feature/proactive/service/InterventionEventListener.java` | AFTER_COMMIT async glue |
| `backend/…/feature/proactive/repository/CompanionMessageRepository.java` | `findByCreatedByAndKindAndGeneratedAtAfter` |
| `backend/…/feature/notification/domain/NotificationCategory.java` | `INTERVENTION` |
| `backend/…/feature/notification/config/NotificationProperties.java` | `QuietHours quietHours` |
| `backend/…/feature/notification/service/AnchorResolver.java` | `interventionAnchors` + pure `interventionFireMinute` |
| `backend/…/feature/companion/feedback/entity/FeedbackRollupEntity.java` | `SCOPE_INTERVENTION_PREFIX` |
| `backend/…/feature/companion/feedback/service/FeedMessageKindSource.java` | `KIND_INTERVENTION` + `interventionKeysByIds` |
| `backend/…/feature/proactive/service/FeedMessageKindService.java` | implement `interventionKeysByIds` |
| `backend/…/feature/companion/feedback/service/FeedbackLearningService.java` | `intervention:<key>` scopes |
| `frontend/src/data/types.ts` | `FeedMessageKind` + `NotificationCategoryKey` += `intervention` |
| `frontend/src/features/today/logic/mezoMessages.ts` | pass `kind` through to items |
| `frontend/src/features/today/components/MezoMessagesSheet.tsx` | „Segített?" chip variant on intervention cards |
| `frontend/src/data/notification/notificationMock.ts` + `frontend/src/features/me/logic/notificationForecast.ts` (+ any other `decision_review` mirror sites) | FE category catalog mirrors |
| `docs/features/companion.md`, `docs/features/_platform-notifications.md`, `docs/features/proactive.md` | docs mandate |

Interface contracts used across tasks (exact names):

- `FlagRaisedEvent(UUID userId, String flagKey, String source)` — record, package `io.mrkuhne.mezo.feature.companion.flags.service`.
- `InterventionService.deliverForFlag(UUID userId, String flagKey)` → `Optional<CompanionMessageEntity>`.
- `CompanionProperties.Intervention(String key, String flag, String channel, String textHu, int cooldownHours, boolean quietHoursExempt)`; `CompanionProperties.interventions()` → `List<Intervention>`.
- `NotificationProperties.QuietHours(String start, String end)`; accessor `notificationProperties.quietHours()`.
- `FeedMessageKindSource.interventionKeysByIds(UUID userId, Collection<UUID> feedMessageIds)` → `Map<UUID, String>`.
- `FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX = "intervention:"`.
- `CompanionMessageEntity.KIND_INTERVENTION = "intervention"`.
- `AnchorResolver.interventionFireMinute(LocalDateTime generatedAt, LocalDate targetDate, boolean quietHoursExempt, LocalTime quietStart, LocalTime quietEnd)` → `OptionalInt` (static, package-private).

---

### Task 1: Migration + entity/envelope groundwork

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608241500_mezo-b3pp.19_companion_message_intervention_kind.sql`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEntity.java` (constants block)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEnvelope.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/CompanionMessagePopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageInterventionPersistenceIT.java`

**Interfaces:**
- Consumes: existing `companion_message` DDL (`202608151200_mezo-gst9_create_companion_message.sql`), `OwnedEntity`, `AbstractIntegrationTest`.
- Produces: `KIND_INTERVENTION`, 4-component `CompanionMessageEnvelope` (with `interventionKey`), populator overload `createIntervention(UUID owner, LocalDate date, String interventionKey, String text, Instant generatedAt)` — Tasks 4–7 rely on these.

- [ ] **Step 1: Register the migration in the changelog.** Look at how the sibling scripts are included (check `backend/src/main/resources/db/changelog/` for the `1.0.0` changelog XML/YAML that lists `202608241200_mezo-b3pp.18_create_companion_flag_log.sql` and add the new file the same way, after it).

- [ ] **Step 2: Write the migration.**

```sql
-- W5.2 (bd mezo-b3pp.19, spec §9.2): the intervention feed card is a sixth companion_message
-- kind. CK swap only — table shape, partial unique index (one LIVE row per user+day+kind) and
-- write path are unchanged; the one-per-day consequence for interventions is deliberate
-- (anti-nagging: the first raise of the day wins).

alter table companion_message drop constraint ck_companion_message_kind;
alter table companion_message add constraint ck_companion_message_kind
    check (kind in ('morning','sleep','weight','midday','evening','intervention'));
```

- [ ] **Step 3: Entity + envelope.** In `CompanionMessageEntity` add below `KIND_EVENING`:

```java
    /** W5.2 (bd mezo-b3pp.19): config-text intervention card — the only kind whose envelope
     *  carries an {@code interventionKey}; never LLM-generated. */
    public static final String KIND_INTERVENTION = "intervention";
```

Replace `CompanionMessageEnvelope` with:

```java
/**
 * Typed jsonb envelope for companion_message.content (ADR 0006 / ProvenanceEnvelope precedent).
 * Refs are code-collected candidates the model selected by index (never invented).
 * {@code interventionKey} (W5.2, bd mezo-b3pp.19) is set ONLY on {@code kind=intervention} rows —
 * it names the library entry (`mezo.companion.interventions[].key`) so the „Segített?" verdict can
 * be rolled up per-intervention; null on every other kind (old rows deserialize to null).
 */
public record CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                       String interventionKey) {

    /** The pre-W5.2 shape — every non-intervention writer stays on this. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs) {
        this(eyebrow, body, refs, null);
    }

    public record Ref(String kind, String label) {
    }
}
```

(No other call site changes: `CompanionMessageGenerator`'s four `new CompanionMessageEnvelope(eyebrow, body, refs)` calls hit the convenience ctor.)

- [ ] **Step 4: Populator overload.** Add to `CompanionMessagePopulator`:

```java
    /** W5.2 intervention card (bd mezo-b3pp.19) — kind + envelope interventionKey in one shot. */
    public CompanionMessageEntity createIntervention(
            UUID owner, LocalDate date, String interventionKey, String text, Instant generatedAt) {
        CompanionMessageEntity entity = new CompanionMessageEntity();
        entity.setCreatedBy(owner);
        entity.setMessageDate(date);
        entity.setKind(CompanionMessageEntity.KIND_INTERVENTION);
        entity.setContent(new CompanionMessageEnvelope("Mezo · észrevétel", List.of(text), List.of(), interventionKey));
        entity.setGeneratedAt(generatedAt);
        return companionMessageRepository.saveAndFlush(entity);
    }
```

- [ ] **Step 5: Write the failing IT** (`CompanionMessageInterventionPersistenceIT`, extends `AbstractIntegrationTest`; mirror `CompanionFlagLogPersistenceIT`'s style — read that file first):

```java
class CompanionMessageInterventionPersistenceIT extends AbstractIntegrationTest {

    @Autowired CompanionMessagePopulator companionMessagePopulator;
    @Autowired CompanionMessageRepository companionMessageRepository;
    @PersistenceContext EntityManager em; // if the house style uses a native-insert helper, mirror it

    @Test
    void interventionRowRoundTripsWithKey() {
        UUID owner = defaultUserId(); // use the house helper AbstractIntegrationTest exposes
        var row = companionMessagePopulator.createIntervention(
            owner, LocalDate.parse("2026-08-24"), "stress_reset", "Tarts szünetet.", Instant.now());
        var reloaded = companionMessageRepository.findById(row.getId()).orElseThrow();
        assertThat(reloaded.getKind()).isEqualTo(CompanionMessageEntity.KIND_INTERVENTION);
        assertThat(reloaded.getContent().interventionKey()).isEqualTo("stress_reset");
        // old-shape rows stay readable: a kind with the 3-arg envelope has a null key
        var morning = companionMessagePopulator.createMessage(
            owner, LocalDate.parse("2026-08-24"), CompanionMessageEntity.KIND_MORNING, "Mezo", List.of("Szia"));
        assertThat(companionMessageRepository.findById(morning.getId()).orElseThrow()
            .getContent().interventionKey()).isNull();
    }

    @Test
    void unknownKindStillTripsTheCheck() {
        // native insert so the DB CK (not a JPA validator) is what rejects — FlagLogPopulator idiom
        assertThatThrownBy(() -> em.createNativeQuery(
                "insert into companion_message (created_by, message_date, kind, content, generated_at) "
                + "values (:u, '2026-08-24', 'nonsense', '{}'::jsonb, now())")
            .setParameter("u", defaultUserId()).executeUpdate())
            .hasMessageContaining("ck_companion_message_kind");
    }
}
```

Adapt owner-id acquisition and native-insert transaction handling to what `CompanionFlagLogPersistenceIT` actually does — copy its skeleton.

- [ ] **Step 6: Run:** `cd backend && ./mvnw test -Dtest='CompanionMessageInterventionPersistenceIT' -Dmezo.test.use-testcontainers=true` → both tests PASS (migration applied, envelope round-trips).

- [ ] **Step 7: Commit** — `feat(companion): intervention kind on companion_message + envelope key (mezo-b3pp.19)`.

---

### Task 2: Contract — `intervention` feed kind

**Files:**
- Modify: `api/feature/proactive/proactive.yml` (FeedMessageResponse.kind enum, ~line 288)
- Regenerated: backend generated API + `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: `FeedMessageResponse.KindEnum.INTERVENTION` (backend), `'intervention'` in the FE wire type. `ProactiveMapper.map(String)` uses `KindEnum.fromValue` — no mapper change needed.

- [ ] **Step 1:** In `proactive.yml` change the enum to `enum: [morning, sleep, weight, midday, evening, intervention]` and extend the `FeedMessageResponse` field docs: the `intervention` kind's body is config text (`mezo.companion.interventions`), never LLM output.
- [ ] **Step 2:** `cd api/generate && npm run generate:api` then `cd ../../frontend && pnpm generate:api`.
- [ ] **Step 3:** `cd backend && ./mvnw test -Dtest='CompanionMessageInterventionPersistenceIT' -Dmezo.test.use-testcontainers=true` (compiles the regenerated API; fast smoke) and `cd frontend && pnpm build` → both green.
- [ ] **Step 4: Commit** — `feat(api): intervention feed-message kind (mezo-b3pp.19)`.

---

### Task 3: Config — switch, library, validation

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionConfigIT.java`

**Interfaces:**
- Produces: `FeaturesConfiguration.INTERVENTION_SWITCH = "mezo.feature.intervention.enabled"`; `CompanionProperties.interventions()` returning `List<Intervention>`; the default library below (Tasks 4–6 ITs reference these exact keys).

- [ ] **Step 1: Switch constant** (follow the file's javadoc style):

```java
    /** W5.2 JITAI-lite interventions (bd mezo-b3pp.19) — flag-raise → config-library feed card
     *  (+ optional push). Off ⇒ no InterventionService/listener beans: flags keep logging
     *  (W5.1 is independent), but nothing is ever delivered. Needs COMPANION_SWITCH and
     *  PROACTIVE_SWITCH too (the card is a companion_message row). */
    public static final String INTERVENTION_SWITCH = "mezo.feature.intervention.enabled";
```

- [ ] **Step 2: `CompanionProperties`** — add a component `@NotNull List<@Valid Intervention> interventions` (after `graph`) and the nested record:

```java
    /**
     * One W5.2 intervention library entry (bd mezo-b3pp.19, spec §9.2) — the library is CONFIG,
     * not DB. {@code channel}: {@code feed} = card only; {@code push} and {@code both} are
     * synonyms (user decision 2026-08-24) — every entry writes the feed card (it is the push
     * anchor and the „Segített?" home), the channel only decides whether a push also fires.
     * {@code key} feeds the {@code feedback_rollup} scope {@code intervention:<key>} (varchar(40)
     * minus the 13-char prefix ⇒ max 27).
     */
    public record Intervention(
        @NotBlank @Pattern(regexp = "[a-z0-9_]{1,27}") String key,
        @NotBlank @Pattern(regexp = "sustained_stress|sleep_debt|momentum_at_risk|recovery_needed|all_healthy") String flag,
        @NotBlank @Pattern(regexp = "feed|push|both") String channel,
        @NotBlank @Size(max = 500) String textHu,
        @Min(1) @Max(8760) int cooldownHours,
        boolean quietHoursExempt
    ) {
    }
```

- [ ] **Step 3: application.yml.** Feature switch under `mezo.feature` (after `knowledge-graph`):

```yaml
    # Phase 5 W5.2 (bd mezo-b3pp.19) — JITAI-lite: flag raise -> best-weighted intervention card
    # (+ optional push). Off ⇒ no delivery beans; W5.1 flag logging is unaffected.
    intervention:
      enabled: true
```

Library under `mezo.companion` (after the `flags:` block — same neighborhood as its trigger):

```yaml
    # W5.2 (bd mezo-b3pp.19, spec §9.2): the intervention library — config, not DB. Selection per
    # raised flag: highest W4.2 effectiveness (feedback_rollup intervention:<key>), unseen keys
    # optimistic; per-key cooldown-hours below; ONE card per day (first raise wins). channel:
    # feed = card only; push/both = card + push (push ≡ both — the card is the push anchor and
    # the „Segített?" home, so it always exists; user decision 2026-08-24).
    interventions:
      - key: stress_reset
        flag: sustained_stress
        channel: both
        text-hu: "Több napja magas a stressz-szinted. Ma este tarts egy tudatos lezárást: tíz perc séta vagy légzőgyakorlat, képernyő nélkül."
        cooldown-hours: 48
        quiet-hours-exempt: false
      - key: stress_talk
        flag: sustained_stress
        channel: feed
        text-hu: "Ha szeretnéd, írd ki magadból, mi nyomaszt mostanában — néha a kimondás már felezi a terhet."
        cooldown-hours: 72
        quiet-hours-exempt: false
      - key: sleep_recover_tonight
        flag: sleep_debt
        channel: both
        text-hu: "Az elmúlt éjszakák alváshiánya összeadódott. Ma este told előre a villanyoltást fél órával — a hétvégi pótalvás nem váltja ki."
        cooldown-hours: 48
        quiet-hours-exempt: false
      - key: momentum_small_win
        flag: momentum_at_risk
        channel: both
        text-hu: "Megtorpant a lendület. Válassz mára egyetlen apró, biztosan teljesíthető szokást — egy kis győzelem újraindítja a sorozatot."
        cooldown-hours: 72
        quiet-hours-exempt: false
      - key: recovery_rest_day
        flag: recovery_needed
        channel: both
        text-hu: "Kevés alvás, kemény edzés, magas stressz — a tested most regenerációt kér. A mai nap legyen pihenő vagy egészen könnyű mozgás."
        cooldown-hours: 48
        quiet-hours-exempt: false
      - key: healthy_celebrate
        flag: all_healthy
        channel: feed
        text-hu: "Egy hete minden mutatód rendben — alvás, stressz, lendület. Ez nem szerencse: a rendszered működik. Vedd észre, és élvezd."
        cooldown-hours: 168
        quiet-hours-exempt: false
```

- [ ] **Step 4: Write the failing IT** (`InterventionConfigIT extends AbstractIntegrationTest`):

```java
    @Autowired CompanionProperties companionProperties;

    @Test
    void libraryBindsCoversEveryFlagAndKeysAreUnique() {
        var lib = companionProperties.interventions();
        assertThat(lib).isNotEmpty();
        assertThat(lib.stream().map(CompanionProperties.Intervention::key))
            .doesNotHaveDuplicates();
        // every W5.1 flag has at least one entry — a raised flag must never be undeliverable
        assertThat(lib.stream().map(CompanionProperties.Intervention::flag).distinct())
            .containsExactlyInAnyOrder(FlagKey.SUSTAINED_STRESS, FlagKey.SLEEP_DEBT,
                FlagKey.MOMENTUM_AT_RISK, FlagKey.RECOVERY_NEEDED, FlagKey.ALL_HEALTHY);
    }
```

- [ ] **Step 5: Run:** `./mvnw test -Dtest='InterventionConfigIT' -Dmezo.test.use-testcontainers=true` → PASS.
- [ ] **Step 6: Commit** — `feat(companion): W5.2 intervention library config + switch (mezo-b3pp.19)`.

---

### Task 4: `FlagRaisedEvent` publication

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagRaisedEvent.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagService.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagServiceIT.java`

**Interfaces:**
- Produces: `FlagRaisedEvent(UUID userId, String flagKey, String source)` — Task 5's listener consumes it.

- [ ] **Step 1: Event record:**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import java.util.UUID;

/**
 * Published by {@link FlagService} for every raise that actually got WRITTEN (post-cooldown) —
 * W5.2's (bd mezo-b3pp.19) delivery trigger. Published inside the logging transaction, so an
 * AFTER_COMMIT listener only ever reacts to raises that persisted (the ChatTurnCompleted
 * precedent); a rolled-back raise delivers nothing.
 */
public record FlagRaisedEvent(UUID userId, String flagKey, String source) {
}
```

- [ ] **Step 2: Publish.** In `FlagService` inject `org.springframework.context.ApplicationEventPublisher eventPublisher` (new final field) and inside the write loop, right after `written.add(raise.flagKey());`, add:

```java
            eventPublisher.publishEvent(new FlagRaisedEvent(userId, raise.flagKey(), source));
```

- [ ] **Step 3: Failing test.** Read `FlagServiceIT` first and extend it. Annotate the class (or a nested test) with `@RecordApplicationEvents` and assert:

```java
    @Autowired ApplicationEvents applicationEvents; // with @RecordApplicationEvents on the class

    @Test
    void writtenRaisePublishesFlagRaisedEvent() {
        // reuse the IT's existing seeding that makes exactly one flag raise (e.g. its
        // sustained-stress fixture) — then:
        flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP);
        assertThat(applicationEvents.stream(FlagRaisedEvent.class))
            .anySatisfy(e -> {
                assertThat(e.userId()).isEqualTo(owner);
                assertThat(e.source()).isEqualTo(FlagKey.SOURCE_SWEEP);
            });
        // a cooldown-suppressed second run publishes nothing new
        applicationEvents.clear();
        flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP);
        assertThat(applicationEvents.stream(FlagRaisedEvent.class)).isEmpty();
    }
```

(If `@RecordApplicationEvents` clashes with the IT's transaction setup, fall back to a `@TestComponent` listener collecting events — mirror whatever the codebase already does for event assertions; grep `ApplicationEvents\|RecordApplicationEvents` in `src/test` first.)

- [ ] **Step 4: Run** `./mvnw test -Dtest='FlagServiceIT' -Dmezo.test.use-testcontainers=true` → PASS.
- [ ] **Step 5: Commit** — `feat(companion): FlagService publishes FlagRaisedEvent per written raise (mezo-b3pp.19)`.

---

### Task 5: `InterventionService` + listener (selection + card write)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionEventListener.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/CompanionMessageRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionServiceIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionSwitchOffIT.java`

**Interfaces:**
- Consumes: `FlagRaisedEvent` (Task 4), `CompanionProperties.Intervention` (Task 3), `KIND_INTERVENTION` + envelope (Task 1), `FeedbackRollupRepository.findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(UUID, String, int)`, `FeedbackLearningProperties.windowDays()`.
- Produces: `InterventionService.deliverForFlag(UUID userId, String flagKey)` → `Optional<CompanionMessageEntity>`; repo method `List<CompanionMessageEntity> findByCreatedByAndKindAndGeneratedAtAfter(UUID createdBy, String kind, Instant after)`.

- [ ] **Step 1: Repo method** (derived query, no annotation needed):

```java
    /** W5.2 per-key cooldown lookback (bd mezo-b3pp.19): recent intervention cards, key read
     *  from the envelope in memory — single-user volumes, no jsonb query needed. */
    List<CompanionMessageEntity> findByCreatedByAndKindAndGeneratedAtAfter(
            UUID createdBy, String kind, Instant after);
```

- [ ] **Step 2: `InterventionService`:**

```java
package io.mrkuhne.mezo.feature.proactive.service;

// imports: CompanionProperties (+ .Intervention), FeedbackLearningProperties,
// FeedbackRollupEntity, FeedbackRollupRepository, CompanionMessageEntity/Envelope/Repository,
// FeaturesConfiguration, java.time.*, java.util.*, lombok, ConditionalOnProperty, Service,
// Transactional

/**
 * W5.2 delivery (bd mezo-b3pp.19, spec §9.2) — flag raise → the best-weighted library entry as a
 * {@code companion_message} feed card. PURE CODE: the text is config ({@code textHu}), never an
 * LLM call, so there is nothing to tag with LlmCallContextHolder.
 *
 * <p><b>Selection:</b> entries for the flag → drop keys used within their own cooldown-hours
 * (recent intervention cards' envelope keys) → pick the highest W4.2 effectiveness
 * ({@code feedback_rollup} scope {@code intervention:<key>}, up/total); a key with no votes yet
 * gets {@link #OPTIMISTIC_PRIOR} — the spec's "unseen entries get optimistic default", i.e. a new
 * entry is always tried before a proven-mediocre one. Ties keep config order (Stream.max keeps
 * the FIRST max under a strict comparator).
 *
 * <p><b>One card per day</b> (the partial unique index — first raise wins): a second same-day
 * raise of ANY flag delivers nothing (anti-nagging), logged at info.
 *
 * <p>The push half is NOT here: {@code AnchorResolver} anchors on the card row and applies
 * quiet-hours deferral + the channel gate (feed = no push).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.INTERVENTION_SWITCH},
        havingValue = "true")
public class InterventionService {

    /** Unseen keys rank above ANY voted ratio (max real effectiveness is 1.0). Spec-mandated
     *  optimism, not a tunable: exploration must beat exploitation until a first vote lands. */
    static final double OPTIMISTIC_PRIOR = 1.5;

    public static final String EYEBROW = "Mezo · észrevétel";

    private final CompanionProperties companionProperties;
    private final FeedbackLearningProperties feedbackLearningProperties;
    private final FeedbackRollupRepository feedbackRollupRepository;
    private final CompanionMessageRepository companionMessageRepository;

    @Transactional
    public Optional<CompanionMessageEntity> deliverForFlag(UUID userId, String flagKey) {
        LocalDate today = LocalDate.now();
        if (companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                userId, today, CompanionMessageEntity.KIND_INTERVENTION).isPresent()) {
            log.info("Intervention for {} skipped for user {}: today's card already exists", flagKey, userId);
            return Optional.empty();
        }
        List<CompanionProperties.Intervention> candidates = companionProperties.interventions().stream()
            .filter(entry -> entry.flag().equals(flagKey))
            .filter(entry -> !inCooldown(userId, entry))
            .toList();
        if (candidates.isEmpty()) {
            log.info("Intervention for {} skipped for user {}: no eligible library entry", flagKey, userId);
            return Optional.empty();
        }
        CompanionProperties.Intervention picked = candidates.stream()
            .max(Comparator.comparingDouble(entry -> effectiveness(userId, entry.key())))
            .orElseThrow();
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(today);
        row.setKind(CompanionMessageEntity.KIND_INTERVENTION);
        row.setContent(new CompanionMessageEnvelope(EYEBROW, List.of(picked.textHu()), List.of(), picked.key()));
        row.setGeneratedAt(Instant.now());
        CompanionMessageEntity saved = companionMessageRepository.saveAndFlush(row);
        log.info("Intervention {} delivered for user {} (flag {})", picked.key(), userId, flagKey);
        return Optional.of(saved);
    }

    /** The same key must not repeat inside its own cooldown window — envelope keys of recent
     *  cards, filtered in memory (single-user volumes, spec §12). */
    private boolean inCooldown(UUID userId, CompanionProperties.Intervention entry) {
        Instant since = Instant.now().minus(entry.cooldownHours(), ChronoUnit.HOURS);
        return companionMessageRepository
            .findByCreatedByAndKindAndGeneratedAtAfter(userId, CompanionMessageEntity.KIND_INTERVENTION, since)
            .stream()
            .anyMatch(row -> entry.key().equals(row.getContent().interventionKey()));
    }

    private double effectiveness(UUID userId, String key) {
        return feedbackRollupRepository.findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(
                userId, FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + key,
                feedbackLearningProperties.windowDays())
            .map(rollup -> {
                Integer total = rollup.getStats().total();
                Integer up = rollup.getStats().up();
                return (total == null || total == 0 || up == null)
                    ? OPTIMISTIC_PRIOR : up / (double) total;
            })
            .orElse(OPTIMISTIC_PRIOR);
    }
}
```

Note: `SCOPE_INTERVENTION_PREFIX` lands on `FeedbackRollupEntity` in THIS task (one line, `public static final String SCOPE_INTERVENTION_PREFIX = "intervention:";` under the other scope constants) so the service compiles; Task 7 builds the writer side.

- [ ] **Step 3: Listener** (mirror `CompanionMessageEventListener`'s shape exactly):

```java
package io.mrkuhne.mezo.feature.proactive.service;

/**
 * W5.2 glue (bd mezo-b3pp.19): a persisted flag raise → intervention delivery, AFTER_COMMIT (only
 * raises that really logged) and {@code @Async} off the raising thread (the
 * CompanionMessageEventListener template — a slow DB moment must never delay a check-in save).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.INTERVENTION_SWITCH},
        havingValue = "true")
public class InterventionEventListener {

    private final InterventionService interventionService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFlagRaised(FlagRaisedEvent event) {
        try {
            interventionService.deliverForFlag(event.userId(), event.flagKey());
        } catch (Exception e) {
            log.warn("Intervention delivery failed for user {} flag {}", event.userId(), event.flagKey(), e);
        }
    }
}
```

- [ ] **Step 4: Failing ITs.** `InterventionServiceIT extends AbstractIntegrationTest` — inject `InterventionService`, `CompanionMessagePopulator`, `CompanionMessageRepository`, `FeedbackRollupRepository`, `FeedbackLearningProperties`. Helper to seed a rollup row:

```java
    private void seedRollup(UUID owner, String key, int up, int down) {
        FeedbackRollupEntity e = new FeedbackRollupEntity();
        e.setCreatedBy(owner);
        e.setScope(FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + key);
        e.setWindowDays(feedbackLearningProperties.windowDays());
        e.setStats(FeedbackRollupStatsEnvelope.effectiveness(up, down));
        e.setComputedAt(Instant.now());
        feedbackRollupRepository.saveAndFlush(e);
    }
```

Tests (default library keys from Task 3):
1. `raisedFlagWritesTheCard` — `deliverForFlag(owner, FlagKey.RECOVERY_NEEDED)` → card exists, kind `intervention`, `interventionKey = "recovery_rest_day"`, body text = the config `textHu`, eyebrow `Mezo · észrevétel`, refs empty.
2. `higherEffectivenessWins` — seed `stress_reset` (up 1, down 3 → 0.25) and `stress_talk` (up 3, down 1 → 0.75); `deliverForFlag(owner, FlagKey.SUSTAINED_STRESS)` picks `stress_talk`.
3. `unseenKeyBeatsVotedKey` — seed ONLY `stress_talk` (up 3, down 1); unseen `stress_reset` wins (optimistic prior).
4. `perKeyCooldownSkipsToNextBest` — populator `createIntervention(owner, today.minusDays(1), "stress_reset", "…", Instant.now().minus(12, HOURS))` (12h < 48h cooldown); seed nothing → both unseen, but `stress_reset` in cooldown ⇒ `stress_talk` picked.
5. `allKeysInCooldownDeliversNothing` — recent cards for both stress keys (yesterday's card counts for cooldown but NOT for today's uniqueness) → empty Optional, no new row today.
6. `secondCardSameDayIsSkipped` — deliver `RECOVERY_NEEDED` (card lands), then deliver `SLEEP_DEBT` → empty, still exactly 1 intervention row today.
7. `listenerDeliversAfterCommit` — publish path e2e: seed the flag fixture `FlagServiceIT` uses, call `flagService.evaluateAndLog(...)` (needs `FlagService` autowired), then `Awaitility.await().atMost(5, SECONDS)` for the card row (the listener is `@Async`). Grep `Awaitility` in `src/test` first; if the codebase has no Awaitility precedent, poll in a small loop with `Thread.sleep(100)` up to 5s — mirror whatever async-listener ITs already do (e.g. tests around `CompanionMessageEventListener`), and if none exist, skip this test and note it: the listener is glue mirrored from a proven template.

`InterventionSwitchOffIT` — `@TestPropertySource(properties = "mezo.feature.intervention.enabled=false")`, assert `applicationContext.getBeansOfType(InterventionService.class)` is empty and a `flagService.evaluateAndLog` raise writes the flag log but no intervention card exists afterwards. (Mirror the house SwitchOffIT pattern — grep `SwitchOffIT` for the idiom.)

- [ ] **Step 5: Run** `./mvnw test -Dtest='InterventionServiceIT,InterventionSwitchOffIT' -Dmezo.test.use-testcontainers=true` → PASS.
- [ ] **Step 6: Commit** — `feat(companion): W5.2 intervention selection + feed-card delivery (mezo-b3pp.19)`.

---

### Task 6: Push — category, quiet hours, anchor

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/NotificationCategory.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/config/NotificationProperties.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.notification.quiet-hours`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/AnchorSet.java` (javadoc only: backendAnchors list gains intervention)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/NotificationPrefApiIT.java` (21 → 22) + `NotificationCategoryTest` if it pins counts/keys (read it)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/service/InterventionFireMinuteTest.java` (pure), `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AnchorResolverInterventionIT.java`

**Interfaces:**
- Consumes: intervention cards (Task 5 shape — envelope `interventionKey`), `CompanionProperties.interventions()` (Task 3; NEW import direction notification → companion — verified: no companion → notification import exists, so no cycle; `feature_slices_are_cycle_free` stays green).
- Produces: `NotificationCategory.INTERVENTION` (key `intervention`, defaultEnabled true, lead 0, feWritten false); `NotificationProperties.quietHours()` — `QuietHours(String start, String end)`; static `AnchorResolver.interventionFireMinute(...)` → `OptionalInt`.

- [ ] **Step 1: Category** (after `DECISION_REVIEW`; bump the class javadoc's "21" to 22 and the split note accordingly):

```java
    /** Anchor: the intervention card's own generation minute, quiet-hours-DEFERRED (never
     *  dropped) to {@code mezo.notification.quiet-hours.end} — possibly onto the NEXT day
     *  (Phase 5 W5.2, bd mezo-b3pp.19). Channel-gated: a {@code channel=feed} library entry
     *  yields no anchor at all. */
    INTERVENTION("intervention", true, 0, false);
```

- [ ] **Step 2: Quiet-hours config.** `NotificationProperties` gains a component (document: W5.2 introduces quiet hours; TODAY only the intervention category consults it — widening it to every category is a later, deliberate decision, not a drive-by):

```java
        @NotNull @Valid QuietHours quietHours,
```

```java
    /** The do-not-disturb window (W5.2, bd mezo-b3pp.19). Wraps midnight when start > end
     *  (the 22:00→07:00 default). start == end means "no quiet hours". */
    public record QuietHours(
            @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String start,
            @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String end) {}
```

application.yml under `mezo.notification`:

```yaml
    # W5.2 (bd mezo-b3pp.19): do-not-disturb window — a non-exempt intervention push generated
    # inside it is DEFERRED to quiet-hours end (possibly next morning), never dropped. Only the
    # intervention category consults this today; widening it is a separate decision.
    quiet-hours:
      start: "22:00"
      end: "07:00"
```

- [ ] **Step 3: Pure defer computation** on `AnchorResolver` (static, package-private — the `DueEvaluator` testability idiom):

```java
    /**
     * When (if at all) an intervention card generated at {@code generatedAt} pushes on
     * {@code targetDate} (W5.2, bd mezo-b3pp.19). Non-exempt fires inside the quiet window are
     * deferred to the window's END — a 23:10 card lands at next-day 07:00, which is exactly why
     * this is computed per target date instead of assuming same-day: the resolver asks for
     * yesterday's cards too. Returns empty when the (deferred) fire lands on a different date.
     */
    static OptionalInt interventionFireMinute(LocalDateTime generatedAt, LocalDate targetDate,
            boolean quietHoursExempt, LocalTime quietStart, LocalTime quietEnd) {
        LocalDateTime fire = generatedAt;
        if (!quietHoursExempt && !quietStart.equals(quietEnd)) {
            LocalTime t = generatedAt.toLocalTime();
            boolean wraps = quietStart.isAfter(quietEnd);
            boolean quiet = wraps ? !t.isBefore(quietStart) || t.isBefore(quietEnd)
                                  : !t.isBefore(quietStart) && t.isBefore(quietEnd);
            if (quiet) {
                // defer to the NEXT quiet-end at or after the generation moment
                LocalDate endDay = (wraps && !t.isBefore(quietStart))
                        ? generatedAt.toLocalDate().plusDays(1) : generatedAt.toLocalDate();
                fire = endDay.atTime(quietEnd);
            }
        }
        if (!fire.toLocalDate().equals(targetDate)) {
            return OptionalInt.empty();
        }
        return OptionalInt.of(fire.getHour() * 60 + fire.getMinute());
    }
```

- [ ] **Step 4: Resolver wiring.** Inject `CompanionProperties companionProperties` into `AnchorResolver`; in `resolve(...)` add `backendAnchors.addAll(interventionAnchors(owner, date));` and implement:

```java
    // ---- intervention (companion_message kind=intervention, W5.2 bd mezo-b3pp.19) --------------

    /**
     * The card's own generation minute is the anchor (the sleep_reaction rule), except that a
     * non-exempt card generated in quiet hours is DEFERRED to quiet-hours end — possibly onto the
     * next day, which is why yesterday's card is consulted too. Channel gate: a library entry
     * with {@code channel=feed} (or a key no longer in the library — honest absence) yields no
     * push anchor at all. Dedup carries the row id fragment and the url a {@code ?n=}
     * discriminator (the feed-anchor shape): /today is also briefing/midday/evening's deeplink,
     * and push-sw.js uses the url as the notification tag — a bare /today intervention push would
     * REPLACE the day's briefing on the phone.
     */
    private List<AnchoredEvent> interventionAnchors(UUID owner, LocalDate date) {
        LocalTime quietStart = LocalTime.parse(notificationProperties.quietHours().start());
        LocalTime quietEnd = LocalTime.parse(notificationProperties.quietHours().end());
        List<AnchoredEvent> events = new ArrayList<>();
        for (LocalDate cardDate : List.of(date.minusDays(1), date)) {
            companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(owner, cardDate, CompanionMessageEntity.KIND_INTERVENTION)
                .ifPresent(msg -> {
                    String key = msg.getContent().interventionKey();
                    Optional<CompanionProperties.Intervention> entry = companionProperties.interventions()
                        .stream().filter(e -> e.key().equals(key)).findFirst();
                    if (entry.isEmpty() || "feed".equals(entry.get().channel())) {
                        return; // feed-only entry or retired key — no push, ever
                    }
                    LocalDateTime generatedAt =
                        LocalDateTime.ofInstant(msg.getGeneratedAt(), ZoneId.systemDefault());
                    interventionFireMinute(generatedAt, date, entry.get().quietHoursExempt(),
                            quietStart, quietEnd)
                        .ifPresent(minute -> {
                            String idFragment = msg.getId().toString().substring(0, 8);
                            events.add(new AnchoredEvent(NotificationCategory.INTERVENTION, minute,
                                hhmm(minute) + ":" + idFragment, "Mezo · észrevétel",
                                excerptProse(String.join(" ", msg.getContent().body())),
                                URL_TODAY + "?n=" + idFragment));
                        });
                });
        }
        return events;
    }
```

Also update `AnchorSet`'s `backendAnchors` javadoc line to name intervention, and the `dedupSuffix` javadoc's "7 categories" note to 8 (intervention keys off the card row id — one card per day makes it technically collision-free today, but yesterday's deferred card and today's card CAN both anchor on the same day, so the id form is load-bearing, not cosmetic).

- [ ] **Step 5: Pin count tests.** `NotificationPrefApiIT` `hasSize(21)` → `hasSize(22)`. Read `NotificationCategoryTest` — if it enumerates keys or counts, add `intervention`.

- [ ] **Step 6: Failing tests.**

`InterventionFireMinuteTest` (plain JUnit, no Spring) — table cases with `quietStart=22:00, quietEnd=07:00`:
- daytime 14:37 on D, target D → 877; target D+1 → empty
- 23:10 on D, target D → empty; target D+1 → 420 (07:00)
- 06:30 on D, target D → 420; target D+1 → empty
- 22:00 exactly on D (boundary, quiet) → D+1 420
- 07:00 exactly on D (boundary, NOT quiet) → D 420
- exempt 23:10 on D, target D → 23*60+10
- start == end (`"07:00","07:00"`) at 23:10 → fires at 23:10 on D (no quiet hours)

`AnchorResolverInterventionIT` (mirror `AnchorResolverIT`'s harness — read it first; it already seeds companion messages with controlled `generatedAt`):
1. both-channel card generated 14:37 today → resolving today yields an `INTERVENTION` anchor at minute 877, dedupSuffix `14:37:<id8>`, url `/today?n=<id8>`, body excerpted from `textHu`.
2. both-channel card generated 23:10 yesterday → resolving YESTERDAY yields no intervention anchor; resolving TODAY yields one at 420.
3. `channel=feed` card (`healthy_celebrate`) generated 14:37 today → no anchor.
4. card with a key absent from the library (`retired_key`) → no anchor.
(Seed via `companionMessagePopulator.createIntervention(owner, date, key, text, generatedAtInstant)` — compute the `Instant` from the local date-time with `ZoneId.systemDefault()`, the `AnchorResolverIT` precedent.)

- [ ] **Step 7: Run** `./mvnw test -Dtest='InterventionFireMinuteTest,AnchorResolverInterventionIT,NotificationPrefApiIT,NotificationCategoryTest' -Dmezo.test.use-testcontainers=true` → PASS.
- [ ] **Step 8: Commit** — `feat(notification): INTERVENTION category + quiet-hours deferred anchor (mezo-b3pp.19)`.

---

### Task 7: W4.2 loop — `intervention:<key>` rollups

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/FeedMessageKindSource.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FeedMessageKindService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/FeedbackLearningService.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/` learning IT (find the existing `FeedbackLearning*IT` and add cases there)

**Interfaces:**
- Consumes: `SCOPE_INTERVENTION_PREFIX` (landed in Task 5), `CompanionProperties.interventions()`.
- Produces: rollup rows `intervention:<key>` for EVERY configured library key (zero-filled when unseen — the "downstream reader never distinguishes no-row from no-signal" contract Task 5's selection relies on… note the selection also handles the no-row case, so ordering between Tasks 5/7 is safe either way).

- [ ] **Step 1: Port.** Add to `FeedMessageKindSource` (next to `KIND_EVENING`, same literal-mirror justification):

```java
    String KIND_INTERVENTION = "intervention";

    /** {@code (companion_message.id → envelope interventionKey)} for every id that is a live,
     *  user-owned intervention-kind row WITH a non-null key; every other id is absent. W5.2's
     *  (bd mezo-b3pp.19) per-intervention rollup join, same dangling-id contract as
     *  {@link #kindsByIds}. */
    Map<UUID, String> interventionKeysByIds(UUID userId, Collection<UUID> feedMessageIds);
```

- [ ] **Step 2: Impl** in `FeedMessageKindService`:

```java
    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> interventionKeysByIds(UUID userId, Collection<UUID> feedMessageIds) {
        if (feedMessageIds.isEmpty()) {
            return Map.of();
        }
        return companionMessageRepository.findAllById(feedMessageIds).stream()
            .filter(m -> userId.equals(m.getCreatedBy()))
            .filter(m -> CompanionMessageEntity.KIND_INTERVENTION.equals(m.getKind()))
            .filter(m -> m.getContent().interventionKey() != null)
            .collect(Collectors.toMap(CompanionMessageEntity::getId, m -> m.getContent().interventionKey()));
    }
```

- [ ] **Step 3: Rollup writer.** In `FeedbackLearningService`: inject `CompanionProperties companionProperties`; in `computeRollups` after the feed-kind loop add:

```java
        Map<UUID, String> interventionKeyById = feedMessageKindSource.interventionKeysByIds(userId,
            window.stream().filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
                .map(MessageFeedbackEntity::getArtifactId).toList());
        for (CompanionProperties.Intervention entry : companionProperties.interventions()) {
            List<MessageFeedbackEntity> verdicts = window.stream()
                .filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
                .filter(f -> entry.key().equals(interventionKeyById.get(f.getArtifactId())))
                .toList();
            upserted += upsertEffectiveness(userId,
                FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + entry.key(), windowDays, verdicts);
        }
```

Update the method's "always 11" javadoc to "11 + one per configured intervention key" (same zero-fill contract). Class javadoc: mention W5.2's per-intervention scopes ride the same pass. Note: an intervention verdict ALSO counts in `surface:feed_message` (it IS a feed_message artifact) — deliberate, documented; `feed:<kind>` scopes stay the five prose kinds (the per-key scope is the selection signal; a `feed:intervention` aggregate would duplicate it).

- [ ] **Step 4: Failing IT cases** (in the existing feedback-learning IT, reusing its populator idioms — read the file first; it already has `FeedbackPopulator` + a way to seed feed messages):
1. `interventionScopesAreZeroFilledForEveryLibraryKey` — run `computeRollups(owner)` with no votes → for each `companionProperties.interventions()` key a rollup row `intervention:<key>` exists with `up=0, down=0, total=0`.
2. `interventionVerdictRollsUpUnderItsKey` — `companionMessagePopulator.createIntervention(owner, today, "stress_reset", "…", Instant.now())`, then `feedbackPopulator` up-vote on `feed_message`/that row id → `computeRollups` → `intervention:stress_reset` has `up=1,total=1`; `intervention:stress_talk` stays 0; `surface:feed_message` includes the vote.

- [ ] **Step 5: Run** the touched IT class → PASS.
- [ ] **Step 6: Commit** — `feat(companion): per-intervention feedback rollup scopes (mezo-b3pp.19)`.

---

### Task 8: Frontend — card rendering, „Segített?", category mirrors

**Files:**
- Modify: `frontend/src/data/types.ts` (`FeedMessageKind`, `NotificationCategoryKey`)
- Modify: `frontend/src/features/today/logic/mezoMessages.ts` (+ its test)
- Modify: `frontend/src/features/today/components/MezoMessagesSheet.tsx` (+ its test)
- Modify: `frontend/src/data/notification/notificationMock.ts`
- Modify: `frontend/src/features/me/logic/notificationForecast.ts` (+ its test)
- Modify: every other `decision_review` mirror site — run `grep -rn "decision_review" frontend/src` and mirror each hit (labels/settings lists included)

**Interfaces:**
- Consumes: regenerated `api.gen.ts` (Task 2) already carries `'intervention'` in the wire enum.
- Produces: `MezoMessageItem.kind?: FeedMessageKind` — the sheet keys the „Segített?" variant off it.

- [ ] **Step 1: Types.** `FeedMessageKind` += `'intervention'` (comment: W5.2, config-text intervention card, mezo-b3pp.19). `NotificationCategoryKey` += `'intervention'`.

- [ ] **Step 2: `mezoMessages.ts`.** Add `kind?: FeedMessageKind` to `MezoMessageItem` (doc: only feed rows carry it; demo/nudge items don't) and set `kind: m.kind` in the `feed.map`. Extend `mezoMessages.test.ts`: an `intervention` feed message flows through with `kind: 'intervention'` and its `artifactId`.

- [ ] **Step 3: Sheet.** In `MezoMessagesSheet.tsx`, in the chips block, render the „Segített?" variant for intervention cards:

```tsx
{feedback && m.artifactId != null && (
  <div className="mt-sm">
    {m.kind === 'intervention' && <div className="td-bub-meta">Segített?</div>}
    <FeedbackChips
      key={m.artifactId}
      value={feedback.get(m.artifactId)}
      onVote={(verdict, reason) => feedback.vote(m.artifactId!, verdict, reason)}
      label={m.kind === 'intervention' ? 'a közbelépésről' : 'az üzenetről'}
    />
  </div>
)}
```

(Comment in Hungarian per the file's style: a „Segített?" felirat a W5.2 hurok — ugyanaz a feed_message verdict, a backend a kártya interventionKey-e alapján görgeti fel kulcsonként; mezo-b3pp.19.) Extend `MezoMessagesSheet.test.tsx`: an intervention item renders the „Segített?" caption and the chips; a morning item does NOT render the caption.

- [ ] **Step 4: Category mirrors.** `notificationMock.ts`: `intervention: true` in the enabled map, `intervention: 0` in the lead map (mirror `decision_review`'s placement). `notificationForecast.ts`: add `case 'intervention':` to the feed-anchored `return null` group (comment: event-born card + quiet-hours deferral — not FE-forecastable). Handle every other grep hit the same way (settings labels: „Közbelépések" if a Hungarian label map exists). Extend `notificationForecast.test.ts` if it enumerates categories.

- [ ] **Step 5: Gates.** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → all green (the type unions make missed mirror sites compile errors — fix any the compiler finds).

- [ ] **Step 6: Commit** — `feat(frontend): intervention feed card + Segített? chips + category mirrors (mezo-b3pp.19)`.

---

### Task 9: Docs + full local gate

**Files:**
- Modify: `docs/features/companion.md` — W5 section: W5.2 delivery chain (raise → event → selection → card → anchored push), the two decisions (push ≡ both; one card/day, first wins), selection math (effectiveness, optimistic prior, per-key cooldown), config reference (`mezo.companion.interventions`, `mezo.feature.intervention.enabled`).
- Modify: `docs/features/_platform-notifications.md` — the `intervention` category row (feed-anchored family, default ON, quiet-hours-deferred) + a Quiet hours subsection (`mezo.notification.quiet-hours`, defer-never-drop, only intervention consults it today).
- Modify: `docs/features/proactive.md` — `intervention` as a sixth `companion_message` kind: non-LLM, envelope `interventionKey`, excluded from cron miss-recovery (event-born, the sleep/weight precedent).

- [ ] **Step 1:** Write the three doc updates (follow each file's existing section structure — read the neighboring sections first; `knowledge-base` skill conventions bind).
- [ ] **Step 2:** `node scripts/lint-docs.mjs` → no new staleness.
- [ ] **Step 3:** Focused backend re-run of everything this slice touched:
  `cd backend && ./mvnw clean test -Dtest='CompanionMessageInterventionPersistenceIT,InterventionConfigIT,FlagServiceIT,InterventionServiceIT,InterventionSwitchOffIT,InterventionFireMinuteTest,AnchorResolverInterventionIT,AnchorResolverIT,AnchorResolverFeedIT,NotificationPrefApiIT,NotificationCategoryTest,Feedback*IT' -Dmezo.test.use-testcontainers=true` → green (`AnchorResolverIT`/`AnchorResolverFeedIT` guard against regression from the resolver edit).
- [ ] **Step 4: Commit** — `docs(companion): W5.2 interventions + quiet hours (mezo-b3pp.19)`.

---

## Ship checklist (after all tasks — house git-flow, NOT part of task execution)

1. `git push -u origin feat/w5-2-jitai-heartbeat` → `gh pr create` (self-PR = CI gate) → `gh pr checks <PR#> --watch`.
2. Green → primary repo `git pull --rebase` → `git merge --no-ff feat/w5-2-jitai-heartbeat` → push.
3. `bd close mezo-b3pp.19` → `bd dolt push` → delete branch local+remote → `git status` clean both places.

## Self-review notes (spec §9.2 acceptance ↔ tasks)

- "flag → best-weighted intervention → feed+push inside allowed hours" → Tasks 4–6 (`InterventionServiceIT` 1–3, `AnchorResolverInterventionIT` 1).
- "quiet-hours deferral IT" → Task 6 (`InterventionFireMinuteTest` + `AnchorResolverInterventionIT` 2).
- "cooldown blocks a re-fire" → Task 5 (tests 4–5; per-FLAG cooldown already pinned in W5.1's `FlagServiceIT`).
- "„Segített?" lands in message_feedback" → Task 8 (existing `useFeedback('feed_message')` path — chips write the same verdict rows) + Task 7 rolls it up per key.
- Spec's `{key, flag, channel, textHu, cooldownHours, quietHoursExempt}` shape → Task 3 verbatim; `channel=push` semantics per user decision.
