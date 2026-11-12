package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.api.dto.SessionTime;
import io.mrkuhne.mezo.feature.companion.SessionTimeOverrideSource;
import io.mrkuhne.mezo.feature.boop.repository.WorkoutTimeOverrideRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Moves the planned training session of a day to another time (Boop S3, mezo-r36n9.7): one
 * override row per user + day, last write wins. The brief picks the move up by itself — the
 * session time is part of its input hash, so the next GET regenerates (and the conflict rule
 * re-evaluates). DELETE is a soft delete; the unique index is partial ({@code where is_deleted =
 * false}), so a later PUT inserts a fresh row.
 */
@Service
@RequiredArgsConstructor
public class SessionTimeService implements SessionTimeOverrideSource {

    static final String NO_SESSION_CODE = "BOOP_NO_PLANNED_SESSION";

    private final BoopDayAssembler assembler;
    private final BoopBriefService briefService;
    private final WorkoutTimeOverrideRepository overrides;

    @Transactional
    public SessionTime set(UUID owner, LocalDate date, String time) {
        briefService.requireNotFuture(date, Instant.now());
        LocalTime parsed = parse(time);
        BoopDay.Session planned = assembler.session(owner, date);
        if (planned == null) {
            throw new SystemRuntimeErrorException(SystemMessage.error(NO_SESSION_CODE).build(), HttpStatus.NOT_FOUND);
        }
        overrides.upsert(owner, date, parsed);
        SessionTime out = new SessionTime();
        out.setDate(date.toString());
        out.setTime(parsed.toString());
        out.setPlannedTime(planned.plannedTime() == null ? null : planned.plannedTime().toString());
        return out;
    }

    @Transactional
    public void clear(UUID owner, LocalDate date) {
        briefService.requireNotFuture(date, Instant.now());
        overrides.findByCreatedByAndDate(owner, date).ifPresent(overrides::delete);
    }

    /** Boop B3 (mezo-r36n9.13): the moved time, read by Boop's chat ("Ma" block, chips, questions). */
    @Override
    public Optional<LocalTime> movedTime(UUID owner, LocalDate date) {
        return overrides.findByCreatedByAndDate(owner, date).map(o -> o.getTime());
    }

    /** The pattern lets 25:61 through. */
    private static LocalTime parse(String time) {
        try {
            return LocalTime.parse(time);
        } catch (DateTimeParseException | NullPointerException e) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "time").build(),
                HttpStatus.BAD_REQUEST);
        }
    }
}
