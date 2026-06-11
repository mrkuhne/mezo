# Configuration & Feature Switches

## Core Principle

**Every configurable value and every feature switch lives in `application.yml`, under the `mezo:` root.**
The YAML is the single control panel of the application: open it and you see every knob —
what can be toggled, what can be tuned, and what its default is. Nothing tunable hides in code.

**FORBIDDEN:**
- `@Value("${...}")` — anywhere, for any reason. It scatters configuration knowledge across the codebase.
- Hardcoded magic numbers/strings that could ever differ between environments or need tuning
  (timeouts, limits, cron expressions, URLs, thresholds, retry counts, batch sizes, toggles).
- Reading config via `Environment.getProperty(...)` in business code.

## YAML Structure — three zones under `mezo:`

```yaml
mezo:
  # 1. Business feature switches — turn whole features on/off
  feature:
    weight-tracking:
      enabled: true
    ai-briefing:
      enabled: false          # not built yet; flip on when Phase 3 lands

  # 2. Cross-cutting / infra switches and tuning
  techcore:
    cron:
      pattern-detection-job:
        enabled: true
    log:
      http-payload:
        enabled: false

  # 3. Per-domain configuration values
  auth:
    jwt-secret: ${MEZO_JWT_SECRET:dev-only-change-me-32-bytes-minimum-secret}
    owner-email: ${MEZO_OWNER_EMAIL:owner@mezo.local}
  pattern-engine:
    # Minimum confidence for a proposed pattern to reach the user inbox (0..1)
    min-confidence: 0.6
    # How many days of history the nightly batch analyzes
    lookback-days: 30
```

Rules:
- **Root prefix is `mezo:`** (this project's adaptation of the company's `project:` root).
- **kebab-case** keys (Spring relaxed binding maps them to camelCase in Java).
- **Comment every property** — enough that the YAML is understandable without opening Java code.
- **Always ship a sensible default** so the app starts with zero extra config; environment-specific
  values use `${ENV_VAR:default}` placeholders (never commit real secrets — see CLAUDE.md).
- **Group by feature, not by type** — a timeout belongs next to its feature, not in a global timeout list.
- **Switches are always declared explicitly** in the YAML (`enabled: true/false`), even when the
  value equals the code default — the YAML must show the full switchboard.

## Feature Switches

Switch keys are collected as constants in **one** class so they are discoverable and refactor-safe:

```java
package io.mrkuhne.mezo.techcore.configuration;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class FeaturesConfiguration {

    // feature
    public static final String WEIGHT_TRACKING_SWITCH = "mezo.feature.weight-tracking.enabled";
    public static final String AI_BRIEFING_SWITCH = "mezo.feature.ai-briefing.enabled";

    // techcore
    public static final String PATTERN_DETECTION_JOB_SWITCH = "mezo.techcore.cron.pattern-detection-job.enabled";
}
```

Consume switches with `@ConditionalOnProperty` at the **bean boundary** — the whole controller,
service bean, or scheduled job appears/disappears with the flag:

```java
@RestController
@RequestMapping("/api/biometrics/weight")
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.WEIGHT_TRACKING_SWITCH, havingValue = "true")
public class WeightLogController { ... }
```

```java
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.PATTERN_DETECTION_JOB_SWITCH, havingValue = "true")
public class PatternDetectionJob {
    @Scheduled(cron = "...")   // the job simply doesn't exist when switched off
    public void run() { ... }
}
```

Rules:
- One constant per switch in `FeaturesConfiguration`; the constant IS the YAML key string.
- Create the class together with the **first** switch — no empty placeholder class before that.
- No `matchIfMissing` — the YAML declares every switch explicitly (see above), so absence is a
  config bug that should surface, not silently default.
- For branching **inside** a method (rare — prefer the bean boundary), bind the flag into the
  feature's `*Properties` class instead of reading the Environment.

## Typed Config Values — `*Properties` Classes

For each config namespace, one `<Feature>Properties` class binds the YAML to a typed object:

```java
package io.mrkuhne.mezo.feature.patternengine;

import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "mezo.pattern-engine")
public record PatternEngineProperties(

    /** Minimum confidence for a proposed pattern to reach the user inbox (0..1). */
    @DecimalMin("0.0") @DecimalMax("1.0")
    double minConfidence,

    /** How many days of history the nightly batch analyzes. */
    @Min(1) @Max(365)
    int lookbackDays
) {}
```

Rules:
- **Class name:** `<Feature>Properties`; **prefix:** `mezo.<feature>` matching the YAML path.
- **Records preferred** (immutable; Spring Boot 4 constructor binding handles them —
  `OwnerProperties` is the live example). Mutable `@Getter/@Setter` class only if a field genuinely
  must be reassigned.
- **`@Validated` + JSR-303 constraints** on every field that has a legal range — fail fast at
  startup on bad config, never at first use.
- **Javadoc each component/field**, mirroring the YAML comment.
- **Package:** the feature's package; cross-feature config goes to `techcore/configuration`.
- **Registration:** `@ConfigurationPropertiesScan` on `MezoApplication` auto-discovers all
  `*Properties` classes — no per-class `@EnableConfigurationProperties` needed.
- **Injection:** constructor-inject the whole Properties object (`@RequiredArgsConstructor`).
  Never inject individual values; the object travels as one unit (testable by just constructing it).

## Refactoring Existing Hardcoded Values / `@Value`

1. Identify the feature the value belongs to.
2. Add the key under `mezo.<feature>` in `application.yml` (kebab-case, comment, default).
3. Add the field to the feature's `*Properties` record (create it if missing) with validation.
4. Replace the hardcoded value / `@Value` field with the injected Properties object.
5. Update tests: override via `@SpringBootTest(properties = ...)` or construct the record directly.

## Testing

- Override config in integration tests with `@SpringBootTest(properties = "mezo.x.y=z")` or
  `@TestPropertySource` — never by mutating Properties objects.
- When a switch changes behavior, test **both** states (on: bean present/endpoint responds;
  off: `404`/bean absent — `@ConditionalOnProperty` removes the bean, and the security filter
  still applies first).
- Unit-level: construct the Properties record directly with test values.

## Checklist

- [ ] No `@Value`, no `Environment.getProperty` in business code, no env-tunable hardcoded literals
- [ ] All keys under `mezo:`, kebab-case, commented, with defaults (`${ENV_VAR:default}` where env-specific)
- [ ] Feature/job/infra switches declared explicitly in YAML and listed as constants in `FeaturesConfiguration`
- [ ] Switches consumed via `@ConditionalOnProperty` at the bean boundary
- [ ] Values bound via `@Validated` `*Properties` records with JSR-303 constraints and Javadoc
- [ ] Whole Properties object constructor-injected; both switch states tested where behavior differs
