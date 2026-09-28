package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInNeedSource;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
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
 * Question of the day, first source (Check-in 2.0 follow-up A, spec §2.3): a Reflexió-owned
 * hypothesis ({@code reflection}/{@code ai_hypothesis}) still {@code proposed}/{@code monitoring}
 * whose falsifiable test plan reads a {@code checkin-*} series is waiting on that item —
 * „Most egy sejtést tesztelünk: „{title}”." Ordered first ({@code @Order(1)}): a live hypothesis
 * is the most specific reason to ask; the character detectors come next, the catalog pairs last
 * ({@link PairCheckInNeedSource}).
 */
@Component
@Order(1)
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class HypothesisCheckInNeedSource implements CheckInNeedSource {

    static final String WHY = "Most egy sejtést tesztelünk: „%s”.";

    private static final Set<String> ACTIVE = Set.of(PatternEntity.STATUS_PROPOSED, PatternEntity.STATUS_MONITORING);

    private static final Map<String, CheckInItem> ITEM_BY_WIRE_KEY = Arrays.stream(MetricKey.values())
        .filter(key -> checkInItem(key).isPresent())
        .collect(Collectors.toUnmodifiableMap(MetricKey::wireKey, key -> checkInItem(key).orElseThrow()));

    private final PatternRepository patternRepository;

    @Override
    @Transactional(readOnly = true)
    public List<Need> needs(UUID userId) {
        return patternRepository.findByCreatedByAndStatusInAndDeletedFalse(userId, ACTIVE).stream()
            .filter(PatternEntity::isReflectionOwned)
            .filter(row -> row.getTestPlan() != null)
            .flatMap(row -> items(row.getTestPlan()).map(item -> new Need(item, WHY.formatted(row.getTitle()))))
            .toList();
    }

    /** {@code CHECKIN_CRAVING} ↔ {@link CheckInItem#CRAVING}; empty for a non-check-in metric. */
    static Optional<CheckInItem> checkInItem(MetricKey key) {
        String prefix = "CHECKIN_";
        if (!key.name().startsWith(prefix)) {
            return Optional.empty();
        }
        String name = key.name().substring(prefix.length());
        return Arrays.stream(CheckInItem.values()).filter(i -> i.name().equals(name)).findFirst();
    }

    private static Stream<CheckInItem> items(TestPlanEnvelope plan) {
        return Stream.of(plan.seriesA(), plan.seriesB())
            .filter(Objects::nonNull)
            .map(series -> ITEM_BY_WIRE_KEY.get(series.toLowerCase(Locale.ROOT)))
            .filter(Objects::nonNull);
    }
}
