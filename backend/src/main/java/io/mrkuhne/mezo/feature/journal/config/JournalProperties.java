package io.mrkuhne.mezo.feature.journal.config;

import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Journal tuning (ADR 0029 — moved out of {@code CompanionProperties.Journal} to break the
 * journal→companion cycle; the YAML prefix stays {@code mezo.companion.journal.*} on purpose so
 * {@code application.yml} and the Phase 5 W1 design spec's configured key needed no change).
 * W1.4's decision journal + review loop (bd mezo-b3pp.4) is the sole reader.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.journal")
public record JournalProperties(

    /** {@code decision_entry.review_due} default offset in days from {@code decided_on}. */
    @Positive int decisionReviewDays
) {}
