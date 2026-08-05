# Fuel Stack Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Stack "AI builder" (selection + Bekapcsolás) with a living, autosaved, occurrence-based daily supplement protocol: backend placement engine (rule table + LLM fallback), slot-pinned manual moves, rest-day regrouping, real meal-match.

**Architecture:** Zone *assignment* is persisted server-side per occurrence (`protocol_item` gains `slot_key/dose/pinned/placement_source/placement_reason/rest_day_fallback`); zone *times* stay FE-derived at render from live anchors (existing invariant). A new pure `projectStackDay()` replaces `buildProtocol()` for the Stack page, the Mai timeline and the notification writer. Contract changes are sequenced additive → migrate consumers → cleanup so every commit is green.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven / Liquibase / Testcontainers-Postgres ITs · React 19 + TanStack Query + vitest/MSW · OpenAPI contract-first (`api/feature/fuel/fuel.yml`).

**Spec:** `docs/superpowers/specs/2026-08-03-stack-redesign-design.md` · **Driving bd issue:** `mezo-vx9v`

## Global Constraints

- Read the matching house reference BEFORE coding (non-negotiable): backend → `docs/references/{spring_patterns,error_handling,liquibase_conventions,testing_standards,integration_test_framework,configuration_conventions,api_contract_conventions,java_package_structure}.md`; frontend → `docs/references/frontend_conventions.md`.
- Code/comments/commits ENGLISH; UI copy HUNGARIAN. Commit subjects: `feat(fuel): … (mezo-vx9v)`.
- Backend: constructor DI + `@RequiredArgsConstructor`, `@Transactional` method-level only, UUID PKs, soft delete stays, seed data in Java `@Profile("demodata")` only, never `@Value`.
- Frontend: hooks imported from `@/data/hooks` only; deep absolute `@/*` imports, no new barrels; colors ONLY `var(--token)`; hex-alpha banned → `color-mix(in srgb, X N%, transparent)`; dual-mode reads via `useDualQuery`; never `*Screen`/`*View`.
- Tests: backend = integration-first (`AbstractIntegrationTest`/`ApiIntegrationTest`, AssertJ, `test{Method}_should{Result}_when{Condition}`); frontend = vitest, BOTH modes green.
- **Local test runs are FOCUSED only** — never run the full backend suite locally (16 GB machine OOMs). Backend: `cd backend && docker compose up -d && ./mvnw clean test -Dtest=<ClassA,ClassB> -Dsurefire.failIfNoSpecifiedTests=false`. Frontend: `cd frontend && pnpm test <path>` and `VITE_USE_MOCK=true pnpm test <path>`. The full suite runs in CI via the self-PR gate.
- ALWAYS `clean` in maven runs (flaky Lombok/MapStruct incremental compile).
- Zone keys (canonical, FE↔BE, exact strings): `wake · breakfast · pre_workout · post_workout · lunch · dinner · evening · bedtime`. Placement sources: `rule · llm · user · fallback`.

---

### Task 1: Liquibase migration — occurrence columns on `protocol_item`

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608031200_mezo-vx9v_protocol_item_occurrence.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at end, after the `202608021100_mezo-1rz9…` entry at :534-540)

**Interfaces:**
- Consumes: existing `protocol_item` DDL from `202607021300_mezo-09g_create_protocol_supplement_intake.sql` (cols `id, created_by, is_deleted, created_at, protocol_id, pantry_item_id, item_order`).
- Produces: nullable `slot_key`, `dose`, `placement_reason`, `rest_day_fallback` text cols; `pinned boolean not null default false`; `placement_source text not null default 'rule'`; CHECK constraints; partial unique index `uq_protocol_item_zone_occurrence`. Legacy rows keep `slot_key IS NULL` (backfilled lazily by Task 4's service).

- [ ] **Step 1: Write the migration SQL**

```sql
-- mezo-vx9v: occurrence-based protocol items — a stack item can appear 1..n times per day,
-- each occurrence carrying its own zone, dose and pin state. slot_key stays NULL on legacy
-- rows; ProtocolService backfills lazily on first read (seed-in-Java rule — no data in SQL).
alter table protocol_item add column slot_key text;
alter table protocol_item add column dose text;
alter table protocol_item add column pinned boolean not null default false;
alter table protocol_item add column placement_source text not null default 'rule';
alter table protocol_item add column placement_reason text;
alter table protocol_item add column rest_day_fallback text;

alter table protocol_item add constraint ck_protocol_item_slot_key
    check (slot_key is null or slot_key in
        ('wake','breakfast','pre_workout','post_workout','lunch','dinner','evening','bedtime'));
alter table protocol_item add constraint ck_protocol_item_placement_source
    check (placement_source in ('rule','llm','user','fallback'));
alter table protocol_item add constraint ck_protocol_item_rest_day_fallback
    check (rest_day_fallback is null or rest_day_fallback in
        ('skip','wake','breakfast','pre_workout','post_workout','lunch','dinner','evening','bedtime'));

-- One occurrence of a pantry item per zone (soft-deleted rows excluded so re-adding works).
create unique index uq_protocol_item_zone_occurrence
    on protocol_item (protocol_id, pantry_item_id, slot_key) where is_deleted = false;
```

- [ ] **Step 2: Register the changeset** — append to `1.0.0_master.yml` (copy the 6-line block shape of the last entry verbatim, id `"1.0.0:202608031200_mezo-vx9v_protocol_item_occurrence"`, author `daniel.kuhne`).

- [ ] **Step 3: Verify** — `cd backend && docker compose up -d && ./mvnw clean test -Dtest=ProtocolServiceIT -Dsurefire.failIfNoSpecifiedTests=false`. Expected: migration applies, existing tests PASS (new columns are nullable/defaulted; entity untouched yet). Also run `node scripts/lint-liquibase.mjs` if present at repo root (it lints filename↔id sync).

- [ ] **Step 4: Commit** — `feat(fuel): protocol_item occurrence columns migration (mezo-vx9v)`

---

### Task 2: Entity + repository — occurrence fields

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/entity/ProtocolItemEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/entity/StackZone.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/repository/ProtocolItemRepository.java`

**Interfaces:**
- Produces: `StackZone` enum with `String key()` + `static StackZone fromKey(String)` + `int order()`; `ProtocolItemEntity` fields `String slotKey; String dose; boolean pinned; String placementSource; String placementReason; String restDayFallback;` (String columns — CHECKs guard values; mirrors `ProtocolEntity.status` style); repo method `Optional<ProtocolItemEntity> findByProtocolIdAndPantryItemIdAndSlotKeyAndDeletedFalse(UUID, UUID, String)` and `List<ProtocolItemEntity> findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(UUID)` (existing, unchanged).

- [ ] **Step 1: Create `StackZone`**

```java
package io.mrkuhne.mezo.feature.fuel.entity;

import java.util.Arrays;

/** Canonical stack zones (mezo-vx9v). Keys are the FE↔BE contract strings — order is the
 *  daily render order. Times are NEVER stored — the FE projects zone→time from live anchors. */
public enum StackZone {
    WAKE("wake"), BREAKFAST("breakfast"), PRE_WORKOUT("pre_workout"), POST_WORKOUT("post_workout"),
    LUNCH("lunch"), DINNER("dinner"), EVENING("evening"), BEDTIME("bedtime");

    private final String key;
    StackZone(String key) { this.key = key; }
    public String key() { return key; }
    public int order() { return ordinal(); }

    public static StackZone fromKey(String key) {
        return Arrays.stream(values()).filter(z -> z.key.equals(key)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unknown stack zone: " + key));
    }
}
```

- [ ] **Step 2: Extend `ProtocolItemEntity`** — after `itemOrder` (:45-47) add (same annotation style as the file's existing columns):

```java
    /** Canonical zone key — NULL on pre-mezo-vx9v rows until the lazy read-backfill runs. */
    @Column(name = "slot_key")
    private String slotKey;

    /** Per-occurrence dose override; NULL = inherit the pantry item's default dose. */
    @Column(name = "dose")
    private String dose;

    /** True when the user chose/moved the zone — the engine never overwrites a pinned zone. */
    @Column(name = "pinned", nullable = false)
    private boolean pinned;

    /** rule | llm | user | fallback (CHECK-guarded). */
    @NotNull
    @Column(name = "placement_source", nullable = false)
    private String placementSource = "rule";

    /** One Hungarian sentence: why this zone. */
    @Column(name = "placement_reason")
    private String placementReason;

    /** Rest-day behaviour for training zones: 'skip' or a fallback zone key; NULL = FE default. */
    @Column(name = "rest_day_fallback")
    private String restDayFallback;
```

- [ ] **Step 3: Add repo finder** to `ProtocolItemRepository`:

```java
    Optional<ProtocolItemEntity> findByProtocolIdAndPantryItemIdAndSlotKeyAndDeletedFalse(
        UUID protocolId, UUID pantryItemId, String slotKey);
```

- [ ] **Step 4: Verify** — `./mvnw clean test -Dtest=ProtocolServiceIT,FuelApiIT -Dsurefire.failIfNoSpecifiedTests=false` → PASS (entity↔DDL in sync).

- [ ] **Step 5: Commit** — `feat(fuel): occurrence fields on ProtocolItemEntity + StackZone enum (mezo-vx9v)`

---

### Task 3: Placement engine — rule table, LLM port + adapter, flag

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/StackPlacementLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/PlacementRules.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/PlacementEngine.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/StackPlacementLlmAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (near :125)
- Modify: `backend/src/main/resources/application.yml` (`mezo.feature:` block — new entry right after `fuel-settings:` :212-213)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/PlacementEngineIT.java`

**Interfaces:**
- Consumes: `CompanionLlm.complete(String,String)` (cheap tier); `LlmCallContextHolder.runWith(LlmCallContext, Supplier)` — copy the exact audit idiom from `feature/pantry/service/ScrapeExtractionService.java:79-91`; `PantryItemEntity` getters `getName()`, `getTiming()`, `getCaffeine()`.
- Produces: `PlacementEngine.place(PantryItemEntity item)` → `Placement(String slotKey, String source, String reasonHu, String restDayFallback)`; `PlacementEngine.dailyTotalHint(String name)` → `String|null`; port `StackPlacementLlm.complete(String systemPrompt, String userMessage)` → `String`. Flag constant `FeaturesConfiguration.STACK_PLACEMENT_LLM_SWITCH = "mezo.feature.stack-placement-llm.enabled"`.

- [ ] **Step 1: Port interface** (clone the `ScrapeLlm` javadoc rationale, consumer-owned per ADR 0012):

```java
package io.mrkuhne.mezo.feature.fuel.service;

/**
 * Consumer-owned LLM port (ADR 0012): fuel owns the interface, companion provides the adapter,
 * so feature/fuel never imports feature/companion. Used ONLY as the placement fallback for
 * supplements the deterministic rule table does not recognize (mezo-vx9v).
 */
public interface StackPlacementLlm {
    /** One-shot completion on the cheap chat tier. */
    String complete(String systemPrompt, String userMessage);
}
```

- [ ] **Step 2: Companion adapter** — mirror `PantryScrapeLlmAdapter` byte-for-byte in shape:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.fuel.service.StackPlacementLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Companion-side adapter for the fuel-owned {@link StackPlacementLlm} port (ADR 0012). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class StackPlacementLlmAdapter implements StackPlacementLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
```

- [ ] **Step 3: Flag** — `FeaturesConfiguration` (model the javadoc on `RECIPE_AI_SCORE_SWITCH` :46-49 — "gates ONLY the LLM fallback; the deterministic rule table stays on regardless; additionally needs COMPANION_SWITCH"):

```java
    /** mezo-vx9v — gates ONLY the LLM placement fallback for unknown supplements; the
     *  deterministic rule table runs regardless. The LLM path additionally needs
     *  COMPANION_SWITCH (the port adapter lives there); off/absent degrades to 'fallback'. */
    public static final String STACK_PLACEMENT_LLM_SWITCH = "mezo.feature.stack-placement-llm.enabled";
```

`application.yml` inside `mezo.feature:` right after the `fuel-settings:` entry:

```yaml
    # Stack placement LLM fallback (mezo-vx9v) — zone suggestion for supplements the rule
    # table does not know; needs the companion switch too (CompanionLlm bean), otherwise
    # placement degrades to the deterministic 'fallback' zone.
    stack-placement-llm:
      enabled: true
```

- [ ] **Step 4: Rule table** — plain constants class, ordered first-match-wins; needles are lowercase substrings of the pantry item NAME:

```java
package io.mrkuhne.mezo.feature.fuel.service;

import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** Deterministic placement rules (mezo-vx9v). Ordered — first matching rule wins. Needles are
 *  lowercase name substrings (accent-safe stems where possible). restDayFallback: zone key,
 *  "skip", or null (= keep the zone on rest days too). */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class PlacementRules {

    public record Rule(List<String> needles, String slotKey, String restDayFallback,
                       String reasonHu, String dailyTotalHintHu) {}

    public static final List<Rule> RULES = List.of(
        new Rule(List.of("kreatin", "creatine"), "wake", null,
            "Kreatin ébredés után vízben — étkezéstől független, a napi konzisztencia számít.",
            "ajánlott napi összmennyiség 15–20g — érdemes 3-4 bevételre osztani"),
        new Rule(List.of("kávé", "espresso", "koffein", "caffeine"), "wake", null,
            "Koffein a nap elején — bőven a 14:00-s cutoff előtt.", null),
        new Rule(List.of("pwo", "pre-workout", "pump", "aakg", "arginin",
                "béta-alanin", "beta-alanin", "betaalanin", "citrullin"), "pre_workout", "skip",
            "Pump-stack ~40 perccel edzés előtt — plazmacsúcs edzéskezdésre; pihenőnapon kimarad.", null),
        new Rule(List.of("whey", "protein", "fehérje"), "post_workout", "breakfast",
            "Fehérje az edzés utáni ablakban — pihenőnapon reggelihez.", null),
        new Rule(List.of("d3", "k2", "omega", "halolaj", "krill", "kurkum", "q10", "koenzim"),
            "lunch", null,
            "Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.", null),
        new Rule(List.of("magn", "magné"), "evening", null,
            "Magnézium este — GABA-moduláció, mélyalvás-támogatás, lefekvés előtt ~2 órával.", null),
        new Rule(List.of("zma", "melatonin", "glicin"), "bedtime", null,
            "Közvetlenül lefekvés előtt hat a legjobban.", null),
        new Rule(List.of("cink", "zinc"), "dinner", null,
            "Cink vacsorához — távol a reggeli koffeintől és ásványi interakcióktól.", null),
        new Rule(List.of("multivitamin", "vitamin"), "breakfast", null,
            "Reggelihez kötve — étellel kímélőbb, könnyű rutin.", null));

    /** Secondary signal: the pantry item's own timing hint → zone key (null = no mapping). */
    public static String zoneForTiming(String timing) {
        if (timing == null) return null;
        return switch (timing) {
            case "morning" -> "wake";
            case "midday" -> "lunch";
            case "evening" -> "evening";
            case "dinner" -> "dinner";
            case "pre-workout" -> "pre_workout";
            default -> timing.startsWith("weekly") ? "wake" : null;
        };
    }
}
```

- [ ] **Step 5: Engine** — deterministic → timing → LLM (flag + port present) → fallback:

```java
package io.mrkuhne.mezo.feature.fuel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.mrkuhne.mezo.feature.fuel.entity.StackZone;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
// LlmCallContext imports — copy exactly from ScrapeExtractionService
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value; // NOT used — see Environment note below
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

/** Zone assignment for stack occurrences (mezo-vx9v): rule table → pantry timing hint →
 *  LLM fallback (flag-gated, cached by the caller on the occurrence) → 'breakfast' fallback. */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlacementEngine {

    public record Placement(String slotKey, String source, String reasonHu, String restDayFallback) {}

    static final String FALLBACK_ZONE = "breakfast";
    static final String FALLBACK_REASON = "Bizonytalan besorolás — helyezd át, ha máskor szeded.";
    private static final String SYSTEM_PROMPT = """
        You classify a dietary supplement into ONE daily intake zone.
        Answer with STRICT JSON only: {"slotKey":"<zone>","reasonHu":"<one Hungarian sentence>"}
        Allowed slotKey values: wake, breakfast, pre_workout, post_workout, lunch, dinner, evening, bedtime.
        The reason must be one short Hungarian sentence explaining why that zone is optimal.""";

    private final ObjectProvider<StackPlacementLlm> llm;
    private final Environment environment;              // flag read — @Value is banned
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;  // same bean ScrapeExtractionService uses

    public Placement place(PantryItemEntity item) {
        String name = item.getName() == null ? "" : item.getName().toLowerCase();
        for (PlacementRules.Rule rule : PlacementRules.RULES) {
            if (rule.needles().stream().anyMatch(name::contains)) {
                return new Placement(rule.slotKey(), "rule", rule.reasonHu(), rule.restDayFallback());
            }
        }
        String timingZone = PlacementRules.zoneForTiming(item.getTiming());
        if (timingZone != null) {
            return new Placement(timingZone, "rule",
                "A Kamra-item ajánlott időzítése alapján.", null);
        }
        return llmPlacement(item).orElseGet(
            () -> new Placement(FALLBACK_ZONE, "fallback", FALLBACK_REASON, null));
    }

    /** Rule-table daily-total hint for the item panel (not persisted — derived per read). */
    public String dailyTotalHint(String itemName) {
        String name = itemName == null ? "" : itemName.toLowerCase();
        return PlacementRules.RULES.stream()
            .filter(r -> r.needles().stream().anyMatch(name::contains))
            .map(PlacementRules.Rule::dailyTotalHintHu)
            .filter(h -> h != null)
            .findFirst().orElse(null);
    }

    private java.util.Optional<Placement> llmPlacement(PantryItemEntity item) {
        boolean enabled = Boolean.parseBoolean(
            environment.getProperty(FeaturesConfiguration.STACK_PLACEMENT_LLM_SWITCH, "false"));
        StackPlacementLlm port = llm.getIfAvailable();
        if (!enabled || port == null) return java.util.Optional.empty();
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("stack_placement", "place", null, null),
                () -> port.complete(SYSTEM_PROMPT, item.getName()));
            String json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
            JsonNode node = objectMapper.readTree(json);
            String slotKey = node.path("slotKey").asText();
            StackZone.fromKey(slotKey); // validates — throws on junk
            String reason = node.path("reasonHu").asText(FALLBACK_REASON);
            return java.util.Optional.of(new Placement(slotKey, "llm", reason, null));
        } catch (Exception e) {
            log.warn("Stack placement LLM fallback failed for '{}': {}", item.getName(), e.getMessage());
            return java.util.Optional.empty();
        }
    }
}
```

**Adaptation notes for the implementer:** (a) copy the exact `LlmCallContextHolder`/`LlmCallContext` types + import paths from `feature/pantry/service/ScrapeExtractionService.java` — the class/ctor shape there is authoritative; (b) if `configuration_conventions.md` forbids `Environment` reads too, replace with a one-field `@Validated @ConfigurationProperties(prefix="mezo.feature.stack-placement-llm") record StackPlacementLlmProperties(boolean enabled)` in `feature/fuel/config` and inject that instead — pick whichever idiom `RecipeBreakdownService` (the recipe-ai-score analog) already uses; (c) delete the unused `@Value` import line.

- [ ] **Step 6: Write `PlacementEngineIT`** (service-level, `@Transactional`, extends `AbstractIntegrationTest`; companion off in test profile → port absent):

```java
package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.fuel.service.PlacementEngine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class PlacementEngineIT extends AbstractIntegrationTest {

    @Autowired PlacementEngine engine;
    @Autowired PantryItemPopulator pantryPop;
    @Autowired io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;

    private PantryItemEntity supplement(String name) {
        UUID owner = databasePopulator.populateUser("a@test.local");
        return pantryPop.createSupplement(owner, name);
    }

    @Test
    void testPlace_shouldPlaceByRuleTable_whenNameMatchesNeedle() {
        PlacementEngine.Placement p = engine.place(supplement("Kreatin monohidrát"));
        assertThat(p.slotKey()).isEqualTo("wake");
        assertThat(p.source()).isEqualTo("rule");
        assertThat(p.reasonHu()).isNotBlank();
    }

    @Test
    void testPlace_shouldMarkRestDaySkip_whenPreWorkoutStimulant() {
        PlacementEngine.Placement p = engine.place(supplement("Origin PWO"));
        assertThat(p.slotKey()).isEqualTo("pre_workout");
        assertThat(p.restDayFallback()).isEqualTo("skip");
    }

    @Test
    void testPlace_shouldFallBack_whenUnknownItemAndLlmUnavailable() {
        // companion switch is off in ITs → port bean absent → deterministic fallback
        PlacementEngine.Placement p = engine.place(supplement("Rejtélyes gyógynövény X"));
        assertThat(p.slotKey()).isEqualTo("breakfast");
        assertThat(p.source()).isEqualTo("fallback");
    }

    @Test
    void testDailyTotalHint_shouldReturnHint_whenRuleCarriesOne() {
        assertThat(engine.dailyTotalHint("Kreatin monohidrát")).contains("15–20g");
        assertThat(engine.dailyTotalHint("Omega-3")).isNull();
    }
}
```

Check first how ITs set the companion switch (grep `mezo.feature.companion` under `backend/src/test/resources/`); if it is ON by default in the IT profile, add `@TestPropertySource(properties = "mezo.feature.companion.enabled=false")` to the class. Note: `createSupplement` populator sets no timing — verify with a read; if it sets `timing`, pick an unknown-name fixture whose timing is also null (extend the populator with `createSupplement(owner, name, timing)` overload if needed).

- [ ] **Step 7: Run** — `./mvnw clean test -Dtest=PlacementEngineIT -Dsurefire.failIfNoSpecifiedTests=false` → PASS.

- [ ] **Step 8: Commit** — `feat(fuel): placement engine with rule table + LLM fallback port (mezo-vx9v)`

---

### Task 4: Contract (additive) + ProtocolService occurrence ops + controller + ITs

**Files:**
- Modify: `api/feature/fuel/fuel.yml`
- Modify (generated, commit them): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/service/ProtocolService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/controller/FuelController.java`
- Modify: `backend/src/main/resources/messages.properties`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/FuelApiIT.java`, `ProtocolServiceIT.java`

**Interfaces:**
- Consumes: `PlacementEngine.place(PantryItemEntity)` / `.dailyTotalHint(String)` (Task 3), entity fields (Task 2).
- Produces (wire, additive — `activateProtocol` stays for now): schema `ProtocolItemResponse {id, pantryItemId, slotKey, dose?, pinned, placementSource, placementReason?, restDayFallback?, dailyTotalHint?}`; `ProtocolResponse` gains OPTIONAL `items: ProtocolItemResponse[]`; endpoints `POST /api/fuel/protocol/items` (operationId `addProtocolItem`, 201), `PATCH /api/fuel/protocol/items/{id}` (`patchProtocolItem`, 200), `DELETE /api/fuel/protocol/items/{id}` (`deleteProtocolItem`, 204). Java: `ProtocolService.addItem(UUID userId, ProtocolItemCreateRequest)`, `patchItem(UUID userId, UUID id, ProtocolItemPatchRequest)`, `deleteItem(UUID userId, UUID id)`, and `getView` now populates `items` (lazy slot_key backfill). Error code `FUEL_PROTOCOL_ITEM_DUPLICATE` (409).

- [ ] **Step 1: Extend `fuel.yml`.** Add paths (keep the existing ones untouched):

```yaml
  /api/fuel/protocol/items:
    post:
      tags: [Fuel]
      operationId: addProtocolItem
      summary: Add an occurrence to the living protocol (engine places it when slotKey omitted)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/ProtocolItemCreateRequest' } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/ProtocolItemResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Pantry item not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: Duplicate occurrence in that zone, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/fuel/protocol/items/{id}:
    patch:
      tags: [Fuel]
      operationId: patchProtocolItem
      summary: Move (pin), re-dose or unpin (engine re-places) one occurrence
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/ProtocolItemPatchRequest' } } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/ProtocolItemResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: Duplicate occurrence in that zone, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    delete:
      tags: [Fuel]
      operationId: deleteProtocolItem
      summary: Remove one occurrence (soft delete)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

Schemas (`pattern` over `enum` per `api_contract_conventions.md` — invalid enum would 500):

```yaml
    ProtocolItemResponse:
      type: object
      required: [id, pantryItemId, slotKey, pinned, placementSource]
      properties:
        id: { type: string, format: uuid }
        pantryItemId: { type: string, format: uuid }
        slotKey: { type: string }
        dose: { type: string }
        pinned: { type: boolean }
        placementSource: { type: string, enum: [rule, llm, user, fallback] }
        placementReason: { type: string }
        restDayFallback: { type: string, description: "'skip' or a zone key; absent = FE default" }
        dailyTotalHint: { type: string, description: 'Rule-table daily-total hint (derived, not stored)' }
    ProtocolItemCreateRequest:
      type: object
      required: [pantryItemId]
      properties:
        pantryItemId: { type: string, format: uuid }
        slotKey: { type: string, pattern: '^(wake|breakfast|pre_workout|post_workout|lunch|dinner|evening|bedtime)$' }
        dose: { type: string, maxLength: 60 }
    ProtocolItemPatchRequest:
      type: object
      properties:
        slotKey: { type: string, pattern: '^(wake|breakfast|pre_workout|post_workout|lunch|dinner|evening|bedtime)$' }
        dose: { type: string, maxLength: 60 }
        pinned: { type: boolean, description: 'false = unpin, the engine re-places; true only alongside slotKey' }
```

And on `ProtocolResponse.properties` add (NOT in `required` yet — Task 10 tightens):

```yaml
        items: { type: array, items: { $ref: '#/components/schemas/ProtocolItemResponse' } }
```

- [ ] **Step 2: Regenerate** — `cd api/generate && npm run generate:api`, then `cd ../../frontend && pnpm generate:api`. Commit both outputs with this task.

- [ ] **Step 3: `messages.properties`** — add under the fuel-adjacent block (`{DOMAIN}_{ACTION}_{REASON}` convention):

```properties
FUEL_PROTOCOL_ITEM_DUPLICATE=This supplement already has an intake in that zone.
```

- [ ] **Step 4: Rework `ProtocolService`.** Keep `activate` untouched (dies in Task 10). Add:

```java
    // --- occurrence ops (mezo-vx9v living protocol) ---

    /** The single living protocol row — created on first write, version-bumped on every mutation. */
    private ProtocolEntity ensureActive(UUID userId) {
        return protocolRepository.findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE)
            .orElseGet(() -> {
                ProtocolEntity p = new ProtocolEntity();
                p.setVersion(protocolRepository.maxVersion(userId) + 1);
                p.setBuiltAt(Instant.now());
                p.setStatus(STATUS_ACTIVE);
                p.setConfidence(properties.defaultConfidence());
                return protocolRepository.saveAndFlush(p);
            });
    }

    private void touch(ProtocolEntity protocol) {
        protocol.setVersion(protocol.getVersion() + 1);
        protocol.setBuiltAt(Instant.now());
    }

    @Transactional
    public ProtocolItemResponse addItem(UUID userId, ProtocolItemCreateRequest request) {
        PantryItemEntity pantryItem = requireOwnedSupplement(userId, request.getPantryItemId());
        ProtocolEntity protocol = ensureActive(userId);
        String slotKey;
        String source;
        String reason;
        String restDay;
        boolean pinned;
        if (request.getSlotKey() != null) {
            slotKey = request.getSlotKey(); source = "user"; pinned = true;
            reason = "Kézzel ide helyezve."; restDay = null;
        } else {
            PlacementEngine.Placement placement = placementEngine.place(pantryItem);
            slotKey = placement.slotKey(); source = placement.source(); pinned = false;
            reason = placement.reasonHu(); restDay = placement.restDayFallback();
        }
        rejectDuplicate(protocol.getId(), pantryItem.getId(), slotKey);
        ProtocolItemEntity item = new ProtocolItemEntity();
        item.setProtocolId(protocol.getId());
        item.setPantryItemId(pantryItem.getId());
        item.setItemOrder(nextItemOrder(protocol.getId()));
        item.setSlotKey(slotKey);
        item.setDose(request.getDose());
        item.setPinned(pinned);
        item.setPlacementSource(source);
        item.setPlacementReason(reason);
        item.setRestDayFallback(restDay);
        protocolItemRepository.save(item);
        touch(protocol);
        return toItemResponse(item, pantryItem.getName());
    }

    @Transactional
    public ProtocolItemResponse patchItem(UUID userId, UUID id, ProtocolItemPatchRequest request) {
        ProtocolEntity protocol = requireActiveOwned(userId);          // 404 when none
        ProtocolItemEntity item = requireItem(protocol.getId(), id);   // 404 when not in protocol
        if (Boolean.FALSE.equals(request.getPinned()) && request.getSlotKey() != null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "pinned").build(), HttpStatus.BAD_REQUEST);
        }
        if (request.getSlotKey() != null) {                            // manual move = pin
            rejectDuplicate(protocol.getId(), item.getPantryItemId(), request.getSlotKey());
            item.setSlotKey(request.getSlotKey());
            item.setPinned(true);
            item.setPlacementSource("user");
            item.setPlacementReason("Kézzel ide helyezve.");
            item.setRestDayFallback(null);
        }
        if (Boolean.FALSE.equals(request.getPinned())) {               // unpin → engine re-places
            PantryItemEntity pantryItem = requireOwnedSupplement(userId, item.getPantryItemId());
            PlacementEngine.Placement placement = placementEngine.place(pantryItem);
            rejectDuplicateExcept(protocol.getId(), item.getPantryItemId(), placement.slotKey(), item.getId());
            item.setSlotKey(placement.slotKey());
            item.setPinned(false);
            item.setPlacementSource(placement.source());
            item.setPlacementReason(placement.reasonHu());
            item.setRestDayFallback(placement.restDayFallback());
        }
        if (request.getDose() != null) item.setDose(request.getDose());
        touch(protocol);
        return toItemResponse(item, pantryName(item.getPantryItemId()));
    }

    @Transactional
    public void deleteItem(UUID userId, UUID id) {
        ProtocolEntity protocol = requireActiveOwned(userId);
        ProtocolItemEntity item = requireItem(protocol.getId(), id);
        protocolItemRepository.delete(item);   // soft via @SQLDelete
        touch(protocol);
    }

    private void rejectDuplicate(UUID protocolId, UUID pantryItemId, String slotKey) {
        rejectDuplicateExcept(protocolId, pantryItemId, slotKey, null);
    }

    private void rejectDuplicateExcept(UUID protocolId, UUID pantryItemId, String slotKey, UUID exceptId) {
        protocolItemRepository
            .findByProtocolIdAndPantryItemIdAndSlotKeyAndDeletedFalse(protocolId, pantryItemId, slotKey)
            .filter(existing -> !existing.getId().equals(exceptId))
            .ifPresent(existing -> {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("FUEL_PROTOCOL_ITEM_DUPLICATE").build(), HttpStatus.CONFLICT);
            });
    }
```

Supporting privates to add in the same edit: `requireOwnedSupplement(userId, pantryItemId)` (owner-scoped pantry lookup, 404 `RESOURCE_NOT_FOUND`; reject `kind=food` with 400 field error — copy the two checks from the existing `activate` body), `requireActiveOwned(userId)` (active protocol or 404 `RESOURCE_NOT_FOUND`), `requireItem(protocolId, id)` (item lookup filtered to that protocol, 404), `nextItemOrder(protocolId)` (existing items size), `pantryName(UUID)` (owner-scoped name lookup for the response), `toItemResponse(ProtocolItemEntity, String name)` builder:

```java
    private ProtocolItemResponse toItemResponse(ProtocolItemEntity item, String pantryItemName) {
        return ProtocolItemResponse.builder()
            .id(item.getId())
            .pantryItemId(item.getPantryItemId())
            .slotKey(item.getSlotKey())
            .dose(item.getDose())
            .pinned(item.isPinned())
            .placementSource(ProtocolItemResponse.PlacementSourceEnum.fromValue(item.getPlacementSource()))
            .placementReason(item.getPlacementReason())
            .restDayFallback(item.getRestDayFallback())
            .dailyTotalHint(placementEngine.dailyTotalHint(pantryItemName))
            .build();
    }
```

**`getView` extension (lazy backfill):** make `getView` `@Transactional`; when composing the active `ProtocolResponse`, load items via `findByProtocolIdAndDeletedFalseOrderByItemOrderAsc`, and for every item with `slotKey == null` run `placementEngine.place(pantryItem)` + persist the placement fields (this migrates pre-vx9v rows on first read). Sort the response items by `StackZone.fromKey(slotKey).order()` then `itemOrder`, and set both `items` and the legacy `selectedPantryItemIds` (distinct pantry ids, until Task 10 removes it). Add `PlacementEngine` and (if not present) the pantry repository to the service's `@RequiredArgsConstructor` deps.

- [ ] **Step 5: Controller** — add to `FuelController` (one-liners like the rest):

```java
    @Override
    public ProtocolItemResponse addProtocolItem(ProtocolItemCreateRequest request) {
        return protocolService.addItem(currentUserId.get(), request);
    }

    @Override
    public ProtocolItemResponse patchProtocolItem(UUID id, ProtocolItemPatchRequest request) {
        return protocolService.patchItem(currentUserId.get(), id, request);
    }

    @Override
    public void deleteProtocolItem(UUID id) {
        protocolService.deleteItem(currentUserId.get(), id);
    }
```

- [ ] **Step 6: Check the companion `get_protocol` tool** — `grep -rn "ProtocolService\|ProtocolResponse\|selectedPantryItemIds" backend/src/main/java/io/mrkuhne/mezo/feature/companion/`. If the tool renders the selection, keep it compiling (it may read `selectedPantryItemIds` until Task 10; note any needed Task-10 follow-up in the bd issue notes).

- [ ] **Step 7: ITs.** Extend `FuelApiIT` (API-level) with:

```java
    @Test
    void testAddProtocolItem_shouldEnginePlaceAndPersist_whenSlotKeyOmitted() {
        UUID owner = ownerId();
        var kreatin = pantryPop.createSupplement(owner, "Kreatin monohidrát");
        HttpHeaders auth = ownerAuthHeaders();
        ProtocolItemResponse created = postForBody("/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(kreatin.getId()),
            auth, HttpStatus.CREATED, ProtocolItemResponse.class);
        assertThat(created.getSlotKey()).isEqualTo("wake");
        assertThat(created.getPinned()).isFalse();
        assertThat(created.getPlacementSource()).hasToString("rule");
        assertThat(created.getDailyTotalHint()).contains("15–20g");
        ProtocolViewResponse view = getForBody("/api/fuel/protocol", auth, HttpStatus.OK, ProtocolViewResponse.class);
        assertThat(view.getActive().getItems()).hasSize(1);
    }

    @Test
    void testAddProtocolItem_shouldPinUserPlacement_whenSlotKeyGiven() { /* slotKey "evening" →
        pinned=true, placementSource user; assert 201 body fields */ }

    @Test
    void testAddProtocolItem_shouldReturn409_whenDuplicateZoneOccurrence() {
        // add kreatin twice without slotKey → second lands on 'wake' again
        // exchangeForResponse(POST …) → assertHasRequestError(body, "FUEL_PROTOCOL_ITEM_DUPLICATE")
    }

    @Test
    void testPatchProtocolItem_shouldMoveAndPin_whenSlotKeyPatched() { /* PATCH {slotKey:"lunch"} →
        200, pinned true, source user */ }

    @Test
    void testPatchProtocolItem_shouldReplaceViaEngine_whenUnpinned() { /* pinned kreatin at lunch,
        PATCH {pinned:false} → slotKey back to "wake", source rule */ }

    @Test
    void testDeleteProtocolItem_shouldSoftDelete_whenOwned() { /* DELETE → 204, view items empty */ }

    @Test
    void testGetProtocol_shouldBackfillLegacyItems_whenSlotKeyNull() {
        // seed via protocolPopulator.createProtocol(owner, 1, "active", List.of(kreatin.getId()))
        // (legacy shape, slot_key null) → GET /api/fuel/protocol → items[0].slotKey == "wake",
        // placementSource "rule" — and a second GET returns the same (persisted, not re-derived)
    }
```

Write each sketched body out fully (the populators + verb helpers make each ~8 lines). Add the `@Autowired ProtocolPopulator protocolPopulator;` field. Keep every existing activate/intake test green.

- [ ] **Step 8: Run** — `./mvnw clean test -Dtest=FuelApiIT,ProtocolServiceIT,PlacementEngineIT,ProtocolSeedDataIT -Dsurefire.failIfNoSpecifiedTests=false` → PASS. Also `cd frontend && pnpm build` (additive types must not break FE).

- [ ] **Step 9: Commit** — `feat(fuel): occurrence CRUD endpoints + living protocol service (mezo-vx9v)`

---

### Task 5: FE data layer — occurrence types, API client, stackHooks rework

**Files:**
- Modify: `frontend/src/data/types.ts` (add occurrence types; keep `Protocol` as-is)
- Create: `frontend/src/data/fuel/stackZones.ts`
- Modify: `frontend/src/data/fuel/fuelApi.ts`
- Modify: `frontend/src/data/fuel/fuel.ts` (mock occurrence seed)
- Modify: `frontend/src/data/fuel/stackHooks.ts` + `frontend/src/data/fuel/stackHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts` (barrel: export `useIntakes`; keep existing stack exports)

**Interfaces:**
- Consumes: generated types from `api.gen.ts` (Task 4): `ProtocolItemResponse`, `ProtocolItemCreateRequest`, `ProtocolItemPatchRequest`.
- Produces (used by Tasks 6-9):

```ts
// types.ts
export type StackZoneKey = 'wake'|'breakfast'|'pre_workout'|'post_workout'|'lunch'|'dinner'|'evening'|'bedtime'
export type StackPlacementSource = 'rule'|'llm'|'user'|'fallback'
export interface ProtocolOccurrence {
  id: string; pantryItemId: string; slotKey: StackZoneKey
  dose: string | null; pinned: boolean
  placementSource: StackPlacementSource; placementReason: string | null
  restDayFallback: StackZoneKey | 'skip' | null; dailyTotalHint: string | null
}
// stackZones.ts
export const STACK_ZONE_ORDER: StackZoneKey[]                     // canonical render order
export const STACK_ZONE_LABEL: Record<StackZoneKey, string>      // HU labels
// stackHooks.ts
useProtocol(): { protocol: Protocol; occurrences: ProtocolOccurrence[] }
useProtocolActions(): {
  addItem: (pantryItemId: string, opts?: { slotKey?: StackZoneKey; dose?: string }) => Promise<void>
  moveItem: (id: string, slotKey: StackZoneKey) => Promise<void>
  setDose: (id: string, dose: string) => Promise<void>
  unpinItem: (id: string) => Promise<void>
  removeItem: (id: string) => Promise<void>
  removeAllFor: (pantryItemId: string) => Promise<void>
}
useStackActions(date?): {
  logIntake: (pantryItemId: string, slotKey: StackZoneKey, dose?: string | null) => void
  undoIntake: (pantryItemId: string, slotKey: StackZoneKey) => void
}
useIntakes(date: string): Intake[]        // now barrel-exported
```

- [ ] **Step 1: Types + zones.** Add the types above to `types.ts` (near the existing `Protocol` at :183). Create `stackZones.ts`:

```ts
import type { StackZoneKey } from '@/data/types'

/** Canonical zone order + HU labels (mezo-vx9v). Keys are the wire contract — never rename. */
export const STACK_ZONE_ORDER: StackZoneKey[] = [
  'wake', 'breakfast', 'pre_workout', 'post_workout', 'lunch', 'dinner', 'evening', 'bedtime',
]
export const STACK_ZONE_LABEL: Record<StackZoneKey, string> = {
  wake: 'Ébredés', breakfast: 'Reggeli', pre_workout: 'Edzés előtt', post_workout: 'Edzés után',
  lunch: 'Ebéd', dinner: 'Vacsora', evening: 'Este', bedtime: 'Lefekvés',
}
```

- [ ] **Step 2: `fuelApi.ts`.** Alias the three new generated schemas; extend `ProtocolView` to `{ protocol: Protocol | null; occurrences: ProtocolOccurrence[] }` (drop `selectedIds` — grep confirms only `stackHooks.ts` + `FuelStackPage.tsx` consume it; the page is reworked in Task 8, keep it compiling until then by leaving a deprecated `selectedIds: string[] | null` field populated from `items.map(i => i.pantryItemId)` — Task 8 deletes it). Map in `fromProtocolView`: `occurrences = (a.items ?? []).map(fromItem)` with

```ts
function fromItem(r: ProtocolItemResponse): ProtocolOccurrence {
  return {
    id: r.id, pantryItemId: r.pantryItemId, slotKey: r.slotKey as StackZoneKey,
    dose: r.dose ?? null, pinned: r.pinned,
    placementSource: r.placementSource as StackPlacementSource,
    placementReason: r.placementReason ?? null,
    restDayFallback: (r.restDayFallback ?? null) as ProtocolOccurrence['restDayFallback'],
    dailyTotalHint: r.dailyTotalHint ?? null,
  }
}
```

New client functions on `fuelApi` (each `satisfies` its request type): `addProtocolItem(body)` POST `/api/fuel/protocol/items` → `fromItem`; `patchProtocolItem(id, body)` PATCH `/api/fuel/protocol/items/{id}` → `fromItem`; `deleteProtocolItem(id)` DELETE → void. `logIntake` now forwards `slotKey`.

- [ ] **Step 3: Mock seed** in `fuel.ts` — occurrence per non-medication stash item, ids `occ-<stashId>`:

```ts
export const protocolOccurrences: ProtocolOccurrence[] = [
  occ('kreatin', 'wake', 'rule', 'Kreatin ébredés után vízben — a napi konzisztencia számít.',
      'ajánlott napi összmennyiség 15–20g — érdemes 3-4 bevételre osztani'),
  occ('kohi', 'wake', 'rule', 'Koffein a nap elején — bőven a 14:00-s cutoff előtt.'),
  occ('tastydose', 'wake', 'rule', 'Koffein a nap elején — bőven a 14:00-s cutoff előtt.'),
  occ('origin-pwo', 'pre_workout', 'rule',
      'Pump-stack ~40 perccel edzés előtt — plazmacsúcs edzéskezdésre; pihenőnapon kimarad.', null, 'skip'),
  occ('whey', 'post_workout', 'rule', 'Fehérje az edzés utáni ablakban — pihenőnapon reggelihez.', null, 'breakfast'),
  occ('d3k2', 'lunch', 'rule', 'Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.'),
  occ('omega3', 'lunch', 'rule', 'Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.'),
  occ('magnez', 'evening', 'rule', 'Magnézium este — GABA-moduláció, mélyalvás-támogatás.'),
]
```

with a local `occ(refId, slotKey, source, reason, hint = null, restDay = null)` helper producing full `ProtocolOccurrence` objects (`id: 'occ-'+refId`, `dose: null`, `pinned: false`). Also export `mockPlaceOccurrence(item: SupplementStashItem): Pick<ProtocolOccurrence,'slotKey'|'placementSource'|'placementReason'>` mirroring the backend's timing-hint pass (`morning→wake, midday→lunch, evening→evening, dinner→dinner, pre-workout→pre_workout, weekly*→wake`, else `breakfast`/`fallback`) — the mock `addItem` uses it.

- [ ] **Step 4: Rework `stackHooks.ts`.**
  - `mockView` becomes `{ protocol: protocolSeed, occurrences: protocolOccurrences }`; `EMPTY_VIEW`/ghost keep `occurrences: []`.
  - `useProtocol()` returns `{ protocol, occurrences }`.
  - `useProtocolActions()` implements the six actions. Real mode: call the new `fuelApi` fns then `qc.invalidateQueries({ queryKey: PROTOCOL_KEY })`. Mock mode: `setQueryData(PROTOCOL_KEY, …)` mutators — `mockAddOccurrence` (uses `mockPlaceOccurrence`, or `{slotKey, source:'user', pinned:true}` when opts.slotKey given; duplicate zone+item → no-op), `mockPatchOccurrence`, `mockRemoveOccurrence`. `removeAllFor` maps over matching occurrence ids → `removeItem` each. `unpinItem` in mock re-runs `mockPlaceOccurrence`.
  - `useStackActions(date)`: `logIntake(pantryItemId, slotKey, dose?)` POSTs with slotKey (mock: add `{id: 'intake-'+pantryItemId+'-'+slotKey, pantryItemId, slotKey, …}` row); `undoIntake(pantryItemId, slotKey)` finds the day's intake by pantryItemId+slotKey — falling back to a null-slotKey legacy row for that item — then deletes.
  - Delete `useStackContext` and its seeds/imports (`userSeed`, `mesoSeed`) — Task 8 removes the page usage, but the page still imports it until then, so instead: keep `useStackContext` exported UNCHANGED in this task; Task 8 deletes it. (Keeps every commit compiling.)
  - `applyProtocol`/`mockActivate`: leave in place (page still calls it until Task 8; Task 10 deletes the endpoint).
- [ ] **Step 5: Barrel** — in `data/hooks.ts:22` add `useIntakes` to the stackHooks export list.

- [ ] **Step 6: Tests** — extend `stackHooks.test.tsx` (keep the sharedWrapper + `vi.stubEnv` mode pattern):
  - mock: `useProtocol` returns the 8 seed occurrences; `addItem('magnez', {slotKey:'lunch'})` adds a pinned user occurrence; `addItem` for a `timing:'morning'` item lands on `wake`; `moveItem` pins; `unpinItem` restores the mock placement; `removeAllFor('d3k2')` empties d3k2 occurrences; `logIntake('magnez','evening')` + `undoIntake` round-trip keyed by slotKey.
  - real: MSW handlers for `POST/PATCH/DELETE /api/fuel/protocol/items*` capturing bodies — assert `addItem` posts `{pantryItemId}`, `moveItem` patches `{slotKey}`, `unpinItem` patches `{pinned:false}`, and each action invalidates `['protocol']` (spy on `qc.invalidateQueries`); `useProtocol` unresolved → ghost with `occurrences: []`.

- [ ] **Step 7: Run** — `cd frontend && pnpm test src/data/fuel/stackHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/fuel/stackHooks.test.tsx && pnpm build` → PASS (build catches barrel/import breakage; `hooks.reexport.test.ts` may need the new `useIntakes` line).

- [ ] **Step 8: Commit** — `feat(fuel): occurrence-based stack data layer (mezo-vx9v)`

---

### Task 6: `projectStackDay` — pure day projection

**Files:**
- Create: `frontend/src/features/fuel/logic/projectStackDay.ts`
- Create: `frontend/src/features/fuel/logic/projectStackDay.test.ts`
- Modify: `frontend/src/features/fuel/logic/buildProtocol.ts` (export `PRE_WORKOUT_STACK_LEAD_MIN`)

**Interfaces:**
- Consumes: `ProtocolOccurrence`, `StackZoneKey` (Task 5), `STACK_ZONE_ORDER`/`STACK_ZONE_LABEL` from `@/data/fuel/stackZones`, `placeWindows` + `PlannerBlock` from `@/features/fuel/logic/buildDayPlan`, `toMin`/`toHHmm` from `@/data/fuel/fuelConfig`, `SupplementStashItem`, `Intake`.
- Produces:

```ts
export interface StackDayEntry {
  occurrenceId: string; pantryItemId: string; persistedZone: StackZoneKey
  name: string; dose: string | null; pinned: boolean
  placementSource: StackPlacementSource; reason: string | null
  dailyTotalHint: string | null
  skippedToday: boolean       // rest-day 'skip' — render greyed, tick disabled
  displacedToday: boolean     // rest-day fallback move — badge 'ma nincs edzés'
  taken: boolean
}
export interface StackDaySlot {
  zone: StackZoneKey; time: string; label: string; anchorNote: string | null
  entries: StackDayEntry[]
}
export interface StackDayInput {
  occurrences: ProtocolOccurrence[]; stash: SupplementStashItem[]; intakes: Intake[]
  wake: string; bed: string; mealsPerDay: number; blocks: PlannerBlock[]
}
export function projectStackDay(input: StackDayInput): StackDaySlot[]
export function resolveTakenKeys(intakes: Intake[], occurrences: ProtocolOccurrence[]): Set<string> // '<pantryItemId>|<zone>'
```

- [ ] **Step 1: Export the lead constant** — in `buildProtocol.ts:27` change `const` to `export const PRE_WORKOUT_STACK_LEAD_MIN = 40` (single canonical offset, now importable).

- [ ] **Step 2: Write the failing tests** — `projectStackDay.test.ts`, pure (no React). Cover:

```ts
const stashLite = (id: string, name: string, dose = '5g'): SupplementStashItem => ({ /* minimal literal
  matching the interface — copy the shape from data/fuel/fuel.ts seed items */ })
const occ = (over: Partial<ProtocolOccurrence>): ProtocolOccurrence => ({
  id: 'o1', pantryItemId: 'kreatin', slotKey: 'wake', dose: null, pinned: false,
  placementSource: 'rule', placementReason: null, restDayFallback: null, dailyTotalHint: null, ...over })

// 1. training day: pre_workout zone time = first block − 40 (block 17:30 → '16:50');
//    post_workout = block end + 30 (durationMin 60 → '19:00'); wake/evening/bedtime from anchors
//    (wake '05:50'; bed '23:00' → evening '21:00', bedtime '22:30'); breakfast/lunch/dinner from
//    placeWindows(wake, bed, 4, blocks) rounded to HH:mm
// 2. zones render in STACK_ZONE_ORDER and empty zones are dropped
// 3. rest day (blocks []): restDayFallback 'skip' → entry lands in 'breakfast' with
//    skippedToday=true; whey (restDayFallback 'breakfast') → displacedToday=true in breakfast;
//    null fallback on a pre_workout pin → default 'breakfast'; post_workout default → 'lunch';
//    persistedZone stays the original zone on every displaced/skipped entry
// 4. dose falls back stash dose when occurrence dose null; occurrence dose wins otherwise
// 5. taken: intake with slotKey 'wake' ticks only the wake occurrence; legacy null-slotKey intake
//    ticks the FIRST zone-ordered occurrence of that item (resolveTakenKeys unit-cases too)
```

Run: `pnpm test src/features/fuel/logic/projectStackDay.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement.** Algorithm:

```ts
export function projectStackDay(input: StackDayInput): StackDaySlot[] {
  const { occurrences, stash, intakes, wake, bed, mealsPerDay, blocks } = input
  const hasTraining = blocks.length > 0
  const sorted = [...blocks].sort((a, b) => toMin(a.time) - toMin(b.time))
  const first = sorted[0]
  const windows = placeWindows(wake, bed, mealsPerDay, blocks)
  const windowTime = (slot: 'breakfast'|'lunch'|'dinner') => {
    const w = windows.find(x => x.slotKey === slot && x.kind === 'meal')
    return w ? toHHmm(Math.round(w.time)) : null
  }
  const zoneTime: Record<StackZoneKey, string | null> = {
    wake,
    breakfast: windowTime('breakfast') ?? toHHmm(toMin(wake) + 45),
    pre_workout: first ? toHHmm(toMin(first.time) - PRE_WORKOUT_STACK_LEAD_MIN) : null,
    post_workout: first ? toHHmm(toMin(first.time) + (first.durationMin ?? 60) + 30) : null,
    lunch: windowTime('lunch') ?? '12:30',
    dinner: windowTime('dinner') ?? toHHmm(toMin(bed) - 240),
    evening: toHHmm(toMin(bed) - 120),
    bedtime: toHHmm(toMin(bed) - 30),
  }
  const anchorNote: Record<StackZoneKey, string | null> = {
    wake: null, breakfast: 'étkezéshez kötve',
    pre_workout: `edzés −${PRE_WORKOUT_STACK_LEAD_MIN}p`, post_workout: 'edzés +30p',
    lunch: 'étkezéshez kötve', dinner: 'étkezéshez kötve',
    evening: 'lefekvés −2h', bedtime: 'lefekvés −30p',
  }
  const takenKeys = resolveTakenKeys(intakes, occurrences)
  const byZone = new Map<StackZoneKey, StackDayEntry[]>()
  for (const o of occurrences) {
    const item = stash.find(s => s.id === o.pantryItemId)
    let zone = o.slotKey
    let skipped = false
    let displaced = false
    const trainingZone = o.slotKey === 'pre_workout' || o.slotKey === 'post_workout'
    if (!hasTraining && trainingZone) {
      const fb = o.restDayFallback ?? (o.slotKey === 'pre_workout' ? 'breakfast' : 'lunch')
      if (fb === 'skip') { zone = o.slotKey === 'pre_workout' ? 'breakfast' : 'lunch'; skipped = true }
      else { zone = fb; displaced = true }
    }
    const entry: StackDayEntry = {
      occurrenceId: o.id, pantryItemId: o.pantryItemId, persistedZone: o.slotKey,
      name: item?.name ?? '(törölt Kamra-item)', dose: o.dose ?? item?.dose ?? null,
      pinned: o.pinned, placementSource: o.placementSource, reason: o.placementReason,
      dailyTotalHint: o.dailyTotalHint,
      skippedToday: skipped, displacedToday: displaced,
      taken: !skipped && takenKeys.has(`${o.pantryItemId}|${o.slotKey}`),
    }
    const list = byZone.get(zone) ?? []
    list.push(entry)
    byZone.set(zone, list)
  }
  return STACK_ZONE_ORDER
    .filter(z => byZone.has(z) && zoneTime[z] != null)
    .map(z => ({ zone: z, time: zoneTime[z] as string, label: STACK_ZONE_LABEL[z],
                 anchorNote: anchorNote[z], entries: byZone.get(z) as StackDayEntry[] }))
}
```

`resolveTakenKeys`: seed a `Set` from intakes with a `slotKey`; then for each legacy (null-slotKey) intake, find that item's first zone-ordered occurrence whose key isn't in the set yet and add it. Check `placeWindows`'s exact signature/window labels in `buildDayPlan.ts:157` before coding the `windowTime` matcher (labels are HU — match on `slotKey`, not label).

- [ ] **Step 4: Run tests** → PASS. Also `pnpm build`.

- [ ] **Step 5: Commit** — `feat(fuel): projectStackDay pure day projection (mezo-vx9v)`

---

### Task 7: `matchMealsToStack` — real meal-match logic

**Files:**
- Create: `frontend/src/features/fuel/logic/matchMealsToStack.ts` + `.test.ts`
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (export the existing private `perServing` at :243)

**Interfaces:**
- Consumes: `StackDaySlot` (Task 6), `Recipe` (`macros` are WHOLE-recipe — divide via `perServing(r)`), `FuelMeal` (`kcal/p/c/f` rollup + `mealSlotKey()` from `buildDayPlan.ts:88`).
- Produces:

```ts
export const FAT_BOUND_NEEDLES: string[]            // ['d3','k2','omega','halolaj','krill','kurkum','q10','koenzim']
export const FAT_OK_G = 15
export const PROTEIN_OK_G = 25
export interface MealMatchSuggestion {
  zone: StackZoneKey; zoneLabel: string; time: string
  recipeId: string; recipeName: string; metric: string   // '32g zsír / adag'
  reason: string
}
export interface MealMatchVerdict {
  zone: StackZoneKey; dayLabel: 'ma' | 'tegnap'; mealTitle: string
  ok: boolean; metric: string                            // '28g zsír' / '6g zsír'
  advice: string | null                                  // set when !ok
}
export interface MealMatchResult { suggestions: MealMatchSuggestion[]; verdicts: MealMatchVerdict[] }
export function matchMealsToStack(
  slots: StackDaySlot[], recipes: Recipe[],
  todayMeals: FuelMeal[], yesterdayMeals: FuelMeal[],
): MealMatchResult
```

- [ ] **Step 1: Failing tests.** Cases: (1) lunch slot containing a `d3`-named entry + recipes with fat/serving 32g vs 8g → one suggestion for `lunch` naming the fattier recipe, metric `'32g zsír / adag'`; (2) post_workout slot with a whey entry → suggestion ranked by protein/serving, metric `'42g fehérje / adag'`; (3) suggestion cap: max 1 per zone; no fat-bound/protein entries → `suggestions: []`; (4) verification: today's logged lunch meal (`slot` mapped via `mealSlotKey`) with `f: 28` → `ok: true`, `metric '28g zsír'`; `f: 6` → `ok:false` + advice (`'A D3 zsíros étkezést kér — legközelebb tedd zsírosabb fogás mellé, vagy mozgasd vacsorára.'` — generic template: name the first fat-bound entry of the zone); (5) yesterday's meals produce `dayLabel: 'tegnap'` verdicts; (6) skipped entries (`skippedToday`) don't trigger suggestions.

- [ ] **Step 2: Implement.** Fat-bound entry test: `FAT_BOUND_NEEDLES.some(n => entry.name.toLowerCase().includes(n))` on entries of meal zones (`breakfast|lunch|dinner`); protein-bound: `post_workout` zone entries matching `['whey','protein','fehérje']`. Suggestion: rank recipes by `perServing(r).f` (resp. `.p`), tie-break `mezoFit.score ?? 0` desc; skip zones with no candidate recipe. Verdict: meals whose `mealSlotKey(m)` equals the zone (`post_workout` verdicts match ANY today-meal within ±90 min of the slot time when `loggedAt` parses — keep simpler: only meal zones get verdicts); `ok = m.f >= FAT_OK_G` (protein zones: `m.p >= PROTEIN_OK_G`).

- [ ] **Step 3: Run** — `pnpm test src/features/fuel/logic/matchMealsToStack.test.ts` → PASS.

- [ ] **Step 4: Commit** — `feat(fuel): deterministic meal-match logic (mezo-vx9v)`

---

### Task 8: FuelStackPage rework — zone timeline UI, item sheet, autosave

**Files:**
- Rewrite: `frontend/src/features/fuel/pages/FuelStackPage.tsx` + `FuelStackPage.test.tsx`
- Create: `frontend/src/features/fuel/components/StackZoneCard.tsx`
- Create: `frontend/src/features/fuel/components/StackMealMatch.tsx`
- Create: `frontend/src/features/fuel/sheets/StackItemSheet.tsx` + `StackItemSheet.test.tsx`
- Modify: `frontend/src/features/fuel/sheets/StackPickerSheet.tsx` + its test (rewire to add-occurrence)
- Create: `frontend/src/data/fuel/stackDayHooks.ts` (shared projection hook)
- Delete: `frontend/src/features/fuel/components/{ProtocolSlot,SelectedChip,ReasoningRow,RecommendationCard,MealMatchRow}.tsx`
- Modify: `frontend/src/data/fuel/stackHooks.ts` (delete `useStackContext`), `frontend/src/data/fuel/fuelReadHooks.ts` (delete `useStackRecommendations`), `frontend/src/data/hooks.ts` (drop the two exports), `frontend/src/data/fuel/fuelApi.ts` (drop the deprecated `selectedIds` bridge)

**Interfaces:**
- Consumes: Tasks 5-7 exports; `useDualQuery` sources already available: `useSleepGoal` (wake/bed), `useTrain` (`gymSchedule`, `sport`), `useRunning` (`activeRunningBlock`), `useFuelSettings` (`mealsPerDay`), `useRecipes`, `useFuelDay(date)`; `deriveBlocks` from `@/features/fuel/logic/buildProtocol`; `Sheet` idiom (`{open && <XSheet onClose={…}/>}`); `.zcard/.zh/.zn/.zk/.zrow` CSS family (`prototype.css:2499-2541`).
- Produces: `useStackDay()` in `stackDayHooks.ts`:

```ts
export function useStackDay(date?: string): {
  slots: StackDaySlot[]; occurrences: ProtocolOccurrence[]; stash: SupplementStashItem[]
  dayType: { training: boolean; firstBlockTime: string | null }
  wake: string; bed: string
}
```

(composes `useProtocol` + `useStack` + `useIntakes(date)` + `useSleepGoal` + `useTrain` + `useRunning` + `useFuelSettings`, calls `deriveBlocks` + `projectStackDay`; ALL hooks unconditional — mirror `timelineHooks.ts`'s composition style. Barrel-export it from `data/hooks.ts`.)

- [ ] **Step 1: `useStackDay`** in `data/fuel/stackDayHooks.ts` per the interface above; unit-test inline in `stackHooks.test.tsx`-style file only if trivially mockable — otherwise covered by the page tests (both modes).

- [ ] **Step 2: `StackZoneCard`** — presentational:

```tsx
interface StackZoneCardProps {
  slot: StackDaySlot
  takenBusy?: boolean
  onToggleTaken: (entry: StackDayEntry) => void
  onOpenEntry: (entry: StackDayEntry) => void
}
```

Structure: `.zcard` → `.zh` header (`.zn` = `slot.label`, mono time via `.zk`, right-aligned `anchorNote` in 8.5px `--faint`) → one `.zrow` per entry: tick button (18px circle; taken → sage fill + `check` icon + name struck through `--sub`; `entry.skippedToday` → disabled, row `opacity .6`), name + dose sub-line (`.zt .a/.b`), trailing badge (`entry.pinned ? '📌' : entry.displacedToday || entry.skippedToday ? 'ma nincs edzés' + (skipped ? ' → kimarad' : '') : 'auto'` as a `.chip`-styled span), whole row (except tick) is a button opening `onOpenEntry(entry)` with `aria-label={entry.name + ' beállítások'}`; tick has `aria-label={entry.name + ' bevétel'}`.

- [ ] **Step 3: `StackItemSheet`** — props:

```tsx
interface StackItemSheetProps { entry: StackDayEntry; onClose: () => void }
```

Content (uses `useProtocolActions`, `useStack` internally): header = name + dose; placement line: pinned → `„📌 Ide raktad kézzel (${STACK_ZONE_LABEL[entry.persistedZone]})"` + a `Vissza autóra` ghost button (`unpinItem(entry.occurrenceId)` then close); auto → `entry.reason`. Zone picker: chip row over `STACK_ZONE_ORDER` (current zone marked ✓; tap → `moveItem(entry.occurrenceId, zone)` then close). Dose editor: text input defaulting `entry.dose ?? ''`, save on blur via `setDose`. `+ Még egy bevétel` block: zone chip row + dose input + add button → `addItem(entry.pantryItemId, { slotKey, dose })`. `dailyTotalHint` rendered as an info line when present. Footer: `Eltávolítás a stackből` (destructive style) → `removeAllFor(entry.pantryItemId)` + close. All mutations rely on the global mutation-error toast — no local try/catch.

- [ ] **Step 4: `StackPickerSheet` rewire** — props become `{ occupiedIds: Set<string>; onAdd: (pantryItemId: string) => void; onClose: () => void }`; row tap calls `onAdd` (sheet stays open for multi-add; already-added rows show a small `a stackben` chip but stay tappable — duplicate zone conflicts surface via the 409 toast). Update its test.

- [ ] **Step 5: Rewrite `FuelStackPage`.** Composition (all data via `useStackDay()`, `useRecipes()`, `useFuelDay(today)`, `useFuelDay(yesterday)`; `localDateString` for dates — yesterday via the existing date helper in `@/shared/lib/dates`, check for `addDays`-style export first):
  1. `.pghead-np sage` header — over `Fuel · Stack`, h1 `Napi protokoll` (no "live" chip).
  2. Day-summary strip card: `<b>{weekdayHu} · {dayType.training ? 'edzésnap ' + firstBlockTime : 'pihenőnap'}</b> · ébredés {wake} · lefekvés {bed} · {occurrences.length} item{pinnedCount ? `, ${pinnedCount} 📌` : ''}` + a `label-mono` `minden változás automatikusan mentve` tag.
  3. Zone cards: `slots.map(s => <StackZoneCard …/>)`; empty protocol → dashed card `Üres stack · adj hozzá a Kamrából`.
  4. `+ Hozzáadás a Kamrából` button → `StackPickerSheet` (`onAdd={id => addItem(id)}`).
  5. `<StackMealMatch result={matchMealsToStack(slots, recipes, todayMeals, yesterdayMeals)} />` — suggestion rows (zone label + time gutter, recipe name → `Link` to `/fuel/recipes/{id}`, metric + reason) and verdict rows (✓ sage / ⚠ amber, metric, advice); hidden entirely when both arrays empty.
  6. Compact `Miért így` card: up to 3 distinct non-null `entry.reason` strings from primary zones, joined as short rows (dedupe by string).
  - Tick handler: `entry.taken ? undoIntake(entry.pantryItemId, entry.persistedZone) : logIntake(entry.pantryItemId, entry.persistedZone, entry.dose)`.
  - DELETE from the old page: context card, narrative intro, `SelectedChip` row, `ProtocolSlot` list, `ReasoningRow` block, recommendations, `MealMatchRow` section, both CTA buttons, apply/toast state, `buildProtocol` import.

- [ ] **Step 6: Dead code removal** — delete the five components; delete `useStackContext` (+ its `userSeed`/`mesoSeed` imports) from `stackHooks.ts`; delete `useStackRecommendations` from `fuelReadHooks.ts`; update `data/hooks.ts:21-22`; drop `fuelApi.ts`'s deprecated `selectedIds`. `grep -rn "useStackContext\|useStackRecommendations\|StackRecommendation\b" frontend/src` must come back empty (also remove the `StackRecommendation` type from `types.ts` if now orphaned). `hooks.reexport.test.ts` will flag the barrel diff — update it.

- [ ] **Step 7: Page tests** (rewrite `FuelStackPage.test.tsx`, keep the `QueryWrapper`+`MemoryRouter` harness + both-modes describe blocks):
  - mock: renders `Napi protokoll` heading; zone cards render seed occurrences in `STACK_ZONE_ORDER` (Ébredés before Este); kreatin row shows `auto` badge; tick button `Kreatin monohidrát… bevétel` toggles taken styling; row-tap opens `StackItemSheet` (zone chips visible); picker opens and `onAdd` fires `addItem` (assert via cache change); strip shows `pihenőnap`/`edzésnap` per seeded train state; NO `Bekapcsolás` text anywhere; `Miért így` block present.
  - real: MSW `GET /api/fuel/protocol` → view with 1 item (kreatin/wake) → one zone card; unresolved protocol → empty-stack dashed card (never the seed); add-item POST captured.
  - `StackItemSheet.test.tsx`: unpin button only when `pinned`; `moveItem` called with tapped zone; `+ Még egy bevétel` posts second occurrence; remove calls `removeAllFor`; hint line renders when `dailyTotalHint` set.

- [ ] **Step 8: Run** — `pnpm test src/features/fuel && VITE_USE_MOCK=true pnpm test src/features/fuel && pnpm build` → PASS.

- [ ] **Step 9: Commit** — `feat(fuel): occurrence-based Stack page with autosave zone timeline (mezo-vx9v)`

---

### Task 9: Mai timeline + notification writer on `projectStackDay`

**Files:**
- Modify: `frontend/src/data/fuel/timelineHooks.ts` (+ its test)
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (proto-slot mapper input) (+ tests if any cover it)
- Modify: `frontend/src/data/notification/notificationScheduleWriter.ts` + `notificationScheduleWriter.test.ts`
- Modify: `frontend/src/features/me/pages/NotificationsPage.tsx` (+ test)
- Modify: `frontend/src/features/fuel/logic/buildProtocol.ts` (delete `buildProtocol()` + its needle helpers; keep `deriveBlocks`, `deriveProtocolAnchors`, `ProtocolAnchors`, `PRE_WORKOUT_STACK_LEAD_MIN`) — delete `buildProtocol.test.ts` cases for the removed builder, keep/extend anchor-derivation cases

**Interfaces:**
- Consumes: `projectStackDay`/`StackDaySlot` (Task 6), `useProtocol().occurrences` (Task 5).
- Produces: `buildDayPlan`'s `DayPlanInput.protocolSlots` type changes `ProtocolSlotData[]` → `StackDaySlot[]`; notification `FUEL_WINDOW_LABEL` re-keyed by `StackZoneKey`; `buildScheduleEntries(checkins, slots: StackDaySlot[])`.

- [ ] **Step 1: `buildDayPlan` mapper.** Replace the `:378-399` proto-slot block to consume `StackDaySlot[]`:

```ts
const ZONE_FUEL_KIND: Record<StackZoneKey, FuelKind> = {
  wake: 'wake', breakfast: 'snack', pre_workout: 'preworkout', post_workout: 'snack',
  lunch: 'midday', dinner: 'evening', evening: 'evening', bedtime: 'evening',
}
const protoSlots: FuelSlot[] = protocolSlots.map(s => {
  const items: SlotItem[] = s.entries.filter(e => !e.skippedToday).map(e => ({
    type: 'supplement', refId: e.pantryItemId,
    label: e.dose ? `${e.name} · ${e.dose}` : e.name,
    done: e.taken,
  }))
  const done = items.length > 0 && items.every(it => it.done)
  return { time: s.time, kind: ZONE_FUEL_KIND[s.zone], label: `${s.label} stack`,
           state: done ? 'done' : 'pending', items,
           mezoNote: s.entries.find(e => e.reason)?.reason, windowTip: s.anchorNote ?? undefined }
})
```

Drop zones whose entries are all skipped (`items.length === 0`). Delete the old `PROTOCOL_KIND`/`PROTOCOL_LABEL` consts + the `intakeRefs` set (taken now arrives on the entry).

- [ ] **Step 2: `timelineHooks.ts`.** Replace the `buildProtocol` call (`:103-105`) with: take `occurrences` from `useProtocol()`, keep `deriveBlocks` + wake/bed/mealsPerDay wiring, call `projectStackDay({occurrences, stash, intakes, wake, bed, mealsPerDay, blocks})`, pass the result as `protocolSlots`. Remove the selection-default line (`stash.filter(s => s.type !== 'medication')` — occurrences replace selection). Keep the `deriveBlocks` re-export.

- [ ] **Step 3: Notification writer.** Re-key `FUEL_WINDOW_LABEL`:

```ts
const FUEL_WINDOW_LABEL: Record<string, string> = {
  wake: 'ébredési', breakfast: 'reggeli', pre_workout: 'edzés előtti', post_workout: 'edzés utáni',
  lunch: 'ebédi', dinner: 'vacsora melletti', evening: 'esti', bedtime: 'lefekvés előtti',
}
```

`fuelSlotEntry(slot: StackDaySlot)`: title `` `Stack · ${FUEL_WINDOW_LABEL[slot.zone] ?? slot.zone} slot` ``; body from `slot.entries.filter(e => !e.skippedToday).map(e => e.dose ? `${e.name} ${e.dose}` : e.name).join(' + ')`; `source: 'projectStackDay'`. `useScheduleSnapshotWriter` + `NotificationsPage`: swap `buildProtocol(...).slots` for `projectStackDay({...})` (both already have gym/sport/run + wake/bed; add `useProtocol().occurrences`, `useIntakes`, `useFuelSettings().mealsPerDay` where missing). `fuelSlotCount` on NotificationsPage = slots with ≥1 non-skipped entry.

- [ ] **Step 4: Tests.** Update `notificationScheduleWriter.test.ts` — keep the 17:00-gym → 16:20 pre-workout-slot assertion alive by feeding an occurrence fixture (kreatin wake + PWO pre_workout) through `projectStackDay` and asserting the generated entry times/titles; rest-day case now asserts the PWO entry is ABSENT (skip) instead of wake+60. Update `timelineHooks.test.tsx` expectations (supplement slots still appear in `plan.slots`, done-state from intakes). Trim `buildProtocol.test.ts` to the surviving `deriveBlocks`/`deriveProtocolAnchors` cases.

- [ ] **Step 5: Run** — `pnpm test src/data/fuel src/data/notification src/features/fuel/logic src/features/me/pages/NotificationsPage.test.tsx && VITE_USE_MOCK=true pnpm test <same paths> && pnpm build` → PASS.

- [ ] **Step 6: Commit** — `feat(fuel): timeline + notifications ride projectStackDay (mezo-vx9v)`

---

### Task 10: Contract cleanup — retire activate, tighten items, rework seed

**Files:**
- Modify: `api/feature/fuel/fuel.yml` (remove `POST /api/fuel/protocol` + `ProtocolActivateRequest`; `ProtocolResponse`: drop `selectedPantryItemIds`, move `items` into `required`; update the tag description — the protocol now persists occurrences, not a selection)
- Modify (generated): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/.../feature/fuel/service/ProtocolService.java` (delete `activate` + its helpers; keep constants used elsewhere), `controller/FuelController.java` (drop `activateProtocol`), `ProtocolSeedData.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/{FuelApiIT,ProtocolServiceIT,ProtocolSeedDataIT}.java`
- Modify: `frontend/src/data/fuel/stackHooks.ts` (delete `useProtocolActions().applyProtocol` → replaced in Task 5-8; delete `mockActivate`), `frontend/src/data/fuel/fuelApi.ts` (delete `activateProtocol`), `frontend/src/data/hooks.ts` if `useProtocolActions` shape changed
- Check: `backend/.../feature/companion/` protocol tool (Step 4 of Task 4's notes)

**Interfaces:**
- Produces: final wire shape — `ProtocolResponse` required `[id, version, builtAt, status, items]`.

- [ ] **Step 1: Contract edit + regenerate** (both generators, commit outputs).
- [ ] **Step 2: Backend deletions** — remove `activate` from service+controller; `ProtocolSeedData.run()` now: ensure the two stim pantry rows (unchanged), then when the owner has no active protocol, call `protocolService.addItem(ownerId, new ProtocolItemCreateRequest().pantryItemId(tastyDose.getId()))` + same for `originPwo` (engine places: both are caffeine → `wake`… `Origin PWO` matches the `pwo` needle first → `pre_workout`; assert that in the IT). Update the seed-reason constant usage (no `reason` param anymore — delete `SEED_REASON` if unused).
- [ ] **Step 3: Companion tool** — if it referenced `selectedPantryItemIds`, switch it to `items` (pantry ids via `items[].pantryItemId`); keep its rendered output semantically identical; if its `@Tool` description changes, sync `ChatService.SYSTEM_PROMPT`'s `[Eszköz-útmutató]` per `companion_tool_conventions.md`.
- [ ] **Step 4: Test updates** — delete/replace activate-era tests (`testProtocol_shouldRoundTripAndBumpVersion_whenActivatedTwice`, empty-selection 400, `ProtocolServiceIT` activate cases) with occurrence-op equivalents where coverage would drop; `ProtocolSeedDataIT` asserts: seed idempotent, tastyDose→wake occurrence, originPwo→pre_workout occurrence.
- [ ] **Step 5: FE deletions** — `applyProtocol`/`mockActivate`/`fuelApi.activateProtocol` gone; `grep -rn "activateProtocol\|applyProtocol\|ProtocolActivateRequest\|selectedPantryItemIds" frontend/src backend/src api/` → only `api.gen.ts` history-free hits allowed (i.e. none).
- [ ] **Step 6: Run** — backend: `./mvnw clean test -Dtest=FuelApiIT,ProtocolServiceIT,PlacementEngineIT,ProtocolSeedDataIT -Dsurefire.failIfNoSpecifiedTests=false`; frontend: `pnpm test src/data/fuel src/features/fuel && VITE_USE_MOCK=true pnpm test <same> && pnpm build` → ALL PASS.
- [ ] **Step 7: Commit** — `feat(fuel)!: retire protocol activate endpoint — living occurrence protocol only (mezo-vx9v)`

---

### Task 11: Docs + ADR + lint

**Files:**
- Modify: `docs/features/fuel.md` (§1 status line for Stack, §2 route table row for `/fuel/stack` — new view name/description, the Stack subsection describing the occurrence model + placement engine + meal-match + what was removed; hook table entries `useProtocol/useProtocolActions/useStackDay/useIntakes`; drop `useStackContext`/`useStackRecommendations` mentions or mark deleted)
- Create: `docs/decisions/0017-living-occurrence-protocol.md` (ADR — supersedes the "protocol persists ONLY selected ids + FE buildProtocol" decision from the mezo-09g era; records: occurrence model, backend placement engine + consumer-owned `StackPlacementLlm` port, FE-owned zone→time projection invariant retained, activate/version retired from the API surface, rest-day projection-only fallback)
- Check/Modify: `docs/features/_platform-notifications.md` (writer input `buildProtocol` → `projectStackDay`, `FUEL_WINDOW_LABEL` zone keys), `docs/features/_platform-api-backend.md` (fuel surface list :157/:173)
- Modify: `docs/milestones/roadmap.md` only if it names the Stack builder explicitly (grep `Bekapcsolás\|Stack builder`)

**Interfaces:** none — documentation task.

- [ ] **Step 1:** Update `fuel.md` per the file map above (living-doc policy: overwrite in place, `file:line` pointers to `projectStackDay.ts`, `PlacementEngine.java`, `stackDayHooks.ts`; update `key_files` frontmatter if new top-level paths matter).
- [ ] **Step 2:** Write ADR 0017 (use an existing ADR under `docs/decisions/` as the template; status Accepted, date 2026-08-03, driving issue mezo-vx9v, links to the spec + plan).
- [ ] **Step 3:** `node scripts/lint-docs.mjs` → clean (clears the fuel.md staleness flag).
- [ ] **Step 4: Commit** — `docs(fuel): stack occurrence redesign — feature doc + ADR 0017 (mezo-vx9v)`

---

## Ship checklist (after all tasks — per CLAUDE.md git workflow)

1. `git push` the `feat/stack-redesign` branch → open self-PR → CI green (full backend suite + FE both modes + contract-drift run THERE, not locally).
2. Visual goldens: no Stack-page golden exists (`frontend/tests/visual/visual.spec.ts` covers `/fuel` + `/fuel/plan` only) — if CI `test-visual` flags `/fuel` drift from timeline label changes, regenerate per the ship-flow memory (linux via `update-visual-baselines.yml`, darwin locally).
3. Merge `--no-ff` locally (worktree-safe variant), push main, delete branch; `bd close mezo-vx9v` + `bd dolt push`; verify `.beads/issues.jsonl` survives on main.

## Out of scope (explicitly)

- `WeeklySupplementGrid` on the Terv page stays mock-seeded (separate bd issue if wanted).
- P8: AI recommendations, pattern prose, auto-split of high-dose items.
- Per-weekday protocol variants; free-text (non-Kamra) items.
