package io.mrkuhne.mezo.feature.lifegoal.engine;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * {@code type=metric} forrás — {@code source.key()} egy {@link MetricKey} neve, mindig ismert
 * (a katalógus-validáció ezt garantálja a LifeGoalService oldalán). Gated on both switches
 * (the FatigueEvidenceCollector precedent): a companion feature adja a {@link MetricSeriesService}
 * bean-t, ami a kapcsoló nélkül nem létezik.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.LIFEGOAL_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class MetricSignalSource implements SignalSource {

    private final MetricSeriesService metricSeriesService;

    @Override
    public boolean supports(PillarSourceJson source) {
        return "metric".equals(source.type());
    }

    @Override
    public SignalWindow window(UUID userId, PillarSourceJson source, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> raw = metricSeriesService.series(userId, MetricKey.valueOf(source.key()), from, to);
        return SignalWindow.of(toBigDecimal(raw));
    }

    static Map<LocalDate, BigDecimal> toBigDecimal(Map<LocalDate, Double> raw) {
        Map<LocalDate, BigDecimal> values = new HashMap<>();
        raw.forEach((day, v) -> values.put(day, BigDecimal.valueOf(v)));
        return values;
    }
}
