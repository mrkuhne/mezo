package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code prediction} rows (proactive P1). */
@TestComponent
@RequiredArgsConstructor
public class PredictionPopulator {

    private final PredictionRepository predictionRepository;

    public PredictionEntity prediction(UUID createdBy, LocalDate weekStart, String metricKey,
                                       String expectedDirection, String status) {
        PredictionEntity entity = new PredictionEntity();
        entity.setCreatedBy(createdBy);
        entity.setWeekStart(weekStart);
        entity.setTitle("Teszt predikció");
        entity.setBasis("Teszt alap.");
        entity.setConfidence(null);
        entity.setMetricKey(metricKey);
        entity.setExpectedDirection(expectedDirection);
        entity.setValidFrom(weekStart);
        entity.setValidTo(weekStart.plusDays(6));
        entity.setStatus(status);
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return predictionRepository.saveAndFlush(entity);
    }
}
