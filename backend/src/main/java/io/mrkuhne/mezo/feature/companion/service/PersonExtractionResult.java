package io.mrkuhne.mezo.feature.companion.service;

/** Az éjszakai people-kör egy user/nap kimenete (GraphMaintenanceJob logsora). {@code edgeLinked}
 *  (S5, mezo-06o0.4): hány aktív, még éltelen PERSON node kapott ma éjjel él-strukturálást. */
public record PersonExtractionResult(int enriched, int candidates, int edgeLinked) {
    public static final PersonExtractionResult ZERO = new PersonExtractionResult(0, 0, 0);
}
