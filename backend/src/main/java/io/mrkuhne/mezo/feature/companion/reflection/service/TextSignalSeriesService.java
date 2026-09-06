package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S1 (bd mezo-eq85.1): per-day scalar series read off {@code text_signal}, feeding the
 * four TEXT_* {@code MetricKey}s. Two rules define every value here:
 *
 * <ul>
 *   <li>exactly ONE signal counts per {@code (source_kind, source_id)} — the newest version, so an
 *       edited entry replaces rather than doubles its own day's contribution;
 *   <li>only {@code sure} rows contribute numbers. A day whose every signal is {@code unsure} is
 *       ABSENT from the numeric series (not zero) — the correlation aligns on presence and must
 *       never see an invented value.
 * </ul>
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class TextSignalSeriesService {

    /** The three numeric fields a signal can carry. */
    public enum Field { MOOD, ENERGY, STRESS }

    private final TextSignalRepository textSignalRepository;

    /** Mean of the day's {@code sure} values; days without one are absent. */
    @Transactional(readOnly = true)
    public Map<LocalDate, Double> numeric(UUID userId, Field field, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        for (TextSignalEntity signal : newestPerSource(userId, from, to)) {
            Integer value = switch (field) {
                case MOOD -> signal.getMood();
                case ENERGY -> signal.getEnergy();
                case STRESS -> signal.getStress();
            };
            if (signal.isSure() && value != null) {
                perDay.computeIfAbsent(signal.getOccurredOn(), d -> new ArrayList<>()).add(value.doubleValue());
            }
        }
        Map<LocalDate, Double> out = new HashMap<>();
        perDay.forEach((day, values) ->
                out.put(day, values.stream().mapToDouble(Double::doubleValue).average().orElse(0)));
        return out;
    }

    /**
     * 1.0 on a day where ANY (newest-version) signal names a person, 0.0 on a day that has signals
     * but no person, absent on a day with no signal at all. Deliberately NOT gated on
     * {@code sure}: whether a name appears in the text is an observation about the text, not a
     * judgement call the model could be unsure about.
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, Double> socialContact(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> out = new HashMap<>();
        for (TextSignalEntity signal : newestPerSource(userId, from, to)) {
            out.merge(signal.getOccurredOn(), signal.getPeople().isEmpty() ? 0.0 : 1.0, Math::max);
        }
        return out;
    }

    /**
     * The newest version of every source in the window. Package-visible for
     * {@link DerivedSeriesService}, which must apply the SAME newest-version-wins rule. NOT
     * {@code @Transactional}: a package-private method is not reliably advised by the proxy, and
     * every caller (here and in {@code DerivedSeriesService}) is already inside a read-only tx.
     */
    List<TextSignalEntity> newestPerSource(UUID userId, LocalDate from, LocalDate to) {
        Map<String, TextSignalEntity> newest = new LinkedHashMap<>();
        for (TextSignalEntity signal : textSignalRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnAscVersionDesc(
                        userId, from, to)) {
            // first seen per key = highest version (the query orders version desc)
            newest.putIfAbsent(signal.getSourceKind() + ':' + signal.getSourceId(), signal);
        }
        return List.copyOf(newest.values());
    }
}
