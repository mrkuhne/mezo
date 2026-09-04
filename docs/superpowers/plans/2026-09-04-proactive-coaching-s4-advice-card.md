# Proactive Coaching S4 — Advice Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two independent first-wins coaching-card gates (`InterventionService` for flags, `SetupCheckService` for setup checks) with **one `advice` card per day, chosen by the spec's severity order**, carrying a structured payload (deterministic `facts` + config `suggestions`) and LLM-written prose with a template fallback that never drops the card.

**Architecture:** Slice S4 of `docs/superpowers/specs/2026-09-03-proactive-coaching-round1-design.md` §5 (advice card) + the §4 severity order. A new `companion_message` kind `advice` becomes the SINGLE coaching-card kind: both existing writers stop writing their own kind and instead hand an `AdviceCandidate` to a new `AdviceCardService`, which owns the day gate, the severity comparison (a strictly higher-ranked candidate arriving later in the day SUPERSEDES the incumbent via soft-delete + reinsert), the one `CompanionLlm` call, and the row write. Per-source cooldowns stay with their own writers. No new endpoint, no new feature-slice edge.

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, contract-first OpenAPI fragments (`api/feature/*/*.yml`), MapStruct, React/TS frontend, JUnit ITs extending `AbstractIntegrationTest`, `FakeCompanionLlm` under the `companion-fake` profile.

## Decisions already made — do not re-litigate

- **`advice` is the single coaching-card kind.** `intervention` and `setup` stay as DB CHECK values and `KIND_*` constants for the rows already written, but after this slice NOTHING writes them. This is what makes "one card per day across all tiers" free: the existing partial unique index `uq_companion_message_created_by_date_kind (created_by, message_date, kind) where is_deleted = false` enforces it. Adding a third gate on top of two independent ones — the shape S3 shipped — is explicitly NOT the design (bd `mezo-d58h.4` comment, item 1).
- **A later, strictly higher-severity candidate supersedes the day's card**, it does not queue and does not get dropped. Spec §4 says "highest wins the daily card"; a setup card at 06:10 must not consume the slot that an afternoon `acute_bad_day` needs. Supersede = `repository.delete(incumbent)` (the `@SQLDelete` soft-delete) + flush + insert, inside one transaction. Equal rank never supersedes (a re-raise of the same flag must not churn the card).
- **The envelope carries TWO keys on a flag-sourced advice row.** `adviceKey` = the SEVERITY key (the flag key / setup-check key — what `AdvicePriority` ranks). `interventionKey` = the library ENTRY key (`stress_reset`, …) — what the per-entry cooldown, the `intervention:<key>` effectiveness rollup, and `AnchorResolver`'s push channel gate all key off. They are genuinely different identifiers; collapsing them would silently kill the W5.2 effectiveness loop. Setup-sourced rows set `adviceKey` = `setupKey` = the check key and leave `interventionKey` null (so they still get no push — `mezo-5qek` stays open, and after this slice it is a config-shaped fix rather than a code one).
- **The LLM writes prose only, and is forbidden from writing numerals at all.** The prompt says the numbers are displayed separately in the facts list; a deterministic guard (`ProseNumberGuard`) rejects any prose containing a numeral that does not literally appear in the facts+suggestions text, and falls back to the template. This is the S4-shaped version of the house "model selects by index, never invents" idiom, which has no natural analogue for free prose.
- **Template fallback prose = exactly the text that ships today** (the picked library entry's `textHu`, or the setup check's text). LLM failure therefore degrades to pre-S4 behaviour, never to silence.
- **`logging_gap` and `missed_workouts` currently deliver NOTHING.** Verified: `grep -n "logging_gap\|missed_workouts" backend/src/main/resources/application.yml` returns nothing, so S2's two flags raise, find "no eligible library entry", and log-and-return. S4 adds their library entries — without them the slice's headline rules stay mute.
- **Round-0 flags rank among themselves** `recovery_needed > sustained_stress > momentum_at_risk > all_healthy`. The spec only says "existing round-0 flags" last as a group; this internal order (most physical/acute first, the celebratory one last) is a plan decision, not a spec reading.
- **S6's keys are pre-seeded in the priority table as string literals** (`acute_bad_day`, `load_fuel_mismatch`, `rapid_weight_loss`, `joint_overuse`, `ignored_nudge`, `late_eating`). They are not `FlagKey` constants yet — adding constants without widening the DB CHECK and the two `@Pattern` regexes would be a trap. Task 3's test asserts the table covers every LIVE `FlagKey` constant, so S6 cannot forget the mirror.

## Global Constraints

- **Adding a `companion_message` kind needs FIVE mirrored changes** (bd memory `adding-a-flagkey-needs-five-mirrored-changes`, re-derived for kinds in `mezo-d58h.4`'s comment): (a) the `KIND_*` constant on `CompanionMessageEntity`; (b) the `ck_companion_message_kind` DB CHECK, widened by a NEW Liquibase changeset (drop + re-add — changesets are immutable, never edit `202609040900_mezo-d58h.3_companion_message_setup_kind.sql`); (c) the `enum:` list on `FeedMessageResponse.kind` in `api/feature/proactive/proactive.yml`; (d) the `FeedMessageKind` union in `frontend/src/data/types.ts`; (e) the hand-duplicated literal in `FeedMessageKindSource` (`feature/companion/feedback/service`), whose own javadoc says "keep both sides in step" and which was found missing BOTH `people` and `setup` in S3's review. `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` are GENERATED from (c) — regenerate, never hand-edit, or the `contract-drift` CI job fails.
- **This slice adds a SIXTH mirror of its own:** the prompt marker. `AdviceProseGenerator.ADVICE_MARKER` is duplicated as a literal in `FakeCompanionLlm` (a `companion → proactive` import would be a new package cycle). Every other marker in that file does the same; Task 4 adds the equality assertion that catches drift.
- **After extending ANY enum-like set, grep for every place that ENUMERATES it** — `@Pattern` regexes, `switch` defaults, DB CHECKs, `values()` loops, contract enums, FE type unions, hand-copied constant mirrors. This is the one bug class this epic has produced in all three shipped slices. For `advice` specifically, the non-obvious consumers found by recon are: `AnchorResolver.interventionAnchors` (push anchoring, filters on `KIND_INTERVENTION`), `FeedMessageKindService.interventionKeysByIds` (the effectiveness-rollup join, filters on `KIND_INTERVENTION`), and `NapMezoPage.tsx` / `MezoMessagesSheet.tsx` (the „Segített?" label variant, compares `kind === 'intervention'`). All three are tasks below; do not assume the list is longer or shorter without re-grepping.
- **A Maven `-Dtest` glob that matches no file runs nothing and still exits 0.** Every class name in every `-Dtest` below is a real file (existing ones verified at plan time; new ones are created by the task that first names them). If a run prints "Tests run: 0", treat it as a FAILURE, not a pass.
- **Local runs need `-Dmezo.test.use-testcontainers=true`.** The default fixed-DB mode races and fakes failures.
- **Frontend tests must pass in BOTH modes.** `VITE_USE_MOCK` unset means MOCK, so the real-mode run must set `VITE_USE_MOCK=false` explicitly or the gate is vacuous.
- **ArchUnit does not run in focused local runs** — CI's self-PR is the authoritative gate for `feature_slices_are_cycle_free` (frozen), `services_live_in_service_packages`, `entities_live_in_entity_packages`, `no_field_injection`, `no_class_level_transactional`, `no_spring_value_annotation`. This slice adds no new feature edge: `proactive → companion` and `notification → proactive` both already exist.
- **`ProactiveFeedService.getFeed` is deliberately NOT `@Transactional`** — never call advice delivery from inside it. Advice delivery is event- and cron-driven only, and each writer carries its own method-level `@Transactional`.
- Liquibase changesets are immutable; the new file's timestamp must exceed `202609040900`.
- Run all commands from the repo root of THIS worktree (`/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/padding-2px-all-pages-3479e4`); never `cd` to the primary repo (it has `main` checked out).
- Commit messages: conventional subject + the driving bd id (`mezo-d58h.4`) + a `Co-Authored-By:` trailer for the acting model.
- After creating/moving files: `node scripts/gen-codemap.mjs`, committed in the same change — and regenerate AFTER any docs edit, never before (a frontmatter `updated:` bump drifts the CODEMAP).

## File Structure

| File | Responsibility |
|---|---|
| `proactive/entity/CompanionMessageEntity.java` (M) | `KIND_ADVICE` constant |
| `proactive/entity/CompanionMessageEnvelope.java` (M) | trailing `adviceKey`, `facts`, `suggestions` + an `advice(...)` static factory |
| `db/changelog/1.0.0/script/202609041000_mezo-d58h.4_companion_message_advice_kind.sql` (C) | widen `ck_companion_message_kind` |
| `proactive/service/AdvicePriority.java` (C) | the spec's severity order → an integer rank; unknown keys rank last |
| `proactive/service/AdviceCandidate.java` (C) | what a writer hands the card service: keys, eyebrow, facts, suggestions, fallback prose |
| `proactive/service/AdviceFactRenderer.java` (C) | `FlagPayloadEnvelope` → deterministic Hungarian fact strings, one renderer per flag |
| `proactive/service/ProseNumberGuard.java` (C) | "every numeral in the prose appears in the grounding text" |
| `proactive/service/AdviceProseGenerator.java` (C) | ONE `CompanionLlm` call + defensive parse + guard + template fallback |
| `proactive/service/AdviceCardService.java` (C) | the single day gate + severity supersede + row write |
| `proactive/service/InterventionService.java` (M) | keeps library selection + per-entry cooldown; delegates the write |
| `proactive/service/SetupCheckService.java` (M) | keeps the checks + weekly re-emit window; delegates the write |
| `proactive/service/FeedMessageKindService.java` (M) | rollup join accepts advice rows |
| `proactive/service/CompanionMessageGenerator.java` (M) | `missed_workouts` fact block in the morning prompt |
| `notification/service/AnchorResolver.java` (M) | push anchor reads advice rows |
| `companion/feedback/service/FeedMessageKindSource.java` (M) | `KIND_ADVICE` literal mirror |
| `companion/llm/FakeCompanionLlm.java` (M) | advice marker mirror + scripted answer |
| `api/feature/proactive/proactive.yml` (M) | `advice` enum value + optional `facts`/`suggestions` |
| `proactive/mapper/ProactiveMapper.java` (M) | map the two new envelope fields |
| `application.yml` (M) | library entries for `logging_gap` and `missed_workouts` |
| `frontend/src/data/types.ts`, `data/today/feedApi.ts`, `features/today/logic/mezoMessages.ts`, `features/today/pages/NapMezoPage.tsx`, `features/today/components/MezoMessagesSheet.tsx`, `styles/prototype.css` (M) | the advice card's FE shape and render |

---

### Task 0: bd claim + branch state

**Files:** none (process).

- [ ] **Step 1: Claim the driving bd issue**

```bash
bd update mezo-d58h.4 --claim
```

- [ ] **Step 2: Confirm the branch exists and is synced with main**

The branch `feat/proactive-coaching-s4` already exists and `origin/main` was merged into it at plan time. Verify, do not re-create:

```bash
git branch --show-current && git status --short && git log --oneline -1
```

Expected: `feat/proactive-coaching-s4`, a clean tree (apart from this plan file), and the merge commit at the tip.

---

### Task 1: The `advice` message kind (five mirrors)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEntity.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609041000_mezo-d58h.4_companion_message_advice_kind.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/FeedMessageKindSource.java`
- Modify: `api/feature/proactive/proactive.yml`
- Modify: `frontend/src/data/types.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageAdvicePersistenceIT.java`

**Interfaces:**
- Produces: `CompanionMessageEntity.KIND_ADVICE` (`"advice"`), `FeedMessageKindSource.KIND_ADVICE`, the `advice` wire enum value, the FE `'advice'` union member.

- [ ] **Step 1: Write the failing persistence IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageAdvicePersistenceIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S4 (bd mezo-d58h.4, spec 2026-09-03 §5): the {@code advice} kind is accepted by
 * {@code ck_companion_message_kind}, and an unknown kind is still rejected — the CHECK is pinned
 * from the DB side (native insert), not merely from the entity's annotations.
 */
class CompanionMessageAdvicePersistenceIT extends AbstractIntegrationTest {

    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testKindCheck_shouldAcceptAdvice() {
        UUID owner = userPopulator.createUser().getId();

        companionMessagePopulator.rawInsertKind(owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE);

        assertThat(CompanionMessageEntity.KIND_ADVICE).isEqualTo("advice");
    }

    @Test
    void testKindCheck_shouldStillRejectAnUnknownKind() {
        UUID owner = userPopulator.createUser().getId();

        assertThatThrownBy(() ->
            companionMessagePopulator.rawInsertKind(owner, LocalDate.now(), "nonsense"))
            .isInstanceOf(Exception.class);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='CompanionMessageAdvicePersistenceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — the first test blows up on the `ck_companion_message_kind` CHECK (`advice` is not yet allowed). If the run reports "Tests run: 0", the class name or package is wrong — fix that first.

- [ ] **Step 3: Add the entity constant**

In `CompanionMessageEntity.java`, directly after `KIND_SETUP`:

```java
    /** Advice card (S4, bd mezo-d58h.4, spec 2026-09-03 §5): the SINGLE coaching card of the day.
     *  Successor to {@code intervention} and {@code setup} — after S4 nothing writes those two,
     *  and this kind's row is picked across ALL tiers by {@code AdvicePriority}. Its envelope
     *  carries {@code adviceKey} (the severity key: flag key or setup-check key), {@code facts}
     *  (deterministic, rule-provided) and {@code suggestions} (config text); the body is ONE
     *  paragraph of LLM prose over those facts, or the template fallback. */
    public static final String KIND_ADVICE = "advice";
```

- [ ] **Step 4: Add the Liquibase changeset**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202609041000_mezo-d58h.4_companion_message_advice_kind.sql`:

```sql
-- Proactive coaching S4 (mezo-d58h.4, spec 2026-09-03 §5): the 'advice' kind is the single
-- coaching card of the day — the successor to 'intervention' and 'setup', chosen across all
-- tiers by the spec §4 severity order. The two older kinds stay in the CHECK for the rows
-- already written; nothing writes them after this slice.
ALTER TABLE companion_message DROP CONSTRAINT ck_companion_message_kind;
ALTER TABLE companion_message
    ADD CONSTRAINT ck_companion_message_kind
        CHECK (kind IN ('morning','sleep','weight','midday','evening','intervention','people','setup','advice'));
```

Register it in `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` by appending (keep the file's existing indentation, two-space list style):

```yaml
  - changeSet:
      id: "1.0.0:202609041000_mezo-d58h.4_companion_message_advice_kind"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609041000_mezo-d58h.4_companion_message_advice_kind.sql
```

- [ ] **Step 5: Mirror the kind in `FeedMessageKindSource`**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/FeedMessageKindSource.java`, after `KIND_SETUP`:

```java
    String KIND_ADVICE = "advice";
```

- [ ] **Step 6: Widen the contract enum**

In `api/feature/proactive/proactive.yml`, inside `FeedMessageResponse`, replace the `kind` block with:

```yaml
        kind:
          type: string
          description: Feed message kind — morning, sleep, weight, midday, evening, or people LLM-generated messages; advice is the single daily coaching card (S4, mezo-d58h.4) whose prose is LLM-written over deterministic facts; intervention and setup are the pre-S4 config-text cards, kept for existing rows only.
          enum: [morning, sleep, weight, midday, evening, intervention, people, setup, advice]
```

- [ ] **Step 7: Widen the FE union**

In `frontend/src/data/types.ts` line 19:

```ts
export type FeedMessageKind = 'morning' | 'sleep' | 'weight' | 'midday' | 'evening' | 'intervention' | 'people' | 'setup' | 'advice'
```

- [ ] **Step 8: Regenerate the generated contract artifacts**

```bash
cd api/generate && npm ci && npm run generate:api
cd ../../frontend && pnpm install --frozen-lockfile && pnpm generate:api
```

Verify the generated files moved:

```bash
git diff --stat api/openapi.yml frontend/src/data/_client/api.gen.ts
```

Expected: both files changed, each containing `advice`.

- [ ] **Step 9: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='CompanionMessageAdvicePersistenceIT,CompanionMessageSetupPersistenceIT,ProactiveApiFeedIT' -q -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm test -- --run src/data
```

Expected: PASS, non-zero test counts.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(proactive): add the advice companion_message kind (mezo-d58h.4)"
```

---

### Task 2: Envelope payload — `adviceKey`, `facts`, `suggestions`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEnvelope.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/CompanionMessagePopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageAdvicePersistenceIT.java`

**Interfaces:**
- Consumes: `CompanionMessageEntity.KIND_ADVICE` (Task 1).
- Produces: `CompanionMessageEnvelope.advice(String eyebrow, String prose, String adviceKey, String interventionKey, String setupKey, List<String> facts, List<String> suggestions)`; accessors `adviceKey()`, `facts()`, `suggestions()`; `CompanionMessagePopulator.createAdvice(UUID owner, LocalDate date, String adviceKey, String interventionKey, String eyebrow, String prose, List<String> facts, List<String> suggestions, Instant generatedAt)`.

- [ ] **Step 1: Write the failing round-trip test**

Append to `CompanionMessageAdvicePersistenceIT`:

```java
    @Test
    void testEnvelope_shouldRoundTripTheAdvicePayload() {
        UUID owner = userPopulator.createUser().getId();

        CompanionMessageEntity saved = companionMessagePopulator.createAdvice(
            owner, LocalDate.now(), "sleep_debt", "sleep_recover_tonight",
            "Mezo · észrevétel", "Ma este feküdj le korábban.",
            List.of("Alvásadósság: 1,4 óra/éjszaka"), List.of("Told előre a villanyoltást."),
            Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(saved.getId()).orElseThrow().getContent();
        assertThat(content.adviceKey()).isEqualTo("sleep_debt");
        assertThat(content.interventionKey()).isEqualTo("sleep_recover_tonight");
        assertThat(content.setupKey()).isNull();
        assertThat(content.facts()).containsExactly("Alvásadósság: 1,4 óra/éjszaka");
        assertThat(content.suggestions()).containsExactly("Told előre a villanyoltást.");
    }

    /** Old rows have no advice components at all — jsonb deserializes the new trailing fields to
     *  null (no @JsonIgnoreProperties, no FAIL_ON_UNKNOWN_PROPERTIES override anywhere on this
     *  envelope). Adding a TRAILING component is safe; REMOVING one would not be. */
    @Test
    void testEnvelope_shouldDeserializeAPreS4RowWithNullAdviceFields() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity legacy = companionMessagePopulator.createIntervention(
            owner, LocalDate.now(), "stress_reset", "Régi kártya", Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(legacy.getId()).orElseThrow().getContent();
        assertThat(content.adviceKey()).isNull();
        assertThat(content.facts()).isNull();
        assertThat(content.suggestions()).isNull();
    }
```

Add the imports and the extra `@Autowired` this needs at the top of the class:

```java
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import java.time.Instant;
import java.util.List;
```

```java
    @Autowired private CompanionMessageRepository companionMessageRepository;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='CompanionMessageAdvicePersistenceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `createAdvice` and `adviceKey()` do not exist.

- [ ] **Step 3: Extend the envelope**

Replace the whole record body of `CompanionMessageEnvelope.java` (keep the package and the `import java.util.List;`):

```java
/**
 * Typed jsonb envelope for companion_message.content (ADR 0006 / ProvenanceEnvelope precedent).
 * Refs are code-collected candidates the model selected by index (never invented).
 * {@code interventionKey} (W5.2, bd mezo-b3pp.19) names the intervention-LIBRARY ENTRY
 * ({@code mezo.companion.interventions[].key}) so the „Segített?" verdict can be rolled up per
 * entry, the per-entry cooldown can be applied, and {@code AnchorResolver} can read the entry's
 * push channel; it is set on pre-S4 {@code intervention} rows and on flag-sourced {@code advice}
 * rows, null everywhere else. {@code setupKey} (S3, bd mezo-d58h.3) names the setup check; set on
 * pre-S4 {@code setup} rows and on setup-sourced {@code advice} rows.
 *
 * <p>{@code adviceKey} / {@code facts} / {@code suggestions} (S4, bd mezo-d58h.4, spec §5) are set
 * ONLY on {@code kind=advice} rows. {@code adviceKey} is the SEVERITY key — the flag key or the
 * setup-check key that {@code AdvicePriority} ranks — deliberately NOT the same identifier as
 * {@code interventionKey}: one flag can be served by several library entries. Old rows
 * deserialize every one of these to null (trailing components are jsonb-safe to ADD; removing one
 * would not be).
 */
public record CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                       String interventionKey, String setupKey,
                                       String adviceKey, List<String> facts,
                                       List<String> suggestions) {

    /** The pre-W5.2 shape — every prose-kind writer stays on this. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs) {
        this(eyebrow, body, refs, null, null, null, null, null);
    }

    /** The W5.2 intervention shape — kept so existing call sites compile unchanged. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                    String interventionKey) {
        this(eyebrow, body, refs, interventionKey, null, null, null, null);
    }

    /** The S3 setup shape — kept so existing call sites compile unchanged. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                    String interventionKey, String setupKey) {
        this(eyebrow, body, refs, interventionKey, setupKey, null, null, null);
    }

    /** The S4 advice shape. {@code interventionKey}/{@code setupKey} stay nullable: a flag-sourced
     *  card carries the library entry key, a setup-sourced one the check key, never both. */
    public static CompanionMessageEnvelope advice(String eyebrow, String prose, String adviceKey,
                                                  String interventionKey, String setupKey,
                                                  List<String> facts, List<String> suggestions) {
        return new CompanionMessageEnvelope(eyebrow, List.of(prose), List.of(),
            interventionKey, setupKey, adviceKey, List.copyOf(facts), List.copyOf(suggestions));
    }

    public record Ref(String kind, String label) {
    }
}
```

- [ ] **Step 4: Add the populator factory**

In `backend/src/test/java/io/mrkuhne/mezo/support/populator/CompanionMessagePopulator.java`, after `createSetup`:

```java
    /** S4 advice card (bd mezo-d58h.4) — kind + both keys + the structured payload in one shot. */
    public CompanionMessageEntity createAdvice(
            UUID owner, LocalDate date, String adviceKey, String interventionKey, String eyebrow,
            String prose, List<String> facts, List<String> suggestions, Instant generatedAt) {
        CompanionMessageEntity entity = new CompanionMessageEntity();
        entity.setCreatedBy(owner);
        entity.setMessageDate(date);
        entity.setKind(CompanionMessageEntity.KIND_ADVICE);
        entity.setContent(CompanionMessageEnvelope.advice(
            eyebrow, prose, adviceKey, interventionKey, null, facts, suggestions));
        entity.setGeneratedAt(generatedAt);
        return companionMessageRepository.saveAndFlush(entity);
    }
```

- [ ] **Step 5: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='CompanionMessageAdvicePersistenceIT,CompanionMessagePersistenceIT,CompanionMessageInterventionPersistenceIT,CompanionMessageSetupPersistenceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS (4 classes, non-zero tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(proactive): carry adviceKey/facts/suggestions in the message envelope (mezo-d58h.4)"
```

---

### Task 3: `AdvicePriority` — the severity order

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriority.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriorityTest.java`

**Interfaces:**
- Produces: `AdvicePriority.ORDER` (`List<String>`), `AdvicePriority.rankOf(String)` (int; unknown → `ORDER.size()`), `AdvicePriority.outranks(String candidate, String incumbent)` (boolean, strict).

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriorityTest.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * S4 (bd mezo-d58h.4): the spec §4 severity order as an integer rank. Plain unit test — the table
 * is a pure static lookup with no Spring involvement.
 */
class AdvicePriorityTest {

    @Test
    void testRankOf_shouldFollowTheSpecOrder() {
        assertThat(AdvicePriority.rankOf("acute_bad_day"))
            .isLessThan(AdvicePriority.rankOf("load_fuel_mismatch"));
        assertThat(AdvicePriority.rankOf(FlagKey.MISSED_WORKOUTS))
            .isLessThan(AdvicePriority.rankOf(FlagKey.SLEEP_DEBT));
        assertThat(AdvicePriority.rankOf(FlagKey.SLEEP_DEBT))
            .isLessThan(AdvicePriority.rankOf(FlagKey.LOGGING_GAP));
        assertThat(AdvicePriority.rankOf(FlagKey.LOGGING_GAP))
            .isLessThan(AdvicePriority.rankOf("missing_sleep_goal"));
        assertThat(AdvicePriority.rankOf("plan_feasibility"))
            .isLessThan(AdvicePriority.rankOf(FlagKey.RECOVERY_NEEDED));
        assertThat(AdvicePriority.rankOf(FlagKey.ALL_HEALTHY))
            .isEqualTo(AdvicePriority.ORDER.size() - 1);
    }

    @Test
    void testOutranks_shouldBeStrict() {
        assertThat(AdvicePriority.outranks("acute_bad_day", FlagKey.SLEEP_DEBT)).isTrue();
        assertThat(AdvicePriority.outranks(FlagKey.SLEEP_DEBT, "acute_bad_day")).isFalse();
        // A re-raise of the same key must never churn the day's card.
        assertThat(AdvicePriority.outranks(FlagKey.SLEEP_DEBT, FlagKey.SLEEP_DEBT)).isFalse();
    }

    /** An unknown key ranks LAST rather than throwing: an unmapped key must never blow up delivery
     *  inside a listener's catch (the FlagProperties.CooldownHours.forFlag trap, deliberately not
     *  repeated here). It still loses every comparison against a known key. */
    @Test
    void testRankOf_shouldRankAnUnknownKeyLast() {
        assertThat(AdvicePriority.rankOf("brand_new_rule")).isEqualTo(AdvicePriority.ORDER.size());
        assertThat(AdvicePriority.outranks("brand_new_rule", FlagKey.ALL_HEALTHY)).isFalse();
        assertThat(AdvicePriority.outranks(FlagKey.ALL_HEALTHY, "brand_new_rule")).isTrue();
    }

    /** The enumeration guard this epic keeps needing: every LIVE flag key must have a rank, or a
     *  raise silently lands at the bottom of the order. Reads FlagKey by reflection so adding a
     *  constant there fails HERE rather than in production. */
    @Test
    void testOrder_shouldCoverEveryLiveFlagKey() {
        List<String> flagKeys = new ArrayList<>();
        for (Field f : FlagKey.class.getDeclaredFields()) {
            if (Modifier.isPublic(f.getModifiers()) && Modifier.isStatic(f.getModifiers())
                    && f.getType() == String.class && !f.getName().startsWith("SOURCE_")) {
                try {
                    flagKeys.add((String) f.get(null));
                } catch (IllegalAccessException e) {
                    throw new AssertionError(e);
                }
            }
        }
        assertThat(flagKeys).isNotEmpty();
        assertThat(AdvicePriority.ORDER).containsAll(flagKeys);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='AdvicePriorityTest' -q -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `AdvicePriority` does not exist.

- [ ] **Step 3: Write the implementation**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriority.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

/**
 * The spec §4 severity order (2026-09-03 design, bottom of §4) as an integer rank — S4's
 * replacement for the two independent first-wins gates S1–S3 shipped. Lower rank wins.
 *
 * <p>Pure static lookup, deliberately NOT config: this is the spec's editorial ranking of which
 * problem deserves the day's single card, not a threshold. Thresholds stay in
 * {@code FlagProperties} / {@code SetupCheckProperties}.
 *
 * <p>An unknown key ranks LAST and logs a warning rather than throwing — an unmapped key must
 * never blow up delivery inside {@code InterventionEventListener}'s catch, which is exactly the
 * failure mode {@code FlagProperties.CooldownHours.forFlag}'s throwing default produces.
 * {@code AdvicePriorityTest} asserts every live {@link FlagKey} constant is present, so the
 * warning path is a genuine last resort rather than the normal way a new key behaves.
 */
@Slf4j
public final class AdvicePriority {

    /**
     * Highest severity first. The six S6 keys are string LITERALS on purpose: they are not
     * {@link FlagKey} constants yet, and adding constants there without widening the
     * {@code ck_companion_flag_log_flag_key} CHECK and the two mirroring {@code @Pattern} regexes
     * would be a trap (bd memory: adding-a-flagkey-needs-five-mirrored-changes). S6 replaces them
     * with constants in the same change that adds the flags.
     *
     * <p>The round-0 tail order (recovery → stress → momentum → all_healthy) is a plan decision:
     * the spec only ranks them collectively, below the setup cards.
     */
    public static final List<String> ORDER = List.of(
        "acute_bad_day",            // S6
        "load_fuel_mismatch",       // S6
        "rapid_weight_loss",        // S6
        "joint_overuse",            // S6
        FlagKey.MISSED_WORKOUTS,
        FlagKey.SLEEP_DEBT,
        FlagKey.LOGGING_GAP,
        "ignored_nudge",            // S6
        "late_eating",              // S6
        SetupCheckService.CHECK_MISSING_SLEEP_GOAL,
        SetupCheckService.CHECK_PLAN_FEASIBILITY,
        FlagKey.RECOVERY_NEEDED,
        FlagKey.SUSTAINED_STRESS,
        FlagKey.MOMENTUM_AT_RISK,
        FlagKey.ALL_HEALTHY);

    private AdvicePriority() {
    }

    /** Lower is more severe; an unknown (or null) key ranks one past the end of the table. */
    public static int rankOf(String adviceKey) {
        int index = adviceKey == null ? -1 : ORDER.indexOf(adviceKey);
        if (index < 0) {
            log.warn("Advice key {} has no severity rank — ranking it last. Add it to "
                + "AdvicePriority.ORDER (spec 2026-09-03 §4).", adviceKey);
            return ORDER.size();
        }
        return index;
    }

    /** STRICT: an equal-ranked candidate does not displace the incumbent, so a re-raise of the
     *  same flag leaves the day's card (and its „Segített?" votes) alone. */
    public static boolean outranks(String candidateKey, String incumbentKey) {
        return rankOf(candidateKey) < rankOf(incumbentKey);
    }
}
```

- [ ] **Step 4: Run the test**

```bash
cd backend && ./mvnw test -Dtest='AdvicePriorityTest' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proactive): add the AdvicePriority severity order (mezo-d58h.4)"
```

---

### Task 4: Deterministic facts from a flag payload

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRenderer.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRendererTest.java`

**Interfaces:**
- Produces: `AdviceFactRenderer.render(String flagKey, FlagPayloadEnvelope payload)` → `List<String>` (never null; empty when the payload is null or carries no matching shape).

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRendererTest.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * S4 (bd mezo-d58h.4, spec §5): the card's facts are DETERMINISTIC and rule-provided — rendered
 * from the raise's own frozen payload, never re-derived and never model-written.
 */
class AdviceFactRendererTest {

    @Test
    void testRender_shouldDescribeASleepDebtRaise() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.sleepDebt(
            new FlagPayloadEnvelope.SleepDebt(8.0, 7, 5, 1.0, 1.6, Map.of()));

        List<String> facts = AdviceFactRenderer.render(FlagKey.SLEEP_DEBT, payload);

        assertThat(facts).hasSize(1);
        assertThat(facts.get(0)).contains("1,6").contains("8,0").contains("5");
    }

    @Test
    void testRender_shouldDescribeAMissedWorkoutsRaise() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.missedWorkouts(
            new FlagPayloadEnvelope.MissedWorkouts(14, 2, 3,
                List.of("2026-09-01", "2026-09-02", "2026-09-03"),
                List.of("2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04")));

        List<String> facts = AdviceFactRenderer.render(FlagKey.MISSED_WORKOUTS, payload);

        assertThat(facts).hasSize(2);
        assertThat(facts.get(0)).contains("3");
        assertThat(facts.get(1)).contains("2026-09-01");
    }

    @Test
    void testRender_shouldDescribeALoggingGapRaise() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.loggingGap(
            new FlagPayloadEnvelope.LoggingGap(List.of("meal", "checkin"), 36, 52, 48, 60,
                null, null, null, null, null));

        List<String> facts = AdviceFactRenderer.render(FlagKey.LOGGING_GAP, payload);

        assertThat(facts).isNotEmpty();
        assertThat(String.join(" ", facts)).contains("étkezés").contains("52");
    }

    /** The sleep-suspicion variant (S2): the gap card says the logged nights ALSO look short. */
    @Test
    void testRender_shouldAddTheSleepSuspicionFact_whenTheGapCarriesIt() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.loggingGap(
            new FlagPayloadEnvelope.LoggingGap(List.of("sleep"), null, null, null, null,
                2, 3, 1.0, 1.4, 3));

        List<String> facts = AdviceFactRenderer.render(FlagKey.LOGGING_GAP, payload);

        assertThat(String.join(" ", facts)).contains("1,4");
    }

    /** Honest absence: no payload (a raise written before the payload existed, or a key with no
     *  renderer) yields NO facts rather than a fabricated one. The card still ships — its prose
     *  falls back to the template, which needs no facts. */
    @Test
    void testRender_shouldReturnNoFacts_whenThePayloadIsMissingOrUnmapped() {
        assertThat(AdviceFactRenderer.render(FlagKey.SLEEP_DEBT, null)).isEmpty();
        assertThat(AdviceFactRenderer.render("brand_new_rule",
            FlagPayloadEnvelope.allHealthy(new FlagPayloadEnvelope.AllHealthy(7, 7)))).isEmpty();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='AdviceFactRendererTest' -q -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `AdviceFactRenderer` does not exist.

- [ ] **Step 3: Write the implementation**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRenderer.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The advice card's FACTS (spec §5): deterministic, numeric, rule-provided lines rendered from the
 * raise's own frozen {@code companion_flag_log.payload}. Nothing here re-derives a rule — the
 * payload already froze both the thresholds and the observed values at raise time, which is the
 * whole point of {@code FlagPayloadEnvelope}.
 *
 * <p>An unmapped key or a null payload yields an EMPTY list, never a placeholder: the card is
 * still delivered (its prose falls back to the template text), it simply shows no evidence block.
 * That is the spec §7 honesty rule — never estimate.
 *
 * <p>Numbers are formatted with the Hungarian locale (decimal comma) because these strings are
 * shown verbatim on the card AND handed to the model as the only numbers it is allowed to echo;
 * {@code ProseNumberGuard} normalises the separator before comparing, so a model that answers
 * with a dot is not punished for it.
 */
public final class AdviceFactRenderer {

    private static final Locale HU = Locale.of("hu");

    private AdviceFactRenderer() {
    }

    public static List<String> render(String flagKey, FlagPayloadEnvelope payload) {
        if (payload == null || flagKey == null) {
            return List.of();
        }
        return switch (flagKey) {
            case FlagKey.SLEEP_DEBT -> sleepDebt(payload.sleepDebt());
            case FlagKey.MISSED_WORKOUTS -> missedWorkouts(payload.missedWorkouts());
            case FlagKey.LOGGING_GAP -> loggingGap(payload.loggingGap());
            case FlagKey.SUSTAINED_STRESS -> sustainedStress(payload.sustainedStress());
            case FlagKey.MOMENTUM_AT_RISK -> momentumAtRisk(payload.momentumAtRisk());
            case FlagKey.RECOVERY_NEEDED -> recoveryNeeded(payload.recoveryNeeded());
            case FlagKey.ALL_HEALTHY -> allHealthy(payload.allHealthy());
            default -> List.of();
        };
    }

    private static List<String> sleepDebt(FlagPayloadEnvelope.SleepDebt p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Alvásadósság: %s óra/éjszaka (cél %s óra, %d rögzített éjszaka %d-ből)"
            .formatted(num(p.deficitHours()), num(p.goalHours()), p.loggedNights(), p.nights()));
    }

    private static List<String> missedWorkouts(FlagPayloadEnvelope.MissedWorkouts p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("Kimaradt edzések: %d egymást követő tervezett nap (%d tervezett napból %d napon)"
            .formatted(p.longestMissedRun(), p.plannedDays().size(), p.missedDays().size()));
        if (!p.missedDays().isEmpty()) {
            facts.add("Kimaradt napok: " + String.join(", ", p.missedDays()));
        }
        return List.copyOf(facts);
    }

    private static List<String> loggingGap(FlagPayloadEnvelope.LoggingGap p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        if (p.mealHoursSince() != null) {
            facts.add("Utolsó étkezés-rögzítés: %d órája (küszöb %d óra)"
                .formatted(p.mealHoursSince(), p.mealStaleHours()));
        }
        if (p.checkinHoursSince() != null) {
            facts.add("Utolsó check-in: %d órája (küszöb %d óra)"
                .formatted(p.checkinHoursSince(), p.checkinStaleHours()));
        }
        if (p.sleepMorningsSince() != null) {
            facts.add("Rögzítetlen alvás: %d reggel (küszöb %d reggel)"
                .formatted(p.sleepMorningsSince(), p.sleepStaleMornings()));
        }
        if (p.observedDeficitPerLoggedNight() != null && p.loggedNights() != null) {
            facts.add("A rögzített éjszakák is rövidek: %s óra hiány/éjszaka %d éjszakán"
                .formatted(num(p.observedDeficitPerLoggedNight()), p.loggedNights()));
        }
        return List.copyOf(facts);
    }

    private static List<String> sustainedStress(FlagPayloadEnvelope.SustainedStress p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Magas stressz: %d nap a küszöb (%s) fölött %d napból"
            .formatted(p.daysOverThreshold(), num(p.threshold()), p.windowDays()));
    }

    private static List<String> momentumAtRisk(FlagPayloadEnvelope.MomentumAtRisk p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Lendület: napi %s teljesített szokás a korábbi %s helyett (%d nap alatt)"
            .formatted(num(p.recentDoneAvg()), num(p.baselineDoneAvg()), p.windowDays()));
    }

    private static List<String> recoveryNeeded(FlagPayloadEnvelope.RecoveryNeeded p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        if (p.sleepHours() != null) {
            facts.add("Alvás %s: %s óra (padló %s óra)"
                .formatted(p.sleepDay(), num(p.sleepHours()), num(p.sleepFloorHours())));
        }
        if (p.rpe() != null) {
            facts.add("Edzés-RPE %s: %s (küszöb %s)"
                .formatted(p.rpeDay(), num(p.rpe()), num(p.rpeThreshold())));
        }
        if (p.stress() != null) {
            facts.add("Stressz %s: %s (küszöb %s)"
                .formatted(p.stressDay(), num(p.stress()), num(p.stressThreshold())));
        }
        return List.copyOf(facts);
    }

    private static List<String> allHealthy(FlagPayloadEnvelope.AllHealthy p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Csendes időszak: %d nap probléma-jelzés nélkül, %d megfigyelt napból"
            .formatted(p.quietDays(), p.observedDays()));
    }

    /** One decimal, Hungarian comma — the display form the model may echo verbatim. */
    private static String num(double value) {
        return String.format(HU, "%.1f", value);
    }
}
```

- [ ] **Step 4: Run the test**

```bash
cd backend && ./mvnw test -Dtest='AdviceFactRendererTest' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proactive): render deterministic advice facts from flag payloads (mezo-d58h.4)"
```

---

### Task 5: `ProseNumberGuard`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProseNumberGuard.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/ProseNumberGuardTest.java`

**Interfaces:**
- Produces: `ProseNumberGuard.grounded(String prose, String grounding)` → boolean (true = every numeral in `prose` occurs in `grounding`).

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/ProseNumberGuardTest.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * S4 (bd mezo-d58h.4, spec §5): "the LLM writes prose only and can never invent a number that
 * isn't in facts". Free prose has no index-selection seam like the refs idiom, so the guard is a
 * deterministic post-check: any numeral in the answer must occur in the grounding text.
 */
class ProseNumberGuardTest {

    private static final String GROUNDING =
        "Alvásadósság: 1,6 óra/éjszaka (cél 8,0 óra, 5 rögzített éjszaka 7-ből)";

    @Test
    void testGrounded_shouldAcceptNumberFreeProse() {
        assertThat(ProseNumberGuard.grounded(
            "Az elmúlt éjszakák rövidek voltak; ma este feküdj le korábban.", GROUNDING)).isTrue();
    }

    @Test
    void testGrounded_shouldAcceptANumberThatAppearsInTheGrounding() {
        assertThat(ProseNumberGuard.grounded(
            "Az adósság 1,6 óra éjszakánként.", GROUNDING)).isTrue();
    }

    /** The separator must not decide the verdict: the facts render with a Hungarian comma, a
     *  model may answer with a dot, and both mean the same number. */
    @Test
    void testGrounded_shouldNormaliseTheDecimalSeparator() {
        assertThat(ProseNumberGuard.grounded("Az adósság 1.6 óra.", GROUNDING)).isTrue();
    }

    @Test
    void testGrounded_shouldRejectAnInventedNumber() {
        assertThat(ProseNumberGuard.grounded(
            "Aludj ma 9,5 órát.", GROUNDING)).isFalse();
    }

    @Test
    void testGrounded_shouldTreatBlankOrNullProseAsUngrounded() {
        assertThat(ProseNumberGuard.grounded(null, GROUNDING)).isFalse();
        assertThat(ProseNumberGuard.grounded("   ", GROUNDING)).isFalse();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='ProseNumberGuardTest' -q -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `ProseNumberGuard` does not exist.

- [ ] **Step 3: Write the implementation**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProseNumberGuard.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import java.util.regex.Pattern;

/**
 * "The model never invents a number" (spec §5), enforced deterministically. The refs idiom
 * (model selects a candidate BY INDEX) has no analogue for free prose, so the advice card checks
 * the answer instead: every numeral token in the prose must occur literally in the grounding text
 * (the facts + suggestions the call was given). The prompt itself asks for number-free prose, so
 * in practice this guard fires only on an actual fabrication.
 *
 * <p>Conservative by design: an ungrounded numeral drops the WHOLE answer in favour of the
 * template prose. A card is never dropped, only its wording downgraded.
 */
public final class ProseNumberGuard {

    private static final Pattern NUMERAL = Pattern.compile("\\d+(?:[.,]\\d+)?");

    private ProseNumberGuard() {
    }

    public static boolean grounded(String prose, String grounding) {
        if (prose == null || prose.isBlank()) {
            return false;
        }
        String haystack = grounding == null ? "" : normalise(grounding);
        return NUMERAL.matcher(prose).results()
            .map(match -> normalise(match.group()))
            .allMatch(haystack::contains);
    }

    /** Decimal comma and dot mean the same number — the facts render with a comma (Hungarian),
     *  a model may answer with either. */
    private static String normalise(String text) {
        return text.replace(',', '.');
    }
}
```

- [ ] **Step 4: Run the test**

```bash
cd backend && ./mvnw test -Dtest='ProseNumberGuardTest' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proactive): guard advice prose against invented numbers (mezo-d58h.4)"
```

---

### Task 6: `AdviceProseGenerator` — one LLM call, template fallback

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCandidate.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceProseGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceProseGeneratorIT.java`

**Interfaces:**
- Consumes: `AdviceFactRenderer`, `ProseNumberGuard`, `CompanionLlm`, `PromptPersona`, `LlmCallContextHolder`.
- Produces: `record AdviceCandidate(String adviceKey, String interventionKey, String setupKey, String eyebrow, List<String> facts, List<String> suggestions, String fallbackProse)`; `AdviceProseGenerator.ADVICE_MARKER`; `AdviceProseGenerator.write(UUID userId, AdviceCandidate candidate)` → `String` (never null, never blank).

- [ ] **Step 1: Write the candidate record**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCandidate.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import java.util.List;

/**
 * What a detection hands {@code AdviceCardService} (S4, bd mezo-d58h.4, spec §5). The
 * {@code CompanionMessageEnvelope} idiom: one record, nullable identity fields, exactly one of
 * {@code interventionKey} / {@code setupKey} set.
 *
 * @param adviceKey       the SEVERITY key — the flag key or setup-check key {@link AdvicePriority}
 *                        ranks. Never null.
 * @param interventionKey the intervention-library ENTRY key on a flag-sourced candidate (the
 *                        per-entry cooldown, the {@code intervention:<key>} effectiveness rollup
 *                        and {@code AnchorResolver}'s push channel gate all read this); null on a
 *                        setup-sourced one.
 * @param setupKey        the setup-check key on a setup-sourced candidate; null on a flag-sourced one.
 * @param eyebrow         the card's eyebrow — the source's own ("Mezo · észrevétel" /
 *                        "Mezo · beállítás"), so the two tiers stay visually distinct.
 * @param facts           deterministic, rule-provided evidence lines; may be empty (honest absence).
 * @param suggestions     config-provided suggestion texts; at least one.
 * @param fallbackProse   the exact text that would have shipped pre-S4 — used verbatim whenever the
 *                        LLM fails, answers blank, or invents a number.
 */
public record AdviceCandidate(String adviceKey, String interventionKey, String setupKey,
                              String eyebrow, List<String> facts, List<String> suggestions,
                              String fallbackProse) {

    /** A flag-sourced candidate: the library entry key rides along for cooldown/rollup/push. */
    public static AdviceCandidate fromFlag(String flagKey, String interventionKey, String eyebrow,
                                           List<String> facts, List<String> suggestions,
                                           String fallbackProse) {
        return new AdviceCandidate(flagKey, interventionKey, null, eyebrow, facts, suggestions,
            fallbackProse);
    }

    /** A setup-sourced candidate: no library entry, so no push anchor and no per-entry rollup. */
    public static AdviceCandidate fromSetupCheck(String checkKey, String eyebrow,
                                                 List<String> suggestions, String fallbackProse) {
        return new AdviceCandidate(checkKey, null, checkKey, eyebrow, List.of(), suggestions,
            fallbackProse);
    }
}
```

- [ ] **Step 2: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceProseGeneratorIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCandidate;
import io.mrkuhne.mezo.feature.proactive.service.AdviceProseGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S4 (bd mezo-d58h.4, spec §5): ONE CompanionLlm call over the facts, and a template fallback that
 * means the card is NEVER dropped — not on an exception, not on a blank answer, not on an
 * invented number.
 */
class AdviceProseGeneratorIT extends AbstractIntegrationTest {

    private static final String FALLBACK = "Ma este told előre a villanyoltást fél órával.";

    @Autowired private AdviceProseGenerator adviceProseGenerator;
    @Autowired private UserPopulator userPopulator;

    private AdviceCandidate candidate(String fact) {
        return AdviceCandidate.fromFlag("sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel",
            List.of(fact), List.of(FALLBACK), FALLBACK);
    }

    @Test
    void testWrite_shouldReturnTheModelProse_whenTheCallSucceeds() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner, candidate("Alvásadósság: 1,6 óra/éjszaka"));

        assertThat(prose).isEqualTo(FakeCompanionLlm.ADVICE_DEFAULT_ANSWER);
    }

    /** The marker is duplicated as a LITERAL in FakeCompanionLlm (a companion→proactive import
     *  would be a new package cycle) — this pins the two halves together. */
    @Test
    void testMarkerMirror_shouldMatchTheRealConstant() {
        assertThat(FakeCompanionLlm.ADVICE_MARKER_MIRROR).isEqualTo(AdviceProseGenerator.ADVICE_MARKER);
    }

    @Test
    void testWrite_shouldFallBackToTheTemplate_whenTheCallThrows() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner, candidate(FakeCompanionLlm.FAIL_COMPLETE));

        assertThat(prose).isEqualTo(FALLBACK);
    }

    @Test
    void testWrite_shouldFallBackToTheTemplate_whenTheAnswerIsBlank() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner, candidate(FakeCompanionLlm.EMPTY_ANSWER));

        assertThat(prose).isEqualTo(FALLBACK);
    }

    /** The invent sentinel is DIGIT-FREE on purpose: the fake answers with a number that appears
     *  nowhere in the facts/suggestions, so ProseNumberGuard really sees an ungrounded numeral. A
     *  sentinel that carried the number itself would smuggle it into the grounding text and the
     *  guard would (correctly) accept the answer — the test would then prove nothing. */
    @Test
    void testWrite_shouldFallBackToTheTemplate_whenTheModelInventsANumber() {
        UUID owner = userPopulator.createUser().getId();

        String prose = adviceProseGenerator.write(owner,
            candidate(FakeCompanionLlm.ADVICE_INVENT_SENTINEL));

        assertThat(prose).isEqualTo(FALLBACK);
    }
}
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='AdviceProseGeneratorIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `AdviceProseGenerator` does not exist.

- [ ] **Step 4: Write the generator**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceProseGenerator.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The advice card's prose (S4, bd mezo-d58h.4, spec §5): PURE-CODE gather (the candidate's own
 * facts + suggestions) → ONE cheap-tier {@link CompanionLlm} call → defensive checks → the text.
 * The model writes WORDING ONLY: the prompt forbids numerals outright (the numbers are shown in
 * the card's own facts list), and {@link ProseNumberGuard} enforces it afterwards.
 *
 * <p><b>The card is never dropped.</b> An exception, a blank answer, or an ungrounded numeral all
 * fall back to {@code candidate.fallbackProse()} — the exact text that shipped pre-S4 — so an LLM
 * outage degrades the card's wording, never its delivery (spec §7).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class AdviceProseGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm
     *  (a companion→proactive import would be a new package cycle). Keep the two in sync;
     *  {@code AdviceProseGeneratorIT} asserts the equality. */
    public static final String ADVICE_MARKER = "TANACS-KARTYA-FELADAT";

    private static final String ADVICE_PROMPT = ADVICE_MARKER + "\n"
            + "Írj 2-3 mondatos magyar tanácsot {{NÉV}} számára, kizárólag a megadott TÉNYEK és "
            + "JAVASLATOK alapján. (1) A tényeket a kártya külön listában mutatja, ezért SZÁMOT "
            + "NE ÍRJ LE a szövegben — fogalmazz szavakkal. (2) Új tényt, új számot vagy új "
            + "teendőt kitalálni tilos. (3) Ne szidj és ne ijesztgess: nevezd meg, mi történt, és "
            + "mondd meg, mi a következő apró lépés. (4) Gyógyszer adagolására vonatkozó "
            + "változtatást SOHA ne javasolj — az orvosi döntés. (5) Sima folyószöveggel "
            + "válaszolj, markdown és felsorolás nélkül.";

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;

    /** The card's body text — model prose when it is usable, the template otherwise. Never blank. */
    public String write(UUID userId, AdviceCandidate candidate) {
        String grounding = renderGrounding(candidate);
        String answer;
        try {
            answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_advice", candidate.adviceKey(), null, null),
                () -> companionLlm.complete(promptPersona.render(userId, ADVICE_PROMPT), grounding));
        } catch (Exception e) {
            log.warn("Advice prose call failed for user {} ({}) — template fallback",
                userId, candidate.adviceKey(), e);
            return candidate.fallbackProse();
        }
        if (answer == null || answer.isBlank()) {
            log.warn("Blank advice prose for user {} ({}) — template fallback",
                userId, candidate.adviceKey());
            return candidate.fallbackProse();
        }
        String prose = answer.strip();
        if (!ProseNumberGuard.grounded(prose, grounding)) {
            log.warn("Advice prose for user {} ({}) carried an ungrounded number — template fallback",
                userId, candidate.adviceKey());
            return candidate.fallbackProse();
        }
        return prose;
    }

    /** The ONLY numbers the model is allowed to echo, and the only suggestions it may lean on. */
    private String renderGrounding(AdviceCandidate candidate) {
        StringBuilder payload = new StringBuilder("TÉNYEK:\n");
        if (candidate.facts().isEmpty()) {
            payload.append("- (nincs számszerű tény ehhez a kártyához)\n");
        } else {
            candidate.facts().forEach(fact -> payload.append("- ").append(fact).append('\n'));
        }
        payload.append("\nJAVASLATOK:\n");
        candidate.suggestions().forEach(s -> payload.append("- ").append(s).append('\n'));
        return payload.toString();
    }
}
```

- [ ] **Step 5: Teach the fake to answer advice calls**

In `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`, next to the other marker mirrors (e.g. after `WEEKLY_MARKER_MIRROR`), add:

```java
    /** Mirror of AdviceProseGenerator.ADVICE_MARKER (feature/proactive) — a LITERAL, not an
     *  import: same cycle rationale as {@link #WEEKLY_MARKER_MIRROR}. Drift is caught by
     *  AdviceProseGeneratorIT's equality assertion against the real constant. */
    public static final String ADVICE_MARKER_MIRROR = "TANACS-KARTYA-FELADAT";

    /** Scripted advice prose (S4, mezo-d58h.4): {@code [fake-advice:…]} planted in a FACT is
     *  returned verbatim, so an IT can drive the number-guard and fallback paths. */
    public static final Pattern ADVICE_SENTINEL =
            Pattern.compile("\\[fake-advice:([^\\]]*)]", Pattern.DOTALL);

    /** The un-scripted advice answer — number-free on purpose, so the happy path passes the guard. */
    public static final String ADVICE_DEFAULT_ANSWER =
            "Látom, mi történt az elmúlt napokban. Kezdd egyetlen apró lépéssel még ma.";

    /** Scripted INVENTED number (S4): the sentinel itself is digit-free, so the number below
     *  appears nowhere in the call's grounding text and ProseNumberGuard genuinely rejects it. */
    public static final String ADVICE_INVENT_SENTINEL = "[fake-advice-invent]";

    public static final String ADVICE_UNGROUNDED_ANSWER = "Aludj ma 9999 órát.";
```

and, in `complete(String, List<Turn>, String, List<ToolCallback>, Map<String, Object>)`, next to the other marker branches (order does not matter among markers — place it after the `WEEKLY_MARKER_MIRROR` branch):

```java
        if (systemPrompt.startsWith(ADVICE_MARKER_MIRROR)) {
            // EMPTY_ANSWER's own branch sits AFTER every marker branch in this method, so a
            // marker branch that answered unconditionally would swallow the blank-answer path —
            // the advice card's fallback needs it, so it is honoured here explicitly.
            if (userMessage.contains(EMPTY_ANSWER)) {
                return "";
            }
            if (userMessage.contains(ADVICE_INVENT_SENTINEL)) {
                return ADVICE_UNGROUNDED_ANSWER;
            }
            Matcher m = ADVICE_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : ADVICE_DEFAULT_ANSWER;
        }
```

Note: `FAIL_COMPLETE` is handled by the generic throw at the very top of the method, which runs BEFORE all marker dispatch — no extra wiring for that path. `EMPTY_ANSWER` is NOT, hence the explicit check above; verify this by reading the method before writing the branch.

- [ ] **Step 6: Run the IT**

```bash
cd backend && ./mvnw test -Dtest='AdviceProseGeneratorIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS, 5 tests. If `testWrite_shouldFallBackToTheTemplate_whenTheAnswerIsBlank` fails, check that `EMPTY_ANSWER`'s branch really returns `""` for a `complete` call (it does at plan time — read the method rather than guessing).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(proactive): LLM advice prose with template fallback (mezo-d58h.4)"
```

---

### Task 7: `AdviceCardService` — the single day gate + severity supersede

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCardService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceCardServiceIT.java`

**Interfaces:**
- Consumes: `AdviceCandidate`, `AdvicePriority`, `AdviceProseGenerator`, `CompanionMessageRepository`.
- Produces: `AdviceCardService.deliver(UUID userId, AdviceCandidate candidate)` → `Optional<CompanionMessageEntity>` (empty = the day's card already ranks at least as high).

- [ ] **Step 1: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceCardServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCandidate;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCardService;
import io.mrkuhne.mezo.feature.proactive.service.SetupCheckService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S4 (bd mezo-d58h.4, spec §4 severity order + §5): ONE advice card per day across ALL tiers, and
 * a strictly higher-severity candidate arriving later in the day SUPERSEDES the incumbent instead
 * of being dropped (the S3 shape — two independent first-wins gates — is what this replaces).
 */
class AdviceCardServiceIT extends AbstractIntegrationTest {

    @Autowired private AdviceCardService adviceCardService;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private UserPopulator userPopulator;

    private AdviceCandidate flag(String flagKey) {
        return AdviceCandidate.fromFlag(flagKey, flagKey + "_entry", "Mezo · észrevétel",
            List.of("tény"), List.of("javaslat"), "Sablon-szöveg.");
    }

    private AdviceCandidate setup(String checkKey) {
        return AdviceCandidate.fromSetupCheck(checkKey, "Mezo · beállítás",
            List.of("Állítsd be az alvás-célt."), "Állítsd be az alvás-célt.");
    }

    @Test
    void testDeliver_shouldWriteAnAdviceCard() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(card.orElseThrow().getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(card.orElseThrow().getContent().interventionKey()).isEqualTo("sleep_debt_entry");
        assertThat(card.orElseThrow().getContent().facts()).containsExactly("tény");
        assertThat(card.orElseThrow().getContent().suggestions()).containsExactly("javaslat");
    }

    @Test
    void testDeliver_shouldRejectALowerSeverityCandidate_whenTheDayAlreadyHasACard() {
        UUID owner = userPopulator.createUser().getId();
        adviceCardService.deliver(owner, flag(FlagKey.MISSED_WORKOUTS));

        assertThat(adviceCardService.deliver(owner, flag(FlagKey.LOGGING_GAP))).isEmpty();

        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.MISSED_WORKOUTS);
    }

    /** Equal rank never churns the card — a re-raise of the same flag must leave the row (and its
     *  „Segített?" votes) exactly where they are. */
    @Test
    void testDeliver_shouldRejectAnEqualSeverityCandidate() {
        UUID owner = userPopulator.createUser().getId();
        UUID firstId = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT)).orElseThrow().getId();

        assertThat(adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT))).isEmpty();

        assertThat(todaysCard(owner).getId()).isEqualTo(firstId);
    }

    @Test
    void testDeliver_shouldSupersedeTheDaysCard_whenTheCandidateIsMoreSevere() {
        UUID owner = userPopulator.createUser().getId();
        UUID lowId = adviceCardService.deliver(owner, flag(FlagKey.LOGGING_GAP)).orElseThrow().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.MISSED_WORKOUTS));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getId()).isNotEqualTo(lowId);
        // The partial unique index is per (user, day, kind) on LIVE rows — the loser is soft-deleted.
        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.MISSED_WORKOUTS);
        assertThat(companionMessageRepository.findById(lowId)).isEmpty();
    }

    /** The whole point of S4 item 1: a setup card and a flag card can no longer both land today. */
    @Test
    void testDeliver_shouldSubsumeSetupCards_inTheSameGate() {
        UUID owner = userPopulator.createUser().getId();
        adviceCardService.deliver(owner, setup(SetupCheckService.CHECK_MISSING_SLEEP_GOAL));

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT));

        assertThat(card).isPresent();
        assertThat(companionMessageRepository
            .findByCreatedByAndMessageDateOrderByGeneratedAtAsc(owner, LocalDate.now()))
            .hasSize(1);
        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
    }

    private CompanionMessageEntity todaysCard(UUID owner) {
        return companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE).orElseThrow();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='AdviceCardServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `AdviceCardService` does not exist.

- [ ] **Step 3: Write the service**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCardService.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The ONE writer of the day's coaching card (S4, bd mezo-d58h.4, spec §4 severity order + §5).
 * Replaces the two independent first-wins gates S1–S3 shipped ({@code InterventionService} on
 * {@code kind=intervention}, {@code SetupCheckService} on {@code kind=setup}), which between them
 * could land TWO cards on the same day.
 *
 * <p><b>Gate:</b> today's live {@code advice} row is the incumbent. A candidate that does not
 * STRICTLY outrank it ({@link AdvicePriority}) is dropped; one that does supersedes it — soft
 * delete + insert inside this method's transaction, which the partial unique index
 * {@code uq_companion_message_created_by_date_kind ... where is_deleted = false} permits. A
 * superseded card's „Segített?" votes are left dangling by design (spec §8.1 names a dangling
 * feedback artifact harmless in a single-user app).
 *
 * <p><b>Not conditioned on {@code INTERVENTION_SWITCH}</b>, deliberately: {@code SetupCheckService}
 * (which runs without that switch) is one of its two callers, so gating this bean on the
 * intervention switch would fail the Spring context whenever that switch is off.
 *
 * <p>Per-source cooldowns are NOT here — they stay with the writer that owns their semantics (the
 * per-library-entry cooldown in {@code InterventionService}, the weekly per-check re-emit window in
 * {@code SetupCheckService}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class AdviceCardService {

    private final CompanionMessageRepository companionMessageRepository;
    private final AdviceProseGenerator adviceProseGenerator;

    @Transactional
    public Optional<CompanionMessageEntity> deliver(UUID userId, AdviceCandidate candidate) {
        LocalDate today = LocalDate.now();
        Optional<CompanionMessageEntity> incumbent = companionMessageRepository
            .findByCreatedByAndMessageDateAndKind(userId, today, CompanionMessageEntity.KIND_ADVICE);
        if (incumbent.isPresent()) {
            String incumbentKey = incumbent.get().getContent().adviceKey();
            if (!AdvicePriority.outranks(candidate.adviceKey(), incumbentKey)) {
                log.info("Advice {} skipped for user {}: today's card ({}) ranks at least as high",
                    candidate.adviceKey(), userId, incumbentKey);
                return Optional.empty();
            }
            companionMessageRepository.delete(incumbent.get());
            companionMessageRepository.flush();
            log.info("Advice {} supersedes today's card ({}) for user {}",
                candidate.adviceKey(), incumbentKey, userId);
        }
        String prose = adviceProseGenerator.write(userId, candidate);
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(today);
        row.setKind(CompanionMessageEntity.KIND_ADVICE);
        row.setContent(CompanionMessageEnvelope.advice(candidate.eyebrow(), prose,
            candidate.adviceKey(), candidate.interventionKey(), candidate.setupKey(),
            candidate.facts(), candidate.suggestions()));
        row.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        CompanionMessageEntity saved = companionMessageRepository.saveAndFlush(row);
        log.info("Advice {} delivered for user {}", candidate.adviceKey(), userId);
        return Optional.of(saved);
    }
}
```

- [ ] **Step 4: Run the IT**

```bash
cd backend && ./mvnw test -Dtest='AdviceCardServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proactive): one advice card per day by severity, superseding lower tiers (mezo-d58h.4)"
```

---

### Task 8: Route `InterventionService` through the advice card

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionServiceIT.java`

**Interfaces:**
- Consumes: `AdviceCardService.deliver`, `AdviceCandidate.fromFlag`, `AdviceFactRenderer.render`, `CompanionFlagLogRepository.findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc`.
- Produces: unchanged public signature `deliverForFlag(UUID userId, String flagKey)` → `Optional<CompanionMessageEntity>`, now writing `kind=advice`.

- [ ] **Step 1: Update the IT to expect an advice row**

In `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionServiceIT.java`, every assertion that reads `CompanionMessageEntity.KIND_INTERVENTION` or `getContent().interventionKey()` on a freshly delivered card must become `KIND_ADVICE` (the `interventionKey()` reads stay — the library entry key still rides on the envelope). Read the file first and change ONLY those assertions; do not rewrite the selection tests.

Add these two tests to the class:

```java
    @Test
    void testDeliverForFlag_shouldWriteAnAdviceRowCarryingBothKeys() {
        UUID owner = ownerId();

        Optional<CompanionMessageEntity> card = interventionService.deliverForFlag(owner, FlagKey.SLEEP_DEBT);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(card.orElseThrow().getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(card.orElseThrow().getContent().interventionKey()).isNotBlank();
    }

    /** The per-ENTRY cooldown must now see advice rows: a card written today under the new kind
     *  has to keep its own library entry out of the library for cooldownHours. Without this the
     *  cooldown silently stopped matching anything the moment the kind changed. */
    @Test
    void testDeliverForFlag_shouldRespectTheEntryCooldown_acrossAdviceRows() {
        UUID owner = ownerId();
        companionMessagePopulator.createAdvice(owner, LocalDate.now().minusDays(1),
            FlagKey.SLEEP_DEBT, "sleep_recover_tonight", InterventionService.EYEBROW,
            "tegnapi kártya", List.of(), List.of("javaslat"),
            Instant.now().minus(1, ChronoUnit.HOURS));

        Optional<CompanionMessageEntity> card = interventionService.deliverForFlag(owner, FlagKey.SLEEP_DEBT);

        // sleep_recover_tonight is the ONLY sleep_debt entry in the library and it is inside its
        // 48h cooldown, so there is no eligible entry left.
        assertThat(card).isEmpty();
    }
```

Add the imports this needs (`java.util.List`, `java.time.temporal.ChronoUnit` — check what the file already has).

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='InterventionServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — the delivered row is still `intervention`.

- [ ] **Step 3: Rewrite the service's delivery half**

In `InterventionService.java`: add the two new dependencies and replace `deliverForFlag` + `inCooldown`. Keep `effectiveness`, `OPTIMISTIC_PRIOR` and `EYEBROW` exactly as they are.

New fields (alongside the existing ones):

```java
    private final CompanionFlagLogRepository companionFlagLogRepository;
    private final AdviceCardService adviceCardService;
```

with imports:

```java
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
```

Replace `deliverForFlag`:

```java
    /**
     * The eligible library entry with the best effectiveness becomes today's advice CANDIDATE;
     * {@link AdviceCardService} owns the day gate and the severity comparison from there (S4,
     * mezo-d58h.4). This method keeps exactly what is intervention-specific: the library filter,
     * the per-entry cooldown, and the effectiveness weighting. The same-day short-circuit this
     * method used to carry is GONE on purpose — a higher-severity flag raised later in the day
     * must be able to supersede the card, which it cannot do if delivery returns early here.
     */
    @Transactional
    public Optional<CompanionMessageEntity> deliverForFlag(UUID userId, String flagKey) {
        List<CompanionProperties.Intervention> candidates = companionProperties.interventions().stream()
            .filter(entry -> entry.flag().equals(flagKey))
            .filter(entry -> !inCooldown(userId, entry))
            .toList();
        if (candidates.isEmpty()) {
            log.info("Intervention for {} skipped for user {}: no eligible library entry", flagKey, userId);
            return Optional.empty();
        }
        // One DB read per distinct candidate key, up front — the comparator below then only reads
        // from this map, never the DB, so Stream.max never re-queries per comparison.
        Map<String, Double> effectivenessByKey = candidates.stream()
            .map(CompanionProperties.Intervention::key)
            .distinct()
            .collect(Collectors.toMap(key -> key, key -> effectiveness(userId, key),
                (a, b) -> a, LinkedHashMap::new));
        CompanionProperties.Intervention picked = candidates.stream()
            .max(Comparator.comparingDouble(entry -> effectivenessByKey.get(entry.key())))
            .orElseThrow();
        // The raise's OWN frozen payload — never a re-derivation of the rule (spec §5: facts are
        // rule-provided). A raise with no payload yields no facts, and the card still ships.
        FlagPayloadEnvelope payload = companionFlagLogRepository
            .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(userId, flagKey)
            .map(CompanionFlagLogEntity::getPayload)
            .orElse(null);
        return adviceCardService.deliver(userId, AdviceCandidate.fromFlag(
            flagKey, picked.key(), EYEBROW,
            AdviceFactRenderer.render(flagKey, payload),
            List.of(picked.textHu()), picked.textHu()));
    }
```

Replace `inCooldown`:

```java
    /** The same library ENTRY must not repeat inside its own cooldown window — envelope
     *  {@code interventionKey}s of recent cards, filtered in memory (single-user volumes, spec
     *  §12). Reads BOTH kinds: {@code advice} is what S4 writes, {@code intervention} is what rows
     *  written before S4 carry, and a cooldown that stopped seeing the older rows would let a
     *  just-delivered entry repeat the day after the deploy. */
    private boolean inCooldown(UUID userId, CompanionProperties.Intervention entry) {
        Instant since = Instant.now().minus(entry.cooldownHours(), ChronoUnit.HOURS);
        return Stream.of(CompanionMessageEntity.KIND_ADVICE, CompanionMessageEntity.KIND_INTERVENTION)
            .flatMap(kind -> companionMessageRepository
                .findByCreatedByAndKindAndGeneratedAtAfter(userId, kind, since).stream())
            .anyMatch(row -> entry.key().equals(row.getContent().interventionKey()));
    }
```

Add `import java.util.stream.Stream;`. Update the class javadoc's "One card per day" paragraph to point at `AdviceCardService`:

```java
 * <p><b>One card per day</b> is no longer enforced here: since S4 (mezo-d58h.4) the day gate and
 * the spec §4 severity order live in {@link AdviceCardService}, so a higher-severity raise later
 * in the day supersedes the card this method produced.
```

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='InterventionServiceIT,InterventionConfigIT,InterventionSwitchOffIT,AdviceCardServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS. `InterventionSwitchOffIT` must still pass — `AdviceCardService` is NOT gated on the intervention switch, so turning that switch off removes only `InterventionService`/`InterventionEventListener`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proactive): deliver flag interventions as advice cards (mezo-d58h.4)"
```

---

### Task 9: Route `SetupCheckService` through the advice card

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SetupCheckService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/SetupCheckServiceIT.java`

**Interfaces:**
- Consumes: `AdviceCardService.deliver`, `AdviceCandidate.fromSetupCheck`.
- Produces: unchanged public signature `runFor(UUID userId)` → `Optional<CompanionMessageEntity>`, now writing `kind=advice` with `adviceKey == setupKey`.

- [ ] **Step 1: Update the IT**

In `SetupCheckServiceIT`, change every `CompanionMessageEntity.KIND_SETUP` assertion to `KIND_ADVICE` and keep the `setupKey()` assertions (setup-sourced advice rows still carry `setupKey`). The re-emit-window test that seeds a PAST card via `companionMessagePopulator.createSetup(...)` stays as-is — it deliberately pins that a pre-S4 `setup` row still counts against the window.

Add:

```java
    @Test
    void testRunFor_shouldWriteAnAdviceRowCarryingBothKeys() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(card.orElseThrow().getContent().adviceKey())
            .isEqualTo(SetupCheckService.CHECK_MISSING_SLEEP_GOAL);
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_MISSING_SLEEP_GOAL);
        assertThat(card.orElseThrow().getContent().interventionKey()).isNull();
    }

    /** Setup cards are the LOWEST non-round-0 tier: a flag card already on today's thread keeps
     *  the slot, and the setup check stays quiet (S4 item 1 — one card per day across tiers). */
    @Test
    void testRunFor_shouldStaySilent_whenAMoreSevereAdviceCardAlreadyOwnsTheDay() {
        UUID owner = userPopulator.createUser().getId();
        companionMessagePopulator.createAdvice(owner, LocalDate.now(), FlagKey.SLEEP_DEBT,
            "sleep_recover_tonight", InterventionService.EYEBROW, "kártya", List.of(),
            List.of("javaslat"), Instant.now());

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }
```

Add the imports it needs (`FlagKey`, `InterventionService`, `java.util.List`).

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='SetupCheckServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — the emitted row is still `setup`.

- [ ] **Step 3: Rewrite the emitter half**

In `SetupCheckService.java`, add the dependency:

```java
    private final AdviceCardService adviceCardService;
```

Replace `runFor`'s day-gate block — the whole `if (companionMessageRepository.findByCreatedByAndMessageDateAndKind(... KIND_SETUP ...).isPresent())` guard is DELETED (the advice gate owns it now):

```java
    /** The first check that fires for {@code userId} today, or empty when the setup is sound (or
     *  when a more severe advice card already owns the day — {@link AdviceCardService}). */
    @Transactional
    public Optional<CompanionMessageEntity> runFor(UUID userId) {
        LocalDate today = LocalDate.now();
        // Read the REPOSITORY, never SleepGoalService/SleepAnchorResolver: both fall back to a
        // config-default ghost, so the missing-row condition is invisible through them.
        if (sleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty()) {
            return emit(userId, CHECK_MISSING_SLEEP_GOAL, MISSING_SLEEP_GOAL_TEXT);
        }
        return planFeasibilityCalculator.evaluate(userId, today)
            .filter(verdict -> !verdict.feasible())
            .flatMap(verdict -> emit(userId, CHECK_PLAN_FEASIBILITY, feasibilityText(verdict)));
    }
```

Replace `emit` and `inReEmitWindow`:

```java
    /** Hands the check to the advice-card layer unless this same check already spoke inside the
     *  re-emit window. The card's severity rank (setup cards sit below every flag) is applied by
     *  {@link AdviceCardService}, so a quiet return here can mean either "already said this week"
     *  or "a more severe card owns today" — both are logged. */
    private Optional<CompanionMessageEntity> emit(UUID userId, String checkKey, String text) {
        if (inReEmitWindow(userId, checkKey)) {
            log.info("Setup check {} skipped for user {}: inside the re-emit window", checkKey, userId);
            return Optional.empty();
        }
        return adviceCardService.deliver(userId,
            AdviceCandidate.fromSetupCheck(checkKey, EYEBROW, List.of(text), text));
    }

    /** The same CHECK must not repeat inside its window — envelope {@code setupKey}s of recent
     *  cards, filtered in memory (single-user volumes). Reads BOTH kinds: {@code advice} is what
     *  S4 writes, {@code setup} is what pre-S4 rows carry. */
    private boolean inReEmitWindow(UUID userId, String checkKey) {
        Instant since = Instant.now().minus(properties.reEmitHours(), ChronoUnit.HOURS);
        return Stream.of(CompanionMessageEntity.KIND_ADVICE, CompanionMessageEntity.KIND_SETUP)
            .flatMap(kind -> companionMessageRepository
                .findByCreatedByAndKindAndGeneratedAtAfter(userId, kind, since).stream())
            .anyMatch(row -> checkKey.equals(row.getContent().setupKey()));
    }
```

Add `import java.util.stream.Stream;`; drop the now-unused `CompanionMessageEnvelope` import if the compiler flags it. Update the class javadoc's last paragraph:

```java
 * <p>Checks are ordered and first-wins — a user with no sleep goal at all gets the goal card, not
 * a feasibility card computed against a goal that does not exist. Since S4 (mezo-d58h.4) the card
 * itself is an {@code advice} row written by {@link AdviceCardService}, which applies the spec §4
 * severity order across flags AND setup checks; this service only decides WHICH check speaks and
 * whether its weekly window is open.
```

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='SetupCheckServiceIT,SetupCheckJobSwitchOffIT,SetupCheckPropertiesIT,PlanFeasibilityIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proactive): deliver setup checks as advice cards under the one severity gate (mezo-d58h.4)"
```

---

### Task 10: The three silent consumers — push anchor, effectiveness rollup, feed kind

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FeedMessageKindService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AnchorResolverInterventionIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/FeedbackLearningServiceIT.java`

**Interfaces:**
- Produces: no signature changes — `interventionAnchors` and `interventionKeysByIds` simply stop filtering advice rows out.

This is the task the epic's recurring bug class exists for: both of these key off `KIND_INTERVENTION`, and after Tasks 8–9 nothing writes that kind any more. Left alone, intervention pushes and the whole W5.2 effectiveness-weighting loop go silently dead — no error, no test failure in the classes above.

- [ ] **Step 1: Write the failing tests**

In `AnchorResolverInterventionIT`, find the test that seeds a card via `companionMessagePopulator.createIntervention(...)` and asserts a push anchor. Add a twin that seeds an ADVICE row:

```java
    @Test
    void testResolve_shouldAnchorAPushOnAnAdviceCard() {
        UUID owner = userPopulator.createUser().getId();
        companionMessagePopulator.createAdvice(owner, LocalDate.now(), "sleep_debt",
            "sleep_recover_tonight", "Mezo · észrevétel", "kártya szöveg", List.of("tény"),
            List.of("javaslat"), Instant.now());

        List<AnchoredEvent> events = anchorResolver.resolve(owner, LocalDate.now());

        assertThat(events).anyMatch(e -> e.category().equals("intervention"));
    }
```

(Read the existing test first and copy its exact `resolve(...)` call shape and its assertion vocabulary — `category()` naming above is the expected shape, but the file is the source of truth.)

In `FeedbackLearningServiceIT`, find the test that pins `intervention:<key>` rollups and add:

```java
    @Test
    void testRollup_shouldCountAnAdviceCardsVerdict_underItsLibraryEntryScope() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = companionMessagePopulator.createAdvice(owner, LocalDate.now(),
            "sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel", "kártya szöveg",
            List.of("tény"), List.of("javaslat"), Instant.now());
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE,
            card.getId(), MessageFeedbackEntity.VERDICT_UP);

        feedbackLearningService.rollup(owner);

        assertThat(feedbackRollupRepository.findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(
            owner, FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + "sleep_recover_tonight",
            feedbackLearningProperties.windowDays())).isPresent();
    }
```

(Again: copy the file's real populator/verdict/rollup-entry-point names — the method used to trigger the rollup and the verdict factory signature must match what the class already uses.)

- [ ] **Step 2: Run them to verify they fail**

```bash
cd backend && ./mvnw test -Dtest='AnchorResolverInterventionIT,FeedbackLearningServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: FAIL on both new tests — advice rows are filtered out.

- [ ] **Step 3: Widen `AnchorResolver.interventionAnchors`**

Replace the card lookup inside the `for (LocalDate cardDate : ...)` loop so both kinds are considered (advice first — it is what S4 writes):

```java
        for (LocalDate cardDate : List.of(date.minusDays(1), date)) {
            // S4 (mezo-d58h.4): the coaching card's kind is `advice`; `intervention` rows are
            // pre-S4 history. Both are read so a deploy day does not silently lose a push.
            Stream.of(CompanionMessageEntity.KIND_ADVICE, CompanionMessageEntity.KIND_INTERVENTION)
                .map(kind -> companionMessageRepository
                    .findByCreatedByAndMessageDateAndKind(owner, cardDate, kind))
                .flatMap(Optional::stream)
                .findFirst()
                .ifPresent(msg -> {
```

Everything inside the `ifPresent` lambda stays exactly as it is (it already reads `msg.getContent().interventionKey()`, which a setup-sourced advice row leaves null → the library lookup finds nothing → no push, which is the correct pre-existing behaviour for setup cards). Add `import java.util.stream.Stream;` if absent, and update the section comment above the method to name `advice`.

- [ ] **Step 4: Widen `FeedMessageKindService.interventionKeysByIds`**

```java
    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> interventionKeysByIds(UUID userId, Collection<UUID> feedMessageIds) {
        if (feedMessageIds.isEmpty()) {
            return Map.of();
        }
        // S4 (mezo-d58h.4): a flag-sourced `advice` row carries the library ENTRY key in the same
        // envelope field, so the W5.2 per-entry effectiveness rollup keeps working across the kind
        // change. Setup-sourced advice rows have a null interventionKey and drop out below.
        return companionMessageRepository.findAllById(feedMessageIds).stream()
            .filter(m -> userId.equals(m.getCreatedBy()))
            .filter(m -> CompanionMessageEntity.KIND_INTERVENTION.equals(m.getKind())
                || CompanionMessageEntity.KIND_ADVICE.equals(m.getKind()))
            .filter(m -> m.getContent().interventionKey() != null)
            .collect(Collectors.toMap(CompanionMessageEntity::getId, m -> m.getContent().interventionKey()));
    }
```

- [ ] **Step 5: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='AnchorResolverInterventionIT,AnchorResolverFeedIT,AnchorResolverIT,FeedbackLearningServiceIT,InterventionServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(proactive): keep push anchoring and effectiveness rollups alive across the advice kind (mezo-d58h.4)"
```

---

### Task 11: Library entries for `logging_gap` and `missed_workouts`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionConfigIT.java`

**Interfaces:**
- Produces: library entry keys `logging_gap_restart`, `logging_gap_sleep_suspicion`, `missed_workouts_restart`.

S2 shipped both flags but no library entry for either, so today they raise and deliver nothing ("no eligible library entry"). Note the `@Pattern` on `Intervention.flag` ALREADY allows both keys (S2 widened it) — do not touch that regex, and do not add S6 keys to it.

- [ ] **Step 1: Write the failing config test**

Add to `InterventionConfigIT` (read the class first — it already autowires `CompanionProperties`):

```java
    @Test
    void testLibrary_shouldServeEveryRoundOneFlag() {
        assertThat(companionProperties.interventions())
            .extracting(CompanionProperties.Intervention::flag)
            .contains(FlagKey.LOGGING_GAP, FlagKey.MISSED_WORKOUTS);
    }
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='InterventionConfigIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — neither flag has an entry.

- [ ] **Step 3: Add the entries**

In `backend/src/main/resources/application.yml`, append to the `interventions:` list (after the `healthy_celebrate` entry, keeping the file's exact indentation):

```yaml
      # S4 (mezo-d58h.4): S2's two flags raised into an EMPTY library — they detected and then
      # delivered nothing. These are their advice-card suggestion texts (and the template prose
      # used whenever the LLM call fails).
      - key: logging_gap_restart
        flag: logging_gap
        channel: both
        text-hu: "Napok óta nincs friss adat rólad, így csak találgatni tudnék. Rögzíts ma egyetlen dolgot — egy étkezést vagy egy check-int —, és onnantól újra veled tudok gondolkodni."
        cooldown-hours: 48
        quiet-hours-exempt: false
      - key: logging_gap_sleep_suspicion
        flag: logging_gap
        channel: feed
        text-hu: "A rögzítetlen éjszakák mellett a bejegyzett alvásaid is rövidebbek a célodnál. Ma este kezdd a lefekvéssel, és reggel rögzítsd — így kiderül, tényleg adósság-e."
        cooldown-hours: 72
        quiet-hours-exempt: false
      - key: missed_workouts_restart
        flag: missed_workouts
        channel: both
        text-hu: "Több tervezett edzésnap is kimaradt egymás után. Ne a teljes hetet akard behozni: tedd vissza a naptárba a következő egyet, és vidd le könnyebbre, ha kell."
        cooldown-hours: 72
        quiet-hours-exempt: false
```

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='InterventionConfigIT,InterventionServiceIT,AdviceCardServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proactive): library entries for logging_gap and missed_workouts (mezo-d58h.4)"
```

---

### Task 12: `missed_workouts` reaches the morning prompt

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageMissedWorkoutsIT.java`

**Interfaces:**
- Produces: package-private `CompanionMessageGenerator.missedWorkoutsBlock(UUID userId, LocalDate date)` → `String` (empty string when there is no live raise).

Spec §4 row 3 owes this: "the morning companion prompt receives this as a fact (no more blind cheering)". S2 deferred it to S4 and shipped a payload rich enough to feed it.

- [ ] **Step 1: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageMissedWorkoutsIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S4 (bd mezo-d58h.4, spec §4 row 3): a live {@code missed_workouts} raise becomes a FACT in the
 * morning briefing's prompt — "no more blind cheering". The block is read from the raise's own
 * frozen payload, never re-derived. Lives in the {@code ...proactive.service} package so it can
 * assert the package-private block builder directly rather than guessing at prompt text through
 * the fake's answer.
 */
class CompanionMessageMissedWorkoutsIT extends AbstractIntegrationTest {

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private FlagPayloadEnvelope payload() {
        return FlagPayloadEnvelope.missedWorkouts(new FlagPayloadEnvelope.MissedWorkouts(
            14, 2, 3, List.of("2026-09-01", "2026-09-02", "2026-09-03"),
            List.of("2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04")));
    }

    @Test
    void testMissedWorkoutsBlock_shouldCarryTheRaisesOwnNumbers() {
        UUID owner = userPopulator.createUser().getId();
        flagLogPopulator.raise(owner, FlagKey.MISSED_WORKOUTS, FlagKey.SOURCE_SWEEP, payload());

        String block = companionMessageGenerator.missedWorkoutsBlock(owner, LocalDate.now());

        assertThat(block).contains("KIMARADT EDZÉSEK").contains("3").contains("2026-09-02");
    }

    @Test
    void testMissedWorkoutsBlock_shouldBeEmpty_whenThereIsNoRaise() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(companionMessageGenerator.missedWorkoutsBlock(owner, LocalDate.now())).isEmpty();
    }

    /** A raise older than the briefing's own lookback window is stale news — the morning message
     *  must not keep scolding about a run of missed days from a month ago. */
    @Test
    void testMissedWorkoutsBlock_shouldBeEmpty_whenTheRaiseIsOlderThanTheFeedWindow() {
        UUID owner = userPopulator.createUser().getId();
        flagLogPopulator.raiseAt(owner, FlagKey.MISSED_WORKOUTS, FlagKey.SOURCE_SWEEP, payload(),
            Instant.now().minus(365, ChronoUnit.DAYS));

        assertThat(companionMessageGenerator.missedWorkoutsBlock(owner, LocalDate.now())).isEmpty();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='CompanionMessageMissedWorkoutsIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `missedWorkoutsBlock` does not exist.

- [ ] **Step 3: Implement the block and wire it into the morning payload**

In `CompanionMessageGenerator.java` add the dependency and imports:

```java
    private final CompanionFlagLogRepository companionFlagLogRepository;
```

```java
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.time.ZoneId;
import java.util.Objects;
```

Add the method (place it right after `generateMorning`):

```java
    /**
     * S4 (bd mezo-d58h.4, spec §4 row 3): a live {@code missed_workouts} raise as a FACT block for
     * the morning briefing — "no more blind cheering". Reads the raise's OWN frozen payload
     * (append-only flag log), never re-deriving the rule, and only inside the same lookback window
     * the briefing already uses for daily summaries, so an ancient raise cannot keep scolding.
     * Package-private: {@code CompanionMessageMissedWorkoutsIT} asserts it directly rather than
     * trying to read prompt text back out of a scripted answer.
     */
    String missedWorkoutsBlock(UUID userId, LocalDate date) {
        Instant windowStart = date.minusDays(properties.feed().pastDays())
                .atStartOfDay(ZoneId.systemDefault()).toInstant();
        return companionFlagLogRepository
                .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(
                        userId, FlagKey.MISSED_WORKOUTS)
                .filter(row -> !row.getCreatedAt().isBefore(windowStart))
                .map(CompanionFlagLogEntity::getPayload)
                .map(FlagPayloadEnvelope::missedWorkouts)
                .filter(Objects::nonNull)
                .map(mw -> "\nKIMARADT EDZÉSEK (tény — ne dicsérj vakon, de ne is szidj):\n"
                        + "- leghosszabb kihagyott sorozat: " + mw.longestMissedRun()
                        + " egymást követő tervezett nap\n"
                        + "- kimaradt napok: " + String.join(", ", mw.missedDays()) + "\n")
                .orElse("");
    }
```

And append it to the morning payload, immediately after the `KORÁBBI NAPOK` loop and BEFORE the `HIVATKOZÁS-JELÖLTEK` block (the ref-candidate indexes must stay last — the model selects refs by index against that list):

```java
        payload.append(missedWorkoutsBlock(userId, date));
```

- [ ] **Step 4: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='CompanionMessageMissedWorkoutsIT,CompanionMessageGeneratorIT,CompanionMessageJobIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(proactive): feed missed_workouts into the morning briefing prompt (mezo-d58h.4)"
```

---

### Task 13: Contract + FE — facts and suggestions on the card

**Files:**
- Modify: `api/feature/proactive/proactive.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java`
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/today/feedApi.ts`
- Modify: `frontend/src/features/today/logic/mezoMessages.ts`
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx`
- Modify: `frontend/src/features/today/components/MezoMessagesSheet.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiFeedIT.java`, `frontend/src/features/today/logic/mezoMessages.test.ts`, `frontend/src/features/today/pages/NapMezoPage.test.tsx`

**Interfaces:**
- Produces: `FeedMessageResponse.facts` / `.suggestions` (optional string arrays); FE `FeedMessage.facts?` / `.suggestions?`; `MezoMessageItem.facts?` / `.suggestions?`.

Scope note: the spec §5 payload's `actions[]` and `applied` are deliberately NOT surfaced here. There is no mutation endpoint yet (S5) and no rule that produces an action (S6), so their contract shape would be a guess. They are trailing additions when S5 ships the buttons.

- [ ] **Step 1: Write the failing backend test**

In `ProactiveApiFeedIT`, add:

```java
    @Test
    void testGetFeed_shouldExposeTheAdviceCardsFactsAndSuggestions() {
        UUID owner = userPopulator.createUser().getId();
        companionMessagePopulator.createAdvice(owner, LocalDate.now(), "sleep_debt",
            "sleep_recover_tonight", "Mezo · észrevétel", "kártya szöveg",
            List.of("Alvásadósság: 1,6 óra/éjszaka"), List.of("Told előre a villanyoltást."),
            Instant.now());

        List<FeedMessageResponse> feed = proactiveFeedService.getFeed(owner, LocalDate.now());

        assertThat(feed).hasSize(1);
        assertThat(feed.get(0).getKind()).isEqualTo(FeedMessageResponse.KindEnum.ADVICE);
        assertThat(feed.get(0).getFacts()).containsExactly("Alvásadósság: 1,6 óra/éjszaka");
        assertThat(feed.get(0).getSuggestions()).containsExactly("Told előre a villanyoltást.");
    }
```

(Match the class's existing style — if it drives the endpoint through MockMvc rather than the service, do the same and assert on the JSON.)

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='ProactiveApiFeedIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `getFacts()` does not exist on the generated DTO.

- [ ] **Step 3: Extend the contract**

In `api/feature/proactive/proactive.yml`, inside `FeedMessageResponse.properties`, after `refs`:

```yaml
        facts:
          type: array
          description: Advice-card evidence — deterministic, rule-provided lines rendered from the raise's own frozen payload (S4, mezo-d58h.4). Present only on advice rows; the model never writes these.
          items: { type: string }
        suggestions:
          type: array
          description: Advice-card suggestion texts (config-provided). Present only on advice rows.
          items: { type: string }
```

Leave `required` untouched — both are optional.

- [ ] **Step 4: Map them**

In `ProactiveMapper.java`, on `toFeedResponse`:

```java
    @Mapping(target = "facts", source = "content.facts")
    @Mapping(target = "suggestions", source = "content.suggestions")
```

- [ ] **Step 5: Regenerate and run the backend test**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd ../backend && ./mvnw test -Dtest='ProactiveApiFeedIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 6: Carry the fields through the FE data layer**

`frontend/src/data/types.ts` — extend `FeedMessage`:

```ts
  /** Advice-card evidence (S4, mezo-d58h.4) — deterministic, rule-provided; only advice rows. */
  facts?: string[]
  /** Advice-card suggestion texts (config-provided); only advice rows. */
  suggestions?: string[]
```

`frontend/src/data/today/feedApi.ts` — inside the `wire.map`:

```ts
    facts: m.facts,
    suggestions: m.suggestions,
```

`frontend/src/features/today/logic/mezoMessages.ts` — extend `MezoMessageItem`:

```ts
  /** Advice-card evidence (S4, mezo-d58h.4) — rendered as the „Miből gondolom" list. Feed advice
   *  rows only; demo/nudge items never have it. */
  facts?: string[]
  /** Advice-card suggestions — rendered as the card's action-less bullet list until S5 turns the
   *  actionable ones into buttons. */
  suggestions?: string[]
```

and in `feedToMessageItem`, after `refs: m.refs,`:

```ts
    facts: m.facts,
    suggestions: m.suggestions,
```

- [ ] **Step 7: Render them**

In `frontend/src/features/today/pages/NapMezoPage.tsx`, inside `renderCard`, between the `m.refs` line and the `m.meta` line:

```tsx
      {m.suggestions && m.suggestions.length > 0 && (
        <ul className="nap-mzmsg-sug">
          {m.suggestions.map((s, j) => (
            <li key={j}><SafeMarkdown text={s} /></li>
          ))}
        </ul>
      )}
      {m.facts && m.facts.length > 0 && (
        <>
          <div className="nap-mzmsg-meta">Miből gondolom</div>
          <ul className="nap-mzmsg-facts">
            {m.facts.map((f, j) => (
              <li key={j}>{f}</li>
            ))}
          </ul>
        </>
      )}
```

and widen both „Segített?" comparisons in the same file:

```tsx
          {(m.kind === 'intervention' || m.kind === 'advice') && <div className="nap-mzmsg-meta">Segített?</div>}
```

```tsx
            label={m.kind === 'intervention' || m.kind === 'advice' ? 'a közbelépésről' : 'az üzenetről'}
```

Apply the identical two comparison widenings in `frontend/src/features/today/components/MezoMessagesSheet.tsx` (lines 60 and 65 at plan time, `td-bub-meta` class there — do not copy the `nap-` class names into that file).

In `frontend/src/styles/prototype.css`, after the `.nap-mzmsg-meta` rule:

```css
/* Advice card (S4, mezo-d58h.4): a config-provided suggestion list and the deterministic
   evidence list under it. Both stay inside the message card's own type scale. */
.nap-mzmsg-sug { margin: 7px 0 0; padding-left: 18px; font-size: 13px; font-weight: 300; }
.nap-mzmsg-sug li { margin-top: 4px; }
.nap-mzmsg-facts { margin: 2px 0 0; padding-left: 18px; font-size: 11px; color: var(--mz-ink-mut); }
.nap-mzmsg-facts li { margin-top: 2px; }
```

- [ ] **Step 8: Extend the FE tests**

In `frontend/src/features/today/logic/mezoMessages.test.ts`, add to the existing suite:

```ts
  it('carries an advice row\'s facts and suggestions onto the thread item', () => {
    const items = buildMezoMessages({
      feed: [{
        id: 'fm-9', kind: 'advice', eyebrow: 'Mezo · észrevétel',
        body: [{ type: 'p', text: 'Ma este feküdj le korábban.' }], refs: [],
        facts: ['Alvásadósság: 1,6 óra/éjszaka'], suggestions: ['Told előre a villanyoltást.'],
        generatedAt: '2026-09-04T15:00:00Z',
      }],
      demoBriefing: null,
    })

    expect(items[0].kind).toBe('advice')
    expect(items[0].facts).toEqual(['Alvásadósság: 1,6 óra/éjszaka'])
    expect(items[0].suggestions).toEqual(['Told előre a villanyoltást.'])
  })
```

(Match the file's existing `buildMezoMessages` call shape and its `FeedMessage` fixture style — the object above is the expected shape, the file is the source of truth for how the fixture is built.)

In `frontend/src/features/today/pages/NapMezoPage.test.tsx`, add a test that renders a feed containing an advice row and asserts that the suggestion text, the fact text and the „Segített?" label are all on screen. Copy the file's existing feed-mocking helper rather than inventing a new one.

- [ ] **Step 9: Run everything**

```bash
cd backend && ./mvnw test -Dtest='ProactiveApiFeedIT,AdviceCardServiceIT' -q -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Expected: PASS in both FE modes and a clean build. A bare `pnpm test` is MOCK mode — the explicit `VITE_USE_MOCK=false` run is the real-mode gate.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(proactive): surface advice facts and suggestions on the card (mezo-d58h.4)"
```

---

### Task 14: Docs + CODEMAP + the full focused gate

**Files:**
- Modify: `docs/features/proactive.md`
- Modify: `docs/CODEMAP.md` (generated)

- [ ] **Step 1: Update the feature doc**

Read `docs/features/proactive.md` and update it to describe S4's actual shape — do not append a changelog entry, edit the sections that are now wrong:

- the message-kind list gains `advice` and marks `intervention`/`setup` as pre-S4 history;
- the "one card per day" description moves from `InterventionService`/`SetupCheckService` to `AdviceCardService` + `AdvicePriority`, including the supersede rule and the dangling-vote consequence;
- the LLM section gains the advice call (marker, prompt rules, the number guard, the template fallback);
- the traps section gains: "the coaching card's kind is `advice`; `AnchorResolver` and `FeedMessageKindService` both filter on it, and both are silent if they are not updated together".

Bump the doc's frontmatter `updated:` field to `2026-09-04`.

- [ ] **Step 2: Regenerate the CODEMAP (AFTER the docs edit)**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```

Expected: the second command exits 0. Regenerating BEFORE the docs edit is what made S3's docs commit fail `--check`.

- [ ] **Step 3: Run the full focused gate**

```bash
cd backend && ./mvnw test -Dtest='AdvicePriorityTest,AdviceFactRendererTest,ProseNumberGuardTest,AdviceCardServiceIT,AdviceProseGeneratorIT,CompanionMessageAdvicePersistenceIT,CompanionMessageMissedWorkoutsIT,InterventionServiceIT,InterventionConfigIT,InterventionSwitchOffIT,SetupCheckServiceIT,SetupCheckJobSwitchOffIT,SetupCheckPropertiesIT,PlanFeasibilityIT,ProactiveApiFeedIT,CompanionMessageGeneratorIT,CompanionMessageJobIT,AnchorResolverInterventionIT,FeedbackLearningServiceIT' -q -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Expected: PASS everywhere, with a non-zero test count in the Maven run. **A "Tests run: 0" line is a failure** — it means a class name in the list does not exist.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(proactive): document the S4 advice card + regenerate the codemap (mezo-d58h.4)"
```

---

### Task 15: Ship — PR, CI, merge

**Files:** none (process). The PR is the authoritative gate: the full backend IT suite, ArchUnit, contract-drift and CODEMAP freshness only run there.

- [ ] **Step 1: Push and open the self-PR**

```bash
git push -u origin feat/proactive-coaching-s4
gh pr create --fill --title "feat(proactive): S4 — advice card, LLM prose, one severity gate (mezo-d58h.4)"
```

- [ ] **Step 2: Wait for CI green**

```bash
gh pr checks --watch
```

If a check fails, fix it on the branch and push again. If `gh pr checks` reports "no checks reported", the PR is CONFLICTING — merge `origin/main` into the branch (resolve `.beads/issues.jsonl` by taking either side; the pre-commit hook re-exports the authoritative union from Dolt), push, and CI starts.

- [ ] **Step 3: Merge to main from a temp branch**

Never `cd` to the primary repo — `main` is checked out there.

```bash
git fetch origin main
git checkout -b tmp-merge-s4 origin/main
git merge --no-ff feat/proactive-coaching-s4 -m "Merge branch 'feat/proactive-coaching-s4' — proactive coaching S4: advice card + severity gate (mezo-d58h.4)"
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
git add docs/CODEMAP.md && git commit --amend --no-edit
git push origin tmp-merge-s4:main
git checkout feat/proactive-coaching-s4
git branch -D tmp-merge-s4
git push origin --delete feat/proactive-coaching-s4
```

The CODEMAP regeneration is mandatory: `origin/main` moves under long branches, and pushing a stale CODEMAP fails the freshness gate on somebody else's next PR. If `--check` already passes, the `git add` finds nothing to stage and the `--amend --no-edit` is a no-op — that is fine.

- [ ] **Step 4: Close the bd issue and push the tracker**

```bash
bd close mezo-d58h.4
bd dolt push
git status
```

`git status` must show the branch up to date with origin.

---

## Self-review notes (for the executor)

- **Spec coverage:** §5's `facts`/`prose`/`suggestions` → Tasks 4, 6, 13; the "one CompanionLlm call + template fallback + never invents numbers/actions" rule → Tasks 5, 6; "one card/day via severity priority" → Tasks 3, 7, 8, 9; "keeps the „Segített?" feedback → effectiveness rollup" → Tasks 10, 13. §4's severity order → Task 3. §4 row 3's morning-prompt debt → Task 12. §5's `actions[]`/`applied` are explicitly deferred to S5 (stated in Task 13) — that is the one spec line this slice does not implement, and it is deferred by the epic's own slicing, not by omission.
- **Open questions carried into S5:** `mezo-9gp3` (unbounded `WEIGHT_TREND_PCT_WK` weight-log read) is untouched by S4 and must be wired before S6 consumes it. `mezo-5qek` (setup cards have no push path) is now a config-shaped fix: setup-sourced advice rows carry a null `interventionKey`, so `AnchorResolver` still finds no library entry for them.
- **If a step's verbatim code does not compile against the file you are editing, the FILE wins** — read it, adapt, and say so in your task report. Every code block here was written against the tree at `feat/proactive-coaching-s4` after `origin/main` was merged on 2026-09-04.
