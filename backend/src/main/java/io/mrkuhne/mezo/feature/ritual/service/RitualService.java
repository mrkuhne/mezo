package io.mrkuhne.mezo.feature.ritual.service;

import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.api.dto.RitualWindow;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.ritual.config.RitualProperties;
import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Napzárás day state + idempotent close (spec §5). Awards nothing — XP rides the HABIT tail. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RITUAL_SWITCH, havingValue = "true")
public class RitualService {

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    private final RitualDayRepository ritualDayRepository;
    private final SleepAnchorPort sleepAnchorPort;
    private final RitualProperties properties;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public RitualDayResponse getDay(UUID userId, LocalDate date) {
        return toResponse(userId, date,
            ritualDayRepository.findByCreatedByAndRitualDate(userId, date).orElse(null));
    }

    @Transactional
    public RitualDayResponse close(UUID userId, LocalDate date) {
        if (!LocalDate.now().equals(date)) {
            throw ritualNotToday();
        }
        RitualDayEntity row = ritualDayRepository.findByCreatedByAndRitualDate(userId, date)
            .orElseGet(() -> insertOpenRow(userId, date));
        if (row.getClosedAt() == null) {
            // the sole closing stamp: reached both for a day that was only reflected on
            // (mezo-b3pp.2) and for the row just inserted above, so Task 3's embed publication
            // has exactly one place to hang off. timestamptz stores micros — truncate so the
            // pre/post-persist responses match.
            row.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            row = ritualDayRepository.saveAndFlush(row);
        }
        return toResponse(userId, date, row);
    }

    /**
     * W1.2 (spec §5.2): upserts the day's prose reflection on the {@code (created_by, ritual_date)}
     * row BEFORE the close — the one deliberate relaxation of the ritual's "nothing writes before
     * act 4" invariant. Today-only, mirroring {@link #close}: the reflection is written inside the
     * evening ritual, so a wider write surface would only let past days sprout rows. Blank text is
     * a CLEAR, never a create: an abandoned textarea must leave no junk row behind.
     */
    @Transactional
    public RitualDayResponse saveReflection(UUID userId, LocalDate date, String text) {
        if (!LocalDate.now().equals(date)) {
            throw ritualNotToday();
        }
        // total normalisation, stated in the contract: whitespace-only clears, and surrounding
        // padding is stripped rather than stored — a textarea's trailing newline must not give
        // otherwise identical prose a different embedding vector (Task 3)
        String cleaned = text == null || text.isBlank() ? null : text.strip();
        RitualDayEntity row = ritualDayRepository.findByCreatedByAndRitualDate(userId, date).orElse(null);
        if (row == null) {
            if (cleaned == null) {
                return toResponse(userId, date, null); // nothing to write, nothing to create
            }
            row = insertOpenRow(userId, date);
        }
        row.setReflectionText(cleaned);
        RitualDayEntity saved = ritualDayRepository.saveAndFlush(row);
        if (saved.getClosedAt() != null) {
            // the prose was edited AFTER the close — re-embed so the vector never goes stale
            eventPublisher.publishEvent(new RitualClosedEvent(saved.getId()));
        }
        return toResponse(userId, date, saved);
    }

    /**
     * Inserts an OPEN {@code ritual_day} row — {@code closed_at} stays null, so the caller decides
     * whether this day is merely reflected on or gets stamped closed.
     *
     * <p>No unique-violation recovery here, deliberately. {@code uq_ritual_day_user_date} can only
     * fire if a concurrent request committed the same {@code (created_by, ritual_date)} first, and
     * by then Postgres has already marked THIS transaction aborted — every further statement in it,
     * including a re-read of the winning row, fails with "current transaction is aborted". A
     * {@code catch} that re-read here would look like recovery while never recovering, so it is
     * gone: the loser's request fails with a 500 and the user retries, which then finds the row.
     * mezo is single-user (CLAUDE.md), so this needs two of the owner's own writes to land in the
     * same millisecond; a {@code REQUIRES_NEW} insert bean to make it survivable would buy that
     * back at the cost of committing orphan rows whenever the outer transaction rolls back.
     */
    private RitualDayEntity insertOpenRow(UUID userId, LocalDate date) {
        RitualDayEntity e = new RitualDayEntity();
        e.setCreatedBy(userId);
        e.setRitualDate(date);
        return ritualDayRepository.saveAndFlush(e);
    }

    private RitualDayResponse toResponse(UUID userId, LocalDate date, RitualDayEntity row) {
        LocalTime bed = sleepAnchorPort.resolve(userId).bed();
        RitualWindow window = RitualWindow.builder()
            .bedTime(bed.format(HHMM))
            .opensAt(bed.minusMinutes(properties.leadMin()).format(HHMM))
            .prepStartsAt(bed.minusMinutes(properties.prepLeadMin()).format(HHMM))
            .build();
        // a row may exist for a reflection alone (mezo-b3pp.2) — closure is closed_at, not existence
        Instant closedAt = row == null ? null : row.getClosedAt();
        return RitualDayResponse.builder()
            .date(date)
            .closed(closedAt != null)
            .closedAt(closedAt == null ? null : OffsetDateTime.ofInstant(closedAt, ZoneOffset.UTC))
            .reflectionText(row == null ? null : row.getReflectionText())
            .window(window)
            .build();
    }

    private SystemRuntimeErrorException ritualNotToday() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RITUAL_NOT_TODAY").build(), HttpStatus.CONFLICT);
    }
}
