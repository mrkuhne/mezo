package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSlotSkipRepository;
import java.time.LocalDate;
import java.util.HashSet;
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

    /** One skipped slot occurrence — weekday (0=Hét..6=Vas) + clock time + the skipped date. */
    public record SkipKey(int dayOfWeek, String time, LocalDate date) {
    }
}
