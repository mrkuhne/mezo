package io.mrkuhne.mezo.feature.companion.graph.service;

/** W2.5 (bd mezo-b3pp.10, spec §6.5): one nightly maintenance run's tallies for one user — logged
 *  by {@link GraphMaintenanceJob}, asserted directly by {@code GraphMaintenanceServiceIT}. */
public record GraphMaintenanceResult(
    int edgesDecayed, int edgesPruned, int candidatesPruned, int edgesReinforced) {
}
