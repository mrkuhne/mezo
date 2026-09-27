package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CravingKind;
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
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): a strong craving ({@code craving >=
 * cravingAtLeast}) of the SAME kind on at least {@code minDays} of the last {@code windowDays}
 * days, today included. The card names the kind and — when one daypart holds more than half of
 * the qualifying check-ins — the daypart ("főleg délután").
 *
 * <p>NULL is "not answered": a strong craving whose kinds were not answered counts for no kind.
 * Honest gate: fewer days with ANY craving answer than {@code minDays} ⇒ UNAVAILABLE.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CravingStreakRule implements FlagRule {

    private final CheckInRepository checkInRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.CravingStreak cfg = properties.cravingStreak();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);
        List<CheckInEntity> rows =
            checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(userId, from, today);

        Set<LocalDate> answeredDays = new HashSet<>();
        Map<CravingKind, TreeSet<LocalDate>> daysByKind = new EnumMap<>(CravingKind.class);
        Map<CravingKind, List<String>> slotsByKind = new EnumMap<>(CravingKind.class);
        for (CheckInEntity row : rows) {
            if (row.getCraving() == null) {
                continue;
            }
            answeredDays.add(row.getDate());
            if (row.getCraving() < cfg.cravingAtLeast() || row.getCravingKinds() == null) {
                continue;
            }
            for (CravingKind kind : row.getCravingKinds()) {
                daysByKind.computeIfAbsent(kind, k -> new TreeSet<>()).add(row.getDate());
                slotsByKind.computeIfAbsent(kind, k -> new ArrayList<>()).add(row.getSlotTime());
            }
        }

        if (answeredDays.size() < cfg.minDays()) {
            return FlagVerdict.unavailable(FlagKey.CRAVING_STREAK,
                UnavailableReason.NOT_ENOUGH_CRAVING_ANSWERS);
        }

        Map.Entry<CravingKind, TreeSet<LocalDate>> best = daysByKind.entrySet().stream()
            .min(Comparator.<Map.Entry<CravingKind, TreeSet<LocalDate>>>comparingInt(e -> -e.getValue().size())
                .thenComparing(Map.Entry::getKey))
            .orElse(null);
        int bestDays = best == null ? 0 : best.getValue().size();
        if (bestDays < cfg.minDays()) {
            return FlagVerdict.clear(FlagKey.CRAVING_STREAK, new FlagVerdict.ClearEvidence(
                "craving_kind_days", (double) bestDays, (double) cfg.minDays(),
                best == null ? null : best.getKey().name()));
        }

        return FlagVerdict.raised(FlagKey.CRAVING_STREAK,
            FlagPayloadEnvelope.cravingStreak(new FlagPayloadEnvelope.CravingStreak(
                best.getKey().name(), bestDays, cfg.minDays(), cfg.windowDays(), cfg.cravingAtLeast(),
                answeredDays.size(), best.getValue().stream().map(LocalDate::toString).toList(),
                dominantDaypart(slotsByKind.get(best.getKey())))));
    }

    /** The daypart holding MORE than half of the slots, else null. */
    static String dominantDaypart(List<String> slots) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String slot : slots) {
            String part = daypart(slot);
            if (part != null) {
                counts.merge(part, 1, Integer::sum);
            }
        }
        return counts.entrySet().stream()
            .filter(e -> e.getValue() * 2 > slots.size())
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse(null);
    }

    /** "HH:mm" → reggel (&lt;09) | délelőtt (&lt;12) | délután (&lt;18) | este; null if unparseable. */
    static String daypart(String slotTime) {
        if (slotTime == null || slotTime.length() < 2) {
            return null;
        }
        int hour;
        try {
            hour = Integer.parseInt(slotTime.substring(0, 2));
        } catch (NumberFormatException e) {
            return null;
        }
        if (hour < 9) {
            return "reggel";
        }
        if (hour < 12) {
            return "délelőtt";
        }
        return hour < 18 ? "délután" : "este";
    }
}
