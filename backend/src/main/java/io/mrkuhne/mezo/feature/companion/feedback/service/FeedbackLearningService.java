package io.mrkuhne.mezo.feature.companion.feedback.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope.ReasonHistogram;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
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
 *
 * <p>W5.2 (bd mezo-b3pp.19) rides the same nightly pass: one additional {@code intervention:<key>}
 * scope per configured library entry ({@link CompanionProperties#interventions()}), joined through
 * {@link FeedMessageKindSource} the same way the {@code feed:<kind>} scopes are.
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
        FeedMessageKindSource.KIND_MORNING, FeedMessageKindSource.KIND_SLEEP,
        FeedMessageKindSource.KIND_WEIGHT, FeedMessageKindSource.KIND_MIDDAY,
        FeedMessageKindSource.KIND_EVENING);

    private final MessageFeedbackRepository messageFeedbackRepository;
    private final FeedMessageKindSource feedMessageKindSource;
    private final FeedbackRollupRepository feedbackRollupRepository;
    private final FeedbackLearningProperties properties;
    private final CompanionProperties companionProperties;

    /** Recomputes and overwrites (in place) all rollup scopes for one user; returns the count
     *  upserted (always 11 + one per configured intervention key — every known surface/feed-kind/
     *  intervention-key scope is written, zero-filled when unseen, so a downstream reader never has
     *  to distinguish "no row" from "no signal").
     *
     *  <p>The trailing window keys on {@code updated_at}, NOT {@code created_at} — do not "fix"
     *  this back. A verdict's ONLY write path is {@code MessageFeedbackRepository.upsertVerdict},
     *  whose {@code on conflict do update} bumps {@code updated_at} but deliberately leaves
     *  {@code created_at} at the FIRST vote; windowing on {@code created_at} would therefore drop
     *  a 👍→👎 flip (or a retract-and-re-vote) on an artifact first rated outside the window — the
     *  freshest signal there is. {@code updated_at} is set to {@code now()} on the insert branch
     *  too (and by {@code @UpdateTimestamp} on the JPA path, plus the column's own DB default), so
     *  it is never older than {@code created_at} and no first-time verdict is lost by the swap. */
    @Transactional
    public int computeRollups(UUID userId) {
        int windowDays = properties.windowDays();
        Instant since = Instant.now().minus(windowDays, ChronoUnit.DAYS);
        List<MessageFeedbackEntity> window = messageFeedbackRepository
            .findByCreatedByAndUpdatedAtAfterAndDeletedFalse(userId, since);

        int upserted = 0;
        for (String kind : SURFACE_KINDS) {
            upserted += upsertEffectiveness(userId, FeedbackRollupEntity.SCOPE_SURFACE_PREFIX + kind,
                windowDays, filterByKind(window, kind));
        }

        Map<UUID, String> feedMessageKindById = feedMessageKindById(userId, window);
        for (String feedKind : FEED_KINDS) {
            List<MessageFeedbackEntity> feedVerdicts = window.stream()
                .filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
                .filter(f -> feedKind.equals(feedMessageKindById.get(f.getArtifactId())))
                .toList();
            upserted += upsertEffectiveness(userId, FeedbackRollupEntity.SCOPE_FEED_PREFIX + feedKind,
                windowDays, feedVerdicts);
        }

        // W5.2 (bd mezo-b3pp.19): one intervention:<key> scope per configured library entry. An
        // intervention verdict ALSO counts in surface:feed_message above (it IS a feed_message
        // artifact) — deliberate, not double-counted signal: the per-key scope here is the
        // selection signal a `feed:intervention` aggregate would only duplicate, so FEED_KINDS
        // deliberately stays the five prose kinds. `setup` (S3, mezo-d58h.3) is excluded the same
        // way: it is config text, never LLM-generated, so a per-kind effectiveness rollup would
        // not measure anything a prompt could act on. `people` (Emberek S6, mezo-06o0.8) IS
        // LLM-generated prose like the five above, but has no per-kind rollup scope yet — that is
        // a gap, not a design choice; add it to FEED_KINDS when a `feed:people` scope is wanted.
        // Both still count in surface:feed_message above.
        // Known/harmless: a key removed from mezo.companion.interventions leaves its
        // intervention:<key> rollup row behind forever — nothing prunes or zero-fills a retired
        // key's row, because nothing reads it either (InterventionService only ever looks up keys
        // still present in the live config).
        Map<UUID, String> interventionKeyById = feedMessageKindSource.interventionKeysByIds(userId,
            window.stream().filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
                .map(MessageFeedbackEntity::getArtifactId).toList());
        for (CompanionProperties.Intervention entry : companionProperties.interventions()) {
            List<MessageFeedbackEntity> verdicts = window.stream()
                .filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
                .filter(f -> entry.key().equals(interventionKeyById.get(f.getArtifactId())))
                .toList();
            upserted += upsertEffectiveness(userId,
                FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + entry.key(), windowDays, verdicts);
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

    /** Resolves each feed_message artifact's companion_message.kind via a single batch read
     *  through {@link FeedMessageKindSource} — that data lives in {@code feature.proactive}, which
     *  this slice must NOT import (see the port's javadoc). The artifact "join" is a plain lookup
     *  (no FK; spec §8.1 names the dangling-id case as harmless in a single-user app), and the port
     *  contract scopes it to {@code userId}, so a foreign row can never leak into a rollup. */
    private Map<UUID, String> feedMessageKindById(UUID userId, List<MessageFeedbackEntity> window) {
        List<UUID> feedArtifactIds = window.stream()
            .filter(byArtifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE))
            .map(MessageFeedbackEntity::getArtifactId)
            .toList();
        return feedMessageKindSource.kindsByIds(userId, feedArtifactIds);
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
