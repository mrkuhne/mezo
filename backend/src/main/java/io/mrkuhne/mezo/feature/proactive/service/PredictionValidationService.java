package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * P1 deterministic prediction validation (spec §5 "a job evaluates closed windows deterministically
 * where possible"): PURE CODE, LLM-free. For each pending prediction whose window has closed
 * (valid_to &lt; today), the shared {@link MetricWindowEvaluator} compares the window's metric against
 * the preceding 7 days and the status flips to validated|missed with a code-formatted {@code actual}.
 * No data in either compare window ⇒ the row stays pending (honest — no fabricated verdict).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class PredictionValidationService {

    private final PredictionRepository predictionRepository;
    private final MetricWindowEvaluator evaluator;

    @Transactional
    public int validateClosedWindows(UUID userId, LocalDate today) {
        List<PredictionEntity> due = predictionRepository
                .findByCreatedByAndStatusAndValidToBefore(userId, PredictionEntity.STATUS_PENDING, today);
        int closed = 0;
        for (PredictionEntity p : due) {
            MetricWindowEvaluator.Verdict v = evaluator.evaluate(
                    userId, p.getMetricKey(), p.getValidFrom(), p.getValidTo(),
                    p.getValidFrom().minusDays(7), p.getValidFrom().minusDays(1));
            if (v == null) {
                continue;   // no data in a compare window — stays pending
            }
            p.setStatus(v.direction().equals(p.getExpectedDirection())
                    ? PredictionEntity.STATUS_VALIDATED
                    : PredictionEntity.STATUS_MISSED);
            p.setActual(v.actualText());
            predictionRepository.saveAndFlush(p);
            closed++;
        }
        return closed;
    }
}
