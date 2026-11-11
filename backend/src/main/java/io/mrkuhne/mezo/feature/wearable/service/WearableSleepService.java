package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.api.dto.SleepNightIn;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogSavedEvent;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepNightMerge;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Apple Health sleep nights → {@code sleep_log} (Boop S2, mezo-r36n9.2; one night per date, B1). Idempotent by
 * the client's {@code externalId} and by date: a re-sent night updates its row. A 60-night backfill must not flood the
 * companion, so at most ONE {@link SleepLogSavedEvent} is published per call — for the newest night,
 * only when this call inserted it and it is from today or yesterday.
 */
@Service
@RequiredArgsConstructor
public class WearableSleepService {

    private static final long MAX_WINDOW_DAYS = 100;

    private final SleepLogRepository repository;
    private final WearableProperties properties;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public IngestResult ingest(UUID createdBy, List<SleepNightIn> nights, LocalDate today) {
        return ingest(createdBy, nights, today, null, null);
    }

    /**
     * One live night per date: a Health night merges into the date's live row (a manual/screenshot row
     * keeps its subjective fields and takes the sensor ones), else into the row that already owns its
     * external id, else it is inserted. {@code windowFrom/windowTo} (both set) makes the payload
     * authoritative for that date range: Health nights missing from it are deleted, or demoted to a
     * manual row when they carry subjective values.
     */
    @Transactional
    public IngestResult ingest(UUID createdBy, List<SleepNightIn> nights, LocalDate today,
                               LocalDate windowFrom, LocalDate windowTo) {
        WearableBatches.requireAtMost(nights.size(), properties.maxSleepNights());
        requireValidWindow(nights, windowFrom, windowTo);
        Set<String> insertedIds = new HashSet<>();
        int inserted = 0;
        int updated = 0;
        for (SleepNightIn n : nights) {
            switch (merge(createdBy, n)) {
                case UPDATED -> updated++;
                case INSERTED -> {
                    inserted++;
                    insertedIds.add(n.getExternalId());
                }
                case SKIPPED -> { }
            }
        }
        if (windowFrom != null && windowTo != null) {
            deleteMissingInWindow(createdBy, nights, windowFrom, windowTo);
        }
        nights.stream().max(Comparator.comparing(SleepNightIn::getDate))
            .filter(newest -> insertedIds.contains(newest.getExternalId()))
            .filter(newest -> !newest.getDate().isBefore(today.minusDays(1)))
            .ifPresent(newest -> eventPublisher.publishEvent(new SleepLogSavedEvent(createdBy, newest.getDate())));
        return new IngestResult(inserted, updated);
    }

    private enum Outcome { INSERTED, UPDATED, SKIPPED }

    /** A night the user (or a window deletion) removed stays removed: SKIPPED. */
    private Outcome merge(UUID createdBy, SleepNightIn n) {
        SleepNightMerge.HealthNight night = new SleepNightMerge.HealthNight(n.getExternalId(), n.getBedtime(),
            n.getWakeup(), n.getDurationH(), positiveOrNull(n.getInBedMin()), n.getAwakeMin(), n.getLightMin(),
            n.getRemMin(), n.getDeepMin(), hypnogram(n), n.getSourceApp(), n.getSleepingHr());
        Optional<SleepLogEntity> dateRow = repository.findByCreatedByAndDateAndDeletedFalse(createdBy, n.getDate());
        Optional<SleepLogEntity> idRow = repository.findByCreatedByAndExternalIdAndDeletedFalse(
            createdBy, n.getExternalId());
        SleepLogEntity target = dateRow.orElse(null);
        if (idRow.isPresent() && (target == null || !idRow.get().getId().equals(target.getId()))) {
            if (target == null) {
                target = idRow.get(); // the night moved to another date: same row, new date
                target.setDate(n.getDate());
            } else {
                // The id's old row is superseded by the date's row: free the id, retire the old row.
                SleepLogEntity old = idRow.get();
                old.setExternalId(null);
                repository.saveAndFlush(old);
                repository.delete(old);
                repository.flush();
            }
        }
        boolean existed = target != null;
        if (target == null) {
            if (repository.existsDeletedExternalId(createdBy, n.getExternalId())) {
                return Outcome.SKIPPED; // deleted night, nothing live on its date: stays deleted
            }
            // Race-safe insert (a concurrent sync may have just created the date's row).
            existed = repository.insertLiveShellIfAbsent(createdBy, n.getDate()) == 0;
            target = repository.findByCreatedByAndDateAndDeletedFalse(createdBy, n.getDate()).orElseThrow();
        }
        // A different live row owns the date, so a stale soft-deleted holder of the id is cleared
        // first (it would trip uq_sleep_log_owner_external).
        repository.clearDeletedExternalId(createdBy, n.getExternalId());
        SleepNightMerge.applyHealth(target, night);
        repository.saveAndFlush(target);
        return existed ? Outcome.UPDATED : Outcome.INSERTED;
    }

    private void deleteMissingInWindow(UUID createdBy, List<SleepNightIn> nights, LocalDate from, LocalDate to) {
        Set<String> sent = nights.stream().map(SleepNightIn::getExternalId).collect(Collectors.toSet());
        for (SleepLogEntity row : repository.findByCreatedByAndDeletedFalseAndSourceAndDateBetween(
                createdBy, SleepNightMerge.APPLE_HEALTH, from, to)) {
            if (row.getExternalId() != null && sent.contains(row.getExternalId())) {
                continue;
            }
            if (SleepNightMerge.hasSubjective(row)) {
                SleepNightMerge.demoteToManual(row);
                repository.saveAndFlush(row);
            } else {
                // Free the id so a later re-send of this night is a fresh insert, not a "stays deleted" skip.
                row.setExternalId(null);
                repository.saveAndFlush(row);
                repository.delete(row);
            }
        }
        repository.flush();
    }

    private static void requireValidWindow(List<SleepNightIn> nights, LocalDate from, LocalDate to) {
        if (from == null && to == null) {
            return;
        }
        if (from == null || to == null || from.isAfter(to) || ChronoUnit.DAYS.between(from, to) > MAX_WINDOW_DAYS
            || nights.stream().anyMatch(n -> n.getDate().isBefore(from) || n.getDate().isAfter(to))) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("WEARABLE_SLEEP_WINDOW_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
    }

    /** sleep_log.in_bed_min is {@code >= 1}; Health can report 0 for a night without an in-bed sample. */
    private static Integer positiveOrNull(Integer v) {
        return v == null || v < 1 ? null : v;
    }

    private static SleepHypnogram hypnogram(SleepNightIn n) {
        return n.getHypnogram() == null ? null
            : new SleepHypnogram(n.getHypnogram().getBucketMin(), n.getHypnogram().getStages());
    }
}
