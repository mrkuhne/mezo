package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MeWeekAggregates;
import io.mrkuhne.mezo.api.dto.MeWeekDay;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.api.dto.MeWeekSubscores;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Weekly review (mezo-p2tr, spec §2) — assembles {@link MeWeekResponse} for one ISO-Monday week:
 * per-day live values (fuel/sleep/check-in/train/weight/xp) + the {@link DayScoreService} day
 * scores + weekly aggregates. Everything is code-computed and deterministic; a day/aggregate
 * with insufficient data renders {@code null} ("tanulom"), never a fabricated value.
 *
 * <p>Called by the generator (Task 5) and renderer (Task 9) via the exact
 * {@link #week(UUID, LocalDate)} method signature.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MeWeekService {

    /** Canonical check-in slots per day — the {@code checkinRatio} denominator (Heartbeat's 4-step rhythm). */
    private static final int CANONICAL_CHECKIN_SLOTS = 4;

    private final DayScoreService dayScoreService;
    private final WeeklyScoreService weeklyScoreService;
    private final FuelDayService fuelDayService;
    private final MetricSeriesService metricSeriesService;
    private final SleepLogRepository sleepLogRepository;
    private final CheckInRepository checkInRepository;
    private final WeightLogRepository weightLogRepository;
    private final WeightTrendService weightTrendService;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;

    /** Read-WRITE on purpose (mezo-d20.7.5): every full computation of a week writes the
     *  week's score THROUGH into {@code weekly_score} ({@link WeeklyScoreService#record}), which is what
     *  keeps the trend's cache warm from all three paths that already run this method — the
     *  {@code /api/me/week/{start}} read, {@code WeeklyReviewGenerator.gather} and
     *  {@code WeekContextRenderer}'s per-chat-turn render. */
    @Transactional
    public MeWeekResponse week(UUID userId, LocalDate start) {
        LocalDate end = start.plusDays(6);

        // B1 (mezo-8tp8): fetch each day's FuelDayResponse ONCE and hand it into DayScoreService's
        // pre-fetched overload — buildDay needs the same rollup for its own display fields, so
        // fetching it again inside the score computation would be a redundant call per day.
        Map<LocalDate, FuelDayResponse> fuelByDate = new HashMap<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            fuelByDate.put(day, fuelDayService.getDay(userId, day));
        }

        List<DayScoreService.DayScore> dayScores = dayScoreService.scores(userId, start, end, fuelByDate);
        Map<LocalDate, DayScoreService.DayScore> scores = dayScores.stream()
                .collect(Collectors.toMap(DayScoreService.DayScore::date, s -> s));
        Map<LocalDate, SleepLogEntity> sleepByDate = latestSleepByDate(userId, start, end);
        Map<LocalDate, List<CheckInEntity>> checkinsByDate = checkinsByDate(userId, start, end);
        Map<LocalDate, WeightLogEntity> weightByDate = latestWeightByDate(userId, start, end);
        Map<LocalDate, Long> gymCounts = countByDate(
                workoutSessionRepository.findDoneInstancesBetween(userId, start, end), WorkoutSessionEntity::getDate);
        Map<LocalDate, Long> sportCounts = countByDate(sportSessionsInWindow(userId, start, end), SportSessionEntity::getDate);
        Map<LocalDate, Long> runCounts = countByDate(runSessionsInWindow(userId, start, end), RunSessionLogEntity::getDate);
        Map<LocalDate, Double> xpSeries = metricSeriesService.series(userId, MetricKey.DAILY_XP, start, end);

        List<MeWeekDay> days = new ArrayList<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            days.add(buildDay(day, scores.get(day), fuelByDate.get(day),
                    sleepByDate.get(day), checkinsByDate.getOrDefault(day, List.of()),
                    weightByDate.get(day),
                    gymCounts.getOrDefault(day, 0L) + sportCounts.getOrDefault(day, 0L) + runCounts.getOrDefault(day, 0L),
                    xpSeries.get(day)));
        }

        // Write-through: the week's own score is persisted here (mezo-d20.7.5) and the SAME
        // roll-up is used for the response, so there is exactly one definition of "the weekly
        // score" in the codebase.
        Integer weeklyScore = weeklyScoreService.record(userId, start, dayScores).score();
        // The previous week now comes from that cache (recomputed only when its own data moved),
        // replacing what used to be a SECOND complete score run on every single week read.
        Integer prevWeekScore = weeklyScoreService.scoreFor(userId, start.minusWeeks(1));

        return MeWeekResponse.builder()
                .start(start)
                .days(days)
                .weekly(aggregates(userId, start, end, days, weeklyScore, prevWeekScore))
                .build();
    }

    private MeWeekDay buildDay(LocalDate day, DayScoreService.DayScore score, FuelDayResponse fuelDay,
            SleepLogEntity sleep, List<CheckInEntity> checkins, WeightLogEntity weight,
            long workoutCount, Double xp) {
        boolean loggedFuel = !fuelDay.getMeals().isEmpty();
        MacroSet consumed = fuelDay.getConsumed();
        MacroSet targets = fuelDay.getTargets();
        return MeWeekDay.builder()
                .date(day)
                .score(score != null ? score.score() : null)
                .subscores(toSubscores(score))
                .kcal(loggedFuel ? consumed.getKcal() : null)
                .proteinG(loggedFuel ? consumed.getP() : null)
                .carbsG(loggedFuel ? consumed.getC() : null)
                .fatG(loggedFuel ? consumed.getF() : null)
                .kcalTarget(targets.getKcal())
                .proteinTargetG(targets.getP())
                .weightKg(weight != null ? weight.getWeightKg() : null)
                .sleepMin(sleep != null && sleep.getDurationH() != null
                        ? (int) Math.round(sleep.getDurationH().doubleValue() * 60) : null)
                .sleepQuality(sleep != null && sleep.getQuality() != null
                        ? BigDecimal.valueOf(sleep.getQuality()) : null)
                .checkinCount(checkins.size())
                .checkinEnergyAvg(average(checkins.stream()
                        .map(CheckInEntity::getEnergy).filter(java.util.Objects::nonNull).toList()))
                .workoutCount((int) workoutCount)
                .xp(xp != null ? (int) Math.round(xp) : null)
                .build();
    }

    private static MeWeekSubscores toSubscores(DayScoreService.DayScore score) {
        if (score == null) {
            return new MeWeekSubscores();
        }
        DayScoreService.DaySubscores s = score.subscores();
        return new MeWeekSubscores().sleep(s.sleep()).fuel(s.fuel()).checkin(s.checkin()).activity(s.activity());
    }

    private MeWeekAggregates aggregates(
            UUID userId, LocalDate start, LocalDate end, List<MeWeekDay> days,
            Integer weeklyScore, Integer prevWeekScore) {
        List<MeWeekDay> fuelDays = days.stream().filter(d -> d.getKcal() != null).toList();
        List<MeWeekDay> sleepDays = days.stream().filter(d -> d.getSleepMin() != null).toList();
        List<MeWeekDay> checkinEnergyDays = days.stream().filter(d -> d.getCheckinEnergyAvg() != null).toList();

        int elapsedDays = elapsedDays(start, end);
        int filledSlots = days.stream().mapToInt(MeWeekDay::getCheckinCount).sum();

        LocalDate today = LocalDate.now();
        Optional<MeWeekDay> latestWeightDay = days.stream()
                .filter(d -> d.getWeightKg() != null && !d.getDate().isAfter(today))
                .max(Comparator.comparing(MeWeekDay::getDate));

        var trend = weightTrendService.computeTrend(userId);

        List<Integer> totalXpParts = days.stream().map(MeWeekDay::getXp)
                .filter(java.util.Objects::nonNull).toList();

        return MeWeekAggregates.builder()
                .score(weeklyScore)
                .prevWeekScore(prevWeekScore)
                .avgKcal(averageDecimal(fuelDays.stream().map(MeWeekDay::getKcal).toList()))
                .avgProteinG(averageDecimal(fuelDays.stream().map(MeWeekDay::getProteinG).toList()))
                .avgSleepMin(averageDecimal(sleepDays.stream()
                        .map(d -> BigDecimal.valueOf(d.getSleepMin())).toList()))
                .avgCheckinEnergy(averageDecimal(checkinEnergyDays.stream()
                        .map(MeWeekDay::getCheckinEnergyAvg).toList()))
                .checkinRatio(elapsedDays > 0
                        ? BigDecimal.valueOf(filledSlots)
                            .divide(BigDecimal.valueOf((long) CANONICAL_CHECKIN_SLOTS * elapsedDays), 4, RoundingMode.HALF_UP)
                        : null)
                .latestWeightKg(latestWeightDay.map(MeWeekDay::getWeightKg).orElse(null))
                .weightWeeklyRateKg(trend.getWeeklyRateKgPerWeek())
                .totalXp(totalXpParts.isEmpty() ? null
                        : totalXpParts.stream().mapToInt(Integer::intValue).sum())
                .build();
    }

    private static final String[] HU_DOW = {"H", "K", "Sze", "Cs", "P", "Szo", "V"};

    /**
     * One day's compact Hungarian one-liner (score + subscores + fuel + weight + sleep + check-in
     * + workout + XP) — the SINGLE source of truth shared by {@code WeeklyReviewGenerator}'s LLM
     * payload (mezo-p2tr, spec §5) and {@code WeekContextRenderer}'s {@code [Heti adatok]} block
     * (Task 9): both render the exact same day line, so the review's own prompt and the chat's
     * anchored context can never drift apart on what "the day" looked like.
     */
    public static String renderDayLine(MeWeekDay day) {
        MeWeekSubscores subscores = day.getSubscores();
        StringBuilder sb = new StringBuilder("- ").append(day.getDate())
                .append(" (").append(HU_DOW[day.getDate().getDayOfWeek().getValue() - 1]).append("): ")
                .append("score ").append(orDash(day.getScore()))
                .append(" [alvás ").append(orDash(subscores != null ? subscores.getSleep() : null))
                .append(" · fuel ").append(orDash(subscores != null ? subscores.getFuel() : null))
                .append(" · checkin ").append(orDash(subscores != null ? subscores.getCheckin() : null))
                .append(" · aktivitás ").append(orDash(subscores != null ? subscores.getActivity() : null))
                .append(']')
                .append(", ").append(orDashDecimal(day.getKcal())).append(" kcal / cél ")
                .append(orDashDecimal(day.getKcalTarget()))
                .append(", fehérje ").append(orDashDecimal(day.getProteinG())).append('g')
                .append(", súly ").append(orDashDecimal(day.getWeightKg()));
        if (day.getSleepMin() != null) {
            sb.append(", alvás ").append(day.getSleepMin() / 60).append("ó")
                    .append(day.getSleepMin() % 60).append('p');
            if (day.getSleepQuality() != null) {
                sb.append(" (").append(orDashDecimal(day.getSleepQuality())).append(')');
            }
        } else {
            sb.append(", alvás –");
        }
        sb.append(", ").append(day.getCheckinCount() != null ? day.getCheckinCount() : 0).append(" check-in")
                .append(", ").append(day.getWorkoutCount() != null ? day.getWorkoutCount() : 0).append(" edzés")
                .append(", ").append(orDash(day.getXp())).append(" XP");
        return sb.toString();
    }

    private static String orDash(Object v) {
        return v != null ? v.toString() : "–";
    }

    private static String orDashDecimal(BigDecimal v) {
        return v != null ? v.stripTrailingZeros().toPlainString() : "–";
    }

    /** {@code min(7, today - start + 1)}; a fully-past week always uses the full 7. A fully-future
     *  week (today before start) returns 0 — the honest "hasn't started yet" signal that
     *  {@link #aggregates} turns into a {@code null} {@code checkinRatio} rather than 0.0. The
     *  {@code Math.max(1, …)} below is now unreachable as a clamp: the fully-future early return
     *  covers every case that used to need it. */
    private static int elapsedDays(LocalDate start, LocalDate end) {
        LocalDate today = LocalDate.now();
        if (today.isAfter(end)) {
            return 7;
        }
        if (today.isBefore(start)) {
            return 0;
        }
        long elapsed = java.time.temporal.ChronoUnit.DAYS.between(start, today) + 1;
        return (int) Math.max(1, Math.min(7, elapsed));
    }

    private static BigDecimal average(List<Integer> values) {
        if (values.isEmpty()) {
            return null;
        }
        return BigDecimal.valueOf(values.stream().mapToInt(Integer::intValue).average().orElseThrow())
                .setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal averageDecimal(List<BigDecimal> values) {
        if (values.isEmpty()) {
            return null;
        }
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    /** Multi-row days keep the row with the LARGEST duration (the {@code MetricSeriesService.sleep} idiom). */
    private Map<LocalDate, SleepLogEntity> latestSleepByDate(UUID userId, LocalDate start, LocalDate end) {
        Map<LocalDate, SleepLogEntity> byDate = new HashMap<>();
        for (SleepLogEntity sleep : sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(userId, start, end)) {
            byDate.merge(sleep.getDate(), sleep, (a, b) -> {
                BigDecimal da = a.getDurationH() == null ? BigDecimal.ZERO : a.getDurationH();
                BigDecimal db = b.getDurationH() == null ? BigDecimal.ZERO : b.getDurationH();
                return db.compareTo(da) > 0 ? b : a;
            });
        }
        return byDate;
    }

    /** B2 (mezo-8tp8): queries the {@code [start, end]} window directly instead of loading every
     *  check-in the user has ever logged via {@link CheckInRepository#findAllOwned} and filtering
     *  in Java. */
    private Map<LocalDate, List<CheckInEntity>> checkinsByDate(UUID userId, LocalDate start, LocalDate end) {
        return checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(userId, start, end).stream()
                .collect(Collectors.groupingBy(CheckInEntity::getDate));
    }

    /** Latest (by {@code createdAt}) weigh-in per calendar day — the "latest entry per day" rule. */
    private Map<LocalDate, WeightLogEntity> latestWeightByDate(UUID userId, LocalDate start, LocalDate end) {
        Map<LocalDate, WeightLogEntity> byDate = new HashMap<>();
        weightLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, start)
                .stream()
                .filter(w -> !w.getDate().isAfter(end))
                .sorted(Comparator.comparing(WeightLogEntity::getCreatedAt))
                .forEach(w -> byDate.put(w.getDate(), w)); // last write per date wins = most recent createdAt
        return byDate;
    }

    private List<SportSessionEntity> sportSessionsInWindow(UUID userId, LocalDate start, LocalDate end) {
        return sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, start).stream()
                .filter(s -> !s.getDate().isAfter(end))
                .toList();
    }

    private List<RunSessionLogEntity> runSessionsInWindow(UUID userId, LocalDate start, LocalDate end) {
        return runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, start).stream()
                .filter(r -> !r.getDate().isAfter(end))
                .toList();
    }

    private static <T> Map<LocalDate, Long> countByDate(List<T> rows, java.util.function.Function<T, LocalDate> dateOf) {
        return rows.stream()
                .filter(r -> dateOf.apply(r) != null)
                .collect(Collectors.groupingBy(dateOf, Collectors.counting()));
    }
}
