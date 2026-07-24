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
import org.springframework.dao.DataIntegrityViolationException;
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
            .orElseGet(() -> insertOrReread(userId, date));
        return toResponse(userId, date, row);
    }

    private RitualDayEntity insertOrReread(UUID userId, LocalDate date) {
        try {
            RitualDayEntity e = new RitualDayEntity();
            e.setCreatedBy(userId);
            e.setRitualDate(date);
            e.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS)); // timestamptz stores micros — truncate so the pre/post-persist responses match
            return ritualDayRepository.saveAndFlush(e);
        } catch (DataIntegrityViolationException ex) {
            // lost the race against a concurrent close() call — the row exists now
            return ritualDayRepository.findByCreatedByAndRitualDate(userId, date).orElseThrow();
        }
    }

    private RitualDayResponse toResponse(UUID userId, LocalDate date, RitualDayEntity row) {
        LocalTime bed = sleepAnchorPort.resolve(userId).bed();
        RitualWindow window = RitualWindow.builder()
            .bedTime(bed.format(HHMM))
            .opensAt(bed.minusMinutes(properties.leadMin()).format(HHMM))
            .prepStartsAt(bed.minusMinutes(properties.prepLeadMin()).format(HHMM))
            .build();
        return RitualDayResponse.builder()
            .date(date)
            .closed(row != null)
            .closedAt(row == null ? null : OffsetDateTime.ofInstant(row.getClosedAt(), ZoneOffset.UTC))
            .window(window)
            .build();
    }

    private SystemRuntimeErrorException ritualNotToday() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RITUAL_NOT_TODAY").build(), HttpStatus.CONFLICT);
    }
}
