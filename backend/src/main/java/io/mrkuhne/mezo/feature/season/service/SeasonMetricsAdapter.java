package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** {@link SeasonMetricsPort} over weight, sleep and recipe reads (season-side, see {@link SeasonGoalAdapter}). */
@Component
@RequiredArgsConstructor
public class SeasonMetricsAdapter implements SeasonMetricsPort {

    private final WeightLogRepository weightLogRepository;
    private final WeightTrendService weightTrendService;
    private final SleepLogRepository sleepLogRepository;
    private final RecipeRepository recipeRepository;

    @Override
    public Optional<BigDecimal> latestWeightKg(UUID owner) {
        return weightLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(owner)
            .map(WeightLogEntity::getWeightKg);
    }

    @Override
    public List<TrendPoint> trend(UUID owner) {
        WeightTrendResponse t = weightTrendService.computeTrend(owner);
        if (t == null || t.getEwmaSeries() == null) {
            return List.of();
        }
        return t.getEwmaSeries().stream().map(p -> new TrendPoint(p.getDate(), p.getTrendKg())).toList();
    }

    @Override
    public BigDecimal trendRateKgPerWeek(UUID owner) {
        WeightTrendResponse t = weightTrendService.computeTrend(owner);
        return t == null || "none".equals(t.getDataSufficiency().getValue()) ? null : t.getWeeklyRateKgPerWeek();
    }

    @Override
    public int weighInDaysSince(UUID owner, LocalDate from) {
        return (int) weightLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(owner, from)
            .stream().map(WeightLogEntity::getDate).distinct().count();
    }

    @Override
    public Integer averageSleepMinutes(UUID owner, LocalDate from, LocalDate to) {
        List<BigDecimal> hours = sleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)
            .stream().map(SleepLogEntity::getDurationH).filter(h -> h != null && h.signum() > 0).toList();
        if (hours.isEmpty()) {
            return null;
        }
        BigDecimal sum = hours.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.multiply(BigDecimal.valueOf(60)).divide(BigDecimal.valueOf(hours.size()), 0, RoundingMode.HALF_UP)
            .intValue();
    }

    @Override
    public Map<LocalDate, Integer> sleepMinutes(UUID owner, LocalDate from, LocalDate to) {
        Map<LocalDate, Integer> out = new LinkedHashMap<>();
        for (SleepLogEntity s : sleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)) {
            if (s.getDurationH() != null && s.getDurationH().signum() > 0) {
                out.putIfAbsent(s.getDate(), s.getDurationH().multiply(BigDecimal.valueOf(60))
                    .setScale(0, RoundingMode.HALF_UP).intValue());
            }
        }
        return out;
    }

    @Override
    public long recipeCount(UUID owner) {
        return recipeRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner).size();
    }
}
