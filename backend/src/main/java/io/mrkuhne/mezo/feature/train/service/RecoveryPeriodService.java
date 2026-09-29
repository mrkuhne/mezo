package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.RecoveryDayReleaseEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.repository.RecoveryDayReleaseRepository;
import io.mrkuhne.mezo.feature.train.repository.RecoveryPeriodRepository;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read side of kímélő mód (Kihagyás S2, mezo-q4xt2.2, spec 2026-09-28 §9): which dates a recovery
 * period protects, the open period, the latest ended one and a date's release row.
 *
 * <p>Depends ONLY on the two recovery repositories on purpose — {@code PlannedSkipService} and
 * {@code SportSlotSkipService} inject it for their read-time overlay, so it must never reach back
 * into them (no cycle). Every write lives in {@link RecoveryReturnService}.
 */
@Service
@RequiredArgsConstructor
public class RecoveryPeriodService {

    private final RecoveryPeriodRepository periods;
    private final RecoveryDayReleaseRepository releases;

    /**
     * Dates in [from, to] protected by any of the user's periods: a period covers
     * {@code startDate … endedOn−1} (open-ended while {@code endedOn} is null), minus its
     * released dates.
     */
    @Transactional(readOnly = true)
    public Set<LocalDate> protectedDates(UUID user, LocalDate from, LocalDate to) {
        Set<LocalDate> dates = new HashSet<>();
        if (from.isAfter(to)) {
            return dates;
        }
        List<RecoveryPeriodEntity> overlapping = overlapping(user, from, to);
        if (overlapping.isEmpty()) {
            return dates;
        }
        for (RecoveryPeriodEntity p : overlapping) {
            LocalDate first = p.getStartDate().isAfter(from) ? p.getStartDate() : from;
            LocalDate last = p.getEndedOn() == null || p.getEndedOn().minusDays(1).isAfter(to)
                ? to : p.getEndedOn().minusDays(1);
            for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
                dates.add(d);
            }
        }
        for (RecoveryDayReleaseEntity r : releases.findByCreatedByAndPeriodIdInAndDeletedFalse(
            user, overlapping.stream().map(RecoveryPeriodEntity::getId).toList())) {
            dates.remove(r.getDate());
        }
        return dates;
    }

    /** The user's open period (at most one, by the partial unique index). */
    @Transactional(readOnly = true)
    public Optional<RecoveryPeriodEntity> open(UUID user) {
        return periods.findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(user);
    }

    /** The most recently ended period (latest {@code endedOn}, then latest start). */
    @Transactional(readOnly = true)
    public Optional<RecoveryPeriodEntity> latestEnded(UUID user) {
        return periods.findFirstByCreatedByAndEndedOnIsNotNullAndDeletedFalseOrderByEndedOnDescStartDateDesc(user);
    }

    /** The live release row for {@code date} in the period that covers it, if any. */
    @Transactional(readOnly = true)
    public Optional<RecoveryDayReleaseEntity> release(UUID user, LocalDate date) {
        for (RecoveryPeriodEntity p : overlapping(user, date, date)) {
            Optional<RecoveryDayReleaseEntity> r =
                releases.findByCreatedByAndPeriodIdAndDateAndDeletedFalse(user, p.getId(), date);
            if (r.isPresent()) {
                return r;
            }
        }
        return Optional.empty();
    }

    /** Periods overlapping [from, to]: started by {@code to}, and not ended by {@code from}. */
    private List<RecoveryPeriodEntity> overlapping(UUID user, LocalDate from, LocalDate to) {
        return periods.findByCreatedByAndStartDateLessThanEqualAndDeletedFalse(user, to).stream()
            .filter(p -> p.getEndedOn() == null || p.getEndedOn().isAfter(from))
            .toList();
    }
}
