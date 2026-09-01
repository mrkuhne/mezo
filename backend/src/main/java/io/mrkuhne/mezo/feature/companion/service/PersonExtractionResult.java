package io.mrkuhne.mezo.feature.companion.service;

/** Az éjszakai people-kör egy user/nap kimenete (GraphMaintenanceJob logsora). */
public record PersonExtractionResult(int enriched, int candidates) {
    public static final PersonExtractionResult ZERO = new PersonExtractionResult(0, 0);
}
