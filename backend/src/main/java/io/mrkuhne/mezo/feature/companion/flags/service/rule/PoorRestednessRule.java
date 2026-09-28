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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): the morning "kipihentség" at or below
 * {@code restedAtMost} on {@code consecutiveMornings} consecutive calendar mornings inside the last
 * {@code windowDays} days (today included).
 *
 * <p>A day's MORNING value is the {@code morningSlot} (06:30) row's {@code rested}; without that
 * row, the day's first check-in's. NULL is "not answered" and breaks nothing and proves nothing: a
 * morning without an answer is simply absent, so it can neither extend nor count toward a run.
 * Honest gate: fewer answered mornings than {@code consecutiveMornings} ⇒ UNAVAILABLE.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PoorRestednessRule implements FlagRule {

    private final CheckInRepository checkInRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.PoorRestedness cfg = properties.poorRestedness();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);
        Map<LocalDate, List<CheckInEntity>> byDay = checkInRepository
            .findByCreatedByAndDeletedFalseAndDateBetween(userId, from, today).stream()
            .collect(Collectors.groupingBy(CheckInEntity::getDate, TreeMap::new, Collectors.toList()));

        Map<LocalDate, Integer> restedByMorning = new TreeMap<>();
        byDay.forEach((day, rows) -> {
            CheckInEntity morning = rows.stream()
                .filter(r -> cfg.morningSlot().equals(r.getSlotTime()))
                .findFirst()
                .orElseGet(() -> rows.stream().min(Comparator.comparing(CheckInEntity::getSlotTime)).orElseThrow());
            if (morning.getRested() != null) {
                restedByMorning.put(day, morning.getRested());
            }
        });

        if (restedByMorning.size() < cfg.consecutiveMornings()) {
            return FlagVerdict.unavailable(FlagKey.POOR_RESTEDNESS,
                UnavailableReason.NOT_ENOUGH_MORNING_ANSWERS);
        }

        // Newest-first scan for the first run of N consecutive low mornings; track the longest.
        List<LocalDate> run = new ArrayList<>();
        int longest = 0;
        for (LocalDate day = today; !day.isBefore(from); day = day.minusDays(1)) {
            Integer rested = restedByMorning.get(day);
            if (rested != null && rested <= cfg.restedAtMost()) {
                run.add(0, day);
                longest = Math.max(longest, run.size());
                if (run.size() >= cfg.consecutiveMornings()) {
                    break;
                }
            } else {
                run.clear();
            }
        }

        if (run.size() < cfg.consecutiveMornings()) {
            return FlagVerdict.clear(FlagKey.POOR_RESTEDNESS, new FlagVerdict.ClearEvidence(
                "low_rested_run", (double) longest, (double) cfg.consecutiveMornings(), null));
        }

        Map<String, Integer> frozen = new LinkedHashMap<>();
        restedByMorning.forEach((day, value) -> frozen.put(day.toString(), value));
        return FlagVerdict.raised(FlagKey.POOR_RESTEDNESS,
            FlagPayloadEnvelope.poorRestedness(new FlagPayloadEnvelope.PoorRestedness(
                cfg.restedAtMost(), cfg.consecutiveMornings(), cfg.windowDays(), cfg.morningSlot(),
                frozen, run.stream().map(LocalDate::toString).toList())));
    }
}
