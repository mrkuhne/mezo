package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Companion tuning (mezo.companion). LLM model tiers per ADR 0008 — config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.companion")
public record CompanionProperties(
    @NotNull @Valid Llm llm
) {
    /** Provider model tiers (Gemini per ADR 0008; swap = YAML edit, no code change). */
    public record Llm(
        @NotBlank String chatModel,   // gemini-2.5-flash — cheap/fast, every conversational turn
        @NotBlank String smartModel   // gemini-2.5-pro — heavy pipelines (V3.2 critique); unused until then
    ) {}
}
