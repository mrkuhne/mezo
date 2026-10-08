package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.train.service.RecoveryPeriodService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The user stopped logging (spec 2026-09-03 §4 row 1) — ONE flag carrying the list of stale
 * domains, so the card can name them instead of scolding about targets. This is the rule that
 * exists because every value-based rule goes honestly quiet when the data stops: on 2026-08-27
 * logging collapsed and the detectors muted themselves precisely when something was wrong.
 *
 * <p>Recency, not day-buckets: the thresholds are in HOURS and {@code MetricSeriesService} is a
 * day-bucketed aggregate, so this rule reads {@code meal_.logged_at} and {@code check_in.saved_at}
 * (real instants — WHEN the user logged, which is what an engagement gap means) from the
 * repositories directly. Sleep is counted in wake-mornings: {@code sleep_log} carries only a
 * date, and "no sleep log for 2 mornings" is the spec's own wording.
 *
 * <p>Spec §4 row 5 rides along: when {@code sleep_debt} cannot speak because too few nights are
 * logged, but the logged ones average at least the configured deficit, the payload carries that
 * suspicion — "gap + suspicion" instead of silence.
 *
 * <p>Deliberately does NOT reuse {@code feature.proactive.service.LogFreshnessProbe}, even though
 * the design spec seeds this rule from it: {@code LogFreshnessProbe} lives in {@code
 * feature.proactive}, which already depends on {@code feature.companion} — reusing it here would
 * create exactly the cycle {@code feature.appnotification} exists to prevent. It also answers a
 * different question (a single best-effort boolean "any log in window", {@code createdAt}-based,
 * no per-domain breakdown), not the per-domain, {@code loggedAt}/{@code savedAt}-based staleness
 * this rule needs.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LoggingGapRule implements FlagRule {

    private static final String DOMAIN_MEAL = "meal";
    private static final String DOMAIN_CHECKIN = "checkin";
    private static final String DOMAIN_SLEEP = "sleep";
    private static final int HOURS_PER_DAY = 24;
    /** Far beyond any stale threshold, so a long excused stretch is still fully counted. */
    private static final long EXCUSED_LOOKBACK_DAYS = 60;

    private final MealRepository mealRepository;
    private final CheckInRepository checkInRepository;
    private final SleepLogRepository sleepLogRepository;
    private final SleepDeficitCalculator sleepDeficitCalculator;
    private final FlagProperties properties;
    /** Kihagyás S3: recovery-period days are not part of the observed gap. */
    private final RecoveryPeriodService recoveryPeriodService;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.LoggingGap cfg = properties.loggingGap();
        Instant now = Instant.now();

        // Kihagyás S3: recovery-period days (illness, injury, travel…) are dropped from the
        // observed gap — a stretch the user was excused from is not "stopped logging". Loaded
        // ONCE, over the widest horizon the staleness reads can reach.
        Set<LocalDate> excused = recoveryPeriodService
            .fuelDays(userId, today.minusDays(EXCUSED_LOOKBACK_DAYS), today).keySet();

        Integer mealHoursSince = mealRepository
            .findFirstByCreatedByAndDeletedFalseOrderByLoggedAtDesc(userId)
            .map(MealEntity::getLoggedAt)
            .map(loggedAt -> hoursBetween(loggedAt, now)
                - HOURS_PER_DAY * excusedDaysAfter(excused, localDate(loggedAt), today))
            .orElse(null);
        Integer checkinHoursSince = checkInRepository
            .findFirstByCreatedByAndDeletedFalseOrderBySavedAtDesc(userId)
            .map(CheckInEntity::getSavedAt)
            .map(savedAt -> hoursBetween(savedAt, now)
                - HOURS_PER_DAY * excusedDaysAfter(excused, localDate(savedAt), today))
            .orElse(null);
        Integer sleepMorningsSince = sleepLogRepository
            .findFirstByCreatedByAndDeletedFalseOrderByDateDesc(userId)
            .map(SleepLogEntity::getDate)
            .map(date -> (int) ChronoUnit.DAYS.between(date, today) - excusedDaysAfter(excused, date, today))
            .orElse(null);

        List<String> stale = new ArrayList<>();
        // A domain with NO row at all is stale: never-logged is the most stale a domain gets.
        if (mealHoursSince == null || mealHoursSince >= cfg.mealStaleHours()) {
            stale.add(DOMAIN_MEAL);
        }
        if (checkinHoursSince == null || checkinHoursSince >= cfg.checkinStaleHours()) {
            stale.add(DOMAIN_CHECKIN);
        }
        if (sleepMorningsSince == null || sleepMorningsSince >= cfg.sleepStaleMornings()) {
            stale.add(DOMAIN_SLEEP);
        }
        if (stale.size() < cfg.minStaleDomains()) {
            return FlagVerdict.clear(FlagKey.LOGGING_GAP, new FlagVerdict.ClearEvidence(
                "stale_domains", (double) stale.size(), (double) cfg.minStaleDomains(),
                String.join(",", stale)));
        }

        // Spec §4 row 5: the suspicion is attached only when sleep_debt itself stayed silent for
        // want of nights AND the nights that exist are short enough to matter.
        FlagProperties.SleepDebt sleepCfg = properties.sleepDebt();
        SleepDeficitCalculator.Deficit d = sleepDeficitCalculator.over(
            userId, today.minusDays(sleepCfg.nights() - 1L), today);
        boolean suspicious = d.loggedNights() > 0
            && d.loggedNights() < sleepCfg.minNights()
            && d.deficitPerLoggedNight() >= cfg.sleepSuspicionDeficitHours();

        return FlagVerdict.raised(FlagKey.LOGGING_GAP,
            FlagPayloadEnvelope.loggingGap(new FlagPayloadEnvelope.LoggingGap(
                stale, cfg.mealStaleHours(), mealHoursSince,
                cfg.checkinStaleHours(), checkinHoursSince,
                cfg.sleepStaleMornings(), sleepMorningsSince,
                suspicious ? cfg.sleepSuspicionDeficitHours() : null,
                suspicious ? d.deficitPerLoggedNight() : null,
                suspicious ? d.loggedNights() : null)));
    }

    /** Excused dates strictly after {@code last} up to {@code today} — each one removes a day from the gap. */
    private static int excusedDaysAfter(Set<LocalDate> excused, LocalDate last, LocalDate today) {
        return (int) excused.stream().filter(d -> d.isAfter(last) && !d.isAfter(today)).count();
    }

    private static LocalDate localDate(Instant instant) {
        return instant.atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private static int hoursBetween(Instant from, Instant to) {
        return (int) Duration.between(from, to).toHours();
    }
}
