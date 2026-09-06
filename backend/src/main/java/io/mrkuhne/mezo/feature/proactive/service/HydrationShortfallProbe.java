package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferencesPort;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Round 2 S2 (bd mezo-d58h.7.2, spec 2026-09-05 §b/§12): "is this user behind on water RIGHT NOW,
 * on a day that asks for water" — the single detection behind both S2 channels (the midday/evening
 * prompt fact and the 15:00 checkpoint). The {@link LogFreshnessProbe} idiom: a deterministic,
 * separately testable read that the generator only renders.
 *
 * <p>Hydration is round 2's ONE intraday exception to the adherence-neutral firing policy (spec
 * §Decisions): water cannot be caught up at 22:00. The exception is paid for by four gates —
 * training day only, a pro-rated (not full-day) target, a floor under that pro-rated number, and
 * the batch-logger guard: with nothing at all logged today the day is UNOBSERVED, not dry, and
 * unobserved must stay silent.
 *
 * <p>The clock is a PARAMETER, never {@code LocalTime.now()} — the whole rule is "what fraction of
 * the waking day has elapsed", so an implicit clock would make every test depend on the hour it
 * runs at.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class HydrationShortfallProbe {

    /** All millilitres. {@code deficitMl} is {@code proRatedTargetMl - loggedMl}, always &gt; 0. */
    public record Shortfall(int loggedMl, int dailyTargetMl, int proRatedTargetMl, int deficitMl) {}

    private static final int MINUTES_PER_DAY = 24 * 60;

    private final ProactiveProperties properties;
    private final DietPreferencesPort dietPreferences;
    private final SleepAnchorPort sleepAnchorPort;
    private final WaterLogRepository waterLogRepository;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final MetricSeriesService metricSeriesService;
    private final LogFreshnessProbe logFreshnessProbe;

    /** Empty whenever the honest answer is "not enough to say anything" — see the gates inline. */
    @Transactional(readOnly = true)
    public Optional<Shortfall> evaluate(UUID userId, LocalDate date, LocalTime now) {
        ProactiveProperties.Hydration cfg = properties.hydration();
        if (!isTrainingDay(userId, date)) {
            return Optional.empty();
        }
        double elapsed = wakingFractionElapsed(userId, now);
        if (elapsed <= 0) {
            return Optional.empty();
        }
        int dailyTargetMl = dietPreferences.resolve(userId).waterMl();
        int proRatedMl = (int) Math.round(dailyTargetMl * elapsed);
        if (proRatedMl < cfg.minProRatedMl()) {
            return Optional.empty();
        }
        int loggedMl = waterLogRepository.sumAmountForDay(userId, date);
        if (loggedMl >= proRatedMl * cfg.shortfallPct() / 100.0) {
            return Optional.empty();
        }
        // Batch-logger guard (spec §12): zero water AND zero other logs today ⇒ the day is
        // unobserved, not dry. A water log alone also counts as "the user is logging today" —
        // LogFreshnessProbe deliberately does not cover water_log, so it is OR'd in here.
        if (loggedMl == 0 && !logFreshnessProbe.anyLoggedAfter(
                userId, date, date, date.atStartOfDay(ZoneId.systemDefault()).toInstant())) {
            return Optional.empty();
        }
        return Optional.of(new Shortfall(loggedMl, dailyTargetMl, proRatedMl, proRatedMl - loggedMl));
    }

    /** Planned gym slot today, a completed instance today, or any logged combined load today —
     *  the planned arm is load-bearing: hydration matters BEFORE the session, so a metric-only
     *  test would stay silent all morning on exactly the day that needs the signal. */
    private boolean isTrainingDay(UUID userId, LocalDate date) {
        // gym_schedule_slot.day_of_week is 0=Monday..6=Sunday (the entity's own comment).
        int dow = date.getDayOfWeek().getValue() - 1;
        boolean planned = gymScheduleSlotRepository
                .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
                .map(GymScheduleSlotEntity::getDayOfWeek)
                .anyMatch(d -> d != null && d == dow);
        if (planned) {
            return true;
        }
        if (!workoutSessionRepository.findDoneInstanceDates(userId, date, date).isEmpty()) {
            return true;
        }
        return metricSeriesService.series(userId, MetricKey.COMBINED_LOAD_MIN, date, date)
                .getOrDefault(date, 0.0) > 0;
    }

    /** Fraction of the wake→bed span already elapsed at {@code now}, clamped to 1.0; 0 before wake.
     *  A bed time at or before wake is past midnight — add a day before measuring. */
    private double wakingFractionElapsed(UUID userId, LocalTime now) {
        SleepAnchorPort.SleepAnchor anchor = sleepAnchorPort.resolve(userId);
        int wakeMin = anchor.wake().toSecondOfDay() / 60;
        int bedMin = anchor.bed().toSecondOfDay() / 60;
        if (bedMin <= wakeMin) {
            bedMin += MINUTES_PER_DAY;
        }
        int nowMin = now.toSecondOfDay() / 60;
        if (nowMin <= wakeMin) {
            return 0;
        }
        return Math.min(1.0, (nowMin - wakeMin) / (double) (bedMin - wakeMin));
    }
}
