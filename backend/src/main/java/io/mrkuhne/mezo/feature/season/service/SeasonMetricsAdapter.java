package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** {@link SeasonMetricsPort} over weight, sleep, wearable-day, check-in and recipe reads (season-side, see {@link SeasonGoalAdapter}). */
@Component
@RequiredArgsConstructor
public class SeasonMetricsAdapter implements SeasonMetricsPort {

    private final WeightLogRepository weightLogRepository;
    private final WeightTrendService weightTrendService;
    private final SleepLogRepository sleepLogRepository;
    private final RecipeRepository recipeRepository;
    private final DailyMetricRepository dailyMetricRepository;
    private final CheckInRepository checkInRepository;

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

    @Override
    public Map<String, Map<LocalDate, Double>> experimentSignals(UUID owner, LocalDate from, LocalDate to) {
        Map<String, Map<LocalDate, Double>> out = new LinkedHashMap<>();
        Map<LocalDate, Double> sleep = new TreeMap<>();
        sleepMinutes(owner, from, to).forEach((d, m) -> sleep.put(d, m.doubleValue()));
        out.put("sleep_min", sleep);
        Map<LocalDate, Double> deep = new TreeMap<>();
        for (SleepLogEntity s : sleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)) {
            if (s.getDeepMin() != null && s.getDeepMin() > 0) {
                deep.putIfAbsent(s.getDate(), s.getDeepMin().doubleValue());
            }
        }
        out.put("deep_min", deep);
        Map<LocalDate, Double> hrv = new TreeMap<>();
        Map<LocalDate, Double> rhr = new TreeMap<>();
        for (DailyMetricEntity m : dailyMetricRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDate(owner, from, to)) {
            if (m.getHrvMs() != null && m.getHrvMs().signum() > 0) {
                hrv.put(m.getDate(), m.getHrvMs().doubleValue());
            }
            if (m.getRestingHr() != null && m.getRestingHr() > 0) {
                rhr.put(m.getDate(), m.getRestingHr().doubleValue());
            }
        }
        out.put("hrv_ms", hrv);
        out.put("resting_hr", rhr);
        List<CheckInEntity> checkIns = checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(owner, from, to);
        out.put("energy", dayAverage(checkIns, CheckInEntity::getEnergy));
        out.put("mood", dayAverage(checkIns, CheckInEntity::getMood));
        out.put("morning_feel", dayAverage(checkIns, CheckInEntity::getRested));
        return out;
    }

    private static Map<LocalDate, Double> dayAverage(List<CheckInEntity> checkIns, Function<CheckInEntity, Integer> value) {
        Map<LocalDate, List<Integer>> byDay = new TreeMap<>();
        for (CheckInEntity c : checkIns) {
            Integer v = value.apply(c);
            if (v != null) {
                byDay.computeIfAbsent(c.getDate(), k -> new java.util.ArrayList<>()).add(v);
            }
        }
        Map<LocalDate, Double> out = new TreeMap<>();
        byDay.forEach((d, vs) -> out.put(d, vs.stream().mapToInt(Integer::intValue).average().orElseThrow()));
        return out;
    }
}
