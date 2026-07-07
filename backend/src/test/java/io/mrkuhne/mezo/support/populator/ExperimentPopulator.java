package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code experiment} rows (proactive P2). */
@TestComponent
@RequiredArgsConstructor
public class ExperimentPopulator {

    private final ExperimentRepository experimentRepository;

    /** A proposed-by-default experiment; status/metric/direction supplied. */
    public ExperimentEntity experiment(UUID createdBy, String status, String metricKey, String expectedDirection) {
        ExperimentEntity entity = new ExperimentEntity();
        entity.setCreatedBy(createdBy);
        entity.setTitle("Teszt kísérlet");
        entity.setHypothesis("Teszt hipotézis.");
        entity.setStatus(status);
        entity.setMetricKey(metricKey);
        entity.setExpectedDirection(expectedDirection);
        entity.setTotalDays(7);
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return experimentRepository.saveAndFlush(entity);
    }

    /** An active experiment with an explicit start date (for outcome-evaluation tests). */
    public ExperimentEntity active(UUID createdBy, String metricKey, String expectedDirection,
                                   LocalDate startDate, int totalDays) {
        ExperimentEntity entity = experiment(createdBy, ExperimentEntity.STATUS_ACTIVE, metricKey, expectedDirection);
        entity.setStartDate(startDate);
        entity.setTotalDays(totalDays);
        return experimentRepository.saveAndFlush(entity);
    }
}
