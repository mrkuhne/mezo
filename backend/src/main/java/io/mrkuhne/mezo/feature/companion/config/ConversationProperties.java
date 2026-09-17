package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Bounds for conversation-first retrieval, continuity and rollback (mezo-rj214.9). */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.conversation")
public record ConversationProperties(
        /** Runtime rollback to the previous gear pipeline when false. */
        boolean enabled,
        /** Maximum retrieval batches before a final, honest answer. */
        @Min(1) @Max(6) int maxReadRounds,
        /** Recent user and assistant messages supplied on every turn. */
        @Min(20) @Max(200) int historyMessages,
        /** Older-history page size, selected by the server rather than the model. */
        @Min(1) @Max(50) int historyPageSize,
        /** Character cap for a historical message, with a visible truncation marker. */
        @Min(1000) @Max(60000) int historyMessageMaxChars,
        /** Total characters in the recent transcript and restored tool evidence. */
        @Min(10000) @Max(400000) int historyMaxChars,
        /** Maximum persisted characters per tool result. */
        @Min(500) @Max(60000) int resultMaxChars,
        /** Maximum persisted tool-result characters per assistant message. */
        @Min(2000) @Max(200000) int resultsMaxChars
) {}
