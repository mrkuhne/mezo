package io.mrkuhne.mezo.feature.capacity.port;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * What capacity needs from training (consumer-owned port; train never imports capacity): the day's sessions as the
 * train windows resolve them (planned slots and logged sessions, skips and recovery already applied), the recovery
 * days and the weekly rhythm.
 */
public interface CapacityTrainPort {

    /** One session of a day. {@code done} = logged; otherwise still planned. {@code label} may be null. */
    record Session(LocalDate date, LocalTime start, int durationMin, String kind, boolean done, String label) {
    }

    /** Weekly slots of the current schedule. */
    record SlotCounts(int gym, int sport) {
    }

    /** Sessions per day of {@code from..to}; skipped and recovery-protected occurrences are not in it. */
    Map<LocalDate, List<Session>> sessions(UUID owner, LocalDate from, LocalDate to);

    /** Days of {@code from..to} covered by a recovery period (kímélő mód). */
    Set<LocalDate> recoveryDays(UUID owner, LocalDate from, LocalDate to);

    SlotCounts weeklySlots(UUID owner);
}
