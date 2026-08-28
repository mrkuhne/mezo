package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.WeeklyReviewDigestResponse;
import io.mrkuhne.mezo.api.dto.WeeklyReviewFactRef;
import io.mrkuhne.mezo.api.dto.WeeklyReviewLifeEventRef;
import io.mrkuhne.mezo.api.dto.WeeklyReviewPatternRef;
import io.mrkuhne.mezo.api.dto.WeeklyReviewPredictionRef;
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
import java.util.List;
import java.util.Objects;
import java.util.UUID;
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
 * empty lists the honest empty state.
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

        List<WeeklyReviewPatternRef> patterns = WeeklyReviewWeekWindow
                .patternEvents(patternEventRepository, userId, since, until).stream()
                .map(event -> toPatternRef(userId, event))
                .filter(Objects::nonNull)
                .toList();

        List<WeeklyReviewFactRef> newFacts = WeeklyReviewWeekWindow
                .facts(knowledgeFactRepository, userId, since, until).stream()
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

    /** Null when the event's pattern was itself hard-deleted or reassigned — the digest silently
     *  drops the orphan ref rather than surfacing a broken row (should not happen in practice). */
    private WeeklyReviewPatternRef toPatternRef(UUID userId, PatternEventEntity event) {
        PatternEntity pattern = patternRepository
                .findByIdAndCreatedByAndDeletedFalse(event.getPatternId(), userId).orElse(null);
        if (pattern == null) {
            log.warn("Weekly review digest: pattern event {} references missing/deleted pattern {}"
                    + " for user {} — dropping the orphan ref", event.getId(), event.getPatternId(), userId);
            return null;
        }
        return new WeeklyReviewPatternRef()
                .pairKey(pattern.getPairKey())
                .title(pattern.getTitle())
                .event(event.getKind());
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
