package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.port.CapacityMetricsPort;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** {@link CapacityMetricsPort} over the wearable's daily metric rows (live rows only). */
@Component
@RequiredArgsConstructor
public class CapacityMetricsAdapter implements CapacityMetricsPort {

    private final DailyMetricRepository metrics;

    @Override
    public Map<LocalDate, DayMetric> metrics(UUID owner, LocalDate from, LocalDate to) {
        Map<LocalDate, DayMetric> out = new LinkedHashMap<>();
        for (DailyMetricEntity m : metrics.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDate(owner, from, to)) {
            out.put(m.getDate(), new DayMetric(m.getDate(), m.getRestingHr(),
                m.getHrvMs() == null ? null : m.getHrvMs().doubleValue()));
        }
        return out;
    }
}
