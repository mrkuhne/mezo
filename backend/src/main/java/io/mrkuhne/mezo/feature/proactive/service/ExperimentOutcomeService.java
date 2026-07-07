package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
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
 * P2 deterministic experiment outcome evaluation (spec §5.2): PURE CODE, LLM-free. For each active
 * experiment whose window has closed ({@code start_date + total_days <= today}), the shared
 * {@link MetricWindowEvaluator} compares the experiment window against the equally-long baseline
 * before start; the status flips to {@code completed} with a code-formatted {@code outcome}.
 * A direction match ⇒ {@code outcome_good = true}, else false; NO data in a compare window ⇒
 * completed with {@code outcome_good = null} (honest "inconclusive" — §9 decision aa).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ExperimentOutcomeService {

    private final ExperimentRepository experimentRepository;
    private final MetricWindowEvaluator evaluator;

    @Transactional
    public int evaluateClosed(UUID userId, LocalDate today) {
        List<ExperimentEntity> active = experimentRepository
                .findByCreatedByAndStatusOrderByGeneratedAtDesc(userId, ExperimentEntity.STATUS_ACTIVE);
        int closed = 0;
        for (ExperimentEntity e : active) {
            LocalDate start = e.getStartDate();
            if (start == null) {
                continue;   // defensive — an active row always has a start
            }
            LocalDate winTo = start.plusDays(e.getTotalDays() - 1);
            if (!today.isAfter(winTo)) {
                continue;   // window not closed yet
            }
            MetricWindowEvaluator.Verdict v = evaluator.evaluate(
                    userId, e.getMetricKey(), start, winTo,
                    start.minusDays(e.getTotalDays()), start.minusDays(1));
            e.setStatus(ExperimentEntity.STATUS_COMPLETED);
            if (v == null) {
                e.setOutcome("Nem értékelhető — nincs elég adat.");
                e.setOutcomeGood(null);   // honest inconclusive
            } else {
                boolean good = v.direction().equals(e.getExpectedDirection());
                e.setOutcomeGood(good);
                e.setOutcome((good ? "Beigazolódott · " : "Nem igazolódott · ") + v.actualText());
            }
            experimentRepository.saveAndFlush(e);
            closed++;
        }
        return closed;
    }
}
