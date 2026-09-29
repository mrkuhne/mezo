package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.SportSlotSkipResponse;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.PlannedSkipRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSlotSkipRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
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
 *
 * <p>Kihagyás S1 (mezo-q4xt2.1): every read here is a UNION with {@code planned_skip} SPORT rows —
 * a user-declared sport skip hides the slot exactly like an advice skip does, everywhere this
 * service is read (workout-window reads, notification anchors, the companion's prompt, plan
 * feasibility). {@link PlannedSkipRepository} is injected directly, not {@code PlannedSkipService}
 * (which itself depends on this class for the ADVICE side of ITS union) — that dependency would be
 * a cycle.
 */
@Service
@RequiredArgsConstructor
public class SportSlotSkipService {

    private final SportSlotSkipRepository repository;
    private final PlannedSkipRepository plannedSkipRepository;

    /** Is this recurring slot hidden on this date? The slot is identified by weekday + clock time
     *  (see the changeset for why, not by row id) — checked against BOTH {@code sport_slot_skip}
     *  (advice) and {@code planned_skip} SPORT rows (user, Kihagyás S1). */
    @Transactional(readOnly = true)
    public boolean isSkipped(UUID userId, int dayOfWeek, String time, LocalDate date) {
        return repository.existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(
            userId, dayOfWeek, time, date)
            || plannedSkipRepository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, date, date).stream()
                .anyMatch(p -> p.getKind() == Kind.SPORT
                    && Objects.equals(p.getDayOfWeek(), dayOfWeek)
                    && Objects.equals(p.getTime(), time));
    }

    /** Every skip in [from, to] — the batch read for the FE and for any path that already holds a
     *  week's worth of slots (one query instead of one per slot per day). Unions {@code
     *  sport_slot_skip} with {@code planned_skip} SPORT rows (Kihagyás S1); both collapse to the
     *  same identity key, so a user skip and an advice skip on the same slot count once. */
    @Transactional(readOnly = true)
    public Set<SkipKey> skipsBetween(UUID userId, LocalDate from, LocalDate to) {
        Set<SkipKey> keys = new HashSet<>();
        for (SportSlotSkipEntity e : repository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, from, to)) {
            keys.add(new SkipKey(e.getDayOfWeek(), e.getTime(), e.getDate()));
        }
        for (PlannedSkipEntity p : plannedSkipRepository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, from, to)) {
            if (p.getKind() == Kind.SPORT) {
                keys.add(new SkipKey(p.getDayOfWeek(), p.getTime(), p.getDate()));
            }
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

    /** Raw rows in [from, to] (Kihagyás S1, mezo-q4xt2.1) — the union read's ADVICE side; unlike
     *  {@link #skipsBetween}, which collapses to identity keys, this keeps id + createdAt so
     *  {@code PlannedSkipPolicy} can judge them alongside {@code planned_skip} rows. */
    @Transactional(readOnly = true)
    public List<SportSlotSkipEntity> rowsBetween(UUID userId, LocalDate from, LocalDate to) {
        return repository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, from, to);
    }

    /** Undo of a coach (advice) skip through the Kihagyás API (mezo-q4xt2.1) — soft delete; false
     *  when no live row with this id belongs to the caller. */
    @Transactional
    public boolean deleteOwned(UUID userId, UUID id) {
        return repository.findById(id)
            .filter(e -> e.getCreatedBy().equals(userId) && !e.isDeleted())
            .map(e -> {
                repository.delete(e);
                repository.flush();
                return true;
            })
            .orElse(false);
    }

    /** Soft-deletes the ADVICE {@code sport_slot_skip} twin of a just-undone USER SPORT skip, if
     *  one exists (Kihagyás S1 controller ruling, mezo-q4xt2.1): "Visszavonom" on the user's row
     *  must really put the session back, not leave it hidden by the advice row underneath. A no-op
     *  when there is no twin. */
    @Transactional
    public void deleteMatchingAdviceTwin(UUID userId, int dayOfWeek, String time, LocalDate date) {
        repository.findByCreatedByAndDateBetweenAndDeletedFalse(userId, date, date).stream()
            .filter(e -> e.getDayOfWeek() == dayOfWeek && Objects.equals(e.getTime(), time))
            .findFirst()
            .ifPresent(e -> {
                repository.delete(e);
                repository.flush();
            });
    }

    /** One skipped slot occurrence — weekday (0=Hét..6=Vas) + clock time + the skipped date. */
    public record SkipKey(int dayOfWeek, String time, LocalDate date) {
    }
}
