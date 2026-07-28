package io.mrkuhne.mezo.feature.llmlog.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.Map;

/**
 * LLM price list (mezo.llm-log.pricing) — config, never code. Keyed by the SERVED model id
 * (what the provider reports back), so a model swap or a rate change is a YAML edit.
 *
 * <p>Rates drift: verify the current Gemini rates when touching this block. Already-logged calls
 * are unaffected — each row freezes its own {@code PricingSnapshot} at write time.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.llm-log.pricing")
public record LlmPricingProperties(@NotBlank String currency,
                                   @NotNull Map<String, ModelPrice> models) {}
