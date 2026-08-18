package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.train.MesocycleClosed;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The S3 post-close trigger (mezo-meyc.3): once a run's {@code mesocycle_report} row is committed,
 * generate its AI review asynchronously. AFTER_COMMIT is load-bearing — the generator reads the row
 * back and writes to it from another thread, so it must never see an uncommitted (or rolled-back)
 * report. The {@code FactExtractionListener} idiom.
 *
 * <p>Gated on the COMPANION switch ONLY — deliberately not also on
 * {@code mezo.feature.meso-review.enabled}, unlike {@code FactExtractionListener}'s two-switch shape:
 * the deterministic lifestyle context must be assembled on every close even when the NARRATIVE is
 * off, and {@link MesoReviewGenerator} is the one place that knows the difference (it consumes
 * {@code MesoReviewGate} through an {@code ObjectProvider} and stops after the context write).
 *
 * <p>Failures are logged and swallowed here as well as inside the generator: nothing about a review
 * may escape onto the executor's default handler.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MesoReviewListener {

    private final MesoReviewGenerator mesoReviewGenerator;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMesocycleClosed(MesocycleClosed event) {
        try {
            mesoReviewGenerator.generate(event.userId(), event.mesocycleId());
        } catch (Exception e) {
            log.warn("Post-close meso review failed for run {}", event.mesocycleId(), e);
        }
    }
}
