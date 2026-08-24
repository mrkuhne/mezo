package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The W5.1 composite-flag rule set (bd mezo-b3pp.18, spec §9.1) — deterministic and
 * <b>LLM-free</b>: pure arithmetic over series that {@link MetricSeriesService} already composes
 * READ-ONLY from the owning features. Every threshold comes from {@link FlagProperties}; this
 * class holds no numbers of its own. It never writes: {@code FlagService} owns the cooldown gate
 * and the audit row.
 *
 * <p>Missing days stay missing (the MetricSeriesService rule) — the one exception is
 * {@code HABITS_DONE}, where "no habit_day row" genuinely means zero completions.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagEvaluator {

    private final MetricSeriesService metricSeriesService;
    private final SleepGoalRepository sleepGoalRepository;
    private final FlagProperties properties;

    /** Every flag that is TRUE for {@code userId} right now, cooldowns NOT yet applied. */
    @Transactional(readOnly = true)
    public List<FlagRaise> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagRaise> raises = new ArrayList<>();
        sustainedStress(userId, today).ifPresent(raises::add);
        sleepDebt(userId, today).ifPresent(raises::add);
        return raises;
    }

    private Optional<FlagRaise> sustainedStress(UUID userId, LocalDate today) {
        FlagProperties.SustainedStress cfg = properties.sustainedStress();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);
        Map<LocalDate, Double> stress =
            metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today);

        Map<String, Double> byDay = new LinkedHashMap<>();
        int over = 0;
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            Double value = stress.get(day);
            if (value == null) {
                continue;
            }
            byDay.put(day.toString(), value);
            if (value >= cfg.threshold()) {
                over++;
            }
        }
        if (over < cfg.minDays()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.SUSTAINED_STRESS,
            FlagPayloadEnvelope.sustainedStress(new FlagPayloadEnvelope.SustainedStress(
                cfg.threshold(), cfg.windowDays(), cfg.minDays(), over, byDay))));
    }

    private Optional<FlagRaise> sleepDebt(UUID userId, LocalDate today) {
        FlagProperties.SleepDebt cfg = properties.sleepDebt();
        // Today's night is logged tomorrow morning — the window ends YESTERDAY.
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(cfg.nights() - 1L);
        Map<LocalDate, Double> sleep =
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, to);

        double goalHours = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)
            .map(SleepGoalEntity::getTargetMinutes)
            .map(minutes -> minutes / 60.0)
            .orElse(cfg.defaultGoalHours());

        Map<String, Double> byDay = new LinkedHashMap<>();
        double deficit = 0;
        int logged = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Double hours = sleep.get(day);
            if (hours == null) {
                continue;
            }
            logged++;
            byDay.put(day.toString(), hours);
            deficit += Math.max(0, goalHours - hours); // a long night never repays a short one
        }
        if (logged < cfg.minNights() || deficit < cfg.deficitHours()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.SLEEP_DEBT,
            FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                goalHours, cfg.nights(), logged, cfg.deficitHours(), deficit, byDay))));
    }
}
