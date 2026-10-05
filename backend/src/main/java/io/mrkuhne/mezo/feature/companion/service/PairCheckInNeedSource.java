package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInNeedSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Question of the day, last specific source (Check-in 2.0 follow-up A, spec §2.3): every
 * {@code mezo.companion.patterns.pairs} entry with a {@code CHECKIN_*} side whose statistical row
 * is not settled yet (no row, {@code proposed}, {@code monitoring}, {@code dormant}) is waiting on
 * that item — „Most azt figyeljük: {question}" with the pair's Motor-card question. A confirmed,
 * rejected, refuted or forgotten pair is answered and asks for nothing. Ordered last
 * ({@code @Order(3)}): a hypothesis' or detector's sentence is more specific.
 */
@Component
@Order(3)
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PairCheckInNeedSource implements CheckInNeedSource {

    static final String WHY = "Most azt figyeljük: %s";

    /** A pair whose row reached one of these is answered — it no longer needs data. */
    private static final Set<String> SETTLED = Set.of(PatternEntity.STATUS_CONFIRMED,
        PatternEntity.STATUS_REJECTED, PatternEntity.STATUS_REFUTED, PatternEntity.STATUS_FORGOTTEN);

    private final CompanionProperties properties;
    private final PatternRepository patternRepository;

    @Override
    @Transactional(readOnly = true)
    public List<Need> needs(UUID userId) {
        Map<String, String> status = patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)
            .stream()
            .filter(row -> PatternEntity.KIND_STATISTICAL.equals(row.getKind()))
            .collect(Collectors.toMap(PatternEntity::getPairKey, PatternEntity::getStatus, (a, b) -> a));
        return properties.patterns().pairs().stream()
            .filter(pair -> !SETTLED.contains(status.getOrDefault(pair.key(), "")))
            .flatMap(pair -> Stream.of(pair.metricA(), pair.metricB())
                .map(HypothesisCheckInNeedSource::checkInItem)
                .flatMap(Optional::stream)
                .map(item -> new Need(item, WHY.formatted(lowerFirst(pair.question())))))
            .toList();
    }

    private static String lowerFirst(String text) {
        return text.isEmpty() ? text : text.substring(0, 1).toLowerCase(Locale.ROOT) + text.substring(1);
    }
}
