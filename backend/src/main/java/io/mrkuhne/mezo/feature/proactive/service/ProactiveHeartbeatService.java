package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.HeartbeatNoteResponse;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The heartbeat read path (H1): the day's latest persisted note; for TODAY the latest
 * already-elapsed window lazy-generates when missing (fire-times derived from the SAME crons
 * the job runs on — proactive.md §9 decision r). Past dates never generate. null ⇒ 404
 * (honest absence: no elapsed window yet, no narrative memory, or generation failed).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveHeartbeatService {

    private record Window(String key, LocalDateTime fireTime) {}

    private final HeartbeatNoteRepository heartbeatNoteRepository;
    private final HeartbeatGenerator generator;
    private final ProactiveProperties properties;
    private final ProactiveMapper mapper;

    /** date = null ⇒ server today (the FE sends its LOCAL date — the briefing precedent). */
    @Transactional
    public HeartbeatNoteResponse getHeartbeat(UUID userId, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        if (day.equals(LocalDate.now())) {
            latestElapsedWindow(day).ifPresent(w -> {
                if (heartbeatNoteRepository
                        .findByCreatedByAndNoteDateAndWindowKey(userId, day, w.key()).isEmpty()) {
                    generator.generate(userId, day, w.key());
                }
            });
        }
        HeartbeatNoteEntity note = heartbeatNoteRepository
                .findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc(userId, day)
                .orElse(null);
        if (note == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toHeartbeatResponse(note);
    }

    /** The day's window fire-times come from the job crons; elapsed = fired at-or-before now. */
    private Optional<Window> latestElapsedWindow(LocalDate day) {
        LocalDateTime dayStart = day.atStartOfDay().minusNanos(1);
        LocalDateTime now = LocalDateTime.now();
        return List.of(
                        new Window(HeartbeatNoteEntity.WINDOW_MIDDAY,
                                CronExpression.parse(properties.heartbeat().middayCron()).next(dayStart)),
                        new Window(HeartbeatNoteEntity.WINDOW_EVENING,
                                CronExpression.parse(properties.heartbeat().eveningCron()).next(dayStart)))
                .stream()
                .filter(w -> w.fireTime() != null
                        && w.fireTime().toLocalDate().equals(day)
                        && !w.fireTime().isAfter(now))
                .max(Comparator.comparing(Window::fireTime));
    }
}
