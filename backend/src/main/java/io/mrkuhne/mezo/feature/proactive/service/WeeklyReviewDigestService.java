package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.WeeklyReviewDigestResponse;
import io.mrkuhne.mezo.api.dto.WeeklyReviewFactRef;
import io.mrkuhne.mezo.api.dto.WeeklyReviewLifeEventRef;
import io.mrkuhne.mezo.api.dto.WeeklyReviewPatternRef;
import io.mrkuhne.mezo.api.dto.WeeklyReviewPredictionRef;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The raw week-window refs behind the weekly review (mezo-p2tr) — the SAME reads {@link
 * WeeklyReviewGenerator#gather} draws its highlight candidates from ({@link
 * WeeklyReviewWeekWindow}), mapped straight through instead of folded into an LLM payload.
 * Independent of the review row itself (no lazy generation, no existence check) — always 200,
 * empty lists the honest empty state. Unlike the generator's raw read, the digest is one trace
 * per discovery (mezo-p87ok): events fold to one ref per pattern, and a promotion's own fact is
 * not repeated in {@code newFacts}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeeklyReviewDigestService {

    private final PatternEventRepository patternEventRepository;
    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final GraphNodeRepository graphNodeRepository;
    private final MemoirRepository memoirRepository;
    private final PredictionRepository predictionRepository;

    @Transactional
    public WeeklyReviewDigestResponse getDigest(UUID userId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        Instant since = WeeklyReviewWeekWindow.since(weekStart);
        Instant until = WeeklyReviewWeekWindow.until(weekEnd);

        // mezo-p87ok: one trace per discovery. The window returns one row per pattern_event, so a
        // pair confirmed then promoted in one week arrives twice — fold to one ref per pattern,
        // carrying the week's biggest news, and rank promoted > reinforced > confirmed, newest first.
        Map<UUID, FoldedPattern> byPattern = new LinkedHashMap<>();
        for (PatternEventEntity event : WeeklyReviewWeekWindow
                .patternEvents(patternEventRepository, userId, since, until)) {
            FoldedPattern current = byPattern.get(event.getPatternId());
            if (current == null) {
                PatternEntity pattern = livePattern(userId, event);
                if (pattern == null) {
                    continue;
                }
                byPattern.put(event.getPatternId(), new FoldedPattern(pattern, event));
            } else {
                byPattern.put(event.getPatternId(), current.merge(event));
            }
        }
        List<FoldedPattern> folded = byPattern.values().stream()
                .sorted(Comparator.comparingInt((FoldedPattern f) -> kindRank(f.kind()))
                        .thenComparing(FoldedPattern::latestAt, Comparator.reverseOrder()))
                .toList();
        List<WeeklyReviewPatternRef> patterns = folded.stream()
                .map(f -> new WeeklyReviewPatternRef()
                        .pairKey(f.pattern().getPairKey())
                        .title(f.pattern().getTitle())
                        .event(f.kind()))
                .toList();

        // A promotion writes its own knowledge_fact — the pattern ref above already IS that
        // discovery, so the fact is not counted a second time.
        Set<UUID> carriedFacts = folded.stream()
                .map(f -> f.pattern().getPromotedFactId())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<WeeklyReviewFactRef> newFacts = WeeklyReviewWeekWindow
                .facts(knowledgeFactRepository, userId, since, until).stream()
                .filter(fact -> !carriedFacts.contains(fact.getId()))
                .sorted(Comparator.comparing(KnowledgeFactEntity::getCreatedAt, Comparator.reverseOrder()))
                .map(fact -> new WeeklyReviewFactRef().id(fact.getId()).text(fact.getFactText()))
                .toList();

        List<WeeklyReviewLifeEventRef> lifeEvents = WeeklyReviewWeekWindow
                .lifeEvents(graphNodeRepository, userId, weekStart, weekEnd).stream()
                .map(this::toLifeEventRef)
                .toList();

        boolean memoir = memoirRepository.findByCreatedByAndWeekStart(userId, weekStart).isPresent();

        List<WeeklyReviewPredictionRef> predictions = predictionRepository
                .findByCreatedByAndWeekStart(userId, weekStart).stream()
                .map(this::toPredictionRef)
                .toList();

        return new WeeklyReviewDigestResponse()
                .patterns(patterns)
                .newFacts(newFacts)
                .lifeEvents(lifeEvents)
                .memoir(memoir)
                .predictions(predictions);
    }

    /** One pattern's week, folded: the most significant event kind seen and the latest event
     *  instant (the within-kind sort key). */
    private record FoldedPattern(PatternEntity pattern, String kind, Instant latestAt) {

        FoldedPattern(PatternEntity pattern, PatternEventEntity event) {
            this(pattern, event.getKind(), event.getOccurredAt());
        }

        FoldedPattern merge(PatternEventEntity event) {
            String kind = kindRank(event.getKind()) < kindRank(this.kind) ? event.getKind() : this.kind;
            Instant latest = event.getOccurredAt().isAfter(latestAt) ? event.getOccurredAt() : latestAt;
            return new FoldedPattern(pattern, kind, latest);
        }
    }

    /** Lower is bigger news: promoted, then reinforced, then confirmed. */
    private static int kindRank(String kind) {
        return switch (kind) {
            case PatternEventEntity.KIND_PROMOTED -> 0;
            case PatternEventEntity.KIND_REINFORCED -> 1;
            case PatternEventEntity.KIND_CONFIRMED -> 2;
            default -> 3;
        };
    }

    /** Null when the event's pattern was itself hard-deleted or reassigned — the digest silently
     *  drops the orphan ref rather than surfacing a broken row (should not happen in practice) —
     *  or when the user made Mezo forget it. */
    private PatternEntity livePattern(UUID userId, PatternEventEntity event) {
        PatternEntity pattern = patternRepository
                .findByIdAndCreatedByAndDeletedFalse(event.getPatternId(), userId).orElse(null);
        if (pattern == null) {
            log.warn("Weekly review digest: pattern event {} references missing/deleted pattern {}"
                    + " for user {} — dropping the orphan ref", event.getId(), event.getPatternId(), userId);
            return null;
        }
        if (pattern.isForgotten()) {
            return null; // S6 (mezo-d6ivw.6): the user made Mezo forget it — the digest too
        }
        return pattern;
    }

    private WeeklyReviewLifeEventRef toLifeEventRef(GraphNodeEntity node) {
        return new WeeklyReviewLifeEventRef()
                .id(node.getId())
                .title(node.getTitle())
                .occurredOn(node.getOccurredOn());
    }

    private WeeklyReviewPredictionRef toPredictionRef(PredictionEntity prediction) {
        return new WeeklyReviewPredictionRef()
                .id(prediction.getId())
                .title(prediction.getTitle())
                .status(prediction.getStatus());
    }
}
