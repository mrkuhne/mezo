package io.mrkuhne.mezo.feature.llmlog.repository;

/**
 * One feature's outcome-count bucket within a period (Funkciók scorecard {@code acceptedShare},
 * Slice 8 Task 2, bd mezo-76f6) — {@code outcome} is one of
 * {@link io.mrkuhne.mezo.feature.llmlog.entity.AiDraftOutcomeEntity#OUTCOME_ACCEPTED}/{@code
 * OUTCOME_EDITED}/{@code OUTCOME_DISCARDED}; {@code count} is the number of outcome rows in that
 * bucket.
 */
public record AiDraftOutcomeFeatureRow(String feature, String outcome, long count) {}
