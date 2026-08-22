package io.mrkuhne.mezo.feature.companion.feedback.service;

import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope.ReasonHistogram;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W4.2 rollup layer (bd mezo-b3pp.16, spec §8.2): pure-code aggregation of {@code message_feedback}
 * into {@code feedback_rollup} — per-surface + per-feed-kind effectiveness, and a single style
 * (down-reason) histogram row. NOT the reinforcement layer (graph-node edge weighting) — that
 * activates only once W2 is live and is a separate, later, switch-guarded slice (spec §10).
 * Single-user data volumes throughout (spec §12): windowed rows are grouped in memory, not SQL.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FeedbackLearningService {

    private static final List<String> SURFACE_KINDS = List.of(
        MessageFeedbackEntity.KIND_CHAT_MESSAGE, MessageFeedbackEntity.KIND_FEED_MESSAGE,
        MessageFeedbackEntity.KIND_WEEKLY_SUGGESTION, MessageFeedbackEntity.KIND_MEMOIR,
        MessageFeedbackEntity.KIND_PREDICTION);

    private static final List<String> FEED_KINDS = List.of(
        CompanionMessageEntity.KIND_MORNING, CompanionMessageEntity.KIND_SLEEP,
        CompanionMessageEntity.KIND_WEIGHT, CompanionMessageEntity.KIND_MIDDAY,
        CompanionMessageEntity.KIND_EVENING);

    private final MessageFeedbackRepository messageFeedbackRepository;
    private final CompanionMessageRepository companionMessageRepository;
    private final FeedbackRollupRepository feedbackRollupRepository;
    private final FeedbackLearningProperties properties;

    /** Recomputes and overwrites (in place) all 11 rollup scopes for one user; returns the count
     *  upserted (always 11 — every known surface/feed-kind scope is written, zero-filled when
     *  unseen, so a downstream reader never has to distinguish "no row" from "no signal"). */
    @Transactional
    public int computeRollups(UUID userId) {
        int windowDays = properties.windowDays();
        Instant since = Instant.now().minus(windowDays, ChronoUnit.DAYS);
        List<MessageFeedbackEntity> window = messageFeedbackRepository
            .findByCreatedByAndCreatedAtAfterAndDeletedFalse(userId, since);

        int upserted = 0;
        for (String kind : SURFACE_KINDS) {
            upserted += upsertEffectiveness(userId, FeedbackRollupEntity.SCOPE_SURFACE_PREFIX + kind,
                windowDays, filterByKind(window, kind));
        }

        Map<UUID, String> feedMessageKindById = feedMessageKindById(window);
        for (String feedKind : FEED_KINDS) {
            List<MessageFeedbackEntity> feedVerdicts = window.stream()
                .filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
                .filter(f -> feedKind.equals(feedMessageKindById.get(f.getArtifactId())))
                .toList();
            upserted += upsertEffectiveness(userId, FeedbackRollupEntity.SCOPE_FEED_PREFIX + feedKind,
                windowDays, feedVerdicts);
        }

        upserted += upsertStyle(userId, windowDays, window);
        return upserted;
    }

    private List<MessageFeedbackEntity> filterByKind(List<MessageFeedbackEntity> window, String kind) {
        return window.stream().filter(byArtifactKind(kind)).toList();
    }

    private Predicate<MessageFeedbackEntity> byArtifactKind(String kind) {
        return f -> kind.equals(f.getArtifactKind());
    }

    /** Resolves each feed_message artifact's companion_message.kind via a single batch read —
     *  the artifact table join is a plain lookup (no FK; spec §8.1 names the dangling-id case as
     *  harmless in a single-user app). */
    private Map<UUID, String> feedMessageKindById(List<MessageFeedbackEntity> window) {
        List<UUID> feedArtifactIds = window.stream()
            .filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
            .map(MessageFeedbackEntity::getArtifactId)
            .toList();
        if (feedArtifactIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> result = new java.util.HashMap<>();
        for (CompanionMessageEntity message : companionMessageRepository.findAllById(feedArtifactIds)) {
            result.put(message.getId(), message.getKind());
        }
        return result;
    }

    private int upsertEffectiveness(UUID userId, String scope, int windowDays, List<MessageFeedbackEntity> verdicts) {
        long up = verdicts.stream().filter(v -> MessageFeedbackEntity.VERDICT_UP.equals(v.getVerdict())).count();
        long down = verdicts.stream().filter(v -> MessageFeedbackEntity.VERDICT_DOWN.equals(v.getVerdict())).count();
        upsert(userId, scope, windowDays, FeedbackRollupStatsEnvelope.effectiveness((int) up, (int) down));
        return 1;
    }

    private int upsertStyle(UUID userId, int windowDays, List<MessageFeedbackEntity> window) {
        Map<String, ReasonHistogram> bySurface = new java.util.LinkedHashMap<>();
        for (String kind : SURFACE_KINDS) {
            int inaccurate = 0, tooMuch = 0, badTiming = 0, notAboutMe = 0;
            for (MessageFeedbackEntity v : window) {
                if (!kind.equals(v.getArtifactKind()) || !MessageFeedbackEntity.VERDICT_DOWN.equals(v.getVerdict())) {
                    continue;
                }
                inaccurate += MessageFeedbackEntity.REASON_INACCURATE.equals(v.getReason()) ? 1 : 0;
                tooMuch += MessageFeedbackEntity.REASON_TOO_MUCH.equals(v.getReason()) ? 1 : 0;
                badTiming += MessageFeedbackEntity.REASON_BAD_TIMING.equals(v.getReason()) ? 1 : 0;
                notAboutMe += MessageFeedbackEntity.REASON_NOT_ABOUT_ME.equals(v.getReason()) ? 1 : 0;
            }
            bySurface.put(kind, new ReasonHistogram(inaccurate, tooMuch, badTiming, notAboutMe));
        }
        upsert(userId, FeedbackRollupEntity.SCOPE_STYLE, windowDays, FeedbackRollupStatsEnvelope.style(bySurface));
        return 1;
    }

    private void upsert(UUID userId, String scope, int windowDays, FeedbackRollupStatsEnvelope stats) {
        FeedbackRollupEntity entity = feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(userId, scope, windowDays)
            .orElseGet(() -> {
                FeedbackRollupEntity e = new FeedbackRollupEntity();
                e.setCreatedBy(userId);
                e.setScope(scope);
                e.setWindowDays(windowDays);
                return e;
            });
        entity.setStats(stats);
        entity.setComputedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        feedbackRollupRepository.saveAndFlush(entity);
    }
}
