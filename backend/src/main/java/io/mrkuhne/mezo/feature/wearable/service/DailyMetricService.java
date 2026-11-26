package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.api.dto.DailyMetricIn;
import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Apple Health day totals → {@code daily_metric}, one row per (owner, date) (mezo-r36n9.2); each batch publishes a
 * {@link DailyMetricsIngestedEvent}.
 */
@Service
@RequiredArgsConstructor
public class DailyMetricService {

    private final DailyMetricRepository repository;
    private final WearableProperties properties;
    private final ApplicationEventPublisher events;

    @Transactional
    public IngestResult ingest(UUID createdBy, List<DailyMetricIn> days) {
        WearableBatches.requireAtMost(days.size(), properties.maxDays());
        Set<LocalDate> existing = new HashSet<>(
            repository.findExistingDates(createdBy, days.stream().map(DailyMetricIn::getDate).toList()));
        Set<LocalDate> seen = new HashSet<>();
        int inserted = 0;
        for (DailyMetricIn d : days) {
            repository.upsert(createdBy, d.getDate(), d.getSteps(), d.getRestingHr(), d.getAvgHr(), d.getMinHr(),
                d.getMaxHr(), d.getActiveKcal(), d.getDistanceM(), d.getBasalKcal(), d.getExerciseMin(), d.getHrvMs(),
                d.getRespRate(), d.getSpo2Pct(), d.getWristTempC(), d.getVo2max(), d.getWalkingHr(),
                d.getMindfulMin(), d.getDaylightMin());
            if (!existing.contains(d.getDate()) && seen.add(d.getDate())) {
                inserted++;
            }
        }
        if (!days.isEmpty()) {
            // after commit the capacity loop re-reads today (Boop B7 K3); wearable knows no listener
            events.publishEvent(new DailyMetricsIngestedEvent(createdBy,
                days.stream().map(DailyMetricIn::getDate).distinct().toList()));
        }
        return new IngestResult(inserted, days.size() - inserted);
    }
}
