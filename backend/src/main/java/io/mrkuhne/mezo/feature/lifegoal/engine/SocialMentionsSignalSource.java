package io.mrkuhne.mezo.feature.lifegoal.engine;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * {@code type=social_mentions} forrás — fixen {@link MetricKey#SOCIAL_MENTIONS}, ugyanazon a
 * {@link MetricSeriesService} porton át, mint a {@link MetricSignalSource}.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.LIFEGOAL_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class SocialMentionsSignalSource implements SignalSource {

    private final MetricSeriesService metricSeriesService;

    @Override
    public boolean supports(PillarSourceJson source) {
        return "social_mentions".equals(source.type());
    }

    @Override
    public SignalWindow window(UUID userId, PillarSourceJson source, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> raw = metricSeriesService.series(userId, MetricKey.SOCIAL_MENTIONS, from, to);
        return SignalWindow.of(MetricSignalSource.toBigDecimal(raw));
    }
}
