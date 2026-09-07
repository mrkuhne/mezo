package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;

/**
 * Reflexió S4 (mezo-eq85.4): which surface an observation card came from, derived from the test
 * plan's {@code seriesA} — the thing the hypothesis is ABOUT. Pure and static so the mapping has
 * exactly one definition and needs no Spring context to be read.
 *
 * <p>{@code hold} is part of the wire vocabulary (the FE's night/moon glyph) but has no v1
 * producer: the sleep series all read as {@code alvas}, and inventing a second sleep icon here
 * would be a design decision the contract has not made yet.
 */
public final class ObservationSourceIcon {

    public static final String NAPLO = "naplo";
    public static final String ALVAS = "alvas";
    public static final String EDZES = "edzes";
    public static final String VACSORA = "vacsora";
    public static final String MEZO = "mezo";

    private static final String LATE_MEAL = "late-meal-hour";

    private ObservationSourceIcon() {
    }

    /** A row without a test plan has no source to point at — that card is Mezo's own voice. */
    public static String of(TestPlanEnvelope plan) {
        if (plan == null || plan.seriesA() == null) {
            return MEZO;
        }
        String series = plan.seriesA();
        if (series.startsWith(DerivedSeriesService.PEOPLE_PREFIX)
                || series.startsWith(DerivedSeriesService.TOPIC_PREFIX)) {
            return NAPLO;
        }
        if (series.startsWith("sleep")) {
            return ALVAS;
        }
        if (LATE_MEAL.equals(series)) {
            return VACSORA;
        }
        if (series.startsWith("train") || series.startsWith("gym")) {
            return EDZES;
        }
        return MEZO;
    }
}
