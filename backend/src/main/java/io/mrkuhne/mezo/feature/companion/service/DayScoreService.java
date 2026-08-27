package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.config.MeWeekProperties;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Weekly review (mezo-p2tr, spec §2) — the deterministic {@code deriveScore} promoted from the
 * companion's exploratory scoring notes into a real service. Produces one {@link DayScore} per
 * calendar day in {@code [from, to]}: four domain subscores in {@code [0,100]} (sleep/fuel/
 * check-in/activity, {@code null} = "tanulom", i.e. not enough data that day) and an overall
 * {@code score} that is the rounded mean of whichever subscores are present — {@code null} when
 * fewer than two are.
 *
 * <p><b>Scale verification (per the task brief):</b> the brief's default formula assumed a 1-5
 * span for sleep {@code quality} and check-in {@code energy}. The actual FE inputs
 * ({@code frontend/src/features/me/sheets/SleepLogSheet.tsx}, quality dial rendered "{@code n}/10";
 * {@code frontend/src/features/today/sheets/CheckInSheet.tsx}, the 1-10 grid under each
 * {@code CHECKIN_DIMS} step) are BOTH 1-10 dials, not 1-5. The quality/energy normalization below
 * therefore uses {@code (v-1)/9}, not {@code (v-1)/4}.
 *
 * <p>One pass over the range: every {@link MetricSeriesService} series is fetched ONCE for the
 * whole {@code [from, to]} window (never re-queried per day), matching the V3.1 series-extraction
 * idiom this service builds on.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DayScoreService {

    /** Canonical check-in slots per day (Heartbeat's 4-step rhythm) — the checkin count denominator. */
    private static final int CANONICAL_CHECKIN_SLOTS = 4;
    /** The verified FE dial span for sleep quality / check-in energy: 1-10, not the brief's 1-5. */
    private static final double SCALE_MAX = 10.0;

    private final MetricSeriesService metricSeriesService;
    private final CheckInRepository checkInRepository;
    private final FuelDayService fuelDayService;
    private final MeWeekProperties properties;

    public record DaySubscores(Integer sleep, Integer fuel, Integer checkin, Integer activity) {
    }

    public record DayScore(LocalDate date, Integer score, DaySubscores subscores) {
    }

    @Transactional(readOnly = true)
    public List<DayScore> scores(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> durationH = metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, to);
        Map<LocalDate, Double> quality = metricSeriesService.series(userId, MetricKey.SLEEP_QUALITY, from, to);
        Map<LocalDate, Double> kcal = metricSeriesService.series(userId, MetricKey.DAILY_KCAL, from, to);
        Map<LocalDate, Double> protein = metricSeriesService.series(userId, MetricKey.DAILY_PROTEIN_G, from, to);
        Map<LocalDate, Double> gymVolume = metricSeriesService.series(userId, MetricKey.GYM_VOLUME_KG, from, to);
        Map<LocalDate, Double> sportLoad = metricSeriesService.series(userId, MetricKey.SPORT_LOAD_MIN, from, to);
        Map<LocalDate, Double> trainingRpe = metricSeriesService.series(userId, MetricKey.TRAINING_RPE, from, to);
        Map<LocalDate, Double> dailyXp = metricSeriesService.series(userId, MetricKey.DAILY_XP, from, to);
        Map<LocalDate, Double> checkinEnergy = metricSeriesService.series(userId, MetricKey.CHECKIN_ENERGY, from, to);
        Map<LocalDate, Long> checkinCounts = checkinCounts(userId, from, to);

        List<DayScore> result = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Integer sleep = sleepSubscore(durationH.get(day), quality.get(day));
            Integer fuel = fuelSubscore(userId, day, kcal.get(day), protein.get(day));
            Integer checkin = checkinSubscore(checkinCounts.getOrDefault(day, 0L), checkinEnergy.get(day));
            Integer activity = activitySubscore(
                    gymVolume.containsKey(day) || sportLoad.containsKey(day) || trainingRpe.containsKey(day),
                    dailyXp.get(day));
            result.add(new DayScore(day, overallScore(sleep, fuel, checkin, activity),
                    new DaySubscores(sleep, fuel, checkin, activity)));
        }
        return result;
    }

    /** Slot count per day inside the window — canonical Heartbeat cadence is 4/day. */
    private Map<LocalDate, Long> checkinCounts(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Long> counts = new HashMap<>();
        for (CheckInEntity checkIn : checkInRepository.findAllOwned(userId)) {
            if (!checkIn.getDate().isBefore(from) && !checkIn.getDate().isAfter(to)) {
                counts.merge(checkIn.getDate(), 1L, Long::sum);
            }
        }
        return counts;
    }

    /** {@code d = min(1, durationH/target)}; blended with quality (1-10) when present. Absent = no sleep row. */
    private Integer sleepSubscore(Double durationH, Double quality) {
        if (durationH == null) {
            return null;
        }
        double d = Math.min(1.0, durationH / properties.sleepTargetH());
        double value = quality == null ? d : 0.7 * d + 0.3 * clamp01((quality - 1) / (SCALE_MAX - 1));
        return toScore(value);
    }

    /**
     * kcal-closeness vs the day's {@link FuelDayService} target, blended with protein-hit ratio
     * when a protein target is prescribed. Absent when no kcal was logged that day, or the day's
     * kcal target is not positive (reused from {@code FuelDayService}, never re-derived here).
     */
    private Integer fuelSubscore(UUID userId, LocalDate day, Double kcalConsumed, Double proteinConsumed) {
        if (kcalConsumed == null) {
            return null;
        }
        MacroSet targets = fuelDayService.getDay(userId, day).getTargets();
        double kcalTarget = targets.getKcal().doubleValue();
        if (kcalTarget <= 0) {
            return null;
        }
        double kcalCloseness = Math.max(0.0, 1.0 - Math.abs(kcalConsumed / kcalTarget - 1.0) / properties.kcalBand());
        double proteinTarget = targets.getP().doubleValue();
        double value;
        if (proteinTarget > 0) {
            double protein = proteinConsumed == null ? 0.0 : proteinConsumed;
            value = 0.5 * kcalCloseness + 0.5 * Math.min(1.0, protein / proteinTarget);
        } else {
            value = kcalCloseness;
        }
        return toScore(value);
    }

    /** {@code c = count/4}, blended with the day's average energy (1-10) when any check-in has it. */
    private Integer checkinSubscore(long count, Double energyAvg) {
        if (count == 0) {
            return null;
        }
        double c = Math.min(1.0, count / (double) CANONICAL_CHECKIN_SLOTS);
        double value = energyAvg == null ? c : 0.6 * c + 0.4 * clamp01((energyAvg - 1) / (SCALE_MAX - 1));
        return toScore(value);
    }

    /** A logged workout alone maxes the subscore; otherwise XP alone scales it. Absent = neither signal. */
    private Integer activitySubscore(boolean workoutLogged, Double xp) {
        if (!workoutLogged && xp == null) {
            return null;
        }
        double xpRatio = xp == null ? 0.0 : Math.min(1.0, xp / properties.xpBaseline());
        double value = Math.max(workoutLogged ? 1.0 : 0.0, xpRatio);
        return toScore(value);
    }

    /** Rounded mean of the present subscores; {@code null} ("tanulom") below the 2-subscore honesty gate. */
    private static Integer overallScore(Integer... subscores) {
        int sum = 0;
        int present = 0;
        for (Integer subscore : subscores) {
            if (subscore != null) {
                sum += subscore;
                present++;
            }
        }
        if (present < 2) {
            return null;
        }
        return (int) Math.round(sum / (double) present);
    }

    private static double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private static Integer toScore(double value01) {
        return (int) Math.round(clamp01(value01) * 100);
    }
}
