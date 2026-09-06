package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * Companion-owned read seam (ADR 0012 consumer-owned-port idiom, the {@link NudgeSendPort}
 * precedent) for the editorial severity ranking that decides the day's card. The observer orders
 * its 13 rules by this and NEVER by a list of its own — spec 2026-09-05 §4.3: "the read side never
 * invents a ranking either".
 *
 * <p>The implementation is {@code proactive.service.AdviceRankAdapter} over {@code AdvicePriority}.
 * A direct import would close a {@code companion ↔ proactive} feature-slice cycle ({@code
 * AdvicePriority} already imports {@link FlagKey}), which {@code
 * ArchitectureTest.feature_slices_are_cycle_free} rejects.
 */
public interface AdviceRankPort {

    /** Lower is more severe. An unknown key ranks last rather than throwing. */
    int rankOf(String flagKey);
}
