# Companion turn gear + CHAT branch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chat turn that needs no personal data runs on the SMART tier **with reasoning enabled**, carrying no tool schemas and a lightened context — while every data-bearing turn behaves exactly as today.

**Architecture:** A deterministic analyzer (mirroring `MemoryQueryAnalyzer`) classifies each turn as `CHAT` / `LOOKUP` / `ANALYSIS`, falling back to a cheap one-word classifier only when the rules are ambiguous. `CHAT` turns take a new tool-free, smart-tier port method; everything else takes today's path untouched. Because the new call carries no tools, `OpenAiCompanionLlm.optionsFor`'s existing `carriesTools ? "none" : tierEffort` gate lets reasoning through with **zero adapter changes**.

**Tech Stack:** Java 21, Spring Boot 4.x, Spring AI 2.0.1, Maven, JUnit 5 + AssertJ, Testcontainers Postgres.

**Spec:** `docs/superpowers/specs/2026-09-16-companion-plan-execute-answer-design.md` — this plan covers slices **S9.1 (seam)**, **S9.2 (test guard)** and **S9.3 (gear + CHAT branch)** only. S9.4–S9.8 get their own plans.

**Driving issue:** `mezo-rj214.7`. Commit subjects carry it: `feat(companion): … (mezo-rj214.7)`.

## Global Constraints

- **Base package** `io.mrkuhne.mezo`; layout `feature/{name}/{controller,service,repository,entity,dto,mapper}`. ArchUnit `services_live_in_service_packages` is enforced — the new classes go in `feature/companion/service/`.
- **No `@Value`.** Every tunable is a `@ConfigurationProperties` record field under the `mezo:` root. ArchUnit rule: `no_spring_value_annotation`.
- **Constructor injection only**, `@RequiredArgsConstructor`. Never field injection.
- **AssertJ only** in tests. Naming: `test{Method}_should{Result}_when{Condition}`.
- **Pure-logic classes get plain unit tests** (precedent: `MemoryQueryAnalyzerTest`, `ToolTextTest`); anything touching Spring wiring or the DB is an integration test extending the existing bases.
- **Hungarian user-facing strings**; English code comments and javadoc.
- **`joinInstructions` identity is load-bearing** (`CompanionLlm.java:70-72`): the two prompt halves are joined with NOTHING between them. `FakeCompanionLlm` dispatches on the resulting prefix, and the audit row reads it. Never insert a separator.
- **Always `./mvnw clean test`** — Lombok+MapStruct incremental compile is flaky. Backend suite needs `-Dmezo.test.use-testcontainers=true` on this machine.
- Local focused runs only; the full suite is CI's job (`AGENTS.md` §Git Workflow).

## Two scope decisions made here, not left open

**`CallKind` for the new entry points is `SMART`, including the streamed one.** The spec (§4) flags that `CallKind` conflates SHAPE and TIER, so a streamed tool-free smart answer is arguably both `CHAT_STREAM` and `SMART`. This plan picks `SMART` for both, because the tier is what the cost and routing questions are actually about, and `CallSpec.streamed` already records the shape separately. Three readers must stay consistent with that choice: `LlmModelRouter.modelFor` (`call-kind-models`), `ToolSelectionEvalIT.GENERATION_KINDS:98`, and the admin cost matrix. If S9.5 finds this cramped, adding a kind is an append-only text-enum change with no migration.

**`ToolOutcomeDigest` is NOT promoted in this plan.** The spec lists it under S9.1, but nothing consumes it until the answerer of S9.5 — promoting a package-private class with no caller is the kind of speculative change that ages badly. It stays in `advisor` until S9.5 needs it.

---

### Task 1: `TurnGear` + `TurnGearAnalyzer` (deterministic classification)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnGear.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnGearAnalyzer.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnGearAnalyzerTest.java`

**Interfaces:**
- Consumes: `ToolText.fold(String)` (`feature/companion/tools/ToolText.java:197`) — accent-folding, already used by `MemoryQueryAnalyzer`.
- Produces: `enum TurnGear { CHAT, LOOKUP, ANALYSIS }` and `Optional<TurnGear> TurnGearAnalyzer.analyze(String userMessage)` — **empty Optional means UNSURE**, which Task 2's router resolves.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static io.mrkuhne.mezo.feature.companion.service.TurnGear.ANALYSIS;
import static io.mrkuhne.mezo.feature.companion.service.TurnGear.CHAT;
import static io.mrkuhne.mezo.feature.companion.service.TurnGear.LOOKUP;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;

import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class TurnGearAnalyzerTest {

    private final TurnGearAnalyzer analyzer = new TurnGearAnalyzer();

    static Stream<Arguments> classified() {
        return Stream.of(
            // No data reference at all -> pure conversation.
            arguments("Szia!", CHAT),
            arguments("Mit gondolsz a kreatinról?", CHAT),
            arguments("Seated Leg Curlnél pipál vagy spiccel a lábfej?", CHAT),
            // Domain word or time word + a "how much / when / what" shape -> simple lookup.
            arguments("Mennyit aludtam kedden?", LOOKUP),
            arguments("Mit ettem ma?", LOOKUP),
            arguments("Hány kiló voltam 2026-09-14-én?", LOOKUP),
            // Domain word + a "why / what changed / what should I" shape -> analysis.
            arguments("Miért vagyok fáradt mostanában?", ANALYSIS),
            arguments("Mi változott az alvásomban a múlt héthez képest?", ANALYSIS),
            arguments("Mit csináljak a súlyommal?", ANALYSIS));
    }

    @ParameterizedTest
    @MethodSource("classified")
    void testAnalyze_shouldClassify_whenSignalsAreUnambiguous(String message, TurnGear expected) {
        assertThat(analyzer.analyze(message)).contains(expected);
    }

    @Test
    void testAnalyze_shouldReturnAnalysis_whenUserAsksForADeeperLook() {
        assertThat(analyzer.analyze("Nézd meg alaposabban")).contains(ANALYSIS);
        assertThat(analyzer.analyze("Gondold át még egyszer")).contains(ANALYSIS);
    }

    @Test
    void testAnalyze_shouldBeUnsure_whenADomainWordCarriesNoQuestionShape() {
        // "alvás" is a domain word but there is no how-much and no why - the rules cannot tell
        // a lookup from an analysis, so the cheap classifier decides (Task 2).
        assertThat(analyzer.analyze("Az alvás.")).isEmpty();
    }

    @Test
    void testAnalyze_shouldBeCaseAndAccentInsensitive_whenMessageIsShouted() {
        assertThat(analyzer.analyze("MENNYIT ALUDTAM KEDDEN?")).contains(LOOKUP);
    }

    @Test
    void testAnalyze_shouldReturnChat_whenMessageIsNullOrBlank() {
        assertThat(analyzer.analyze(null)).contains(CHAT);
        assertThat(analyzer.analyze("   ")).contains(CHAT);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=TurnGearAnalyzerTest
```
Expected: FAIL — compilation error, `TurnGear` and `TurnGearAnalyzer` do not exist.

- [ ] **Step 3: Write minimal implementation**

`TurnGear.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

/**
 * How much thinking one chat turn earns (spec 2026-09-16 §5). The gear does NOT decide WHO plans —
 * the smart model always does — only the reasoning effort and whether a replan lap is allowed.
 */
public enum TurnGear {

    /** Needs none of the user's data: no plan, no retrieval, one tool-free smart call. */
    CHAT,

    /** A straightforward lookup ("how much did I sleep on Tuesday"): plan at low effort. */
    LOOKUP,

    /** An open question ("why am I tired lately"): plan at high effort, replan lap allowed. */
    ANALYSIS
}
```

`TurnGearAnalyzer.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Conservative, deterministic gear routing before any model call — the same shape as
 * {@code MemoryQueryAnalyzer}, and for the same reason: the analyzer, not a model, decides the
 * easy cases, so the common turn costs nothing to classify.
 *
 * <p>An EMPTY result means UNSURE, not CHAT. Resolving it is {@code TurnGearRouter}'s job.
 */
@Component
public class TurnGearAnalyzer {

    /** Words that only appear when the user is talking about their own logged data. */
    static final Set<String> DOMAIN_WORDS = Set.of(
        "aludtam", "alvas", "alvasom", "alvasomban", "alvasi",
        "ettem", "etkezes", "etkezesem", "kaloria", "makro", "feherje", "szenhidrat", "zsir", "rost",
        "suly", "sulyom", "sulyommal", "kilo", "fogyas", "hizas",
        "edzes", "edzesem", "edzettem", "sorozat", "ismetles", "pr", "rekord",
        "protokoll", "supplement", "gyogyszer", "keszitmeny",
        "szokas", "kuldetes", "streak", "xp", "szint",
        "vizet", "viz", "hidratacio", "kozerzet", "energia", "stressz",
        "recept", "kamra", "cel", "celom");

    /** Words that anchor a question to a point in time — a second, independent data signal. */
    static final Set<String> TIME_WORDS = Set.of(
        "ma", "tegnap", "tegnapelott", "holnap", "holnaputan",
        "hetfon", "kedden", "szerdan", "csutortokon", "penteken", "szombaton", "vasarnap",
        "heten", "heti", "honapban", "havi", "tavaly", "iden", "reggel", "este", "ejjel");

    /** "How much / when / what" — the answer is a value that exists in a row somewhere. */
    static final Set<String> LOOKUP_WORDS = Set.of("mennyit", "mennyi", "hany", "mikor", "mit", "milyen");

    /** "Why / what changed / what should I" — the answer needs interpretation across rows. */
    static final Set<String> ANALYSIS_WORDS = Set.of("miert", "valtozott", "valtozas", "csinaljak",
        "tegyek", "erdemes", "osszefugges", "trend", "okozza", "magyarazza");

    /** Explicit user override — always the top gear, no classifier call (spec §2 G3). */
    static final Set<String> DEEPER_LOOK_PHRASES = Set.of("alaposabban", "jobban", "reszletesen", "atgondolva");
    static final Set<String> DEEPER_LOOK_VERBS = Set.of("nezd", "nezzuk", "gondold", "gondoljuk", "vizsgald");

    private static final Pattern ISO_DATE = Pattern.compile("(?<!\\d)\\d{4}-\\d{2}-\\d{2}(?!\\d)");
    private static final Pattern WORD_SEPARATOR =
        Pattern.compile("[^\\p{L}\\p{N}]+", Pattern.UNICODE_CHARACTER_CLASS);

    public Optional<TurnGear> analyze(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) {
            return Optional.of(TurnGear.CHAT);
        }
        String folded = ToolText.fold(userMessage);
        List<String> words = WORD_SEPARATOR.splitAsStream(folded)
            .filter(word -> !word.isBlank())
            .toList();

        if (isDeeperLookRequest(words)) {
            return Optional.of(TurnGear.ANALYSIS);
        }
        boolean refersToData = words.stream().anyMatch(DOMAIN_WORDS::contains)
            || words.stream().anyMatch(TIME_WORDS::contains)
            || ISO_DATE.matcher(userMessage).find();
        if (!refersToData) {
            return Optional.of(TurnGear.CHAT);
        }
        boolean analysisShape = words.stream().anyMatch(ANALYSIS_WORDS::contains);
        boolean lookupShape = words.stream().anyMatch(LOOKUP_WORDS::contains);
        if (analysisShape) {
            return Optional.of(TurnGear.ANALYSIS);
        }
        if (lookupShape) {
            return Optional.of(TurnGear.LOOKUP);
        }
        // Refers to data but carries no question shape: the rules genuinely cannot tell.
        return Optional.empty();
    }

    private static boolean isDeeperLookRequest(List<String> words) {
        return words.stream().anyMatch(DEEPER_LOOK_VERBS::contains)
            && words.stream().anyMatch(DEEPER_LOOK_PHRASES::contains);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=TurnGearAnalyzerTest
```
Expected: PASS, all 5 test methods green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnGear.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnGearAnalyzer.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnGearAnalyzerTest.java
git commit -m "feat(companion): deterministic turn-gear analyzer (mezo-rj214.7)"
```

---

### Task 2: `GearClassifier` + `TurnGearRouter` (resolve UNSURE)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/GearClassifier.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnGearRouter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnGearRouterTest.java`

**Interfaces:**
- Consumes: `TurnGearAnalyzer.analyze(String) → Optional<TurnGear>` (Task 1); `CompanionLlm.complete(String systemPrompt, String userMessage)` (`CompanionLlm.java:86`) — the cheap, tool-less, history-less overload; `CompanionProperties.turn().gear().classifierEnabled()` (Task 4).
- Produces: `TurnGear TurnGearRouter.route(String userMessage)`; `GearClassifier.PROMPT` (public constant, so `FakeCompanionLlm` can dispatch on it in Task 5).

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import org.junit.jupiter.api.Test;

class TurnGearRouterTest {

    private static final String UNSURE_MESSAGE = "Az alvás.";

    private TurnGearRouter router(boolean classifierEnabled, String classifierAnswer) {
        GearClassifier classifier = new GearClassifier((system, user) -> classifierAnswer);
        return new TurnGearRouter(new TurnGearAnalyzer(), classifier,
            CompanionPropertiesFixtures.withGearClassifier(classifierEnabled));
    }

    @Test
    void testRoute_shouldSkipTheClassifier_whenTheAnalyzerIsSure() {
        // The classifier would say ANALYSIS; the analyzer is sure it is CHAT, so it is never asked.
        assertThat(router(true, "ANALYSIS").route("Szia!")).isEqualTo(TurnGear.CHAT);
    }

    @Test
    void testRoute_shouldUseTheClassifier_whenTheAnalyzerIsUnsure() {
        assertThat(router(true, "LOOKUP").route(UNSURE_MESSAGE)).isEqualTo(TurnGear.LOOKUP);
    }

    @Test
    void testRoute_shouldFallBackToAnalysis_whenTheClassifierAnswersGarbage() {
        assertThat(router(true, "banán").route(UNSURE_MESSAGE)).isEqualTo(TurnGear.ANALYSIS);
    }

    @Test
    void testRoute_shouldFallBackToAnalysis_whenTheClassifierThrows() {
        GearClassifier throwing = new GearClassifier((system, user) -> {
            throw new IllegalStateException("provider down");
        });
        TurnGearRouter router = new TurnGearRouter(new TurnGearAnalyzer(), throwing,
            CompanionPropertiesFixtures.withGearClassifier(true));
        assertThat(router.route(UNSURE_MESSAGE)).isEqualTo(TurnGear.ANALYSIS);
    }

    @Test
    void testRoute_shouldFallBackToAnalysis_whenTheClassifierIsDisabled() {
        assertThat(router(false, "LOOKUP").route(UNSURE_MESSAGE)).isEqualTo(TurnGear.ANALYSIS);
    }
}
```

Also create the fixture helper (same package, test scope):

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;

/**
 * Builds a CompanionProperties whose only meaningful field is the gear switch. Every other
 * component is null on purpose: a unit test that reaches one of them should fail loudly rather
 * than quietly read a default that production does not have.
 */
final class CompanionPropertiesFixtures {

    private CompanionPropertiesFixtures() {
    }

    static CompanionProperties withGearClassifier(boolean enabled) {
        CompanionProperties.Turn turn = new CompanionProperties.Turn(
            new CompanionProperties.Turn.Gear(enabled),
            new CompanionProperties.Turn.Answerer("high"));
        // 18 nulls + interventions + turn = the 20 components of CompanionProperties.
        return new CompanionProperties(null, null, null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, java.util.List.of(), turn);
    }
}
```

**Note on ordering:** this task CREATES `CompanionProperties.Turn` (below), because the router and its unit test both need the type to compile. Task 3 only adds the `application.yml` defaults and proves they bind.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=TurnGearRouterTest
```
Expected: FAIL — `GearClassifier`, `TurnGearRouter` and `CompanionProperties.Turn` do not exist.

- [ ] **Step 3: Write minimal implementation**

`GearClassifier.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * The cheap tie-breaker for turns {@code TurnGearAnalyzer} could not classify. One tool-less,
 * history-less call on the cheap tier, answering with exactly one enumerated word.
 *
 * <p>Deliberately NOT given the conversation history or any context block: its whole job is to
 * look at one sentence, and anything more would cost what the gear exists to save.
 */
@Component
public class GearClassifier {

    /** Public so {@code FakeCompanionLlm} can dispatch on it — the fake keys on the prompt prefix. */
    public static final String PROMPT = """
        FOKOZAT-BESOROLAS. Egyetlen felhasznaloi mondatot kapsz. Dontsd el, melyik igaz ra:
        - CHAT: nem a felhasznalo sajat naplozott adatarol szol (altalanos kerdes, koszones, velemeny).
        - LOOKUP: a sajat adatabol egy konkret ertek kell (mennyi, mikor, mi volt).
        - ANALYSIS: a sajat adatainak ertelmezese kell (miert, mi valtozott, mit tegyen).
        Valaszolj KIZAROLAG egyetlen szoval: CHAT vagy LOOKUP vagy ANALYSIS.""";

    /** The narrow slice of the LLM port this needs — keeps the unit test free of a full fake. */
    @FunctionalInterface
    public interface CheapCompletion {
        String complete(String systemPrompt, String userMessage);
    }

    private final CheapCompletion completion;

    public GearClassifier(CheapCompletion completion) {
        this.completion = completion;
    }

    /** Empty when the provider failed or answered something that is not one of the three words. */
    public Optional<TurnGear> classify(String userMessage) {
        try {
            String answer = completion.complete(PROMPT, userMessage);
            if (answer == null) {
                return Optional.empty();
            }
            String word = answer.trim().toUpperCase(Locale.ROOT);
            for (TurnGear gear : TurnGear.values()) {
                if (word.startsWith(gear.name())) {
                    return Optional.of(gear);
                }
            }
            return Optional.empty();
        } catch (RuntimeException e) {
            // Fail-open: a classifier outage must never cost the user their answer.
            return Optional.empty();
        }
    }
}
```

`TurnGearRouter.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The single place a turn's gear is decided: deterministic rules first, the cheap classifier only
 * for what they cannot settle, and ANALYSIS whenever anything is unclear or broken.
 *
 * <p>The fallback is the TOP gear on purpose. Guessing too high costs latency; guessing too low
 * costs the user a worse answer, and this system exists because the answers were too thin.
 */
@Component
@RequiredArgsConstructor
public class TurnGearRouter {

    private final TurnGearAnalyzer analyzer;
    private final GearClassifier classifier;
    private final CompanionProperties properties;

    public TurnGear route(String userMessage) {
        return analyzer.analyze(userMessage)
            .or(() -> properties.turn().gear().classifierEnabled()
                ? classifier.classify(userMessage)
                : java.util.Optional.empty())
            .orElse(TurnGear.ANALYSIS);
    }
}
```

`GearClassifier` needs two constructors: the functional one above for unit tests, and the one Spring uses. Add the Spring one and mark it, so component scanning is unambiguous:

```java
    @org.springframework.beans.factory.annotation.Autowired
    public GearClassifier(io.mrkuhne.mezo.feature.companion.CompanionLlm llm) {
        this(llm::complete);
    }
```

Also add `CompanionProperties.Turn` now — the router and its test need the type to compile. Append `@NotNull @Valid Turn turn` as the **last** component of the `CompanionProperties` record (after `interventions`, `CompanionProperties.java:43`), then append the nested records inside the record body:

```java
    /**
     * How one chat turn is shaped (spec 2026-09-16). Only the gear and the CHAT-branch effort live
     * here for now; the planner, executor and replan blocks arrive with slices S9.4/S9.5.
     */
    public record Turn(
        @NotNull @Valid Gear gear,
        @NotNull @Valid Answerer answerer
    ) {
        /** Whether an UNSURE turn may spend one cheap call on a classifier, or falls straight to ANALYSIS. */
        public record Gear(boolean classifierEnabled) {}

        /** Reasoning effort per gear. Only the CHAT branch exists in this slice. */
        public record Answerer(@NotBlank String chatEffort) {}
    }
```

The context will not start until Task 3 adds the YAML defaults (`@NotNull` on an unbound component fails validation) — that is expected, and is why Task 3 follows immediately. Run only the unit test in Step 4 of this task.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=TurnGearRouterTest
```
Expected: PASS, all 5 test methods green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/GearClassifier.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnGearRouter.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/
git commit -m "feat(companion): cheap gear classifier + router with fail-open to ANALYSIS (mezo-rj214.7)"
```

---

### Task 3: Config — `application.yml` defaults for `mezo.companion.turn`

**Files:**
- Modify: `backend/src/main/resources/application.yml` (under `mezo.companion:`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/config/CompanionTurnPropertiesIT.java`

**Interfaces:**
- Consumes: `CompanionProperties.Turn` (created in Task 2).
- Produces: bound values for `CompanionProperties.turn().gear().classifierEnabled()` and `turn().answerer().chatEffort()`. Tasks 2 and 7 both read these.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class CompanionTurnPropertiesIT extends AbstractIntegrationTest {

    @Autowired
    private CompanionProperties properties;

    @Test
    void testTurn_shouldBindDefaults_whenApplicationYmlIsLoaded() {
        assertThat(properties.turn()).isNotNull();
        assertThat(properties.turn().gear().classifierEnabled()).isTrue();
        assertThat(properties.turn().answerer().chatEffort()).isEqualTo("high");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=CompanionTurnPropertiesIT -Dmezo.test.use-testcontainers=true
```
Expected: FAIL — the context does not start. Task 2 added `@NotNull @Valid Turn turn` but nothing binds it yet, so `application.yml` validation rejects the `CompanionProperties` bean. **This is the expected failure mode, not a broken plan:** it proves the new component is actually required rather than silently defaulting to null.

- [ ] **Step 3: Write minimal implementation**

The record itself was added in Task 2. This task only supplies the values, in `application.yml`, under `mezo.companion:` (alongside `chat:`, `tools:`, `facts:`):

```yaml
      # Spec 2026-09-16 (mezo-rj214.7): a turn's gear decides how much thinking it earns.
      # The gear never decides WHICH MODEL plans — the smart tier always does.
      turn:
        gear:
          # false => an UNSURE turn goes straight to ANALYSIS instead of spending a cheap call.
          classifier-enabled: true
        answerer:
          # The CHAT branch carries no tools, so this effort actually reaches the provider
          # (OpenAiCompanionLlm.optionsFor pins effort to `none` only when a request carries tools).
          chat-effort: high
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=CompanionTurnPropertiesIT,TurnGearRouterTest -Dmezo.test.use-testcontainers=true
```
Expected: PASS — both the binding IT and the (updated) router unit test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/config/CompanionTurnPropertiesIT.java
git commit -m "feat(companion): mezo.companion.turn config defaults (mezo-rj214.7)"
```

---

### Task 4: Port — tool-free SMART call with history and turn context

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java` (append after `completeSmart` at `:120`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/SpringAiCompanionLlm.java` (override; thread the tier through `request(..)` at `:367-389`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/CompanionLlmSmartTurnTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/SpringAiSmartTurnOverrideTest.java`

**Interfaces:**
- Consumes: `CompanionLlm.joinInstructions(String, String)` (`:70`), `ModelTier.SMART`, `CallKind.SMART`.
- Produces:
  - `String CompanionLlm.completeSmart(String systemPrompt, String turnContext, List<Turn> history, String userMessage)`
  - `Flux<String> CompanionLlm.streamSmart(String systemPrompt, String turnContext, List<Turn> history, String userMessage)`
  Both carry **no tools by contract**. Task 7 and Task 8 call exactly these.

**Why this needs no adapter change to get reasoning:** `OpenAiCompanionLlm.optionsFor:110` computes `effort = carriesTools ? "none" : reasoningEffortFor(OPENAI, tier)`. These methods pass `carriesTools=false` and `tier=SMART`, so the configured `reasoning-effort.smart` reaches the provider untouched.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static io.mrkuhne.mezo.feature.companion.CompanionLlm.Role.USER;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import reactor.core.publisher.Flux;

class CompanionLlmSmartTurnTest {

    /** Records what the default implementation forwarded, so we can assert the contract. */
    private static final class RecordingLlm implements CompanionLlm {
        private final List<String> systemPrompts = new ArrayList<>();
        private final List<List<Turn>> histories = new ArrayList<>();
        private final List<Integer> toolCounts = new ArrayList<>();

        @Override
        public String complete(String systemPrompt, List<Turn> history, String userMessage,
                               List<ToolCallback> tools, Map<String, Object> toolContext) {
            systemPrompts.add(systemPrompt);
            histories.add(history);
            toolCounts.add(tools.size());
            return "ok";
        }

        @Override
        public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                                   List<ToolCallback> tools, Map<String, Object> toolContext) {
            systemPrompts.add(systemPrompt);
            histories.add(history);
            toolCounts.add(tools.size());
            return Flux.just("ok");
        }

        @Override
        public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
            throw new UnsupportedOperationException();
        }

        @Override
        public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
            throw new UnsupportedOperationException();
        }
    }

    @Test
    void testCompleteSmart_shouldJoinHalvesAndCarryNoTools_whenTheDefaultIsInherited() {
        RecordingLlm llm = new RecordingLlm();
        List<CompanionLlm.Turn> history = List.of(new CompanionLlm.Turn(USER, "korábbi"));

        llm.completeSmart("HANG", "KONTEXTUS", history, "Szia!");

        assertThat(llm.systemPrompts).containsExactly("HANGKONTEXTUS");
        assertThat(llm.histories).containsExactly(history);
        assertThat(llm.toolCounts).containsExactly(0);
    }

    @Test
    void testStreamSmart_shouldJoinHalvesAndCarryNoTools_whenTheDefaultIsInherited() {
        RecordingLlm llm = new RecordingLlm();

        llm.streamSmart("HANG", "KONTEXTUS", List.of(), "Szia!").blockLast();

        assertThat(llm.systemPrompts).containsExactly("HANGKONTEXTUS");
        assertThat(llm.toolCounts).containsExactly(0);
    }

    @Test
    void testCompleteSmart_shouldTolerateABlankContext_whenThereIsNoVolatileHalf() {
        RecordingLlm llm = new RecordingLlm();

        llm.completeSmart("HANG", "", List.of(), "Szia!");

        assertThat(llm.systemPrompts).containsExactly("HANG");
    }
}
```

And the structural guard that the real adapter does not silently inherit the cheap-tier default:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Spec §8.3 of the OpenAI migration: an adapter that INHERITS a smart entry point sends the call
 * to the cheap tier silently, with no error anywhere. {@code completeSmart(String, String)} is
 * already guarded structurally; these two new entry points need the same guard.
 */
class SpringAiSmartTurnOverrideTest {

    @Test
    void testSpringAiCompanionLlm_shouldOverrideBothSmartTurnEntryPoints_whenTheSeamIsWired()
            throws NoSuchMethodException {
        assertThat(SpringAiCompanionLlm.class
            .getDeclaredMethod("completeSmart", String.class, String.class, List.class, String.class)
            .getDeclaringClass())
            .isEqualTo(SpringAiCompanionLlm.class);
        assertThat(SpringAiCompanionLlm.class
            .getDeclaredMethod("streamSmart", String.class, String.class, List.class, String.class)
            .getDeclaringClass())
            .isEqualTo(SpringAiCompanionLlm.class);
        assertThat(CompanionLlm.class
            .getDeclaredMethod("completeSmart", String.class, String.class, List.class, String.class)
            .isDefault())
            .isTrue();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=CompanionLlmSmartTurnTest,SpringAiSmartTurnOverrideTest
```
Expected: FAIL — `completeSmart(String, String, List, String)` does not exist.

- [ ] **Step 3: Write minimal implementation**

In `CompanionLlm.java`, after the existing `completeSmart` (`:120-122`):

```java
    /**
     * A full conversational turn on the SMART tier, carrying history and the split prompt halves —
     * but <b>no tools, by contract</b> (spec 2026-09-16 §6.5). That absence is the point: on OpenAI
     * a request carrying function tools has its reasoning effort forced to {@code none}
     * ({@code OpenAiCompanionLlm.optionsFor}), so a tool-free call is the only way a conversational
     * turn can think at all on Chat Completions.
     *
     * <p>The DEFAULT re-joins the halves and drops to the cheap path, which is right for the fake
     * and for any adapter with no smart model — but a real adapter MUST override it (spec §8.3).
     */
    default String completeSmart(String systemPrompt, String turnContext, List<Turn> history,
                                 String userMessage) {
        return complete(joinInstructions(systemPrompt, turnContext), history, userMessage,
            List.of(), Map.of());
    }

    /** Streamed twin of {@link #completeSmart(String, String, List, String)}. Also tool-free. */
    default Flux<String> streamSmart(String systemPrompt, String turnContext, List<Turn> history,
                                     String userMessage) {
        return stream(joinInstructions(systemPrompt, turnContext), history, userMessage,
            List.of(), Map.of());
    }
```

In `SpringAiCompanionLlm.java`, first give `request(..)` an explicit tier instead of the hardcoded `ModelTier.CHEAP` at `:379`:

```java
    private ChatClient.ChatClientRequestSpec request(String systemPrompt, String turnContext,
                                                     List<Turn> history,
                                                     String userMessage, List<ToolCallback> tools,
                                                     Map<String, Object> toolContext, String model,
                                                     ModelTier tier,
                                                     LlmRoundUsage tally) {
```

and inside it change the options line to:

```java
            .options(optionsFor(model, tier, !tools.isEmpty()))
```

Update the two existing callers to pass `ModelTier.CHEAP` explicitly — `:153` (inside `complete`) and `:241` (inside `stream`):

```java
            () -> request(systemPrompt, turnContext, history, userMessage, tools, toolContext,
                model, ModelTier.CHEAP, tally)
```

Then add the two overrides:

```java
    /**
     * The smart tier for a whole conversational turn (spec 2026-09-16). Overridden ON PURPOSE for
     * the same reason as {@link #completeSmart(String, String)}: the interface default drops to the
     * cheap tier, silently, with no error anywhere.
     */
    @Override
    public String completeSmart(String systemPrompt, String turnContext, List<Turn> history,
                                String userMessage) {
        String model = route(ModelTier.SMART, CallKind.SMART);
        CallSpec spec = new CallSpec(CallKind.SMART, model,
            CompanionLlm.joinInstructions(systemPrompt, turnContext), userMessage,
            ChatHistory.render(history), null, null, null, false);
        LlmRoundUsage tally = new LlmRoundUsage();
        return recorded(spec, tally,
            () -> request(systemPrompt, turnContext, history, userMessage, List.of(), Map.of(),
                model, ModelTier.SMART, tally)
                .call().chatResponse());
    }

    @Override
    public Flux<String> streamSmart(String systemPrompt, String turnContext, List<Turn> history,
                                    String userMessage) {
        String model = route(ModelTier.SMART, CallKind.SMART);
        CallSpec spec = new CallSpec(CallKind.SMART, model,
            CompanionLlm.joinInstructions(systemPrompt, turnContext), userMessage,
            ChatHistory.render(history), null, null, null, true);
        return streamRecorded(spec, model, ModelTier.SMART, systemPrompt, turnContext, history,
            userMessage);
    }
```

**Extract `streamRecorded`** from the body of the existing `stream(..)` (`:224-300`) so both streamed entry points share one recorder — the existing method becomes a two-line call passing `ModelTier.CHEAP` and its tools/toolContext, and the extracted method takes `(CallSpec spec, String model, ModelTier tier, String systemPrompt, String turnContext, List<Turn> history, String userMessage, List<ToolCallback> tools, Map<String, Object> toolContext)`. Keep every terminal-signal behaviour (complete ⇒ SUCCESS, error ⇒ ERROR, cancel ⇒ CANCELLED with the partial answer) exactly as it is — that CAS-guarded recorder is `mezo-1rz9` and must not change shape.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=CompanionLlmSmartTurnTest,SpringAiSmartTurnOverrideTest,OpenAiCompanionLlmOptionsTest,OpenAiProviderWiringIT -Dmezo.test.use-testcontainers=true
```
Expected: PASS — the two new tests plus the two existing provider guards still green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/SpringAiCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/CompanionLlmSmartTurnTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/SpringAiSmartTurnOverrideTest.java
git commit -m "feat(companion): tool-free smart-tier turn entry points (mezo-rj214.7)"
```

---

### Task 5: `FakeCompanionLlm` — make the CHAT branch observable

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlmGearTest.java`

**Interfaces:**
- Consumes: `GearClassifier.PROMPT` (Task 2), `CompanionLlm.completeSmart(String, String, List, String)` (Task 4).
- Produces: `FakeCompanionLlm.CHAT_GEAR_SENTINEL` — a public constant the ITs in Tasks 7 and 8 assert on to prove the tool-free branch ran.

**Why this task exists and must precede Tasks 7–8:** the fake dispatches on the **prompt prefix** (`FakeCompanionLlm.java:608-958`, fallthrough at `:954-957`). Without an explicit branch, a CHAT-gear turn falls through to the generic `FAKE-LLM system=[…] history=[…] user=[…]` echo, which is indistinguishable from today's path — so an IT could pass while the gear did nothing.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.GearClassifier;
import io.mrkuhne.mezo.feature.companion.service.TurnGear;
import java.util.List;
import org.junit.jupiter.api.Test;

class FakeCompanionLlmGearTest {

    private final FakeCompanionLlm fake = new FakeCompanionLlm();

    @Test
    void testComplete_shouldAnswerWithAGearWord_whenGivenTheClassifierPrompt() {
        String answer = fake.complete(GearClassifier.PROMPT, "Mennyit aludtam kedden?");

        assertThat(answer).isIn(TurnGear.CHAT.name(), TurnGear.LOOKUP.name(), TurnGear.ANALYSIS.name());
    }

    @Test
    void testCompleteSmart_shouldMarkTheToolFreeBranch_whenTheChatGearRuns() {
        String answer = fake.completeSmart("HANG", "KONTEXTUS", List.of(), "Szia!");

        assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
        assertThat(answer).contains("Szia!");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=FakeCompanionLlmGearTest
```
Expected: FAIL — `CHAT_GEAR_SENTINEL` does not exist, and the classifier prompt falls through to the generic echo.

- [ ] **Step 3: Write minimal implementation**

In `FakeCompanionLlm.java`, near the other marker constants (around `:49`):

```java
    /** Proves a turn took the tool-free smart branch — asserted by the gear ITs (mezo-rj214.7). */
    public static final String CHAT_GEAR_SENTINEL = "FAKE-CHAT-GEAR";
```

In `complete(String systemPrompt, String userMessage)` dispatch, **before** the generic fallthrough, add:

```java
        if (systemPrompt.startsWith(GearClassifier.PROMPT)) {
            // Mirror the deterministic analyzer so fixture questions classify the way a reader
            // expects; anything it cannot settle becomes ANALYSIS, exactly like the router.
            return GEAR_ANALYZER.analyze(userMessage).orElse(TurnGear.ANALYSIS).name();
        }
```

with a private static field `private static final TurnGearAnalyzer GEAR_ANALYZER = new TurnGearAnalyzer();`

Override the new smart entry point so the branch is visible:

```java
    @Override
    public String completeSmart(String systemPrompt, String turnContext, List<Turn> history,
                                String userMessage) {
        return CHAT_GEAR_SENTINEL + " " + PREFIX
            + " system=[" + CompanionLlm.joinInstructions(systemPrompt, turnContext) + "]"
            + " history=[" + ChatHistory.render(history) + "]"
            + " user=[" + userMessage + "]";
    }

    @Override
    public Flux<String> streamSmart(String systemPrompt, String turnContext, List<Turn> history,
                                    String userMessage) {
        return Flux.just(completeSmart(systemPrompt, turnContext, history, userMessage));
    }
```

**Import check:** `FakeCompanionLlm` now imports from `feature.companion.service`. Confirm no ArchUnit cycle is introduced — `feature_slices_are_cycle_free` operates on feature slices, and both packages are inside `feature/companion`, so this is intra-slice and legal. Run the ArchUnit test in Step 4 to prove it rather than assuming.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=FakeCompanionLlmGearTest,ArchitectureTest -Dmezo.test.use-testcontainers=true
```
Expected: PASS — the fake exposes both branches and no architecture rule broke.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlmGearTest.java
git commit -m "test(companion): fake dispatches the classifier prompt and marks the CHAT gear (mezo-rj214.7)"
```

---

### Task 6: Guard the existing prompt-order ITs (slice S9.2)

**Files:**
- Modify (as the audit finds): `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`, `ChatServiceAmbientRecallIT.java`, `graph/ChatServiceGraphBlockIT.java`, `graph/ChatServiceGraphBlockFailureIT.java`, `ChatMemoryRolloutIT.java`, `CompanionLlmFakeIT.java`, `service/AnchoredConversationIT.java`, `ChatStreamServiceIT.java`
- Test: the same files (this task changes tests only)

**Interfaces:**
- Consumes: `TurnGearAnalyzer.analyze(String)` (Task 1) — used as the audit oracle.
- Produces: nothing new. The deliverable is that **no existing IT changes meaning** when Tasks 7–8 land.

**Why this must precede Tasks 7–8 (spec §11 R2):** roughly a dozen ITs assert prompt-block ORDER by slicing `system=[…] history=[…] user=[…]` out of the fake's echo (`ChatServiceIT:182-260`, `:379-435`). Once the gear router is live, any of those whose fixture message classifies as `CHAT` will silently start asserting the **lightened** context — and will still pass, while testing nothing. A silently-vacuous test is worse than a failing one.

- [ ] **Step 1: Write the failing test (the audit, as an executable guard)**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.TurnGear;
import io.mrkuhne.mezo.feature.companion.service.TurnGearAnalyzer;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Prompt-order ITs assert the FULL volatile context. A fixture message that classifies as CHAT
 * would take the lightened branch and make those assertions vacuous, so every quoted fixture
 * message in those files must be a data-bearing one.
 */
class PromptOrderFixtureGearGuardTest {

    private static final List<String> GUARDED_FILES = List.of(
        "ChatServiceIT.java",
        "ChatServiceAmbientRecallIT.java",
        "ChatMemoryRolloutIT.java",
        "CompanionLlmFakeIT.java",
        "graph/ChatServiceGraphBlockIT.java",
        "graph/ChatServiceGraphBlockFailureIT.java",
        "service/AnchoredConversationIT.java",
        "ChatStreamServiceIT.java");

    /**
     * How these files spell a fixture message. `ChatServiceIT` uses a local helper —
     * `request("szia")` over `SendMessageRequest.builder().content(content).build()` — so matching
     * only `setContent(..)` would find NOTHING and the guard would pass while testing nothing.
     */
    private static final Pattern FIXTURE_MESSAGE =
        Pattern.compile("(?:request|setContent|content)\\(\"([^\"]+)\"\\)");

    private final TurnGearAnalyzer analyzer = new TurnGearAnalyzer();

    @Test
    void testFixtureMessages_shouldNeverClassifyAsChat_whenTheyAssertPromptOrder() throws IOException {
        Path base = Path.of("src/test/java/io/mrkuhne/mezo/feature/companion");
        List<String> offenders = new ArrayList<>();
        for (String file : GUARDED_FILES) {
            Path path = base.resolve(file);
            if (!Files.exists(path)) {
                continue;
            }
            String source = Files.readString(path, StandardCharsets.UTF_8);
            Matcher matcher = FIXTURE_MESSAGE.matcher(source);
            while (matcher.find()) {
                String message = matcher.group(1);
                if (analyzer.analyze(message).filter(TurnGear.CHAT::equals).isPresent()) {
                    offenders.add(file + " -> \"" + message + "\"");
                }
            }
        }
        assertThat(offenders)
            .as("these fixture messages would take the lightened CHAT branch and make the "
                + "prompt-order assertions vacuous; give them a domain or time word")
            .isEmpty();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=PromptOrderFixtureGearGuardTest
```
Expected: FAIL, listing every fixture message that would flip to the CHAT gear. **It WILL fail** — `ChatServiceIT:64` sends `request("szia")`, and `"szia"` is the canonical CHAT message. That test asserts the persona line (`"Te vagy a mezo, Anna…"`), which survives the lightened branch, so it would keep passing while silently no longer covering the full prompt assembly it was written for.

- [ ] **Step 3: Fix each offender**

For every listed message, make it data-bearing by adding a domain or time word, keeping the test's intent. Example rewrite:

```java
// before: request.setContent("Mesélj valamit");
request.setContent("Mesélj az edzéseimről a héten");
```

Do **not** change what the test asserts — only the fixture message. If a test genuinely means to exercise a tool-free greeting, move it out of `GUARDED_FILES` and add an explicit assertion that it takes the CHAT branch (`assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL)`) once Task 7 lands.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=PromptOrderFixtureGearGuardTest,ChatServiceIT,ChatStreamServiceIT -Dmezo.test.use-testcontainers=true
```
Expected: PASS — the guard is green AND the rewritten fixtures still satisfy their original assertions.

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/
git commit -m "test(companion): guard prompt-order fixtures against the CHAT gear (mezo-rj214.7)"
```

---

### Task 7: Wire the gear into the synchronous path

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:252-311` (`sendMessage`), plus a new private helper
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceGearIT.java`

**Interfaces:**
- Consumes: `TurnGearRouter.route(String)` (Task 2), `CompanionLlm.completeSmart(String, String, List, String)` (Task 4), `FakeCompanionLlm.CHAT_GEAR_SENTINEL` (Task 5), `CompanionProperties.turn()` (Task 3).
- Produces: `ChatService.chatGearContext(UUID userId, LocalDate today) → String` (private) — the lightened volatile half.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** The gear branch against the deterministic fake — the fake echoes its inputs, so the assembled
 *  prompt is observable in the answer (same trick as ChatServiceIT). */
@Transactional
@ActiveProfiles("companion-fake")
class ChatServiceGearIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private UserPopulator userPopulator;

    /** One owner, one conversation, one turn — returns the assistant's content. */
    private String sendAndReturnAnswer(String content) {
        AppUserEntity user = userPopulator.createUser("gear-" + UUID.randomUUID() + "@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(user.getId());
        return chatService.sendMessage(user.getId(), conversation.getId(),
            SendMessageRequest.builder().content(content).build()).getContent();
    }

    @Test
    void testSendMessage_shouldTakeTheToolFreeBranch_whenTheTurnNeedsNoData() {
        String answer = sendAndReturnAnswer("Mit gondolsz a kreatinról?");

        assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }

    @Test
    void testSendMessage_shouldOmitTheHeavyContextBlocks_whenTheTurnNeedsNoData() {
        String answer = sendAndReturnAnswer("Mit gondolsz a kreatinról?");

        // The voice survives; the expensive volatile blocks do not.
        assertThat(answer).contains("Te vagy a mezo");
        assertThat(answer).doesNotContain("AKTUÁLIS ÁLLAPOT");
        assertThat(answer).doesNotContain("[Emlékek]");
        assertThat(answer).doesNotContain("[Összefüggések]");
    }

    @Test
    void testSendMessage_shouldKeepTodaysPath_whenTheTurnAsksForData() {
        String answer = sendAndReturnAnswer("Mennyit aludtam kedden?");

        assertThat(answer).doesNotContain(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
        assertThat(answer).contains("AKTUÁLIS ÁLLAPOT");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=ChatServiceGearIT -Dmezo.test.use-testcontainers=true
```
Expected: FAIL — the sentinel is absent; every turn still takes the tool-bearing path.

- [ ] **Step 3: Write minimal implementation**

Inject `TurnGearRouter turnGearRouter` into `ChatService` (constructor field, `@RequiredArgsConstructor` already present).

Add the lightened context builder next to `turnContext(..)` (`:378`):

```java
    /**
     * The volatile half for a CHAT-gear turn (spec 2026-09-16 §6.5): the voice's companion pieces
     * only. No snapshot digest, no week, no facts, no reflection, no character, no memories, no
     * graph — a turn that needs none of the user's data should not pay to carry all of it.
     */
    private String chatGearContext(UUID userId, LocalDate today) {
        return promptPersona.render(userId, "\n\nMa: " + today + "\n"
                + profileBlock(userId)
                + TONE_REMINDER);
    }
```

In `sendMessage`, replace the single prompt assembly and LLM round with a gear branch. After `List<Turn> history = toTurns(loadWindow(userId, conversationId));` (`:260`):

```java
        TurnGear gear = turnGearRouter.route(request.getContent());
```

Then guard the expensive preparation — `chatMemoryContextAdapter.resolve(..)` triggers an embedding call and a graph traversal, so a CHAT turn must not run it:

```java
        String systemPrompt = stableSystemPrompt(userId);
        ChatMemoryPayload memory = gear == TurnGear.CHAT
                ? ChatMemoryPayload.empty()
                : chatMemoryContextAdapter.resolve(
                        userId, conversationId, request.getContent(), history, today);
        String turnCtx = gear == TurnGear.CHAT
                ? chatGearContext(userId, today)
                : turnContext(userId, today, memory.factsBlock(),
                        memory.memoriesBlock(), memory.graphBlock(),
                        conversation.getContextKind(), conversation.getContextDate());
```

`ChatMemoryPayload` is the nested record at `ChatMemoryContextAdapter.java:107-113` with five components — `factsBlock`, `memoriesBlock`, `graphBlock`, `refs`, `recalled`. It has no `empty()` factory; add one to the record so the CHAT branch and any future skip-path share one shape:

```java
    public record ChatMemoryPayload(
            String factsBlock,
            String memoriesBlock,
            String graphBlock,
            List<RefsEnvelope.Ref> refs,
            RecalledMemoriesEnvelope recalled) {

        /** Nothing was resolved — the turn deliberately skipped retrieval (spec 2026-09-16 §6.5). */
        public static ChatMemoryPayload empty() {
            return new ChatMemoryPayload("", "", "", List.of(), null);
        }
    }
```

Replace the LLM round (`:279-291`) so a CHAT turn bypasses both the advisor chain and the tools:

```java
        if (gear == TurnGear.CHAT) {
            // Tool-free and smart-tier: the ONLY shape in which a conversational turn can carry
            // reasoning on OpenAI Chat Completions (OpenAiCompanionLlm.optionsFor).
            answer = llmCallContextHolder.runWith(turnContext,
                    () -> companionLlm.completeSmart(systemPrompt, turnCtx, history, request.getContent()));
        } else if (chain != null) {
            ... unchanged ...
        } else {
            ... unchanged ...
        }
```

Leave the blank-answer guard, the ref merge, persistence and the `ChatTurnCompleted` event untouched — a CHAT turn simply contributes an empty audit, which `toToolCallsEnvelope()`/`toRefsEnvelope()` already render as `null`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=ChatServiceGearIT,ChatServiceIT,ChatServiceAmbientRecallIT,PromptOrderFixtureGearGuardTest -Dmezo.test.use-testcontainers=true
```
Expected: PASS — the new gear IT green AND every pre-existing prompt-order IT still green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceGearIT.java
git commit -m "feat(companion): CHAT gear takes the tool-free smart path on send (mezo-rj214.7)"
```

---

### Task 8: Wire the gear into the streamed path

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java:63-133` (`streamMessage`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `prepareTurn` (`:215`) must carry the gear
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceGearIT.java`

**Interfaces:**
- Consumes: everything from Task 7.
- Produces: `PreparedTurn` gains a `TurnGear gear` component (record at `ChatService.java:203`). Every existing constructor call must be updated — there is exactly one, in `prepareTurn`.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Deliberately NOT {@code @Transactional} — the streamed path runs prepareTurn and completeTurn in
 * separate transactions through the proxy, exactly as {@code ChatStreamServiceIT} documents.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.serving-mode=OLD")
class ChatStreamServiceGearIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private List<ServerSentEvent<Object>> stream(String content) {
        UUID userId = databasePopulator.populateUser("gear-stream-" + UUID.randomUUID() + "@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        return chatStreamService.streamMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content(content).build())
            .collectList().block();
    }

    /** The terminal row carries the persisted assistant message — the fake's echo lives there. */
    private static String doneContent(List<ServerSentEvent<Object>> events) {
        return events.stream()
            .filter(e -> "done".equals(e.event()))
            .map(e -> ((MessageResponse) e.data()).getContent())
            .findFirst()
            .orElseThrow(() -> new AssertionError("the stream ended without a done event"));
    }

    @Test
    void testStreamMessage_shouldTakeTheToolFreeBranch_whenTheTurnNeedsNoData() {
        assertThat(doneContent(stream("Mit gondolsz a kreatinról?")))
            .contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }

    @Test
    void testStreamMessage_shouldStillEndWithDone_whenTheChatGearRuns() {
        List<ServerSentEvent<Object>> events = stream("Mit gondolsz a kreatinról?");

        assertThat(events.getLast().event()).isEqualTo("done");
    }

    @Test
    void testStreamMessage_shouldKeepTodaysPath_whenTheTurnAsksForData() {
        assertThat(doneContent(stream("Mennyit aludtam kedden?")))
            .doesNotContain(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=ChatStreamServiceGearIT -Dmezo.test.use-testcontainers=true
```
Expected: FAIL — the sentinel never appears on the streamed path.

- [ ] **Step 3: Write minimal implementation**

In `ChatService.prepareTurn`, compute the gear and put it on the record:

```java
    public record PreparedTurn(UUID conversationId, UUID userMessageId, String systemPrompt,
                               String turnContext, List<Turn> history, String userContent,
                               List<MemoryRef> recalledRefs, String recalled, TurnGear gear) {}
```

and inside `prepareTurn` apply the same branch Task 7 added to `sendMessage` — route the gear, skip `chatMemoryContextAdapter.resolve(..)` for `CHAT`, and build `chatGearContext(..)` instead of `turnContext(..)`. Pass `gear` as the new last constructor argument.

In `ChatStreamService.streamMessage`, branch the model round. Replace the `companionLlm.stream(..)` call (`:82-86`) with:

```java
        Flux<String> deltas = prepared.gear() == TurnGear.CHAT
            ? llmCallContextHolder.runWith(streamContext,
                () -> companionLlm.streamSmart(prepared.systemPrompt(), prepared.turnContext(),
                    prepared.history(), prepared.userContent()))
            : llmCallContextHolder.runWith(streamContext,
                () -> companionLlm.stream(prepared.systemPrompt(), prepared.turnContext(),
                    prepared.history(), prepared.userContent(),
                    toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
```

and skip the advisor review for a CHAT turn — wrap the trailing `Mono.fromCallable` (`:96-124`) so it returns the answer untouched when `prepared.gear() == TurnGear.CHAT`. Keep the blank-answer guard (`:115`) and `completeTurn` on both branches: a CHAT turn still persists an assistant row, still fires `ChatTurnCompleted`, and still ends with a `done` event.

**Do not add a `phase` SSE event in this task.** `ChatStreamServiceIT:106-110` asserts that every event before the last is a `delta`, and the event schema lives in `api/feature/companion/companion.yml:533-567` behind the contract-drift gate. Phase events are slice S9.6.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && ./mvnw clean test -Dtest=ChatStreamServiceGearIT,ChatStreamServiceIT,ChatServiceGearIT,ChatServiceIT -Dmezo.test.use-testcontainers=true
```
Expected: PASS — both gear ITs and both pre-existing turn ITs green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceGearIT.java
git commit -m "feat(companion): CHAT gear on the streamed path (mezo-rj214.7)"
```

---

### Task 9: Docs, codemap and tracker

**Files:**
- Modify: `docs/features/companion.md` (§3 prompt assembly, §4 config keys, §5.3 LLM seam)
- Modify: `docs/CODEMAP.md` (regenerated, never hand-edited)
- Test: `node scripts/lint-docs.mjs`, `node scripts/gen-codemap.mjs --check`

**Interfaces:**
- Consumes: everything built in Tasks 1–8.
- Produces: nothing code-facing. This task is the `AGENTS.md` docs mandate — *"If a finished piece of work leaves no trace in `docs/` of the decision behind it, the work is not done."*

- [ ] **Step 1: Update the feature doc**

In `docs/features/companion.md`:
- §3 (turn pipeline): describe the gear branch — deterministic analyzer → cheap classifier on UNSURE → `CHAT` takes `completeSmart(system, turnContext, history, user)` with no tools and a lightened volatile half; `LOOKUP`/`ANALYSIS` unchanged in this slice.
- §3 (prompt assembly): document the `chatGearContext` block list (`Ma:` line + `[Rólad tanultam]` + `TONE_REMINDER`) beside the full `turnContext` list.
- §4 (config): add `mezo.companion.turn.gear.classifier-enabled` and `mezo.companion.turn.answerer.chat-effort` with their defaults.
- §5.3: correct the retired port description flagged in `mezo-rj214.8` while you are in the file — the seam is the six-arg stable/volatile form over `SpringAiCompanionLlm`, with `OpenAiCompanionLlm` as the production adapter, and it now has two tool-free smart entry points.
- While in the file, fix the tool count: it says 15 tools / 9 toolsets in ≥6 places; the real number is **18 across 10 toolsets** (`mezo-rj214.8`).

- [ ] **Step 2: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 3: Run the doc gates**

```bash
node scripts/lint-docs.mjs
node scripts/gen-codemap.mjs --check
```
Expected: `gen-codemap --check` clean. `lint-docs` currently FAILS on 17 pre-existing stale docs (`mezo-74iz`) — confirm `companion.md` is **not** among them after your edit, and do not try to fix the other 16 here.

- [ ] **Step 4: Update the tracker**

```bash
bd update mezo-rj214.7 --append-notes "S9.1-S9.3 shipped: TurnGear/TurnGearAnalyzer/GearClassifier/TurnGearRouter, mezo.companion.turn config, tool-free smart entry points on CompanionLlm+SpringAiCompanionLlm, fake CHAT_GEAR_SENTINEL, prompt-order fixture guard, both turn paths wired. S9.4-S9.8 remain."
node scripts/check-beads-backup.mjs --fix
```

- [ ] **Step 5: Commit**

```bash
git add docs/features/companion.md docs/CODEMAP.md .beads/issues.jsonl
git commit -m "docs(companion): turn gear + tool-free smart seam (mezo-rj214.7)"
```

---

## Done criteria for this plan

1. `./mvnw clean test -Dmezo.test.use-testcontainers=true` green locally for the companion package.
2. A turn like *"Mit gondolsz a kreatinról?"* carries **no** tool schemas, runs on the SMART tier, and its `llm_log` row shows `call_kind = SMART` with a non-null `thoughts` token count on a real provider key.
3. A turn like *"Mennyit aludtam kedden?"* is byte-identical to today's behaviour.
4. `ToolSelectionEvalIT` unchanged and still green — its 42 cases are all data-bearing, so none should flip to the CHAT gear. **Verify this explicitly**: if any case does flip, that is a finding about the analyzer, not about the eval.
5. Branch pushed, self-PR opened, CI green, then `premerge.yml` re-run against current main before merging.
