package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Marker bean present ONLY when {@code mezo.feature.meso-review.enabled=true}; gates
 * {@code MesocycleReportService.getReport}'s {@code aiEvalEnabled} flag via {@code ObjectProvider}
 * — the FE's signal to show the AI section and poll {@code pending} instead of hiding it forever.
 *
 * <p>Deliberately lives in {@code feature.train}, not {@code feature.companion} (where the real
 * S3 AI-review generator lands, mezo-meyc.3 task 15): {@code companion} already depends on
 * {@code train} (context/tools reads — {@code TrainTools}, {@code DailySummaryService},
 * {@code ContextSnapshotAssembler}, {@code MetricSeriesService}), so a gate declared in
 * {@code companion} and consumed from {@code train}'s {@code MesocycleReportService} would close a
 * train↔companion cycle — forbidden by {@code ArchitectureTest.feature_slices_are_cycle_free}
 * (only the two already-frozen cycles are tolerated; this would be a brand-new one). Placing the
 * gate here — mirroring {@code HypertrophyDriveGate}/{@code ClosingBlockGate} — keeps the
 * dependency strictly one-directional; the companion listener/generator (task 15) is free to
 * import this class too, since companion→train is the sanctioned direction. No
 * {@code matchIfMissing} — the switch is declared explicitly (configuration_conventions.md).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.MESO_REVIEW_SWITCH, havingValue = "true")
public class MesoReviewGate {
}
