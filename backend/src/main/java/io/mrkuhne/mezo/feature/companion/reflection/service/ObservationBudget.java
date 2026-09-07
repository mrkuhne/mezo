package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Reflexió S4 (mezo-eq85.4) Step 2: the daily quick-notice rate limit. Guards {@code
 * notice.maxPerDay}, {@code notice.minGapHours} and the quiet-hours window from {@link
 * ReflectionProperties.Notice} — the same three knobs the S1 config slice reserved for this.
 *
 * <p>Takes {@code Instant now} as a parameter rather than calling {@code Instant.now()} — there is
 * no app-wide {@code Clock} bean, and this is what keeps the class unit-testable without one.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ObservationBudget {

    private final PatternEventRepository patternEventRepository;
    private final ReflectionProperties properties;

    public boolean allows(UUID userId, Instant now) {
        ReflectionProperties.Notice notice = properties.notice();
        List<PatternEventEntity> surfaced = surfacedToday(userId, now);
        if (surfaced.size() >= notice.maxPerDay()) {
            return false;
        }
        if (inQuietHours(now, notice)) {
            return false;
        }
        return surfaced.stream()
                .max(Comparator.comparing(PatternEventEntity::getOccurredAt))
                .map(newest -> Duration.between(newest.getOccurredAt(), now).toHours()
                        >= notice.minGapHours())
                .orElse(true);
    }

    public int remainingToday(UUID userId, Instant now) {
        int remaining = properties.notice().maxPerDay() - surfacedToday(userId, now).size();
        return Math.max(remaining, 0);
    }

    private List<PatternEventEntity> surfacedToday(UUID userId, Instant now) {
        ZoneId zone = ZoneId.systemDefault();
        Instant startOfToday = now.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant();
        return patternEventRepository
                .findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(
                        userId, PatternEventEntity.KIND_OBSERVATION, startOfToday)
                .stream()
                .filter(e -> Boolean.TRUE.equals(e.getPayload().surfaced()))
                .toList();
    }

    /** Quiet window is {@code [quietFrom, quietTo)} and may wrap over midnight (22:00 → 07:00). */
    private boolean inQuietHours(Instant now, ReflectionProperties.Notice notice) {
        LocalTime time = now.atZone(ZoneId.systemDefault()).toLocalTime();
        LocalTime from = notice.quietFrom();
        LocalTime to = notice.quietTo();
        if (from.equals(to)) {
            return false;
        }
        if (from.isBefore(to)) {
            return !time.isBefore(from) && time.isBefore(to);
        }
        // Wraps midnight, e.g. 22:00 -> 07:00: quiet from `from` to end of day, and from
        // start of day up to (exclusive) `to`.
        return !time.isBefore(from) || time.isBefore(to);
    }
}
