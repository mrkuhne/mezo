package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): the day-MEAN {@code motivation} at or below
 * {@code motivationAtMost} on at least {@code minDays} of the last {@code windowDays} days, today
 * included. The mean is over the day's ANSWERED check-ins only — NULL is "not answered", never a
 * middling score — and a day with no motivation answer has no mean at all.
 *
 * <p>Honest gate: fewer answered days than {@code minDays} ⇒ UNAVAILABLE.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MotivationSlumpRule implements FlagRule {

    private final CheckInRepository checkInRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.MotivationSlump cfg = properties.motivationSlump();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);
        Map<LocalDate, Double> meanByDay = checkInRepository
            .findByCreatedByAndDeletedFalseAndDateBetween(userId, from, today).stream()
            .filter(c -> c.getMotivation() != null)
            .collect(Collectors.groupingBy(CheckInEntity::getDate, TreeMap::new,
                Collectors.averagingInt(CheckInEntity::getMotivation)));

        if (meanByDay.size() < cfg.minDays()) {
            return FlagVerdict.unavailable(FlagKey.MOTIVATION_SLUMP,
                UnavailableReason.NOT_ENOUGH_MOTIVATION_ANSWERS);
        }

        int lowDays = (int) meanByDay.values().stream().filter(v -> v <= cfg.motivationAtMost()).count();
        if (lowDays < cfg.minDays()) {
            return FlagVerdict.clear(FlagKey.MOTIVATION_SLUMP, new FlagVerdict.ClearEvidence(
                "low_motivation_days", (double) lowDays, (double) cfg.minDays(), null));
        }

        Map<String, Double> frozen = new LinkedHashMap<>();
        meanByDay.forEach((day, mean) -> frozen.put(day.toString(), mean));
        return FlagVerdict.raised(FlagKey.MOTIVATION_SLUMP,
            FlagPayloadEnvelope.motivationSlump(new FlagPayloadEnvelope.MotivationSlump(
                cfg.motivationAtMost(), lowDays, cfg.minDays(), cfg.windowDays(), frozen)));
    }
}
