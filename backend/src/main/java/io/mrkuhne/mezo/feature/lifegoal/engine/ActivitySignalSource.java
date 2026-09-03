package io.mrkuhne.mezo.feature.lifegoal.engine;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * {@code type=activity} forrás — a tartomány sorai közül {@code source.skillKey()}-re szűr,
 * naponta aggregál {@code source.measure()} szerint: {@code minutes} → Σ durationMin (null → 0
 * hozzájárulás), {@code count} → darabszám, {@code huf} → Σ amountHuf. Sor nélküli nap nincs a
 * térképben (no_data — a LifeGoalScorer honest-absence szabálya).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class ActivitySignalSource implements SignalSource {

    private static final String MEASURE_MINUTES = "minutes";
    private static final String MEASURE_COUNT = "count";
    private static final String MEASURE_HUF = "huf";

    private final ActivityLogRepository activityLogRepository;

    @Override
    public boolean supports(PillarSourceJson source) {
        return "activity".equals(source.type());
    }

    @Override
    public SignalWindow window(UUID userId, PillarSourceJson source, LocalDate from, LocalDate to) {
        Map<LocalDate, BigDecimal> values = new HashMap<>();
        for (ActivityLogEntity log : activityLogRepository.findByCreatedByAndOccurredOnBetween(userId, from, to)) {
            if (!Objects.equals(source.skillKey(), log.getSkillKey())) {
                continue;
            }
            BigDecimal contribution = contribution(source.measure(), log.getExtracted());
            values.merge(log.getOccurredOn(), contribution, BigDecimal::add);
        }
        return SignalWindow.of(values);
    }

    private static BigDecimal contribution(String measure, ActivityExtract extracted) {
        return switch (measure) {
            case MEASURE_MINUTES -> extracted == null || extracted.durationMin() == null
                    ? BigDecimal.ZERO : BigDecimal.valueOf(extracted.durationMin());
            case MEASURE_COUNT -> BigDecimal.ONE;
            case MEASURE_HUF -> extracted == null || extracted.amountHuf() == null
                    ? BigDecimal.ZERO : BigDecimal.valueOf(extracted.amountHuf());
            default -> throw new SystemRuntimeErrorException(
                    SystemMessage.error("LIFE_GOAL_UNKNOWN_ACTIVITY_MEASURE").build(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        };
    }
}
