package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.PatternImpactResponse;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;

import java.util.UUID;

/**
 * mezo-tk88.3: the pattern-detail page's downstream-impact port. {@link PatternPairDetailService}
 * needs the predictions/experiments/challenges (and promoted fact) grounded on a pattern, but that
 * data lives in {@code feature.proactive} — and {@code feature.proactive} ALREADY imports
 * {@code feature.companion} extensively (generators pull context/facts/patterns). A direct
 * {@code feature.companion → feature.proactive} import would therefore create a brand-new
 * companion↔proactive cycle, which ArchitectureTest's {@code feature_slices_are_cycle_free}
 * (frozen — only the pre-existing biometrics↔goal/meal↔recipe cycles are tolerated) would reject.
 *
 * <p>This interface inverts the dependency: it lives in {@code feature.companion} (so
 * {@link PatternPairDetailService} only ever depends on its own package), and its real
 * implementation ({@code io.mrkuhne.mezo.feature.proactive.service.PatternImpactService}) is wired
 * in by Spring at runtime — the only import that crosses the boundary is
 * proactive → companion, which already exists.
 */
public interface PatternImpactSource {

    /** {@code row == null} (the pair never went live) always yields the empty impact block. */
    PatternImpactResponse impact(UUID userId, PatternEntity row);
}
