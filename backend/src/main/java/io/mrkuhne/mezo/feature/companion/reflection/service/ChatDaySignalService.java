package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S1 (bd mezo-eq85.1): the day's OWN chat turns as a third signal source. The user half of
 * a day's conversation is prose about that day exactly like a journal entry is — extracting one
 * signal per day from it (never per turn) keeps the cost at one call and the granularity at the
 * day, which is what every series is keyed on.
 *
 * <p>The synthetic source id is a stable name-based UUID of {@code userId + ":" + day}, so a day
 * that gains turns later re-versions its own signal instead of creating a second row. That only
 * holds because {@code TextSignalCatchUpService} offers every day UNCONDITIONALLY — a "skip days
 * that already have a chat_day signal" gate would freeze the first extraction forever.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ChatDaySignalService {

    private final AiMessageRepository aiMessageRepository;
    private final TextSignalService textSignalService;

    /** Empty when the day holds no user turn — a silent day is simply not a source. */
    @Transactional
    public Optional<TextSignalEntity> extractDay(UUID userId, LocalDate day) {
        ZoneId zone = ZoneId.systemDefault();
        Instant dayStart = day.atStartOfDay(zone).toInstant();
        Instant dayEnd = day.plusDays(1).atStartOfDay(zone).toInstant();
        String joined = aiMessageRepository
                .findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
                        userId, AiMessageEntity.ROLE_USER, dayStart, dayEnd)
                .stream()
                .map(AiMessageEntity::getContent)
                .filter(content -> content != null && !content.isBlank())
                .collect(Collectors.joining("\n"));
        if (joined.isBlank()) {
            return Optional.empty();
        }
        return textSignalService.record(userId, TextSignalEntity.SOURCE_CHAT_DAY,
                chatDaySourceId(userId, day), day, joined);
    }

    /** Stable per (user, day) — the identity that makes a re-extraction a NEW VERSION, not a new row. */
    public static UUID chatDaySourceId(UUID userId, LocalDate day) {
        return UUID.nameUUIDFromBytes((userId + ":" + day).getBytes(StandardCharsets.UTF_8));
    }
}
