package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.LearningPauseEntity;
import io.mrkuhne.mezo.feature.auth.repository.LearningPauseRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Most ne tanulj" (mezo-rrjxe, spec 2026-10-07): the one place that answers whether learning is
 * paused for a user at an instant or on a local day. Deliberately NOT switch-gated: a missing
 * gate must never read as "learn". Lives in {@code feature/auth} because every learner slice
 * (people, companion, character, proactive) may import auth, and nothing else sits below people.
 *
 * <p>An interval applies on {@code [startedAt, coalesce(endedAt, plannedEndAt, +inf))}. Expiry is
 * computed here from {@code plannedEndAt}; the expiry sweep only stamps {@code endedAt}
 * afterwards, so a late sweep can never extend a pause.
 */
@Slf4j
@Service
public class LearningPauseService {

    public static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    private final LearningPauseRepository pauses;
    private final LocalTime morning;

    /** The "holnap reggelig" end is the notification quiet-hours end; read as a plain property
     *  because {@code feature/notification} imports auth (a class import would be a cycle). */
    public LearningPauseService(LearningPauseRepository pauses,
            @Value("${mezo.notification.quiet-hours.end:07:00}") String morning) {
        this.pauses = pauses;
        this.morning = LocalTime.parse(morning);
    }

    public record Status(boolean paused, Instant startedAt, Instant until, String choice) {
        public static Status off() {
            return new Status(false, null, null, null);
        }
    }

    @Transactional(readOnly = true)
    public Status current(UUID userId) {
        Instant now = Instant.now();
        return pauses.findOpen(userId).filter(p -> applies(p, now)).map(LearningPauseService::status)
                .orElseGet(Status::off);
    }

    /** Starts a pause. Already paused → the running pause is returned unchanged. */
    @Transactional
    public Status start(UUID userId, String choice) {
        Instant now = Instant.now();
        Optional<LearningPauseEntity> open = pauses.findOpen(userId);
        if (open.isPresent()) {
            LearningPauseEntity p = open.get();
            if (applies(p, now)) {
                return status(p);
            }
            // a timed row past its planned end that the sweep has not reached yet
            close(p, p.getPlannedEndAt(), LearningPauseEntity.END_EXPIRED);
        }
        LearningPauseEntity p = new LearningPauseEntity();
        p.setCreatedBy(userId);
        p.setStartedAt(now);
        p.setDurationChoice(choice);
        p.setPlannedEndAt(plannedEnd(choice, now, ZONE, morning));
        log.info("Learning paused for user {} ({})", userId, choice);
        return status(pauses.saveAndFlush(p));
    }

    /** Ends the running pause, if any. Idempotent. */
    @Transactional
    public Status end(UUID userId) {
        Instant now = Instant.now();
        pauses.findOpen(userId).ifPresent(p -> {
            boolean expired = !applies(p, now);
            close(p, expired ? p.getPlannedEndAt() : now,
                    expired ? LearningPauseEntity.END_EXPIRED : LearningPauseEntity.END_USER);
            log.info("Learning resumed for user {}", userId);
        });
        return Status.off();
    }

    /** The record rule: was learning paused for this user at {@code at}? */
    @Transactional(readOnly = true)
    public boolean isPausedAt(UUID userId, Instant at) {
        return userId != null && at != null && !pauses.overlapping(userId, at, at.plusNanos(1_000)).isEmpty();
    }

    /** The day rule: does any pause touch this local day? */
    @Transactional(readOnly = true)
    public boolean isPausedDay(UUID userId, LocalDate day) {
        return !pausedDays(userId, day, day).isEmpty();
    }

    /** Every local day in {@code [from, toInclusive]} touched by a pause. */
    @Transactional(readOnly = true)
    public Set<LocalDate> pausedDays(UUID userId, LocalDate from, LocalDate toInclusive) {
        Instant winFrom = from.atStartOfDay(ZONE).toInstant();
        Instant winTo = toInclusive.plusDays(1).atStartOfDay(ZONE).toInstant();
        Set<LocalDate> days = new LinkedHashSet<>();
        for (LearningPauseEntity p : pauses.overlapping(userId, winFrom, winTo)) {
            Instant start = p.getStartedAt().isBefore(winFrom) ? winFrom : p.getStartedAt();
            Instant end = p.effectiveEnd() == null || p.effectiveEnd().isAfter(winTo) ? winTo : p.effectiveEnd();
            LocalDate d = start.atZone(ZONE).toLocalDate();
            // the end instant is exclusive: an interval ending exactly at midnight does not touch the next day
            LocalDate last = end.minusNanos(1_000).atZone(ZONE).toLocalDate();
            for (; !d.isAfter(last) && !d.isAfter(toInclusive); d = d.plusDays(1)) {
                days.add(d);
            }
        }
        return days;
    }

    /** {@code tonight} → next local midnight; {@code tomorrow_morning} → tomorrow at {@code morning};
     *  {@code open} → null. */
    public static Instant plannedEnd(String choice, Instant now, ZoneId zone, LocalTime morning) {
        ZonedDateTime local = now.atZone(zone);
        return switch (choice) {
            case LearningPauseEntity.TONIGHT -> local.toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
            case LearningPauseEntity.TOMORROW_MORNING ->
                    local.toLocalDate().plusDays(1).atTime(morning).atZone(zone).toInstant();
            case LearningPauseEntity.OPEN -> null;
            default -> throw new IllegalArgumentException("Unknown learning pause choice: " + choice);
        };
    }

    /** Stamps the end of an interval; shared with the expiry sweep. */
    public void close(LearningPauseEntity p, Instant endedAt, String reason) {
        p.setEndedAt(endedAt);
        p.setEndReason(reason);
        pauses.saveAndFlush(p);
    }

    private static boolean applies(LearningPauseEntity p, Instant now) {
        return p.getPlannedEndAt() == null || now.isBefore(p.getPlannedEndAt());
    }

    private static Status status(LearningPauseEntity p) {
        return new Status(true, p.getStartedAt(), p.getPlannedEndAt(), p.getDurationChoice());
    }
}
