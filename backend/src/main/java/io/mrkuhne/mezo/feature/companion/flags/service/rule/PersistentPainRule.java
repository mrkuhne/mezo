package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): the same pain region reported ("Fáj valami?
 * Igen" + that region) on at least {@code minDays} of the last {@code windowDays} days, today
 * included. Reads the raw {@code check_in} rows — regions are a set per row, not a metric.
 *
 * <p>NULL is "not answered": a row whose pain gate is NULL is neither a pain day nor a pain-free
 * day. Honest gate: fewer days with ANY pain answer (Nem or Igen) than {@code minDays} ⇒ the rule
 * could never raise, so it is UNAVAILABLE rather than a clear.
 *
 * <p>The card's "lighten tomorrow" action is NOT offered yet: deciding whether tomorrow's planned
 * exercises load the region needs the region → muscle-group map the training-readiness slice
 * introduces ({@code PainRegionMap}, Check-in 2.0 Task 7). The payload already freezes the region,
 * so that wiring is additive.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PersistentPainRule implements FlagRule {

    private final CheckInRepository checkInRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.PersistentPain cfg = properties.persistentPain();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);
        List<CheckInEntity> rows =
            checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(userId, from, today);

        Set<LocalDate> answeredDays = new HashSet<>();
        Map<PainRegion, TreeSet<LocalDate>> daysByRegion = new EnumMap<>(PainRegion.class);
        Map<LocalDate, Integer> maxIntensityByDay = new TreeMap<>();
        for (CheckInEntity row : rows) {
            if (row.getPain() == null) {
                continue; // not answered — neither a pain day nor a pain-free day
            }
            answeredDays.add(row.getDate());
            if (!row.getPain() || row.getPainRegions() == null) {
                continue;
            }
            for (PainRegion region : row.getPainRegions()) {
                daysByRegion.computeIfAbsent(region, r -> new TreeSet<>()).add(row.getDate());
            }
            if (row.getPainIntensity() != null) {
                maxIntensityByDay.merge(row.getDate(), row.getPainIntensity(), Math::max);
            }
        }

        if (answeredDays.size() < cfg.minDays()) {
            return FlagVerdict.unavailable(FlagKey.PERSISTENT_PAIN,
                UnavailableReason.NOT_ENOUGH_PAIN_ANSWERS);
        }

        // Most days first; on a tie the region reported most recently; then the enum's own order.
        Map.Entry<PainRegion, TreeSet<LocalDate>> best = daysByRegion.entrySet().stream()
            .min(Comparator.<Map.Entry<PainRegion, TreeSet<LocalDate>>>comparingInt(e -> -e.getValue().size())
                .thenComparing(e -> e.getValue().last(), Comparator.reverseOrder())
                .thenComparing(Map.Entry::getKey))
            .orElse(null);
        int bestDays = best == null ? 0 : best.getValue().size();
        if (bestDays < cfg.minDays()) {
            return FlagVerdict.clear(FlagKey.PERSISTENT_PAIN, new FlagVerdict.ClearEvidence(
                "pain_region_days", (double) bestDays, (double) cfg.minDays(),
                best == null ? null : best.getKey().name()));
        }

        Integer maxIntensity = best.getValue().stream()
            .map(maxIntensityByDay::get)
            .filter(v -> v != null)
            .max(Integer::compare)
            .orElse(null);
        return FlagVerdict.raised(FlagKey.PERSISTENT_PAIN,
            FlagPayloadEnvelope.persistentPain(new FlagPayloadEnvelope.PersistentPain(
                best.getKey().name(), bestDays, cfg.minDays(), cfg.windowDays(), answeredDays.size(),
                best.getValue().stream().map(LocalDate::toString).toList(), maxIntensity)));
    }
}
