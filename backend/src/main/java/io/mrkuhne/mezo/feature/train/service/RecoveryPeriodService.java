package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.RecoveryDayReleaseEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.repository.RecoveryDayReleaseRepository;
import io.mrkuhne.mezo.feature.train.repository.RecoveryPeriodRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
 * <p>Depends ONLY on repositories (the two recovery ones + the workout-session one for the
 * comeback count) on purpose — {@code PlannedSkipService} and
 * {@code SportSlotSkipService} inject it for their read-time overlay, so it must never reach back
 * into them (no cycle). Every write lives in {@link RecoveryReturnService}.
 */
@Service
@RequiredArgsConstructor
public class RecoveryPeriodService {

    private final RecoveryPeriodRepository periods;
    private final RecoveryDayReleaseRepository releases;
    private final WorkoutSessionRepository workoutSessions;

    /**
     * Dates in [from, to] protected by any of the user's periods: a period covers
     * {@code startDate … endedOn−1} (open-ended while {@code endedOn} is null), minus its
     * released dates.
     */
    @Transactional(readOnly = true)
    public Set<LocalDate> protectedDates(UUID user, LocalDate from, LocalDate to) {
        return new HashSet<>(protectedDays(user, from, to).keySet());
    }

    /**
     * {@link #protectedDates} with the period covering each date — the central skip read needs its
     * category and {@code createdAt} for the virtual RECOVERY verdict (Kihagyás S2, mezo-q4xt2.2).
     * Should two (soft-deleted-free) periods ever overlap, the later-started one wins the date.
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, RecoveryPeriodEntity> protectedDays(UUID user, LocalDate from, LocalDate to) {
        Map<LocalDate, RecoveryPeriodEntity> days = fuelDays(user, from, to);
        if (days.isEmpty()) {
            return days;
        }
        List<UUID> periodIds = days.values().stream().map(RecoveryPeriodEntity::getId).distinct().toList();
        for (RecoveryDayReleaseEntity r : releases.findByCreatedByAndPeriodIdInAndDeletedFalse(user, periodIds)) {
            days.remove(r.getDate());
        }
        return days;
    }

    /**
     * The period covering each date of [from, to] for the Fuel mode (Kihagyás S3): the same
     * {@code startDate … endedOn−1} span as {@link #protectedDays} but day releases are IGNORED —
     * "Ma mégis edzek" is a training choice, the body is still recovering, so Fuel stays in the
     * mode. The later-started period wins an overlapping date.
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, RecoveryPeriodEntity> fuelDays(UUID user, LocalDate from, LocalDate to) {
        Map<LocalDate, RecoveryPeriodEntity> days = new HashMap<>();
        if (from.isAfter(to)) {
            return days;
        }
        List<RecoveryPeriodEntity> overlapping = overlapping(user, from, to).stream()
            .sorted(Comparator.comparing(RecoveryPeriodEntity::getStartDate))
            .toList();
        for (RecoveryPeriodEntity p : overlapping) {
            LocalDate first = p.getStartDate().isAfter(from) ? p.getStartDate() : from;
            LocalDate last = p.getEndedOn() == null || p.getEndedOn().minusDays(1).isAfter(to)
                ? to : p.getEndedOn().minusDays(1);
            for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
                days.put(d, p);
            }
        }
        return days;
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

    /**
     * Comeback progress after {@code p} ended: the number of completed gym instances dated
     * {@code endedOn … to} (0 when {@code to} is before {@code endedOn}). The one count both the
     * recovery read model ({@code done}) and {@code getToday}'s ramp index use (spec §9.1.6: the
     * ramp is counted by sessions completed after the return, not by dates).
     */
    @Transactional(readOnly = true)
    public int comebackSessionsDone(RecoveryPeriodEntity p, LocalDate to) {
        if (p.getEndedOn() == null || to.isBefore(p.getEndedOn())) {
            return 0;
        }
        return workoutSessions.findDoneInstancesBetween(p.getCreatedBy(), p.getEndedOn(), to).size();
    }

    /** Periods overlapping [from, to]: started by {@code to}, and not ended by {@code from}. */
    private List<RecoveryPeriodEntity> overlapping(UUID user, LocalDate from, LocalDate to) {
        return periods.findByCreatedByAndStartDateLessThanEqualAndDeletedFalse(user, to).stream()
            .filter(p -> p.getEndedOn() == null || p.getEndedOn().isAfter(from))
            .toList();
    }
}
