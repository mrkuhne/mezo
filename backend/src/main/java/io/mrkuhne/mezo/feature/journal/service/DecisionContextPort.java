package io.mrkuhne.mezo.feature.journal.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Journal-owned read seam for the companion's rendered context-snapshot text (ADR 0029, mirroring
 * ADR 0012's consumer-owned-port idiom): {@link DecisionService} depends on this, never directly on
 * {@code ContextSnapshotAssembler} — a direct import would close a {@code journal ↔ companion}
 * feature-slice cycle ({@code companion} already imports {@code journal} for the embed listeners),
 * which {@code ArchitectureTest.feature_slices_are_cycle_free} rejects as a NEW cycle rather than
 * freezing it.
 *
 * <p>The companion feature supplies the adapter, gated on {@code COMPANION_SWITCH}; with the
 * companion off there is no bean, so {@code DecisionService} consumes this through an {@code
 * ObjectProvider} and degrades to an EMPTY snapshot text — never fabricated, never a failed decision
 * write (IDENT-3).
 */
public interface DecisionContextPort {

    /** Renders today's context snapshot text for a decision capture; never {@code null}. */
    String render(UUID userId, LocalDate today);
}
