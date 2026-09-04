package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.SportSlotSkipResponse;
import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSlotSkipRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The ONE predicate every read path calls to decide whether a dated occurrence of a recurring
 * {@code sport_schedule_slot} is hidden (proactive coaching S5, mezo-d58h.5, spec 2026-09-03 §6).
 * Keeping the semantics here — rather than letting each call site re-derive them — is what makes
 * "skip tonight" apply consistently everywhere (workout-window reads, notification anchors, the
 * companion's prompt, plan feasibility).
 *
 * <p>A skip is identified by the slot's IDENTITY — weekday + clock time — not by
 * {@code sport_schedule_slot.id}; see {@link SportSlotSkipEntity}'s javadoc for why. Every caller
 * converts a {@link LocalDate} to the legacy 0=Hét..6=Vas convention with
 * {@code date.getDayOfWeek().getValue() - 1} — NOT ISO (the {@code AnchorResolver} "Trap #1").
 */
@Service
@RequiredArgsConstructor
public class SportSlotSkipService {

    private final SportSlotSkipRepository repository;

    /** Is this recurring slot hidden on this date? The slot is identified by weekday + clock time
     *  (see the changeset for why, not by row id). */
    @Transactional(readOnly = true)
    public boolean isSkipped(UUID userId, int dayOfWeek, String time, LocalDate date) {
        return repository.existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(
            userId, dayOfWeek, time, date);
    }

    /** Every skip in [from, to] — the batch read for the FE and for any path that already holds a
     *  week's worth of slots (one query instead of one per slot per day). */
    @Transactional(readOnly = true)
    public Set<SkipKey> skipsBetween(UUID userId, LocalDate from, LocalDate to) {
        Set<SkipKey> keys = new HashSet<>();
        for (SportSlotSkipEntity e : repository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, from, to)) {
            keys.add(new SkipKey(e.getDayOfWeek(), e.getTime(), e.getDate()));
        }
        return keys;
    }

    /** Idempotently hides one dated occurrence (proactive coaching S5 write side, mezo-d58h.5): an
     *  existing skip for the same (user, slot identity, date) is a NO-OP, not a duplicate insert or
     *  an error — the {@code AdviceMutationPort} contract that {@link
     *  io.mrkuhne.mezo.feature.proactive.service.SportSlotSkipAdapter} relies on.
     *
     *  <p><b>Why the existence check below is authoritative, not just advisory:</b> the only
     *  production caller, {@code AdviceApplyService#apply}, takes a per-user
     *  {@code pg_advisory_xact_lock} (see {@code CompanionMessageRepository#lockForDelivery})
     *  BEFORE it ever reaches this method, serializing every concurrent apply for the same user.
     *  Under that lock, two "apply skip_sport_slot" calls for the same user can never race each
     *  other here — the second one's existence check always sees the first one's row (or doesn't
     *  race it at all), so a plain check-then-insert is enough. This method does NOT itself catch
     *  the DB's partial unique index ({@code uq_sport_slot_skip_slot_date}) as a race-safety net:
     *  once {@code saveAndFlush} trips a JPA constraint violation, the shared
     *  {@code EntityManager}/transaction is left unusable per the JPA spec regardless of whether
     *  application code catches the exception locally, so the caller's eventual commit fails with
     *  {@code UnexpectedRollbackException} (a 500) — NOT a silent no-op. A future caller of this
     *  method that does not hold that per-user lock must serialize its own concurrent callers
     *  itself (or accept that 500 on the losing side), the same way {@code AdviceApplyService}
     *  does — the unique index is the LAST-RESORT data-integrity guard, not a race handler. */
    @Transactional
    public void skip(UUID userId, int dayOfWeek, String time, LocalDate date) {
        if (isSkipped(userId, dayOfWeek, time, date)) {
            return;
        }
        SportSlotSkipEntity entity = new SportSlotSkipEntity();
        entity.setCreatedBy(userId);
        entity.setDayOfWeek(dayOfWeek);
        entity.setTime(time);
        entity.setDate(date);
        repository.saveAndFlush(entity);
    }

    /** The FE's dedicated read (mezo-d58h.5): every skip in [from, to] as response DTOs, date then
     *  time ascending (the {@code listSportEvents} precedent) — {@code 200 []}, never 404. A
     *  reversed range is rejected the same way {@code WorkoutService#listWorkouts} and every other
     *  from/to train read does, rather than silently answering an empty list. */
    @Transactional(readOnly = true)
    public List<SportSlotSkipResponse> listResponses(UUID userId, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_INVALID_DATE_RANGE").build());
        }
        return skipsBetween(userId, from, to).stream()
            .sorted(Comparator.comparing(SkipKey::date).thenComparing(SkipKey::time))
            .map(k -> new SportSlotSkipResponse().dayOfWeek(k.dayOfWeek()).time(k.time()).date(k.date()))
            .toList();
    }

    /** One skipped slot occurrence — weekday (0=Hét..6=Vas) + clock time + the skipped date. */
    public record SkipKey(int dayOfWeek, String time, LocalDate date) {
    }
}
