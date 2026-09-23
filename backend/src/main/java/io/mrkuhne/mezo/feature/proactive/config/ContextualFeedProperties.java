package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Bounded input and tool budgets shared by contextual daily messages. */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive.contextual-feed")
public record ContextualFeedProperties(
        /** Inclusive calendar-day lookback. */ @Min(1) @Max(90) int historyDays,
        /** Maximum prior messages. */ @Min(1) @Max(30) int historyMaxMessages,
        /** Slots reserved for the current kind. */ @Min(0) @Max(30) int sameKindReserved,
        /** Total rendered history budget. */ @Min(1000) @Max(30000) int historyMaxChars,
        /** Maximum text excerpt per message. */ @Min(50) @Max(3000) int messageMaxChars,
        /** Raw weight window. */ @Min(2) @Max(90) int weightDays,
        /** Recent sleep window. */ @Min(1) @Max(30) int sleepDays,
        /** Audited tool execution budget. */ @Min(1) @Max(20) int maxToolCalls,
        /** Source reference budget. */ @Min(1) @Max(30) int maxRefs) {
    @AssertTrue(message = "same-kind reservation must fit within the history message limit")
    public boolean isReservationValid() { return sameKindReserved <= historyMaxMessages; }
}
