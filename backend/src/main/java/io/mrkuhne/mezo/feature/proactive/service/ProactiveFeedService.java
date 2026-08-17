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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The unified companion-feed read path (companion-feed, spec §5): the day's persisted messages,
 * in generation order. For TODAY, the cron-kind miss-recovery (morning/midday/evening) lazily
 * generates ahead of the read — event-triggered kinds (sleep/weight) are born from their events
 * elsewhere, never from this path. Past dates never generate; an empty array is the honest empty
 * state (never a 404 — this is a list endpoint, the P1 precedent).
 */
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

    /** date = null ⇒ the server's today (the FE sends its local date — the briefing precedent). */
    @Transactional
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
        generator.generateMorning(userId, day);
        LocalDateTime dayStart = day.atStartOfDay().minusNanos(1);
        LocalDateTime now = LocalDateTime.now();
        if (elapsed(properties.feed().middayCron(), dayStart, now, day)) {
            generator.generateWindow(userId, day, CompanionMessageEntity.KIND_MIDDAY);
        }
        if (elapsed(properties.feed().eveningCron(), dayStart, now, day)) {
            generator.generateWindow(userId, day, CompanionMessageEntity.KIND_EVENING);
        }
    }

    private boolean elapsed(String cron, LocalDateTime dayStart, LocalDateTime now, LocalDate day) {
        LocalDateTime fire = CronExpression.parse(cron).next(dayStart);
        return fire != null && fire.toLocalDate().equals(day) && !fire.isAfter(now);
    }
}
