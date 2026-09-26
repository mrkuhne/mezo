package io.mrkuhne.mezo.feature.companion.eval;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import java.util.Locale;
import java.util.Map;
import org.springframework.test.context.DynamicPropertyRegistry;

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

    /**
     * Re-admits the REAL provider keys from the environment. The test profile deliberately pins
     * both keys to a dummy ({@code src/test/resources/application.properties}) so an ordinary IT
     * never reaches a provider, even on a machine that exports {@code GEMINI_API_KEY} (mezo-a9bo7.25
     * drain-debug: a single real call ran 33 s inside an AFTER_COMMIT listener and failed the 30 s
     * pre-reset drain). An eval measures a real model, so every eval IT calls this from its
     * {@code @DynamicPropertySource}; a missing variable keeps the dummy (the
     * {@link EvalApiKeyCondition} gate has already skipped or failed the run by then).
     */
    public static void registerRealApiKeys(DynamicPropertyRegistry registry) {
        registry.add("spring.ai.google.genai.api-key", () -> envOr("GEMINI_API_KEY", "dummy-key-set-GEMINI_API_KEY"));
        registry.add("spring.ai.openai.api-key", () -> envOr("OPENAI_API_KEY", "dummy-key-set-OPENAI_API_KEY"));
    }

    private static String envOr(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }
}
