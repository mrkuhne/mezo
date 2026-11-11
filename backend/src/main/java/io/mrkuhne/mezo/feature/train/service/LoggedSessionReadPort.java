package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Read-only view of the owner's logged gym and sport sessions (Boop B1, mezo-r36n9.11). The one
 * door the {@code wearable} slice uses into train — train never imports wearable, so no cycle.
 * Runs are not exposed: {@code run_session_log} has a date and a duration but no clock time, so
 * nothing could match a Health workout against it.
 *
 * <p>A gym instance's end is {@code finished_at}; when that is null (auto-closed → untrustworthy)
 * it falls back to {@code started_at + active_seconds}, then {@code started_at + duration_est},
 * else the end stays null (start-only match).
 */
@Service
@RequiredArgsConstructor
public class LoggedSessionReadPort {

    private static final int SECONDS_PER_MINUTE = 60;

    private final WorkoutSessionRepository workoutSessions;
    private final SportSessionRepository sportSessions;

    /** Completed gym instances and sport sessions dated in {@code [from, to]}; clock times read in {@code zone}. */
    public List<LoggedSession> loggedSessions(UUID user, LocalDate from, LocalDate to, ZoneId zone) {
        List<LoggedSession> out = new ArrayList<>();
        for (WorkoutSessionEntity w : workoutSessions.findDoneInstancesBetween(user, from, to)) {
            out.add(gym(w));
        }
        for (SportSessionEntity s : sportSessions.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
                user, from, to)) {
            out.add(sport(s, zone));
        }
        return List.copyOf(out);
    }

    private static LoggedSession gym(WorkoutSessionEntity w) {
        Instant start = w.getStartedAt();
        Instant end = null;
        if (start != null) {
            if (w.getFinishedAt() != null && w.getFinishedAt().isAfter(start)) {
                end = w.getFinishedAt();
            } else if (w.getActiveSeconds() != null && w.getActiveSeconds() > 0) {
                end = start.plusSeconds(w.getActiveSeconds());
            } else if (w.getDurationEst() != null && w.getDurationEst() > 0) {
                end = start.plus(Duration.ofMinutes(w.getDurationEst()));
            }
        }
        int minutes = end != null ? (int) Duration.between(start, end).toMinutes()
            : w.getDurationEst() != null ? w.getDurationEst() : 0;
        return new LoggedSession(LoggedSession.Kind.GYM, w.getId(), null, start, end, minutes, null);
    }

    private static LoggedSession sport(SportSessionEntity s, ZoneId zone) {
        Instant start = null;
        if (s.getTime() != null && !s.getTime().isBlank()) {
            try {
                start = s.getDate().atTime(LocalTime.parse(s.getTime())).atZone(zone).toInstant();
            } catch (DateTimeParseException e) {
                start = null; // an unreadable clock time is no time
            }
        }
        int minutes = s.getDurationMin() == null ? 0 : s.getDurationMin();
        Instant end = start != null && minutes > 0 ? start.plus(Duration.ofMinutes(minutes)) : null;
        return new LoggedSession(LoggedSession.Kind.SPORT, s.getId(), s.getSport(), start, end, minutes, s.getKcal());
    }
}
