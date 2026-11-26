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

    /**
     * The expected net kcal of one planned gym session of {@code minutes} on {@code date} — the very figure the fuel
     * day's pending preview adds per unlogged gym session (same energy model, same body); 0 for an unknown body.
     */
    int plannedGymKcal(UUID owner, LocalDate date, int minutes);

    // ── day-adjustment ledger checks (Boop B7 K3) — read-only, and always the RAW plan: the weekly gym schedule and
    // the active meso's day labels, never the ledger itself (a reader that honours the ledger would see a moved
    // session on its new day and the ledger would then expire its own move) ──

    /**
     * Does the plan put a gym session on {@code date}: a gym schedule slot on that weekday, or an active-meso template
     * day labelled with it that has exercises (an empty template day is a rest day). A skip does not empty the day
     * (undoing it would bring the session back).
     */
    boolean gymPlanned(UUID owner, LocalDate date);

    /** A completed gym workout dated {@code date} exists. */
    boolean gymDoneOn(UUID owner, LocalDate date);

    /** The owner's active-meso template day planned for {@code date}, if any; never an empty (rest-day) template. */
    java.util.Optional<UUID> plannedTemplate(UUID owner, LocalDate date);

    /** {@code templateSessionId} is a meso template day (not an instance) of the owner. */
    boolean ownsTemplate(UUID owner, UUID templateSessionId);

    /**
     * A workout of that template day is running right now — train's own rule for 409
     * {@code TRAIN_DAY_WORKOUT_RUNNING} (an {@code active} instance of the template).
     */
    boolean workoutRunning(UUID owner, UUID templateSessionId);

    /** {@code templateSessionId} is a template day of the owner's mesocycle {@code mesocycleId}. */
    boolean templateInBlock(UUID owner, UUID templateSessionId, UUID mesocycleId);

    /** {@code templateSessionId} is a template day of the owner's active mesocycle (false when none runs). */
    boolean templateInActiveBlock(UUID owner, UUID templateSessionId);
}
