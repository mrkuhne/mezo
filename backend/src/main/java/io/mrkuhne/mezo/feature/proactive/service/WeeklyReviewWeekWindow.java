package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Shared week-window reads (mezo-p2tr) behind BOTH {@link WeeklyReviewGenerator#gather} and
 * {@link WeeklyReviewDigestService} — package-private so the two readers stay the ONLY callers;
 * a third reader would mean this graduates to its own repository-facing service.
 */
final class WeeklyReviewWeekWindow {

    private WeeklyReviewWeekWindow() {
    }

    /** Inclusive lower bound for "happened during the week" instant comparisons. */
    static Instant since(LocalDate weekStart) {
        return weekStart.atStartOfDay(ZoneOffset.UTC).toInstant().minusSeconds(1);
    }

    /** Exclusive upper bound for "happened during the week" instant comparisons ({@code weekEnd}
     *  is the week's LAST day, inclusive — the bound is midnight of the day AFTER it). */
    static Instant until(LocalDate weekEnd) {
        return weekEnd.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    /** Confirmed/reinforced/promoted pattern events whose {@code occurredAt} falls inside
     *  {@code [since, until)}. */
    static List<PatternEventEntity> patternEvents(
            PatternEventRepository repository, UUID userId, Instant since, Instant until) {
        List<PatternEventEntity> events = new ArrayList<>();
        for (String kind : List.of(PatternEventEntity.KIND_CONFIRMED, PatternEventEntity.KIND_REINFORCED,
                PatternEventEntity.KIND_PROMOTED)) {
            repository.findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(userId, kind, since)
                    .stream()
                    .filter(e -> e.getOccurredAt().isBefore(until))
                    .forEach(events::add);
        }
        return events;
    }

    /** Facts CREATED inside the week (the {@code createdAt} window is one second narrower than
     *  {@code [since, until)} to keep the boundary strictly inside the week — see the
     *  {@code createdAtGreaterThanEqual} finder). */
    static List<KnowledgeFactEntity> facts(
            KnowledgeFactRepository repository, UUID userId, Instant since, Instant until) {
        return repository.findByCreatedByAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndDeletedFalse(
                userId, since.plusSeconds(1), until);
    }

    /** Active LIFE_EVENT nodes occurring inside {@code [weekStart, weekEnd]}. */
    static List<GraphNodeEntity> lifeEvents(
            GraphNodeRepository repository, UUID userId, LocalDate weekStart, LocalDate weekEnd) {
        return repository.findByCreatedByAndKindAndStatusAndOccurredOnBetweenAndDeletedFalse(
                userId, GraphNodeEntity.KIND_LIFE_EVENT, GraphNodeEntity.STATUS_ACTIVE, weekStart, weekEnd);
    }
}
