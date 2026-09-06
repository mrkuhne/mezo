# Coaching Observer S2 — Read Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `GET /api/companion/flags/trace?date=…` endpoint that renders a whole day of the coaching engine's decision — all 13 rules in severity order with their verdict, evidence and card outcome, plus the day's transitions — and a `flagKey` on the delivered card so the winner can be correlated; no UI.

**Architecture:** The read surface lives entirely in `feature.companion.flags` (the trap in the spec §3: a `feature.proactive` controller must not read `CompanionFlagLogRepository`). It needs two things proactive owns — the severity ranking (`AdvicePriority`) and the day's delivered card — so it takes them through two **consumer-owned ports** (ADR 0012, the `NudgeSendPort` idiom): the interface lives in `companion.flags.service`, the adapter in `proactive.service`. That keeps the only feature-slice edge pointing `proactive → companion`, which already exists, so `ArchitectureTest.feature_slices_are_cycle_free` sees no new cycle. Nothing is recomputed: closing state and timeline both fall out of `companion_flag_trace`, RAISED evidence is read back from `companion_flag_log`'s frozen payload, and the ranking comes from the one static table that already decides the card.

**Tech Stack:** Java 21 / Spring Boot / JPA / MapStruct / contract-first OpenAPI (openapi-merge + openapi-generator + openapi-typescript); React 19 / TanStack Query / MSW / Vitest.

## Global Constraints

- **Driving issue:** `mezo-6269.2`. Every commit subject carries it: `feat(companion): … (mezo-6269.2)`.
- **Spec:** `docs/superpowers/specs/2026-09-05-coaching-observer-design.md` §4.4, §5, §7. S1 (`mezo-6269.1`) is done and merged on this branch — `FlagVerdict`, `FlagOutcome`, `UnavailableReason`, `TraceDisposition`, `companion_flag_trace`, `FlagTraceWriter` all exist.
- **Branch:** work continues on `feat/coaching-observer`. One self-PR → CI green → local `--no-ff` merge → push main.
- **No coaching logic on the read side.** The endpoint renders what the engine concluded. It never re-evaluates a rule, never invents a ranking, never estimates a missing number.
- **ArchUnit:** `feature.companion..` must not import `feature.proactive..` — ever. Controllers live in a `..controller..` package and implement a generated `io.mrkuhne.mezo.api.controller.*Api` interface. No `@Value`, no class-level `@Transactional`, no raw `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` (use `SystemRuntimeErrorException` + `SystemMessage`).
- **Contract drift is CI-gated.** Any change under `api/feature/**` must be followed by `cd api/generate && npm run generate:api` **and** `cd frontend && pnpm generate:api`, with `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` committed in the same change.
- **CODEMAP freshness:** `node scripts/gen-codemap.mjs` must be re-run and `docs/CODEMAP.md` committed in the same change. Focused test runs do NOT catch this.
- **Testcontainers:** every backend IT touching this persistence runs with `-Dmezo.test.use-testcontainers=true`; the fixed-DB mode races and fakes failures.
- **`VITE_USE_MOCK` unset means mock.** A frontend test that must exercise the real arm stubs it explicitly: `vi.stubEnv('VITE_USE_MOCK', 'false')`.
- **Honest states (mezo-yew / mezo-0xl):** four-way — loading / real error / degraded / genuinely empty. Never a fabricated zero or a seed value during an unresolved real-mode fetch. The sanctioned dual-mode read is `useDualQuery`; `const { data = seed } = useQuery(...)` is banned and `src/data/dualMode.guard.test.ts` fails the build on it.
- **Hungarian copy** for every user-facing string; numbers formatted with the Hungarian locale (decimal comma), as `AdviceFactRenderer` already does.
- **Day boundaries** use `ZoneId.systemDefault()` — the house convention for user-day windows in this single-user app (`DailySummaryService`, `ProfileAssembler`).

---

## File Structure

**Backend — `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/`**

| File | Responsibility |
|---|---|
| `service/FlagCatalog.java` *(new)* | The 13 keys with their Hungarian label and domain. The one place a round-2 rule is named. No ranking here. |
| `service/AdviceRankPort.java` *(new)* | Consumer-owned seam for the severity rank. |
| `service/DailyCardPort.java` *(new)* | Consumer-owned seam for "which card was delivered that day". |
| `service/FlagFactRenderer.java` *(moved from `proactive.service.AdviceFactRenderer`)* | RAISED evidence lines from a frozen `FlagPayloadEnvelope`. One renderer, two consumers. |
| `service/FlagTraceCopy.java` *(new)* | CLEAR and UNAVAILABLE explanations — the other two thirds of the same renderer family. |
| `service/FlagTraceReadService.java` *(new)* | Assembles a day: closing state per rule, transitions, winner, card outcomes. |
| `controller/CompanionFlagTraceController.java` *(new)* | The single GET, implementing the generated `CompanionFlagsApi`. |
| `mapper/CompanionFlagMapper.java` *(new)* | Domain records → generated DTOs. |
| `repository/CompanionFlagTraceRepository.java` *(modify)* | Two read queries added. |
| `repository/CompanionFlagLogRepository.java` *(modify)* | One read query added. |

**Backend — `feature/proactive/`**

| File | Responsibility |
|---|---|
| `service/AdviceRankAdapter.java` *(new)* | Supplies `AdviceRankPort` from `AdvicePriority`. |
| `service/DailyCardAdapter.java` *(new)* | Supplies `DailyCardPort` from `CompanionMessageRepository`. |
| `service/AdviceFactRenderer.java` *(deleted)* | Moved — see above. |
| `service/InterventionService.java` *(modify)* | Import swap only. |
| `mapper/ProactiveMapper.java` *(modify)* | `flagKey` ← `content.adviceKey`. |

**Contract**

| File | Responsibility |
|---|---|
| `api/feature/companion/companion.yml` *(modify)* | New `CompanionFlags` tag, the trace path, five schemas. |
| `api/feature/proactive/proactive.yml` *(modify)* | `flagKey` on `FeedMessageResponse`. |
| `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` *(regenerated)* | Drift gate. |

**Frontend — `frontend/src/data/`**

| File | Responsibility |
|---|---|
| `insights/coachingTraceApi.ts` *(new)* | Wire → FE types. |
| `insights/coachingTraceMock.ts` *(new)* | The deterministic mock day: all five states + transitions. |
| `insights/coachingTraceHooks.ts` *(new)* | `useCoachingTrace(date)` over `useDualQuery`. |
| `types.ts` *(modify)* | `CoachingTraceDay` & friends; `flagKey` on `FeedMessage`. |
| `today/feedApi.ts` *(modify)* | Pass `flagKey` through. |

---

### Task 1: `FlagCatalog` — the label and domain the server sends

Spec §5: *"The server sends `label` and `domain`… if the frontend held a per-`flagKey` map of Hungarian labels and icons, every new rule would require a frontend change."* This is that map, on the server. It deliberately holds **no ranking** — ordering comes from `AdviceRankPort` (Task 2), so the severity order stays defined in exactly one place.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagCatalog.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagCatalogTest.java`

**Interfaces:**
- Consumes: `FlagKey` (existing constants).
- Produces: `FlagCatalog.KEYS` (`List<String>`, the 13), `FlagCatalog.labelOf(String)`, `FlagCatalog.domainOf(String)`, `FlagCatalog.DOMAIN_FALLBACK`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagCatalogTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The catalog is the ONE place a rule is named for the user (spec 2026-09-05 §5). A round-2 rule
 * that lands without an entry here would reach the observer as a bare key, so this test fails the
 * build instead — the {@code AdvicePriorityTest} precedent.
 */
class FlagCatalogTest {

    /** Every {@code FlagKey} constant except the two raise-SOURCE strings. */
    private static List<String> liveFlagKeys() throws IllegalAccessException {
        List<String> keys = new ArrayList<>();
        for (Field f : FlagKey.class.getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers()) && f.getType() == String.class
                && !f.getName().startsWith("SOURCE_")) {
                keys.add((String) f.get(null));
            }
        }
        return keys;
    }

    @Test
    void every_live_flag_key_has_a_label_and_a_domain() throws IllegalAccessException {
        List<String> keys = liveFlagKeys();
        assertThat(keys).hasSize(13);
        assertThat(FlagCatalog.KEYS).containsExactlyInAnyOrderElementsOf(keys);
        for (String key : keys) {
            assertThat(FlagCatalog.labelOf(key)).as(key).isNotBlank().isNotEqualTo(key);
            assertThat(FlagCatalog.domainOf(key)).as(key).isNotBlank();
        }
    }

    @Test
    void an_unknown_key_falls_back_instead_of_throwing() {
        assertThat(FlagCatalog.labelOf("round_two_rule")).isEqualTo("round_two_rule");
        assertThat(FlagCatalog.domainOf("round_two_rule")).isEqualTo(FlagCatalog.DOMAIN_FALLBACK);
        assertThat(FlagCatalog.labelOf(null)).isNull();
        assertThat(FlagCatalog.domainOf(null)).isEqualTo(FlagCatalog.DOMAIN_FALLBACK);
    }
}
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
cd backend && ./mvnw test -Dtest=FlagCatalogTest
```

Expected: FAIL — `FlagCatalog` does not exist (compilation error).

- [ ] **Step 3: Write the catalog**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagCatalog.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * How a rule is NAMED to the user (spec 2026-09-05 §5): the Hungarian label the observer shows and
 * the DOMAIN the surface turns into a colour wash and a clay icon. Server-side on purpose — a
 * per-key map in the frontend would mean every round-2 rule needs a frontend change; here the
 * engine returns a correctly-named rule the day it starts evaluating.
 *
 * <p>Deliberately holds NO ranking. The severity order is {@code AdvicePriority}'s, reached through
 * {@link AdviceRankPort} — duplicating it here is exactly the five-mirrors defect class round 1 hit
 * (bd memory: adding-a-flagkey-needs-five-mirrored-changes).
 *
 * <p>An unknown key falls back rather than throwing: an unmapped key must never break the observer,
 * the same argument {@code AdvicePriority.rankOf} makes for its own last-place default.
 * {@code FlagCatalogTest} asserts every live {@link FlagKey} is present, so the fallback is a last
 * resort rather than the normal way a new key behaves.
 */
public final class FlagCatalog {

    /** The domain of a key we do not know — the frontend's own fallback wash/icon. */
    public static final String DOMAIN_FALLBACK = "general";

    public static final String DOMAIN_SLEEP = "sleep";
    public static final String DOMAIN_TRAINING = "training";
    public static final String DOMAIN_NUTRITION = "nutrition";
    public static final String DOMAIN_RECOVERY = "recovery";
    public static final String DOMAIN_HABITS = "habits";
    public static final String DOMAIN_LOGGING = "logging";
    public static final String DOMAIN_BODY = "body";

    /** label + domain for one rule. */
    private record Entry(String label, String domain) {
    }

    private static final Map<String, Entry> ENTRIES = new LinkedHashMap<>();

    static {
        ENTRIES.put(FlagKey.ACUTE_BAD_DAY, new Entry("Rossz nap", DOMAIN_RECOVERY));
        ENTRIES.put(FlagKey.LOAD_FUEL_MISMATCH, new Entry("Terhelés–táplálás", DOMAIN_NUTRITION));
        ENTRIES.put(FlagKey.RAPID_WEIGHT_LOSS, new Entry("Gyors fogyás", DOMAIN_BODY));
        ENTRIES.put(FlagKey.JOINT_OVERUSE, new Entry("Vállterhelés", DOMAIN_TRAINING));
        ENTRIES.put(FlagKey.MISSED_WORKOUTS, new Entry("Kimaradt edzések", DOMAIN_TRAINING));
        ENTRIES.put(FlagKey.SLEEP_DEBT, new Entry("Alvásadósság", DOMAIN_SLEEP));
        ENTRIES.put(FlagKey.LOGGING_GAP, new Entry("Rögzítési hiány", DOMAIN_LOGGING));
        ENTRIES.put(FlagKey.IGNORED_NUDGE, new Entry("Elengedett emlékeztető", DOMAIN_SLEEP));
        ENTRIES.put(FlagKey.LATE_EATING, new Entry("Késői evés", DOMAIN_NUTRITION));
        ENTRIES.put(FlagKey.RECOVERY_NEEDED, new Entry("Regeneráció kell", DOMAIN_RECOVERY));
        ENTRIES.put(FlagKey.SUSTAINED_STRESS, new Entry("Tartós stressz", DOMAIN_RECOVERY));
        ENTRIES.put(FlagKey.MOMENTUM_AT_RISK, new Entry("Lendület veszélyben", DOMAIN_HABITS));
        ENTRIES.put(FlagKey.ALL_HEALTHY, new Entry("Minden rendben", DOMAIN_HABITS));
    }

    /** The rules the observer renders — enumeration only; the ORDER of the response is the rank's. */
    public static final List<String> KEYS = List.copyOf(ENTRIES.keySet());

    private FlagCatalog() {
    }

    /** The Hungarian label, or the key itself when unmapped (never null for a non-null key). */
    public static String labelOf(String flagKey) {
        Entry entry = ENTRIES.get(flagKey);
        return entry == null ? flagKey : entry.label();
    }

    public static String domainOf(String flagKey) {
        Entry entry = ENTRIES.get(flagKey);
        return entry == null ? DOMAIN_FALLBACK : entry.domain();
    }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

```bash
cd backend && ./mvnw test -Dtest=FlagCatalogTest
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagCatalog.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagCatalogTest.java && git commit -m "feat(companion): FlagCatalog — the server names every rule (mezo-6269.2)"
```

---

### Task 2: The two consumer-owned ports into `proactive`

The read side needs the severity rank and the day's delivered card. Both are proactive's. A direct import would close a `companion ↔ proactive` slice cycle (`AdvicePriority` already imports `FlagKey`, so proactive is already downstream of companion), which `ArchitectureTest.feature_slices_are_cycle_free` rejects as NEW rather than freezing. So: interface in `companion.flags.service`, adapter in `proactive.service` — the `NudgeSendPort` idiom, ADR 0012.

Both adapters are `@ConditionalOnProperty` on the proactive switch, and the read service (Task 6) is gated on **both** switches — so unlike `NudgeSendPort` there is no `ObjectProvider`/degrade dance: with proactive off, the observer endpoint simply does not exist, which is honest (there are no cards to explain).

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/AdviceRankPort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/DailyCardPort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceRankAdapter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/DailyCardAdapter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceObserverPortsIT.java`

**Interfaces:**
- Consumes: `AdvicePriority.rankOf`, `CompanionMessageRepository.findByCreatedByAndMessageDateAndKind`, `CompanionMessageEntity.KIND_ADVICE`.
- Produces: `AdviceRankPort.rankOf(String flagKey) → int` (lower is more severe); `DailyCardPort.forDay(UUID userId, LocalDate date) → Optional<DailyCardPort.DeliveredCard>` where `DeliveredCard(UUID cardId, String adviceKey)`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceObserverPortsIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.AdviceRankPort;
import io.mrkuhne.mezo.feature.companion.flags.service.DailyCardPort;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.IntegrationTestBase;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The two seams the observer reads proactive through (spec 2026-09-05 §5). They exist so
 * companion.flags never imports feature.proactive — see the ports' own javadoc.
 */
class AdviceObserverPortsIT extends IntegrationTestBase {

    @Autowired
    private AdviceRankPort rankPort;
    @Autowired
    private DailyCardPort cardPort;
    @Autowired
    private CompanionMessageRepository companionMessageRepository;

    @Test
    void rank_port_orders_by_the_editorial_severity_table() {
        assertThat(rankPort.rankOf(FlagKey.ACUTE_BAD_DAY))
            .isLessThan(rankPort.rankOf(FlagKey.LATE_EATING));
        assertThat(rankPort.rankOf(FlagKey.LATE_EATING))
            .isLessThan(rankPort.rankOf(FlagKey.ALL_HEALTHY));
    }

    @Test
    void card_port_returns_the_days_advice_card_with_its_key() {
        UUID userId = createUser();
        LocalDate day = LocalDate.of(2026, 9, 4);
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(day);
        row.setKind(CompanionMessageEntity.KIND_ADVICE);
        row.setContent(CompanionMessageEnvelope.advice("Alvás", "Aludj többet.",
            FlagKey.SLEEP_DEBT, null, null, List.of(), List.of()));
        row.setGeneratedAt(Instant.now());
        CompanionMessageEntity saved = companionMessageRepository.saveAndFlush(row);

        assertThat(cardPort.forDay(userId, day))
            .contains(new DailyCardPort.DeliveredCard(saved.getId(), FlagKey.SLEEP_DEBT));
    }

    @Test
    void card_port_is_empty_on_a_day_with_no_card() {
        assertThat(cardPort.forDay(createUser(), LocalDate.of(2026, 9, 4))).isEmpty();
    }
}
```

> Check `IntegrationTestBase`'s actual name and its user-creation helper before running — mirror whatever `FlagServiceTraceIT` extends and calls. Do not invent a helper.

- [ ] **Step 2: Run it to make sure it fails**

```bash
cd backend && ./mvnw test -Dtest=AdviceObserverPortsIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — `AdviceRankPort`/`DailyCardPort` do not exist.

- [ ] **Step 3: Write the ports and the adapters**

`companion/flags/service/AdviceRankPort.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * Companion-owned read seam (ADR 0012 consumer-owned-port idiom, the {@link NudgeSendPort}
 * precedent) for the editorial severity ranking that decides the day's card. The observer orders
 * its 13 rules by this and NEVER by a list of its own — spec 2026-09-05 §4.3: "the read side never
 * invents a ranking either".
 *
 * <p>The implementation is {@code proactive.service.AdviceRankAdapter} over {@code AdvicePriority}.
 * A direct import would close a {@code companion ↔ proactive} feature-slice cycle ({@code
 * AdvicePriority} already imports {@link FlagKey}), which {@code
 * ArchitectureTest.feature_slices_are_cycle_free} rejects.
 */
public interface AdviceRankPort {

    /** Lower is more severe. An unknown key ranks last rather than throwing. */
    int rankOf(String flagKey);
}
```

`companion/flags/service/DailyCardPort.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Companion-owned read seam (ADR 0012, the {@link NudgeSendPort} precedent) for the ONE coaching
 * card a day delivered. The observer needs it to answer "which rule won" — spec 2026-09-05 §4.3:
 * the card outcome is DERIVED at read time by comparing the day's card against the RAISED+LOGGED
 * trace rows, never stored, because the winner is decided after the trace row is already written
 * and the table is append-only.
 */
public interface DailyCardPort {

    /**
     * @param adviceKey the card's SEVERITY key — a {@link FlagKey} for a flag-sourced card, or a
     *                  setup-check key for a setup-sourced one, which matches none of the 13.
     */
    record DeliveredCard(UUID cardId, String adviceKey) {
    }

    /** The live {@code advice} card for that day, if one was delivered. */
    Optional<DeliveredCard> forDay(UUID userId, LocalDate date);
}
```

`proactive/service/AdviceRankAdapter.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.service.AdviceRankPort;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Supplies {@link AdviceRankPort} from {@link AdvicePriority} — the observer's only route to the
 *  severity table (spec 2026-09-05 §5). */
@Service
@ConditionalOnProperty(name = FeaturesConfiguration.PROACTIVE_SWITCH, havingValue = "true")
public class AdviceRankAdapter implements AdviceRankPort {

    @Override
    public int rankOf(String flagKey) {
        return AdvicePriority.rankOf(flagKey);
    }
}
```

`proactive/service/DailyCardAdapter.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.service.DailyCardPort;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Supplies {@link DailyCardPort} from the {@code companion_message} table. Reads the LIVE row
 *  only — the repository's {@code @SQLRestriction} already hides a superseded card, which is the
 *  right answer: a superseded card never won the day. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PROACTIVE_SWITCH, havingValue = "true")
public class DailyCardAdapter implements DailyCardPort {

    private final CompanionMessageRepository companionMessageRepository;

    @Override
    @Transactional(readOnly = true)
    public Optional<DeliveredCard> forDay(UUID userId, LocalDate date) {
        return companionMessageRepository
            .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_ADVICE)
            .map(row -> new DeliveredCard(row.getId(), row.getContent().adviceKey()));
    }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

```bash
cd backend && ./mvnw test -Dtest=AdviceObserverPortsIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Run ArchUnit — the whole point of the port**

```bash
cd backend && ./mvnw test -Dtest=ArchitectureTest
```

Expected: PASS, no new slice cycle.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/AdviceRankPort.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/DailyCardPort.java backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceRankAdapter.java backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/DailyCardAdapter.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceObserverPortsIT.java && git commit -m "feat(companion): rank + daily-card ports so the observer never imports proactive (mezo-6269.2)"
```

---

### Task 3: Move the fact renderer into `companion.flags`

Spec §5: *"`reasonText` is rendered server-side by the same deterministic renderer family as the card's fact lines — one place produces user-facing explanations of a payload."* The observer needs RAISED evidence, and `AdviceFactRenderer` already produces exactly that — but it lives in `proactive`, which companion cannot import. It renders companion's own `FlagPayloadEnvelope`, so it belongs in `companion.flags.service`; proactive keeps using it along the edge that already exists. Pure move + rename, no behaviour change.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagFactRenderer.java` (the moved body)
- Delete: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRenderer.java`
- Move: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRendererTest.java` → `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagFactRendererTest.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionService.java` (import + call site)

**Interfaces:**
- Produces: `FlagFactRenderer.render(String flagKey, FlagPayloadEnvelope payload) → List<String>` (unchanged semantics: empty list for an unmapped key or a null payload, never a placeholder); `FlagFactRenderer.num(double) → String` (newly public — the shared Hungarian-locale number formatter, reused by `FlagTraceCopy` in Task 4).

- [ ] **Step 1: Move the class with git so history follows**

```bash
git mv backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRenderer.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagFactRenderer.java
git mv backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRendererTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagFactRendererTest.java
```

- [ ] **Step 2: Rewrite the headers of both files**

In `FlagFactRenderer.java`: change `package` to `io.mrkuhne.mezo.feature.companion.flags.service;`, drop the now-same-package imports of `FlagPayloadEnvelope`/`FlagKey` (keep the `entity.FlagPayloadEnvelope` import — different package), rename the class to `FlagFactRenderer`, change `private static String num` to `public static String num`, and extend the javadoc's first paragraph:

```java
/**
 * The deterministic, numeric, rule-provided evidence lines for a RAISED flag, rendered from the
 * raise's own frozen {@code companion_flag_log.payload}. Nothing here re-derives a rule — the
 * payload already froze both the thresholds and the observed values at raise time, which is the
 * whole point of {@code FlagPayloadEnvelope}.
 *
 * <p>TWO consumers (spec 2026-09-05 §5): the advice card's {@code facts} ({@code
 * InterventionService}) and the coaching observer's RAISED evidence ({@code FlagTraceReadService}).
 * It lives here rather than in {@code proactive} because it renders companion's own payload
 * envelope AND because companion may not import proactive — see {@code AdviceRankPort}'s javadoc
 * for the cycle that forbids it. {@link FlagTraceCopy} renders the other two outcomes, CLEAR and
 * UNAVAILABLE, in the same family and the same locale.
 *
 * <p>An unmapped key or a null payload yields an EMPTY list, never a placeholder … [rest unchanged]
 */
```

In `FlagFactRendererTest.java`: change the package to `io.mrkuhne.mezo.feature.companion.flags.service`, rename the class to `FlagFactRendererTest`, and replace every `AdviceFactRenderer.` with `FlagFactRenderer.`.

- [ ] **Step 3: Fix the one production caller**

In `InterventionService.java`, replace the import `io.mrkuhne.mezo.feature.proactive.service.AdviceFactRenderer` (or the bare same-package reference — check with `grep -n AdviceFactRenderer`) with `io.mrkuhne.mezo.feature.companion.flags.service.FlagFactRenderer`, and every `AdviceFactRenderer.render(` with `FlagFactRenderer.render(`.

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/padding-2px-all-pages-3479e4 && grep -rn "AdviceFactRenderer" backend/src
```

Expected after the edits: no hits.

- [ ] **Step 4: Run the moved test and the caller's tests**

```bash
cd backend && ./mvnw test -Dtest='FlagFactRendererTest,InterventionServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Expected: PASS. (Confirm `InterventionServiceIT` is the real class name with `ls backend/src/test/java/io/mrkuhne/mezo/feature/proactive/` first; run whichever ITs name `InterventionService`.)

- [ ] **Step 5: Commit**

```bash
git add -A backend/src && git commit -m "refactor(companion): move AdviceFactRenderer to flags as FlagFactRenderer — one renderer, two consumers (mezo-6269.2)"
```

---

### Task 4: `FlagTraceCopy` — the CLEAR and UNAVAILABLE explanations

The `CLEAR` branch is the point of the whole feature (spec §4.1), and it has to read as a sentence, not a metric dump — the recommender-transparency failure mode the spec's prior art names in both directions (too generic to trust / raw signal dump). Every `metric` string below was read off the actual `FlagVerdict.ClearEvidence(...)` call sites in `service/rule/`; every reason code is an `UnavailableReason` member.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceCopy.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceCopyTest.java`

**Interfaces:**
- Consumes: `FlagVerdict.ClearEvidence`, `UnavailableReason`, `FlagFactRenderer.num`.
- Produces: `FlagTraceCopy.NOT_EVALUATED_YET` (`String` constant, `"not_evaluated_yet"`); `FlagTraceCopy.clearText(FlagVerdict.ClearEvidence) → String`; `FlagTraceCopy.clearFacts(FlagVerdict.ClearEvidence) → List<String>`; `FlagTraceCopy.unavailableText(String reasonCode) → String`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceCopyTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict.ClearEvidence;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class FlagTraceCopyTest {

    /** Every metric a rule can hand back — read off the ClearEvidence call sites in service/rule/. */
    private static final List<String> METRICS = List.of(
        "deficit_hours", "stress_days_over", "bad_checkins", "load_avg_min", "fuel_arms_fired",
        "weight_trend_pct_wk", "trajectory", "shoulder_strain_avg", "tomorrow_muscle",
        "nudge_run_nights", "late_meal_days", "stale_domains", "longest_missed_run",
        "habits_recent_avg", "missed_gym_days", "signals_matched", "quiet_days",
        "other_flags_raised");

    @Test
    void every_clear_metric_renders_a_hungarian_sentence_not_the_raw_key() {
        for (String metric : METRICS) {
            String text = FlagTraceCopy.clearText(new ClearEvidence(metric, 1.0, 2.0, "x"));
            assertThat(text).as(metric).isNotBlank().doesNotContain(metric);
        }
    }

    @Test
    void a_numeric_clear_names_the_observed_value_and_the_threshold() {
        String text = FlagTraceCopy.clearText(new ClearEvidence("deficit_hours", 0.4, 1.0, null));
        assertThat(text).contains("0,4").contains("1,0");
    }

    @Test
    void a_non_numeric_clear_carries_its_detail_and_no_fabricated_number() {
        String text = FlagTraceCopy.clearText(new ClearEvidence("trajectory", null, null, "cut"));
        assertThat(text).contains("cut");
        assertThat(FlagTraceCopy.clearFacts(new ClearEvidence("trajectory", null, null, "cut")))
            .hasSize(1);
    }

    @Test
    void a_numeric_clear_adds_a_measured_versus_threshold_evidence_row() {
        assertThat(FlagTraceCopy.clearFacts(new ClearEvidence("deficit_hours", 0.4, 1.0, null)))
            .hasSize(2)
            .last().asString().contains("0,4").contains("1,0");
    }

    @Test
    void an_unknown_metric_falls_back_instead_of_throwing() {
        assertThat(FlagTraceCopy.clearText(new ClearEvidence("round_two_metric", 1.0, 2.0, null)))
            .isNotBlank();
        assertThat(FlagTraceCopy.clearText(null)).isNotBlank();
    }

    @ParameterizedTest
    @EnumSource(UnavailableReason.class)
    void every_unavailable_reason_has_its_own_sentence(UnavailableReason reason) {
        String code = reason.name().toLowerCase();
        assertThat(FlagTraceCopy.unavailableText(code)).as(code).isNotBlank().doesNotContain(code);
    }

    @Test
    void the_read_side_not_evaluated_yet_state_has_a_sentence_too() {
        assertThat(FlagTraceCopy.unavailableText(FlagTraceCopy.NOT_EVALUATED_YET))
            .isNotBlank().doesNotContain("_");
        assertThat(FlagTraceCopy.unavailableText("something_new")).isNotBlank();
    }
}
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
cd backend && ./mvnw test -Dtest=FlagTraceCopyTest
```

Expected: FAIL — `FlagTraceCopy` does not exist.

- [ ] **Step 3: Write the copy renderer**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceCopy.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict.ClearEvidence;
import java.util.ArrayList;
import java.util.List;

/**
 * The other two thirds of the renderer family {@link FlagFactRenderer} starts (spec 2026-09-05 §5):
 * plain-Hungarian explanations of a CLEAR verdict ("I checked and it is fine") and an UNAVAILABLE
 * one ("I could not check"). Same deterministic, no-estimate contract, same Hungarian locale.
 *
 * <p>Every {@code metric} below is read off an actual {@code FlagVerdict.clear(...)} call site in
 * {@code service/rule/}; every reason code is an {@link UnavailableReason} member.
 * {@code FlagTraceCopyTest} pins both sets, so a round-2 rule that invents a new metric or gate
 * fails the build here rather than shipping a raw key onto the observer.
 *
 * <p>Both lookups FALL BACK rather than throw — an unmapped key must never break the read surface
 * (the {@link FlagCatalog} argument).
 */
public final class FlagTraceCopy {

    /** Read-side only: the rule has no trace row yet, so the engine has never judged it. NOT an
     *  {@link UnavailableReason} — no rule ever produces it; {@code FlagTraceReadService} does. */
    public static final String NOT_EVALUATED_YET = "not_evaluated_yet";

    private FlagTraceCopy() {
    }

    /** One sentence saying why the rule is quiet, in the rule's own numbers. */
    public static String clearText(ClearEvidence evidence) {
        if (evidence == null) {
            return "A szabály lefutott, és nem talált problémát.";
        }
        String metric = evidence.metric();
        Double observed = evidence.observed();
        Double threshold = evidence.threshold();
        String detail = evidence.detail();
        return switch (metric == null ? "" : metric) {
            case "deficit_hours" -> "Alvásadósság %s óra/éjszaka — a %s órás küszöb alatt."
                .formatted(num(observed), num(threshold));
            case "stress_days_over" -> "%s nap a stresszküszöb fölött — a jelzéshez %s kellene."
                .formatted(num(observed), num(threshold));
            case "bad_checkins" -> "%s rossz check-in ma — a jelzéshez %s kellene."
                .formatted(num(observed), num(threshold));
            case "load_avg_min" -> "A 7 napos terhelés %s perc — a %s perces küszöb alatt."
                .formatted(num(observed), num(threshold));
            case "fuel_arms_fired" -> "A terhelés magas, de sem a kalória-, sem az alvásoldal nem "
                + "esett a küszöb alá.";
            case "weight_trend_pct_wk" -> "A súlytrend %s%%/hét — a %s%%/hét küszöbnél lassabb fogyás."
                .formatted(num(observed), num(threshold));
            case "trajectory" -> "A célod tudatos fogyás (%s), így a gyors fogyás nem probléma."
                .formatted(detail);
            case "shoulder_strain_avg" -> "A vállterhelés átlaga %s — a %s küszöb alatt."
                .formatted(num(observed), num(threshold));
            case "tomorrow_muscle" -> "A holnapi edzés nem vállfókuszú (%s).".formatted(detail);
            case "nudge_run_nights" -> "%s este futott a sorozat — a jelzéshez %s egymást követő "
                .formatted(num(observed), num(threshold))
                + "este kellene (%s).".formatted(detail);
            case "late_meal_days" -> "%s késői vacsora az utolsó napokban — a jelzéshez %s kellene."
                .formatted(num(observed), num(threshold));
            case "stale_domains" -> "%s elavult napló — a jelzéshez %s kellene (%s)."
                .formatted(num(observed), num(threshold), detail == null || detail.isBlank() ? "—" : detail);
            case "longest_missed_run" -> "A leghosszabb kihagyott sorozat %s nap — a jelzéshez %s kellene."
                .formatted(num(observed), num(threshold));
            case "habits_recent_avg" -> "Napi %s teljesített szokás — a %s-es visszaesési küszöb fölött."
                .formatted(num(observed), num(threshold));
            case "missed_gym_days" -> "Nincs kihagyott edzésnap az ablakban.";
            case "signals_matched" -> "%s regenerációs jel a szükséges %s-ból (hiányzik: %s)."
                .formatted(num(observed), num(threshold), detail == null || detail.isBlank() ? "—" : detail);
            case "quiet_days" -> "Még nem telt el %s csendes nap.".formatted(num(threshold));
            case "other_flags_raised" -> "Ma más szabály jelzett, így a „minden rendben\" nem áll fenn.";
            default -> "A szabály lefutott, és nem talált problémát.";
        };
    }

    /** The expandable evidence rows for a CLEAR verdict: the sentence, plus the raw
     *  measured-vs-threshold pair when there is one. Never fabricates a number. */
    public static List<String> clearFacts(ClearEvidence evidence) {
        List<String> facts = new ArrayList<>();
        facts.add(clearText(evidence));
        if (evidence != null && evidence.observed() != null && evidence.threshold() != null) {
            facts.add("Mért érték: %s · küszöb: %s"
                .formatted(num(evidence.observed()), num(evidence.threshold())));
        }
        return List.copyOf(facts);
    }

    /** One sentence saying why the rule could not judge. {@code reasonCode} is lower-cased, as
     *  {@code companion_flag_trace.reason_code} stores it. */
    public static String unavailableText(String reasonCode) {
        return switch (reasonCode == null ? "" : reasonCode) {
            case "not_enough_logged_nights" -> "Túl kevés rögzített éjszaka — nincs mit mérni.";
            case "not_enough_logged_days" -> "Túl kevés rögzített nap a kalória- és az alvásoldalon.";
            case "not_enough_checkins" -> "Ma túl kevés check-in — egy rossz válasz még nem egy nap.";
            case "no_checkin_data" -> "Nincs stressz-check-in az ablakban.";
            case "no_data_in_window" -> "Nincs megfigyelés az ablakban.";
            case "no_habit_baseline" -> "Nincs szokás-alapvonal — nincs honnan visszaesni.";
            case "no_gym_schedule" -> "Nincs edzésterv, amihez mérni lehetne.";
            case "schedule_younger_than_window" -> "Az edzésterv fiatalabb az ablaknál.";
            case "no_weight_trend" -> "Nincs súlytrend mára.";
            case "no_active_goal" -> "Nincs aktív cél — a trajektória nem olvasható.";
            case "no_strain_data" -> "Nincs vállterhelés-adat az ablakban.";
            case "no_planned_session" -> "Nincs holnapra tervezett edzés.";
            case "no_sleep_goal_row" -> "Nincs alváscél rögzítve — a lefekvési horgony ismeretlen.";
            case "notifications_off" -> "Az értesítések ki vannak kapcsolva — nem tudni, ment-e emlékeztető.";
            case "unlogged_night" -> "Rögzítetlen éjszaka a sorozatban.";
            case "no_meal_data" -> "Nincs étkezés-adat az ablakban.";
            case NOT_EVALUATED_YET -> "Ez a szabály még nem futott le ezen a napon.";
            default -> "A szabály nem tudta megítélni ezt a napot.";
        };
    }

    /** Hungarian decimal comma, one fraction digit — the same formatter the card's facts use. */
    private static String num(Double value) {
        return value == null ? "—" : FlagFactRenderer.num(value);
    }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

```bash
cd backend && ./mvnw test -Dtest=FlagTraceCopyTest
```

Expected: PASS. If `every_unavailable_reason_has_its_own_sentence` fails for a member, that member is genuinely missing from the switch — add it, do not weaken the test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceCopy.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceCopyTest.java && git commit -m "feat(companion): FlagTraceCopy — the CLEAR and UNAVAILABLE explanations (mezo-6269.2)"
```

---

### Task 5: The three read queries

Spec §4.3: *"a day's closing state = per rule, the last row with `occurred_at` ≤ end of that day (which may predate the day — correct, that is what 'unchanged since' means); a day's transitions = rows whose `occurred_at` falls inside that day."* The transitions query already exists (`findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc`). Three are missing: the per-rule closing state, the day-pager's floor, and the RAISED payload.

The closing-state read is one derived query called once per rule (13 indexed single-row lookups on `idx_companion_flag_trace_owner_flag_time`), not a window function — the same shape the writer already uses, and readable.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/repository/CompanionFlagTraceRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/repository/CompanionFlagLogRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagTraceReadQueriesIT.java`

**Interfaces:**
- Produces:
  - `CompanionFlagTraceRepository.findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(UUID, String, Instant) → Optional<CompanionFlagTraceEntity>`
  - `CompanionFlagTraceRepository.earliestOccurredAt(UUID) → Instant` (nullable)
  - `CompanionFlagLogRepository.findFirstByCreatedByAndFlagKeyAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(UUID, String, Instant) → Optional<CompanionFlagLogEntity>`

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagTraceReadQueriesIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.IntegrationTestBase;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The observer's two trace reads (spec 2026-09-05 §4.3). */
class CompanionFlagTraceReadQueriesIT extends IntegrationTestBase {

    @Autowired
    private CompanionFlagTraceRepository repository;

    private void row(UUID userId, String flagKey, String outcome, Instant at) {
        CompanionFlagTraceEntity e = new CompanionFlagTraceEntity();
        e.setCreatedBy(userId);
        e.setFlagKey(flagKey);
        e.setOutcome(outcome);
        e.setOccurredAt(at);
        repository.saveAndFlush(e);
    }

    @Test
    void closing_state_is_the_last_row_at_or_before_the_cutoff_even_if_it_predates_the_day() {
        UUID userId = createUser();
        Instant twoDaysAgo = Instant.parse("2026-09-01T09:00:00Z");
        Instant afterCutoff = Instant.parse("2026-09-05T09:00:00Z");
        Instant cutoff = Instant.parse("2026-09-03T21:59:59Z");
        row(userId, FlagKey.SLEEP_DEBT, "raised", twoDaysAgo);
        row(userId, FlagKey.SLEEP_DEBT, "clear", afterCutoff);

        assertThat(repository
            .findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
                userId, FlagKey.SLEEP_DEBT, cutoff))
            .get().extracting(CompanionFlagTraceEntity::getOutcome).isEqualTo("raised");
    }

    @Test
    void a_rule_with_no_row_before_the_cutoff_reads_back_empty() {
        UUID userId = createUser();
        row(userId, FlagKey.SLEEP_DEBT, "raised", Instant.parse("2026-09-05T09:00:00Z"));
        assertThat(repository
            .findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
                userId, FlagKey.SLEEP_DEBT, Instant.parse("2026-09-03T21:59:59Z")))
            .isEmpty();
    }

    @Test
    void earliest_occurred_at_is_the_day_pagers_floor_and_null_for_a_user_with_no_trace() {
        UUID userId = createUser();
        assertThat(repository.earliestOccurredAt(userId)).isNull();
        row(userId, FlagKey.SLEEP_DEBT, "clear", Instant.parse("2026-09-02T09:00:00Z"));
        row(userId, FlagKey.LATE_EATING, "clear", Instant.parse("2026-09-01T09:00:00Z"));
        assertThat(repository.earliestOccurredAt(userId))
            .isEqualTo(Instant.parse("2026-09-01T09:00:00Z"));
    }
}
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
cd backend && ./mvnw test -Dtest=CompanionFlagTraceReadQueriesIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — the two methods do not exist.

- [ ] **Step 3: Add the queries**

Append to `CompanionFlagTraceRepository`:

```java
    /**
     * A day's CLOSING state for one rule (spec 2026-09-05 §4.3): the last row at or before the end
     * of that day. The row may PREDATE the day — that is what "unchanged since" means, and is why
     * this is a cutoff read rather than a between-read.
     */
    Optional<CompanionFlagTraceEntity> findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
        UUID createdBy, String flagKey, Instant cutoff);

    /** The oldest traced moment for this user — the day pager's floor. Null when nothing is traced. */
    @Query("SELECT min(t.occurredAt) FROM CompanionFlagTraceEntity t WHERE t.createdBy = :createdBy")
    Instant earliestOccurredAt(@Param("createdBy") UUID createdBy);
```

…with the `org.springframework.data.jpa.repository.Query` and `org.springframework.data.repository.query.Param` imports added.

Append to `CompanionFlagLogRepository`:

```java
    /**
     * The observer's RAISED evidence (spec 2026-09-05 §5): the newest raise of this flag at or
     * before the end of the day being read, so a past day shows what was frozen THEN rather than
     * today's numbers. A raise that was SUPPRESSED_BY_COOLDOWN never got a log row of its own, so
     * this legitimately returns the raise the engine last actually logged — the trace row still
     * says the suppression happened.
     */
    Optional<CompanionFlagLogEntity> findFirstByCreatedByAndFlagKeyAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
        UUID createdBy, String flagKey, Instant cutoff);
```

- [ ] **Step 4: Run the test and make sure it passes**

```bash
cd backend && ./mvnw test -Dtest=CompanionFlagTraceReadQueriesIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/repository backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagTraceReadQueriesIT.java && git commit -m "feat(companion): closing-state, pager-floor and raise-payload reads (mezo-6269.2)"
```

---

### Task 6: `FlagTraceReadService` — assemble the day

The whole read side in one place. Nothing is recomputed: the outcome comes from the trace, the ranking from the port, the RAISED evidence from the frozen log payload, the winner from the card port.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceReadService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagTraceReadServiceIT.java`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces:

```java
public record TraceDay(LocalDate date, LocalDate earliestDate, Winner winner,
                       List<RuleState> rules, List<Transition> transitions) { }
public record Winner(String flagKey, int rank, UUID cardId) { }
public record RuleState(String flagKey, String label, String domain, int rank,
                        String outcome, String reasonCode, String reasonText,
                        List<String> facts, String disposition, String cardOutcome,
                        Instant changedAt) { }
public record Transition(Instant at, String flagKey, String label,
                         String from, String to, String reasonText) { }
```

All nested in `FlagTraceReadService`. Wire vocabulary (all lower-case, matching what the DB stores):
- `outcome` ∈ `raised` | `clear` | `unavailable`
- `disposition` ∈ `logged` | `suppressed_by_cooldown` | `null`
- `cardOutcome` ∈ `won` | `lost` | `null`
- `from`/`to` are **states**: `raised` | `clear` | `unavailable` | `suppressed` — where `suppressed` replaces `raised` whenever the row's disposition is `suppressed_by_cooldown`. `from` is `null` on a rule's very first row. These are the four the surface maps to `Jelzett` / `Rendben` / `Nem mérhető` / `Pihenőn`; `Nyertes` is `cardOutcome = won`, which is orthogonal.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagTraceReadServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagCatalog;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceCopy;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceReadService;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.IntegrationTestBase;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The observer's read side (spec 2026-09-05 §5, §7). Content, not coverage: the closing state and
 * the timeline come from the SAME rows, a suppressed rule stays visible rather than vanishing, and
 * a rule the frontend has never seen still renders.
 */
class FlagTraceReadServiceIT extends IntegrationTestBase {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 3);

    @Autowired
    private FlagTraceReadService service;
    @Autowired
    private CompanionFlagTraceRepository traceRepository;
    @Autowired
    private CompanionFlagLogRepository logRepository;
    @Autowired
    private CompanionMessageRepository companionMessageRepository;

    private static Instant at(int hour) {
        return DAY.atTime(hour, 0).atZone(ZoneId.systemDefault()).toInstant();
    }

    private void trace(UUID userId, String flagKey, String outcome, String reasonCode,
                       String disposition, FlagVerdict.ClearEvidence evidence, Instant when) {
        CompanionFlagTraceEntity e = new CompanionFlagTraceEntity();
        e.setCreatedBy(userId);
        e.setFlagKey(flagKey);
        e.setOutcome(outcome);
        e.setReasonCode(reasonCode);
        e.setDisposition(disposition);
        e.setEvidence(evidence);
        e.setOccurredAt(when);
        traceRepository.saveAndFlush(e);
    }

    private UUID card(UUID userId, String adviceKey) {
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(DAY);
        row.setKind(CompanionMessageEntity.KIND_ADVICE);
        row.setContent(CompanionMessageEnvelope.advice("Alvás", "Aludj többet.", adviceKey,
            null, null, List.of(), List.of()));
        row.setGeneratedAt(Instant.now());
        return companionMessageRepository.saveAndFlush(row).getId();
    }

    @Test
    void a_day_reports_all_thirteen_rules_in_severity_order() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "clear", null, null,
            new FlagVerdict.ClearEvidence("deficit_hours", 0.4, 1.0, null), at(9));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);

        assertThat(day.rules()).hasSize(13);
        assertThat(day.rules()).extracting(FlagTraceReadService.RuleState::rank)
            .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, 13).boxed().toList());
        assertThat(day.rules().get(0).flagKey()).isEqualTo(FlagKey.ACUTE_BAD_DAY);
        assertThat(day.rules().get(12).flagKey()).isEqualTo(FlagKey.ALL_HEALTHY);
        assertThat(day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.LATE_EATING)).findFirst().orElseThrow().rank())
            .isEqualTo(9);
    }

    @Test
    void an_untraced_rule_is_honestly_not_evaluated_rather_than_a_fabricated_clear() {
        UUID userId = createUser();
        FlagTraceReadService.RuleState state = service.read(userId, DAY).rules().get(0);
        assertThat(state.outcome()).isEqualTo("unavailable");
        assertThat(state.reasonCode()).isEqualTo(FlagTraceCopy.NOT_EVALUATED_YET);
        assertThat(state.changedAt()).isNull();
        assertThat(state.facts()).isEmpty();
    }

    @Test
    void a_clear_rule_carries_the_observed_value_and_the_threshold() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "clear", null, null,
            new FlagVerdict.ClearEvidence("deficit_hours", 0.4, 1.0, null), at(9));

        FlagTraceReadService.RuleState state = service.read(userId, DAY).rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow();
        assertThat(state.outcome()).isEqualTo("clear");
        assertThat(state.reasonText()).contains("0,4").contains("1,0");
        assertThat(state.facts()).hasSize(2);
        assertThat(state.label()).isEqualTo(FlagCatalog.labelOf(FlagKey.SLEEP_DEBT));
        assertThat(state.domain()).isEqualTo(FlagCatalog.domainOf(FlagKey.SLEEP_DEBT));
    }

    @Test
    void a_raised_rule_renders_the_frozen_payload_and_the_winner_is_correlated() {
        UUID userId = createUser();
        CompanionFlagLogEntity log = new CompanionFlagLogEntity();
        log.setCreatedBy(userId);
        log.setFlagKey(FlagKey.SLEEP_DEBT);
        log.setSource(FlagKey.SOURCE_SWEEP);
        log.setPayload(FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
            8.0, 7, 6, 1.0, 1.4, Map.of())));
        logRepository.saveAndFlush(log);
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(9));
        trace(userId, FlagKey.LATE_EATING, "raised", null, "logged", null, at(10));
        UUID cardId = card(userId, FlagKey.SLEEP_DEBT);

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);

        assertThat(day.winner()).isNotNull();
        assertThat(day.winner().flagKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(day.winner().cardId()).isEqualTo(cardId);
        assertThat(day.winner().rank()).isEqualTo(6);
        Map<String, FlagTraceReadService.RuleState> byKey = day.rules().stream()
            .collect(java.util.stream.Collectors.toMap(
                FlagTraceReadService.RuleState::flagKey, r -> r));
        assertThat(byKey.get(FlagKey.SLEEP_DEBT).cardOutcome()).isEqualTo("won");
        assertThat(byKey.get(FlagKey.SLEEP_DEBT).facts()).isNotEmpty();
        assertThat(byKey.get(FlagKey.SLEEP_DEBT).reasonText()).contains("1,4");
        assertThat(byKey.get(FlagKey.LATE_EATING).cardOutcome()).isEqualTo("lost");
    }

    @Test
    void cooldown_suppression_is_visible_rather_than_vanishing() {
        UUID userId = createUser();
        trace(userId, FlagKey.LATE_EATING, "raised", null, "suppressed_by_cooldown", null, at(11));

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        FlagTraceReadService.RuleState state = day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.LATE_EATING)).findFirst().orElseThrow();
        assertThat(state.outcome()).isEqualTo("raised");
        assertThat(state.disposition()).isEqualTo("suppressed_by_cooldown");
        assertThat(state.cardOutcome()).isNull();
        assertThat(day.transitions()).singleElement()
            .extracting(FlagTraceReadService.Transition::to).isEqualTo("suppressed");
    }

    @Test
    void closing_state_and_timeline_come_from_the_same_rows_and_a_past_day_reads_back_unchanged() {
        UUID userId = createUser();
        trace(userId, FlagKey.LOAD_FUEL_MISMATCH, "clear", null, null,
            new FlagVerdict.ClearEvidence("load_avg_min", 200.0, 400.0, null), at(8));
        trace(userId, FlagKey.LOAD_FUEL_MISMATCH, "raised", null, "logged", null, at(14));
        // the NEXT day changes again — must not leak into DAY's read
        trace(userId, FlagKey.LOAD_FUEL_MISMATCH, "clear", null, null,
            new FlagVerdict.ClearEvidence("load_avg_min", 100.0, 400.0, null),
            DAY.plusDays(1).atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant());

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);

        assertThat(day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.LOAD_FUEL_MISMATCH)).findFirst().orElseThrow()
            .outcome()).isEqualTo("raised");
        assertThat(day.transitions()).hasSize(2);
        assertThat(day.transitions().get(0).from()).isNull();
        assertThat(day.transitions().get(0).to()).isEqualTo("clear");
        assertThat(day.transitions().get(1).from()).isEqualTo("clear");
        assertThat(day.transitions().get(1).to()).isEqualTo("raised");
        assertThat(day.transitions().get(1).label())
            .isEqualTo(FlagCatalog.labelOf(FlagKey.LOAD_FUEL_MISMATCH));
        assertThat(day.earliestDate()).isEqualTo(DAY);
    }

    @Test
    void a_day_with_no_change_has_no_timeline_but_still_has_a_closing_state() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null,
            DAY.minusDays(2).atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant());

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        assertThat(day.transitions()).isEmpty();
        assertThat(day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow()
            .outcome()).isEqualTo("raised");
    }

    @Test
    void a_setup_sourced_card_leaves_the_thirteen_rules_without_a_winner() {
        UUID userId = createUser();
        trace(userId, FlagKey.SLEEP_DEBT, "raised", null, "logged", null, at(9));
        card(userId, "missing_sleep_goal");

        FlagTraceReadService.TraceDay day = service.read(userId, DAY);
        assertThat(day.winner()).isNull();
        assertThat(day.rules().stream()
            .filter(r -> r.flagKey().equals(FlagKey.SLEEP_DEBT)).findFirst().orElseThrow()
            .cardOutcome()).isNull();
    }
}
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
cd backend && ./mvnw test -Dtest=FlagTraceReadServiceIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — `FlagTraceReadService` does not exist.

- [ ] **Step 3: Write the service**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceReadService.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One day of the coaching engine's decision, rendered from what the engine already concluded
 * (spec 2026-09-05 §5). It RECOMPUTES NOTHING: the verdict comes from {@code companion_flag_trace},
 * the RAISED evidence from the raise's own frozen {@code companion_flag_log.payload}, the ordering
 * from {@link AdviceRankPort} and the winner from {@link DailyCardPort} — both sides read back.
 *
 * <p>Gated on BOTH switches because it depends on the two proactive-supplied ports: with proactive
 * off there is no card to explain, so the endpoint honestly does not exist rather than degrading to
 * a half-answer.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
    havingValue = "true")
public class FlagTraceReadService {

    /** Screen states, before the surface's Hungarian vocabulary is applied. */
    private static final String STATE_SUPPRESSED = "suppressed";
    private static final String OUTCOME_RAISED = "raised";
    private static final String OUTCOME_UNAVAILABLE = "unavailable";
    private static final String DISPOSITION_LOGGED = "logged";
    private static final String DISPOSITION_SUPPRESSED = "suppressed_by_cooldown";
    private static final String CARD_WON = "won";
    private static final String CARD_LOST = "lost";

    private final CompanionFlagTraceRepository traceRepository;
    private final CompanionFlagLogRepository logRepository;
    private final AdviceRankPort rankPort;
    private final DailyCardPort cardPort;

    /** The day, all 13 rules in severity order, plus the day's transitions. */
    public record TraceDay(LocalDate date, LocalDate earliestDate, Winner winner,
                           List<RuleState> rules, List<Transition> transitions) {
    }

    /** The rule whose raise became the day's card. Null when no card, or when the card came from a
     *  setup check rather than a flag — that key is none of the 13. */
    public record Winner(String flagKey, int rank, UUID cardId) {
    }

    /** One rule's CLOSING state for the day. {@code changedAt} is when it last changed, which may
     *  predate the day; null when the rule has never been evaluated. */
    public record RuleState(String flagKey, String label, String domain, int rank,
                            String outcome, String reasonCode, String reasonText,
                            List<String> facts, String disposition, String cardOutcome,
                            Instant changedAt) {
    }

    /** One change inside the day. {@code from} is null on a rule's very first row. */
    public record Transition(Instant at, String flagKey, String label,
                             String from, String to, String reasonText) {
    }

    @Transactional(readOnly = true)
    public TraceDay read(UUID userId, LocalDate date) {
        ZoneId zone = ZoneId.systemDefault();
        Instant dayStart = date.atStartOfDay(zone).toInstant();
        Instant dayEndExclusive = date.plusDays(1).atStartOfDay(zone).toInstant();
        Instant cutoff = dayEndExclusive.minusMillis(1);

        Optional<DailyCardPort.DeliveredCard> card = cardPort.forDay(userId, date);
        String winnerKey = card.map(DailyCardPort.DeliveredCard::adviceKey)
            .filter(FlagCatalog.KEYS::contains)
            .orElse(null);

        List<String> ordered = new ArrayList<>(FlagCatalog.KEYS);
        ordered.sort(Comparator.comparingInt(rankPort::rankOf));

        List<RuleState> rules = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            rules.add(stateOf(userId, ordered.get(i), i + 1, cutoff, winnerKey));
        }

        Winner winner = winnerKey == null ? null : new Winner(winnerKey,
            rules.stream().filter(r -> r.flagKey().equals(winnerKey))
                .findFirst().orElseThrow().rank(),
            card.orElseThrow().cardId());

        Instant earliest = traceRepository.earliestOccurredAt(userId);
        LocalDate earliestDate = earliest == null ? null : LocalDate.ofInstant(earliest, zone);

        return new TraceDay(date, earliestDate, winner, List.copyOf(rules),
            transitions(userId, dayStart, cutoff));
    }

    private RuleState stateOf(UUID userId, String flagKey, int rank, Instant cutoff,
                              String winnerKey) {
        String label = FlagCatalog.labelOf(flagKey);
        String domain = FlagCatalog.domainOf(flagKey);
        CompanionFlagTraceEntity row = traceRepository
            .findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
                userId, flagKey, cutoff)
            .orElse(null);

        if (row == null) {
            // Honest: the engine has never judged this rule. NOT a fabricated "fine".
            return new RuleState(flagKey, label, domain, rank, OUTCOME_UNAVAILABLE,
                FlagTraceCopy.NOT_EVALUATED_YET,
                FlagTraceCopy.unavailableText(FlagTraceCopy.NOT_EVALUATED_YET),
                List.of(), null, null, null);
        }

        List<String> facts;
        String reasonText;
        if (OUTCOME_RAISED.equals(row.getOutcome())) {
            facts = logRepository
                .findFirstByCreatedByAndFlagKeyAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                    userId, flagKey, cutoff)
                .map(log -> FlagFactRenderer.render(flagKey, log.getPayload()))
                .orElse(List.of());
            reasonText = facts.isEmpty() ? label : facts.get(0);
        } else if (OUTCOME_UNAVAILABLE.equals(row.getOutcome())) {
            reasonText = FlagTraceCopy.unavailableText(row.getReasonCode());
            facts = List.of();
        } else {
            facts = FlagTraceCopy.clearFacts(row.getEvidence());
            reasonText = FlagTraceCopy.clearText(row.getEvidence());
        }

        String cardOutcome = null;
        if (OUTCOME_RAISED.equals(row.getOutcome())
            && DISPOSITION_LOGGED.equals(row.getDisposition())
            && winnerKey != null) {
            cardOutcome = flagKey.equals(winnerKey) ? CARD_WON : CARD_LOST;
        }

        return new RuleState(flagKey, label, domain, rank, row.getOutcome(), row.getReasonCode(),
            reasonText, facts, row.getDisposition(), cardOutcome, row.getOccurredAt());
    }

    private List<Transition> transitions(UUID userId, Instant from, Instant to) {
        List<CompanionFlagTraceEntity> rows =
            traceRepository.findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc(userId, from, to);
        Map<String, String> previous = new HashMap<>();
        for (CompanionFlagTraceEntity row : rows) {
            // The row BEFORE the day's first change for this rule — so a day's first transition
            // reads "from yesterday's state", not "from nothing". A plain containsKey/put (rather
            // than computeIfAbsent) is deliberate: computeIfAbsent does NOT record a mapping when
            // the function returns null, so a rule whose very first-ever row falls on THIS day
            // would be re-queried on its second row of the day too — and that second lookup's
            // cutoff (just before the SECOND row) would find the first row and wrongly report it
            // as the antecedent of itself.
            if (!previous.containsKey(row.getFlagKey())) {
                String state = traceRepository
                    .findFirstByCreatedByAndFlagKeyAndOccurredAtLessThanEqualOrderByOccurredAtDesc(
                        userId, row.getFlagKey(), row.getOccurredAt().minusMillis(1))
                    .map(FlagTraceReadService::stateOf)
                    .orElse(null);
                previous.put(row.getFlagKey(), state);
            }
        }
        List<Transition> transitions = new ArrayList<>();
        for (CompanionFlagTraceEntity row : rows) {
            String to0 = stateOf(row);
            transitions.add(new Transition(row.getOccurredAt(), row.getFlagKey(),
                FlagCatalog.labelOf(row.getFlagKey()), previous.get(row.getFlagKey()), to0,
                textOf(row)));
            previous.put(row.getFlagKey(), to0);
        }
        return List.copyOf(transitions);
    }

    /** raised + suppressed_by_cooldown reads as its own state — "true, but it stayed quiet". */
    private static String stateOf(CompanionFlagTraceEntity row) {
        return OUTCOME_RAISED.equals(row.getOutcome())
            && DISPOSITION_SUPPRESSED.equals(row.getDisposition())
            ? STATE_SUPPRESSED : row.getOutcome();
    }

    private static String textOf(CompanionFlagTraceEntity row) {
        if (OUTCOME_UNAVAILABLE.equals(row.getOutcome())) {
            return FlagTraceCopy.unavailableText(row.getReasonCode());
        }
        if (OUTCOME_RAISED.equals(row.getOutcome())) {
            return DISPOSITION_SUPPRESSED.equals(row.getDisposition())
                ? "A szabály igaz, de nemrég szólt már — most csendben maradt."
                : "A szabály jelzett.";
        }
        return FlagTraceCopy.clearText(row.getEvidence());
    }
}
```

> Corrected post-ship: the block above originally used `previous.computeIfAbsent(...)`, which is a
> real bug — `Map.computeIfAbsent` does not record a mapping when the mapping function returns
> `null`, so a rule whose very first-ever trace row fell on THIS day would have its lookup re-run
> on its second row of the same day, and that second lookup would find the first row and wrongly
> attach it as the antecedent of ITSELF. The shipped code (`FlagTraceReadService.transitions`) uses
> the explicit `containsKey`/`put` shown above instead. The lookup itself must still map through the
> STATIC `stateOf(CompanionFlagTraceEntity)`, not the instance `stateOf(userId, …)` — they are
> distinct overloads; if the compiler complains about the method reference, spell the lambda out.

- [ ] **Step 4: Run the test and make sure it passes**

```bash
cd backend && ./mvnw test -Dtest=FlagTraceReadServiceIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceReadService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagTraceReadServiceIT.java && git commit -m "feat(companion): FlagTraceReadService — a day's closing state, timeline and winner (mezo-6269.2)"
```

---

### Task 7: The contract, the mapper and the controller

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/mapper/CompanionFlagMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/controller/CompanionFlagTraceController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagTraceApiIT.java`

**Interfaces:**
- Consumes: `FlagTraceReadService.read`, generated `io.mrkuhne.mezo.api.controller.CompanionFlagsApi`, generated DTOs `FlagTraceDayResponse`, `FlagTraceRuleResponse`, `FlagTraceTransitionResponse`, `FlagTraceWinnerResponse`.
- Produces: `GET /api/companion/flags/trace?date=YYYY-MM-DD → 200 FlagTraceDayResponse`.

- [ ] **Step 1: Add the tag, the path and the schemas to the fragment**

In `api/feature/companion/companion.yml`, append to the existing `tags:` list:

```yaml
  - name: CompanionFlags
    description: >-
      Proactive coaching observer (mezo-6269.2, spec 2026-09-05 §5) — the read side of the flag
      engine's own decision trace. Its own tag so the generated interface stays separate from the
      conversation CRUD surface, and because the surface is companion.flags-owned: a proactive
      controller reading companion_flag_log would cross a feature boundary.
```

Add under `paths:`:

```yaml
  /api/companion/flags/trace:
    get:
      tags: [CompanionFlags]
      operationId: getFlagTrace
      summary: One day of the coaching engine's decision — every rule's verdict, the day's transitions and the winning card
      description: >-
        Renders what the engine concluded; it never re-evaluates a rule. `rules` always holds all
        13 rules in SEVERITY order (the order is itself information — it is the ranking that chose
        the day's card), each with its closing state for that day, which may have been unchanged
        since before the day. `cardOutcome` is DERIVED here by comparing the day's delivered card
        against the raised+logged rules, never stored. A rule the engine has never judged comes
        back `unavailable` / `not_evaluated_yet` rather than a fabricated `clear`.
      parameters:
        - name: date
          in: query
          required: false
          description: The day to read (the FE sends its LOCAL date); defaults to the server's today.
          schema: { type: string, format: date }
      responses:
        '200':
          description: The day's trace — an honest empty-ish day still returns all 13 rules
          content:
            application/json:
              schema: { $ref: '#/components/schemas/FlagTraceDayResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Add under `components: schemas:`:

```yaml
    FlagTraceDayResponse:
      type: object
      required: [date, rules, transitions]
      properties:
        date: { type: string, format: date }
        earliestDate:
          type: string
          format: date
          nullable: true
          description: The oldest traced day for this user — the day pager's floor. Null when nothing has ever been traced.
        winner:
          $ref: '#/components/schemas/FlagTraceWinnerResponse'
        rules:
          type: array
          description: All 13 rules, in severity order (rank 1 = most severe).
          items: { $ref: '#/components/schemas/FlagTraceRuleResponse' }
        transitions:
          type: array
          description: What changed inside this day, chronologically. Empty on a day where nothing changed.
          items: { $ref: '#/components/schemas/FlagTraceTransitionResponse' }
    FlagTraceWinnerResponse:
      type: object
      nullable: true
      required: [flagKey, rank, cardId]
      description: >-
        The rule whose raise became the day's card. Null when no card was delivered, or when the
        card came from a setup check rather than a flag — that key is none of the 13.
      properties:
        flagKey: { type: string }
        rank: { type: integer, description: 1-based position in the severity order. }
        cardId: { type: string, format: uuid, description: The companion_message row id. }
    FlagTraceRuleResponse:
      type: object
      required: [flagKey, label, domain, rank, outcome, reasonText, facts]
      properties:
        flagKey: { type: string }
        label:
          type: string
          description: >-
            The Hungarian name, server-sent so a round-2 rule appears without a frontend change.
            Falls back to the raw key for an unmapped rule.
        domain:
          type: string
          description: >-
            Drives the surface's colour wash and clay icon — sleep, training, nutrition, recovery,
            habits, logging, body, or general for an unmapped rule. The client MUST fall back
            safely on a domain it does not know.
        rank: { type: integer }
        outcome:
          type: string
          enum: [raised, clear, unavailable]
        reasonCode:
          type: string
          nullable: true
          description: >-
            Set when outcome is unavailable — the gate that stopped the rule, or the read-side
            not_evaluated_yet when the engine has never judged this rule.
        reasonText: { type: string, description: The one-line Hungarian explanation. }
        facts:
          type: array
          description: The expandable evidence rows — thresholds and observed values. Empty when there is nothing honest to show.
          items: { type: string }
        disposition:
          type: string
          nullable: true
          enum: [logged, suppressed_by_cooldown]
          description: What the service did with a raise. suppressed_by_cooldown means "true, but it spoke recently".
        cardOutcome:
          type: string
          nullable: true
          enum: [won, lost]
          description: Derived at read time against the day's delivered card; null unless the rule raised AND was logged.
        changedAt:
          type: string
          format: date-time
          nullable: true
          description: When this state last changed — may predate the day. Null when the rule has never been evaluated.
    FlagTraceTransitionResponse:
      type: object
      required: [at, flagKey, label, to, reasonText]
      properties:
        at: { type: string, format: date-time }
        flagKey: { type: string }
        label: { type: string }
        from:
          type: string
          nullable: true
          enum: [raised, clear, unavailable, suppressed]
          description: The state before this change; null on a rule's very first row.
        to:
          type: string
          enum: [raised, clear, unavailable, suppressed]
        reasonText: { type: string }
```

- [ ] **Step 2: Regenerate both artifacts**

```bash
cd api/generate && npm run generate:api
```

```bash
cd frontend && pnpm generate:api
```

Then confirm the drift gate is satisfied:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/padding-2px-all-pages-3479e4 && git diff --stat -- api/openapi.yml frontend/src/data/_client/api.gen.ts
```

Expected: both files changed.

- [ ] **Step 3: Write the failing API test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagTraceApiIT.java` — mirror the auth/MockMvc setup of an existing companion controller IT (find one with `ls backend/src/test/java/io/mrkuhne/mezo/feature/companion/`, e.g. a `*ApiIT` / `*ControllerIT`), then:

```java
    @Test
    void returns_all_thirteen_rules_in_severity_order_for_the_requested_day() throws Exception {
        // seed one clear + one raised trace row for the authenticated user on 2026-09-03,
        // exactly as FlagTraceReadServiceIT does
        mockMvc.perform(get("/api/companion/flags/trace?date=2026-09-03").headers(authHeaders()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.date").value("2026-09-03"))
            .andExpect(jsonPath("$.rules.length()").value(13))
            .andExpect(jsonPath("$.rules[0].rank").value(1))
            .andExpect(jsonPath("$.rules[0].label").isNotEmpty())
            .andExpect(jsonPath("$.rules[0].domain").isNotEmpty());
    }

    @Test
    void defaults_to_today_when_no_date_is_given() throws Exception {
        mockMvc.perform(get("/api/companion/flags/trace").headers(authHeaders()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.date").value(LocalDate.now().toString()));
    }

    @Test
    void requires_a_token() throws Exception {
        mockMvc.perform(get("/api/companion/flags/trace")).andExpect(status().isUnauthorized());
    }
```

- [ ] **Step 4: Run it to make sure it fails**

```bash
cd backend && ./mvnw test -Dtest=CompanionFlagTraceApiIT -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — 404 / no such controller.

- [ ] **Step 5: Write the mapper**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/mapper/CompanionFlagMapper.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.mapper;

import io.mrkuhne.mezo.api.dto.FlagTraceDayResponse;
import io.mrkuhne.mezo.api.dto.FlagTraceRuleResponse;
import io.mrkuhne.mezo.api.dto.FlagTraceTransitionResponse;
import io.mrkuhne.mezo.api.dto.FlagTraceWinnerResponse;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceReadService;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

/** Domain records → generated DTOs. String→enum goes through the generated {@code fromValue}, the
 *  {@code ProactiveMapper.map(String)} precedent — the wire values are the lower-case ones the DB
 *  stores, not the Java constant names. */
@Mapper(componentModel = "spring")
public interface CompanionFlagMapper {

    FlagTraceDayResponse toResponse(FlagTraceReadService.TraceDay day);

    FlagTraceWinnerResponse toWinner(FlagTraceReadService.Winner winner);

    FlagTraceRuleResponse toRule(FlagTraceReadService.RuleState rule);

    FlagTraceTransitionResponse toTransition(FlagTraceReadService.Transition transition);

    default FlagTraceRuleResponse.OutcomeEnum mapOutcome(String value) {
        return value == null ? null : FlagTraceRuleResponse.OutcomeEnum.fromValue(value);
    }

    default FlagTraceRuleResponse.DispositionEnum mapDisposition(String value) {
        return value == null ? null : FlagTraceRuleResponse.DispositionEnum.fromValue(value);
    }

    default FlagTraceRuleResponse.CardOutcomeEnum mapCardOutcome(String value) {
        return value == null ? null : FlagTraceRuleResponse.CardOutcomeEnum.fromValue(value);
    }

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

> The generated enum wrapper names depend on the generator's config. After regenerating, look at the actual DTOs under `backend/target/generated-sources/**/io/mrkuhne/mezo/api/dto/FlagTraceRuleResponse.java` and fix these `default` methods to match — including `FlagTraceTransitionResponse`'s `from`/`to` enums, which need their own `fromValue` bridges. A MapStruct ambiguity error here means two `default` methods share a return type; give each a distinct name and add explicit `@Mapping(target = …, qualifiedByName = …)`, the `mapActionKey` precedent in `ProactiveMapper`.

- [ ] **Step 6: Write the controller**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/controller/CompanionFlagTraceController.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.controller;

import io.mrkuhne.mezo.api.controller.CompanionFlagsApi;
import io.mrkuhne.mezo.api.dto.FlagTraceDayResponse;
import io.mrkuhne.mezo.feature.companion.flags.mapper.CompanionFlagMapper;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagTraceReadService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * The coaching observer's read surface (spec 2026-09-05 §5). It lives in {@code companion.flags}
 * and not in {@code proactive} on purpose: a proactive controller reading
 * {@code CompanionFlagLogRepository} would cross a feature boundary. READ-ONLY — the observer never
 * writes and never recomputes.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
    havingValue = "true")
public class CompanionFlagTraceController implements CompanionFlagsApi {

    private final FlagTraceReadService readService;
    private final CompanionFlagMapper mapper;

    @Override
    public ResponseEntity<FlagTraceDayResponse> getFlagTrace(LocalDate date) {
        LocalDate day = date == null ? LocalDate.now() : date;
        return ResponseEntity.ok(mapper.toResponse(
            readService.read(CurrentUser.id(), day)));
    }
}
```

> `CurrentUser.id()` is a placeholder: use whatever this codebase's authenticated-user accessor actually is. Copy it verbatim from a neighbouring companion controller (`grep -n "getCurrentUser\|currentUserId\|SecurityUtils" backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/*.java`) — do not invent one. Likewise confirm the generated `CompanionFlagsApi` method signature (parameter type and whether it is `Optional<LocalDate>`) and match it exactly.

- [ ] **Step 7: Run the API test and ArchUnit**

```bash
cd backend && ./mvnw test -Dtest='CompanionFlagTraceApiIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Expected: PASS. ArchUnit specifically checks that this controller implements a generated `*Api` interface and lives in a `..controller..` package.

- [ ] **Step 8: Commit**

```bash
git add api/feature/companion/companion.yml api/openapi.yml frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/mapper backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/controller backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagTraceApiIT.java && git commit -m "feat(api): GET /api/companion/flags/trace — the observer's day read (mezo-6269.2)"
```

---

### Task 8: `flagKey` on the delivered card

Spec §4.4. The card already stores its severity key in `content.adviceKey`; it just never reaches the wire, so the observer cannot correlate the winner and the S3 card page cannot say which rule it came from.

**Files:**
- Modify: `api/feature/proactive/proactive.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java`
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/today/feedApi.ts`
- Test: an existing feed IT (find it: `grep -rln "api/proactive/feed" backend/src/test`), plus `frontend/src/data/today/feedHooks.test.tsx`

**Interfaces:**
- Produces: `FeedMessageResponse.flagKey` (optional string); `FeedMessage.flagKey?: string` on the frontend.

- [ ] **Step 1: Add the field to the contract**

In `api/feature/proactive/proactive.yml`, inside `FeedMessageResponse.properties`, after `suggestions`:

```yaml
        flagKey:
          type: string
          description: >-
            The SEVERITY key this card came from (spec 2026-09-05 §4.4) — a flag key for a
            flag-sourced card, or a setup-check key for a setup-sourced one. Present only on advice
            rows. Lets the coaching observer correlate the day's winner against the raised rules.
```

- [ ] **Step 2: Regenerate**

```bash
cd api/generate && npm run generate:api
```

```bash
cd frontend && pnpm generate:api
```

- [ ] **Step 3: Map it**

In `ProactiveMapper.toFeedResponse`, add alongside the other `@Mapping`s:

```java
    @Mapping(target = "flagKey", source = "content.adviceKey")
```

- [ ] **Step 4: Assert it on the wire**

In the existing feed IT, extend the advice-card case with:

```java
            .andExpect(jsonPath("$[0].flagKey").value("sleep_debt"))
```

(matching whatever `adviceKey` that test's fixture card carries).

```bash
cd backend && ./mvnw test -Dtest=<TheFeedIT> -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 5: Pass it through on the frontend**

In `frontend/src/data/types.ts`, inside `interface FeedMessage`, after `suggestions`:

```ts
  /** The severity key the card came from (mezo-6269.2) — flag key or setup-check key; advice rows only. */
  flagKey?: string
```

In `frontend/src/data/today/feedApi.ts`, inside `toFeedMessages`'s object literal, after `suggestions: m.suggestions,`:

```ts
    flagKey: m.flagKey,
```

- [ ] **Step 6: Assert the pass-through**

Add to `frontend/src/data/today/feedHooks.test.tsx` (real-mode block; if the file has no real-mode block yet, add one with `vi.stubEnv('VITE_USE_MOCK', 'false')` mirroring `diagnosisHooks.test.tsx`):

```ts
  test('carries the card flagKey through to the FE model', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([{
        id: 'c1', date: '2026-09-03', kind: 'advice', eyebrow: 'Alvás',
        body: ['Aludj többet.'], refs: [], flagKey: 'sleep_debt',
        generatedAt: '2026-09-03T06:00:00Z',
      }])),
    )
    const { result } = renderHook(() => useCompanionFeed('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0].flagKey).toBe('sleep_debt')
  })
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm test src/data/today/feedHooks.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/feature/proactive/proactive.yml api/openapi.yml frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java frontend/src/data/types.ts frontend/src/data/today/feedApi.ts frontend/src/data/today/feedHooks.test.tsx backend/src/test && git commit -m "feat(api): the delivered card names its flagKey (mezo-6269.2)"
```

---

### Task 9: The frontend data layer and the deterministic mock day

Spec §5: *"a deterministic mock day exercising all five states (`Jelzett`, `Rendben`, `Nem mérhető`, `Pihenőn`, `Nyertes`), plus at least one transition, since the companion feed mock is `[]` today."* Without it, S3's pages and the visual job are blank in development. No pages here — S3 builds those.

**Files:**
- Modify: `frontend/src/data/types.ts`
- Create: `frontend/src/data/insights/coachingTraceApi.ts`
- Create: `frontend/src/data/insights/coachingTraceMock.ts`
- Create: `frontend/src/data/insights/coachingTraceHooks.ts`
- Test: `frontend/src/data/insights/coachingTraceHooks.test.tsx`

**Interfaces:**
- Produces:

```ts
export type FlagOutcome = 'raised' | 'clear' | 'unavailable'
export type FlagState = FlagOutcome | 'suppressed'
export interface CoachingRule {
  flagKey: string; label: string; domain: string; rank: number
  outcome: FlagOutcome; reasonCode?: string; reasonText: string; facts: string[]
  disposition?: 'logged' | 'suppressed_by_cooldown'
  cardOutcome?: 'won' | 'lost'
  changedAt?: string
}
export interface CoachingTransition {
  at: string; flagKey: string; label: string; from?: FlagState; to: FlagState; reasonText: string
}
export interface CoachingWinner { flagKey: string; rank: number; cardId: string }
export interface CoachingTraceDay {
  date: string; earliestDate?: string; winner?: CoachingWinner
  rules: CoachingRule[]; transitions: CoachingTransition[]
}
```
- `coachingTraceApi.get(date) → Promise<CoachingTraceDay>`
- `mockCoachingDay(date: string) → CoachingTraceDay`
- `useCoachingTrace(date?: string) → { day: CoachingTraceDay; isPending: boolean; isError: boolean }`

- [ ] **Step 1: Write the failing test**

`frontend/src/data/insights/coachingTraceHooks.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import { useCoachingTrace } from '@/data/insights/coachingTraceHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

describe('mock mode', () => {
  test('serves a deterministic day exercising all five screen states', () => {
    const { result } = renderHook(() => useCoachingTrace('2026-09-03'),
      { wrapper: makeHookWrapper() })
    const day = result.current.day
    expect(result.current.isPending).toBe(false)
    expect(day.rules).toHaveLength(13)
    expect(day.rules.map((r) => r.rank)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1))
    expect(day.rules.some((r) => r.outcome === 'raised' && r.disposition === 'logged')).toBe(true)
    expect(day.rules.some((r) => r.outcome === 'clear')).toBe(true)
    expect(day.rules.some((r) => r.outcome === 'unavailable')).toBe(true)
    expect(day.rules.some((r) => r.disposition === 'suppressed_by_cooldown')).toBe(true)
    expect(day.rules.some((r) => r.cardOutcome === 'won')).toBe(true)
    expect(day.rules.some((r) => r.cardOutcome === 'lost')).toBe(true)
    expect(day.winner?.flagKey).toBe(day.rules.find((r) => r.cardOutcome === 'won')?.flagKey)
    expect(day.transitions.length).toBeGreaterThan(0)
  })

  test('every mock rule carries a label, a domain and an explanation', () => {
    for (const rule of mockCoachingDay('2026-09-03').rules) {
      expect(rule.label).not.toBe('')
      expect(rule.domain).not.toBe('')
      expect(rule.reasonText).not.toBe('')
    }
  })
})

describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the wire day and never returns the mock seed', async () => {
    server.use(http.get(`${API_BASE}/api/companion/flags/trace`, () => HttpResponse.json({
      date: '2026-09-03',
      earliestDate: '2026-09-01',
      winner: { flagKey: 'sleep_debt', rank: 6, cardId: 'c1' },
      rules: [{
        flagKey: 'sleep_debt', label: 'Alvásadósság', domain: 'sleep', rank: 6,
        outcome: 'raised', reasonText: 'Alvásadósság: 1,4 óra/éjszaka', facts: ['x'],
        disposition: 'logged', cardOutcome: 'won', changedAt: '2026-09-03T07:00:00Z',
      }],
      transitions: [{
        at: '2026-09-03T07:00:00Z', flagKey: 'sleep_debt', label: 'Alvásadósság',
        from: 'clear', to: 'raised', reasonText: 'A szabály jelzett.',
      }],
    })))
    const { result } = renderHook(() => useCoachingTrace('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.day.rules).toHaveLength(1))
    expect(result.current.day.winner?.cardId).toBe('c1')
    expect(result.current.day.rules[0].cardOutcome).toBe('won')
  })

  test('an unresolved fetch shows an empty day, never the mock seed', () => {
    const { result } = renderHook(() => useCoachingTrace('2026-09-03'),
      { wrapper: makeHookWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.day.rules).toEqual([])
  })

  test('a rule the frontend has never seen still arrives whole (the round-2 guarantee)', async () => {
    server.use(http.get(`${API_BASE}/api/companion/flags/trace`, () => HttpResponse.json({
      date: '2026-09-03',
      rules: [{
        flagKey: 'round_two_rule', label: 'Új szabály', domain: 'something_new', rank: 1,
        outcome: 'clear', reasonText: 'Rendben.', facts: [],
      }],
      transitions: [],
    })))
    const { result } = renderHook(() => useCoachingTrace('2026-09-03'),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.day.rules).toHaveLength(1))
    expect(result.current.day.rules[0].label).toBe('Új szabály')
    expect(result.current.day.rules[0].domain).toBe('something_new')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
cd frontend && pnpm test src/data/insights/coachingTraceHooks.test.tsx
```

Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Add the types**

Append to `frontend/src/data/types.ts` the block from **Interfaces** above, with this header comment:

```ts
/**
 * The coaching observer's day (mezo-6269.2, spec 2026-09-05 §5). `label` and `domain` are
 * SERVER-SENT on purpose: a per-flagKey map here would mean every round-2 rule needs a frontend
 * change. `domain` drives the wash and the clay icon and the surface MUST fall back safely on one
 * it does not know.
 */
```

- [ ] **Step 4: Write the api client**

`frontend/src/data/insights/coachingTraceApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { CoachingTraceDay } from '@/data/types'

type TraceWire =
  paths['/api/companion/flags/trace']['get']['responses']['200']['content']['application/json']

/** Wire → FE. A straight structural pass-through: every user-facing string (label, domain,
 *  reasonText, facts) is already rendered by the server, which is the point of the endpoint. */
export function toCoachingTraceDay(wire: TraceWire): CoachingTraceDay {
  return wire as CoachingTraceDay
}

export const coachingTraceApi = {
  get: (date: string) =>
    apiFetch<TraceWire>(`/api/companion/flags/trace?date=${date}`).then(toCoachingTraceDay),
}
```

> If `tsc -b` rejects the `as`, the generated optional/nullable shapes differ from the hand-written interface — narrow the FE types to match the generated ones rather than widening the cast.

- [ ] **Step 5: Write the mock day**

`frontend/src/data/insights/coachingTraceMock.ts` — 13 rules in rank order, exercising every state. Keep it a pure function of `date` so the mock is deterministic and dateable:

```ts
import type { CoachingRule, CoachingTraceDay } from '@/data/types'

/**
 * The demo observer day (mezo-6269.2, spec 2026-09-05 §5). The companion feed mock is `[]`, so
 * without this the observer pages are blank in `pnpm dev` and in the visual job. Deliberately
 * exercises ALL FIVE screen states — Jelzett, Rendben, Nem mérhető, Pihenőn, Nyertes — plus two
 * transitions, so a rendering regression in any one of them shows up in a golden.
 */
const RULES: Omit<CoachingRule, 'changedAt'>[] = [
  { flagKey: 'acute_bad_day', label: 'Rossz nap', domain: 'recovery', rank: 1,
    outcome: 'clear', reasonText: '1,0 rossz check-in ma — a jelzéshez 2,0 kellene.',
    facts: ['1,0 rossz check-in ma — a jelzéshez 2,0 kellene.', 'Mért érték: 1,0 · küszöb: 2,0'] },
  { flagKey: 'load_fuel_mismatch', label: 'Terhelés–táplálás', domain: 'nutrition', rank: 2,
    outcome: 'raised', disposition: 'logged', cardOutcome: 'won',
    reasonText: '7 napos terhelés 412 perc, kcal a cél 71%-án',
    facts: ['7 napos terhelés 412 perc, kcal a cél 71%-án', 'Alvásátlag: 6,8 óra (padló 7,0 óra)'] },
  { flagKey: 'rapid_weight_loss', label: 'Gyors fogyás', domain: 'body', rank: 3,
    outcome: 'unavailable', reasonCode: 'no_active_goal',
    reasonText: 'Nincs aktív cél — a trajektória nem olvasható.', facts: [] },
  { flagKey: 'joint_overuse', label: 'Vállterhelés', domain: 'training', rank: 4,
    outcome: 'clear', reasonText: 'A holnapi edzés nem vállfókuszú (láb).',
    facts: ['A holnapi edzés nem vállfókuszú (láb).'] },
  { flagKey: 'missed_workouts', label: 'Kimaradt edzések', domain: 'training', rank: 5,
    outcome: 'clear', reasonText: 'A leghosszabb kihagyott sorozat 1,0 nap — a jelzéshez 3,0 kellene.',
    facts: ['A leghosszabb kihagyott sorozat 1,0 nap — a jelzéshez 3,0 kellene.',
      'Mért érték: 1,0 · küszöb: 3,0'] },
  { flagKey: 'sleep_debt', label: 'Alvásadósság', domain: 'sleep', rank: 6,
    outcome: 'raised', disposition: 'logged', cardOutcome: 'lost',
    reasonText: 'Alvásadósság: 1,4 óra/éjszaka (cél 8,0 óra, 6 rögzített éjszaka 7-ből)',
    facts: ['Alvásadósság: 1,4 óra/éjszaka (cél 8,0 óra, 6 rögzített éjszaka 7-ből)'] },
  { flagKey: 'logging_gap', label: 'Rögzítési hiány', domain: 'logging', rank: 7,
    outcome: 'clear', reasonText: '1,0 elavult napló — a jelzéshez 2,0 kellene (étkezés).',
    facts: ['1,0 elavult napló — a jelzéshez 2,0 kellene (étkezés).', 'Mért érték: 1,0 · küszöb: 2,0'] },
  { flagKey: 'ignored_nudge', label: 'Elengedett emlékeztető', domain: 'sleep', rank: 8,
    outcome: 'unavailable', reasonCode: 'no_sleep_goal_row',
    reasonText: 'Nincs alváscél rögzítve — a lefekvési horgony ismeretlen.', facts: [] },
  { flagKey: 'late_eating', label: 'Késői evés', domain: 'nutrition', rank: 9,
    outcome: 'raised', disposition: 'suppressed_by_cooldown',
    reasonText: 'Késői vacsora 3 napból 2-n (küszöb: lefekvés előtt 120 perc)',
    facts: ['Késői vacsora 3 napból 2-n (küszöb: lefekvés előtt 120 perc)'] },
  { flagKey: 'recovery_needed', label: 'Regeneráció kell', domain: 'recovery', rank: 10,
    outcome: 'clear', reasonText: '2,0 regenerációs jel a szükséges 3,0-ból (hiányzik: stressz).',
    facts: ['2,0 regenerációs jel a szükséges 3,0-ból (hiányzik: stressz).',
      'Mért érték: 2,0 · küszöb: 3,0'] },
  { flagKey: 'sustained_stress', label: 'Tartós stressz', domain: 'recovery', rank: 11,
    outcome: 'clear', reasonText: '1,0 nap a stresszküszöb fölött — a jelzéshez 3,0 kellene.',
    facts: ['1,0 nap a stresszküszöb fölött — a jelzéshez 3,0 kellene.', 'Mért érték: 1,0 · küszöb: 3,0'] },
  { flagKey: 'momentum_at_risk', label: 'Lendület veszélyben', domain: 'habits', rank: 12,
    outcome: 'unavailable', reasonCode: 'no_habit_baseline',
    reasonText: 'Nincs szokás-alapvonal — nincs honnan visszaesni.', facts: [] },
  { flagKey: 'all_healthy', label: 'Minden rendben', domain: 'habits', rank: 13,
    outcome: 'clear', reasonText: 'Ma más szabály jelzett, így a „minden rendben" nem áll fenn.',
    facts: ['Ma más szabály jelzett, így a „minden rendben" nem áll fenn.'] },
]

/** The demo day for `date`. Timestamps are anchored to that day so the pager reads sensibly. */
export function mockCoachingDay(date: string): CoachingTraceDay {
  return {
    date,
    earliestDate: '2026-08-28',
    winner: { flagKey: 'load_fuel_mismatch', rank: 2, cardId: 'mock-card-1' },
    rules: RULES.map((rule) => ({ ...rule, changedAt: `${date}T07:00:00Z` })),
    transitions: [
      { at: `${date}T07:00:00Z`, flagKey: 'load_fuel_mismatch', label: 'Terhelés–táplálás',
        from: 'clear', to: 'raised', reasonText: 'A szabály jelzett.' },
      { at: `${date}T14:00:00Z`, flagKey: 'late_eating', label: 'Késői evés',
        from: 'raised', to: 'suppressed',
        reasonText: 'A szabály igaz, de nemrég szólt már — most csendben maradt.' },
    ],
  }
}
```

- [ ] **Step 6: Write the hook**

`frontend/src/data/insights/coachingTraceHooks.ts`:

```ts
import { coachingTraceApi } from '@/data/insights/coachingTraceApi'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { CoachingTraceDay } from '@/data/types'

/**
 * One day of the coaching engine's decision (mezo-6269.2). `useDualQuery` because the honest-state
 * rule bites hard here: a half-loaded observer that shows 13 fabricated "Rendben" tiles would be
 * the worst possible version of a transparency surface. Real mode returns an EMPTY day while
 * unresolved — never the mock seed — and `isError` lets the page render a real error instead of a
 * misleadingly calm one.
 */
export function useCoachingTrace(date: string = localDateString()): {
  day: CoachingTraceDay
  isPending: boolean
  isError: boolean
} {
  const { data, isPending, isError } = useDualQuery<CoachingTraceDay>({
    queryKey: ['coachingTrace', date],
    mockData: mockCoachingDay(date),
    realFetch: () => coachingTraceApi.get(date),
    realEmpty: { date, rules: [], transitions: [] },
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { day: data, isPending, isError }
}
```

- [ ] **Step 7: Run the tests, both modes, plus the guard and the build**

```bash
cd frontend && pnpm test src/data/insights/coachingTraceHooks.test.tsx src/data/dualMode.guard.test.ts
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm test src/data/insights/coachingTraceHooks.test.tsx
```

```bash
cd frontend && pnpm build
```

Expected: PASS / PASS / clean build.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/insights/coachingTraceApi.ts frontend/src/data/insights/coachingTraceMock.ts frontend/src/data/insights/coachingTraceHooks.ts frontend/src/data/insights/coachingTraceHooks.test.tsx && git commit -m "feat(fe): coaching observer data layer + the deterministic mock day (mezo-6269.2)"
```

---

### Task 10: Docs, CODEMAP, gates, PR

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/features/proactive.md` (confirm the filename with `ls docs/features/`)
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Extend the companion feature doc**

Directly after the S1 block (`grep -n "Proactive coaching observer S1" docs/features/companion.md`), add an S2 block covering, in the doc's existing voice:

- `GET /api/companion/flags/trace?date=` — what it returns and the one rule it obeys: it renders, it never recomputes.
- Why the surface is in `companion.flags` and not in `proactive` (the slice cycle), and the two consumer-owned ports (`AdviceRankPort`, `DailyCardPort`) that keep it that way — name `NudgeSendPort` as the precedent.
- `FlagCatalog` as the single place a rule is named, and why `label`/`domain` are server-sent (the round-2 promise).
- `FlagFactRenderer`'s move out of `proactive` and its two consumers, plus `FlagTraceCopy` for the other two outcomes.
- Closing state vs. transitions falling out of the same rows; the honest `not_evaluated_yet` state; `cardOutcome` derived at read time and never stored.
- RAISED evidence coming from `companion_flag_log`'s frozen payload — including the honest note that a `suppressed_by_cooldown` raise has no log row of its own, so what is shown is the last raise the engine actually logged.

- [ ] **Step 2: Note `flagKey` in the proactive doc**

One line where `FeedMessageResponse` is described: the card now names the severity key it came from (`mezo-6269.2`), which is what lets the observer correlate the day's winner.

- [ ] **Step 3: Regenerate the CODEMAP**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/padding-2px-all-pages-3479e4 && node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```

Expected: `--check` clean.

- [ ] **Step 4: Lint the docs**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/padding-2px-all-pages-3479e4 && node scripts/lint-docs.mjs
```

Expected: no new orphans, broken links or staleness.

- [ ] **Step 5: Run the real gates**

Backend — the blast radius plus the two convention gates:

```bash
cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**,io.mrkuhne.mezo.feature.proactive.**,ArchitectureTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Frontend — **both modes**, because an unset `VITE_USE_MOCK` runs mock twice and the real-mode gate is vacuous:

```bash
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Contract drift:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/padding-2px-all-pages-3479e4 && cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd .. && git diff --exit-code -- api/openapi.yml frontend/src/data/_client/api.gen.ts
```

Expected: exit 0 (nothing stale).

- [ ] **Step 6: Commit the docs**

```bash
git add docs/features docs/CODEMAP.md && git commit -m "docs(companion): the observer read surface and its two ports (mezo-6269.2)"
```

- [ ] **Step 7: Push and open the self-PR (the CI gate)**

```bash
git push -u origin feat/coaching-observer
```

```bash
gh pr create --fill --base main
```

- [ ] **Step 8: Wait for CI green, then merge locally**

```bash
gh pr checks --watch
```

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/coaching-observer && git push && git branch -d feat/coaching-observer && git push origin --delete feat/coaching-observer
```

> Reminder from the worktree rules: run these from the worktree, never by `cd`-ing to the primary repo — that checkout sits on `main`.

- [ ] **Step 9: Close the bd issue and hand off**

```bash
bd close mezo-6269.2 && bd dolt push && git push && git status
```

Expected: `git status` shows "up to date with origin". `mezo-6269.3` (S3 — the tile and the three pages) is now unblocked; it consumes `useCoachingTrace`, `mockCoachingDay` and the server's `label`/`domain`, and needs no further backend work.

---

## Self-review

**Spec coverage.** §4.4 `flagKey` on the card → Task 8. §5 the endpoint shape → Tasks 6–7 (`date`, `winner{flagKey,rank,cardId}`, `rules[]` in severity order with `flagKey/label/domain/rank/outcome/reasonCode/reasonText/facts/disposition/cardOutcome/changedAt`, `transitions[]` chronological — plus `earliestDate`, added so the S3 day pager knows where to stop). §5 server-sent `label`/`domain` → Task 1. §5 `reasonText` from the same renderer family as the card's facts → Tasks 3–4. §5 the deterministic mock day with all five states and a transition → Task 9. §7 the tested content — cooldown suppression visible as `Pihenőn`, closing state and timeline from the same rows, a past day reading back unchanged, the round-2 guarantee, honest four-way states → Tasks 6 and 9. §3's traps — ArchUnit, contract drift, CODEMAP, Testcontainers, `VITE_USE_MOCK`, honest states, mock-mode rendering → Global Constraints and Tasks 2, 7, 9, 10.

**Deliberately out of S2** (S3's, per §8): the tile, the three pages, visual goldens, the `domain → wash/icon` map. The `MezoHubPage` golden is untouched here because no tile is added yet.

**Two decisions the spec leaves open, resolved here and worth flagging on review:**
1. *Where RAISED evidence comes from.* The trace stores `ClearEvidence` only, so a RAISED row has no payload of its own. Rather than widening the S1 table, the read side reads the frozen payload back from `companion_flag_log` — nothing is recomputed and a past day shows what was frozen then. The honest consequence: a raise suppressed by cooldown never got its own log row, so what is shown is the last raise the engine actually logged. That is documented in the repository method, in `FlagTraceReadService` and in the feature doc.
2. *A rule with no trace row at all.* Reported as `unavailable` / `not_evaluated_yet`, never as a fabricated `clear` — a read-side reason code, not an `UnavailableReason` member, since no rule produces it.
