package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.FeedMessageResponse;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

/**
 * The unified companion-feed read path (companion-feed, spec §5): the day's persisted messages,
 * in generation order. For TODAY, the cron-kind miss-recovery (morning/midday/evening) lazily
 * generates ahead of the read — event-triggered kinds (sleep/weight) are born from their events
 * elsewhere, never from this path. Past dates never generate; an empty array is the honest empty
 * state (never a 404 — this is a list endpoint, the P1 precedent).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveFeedService {

    private final CompanionMessageRepository companionMessageRepository;
    private final CompanionMessageGenerator generator;
    private final ProactiveProperties properties;
    private final ProactiveMapper mapper;

    /**
     * date = null ⇒ the server's today (the FE sends its local date — the briefing precedent).
     *
     * <p><b>Deliberately carries no {@code @Transactional}</b> (the {@code NotificationDispatchJob}
     * idiom): {@link CompanionMessageGenerator}'s generate methods are themselves
     * {@code @Transactional}, so under an ambient transaction a failed generate would mark the
     * WHOLE read rollback-only — the {@code UnexpectedRollbackException} trap {@code proactive.md}
     * §9 records for {@code OverloadChallengeGenerator}, which no {@code catch} can undo. Left
     * unannotated, each generate gets its own naturally-scoped transaction, so
     * {@link #ensureTodayCronKinds}'s try/catch genuinely isolates it and the read below still
     * serves whatever else exists. Safe because the mapped columns are all basic/jsonb attributes
     * (no lazy association to walk with open-in-view off).
     */
    public List<FeedMessageResponse> getFeed(UUID userId, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        if (day.equals(LocalDate.now())) {
            ensureTodayCronKinds(userId, day);
        }
        return companionMessageRepository
                .findByCreatedByAndMessageDateOrderByGeneratedAtAsc(userId, day)
                .stream().map(mapper::toFeedResponse).toList();
    }

    /** Miss-recovery for the cron kinds only (event kinds are born from their events):
     *  morning always (its cron is dawn — by any read it has elapsed); midday/evening when
     *  their fire-time (derived from the SAME cron via CronExpression — the heartbeat idiom)
     *  has passed. Each generate is idempotent and honest-null. */
    private void ensureTodayCronKinds(UUID userId, LocalDate day) {
        generateQuietly(userId, day, CompanionMessageEntity.KIND_MORNING);
        LocalDateTime dayStart = day.atStartOfDay().minusNanos(1);
        LocalDateTime now = LocalDateTime.now();
        if (elapsed(properties.feed().middayCron(), dayStart, now, day)) {
            generateQuietly(userId, day, CompanionMessageEntity.KIND_MIDDAY);
        }
        if (elapsed(properties.feed().eveningCron(), dayStart, now, day)) {
            generateQuietly(userId, day, CompanionMessageEntity.KIND_EVENING);
        }
    }

    /**
     * Miss-recovery must never cost the reader the messages that DO exist. The realistic failure
     * is a lost race: the FE poll and the cron both find the kind missing and both insert, so the
     * loser trips {@code uq_companion_message_created_by_date_kind} — the winner's row is already
     * committed, and this read is about to return it.
     */
    private void generateQuietly(UUID userId, LocalDate day, String kind) {
        try {
            if (CompanionMessageEntity.KIND_MORNING.equals(kind)) {
                generator.generateMorning(userId, day);
            } else {
                generator.generateWindow(userId, day, kind);
            }
        } catch (Exception e) {
            log.warn("Lazy {} generation failed for user {} on {} — serving what exists",
                    kind, userId, day, e);
        }
    }

    private boolean elapsed(String cron, LocalDateTime dayStart, LocalDateTime now, LocalDate day) {
        LocalDateTime fire = CronExpression.parse(cron).next(dayStart);
        return fire != null && fire.toLocalDate().equals(day) && !fire.isAfter(now);
    }
}
