# OpenAI migráció S3 — eval re-baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `ToolSelectionEvalIT` mérőpad legyen provider-/modell-tudatos (a kapuja ne hazudjon), mérjen exact-matchet, kritikus rossz toolt, JSON-érvényességet, latenciát és USD-t, majd a három modellen (`gemini-2.5-flash` incumbent, `gpt-5.6-luna`, `gpt-5.6-terra`) lefuttatva döntsük el írásban a default modellt.

**Architecture:** Egyetlen rendszer-property (`-Dmezo.eval.model=<modell>`) választja ki a mérendő modellt; abból származik a provider, a kulcs-környezeti változó neve és a Spring-konfiguráció (`@DynamicPropertySource`). A kapu egy saját JUnit `ExecutionCondition`: kulcs nélkül **skip**, ha nem kértek explicit modellt, és **hangos hiba**, ha igen. A mérés minden számot a meglévő `llm_log_history` sorokból vesz (token, USD, latencia, served_model) — ez egyben a streamelt/OpenAI-oldali költségkönyvelés élő ellenőrzése is. A metrika- és riport-logika tiszta (network-free) osztályokban él, unit-tesztelve; az IT csak összeköt és fájlba ír.

**Tech Stack:** Java 25, Spring Boot 3.5 / Spring AI 2.0.1, JUnit 5 (`ExecutionCondition`, `@DynamicPropertySource`), AssertJ, Awaitility, Testcontainers (`AbstractIntegrationTest`), Jackson (`tools.jackson`).

## Global Constraints

- **Egy szelet = egy bd jegy = egy ág:** `mezo-ozri.3`, ág `feat/openai-eval-rebaseline`, conventional commit a bd id-vel: `test(companion): ... (mezo-ozri.3)`.
- **Minden hangolható érték `application.yml`-be megy `@ConfigurationProperties` recordon át.** A `@Value` ArchUnit-tiltott (`no_spring_value_annotation`). Ebben a szeletben **nincs új main-config kulcs** — a mérés rendszer-propertyvel vezérelt, teszt-scope-ban.
- **Prompt-szöveg NEM módosul.** A `FakeCompanionLlm` prefix-alapú dispatchje a `CompanionMessageGenerator:75,100,114,139` prompt-kezdeteire épül; egy átfogalmazás a 178 fake-profilos ITt viszi el.
- **A `GEMINI_API_KEY` marad** (embedding, audio, fallback), az `OPENAI_API_KEY` mellé jön. Mindkettő elérhető a fejlesztői gépen (Keychain + `~/.zshenv`), CI-ban egyik sem.
- **A `@Tag("eval")` marad**: a surefire `excludedGroups` kizárja az alap futásból, a CI kritikus útján ez a suite soha nem fut.
- **Új teszt-fájl a `feature/companion/llm` alatt nincs**, de ha bármelyik lépés main-oldali fájlt ad hozzá vagy nevez át, a `docs/CODEMAP.md`-t **ugyanabban a változásban** regenerálni kell.
- **Pénzt költünk:** minden futás valós API-hívás. Egy 42 esetes kör nagyságrendje néhány cent (Luna) – néhány tíz cent (Terra); a tone-judge kör ennél is kevesebb.
- Modellnevek kizárólag configból/rendszer-propertyből — Java kódban modell-azonosító nem születik (a jelenlegi kódbázisban egy sincs, csak javadocban).

---

## File Structure

**Új fájlok (mind teszt-scope, `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/`):**

| Fájl | Felelősség |
|---|---|
| `EvalTarget.java` | A mérendő modell → provider + kulcs-env-var + explicit-e. Tiszta, hálózatmentes. |
| `EvalApiKeyCondition.java` | JUnit `ExecutionCondition`: skip vs. hangos hiba. |
| `ToolDomains.java` | tool-név → domain (train, fuel, biometrics, …) a „kritikus rossz tool" definíciójához. |
| `ToolSelectionEvalMetrics.java` | Tiszta metrika-számoló: exact match, hit, kritikus rossz tool, JSON-érvényesség, p50/p95 latencia, USD/sikeres akció. |
| `EvalReportWriter.java` | `EvalReport` → Markdown. Tiszta formázó. |
| `ToneJudgeEvalIT.java` | Vak A/B hangnem-bíráskodás két korábbi futás válasz-artefaktjai fölött. |
| `ToneJudgePairing.java` | Tiszta párosítás/anonimizálás + verdict-parse. |

**Új unit tesztek (`backend/src/test/java/.../eval/`):** `EvalTargetTest`, `EvalApiKeyConditionTest`, `ToolSelectionEvalMetricsTest`, `EvalReportWriterTest`, `ToneJudgePairingTest`.

**Módosuló fájlok:**

| Fájl | Munka |
|---|---|
| `ToolSelectionEvalIT.java:53` | `@EnabledIfEnvironmentVariable(GEMINI_API_KEY)` → `@ExtendWith(EvalApiKeyCondition.class)`; `@DynamicPropertySource`; `@Transactional` **eltávolítása**; per-eset `llm_log` mérés; riport- és válasz-artefakt írása. |
| `docs/research/comparisons/companion-chat-model-rebaseline-2026-09.md` | ÚJ: a három futás riportja + a default modell írásos indoklása. |
| `docs/research/index.md`, `docs/research/log.md` | Az új lap bekötése (knowledge-base skill). |
| `docs/features/companion.md` | Az eval-kapu leírása: az új futtatási parancs + mit mér. |

---

### Task 1: Modell-választó és provider-tudatos kapu

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/EvalTarget.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/EvalApiKeyCondition.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/EvalTargetTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/EvalApiKeyConditionTest.java`

**Interfaces:**
- Consumes: `io.mrkuhne.mezo.feature.companion.config.LlmProvider` (`GEMINI`, `OPENAI`).
- Produces:
  - `EvalTarget` record: `model()`, `provider()`, `apiKeyEnvVar()`, `explicit()`, `providerKey()` (a yaml-beli kisbetűs név: `gemini`/`openai`), statikus `fromSystemProperties()`, `of(String model, boolean explicit)`, `keyPresentIn(Map<String,String> env)`; konstans `MODEL_PROPERTY = "mezo.eval.model"`, `DEFAULT_MODEL = "gemini-2.5-flash"`.
  - `EvalApiKeyCondition implements ExecutionCondition` — `@ExtendWith`-tel felrakható; a döntést a csomagláthatóságú `EvalApiKeyCondition.decide(EvalTarget, Map<String,String> env)` adja, ez a unit-tesztelt felület.

- [ ] **Step 1: Write the failing test — `EvalTargetTest`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EvalTargetTest {

    @Test
    void testOf_shouldRouteGptNamesToOpenAi_whenModelNameIsAGptModel() {
        EvalTarget target = EvalTarget.of("gpt-5.6-luna", true);

        assertThat(target.provider()).isEqualTo(LlmProvider.OPENAI);
        assertThat(target.providerKey()).isEqualTo("openai");
        assertThat(target.apiKeyEnvVar()).isEqualTo("OPENAI_API_KEY");
        assertThat(target.explicit()).isTrue();
    }

    @Test
    void testOf_shouldRouteGeminiNamesToGemini_whenModelNameIsAGeminiModel() {
        EvalTarget target = EvalTarget.of("gemini-2.5-flash", false);

        assertThat(target.provider()).isEqualTo(LlmProvider.GEMINI);
        assertThat(target.providerKey()).isEqualTo("gemini");
        assertThat(target.apiKeyEnvVar()).isEqualTo("GEMINI_API_KEY");
    }

    @Test
    void testOf_shouldRefuseTheRun_whenModelNameBelongsToNoKnownProvider() {
        assertThatThrownBy(() -> EvalTarget.of("mistral-large", true))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("mistral-large");
    }

    @Test
    void testKeyPresentIn_shouldRejectBlankKeys_whenTheEnvVarIsSetButEmpty() {
        EvalTarget target = EvalTarget.of("gpt-5.6-luna", true);

        assertThat(target.keyPresentIn(Map.of("OPENAI_API_KEY", "sk-real"))).isTrue();
        assertThat(target.keyPresentIn(Map.of("OPENAI_API_KEY", "   "))).isFalse();
        assertThat(target.keyPresentIn(Map.of())).isFalse();
    }
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && ./mvnw test -Dtest=EvalTargetTest`
Expected: FAIL — `EvalTarget` nem létezik (compilation failure).

- [ ] **Step 3: Write the minimal implementation — `EvalTarget`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import java.util.Locale;
import java.util.Map;

/**
 * Which chat model this eval run measures, and everything derivable from that name (mezo-ozri.3).
 *
 * <p>One system property drives the whole harness: {@code -Dmezo.eval.model=gpt-5.6-luna}. The
 * provider, the API-key env var and the Spring properties the IT injects all follow from it, so a
 * run can never end up measuring one model while gating on another provider's key — which is
 * exactly what the pre-S3 {@code @EnabledIfEnvironmentVariable("GEMINI_API_KEY")} gate would have
 * done after the OpenAI switch: silently skip, and report green.
 *
 * <p>{@link #explicit()} is the difference between "nobody asked for a model" (absent key = skip,
 * so a keyless CI stays green) and "somebody asked for THIS model" (absent key = loud failure).
 */
public record EvalTarget(String model, LlmProvider provider, String apiKeyEnvVar, boolean explicit) {

    public static final String MODEL_PROPERTY = "mezo.eval.model";
    public static final String DEFAULT_MODEL = "gemini-2.5-flash";

    /** Reads {@link #MODEL_PROPERTY}; absent or blank = the incumbent, non-explicitly. */
    public static EvalTarget fromSystemProperties() {
        String raw = System.getProperty(MODEL_PROPERTY);
        boolean explicit = raw != null && !raw.isBlank();
        return of(explicit ? raw.trim() : DEFAULT_MODEL, explicit);
    }

    public static EvalTarget of(String model, boolean explicit) {
        LlmProvider provider = providerOf(model);
        String envVar = provider == LlmProvider.OPENAI ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
        return new EvalTarget(model, provider, envVar, explicit);
    }

    private static LlmProvider providerOf(String model) {
        if (model.startsWith("gpt-")) {
            return LlmProvider.OPENAI;
        }
        if (model.startsWith("gemini-")) {
            return LlmProvider.GEMINI;
        }
        throw new IllegalArgumentException(
            "Unknown eval model '" + model + "' — " + MODEL_PROPERTY + " takes a gpt-* or gemini-* name");
    }

    /** The yaml vocabulary of {@code mezo.companion.llm.provider}: lowercase enum name. */
    public String providerKey() {
        return provider.name().toLowerCase(Locale.ROOT);
    }

    public boolean keyPresentIn(Map<String, String> env) {
        String value = env.get(apiKeyEnvVar);
        return value != null && !value.isBlank();
    }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `cd backend && ./mvnw test -Dtest=EvalTargetTest`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test — `EvalApiKeyConditionTest`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;

class EvalApiKeyConditionTest {

    @Test
    void testDecide_shouldEnable_whenTheTargetProvidersKeyIsPresent() {
        var result = EvalApiKeyCondition.decide(
            EvalTarget.of("gpt-5.6-luna", true), Map.of("OPENAI_API_KEY", "sk-real"));

        assertThat(result.isDisabled()).isFalse();
    }

    @Test
    void testDecide_shouldSkipQuietly_whenNoModelWasRequestedAndTheIncumbentKeyIsAbsent() {
        var result = EvalApiKeyCondition.decide(EvalTarget.of("gemini-2.5-flash", false), Map.of());

        assertThat(result.isDisabled()).isTrue();
        assertThat(result.getReason()).get().asString().contains("GEMINI_API_KEY");
    }

    @Test
    void testDecide_shouldFailLoudly_whenAModelWasRequestedButItsProvidersKeyIsAbsent() {
        assertThatThrownBy(() -> EvalApiKeyCondition.decide(
                EvalTarget.of("gpt-5.6-luna", true), Map.of("GEMINI_API_KEY", "present")))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("OPENAI_API_KEY")
            .hasMessageContaining("gpt-5.6-luna");
    }
}
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `cd backend && ./mvnw test -Dtest=EvalApiKeyConditionTest`
Expected: FAIL — `EvalApiKeyCondition` nem létezik.

- [ ] **Step 7: Write the minimal implementation — `EvalApiKeyCondition`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import java.util.Map;
import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;

/**
 * The eval gate, which must not lie (mezo-ozri.3). The pre-S3 gate named {@code GEMINI_API_KEY}
 * unconditionally: after the provider switch it would have skipped the ONE real chat-quality
 * measurement in silence and reported green.
 *
 * <p>Two outcomes, deliberately asymmetric:
 * <ul>
 *   <li><b>Nobody asked for a model</b> (no {@code -Dmezo.eval.model}) and the incumbent key is
 *       absent → skip. A keyless CI stays green; this suite is opt-in twice over anyway.</li>
 *   <li><b>Somebody asked for THIS model</b> and its provider's key is absent → throw. A requested
 *       measurement that cannot run is a failure, never a silent pass.</li>
 * </ul>
 */
public class EvalApiKeyCondition implements ExecutionCondition {

    @Override
    public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
        return decide(EvalTarget.fromSystemProperties(), System.getenv());
    }

    static ConditionEvaluationResult decide(EvalTarget target, Map<String, String> env) {
        if (target.keyPresentIn(env)) {
            return ConditionEvaluationResult.enabled(
                "Eval target " + target.model() + " (" + target.providerKey() + "), key present");
        }
        if (target.explicit()) {
            throw new IllegalStateException(
                "Eval run requested " + EvalTarget.MODEL_PROPERTY + "=" + target.model()
                    + " but " + target.apiKeyEnvVar() + " is not set — the measurement cannot run, "
                    + "and skipping it would report a green gate for a model nobody measured (mezo-ozri.3)");
        }
        return ConditionEvaluationResult.disabled(
            "No " + EvalTarget.MODEL_PROPERTY + " requested and " + target.apiKeyEnvVar()
                + " is absent — incumbent eval skipped");
    }
}
```

- [ ] **Step 8: Run the test and make sure it passes**

Run: `cd backend && ./mvnw test -Dtest=EvalApiKeyConditionTest`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/
git commit -m "test(companion): provider-aware eval target and gate (mezo-ozri.3)"
```

---

### Task 2: Metrikák és riport-formázó (tiszta logika)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToolDomains.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToolSelectionEvalMetrics.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/EvalReportWriter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToolSelectionEvalMetricsTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/EvalReportWriterTest.java`

**Interfaces:**
- Produces:
  - `ToolDomains.domainOf(String toolName)` → `Optional<String>` (a 18 `@Tool` név domain-jei: `train`, `fuel`, `biometrics`, `insights`, `goal`, `lifegoal`, `growth`, `memory`, `medication`, `practice`). Ismeretlen név = `Optional.empty()` → kritikusnak számít.
  - `ToolSelectionEvalMetrics.CaseOutcome` record: `id`, `question`, `expected` (List&lt;String&gt;), `actual` (List&lt;String&gt;), `latencyMs` (long), `costUsd` (BigDecimal), `jsonValid` (boolean), `errored` (boolean).
  - `ToolSelectionEvalMetrics.EvalReport` record: `model`, `cases`, `hits`, `exactMatches`, `criticalWrongTools`, `errors`, `hitRate`, `exactMatchRate`, `jsonValidRate`, `latencyP50`, `latencyP95` (long), `costPerSuccessP50`, `costPerSuccessP95`, `totalCostUsd` (BigDecimal), `misses` (List&lt;String&gt;), `criticalDetails` (List&lt;String&gt;).
  - `ToolSelectionEvalMetrics.evaluate(String model, List<CaseOutcome>)` → `EvalReport`.
  - `EvalReportWriter.toMarkdown(EvalReport)` → `String`.

- [ ] **Step 1: Write the failing test — `ToolSelectionEvalMetricsTest`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.CaseOutcome;
import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.EvalReport;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ToolSelectionEvalMetricsTest {

    private static CaseOutcome outcome(String id, List<String> expected, List<String> actual, long latencyMs, String cost) {
        return new CaseOutcome(id, "kérdés " + id, expected, actual, latencyMs, new BigDecimal(cost), true, false);
    }

    @Test
    void testEvaluate_shouldSeparateHitFromExactMatch_whenAnExtraToolRidesAlong() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_training_plan"), 1000, "0.001"),
            outcome("b", List.of("get_training_plan"), List.of("get_training_plan", "get_training_log"), 1000, "0.001")));

        assertThat(report.hits()).isEqualTo(2);
        assertThat(report.exactMatches()).isEqualTo(1);
        assertThat(report.exactMatchRate()).isEqualTo(0.5);
    }

    @Test
    void testEvaluate_shouldCountACrossDomainToolAsCritical_whenNoExpectedToolSharesItsDomain() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_fuel_log"), 1000, "0.001"),
            outcome("b", List.of("get_training_plan"), List.of("get_training_log"), 1000, "0.001")));

        assertThat(report.criticalWrongTools()).isEqualTo(1);
        assertThat(report.criticalDetails()).singleElement().asString().contains("get_fuel_log");
    }

    @Test
    void testEvaluate_shouldTreatAnUnknownToolNameAsCritical_whenTheDomainMapDoesNotKnowIt() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_something_new"), 1000, "0.001")));

        assertThat(report.criticalWrongTools()).isEqualTo(1);
    }

    @Test
    void testEvaluate_shouldReportNearestRankPercentiles_whenLatenciesSpanTheCaseSet() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_training_plan"), 100, "0.001"),
            outcome("b", List.of("get_training_plan"), List.of("get_training_plan"), 200, "0.002"),
            outcome("c", List.of("get_training_plan"), List.of("get_training_plan"), 300, "0.003"),
            outcome("d", List.of("get_training_plan"), List.of("get_training_plan"), 4000, "0.004")));

        assertThat(report.latencyP50()).isEqualTo(200);
        assertThat(report.latencyP95()).isEqualTo(4000);
        assertThat(report.costPerSuccessP50()).isEqualByComparingTo("0.002");
        assertThat(report.totalCostUsd()).isEqualByComparingTo("0.010");
    }

    @Test
    void testEvaluate_shouldExcludeMissesFromCostPerSuccessfulAction_whenACaseSelectedNoRightTool() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_training_plan"), 100, "0.001"),
            outcome("b", List.of("get_training_plan"), List.of(), 100, "9.000")));

        assertThat(report.costPerSuccessP50()).isEqualByComparingTo("0.001");
        assertThat(report.totalCostUsd()).isEqualByComparingTo("9.001");
        assertThat(report.misses()).singleElement().asString().contains("[b]");
    }

    @Test
    void testEvaluate_shouldReportJsonValidityAndErrorsSeparately_whenACaseThrew() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            new CaseOutcome("a", "q", List.of("get_training_plan"), List.of(), 100, BigDecimal.ZERO, false, true),
            outcome("b", List.of("get_training_plan"), List.of("get_training_plan"), 100, "0.001")));

        assertThat(report.errors()).isEqualTo(1);
        assertThat(report.jsonValidRate()).isEqualTo(0.5);
        assertThat(report.hits()).isEqualTo(1);
    }
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && ./mvnw test -Dtest=ToolSelectionEvalMetricsTest`
Expected: FAIL — az osztályok nem léteznek.

- [ ] **Step 3: Write `ToolDomains`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import java.util.Map;
import java.util.Optional;

/**
 * Which domain each companion tool belongs to (mezo-ozri.3) — the vocabulary behind the eval's
 * "critical wrong tool" count. Every tool is read-only, so a wrong selection can never corrupt
 * data; what it CAN do is answer a training question out of the food log, confidently. That
 * cross-domain miss is the failure mode the go/no-go gate cares about.
 *
 * <p>An unmapped name deliberately counts as critical: a tool this map has not heard of is either
 * a hallucinated name or a new tool nobody re-baselined against, and both deserve to show up red
 * rather than to be quietly averaged away.
 */
final class ToolDomains {

    private static final Map<String, String> DOMAINS = Map.ofEntries(
        Map.entry("get_training_plan", "train"),
        Map.entry("get_training_log", "train"),
        Map.entry("get_exercise_records", "train"),
        Map.entry("get_fuel_log", "fuel"),
        Map.entry("get_pantry", "fuel"),
        Map.entry("get_recipes", "fuel"),
        Map.entry("get_weight_trend", "biometrics"),
        Map.entry("get_weight_log", "biometrics"),
        Map.entry("get_recovery", "biometrics"),
        Map.entry("get_insights", "insights"),
        Map.entry("compare_periods", "insights"),
        Map.entry("get_goal", "goal"),
        Map.entry("get_life_goals", "lifegoal"),
        Map.entry("get_growth", "growth"),
        Map.entry("find_similar_past_days", "memory"),
        Map.entry("get_medication", "medication"),
        Map.entry("get_protocol", "medication"),
        Map.entry("get_daily_practice", "practice"));

    private ToolDomains() {
    }

    static Optional<String> domainOf(String toolName) {
        return Optional.ofNullable(DOMAINS.get(toolName));
    }

    static java.util.Set<String> knownTools() {
        return DOMAINS.keySet();
    }
}
```

- [ ] **Step 4: Write `ToolSelectionEvalMetrics`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pure metric calculator for the tool-selection re-baseline (mezo-ozri.3, spec §S3). Network-free
 * and Spring-free on purpose: the IT does the calling, this does the arithmetic, and the arithmetic
 * is what the model decision rests on.
 *
 * <p>Definitions, chosen so the numbers mean the same thing across providers:
 * <ul>
 *   <li><b>hit</b> — at least one selected tool is in the case's accepted set (the pre-S3 metric,
 *       kept so the new run is comparable to the old one).</li>
 *   <li><b>exact match</b> — something was selected AND nothing outside the accepted set was; this
 *       is the gate's metric, because a right tool dragged along by two wrong ones costs money and
 *       pollutes the answer.</li>
 *   <li><b>critical wrong tool</b> — a selected tool whose domain matches no accepted tool's domain
 *       (see {@link ToolDomains}). The gate demands zero.</li>
 *   <li><b>cost per successful action</b> — USD summed per case, over HIT cases only; a cheap model
 *       that misses is not cheap.</li>
 * </ul>
 */
public final class ToolSelectionEvalMetrics {

    private ToolSelectionEvalMetrics() {
    }

    /** One measured case. {@code costUsd} and {@code latencyMs} come from the llm_log rows. */
    public record CaseOutcome(String id, String question, List<String> expected, List<String> actual,
                              long latencyMs, BigDecimal costUsd, boolean jsonValid, boolean errored) {}

    public record EvalReport(String model, int cases, int hits, int exactMatches, int criticalWrongTools,
                             int errors, double hitRate, double exactMatchRate, double jsonValidRate,
                             long latencyP50, long latencyP95,
                             BigDecimal costPerSuccessP50, BigDecimal costPerSuccessP95, BigDecimal totalCostUsd,
                             List<String> misses, List<String> criticalDetails) {}

    public static EvalReport evaluate(String model, List<CaseOutcome> outcomes) {
        int hits = 0;
        int exact = 0;
        int critical = 0;
        int errors = 0;
        int jsonValid = 0;
        BigDecimal total = BigDecimal.ZERO;
        List<String> misses = new ArrayList<>();
        List<String> criticalDetails = new ArrayList<>();
        List<Long> latencies = new ArrayList<>();
        List<BigDecimal> successCosts = new ArrayList<>();

        for (CaseOutcome outcome : outcomes) {
            total = total.add(outcome.costUsd());
            latencies.add(outcome.latencyMs());
            if (outcome.errored()) {
                errors++;
            }
            if (outcome.jsonValid()) {
                jsonValid++;
            }
            Set<String> accepted = Set.copyOf(outcome.expected());
            boolean hit = outcome.actual().stream().anyMatch(accepted::contains);
            if (hit) {
                hits++;
                successCosts.add(outcome.costUsd());
            } else {
                misses.add("[%s] \"%s\" — expected %s, got %s"
                    .formatted(outcome.id(), outcome.question(), outcome.expected(), outcome.actual()));
            }
            if (!outcome.actual().isEmpty() && accepted.containsAll(outcome.actual())) {
                exact++;
            }
            Set<String> acceptedDomains = accepted.stream()
                .map(ToolDomains::domainOf).flatMap(Optional::stream).collect(Collectors.toSet());
            for (String selected : outcome.actual()) {
                Optional<String> domain = ToolDomains.domainOf(selected);
                if (domain.isEmpty() || !acceptedDomains.contains(domain.get())) {
                    critical++;
                    criticalDetails.add("[%s] %s (domain %s) is outside %s"
                        .formatted(outcome.id(), selected, domain.orElse("UNKNOWN"), acceptedDomains));
                }
            }
        }

        int n = outcomes.size();
        return new EvalReport(model, n, hits, exact, critical, errors,
            rate(hits, n), rate(exact, n), rate(jsonValid, n),
            percentileLong(latencies, 50), percentileLong(latencies, 95),
            percentileMoney(successCosts, 50), percentileMoney(successCosts, 95), total,
            List.copyOf(misses), List.copyOf(criticalDetails));
    }

    private static double rate(int count, int total) {
        return total == 0 ? 0.0 : (double) count / total;
    }

    /** Nearest-rank percentile: index = ceil(p/100 * n) - 1 on the sorted values. */
    private static int index(int size, int percentile) {
        return Math.min(size - 1, (int) Math.ceil(percentile / 100.0 * size) - 1);
    }

    private static long percentileLong(List<Long> values, int percentile) {
        if (values.isEmpty()) {
            return 0L;
        }
        List<Long> sorted = values.stream().sorted().toList();
        return sorted.get(index(sorted.size(), percentile));
    }

    private static BigDecimal percentileMoney(List<BigDecimal> values, int percentile) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }
        List<BigDecimal> sorted = values.stream().sorted().toList();
        return sorted.get(index(sorted.size(), percentile));
    }
}
```

- [ ] **Step 5: Run the test and make sure it passes**

Run: `cd backend && ./mvnw test -Dtest=ToolSelectionEvalMetricsTest`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing test — `EvalReportWriterTest`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.CaseOutcome;
import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.EvalReport;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class EvalReportWriterTest {

    @Test
    void testToMarkdown_shouldRenderEveryGateNumberAndTheMisses_whenTheReportHasThem() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("gpt-5.6-luna", List.of(
            new CaseOutcome("a", "Mit edzek ma?", List.of("get_training_plan"),
                List.of("get_training_plan"), 1200, new BigDecimal("0.0012"), true, false),
            new CaseOutcome("b", "Mit ettem?", List.of("get_fuel_log"),
                List.of("get_training_log"), 900, new BigDecimal("0.0009"), true, false)));

        String markdown = EvalReportWriter.toMarkdown(report);

        assertThat(markdown).contains("# Tool-selection eval — gpt-5.6-luna");
        assertThat(markdown).contains("| exact match |");
        assertThat(markdown).contains("50.0%");
        assertThat(markdown).contains("critical wrong tool");
        assertThat(markdown).contains("get_training_log");
        assertThat(markdown).contains("[b] \"Mit ettem?\"");
    }

    @Test
    void testToMarkdown_shouldStateZeroMissesExplicitly_whenEveryCaseHit() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("gemini-2.5-flash", List.of(
            new CaseOutcome("a", "q", List.of("get_training_plan"),
                List.of("get_training_plan"), 1000, new BigDecimal("0.001"), true, false)));

        assertThat(EvalReportWriter.toMarkdown(report)).contains("Zero misses.");
    }
}
```

- [ ] **Step 7: Run it to make sure it fails**

Run: `cd backend && ./mvnw test -Dtest=EvalReportWriterTest`
Expected: FAIL — `EvalReportWriter` nem létezik.

- [ ] **Step 8: Write `EvalReportWriter`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.EvalReport;
import java.util.Locale;

/**
 * Renders an {@link EvalReport} as the Markdown block that goes into
 * {@code docs/research/comparisons/} (mezo-ozri.3). Kept separate from the IT so the shape of the
 * evidence is unit-testable without spending a cent.
 */
public final class EvalReportWriter {

    private EvalReportWriter() {
    }

    public static String toMarkdown(EvalReport r) {
        StringBuilder sb = new StringBuilder();
        sb.append("# Tool-selection eval — ").append(r.model()).append("\n\n");
        sb.append("| metrika | érték |\n|---|---|\n");
        sb.append(row("cases", String.valueOf(r.cases())));
        sb.append(row("hit (bármely elfogadott tool)", percent(r.hitRate()) + " (" + r.hits() + ")"));
        sb.append(row("exact match", percent(r.exactMatchRate()) + " (" + r.exactMatches() + ")"));
        sb.append(row("critical wrong tool", String.valueOf(r.criticalWrongTools())));
        sb.append(row("JSON-érvényes turn", percent(r.jsonValidRate())));
        sb.append(row("hibára futott eset", String.valueOf(r.errors())));
        sb.append(row("latency p50 / p95", r.latencyP50() + " ms / " + r.latencyP95() + " ms"));
        sb.append(row("USD / sikeres akció p50 / p95",
            money(r.costPerSuccessP50()) + " / " + money(r.costPerSuccessP95())));
        sb.append(row("teljes futás költsége", money(r.totalCostUsd())));
        sb.append("\n## Misses\n\n");
        if (r.misses().isEmpty()) {
            sb.append("Zero misses.\n");
        } else {
            r.misses().forEach(m -> sb.append("- ").append(m).append('\n'));
        }
        sb.append("\n## Critical wrong tools\n\n");
        if (r.criticalDetails().isEmpty()) {
            sb.append("Zero critical wrong tools.\n");
        } else {
            r.criticalDetails().forEach(c -> sb.append("- ").append(c).append('\n'));
        }
        return sb.toString();
    }

    private static String row(String name, String value) {
        return "| " + name + " | " + value + " |\n";
    }

    private static String percent(double rate) {
        return String.format(Locale.ROOT, "%.1f%%", rate * 100);
    }

    private static String money(java.math.BigDecimal value) {
        return String.format(Locale.ROOT, "$%.6f", value);
    }
}
```

- [ ] **Step 9: Run the test and make sure it passes**

Run: `cd backend && ./mvnw test -Dtest=EvalReportWriterTest`
Expected: PASS (2 tests).

- [ ] **Step 10: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/
git commit -m "test(companion): tool-selection eval metrics and report writer (mezo-ozri.3)"
```

---

### Task 3: A mérőpad átkötése — modell-tudatos futás, llm_log-alapú számok, artefaktumok

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToolSelectionEvalIT.java`

**Interfaces:**
- Consumes: `EvalTarget`, `EvalApiKeyCondition`, `ToolSelectionEvalMetrics.CaseOutcome/EvalReport`, `EvalReportWriter.toMarkdown`.
- Consumes (main): `io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository` (`findAll()`), `LlmLogEntity#getCostUsd/getLatencyMs/getServedModel/getStatus/getCallKind`.
- Produces: két artefakt futásonként a `backend/target/eval/` alatt — `tool-selection-<model>.md` (a riport) és `answers-<model>.json` (`{"model":..,"answers":{"<caseId>":"<válasz szövege>"}}`), utóbbi a Task 4 vak hangnem-bírálatának bemenete.

**Trap (a terv része, ne érje meglepetésként a végrehajtót):** az IT ma `@Transactional`. Az `llm_log` írás `@Async` + `REQUIRES_NEW`, tehát a mérendő sorok egy MÁSIK tranzakcióban születnek, és a teszt saját, nem commitolt usere alatt FK-ra futhatnak. Ezért a `@Transactional` **lekerül** (a `MemoryRetrievalDeterministicEvalIT` ugyanezt teszi, ugyanezért), és a sorokra Awaitilityvel várunk.

- [ ] **Step 1: Write the failing test — a mérőpad új szerkezete**

Cseréld a `ToolSelectionEvalIT` osztályfejét és a teszt-metódust az alábbira (a `runCase`/`loadCases` segédek maradnak, `runCase` visszatérési típusa változik):

```java
@Slf4j
@Tag("eval")
@ExtendWith(EvalApiKeyCondition.class)
@Timeout(value = 30, unit = TimeUnit.MINUTES)
@TestPropertySource(properties = {
        "mezo.feature.companion.enabled=true",
        "mezo.companion.advisors.enabled=false"
})
class ToolSelectionEvalIT extends AbstractIntegrationTest {

    private static final String CASES_RESOURCE = "companion/tool-selection-cases.json";
    private static final EvalTarget TARGET = EvalTarget.fromSystemProperties();
    private static final Path ARTIFACT_DIR = Path.of("target", "eval");

    /**
     * The model under test drives the provider switch AND that provider's cheap tier, from one
     * property (mezo-ozri.3): {@code -Dmezo.eval.model=gpt-5.6-luna}. Audio and vision stay on
     * Gemini either way (spec §A1) — this suite sends neither.
     */
    @DynamicPropertySource
    static void evalModel(DynamicPropertyRegistry registry) {
        registry.add("mezo.companion.llm.provider", TARGET::providerKey);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".chat-model", TARGET::model);
    }

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private ObjectMapper objectMapper;

    record Case(String id, String question, List<String> expectedTools, String note) {}

    /** One case's raw result before metrics: the tools it picked and the answer it wrote. */
    private record CaseRun(List<String> tools, String answer, boolean errored) {}

    @Test
    void testToolSelection_shouldMeasureTheCaseSetOnTheTargetModel_whenARealProviderAnswers() throws Exception {
        List<Case> cases = loadCases();
        assertThat(cases).isNotEmpty();
        UUID userId = databasePopulator.populateUser("tool-selection-eval@test.local");

        List<CaseOutcome> outcomes = new ArrayList<>();
        Map<String, String> answers = new LinkedHashMap<>();
        for (Case testCase : cases) {
            llmLogRepository.deleteAll();
            CaseRun run = runCase(userId, testCase);
            List<LlmLogEntity> rows = awaitLogRows();
            outcomes.add(new CaseOutcome(testCase.id(), testCase.question(), testCase.expectedTools(),
                    run.tools(), totalLatencyMs(rows), totalCostUsd(rows),
                    !run.errored(), run.errored()));
            answers.put(testCase.id(), run.answer());
            assertServedModel(rows);
        }

        EvalReport report = ToolSelectionEvalMetrics.evaluate(TARGET.model(), outcomes);
        String markdown = EvalReportWriter.toMarkdown(report);
        log.info("\n{}", markdown);
        writeArtifacts(markdown, answers);

        // A REPORT, not a gate: the go/no-go decision is a human reading the numbers against the
        // incumbent's (spec §M2). What IS asserted is that the harness measured what it claims to.
        assertThat(outcomes).hasSameSizeAs(cases);
        assertThat(report.totalCostUsd()).isGreaterThan(BigDecimal.ZERO);
        assertThat(report.latencyP50()).isPositive();
    }

    /**
     * Every logged row of this run must come from the model under test — the trap the pre-S3 gate
     * hid: a provider switch that silently keeps answering from the incumbent still produces a
     * plausible-looking accuracy number, for the wrong model.
     */
    private void assertServedModel(List<LlmLogEntity> rows) {
        assertThat(rows).isNotEmpty();
        assertThat(rows).allSatisfy(row -> assertThat(row.getServedModel()).contains(TARGET.model()));
    }

    private List<LlmLogEntity> awaitLogRows() {
        Awaitility.await().atMost(Duration.ofSeconds(30))
            .until(() -> !llmLogRepository.findAll().isEmpty());
        return llmLogRepository.findAll();
    }

    private static long totalLatencyMs(List<LlmLogEntity> rows) {
        return rows.stream().mapToLong(LlmLogEntity::getLatencyMs).sum();
    }

    private static BigDecimal totalCostUsd(List<LlmLogEntity> rows) {
        return rows.stream()
            .map(row -> row.getCostUsd() == null ? BigDecimal.ZERO : row.getCostUsd())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void writeArtifacts(String markdown, Map<String, String> answers) throws Exception {
        Files.createDirectories(ARTIFACT_DIR);
        Files.writeString(ARTIFACT_DIR.resolve("tool-selection-" + TARGET.model() + ".md"), markdown);
        Files.writeString(ARTIFACT_DIR.resolve("answers-" + TARGET.model() + ".json"),
            objectMapper.writeValueAsString(Map.of("model", TARGET.model(), "answers", answers)));
        log.info("Eval artifacts written to {}", ARTIFACT_DIR.toAbsolutePath());
    }
```

A `runCase` a válasz szövegét is visszaadja:

```java
    private CaseRun runCase(UUID userId, Case testCase) {
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        try {
            MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
                    SendMessageRequest.builder().content(testCase.question()).build());
            AiMessageEntity assistant = messageRepository.findById(response.getId()).orElseThrow();
            List<String> tools = assistant.getToolCalls() == null
                    ? List.of()
                    : assistant.getToolCalls().calls().stream()
                        .map(ToolCallsEnvelope.ToolCall::name).distinct().toList();
            return new CaseRun(tools, assistant.getContent(), false);
        } catch (Exception e) {
            log.warn("Tool-selection eval case {} failed — counted as a miss AND an error", testCase.id(), e);
            return new CaseRun(List.of(), "", true);
        }
    }
```

- [ ] **Step 2: Compile and run the gate WITHOUT a key to prove the skip path**

Run: `cd backend && env -u GEMINI_API_KEY -u OPENAI_API_KEY ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups=`
Expected: a teszt **skipped** ("No mezo.eval.model requested and GEMINI_API_KEY is absent"), a build zöld.

- [ ] **Step 3: Prove the loud-failure path**

Run: `cd backend && env -u OPENAI_API_KEY ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= -Dmezo.eval.model=gpt-5.6-luna`
Expected: FAIL, az üzenetben `OPENAI_API_KEY` és `gpt-5.6-luna` — nem skip.

- [ ] **Step 4: Run the incumbent for real (first spend, ~$0.05)**

Run: `cd backend && ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= -Dmezo.test.use-testcontainers=true`
Expected: PASS; a logban a Markdown riport; `backend/target/eval/tool-selection-gemini-2.5-flash.md` és `answers-gemini-2.5-flash.json` létrejön; minden `served_model` `gemini-2.5-flash`.

Ha az `awaitLogRows` üresen jár le: az `llm_log` írás ki van kapcsolva vagy FK-ra fut — a `mezo.feature.llm-log.enabled` legyen `true` (S1 óta az alapértelmezés), és a `@Transactional` tényleg legyen levéve az osztályról.

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToolSelectionEvalIT.java
git commit -m "test(companion): model-aware tool-selection harness with llm_log cost and latency (mezo-ozri.3)"
```

---

### Task 4: Vak magyar hangnem-bírálat (A/B)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToneJudgePairing.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToneJudgeEvalIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToneJudgePairingTest.java`

**Interfaces:**
- Consumes: a Task 3 által írt `answers-<model>.json` artefaktumok; `EvalTarget` (a **bíró** modell kiválasztására ugyanazzal a `-Dmezo.eval.model` propertyvel); `org.springframework.ai.chat.model.ChatModel` (`@Qualifier` a provider szerint).
- Produces:
  - `ToneJudgePairing.Pair` record: `caseId`, `optionA`, `optionB`, `aIsBaseline` (boolean).
  - `ToneJudgePairing.pair(Map<String,String> baseline, Map<String,String> candidate, long seed)` → `List<Pair>` (csak a közös eset-id-kre, id szerint rendezve, seedelt A/B csere).
  - `ToneJudgePairing.parseVerdict(String raw)` → `Verdict` enum (`A`, `B`, `TIE`, `UNPARSEABLE`).
  - `ToneJudgePairing.tally(List<Pair>, List<Verdict>)` → `Tally` record: `candidateWins`, `baselineWins`, `ties`, `unparseable`.

- [ ] **Step 1: Write the failing test — `ToneJudgePairingTest`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Pair;
import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Verdict;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ToneJudgePairingTest {

    @Test
    void testPair_shouldKeepOnlySharedCasesInIdOrder_whenOneSideIsMissingAnAnswer() {
        List<Pair> pairs = ToneJudgePairing.pair(
            Map.of("b", "alap-b", "a", "alap-a", "c", "alap-c"),
            Map.of("a", "jelolt-a", "b", "jelolt-b"), 42L);

        assertThat(pairs).extracting(Pair::caseId).containsExactly("a", "b");
    }

    @Test
    void testPair_shouldPlaceEachSideBehindTheLabelItsFlagClaims_whenSidesAreSwapped() {
        List<Pair> pairs = ToneJudgePairing.pair(
            Map.of("a", "alap-a"), Map.of("a", "jelolt-a"), 42L);

        Pair pair = pairs.getFirst();
        assertThat(pair.aIsBaseline() ? pair.optionA() : pair.optionB()).isEqualTo("alap-a");
        assertThat(pair.aIsBaseline() ? pair.optionB() : pair.optionA()).isEqualTo("jelolt-a");
    }

    @Test
    void testPair_shouldSwapSomePairsAndNotOthers_whenTheSeedIsFixed() {
        Map<String, String> baseline = Map.of("a", "1", "b", "2", "c", "3", "d", "4", "e", "5", "f", "6");
        Map<String, String> candidate = Map.of("a", "x", "b", "y", "c", "z", "d", "w", "e", "v", "f", "u");

        List<Pair> pairs = ToneJudgePairing.pair(baseline, candidate, 7L);

        assertThat(pairs).extracting(Pair::aIsBaseline).contains(true, false);
        assertThat(ToneJudgePairing.pair(baseline, candidate, 7L)).isEqualTo(pairs);
    }

    @Test
    void testParseVerdict_shouldReadTheVerdictWord_whenTheJudgeWrapsItInProse() {
        assertThat(ToneJudgePairing.parseVerdict("Az A változat természetesebb.\nVERDICT: A")).isEqualTo(Verdict.A);
        assertThat(ToneJudgePairing.parseVerdict("verdict: b")).isEqualTo(Verdict.B);
        assertThat(ToneJudgePairing.parseVerdict("VERDICT: TIE")).isEqualTo(Verdict.TIE);
        assertThat(ToneJudgePairing.parseVerdict("nem tudom eldönteni")).isEqualTo(Verdict.UNPARSEABLE);
    }

    @Test
    void testTally_shouldCreditTheCandidate_whenTheJudgePickedTheLabelTheCandidateSatBehind() {
        List<Pair> pairs = List.of(
            new Pair("a", "alap", "jelolt", true),
            new Pair("b", "jelolt", "alap", false));

        var tally = ToneJudgePairing.tally(pairs, List.of(Verdict.B, Verdict.A));

        assertThat(tally.candidateWins()).isEqualTo(2);
        assertThat(tally.baselineWins()).isZero();
        assertThat(tally.ties()).isZero();
    }
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && ./mvnw test -Dtest=ToneJudgePairingTest`
Expected: FAIL — `ToneJudgePairing` nem létezik.

- [ ] **Step 3: Write `ToneJudgePairing`**

```java
package io.mrkuhne.mezo.feature.companion.eval;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.TreeSet;

/**
 * The blind half of the Hungarian tone comparison (mezo-ozri.3, spec §S3 gate 4): which model's
 * answer reads better in Hungarian, judged without knowing which is which.
 *
 * <p>Two things make the number trustworthy and both live here, unit-tested and network-free: the
 * A/B sides are swapped by a SEEDED shuffle (position bias is real in LLM judges, and a fixed seed
 * makes the run reproducible), and the verdict parser refuses to guess — an answer it cannot read
 * is {@link Verdict#UNPARSEABLE}, never silently a tie.
 */
public final class ToneJudgePairing {

    private ToneJudgePairing() {
    }

    public enum Verdict { A, B, TIE, UNPARSEABLE }

    public record Pair(String caseId, String optionA, String optionB, boolean aIsBaseline) {}

    public record Tally(int candidateWins, int baselineWins, int ties, int unparseable) {}

    public static List<Pair> pair(Map<String, String> baseline, Map<String, String> candidate, long seed) {
        Random random = new Random(seed);
        List<Pair> pairs = new ArrayList<>();
        for (String caseId : new TreeSet<>(baseline.keySet())) {
            String candidateAnswer = candidate.get(caseId);
            if (candidateAnswer == null) {
                continue;
            }
            boolean aIsBaseline = random.nextBoolean();
            String baselineAnswer = baseline.get(caseId);
            pairs.add(aIsBaseline
                ? new Pair(caseId, baselineAnswer, candidateAnswer, true)
                : new Pair(caseId, candidateAnswer, baselineAnswer, false));
        }
        return List.copyOf(pairs);
    }

    public static Verdict parseVerdict(String raw) {
        if (raw == null) {
            return Verdict.UNPARSEABLE;
        }
        String[] lines = raw.strip().split("\\R");
        for (int i = lines.length - 1; i >= 0; i--) {
            String line = lines[i].strip().toLowerCase(Locale.ROOT);
            if (!line.startsWith("verdict:")) {
                continue;
            }
            String value = line.substring("verdict:".length()).strip();
            return switch (value) {
                case "a" -> Verdict.A;
                case "b" -> Verdict.B;
                case "tie" -> Verdict.TIE;
                default -> Verdict.UNPARSEABLE;
            };
        }
        return Verdict.UNPARSEABLE;
    }

    public static Tally tally(List<Pair> pairs, List<Verdict> verdicts) {
        if (pairs.size() != verdicts.size()) {
            throw new IllegalArgumentException(
                "pairs=" + pairs.size() + " but verdicts=" + verdicts.size());
        }
        int candidateWins = 0;
        int baselineWins = 0;
        int ties = 0;
        int unparseable = 0;
        for (int i = 0; i < pairs.size(); i++) {
            Pair pair = pairs.get(i);
            switch (verdicts.get(i)) {
                case TIE -> ties++;
                case UNPARSEABLE -> unparseable++;
                case A -> {
                    if (pair.aIsBaseline()) {
                        baselineWins++;
                    } else {
                        candidateWins++;
                    }
                }
                case B -> {
                    if (pair.aIsBaseline()) {
                        candidateWins++;
                    } else {
                        baselineWins++;
                    }
                }
            }
        }
        return new Tally(candidateWins, baselineWins, ties, unparseable);
    }
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `cd backend && ./mvnw test -Dtest=ToneJudgePairingTest`
Expected: PASS (5 tests).

- [ ] **Step 5: Write `ToneJudgeEvalIT`**

Új IT, ugyanazzal a kapuval és `@Tag("eval")`-lal. A bírót a `-Dmezo.eval.model` választja (tehát ugyanaz a mechanizmus, csak itt a bírót jelenti); a két összehasonlítandó artefaktum útját `-Dmezo.eval.baseline=` és `-Dmezo.eval.candidate=` adja.

```java
package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Pair;
import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Tally;
import io.mrkuhne.mezo.feature.companion.eval.ToneJudgePairing.Verdict;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Blind Hungarian tone comparison between two eval runs' answers (mezo-ozri.3, spec §S3 gate 4).
 * Consumes the {@code answers-<model>.json} artifacts {@code ToolSelectionEvalIT} writes, so it
 * spends nothing on re-generating answers — only on judging them.
 *
 * <p>Run it TWICE, once per judge family, and compare: a judge from the candidate's own family is
 * not a neutral referee, and the cheap defence against self-preference is to ask both and to look
 * at the answers by hand when they disagree.
 *
 * <pre>
 * ./mvnw test -Dtest=ToneJudgeEvalIT -Dmezo.excludedTestGroups= \
 *   -Dmezo.eval.model=gemini-2.5-pro \
 *   -Dmezo.eval.baseline=target/eval/answers-gemini-2.5-flash.json \
 *   -Dmezo.eval.candidate=target/eval/answers-gpt-5.6-luna.json
 * </pre>
 */
@Slf4j
@Tag("eval")
@ExtendWith(EvalApiKeyCondition.class)
@Timeout(value = 20, unit = TimeUnit.MINUTES)
class ToneJudgeEvalIT extends AbstractIntegrationTest {

    private static final EvalTarget JUDGE = EvalTarget.fromSystemProperties();
    private static final long SEED = 20260907L;

    private static final String RUBRIC = """
        Két magyar nyelvű edzés- és táplálkozás-asszisztens válaszát hasonlítod össze ugyanarra a
        kérdésre. Csak a NYELVI MINŐSÉGET és a HANGNEMET ítéld meg: természetes magyar
        szórend és ragozás, tegeződő, támogató de nem nyálas hang, tömörség, magyartalan
        fordulatok és angolos szerkezetek hiánya. A tartalmi helyesség NEM számít.
        Egy rövid indoklás után az UTOLSÓ sorod pontosan ez legyen: "VERDICT: A", "VERDICT: B"
        vagy "VERDICT: TIE".
        """;

    @Autowired private ObjectMapper objectMapper;
    @Autowired @Qualifier("googleGenAiChatModel") ChatModel geminiChatModel;
    @Autowired @Qualifier("openAiChatModel") ChatModel openAiChatModel;

    @Test
    void testToneJudge_shouldReportBlindWinTieLoss_whenTwoRunsAnswersAreCompared() throws Exception {
        Map<String, String> baseline = loadAnswers("mezo.eval.baseline");
        Map<String, String> candidate = loadAnswers("mezo.eval.candidate");
        List<Pair> pairs = ToneJudgePairing.pair(baseline, candidate, SEED);
        assertThat(pairs).isNotEmpty();

        List<Verdict> verdicts = new ArrayList<>();
        for (Pair pair : pairs) {
            verdicts.add(ToneJudgePairing.parseVerdict(judge(pair)));
        }
        Tally tally = ToneJudgePairing.tally(pairs, verdicts);

        log.info("Tone judge [{}] over {} pairs — candidate {} / baseline {} / tie {} / unparseable {}",
            JUDGE.model(), pairs.size(), tally.candidateWins(), tally.baselineWins(),
            tally.ties(), tally.unparseable());
        assertThat(tally.unparseable()).isLessThanOrEqualTo(pairs.size() / 10);
    }

    private String judge(Pair pair) {
        String prompt = RUBRIC + "\n\n[A]\n" + pair.optionA() + "\n\n[B]\n" + pair.optionB();
        ChatModel model = JUDGE.provider() == io.mrkuhne.mezo.feature.companion.config.LlmProvider.OPENAI
            ? openAiChatModel : geminiChatModel;
        return model.call(prompt);
    }

    private Map<String, String> loadAnswers(String property) throws Exception {
        Path path = Path.of(System.getProperty(property, ""));
        assertThat(Files.exists(path)).as("%s artifact %s", property, path.toAbsolutePath()).isTrue();
        Map<String, Object> raw = objectMapper.readValue(Files.readString(path),
            new TypeReference<Map<String, Object>>() {});
        @SuppressWarnings("unchecked")
        Map<String, String> answers = (Map<String, String>) raw.get("answers");
        return answers;
    }
}
```

- [ ] **Step 6: Verify the IT compiles and self-skips without a key**

Run: `cd backend && env -u GEMINI_API_KEY -u OPENAI_API_KEY ./mvnw test -Dtest=ToneJudgeEvalIT -Dmezo.excludedTestGroups=`
Expected: skipped, build zöld. (Ha `ChatModel` bean-név nem stimmel — `googleGenAiChatModel` / `openAiChatModel` —, a context-boot hibaüzenete megmondja a helyeset; a `GeminiCompanionLlm`/`OpenAiCompanionLlm` konstruktorai ugyanezeket a qualifiereket használják.)

- [ ] **Step 7: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/
git commit -m "test(companion): blind Hungarian tone A/B judge over eval answer artifacts (mezo-ozri.3)"
```

---

### Task 5: A három mérés lefuttatása, a döntés és a dokumentáció

**Files:**
- Create: `docs/research/comparisons/companion-chat-model-rebaseline-2026-09.md`
- Modify: `docs/research/index.md`, `docs/research/log.md`
- Modify: `docs/features/companion.md` (az eval-kapu szakasza)
- Modify: `docs/CODEMAP.md` (csak ha main-oldali fájl változott — ebben a szeletben várhatóan NEM)

**Interfaces:**
- Consumes: a Task 3/4 által `backend/target/eval/` alá írt riportok és artefaktumok.

- [ ] **Step 1: Mérés — incumbent**

```bash
cd backend && ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= -Dmezo.test.use-testcontainers=true
```
A `target/eval/tool-selection-gemini-2.5-flash.md` és `answers-gemini-2.5-flash.json` mentendő (másold a `target/eval/` fájlokat a scratchpadbe, mert egy `clean` törli őket).

- [ ] **Step 2: Mérés — `gpt-5.6-luna`**

```bash
cd backend && ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= -Dmezo.test.use-testcontainers=true -Dmezo.eval.model=gpt-5.6-luna
```
Ellenőrizendő a riporton felül: minden sor `served_model` = `gpt-5.6-luna`, és a `cost_usd` **nem null** (ez egyben a `mezo-kdhn` smoke fele).

- [ ] **Step 3: Mérés — `gpt-5.6-terra`**

```bash
cd backend && ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= -Dmezo.test.use-testcontainers=true -Dmezo.eval.model=gpt-5.6-terra
```

- [ ] **Step 4: Vak hangnem-bírálat, két bíróval, mindkét jelöltre**

```bash
cd backend && ./mvnw test -Dtest=ToneJudgeEvalIT -Dmezo.excludedTestGroups= -Dmezo.test.use-testcontainers=true \
  -Dmezo.eval.model=gemini-2.5-pro \
  -Dmezo.eval.baseline=target/eval/answers-gemini-2.5-flash.json \
  -Dmezo.eval.candidate=target/eval/answers-gpt-5.6-luna.json
```
Ismételd: bíró `gpt-5.6-terra`; jelölt `answers-gpt-5.6-terra.json`. Négy futás összesen.

- [ ] **Step 5: Write the research page**

`docs/research/comparisons/companion-chat-model-rebaseline-2026-09.md` — a knowledge-base skill `docs/research/` konvenciója szerint (front-matter, forrás-hivatkozások, `docs/research/index.md` és `log.md` bekötés). Tartalma:
1. Mit mértünk, min, mikor, milyen HEAD-en, mennyiért.
2. Modellenkénti riport-tábla (a generált Markdown beillesztve).
3. A hat kapu értékelése: exact match ≥ incumbent; kritikus rossz tool = 0; JSON-érvényesség ≥ 99,5%; hangnem vak win/tie ≥ incumbent; p95 latencia ≤ +20%; USD/sikeres akció.
4. **Döntés**: melyik a default chat-modell és miért — egy bekezdés, a számokra hivatkozva.
5. Amit NEM mértünk: a 13 strukturált-kimenetű adapter séma-megfelelése külön eval (új bd jegy), és a `reasoning_effort` hatása (az S4 spike tárgya).

- [ ] **Step 6: Update `docs/features/companion.md`**

Az eval-kapu szakaszában cseréld a régi futtatási parancsot az újra (`-Dmezo.eval.model=…`), és írd le egy bekezdésben, mit mér a pad és hol landolnak az artefaktumok.

- [ ] **Step 7: Ha az eredmény ellentmond a spec M1 döntésének, ÁLLJ MEG**

Ha a `gpt-5.6-luna` nem éri el az incumbent baseline-t, a szelet **nem** dönt egyedül: a spec §M1-et kell amendelni (Terra default = −19% marzs, tehát nem automatikus válasz). Ilyenkor a riport elkészül, a döntés kérdésként megy Danielhez magyarul, üzleti nyelven.

- [ ] **Step 8: Commit + a jegy zárása**

```bash
git add docs/
git commit -m "docs(companion): chat-model re-baseline report and default-model decision (mezo-ozri.3)"
node scripts/check-beads-backup.mjs --fix
bd close mezo-ozri.3
git add .beads/issues.jsonl && git commit -m "chore(beads): close mezo-ozri.3 (mezo-ozri.3)"
```

- [ ] **Step 9: PR, CI-kapu, merge**

```bash
git push -u origin feat/openai-eval-rebaseline
gh pr create --fill
```
CI zöld → `gh workflow run premerge.yml -f pr=<number>` → lokális `--no-ff` merge → `git push origin HEAD:main` → ág törlése.

---

## Self-Review

**Spec-lefedettség.** A jegy elfogadási feltételei: (a) mindhárom modellre lefutott riport a `docs/research` alatt → Task 5 Step 1–3, 5; (b) cost/sikeres akció p50+p95 → Task 2 metrika + Task 3 `llm_log` forrás; (c) a default modell írásos indoklása → Task 5 Step 5 pont 4; (d) „a gate env-var neve nem hazudik" → Task 1 teljes egészében, bizonyítva a Task 3 Step 2–3 két futásával. A spec hat kapujából ötöt a pad mér; a hatodik (JSON-séma ≥ 99,5%) itt a tool-hívás argumentumainak érvényességén mérve szerepel, a 13 strukturált adapter teljes séma-evalja **kimondottan kívül van a szeleten** és külön bd jegyet kap (Task 5 Step 5 pont 5) — ezt a szűkítést a riport is kimondja.

**Placeholder-ellenőrzés.** Minden lépés konkrét kódot vagy konkrét parancsot tartalmaz; nincs „TBD", nincs „hasonlóan a Task N-hez".

**Típus-konzisztencia.** `CaseOutcome(id, question, expected, actual, latencyMs, costUsd, jsonValid, errored)` ugyanígy szerepel a Task 2 tesztjeiben és a Task 3 hívásában; `EvalReport` mezőnevei (`hitRate`, `exactMatchRate`, `criticalWrongTools`, `costPerSuccessP50`) egyeznek a `EvalReportWriter` és a tesztek használatával; `EvalTarget.providerKey()` a Task 1-ben definiált és a Task 3 `@DynamicPropertySource`-ában használt; `ToneJudgePairing.Pair/Verdict/Tally` a Task 4 tesztje és ITje között egyezik.
