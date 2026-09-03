package io.mrkuhne.mezo.feature.lifegoal.engine;

import io.mrkuhne.mezo.api.dto.WeightTrendPoint;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * {@code type=weight_goal} forrás — a linked ág: napi trend-súly (EWMA, {@link
 * WeightTrendService}) az aktív súlycél ({@link GoalRepository}) {@code startDate}/{@code
 * targetDate} vonalán haladó ütemvonal ({@code targets}) mellett. Nincs aktív cél, vagy
 * {@code targetWeightKg == null}, vagy a trend-serie üres → üres {@code values} (a
 * LifeGoalScorer honest-absence szabálya szerint minden nap {@code no_data}).
 *
 * <p>A rule-beli {@code startValue}/{@code targetValue} itt nem számít — az igazság forrása az
 * aktív {@link GoalEntity}; a scorer linked-ága a {@code targets}-ből dönt.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class WeightGoalSignalSource implements SignalSource {

    private static final String ACTIVE_STATUS = "active";
    private static final int TARGET_SCALE = 3;

    private final GoalRepository goalRepository;
    private final WeightTrendService weightTrendService;

    @Override
    public boolean supports(PillarSourceJson source) {
        return "weight_goal".equals(source.type());
    }

    @Override
    public SignalWindow window(UUID userId, PillarSourceJson source, LocalDate from, LocalDate to) {
        List<GoalEntity> active = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, ACTIVE_STATUS);
        if (active.isEmpty()) {
            return new SignalWindow(Map.of(), Map.of());
        }
        GoalEntity goal = active.get(0);
        if (goal.getTargetWeightKg() == null) {
            return new SignalWindow(Map.of(), Map.of());
        }

        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        if (trend.getEwmaSeries().isEmpty()) {
            return new SignalWindow(Map.of(), Map.of());
        }

        Map<LocalDate, BigDecimal> values = new HashMap<>();
        for (WeightTrendPoint point : trend.getEwmaSeries()) {
            LocalDate date = point.getDate();
            if (!date.isBefore(from) && !date.isAfter(to)) {
                values.put(date, point.getTrendKg());
            }
        }

        Map<LocalDate, BigDecimal> targets = new HashMap<>();
        long totalDays = ChronoUnit.DAYS.between(goal.getStartDate(), goal.getTargetDate());
        BigDecimal delta = goal.getTargetWeightKg().subtract(goal.getStartWeightKg());
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            if (day.isBefore(goal.getStartDate()) || day.isAfter(goal.getTargetDate())) {
                continue;
            }
            long elapsed = ChronoUnit.DAYS.between(goal.getStartDate(), day);
            BigDecimal expected = totalDays == 0
                    ? goal.getTargetWeightKg()
                    : goal.getStartWeightKg().add(
                            delta.multiply(BigDecimal.valueOf(elapsed))
                                    .divide(BigDecimal.valueOf(totalDays), TARGET_SCALE, RoundingMode.HALF_UP));
            targets.put(day, expected);
        }

        return new SignalWindow(values, targets);
    }
}
