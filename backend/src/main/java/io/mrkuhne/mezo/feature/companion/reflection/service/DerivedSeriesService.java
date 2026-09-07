package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.companion.service.MetricValueKind;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S1 (bd mezo-eq85.1): one series lookup over BOTH the fixed {@link MetricKey} catalog and
 * the open-ended, user-specific {@code people:<név>} / {@code topic:<téma>} presence series the text
 * signals make possible. Later slices correlate arbitrary pairs of these keys, so they need a single
 * seam that answers "give me this key's series / kind / label" and "is this key real for this user".
 *
 * <p>A person/topic series is BINARY presence per day: 1.0 when the day's newest-version signals
 * name it, 0.0 when the day has signals but does not, and ABSENT when the day has no signal at all
 * — silence is not evidence of absence.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class DerivedSeriesService {

    public static final String PEOPLE_PREFIX = "people:";
    public static final String TOPIC_PREFIX = "topic:";

    /** How far back {@link #isKnown} looks for evidence that a person/topic key is real. */
    private static final int KNOWN_LOOKBACK_DAYS = 180;

    /** How far back {@link #availableSeries} looks for the person/topic keys worth offering. */
    private static final int AVAILABLE_LOOKBACK_DAYS = 30;

    private final TextSignalSeriesService textSignalSeriesService;
    private final MetricSeriesService metricSeriesService;

    /** An unresolvable key yields an EMPTY series, never an exception — keys come from stored config. */
    @Transactional(readOnly = true)
    public Map<LocalDate, Double> series(UUID userId, String key, LocalDate from, LocalDate to) {
        if (key.startsWith(PEOPLE_PREFIX)) {
            String name = TextFold.fold(key.substring(PEOPLE_PREFIX.length())).strip();
            return presence(userId, from, to, s -> namesAnyMatch(s.getPeople(), name));
        }
        if (key.startsWith(TOPIC_PREFIX)) {
            String topic = key.substring(TOPIC_PREFIX.length()).toLowerCase(Locale.ROOT);
            return presence(userId, from, to, s -> s.getTopics().contains(topic));
        }
        return metricKey(key).map(k -> metricSeriesService.series(userId, k, from, to)).orElse(Map.of());
    }

    /** Person/topic keys are always binary; a metric key reports its own kind. */
    public MetricValueKind valueKindOf(String key) {
        return key.startsWith(PEOPLE_PREFIX) || key.startsWith(TOPIC_PREFIX)
                ? MetricValueKind.BINARY
                : metricKey(key).map(MetricKey::valueKind).orElse(MetricValueKind.NUMBER);
    }

    /** Hungarian display label; an unresolvable key is shown as itself rather than invented. */
    public String labelOf(String key) {
        if (key.startsWith(PEOPLE_PREFIX)) {
            return "„" + key.substring(PEOPLE_PREFIX.length()) + "” a szövegeidben";
        }
        if (key.startsWith(TOPIC_PREFIX)) {
            return key.substring(TOPIC_PREFIX.length()) + " téma";
        }
        return metricKey(key).map(MetricKey::labelHu).orElse(key);
    }

    /**
     * Is this key real FOR THIS USER? A metric key is known when the wire key resolves at all; a
     * person/topic key only when at least one signal of the last {@value #KNOWN_LOOKBACK_DAYS} days
     * actually carries it — a pattern must never be proposed about a person the user never wrote about.
     */
    @Transactional(readOnly = true)
    public boolean isKnown(UUID userId, String key) {
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(KNOWN_LOOKBACK_DAYS);
        if (key.startsWith(PEOPLE_PREFIX)) {
            String name = TextFold.fold(key.substring(PEOPLE_PREFIX.length())).strip();
            return textSignalSeriesService.newestPerSource(userId, from, to).stream()
                    .anyMatch(s -> namesAnyMatch(s.getPeople(), name));
        }
        if (key.startsWith(TOPIC_PREFIX)) {
            String topic = key.substring(TOPIC_PREFIX.length()).toLowerCase(Locale.ROOT);
            return textSignalSeriesService.newestPerSource(userId, from, to).stream()
                    .anyMatch(s -> s.getTopics().contains(topic));
        }
        return metricKey(key).isPresent();
    }

    /**
     * S3 (mezo-eq85.3): every series key that is real for this user RIGHT NOW — the correlatable
     * {@link MetricKey} wire keys plus the {@code people:}/{@code topic:} keys the last
     * {@value #AVAILABLE_LOOKBACK_DAYS} days of text signals actually carry. It is what the
     * proposal prompt is allowed to offer the model: a plan can only name a series that exists,
     * so the honest menu has to come from the same place {@link #isKnown} answers from.
     */
    @Transactional(readOnly = true)
    public List<String> availableSeries(UUID userId) {
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(AVAILABLE_LOOKBACK_DAYS);
        Set<String> keys = new LinkedHashSet<>();
        Arrays.stream(MetricKey.values())
                .filter(MetricKey::correlatable)
                .map(MetricKey::wireKey)
                .forEach(keys::add);
        for (TextSignalEntity signal : textSignalSeriesService.newestPerSource(userId, from, to)) {
            signal.getPeople().forEach(person -> keys.add(PEOPLE_PREFIX + person));
            signal.getTopics().forEach(topic -> keys.add(TOPIC_PREFIX + topic));
        }
        return List.copyOf(keys);
    }

    /** Wire key ({@code sleep-duration-h}) → enum; empty when nothing matches. */
    public static Optional<MetricKey> metricKey(String wireKey) {
        return Arrays.stream(MetricKey.values()).filter(k -> k.wireKey().equals(wireKey)).findFirst();
    }

    /**
     * Név-egyezés HAJTOGATOTT alakon (bd mezo-xih1) — a korábbi {@code equalsIgnoreCase} az
     * ékezeten hasadt („Réka" ≠ „Reka"), pedig a {@code text_signal.people} írási idejű
     * normalizálása után is maradhat ékezet-variáns egy tárolt kulcs és egy régebbi sor között.
     */
    private static boolean namesAnyMatch(List<String> storedNames, String foldedName) {
        return storedNames.stream().anyMatch(p -> TextFold.fold(p).strip().equals(foldedName));
    }

    private Map<LocalDate, Double> presence(UUID userId, LocalDate from, LocalDate to,
                                            Predicate<TextSignalEntity> match) {
        Map<LocalDate, Double> out = new HashMap<>();
        for (TextSignalEntity signal : textSignalSeriesService.newestPerSource(userId, from, to)) {
            out.merge(signal.getOccurredOn(), match.test(signal) ? 1.0 : 0.0, Math::max);
        }
        return out;
    }
}
