package io.mrkuhne.mezo.feature.medication.service.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * The internal derived view of where the owner sits in their medication cycle on a given day —
 * the heart of the Fuel "Gyógyszer" slice. NOT a boundary DTO (those are contract-generated under
 * {@code api.dto}); this is the service-layer intermediate the mapper/controller projects from.
 *
 * <p>{@code cycleDay} is the 1-based day within the cycle ({@code 0} when there is no dose to anchor
 * from — an honest zero, never a fabricated day). {@code phaseKey}/{@code phaseLabel} name the phase
 * that day falls into; {@code lastDoseAt} is the precise instant of the most recent intake (null when
 * none). {@code week} renders the whole cycle period as labelled cells with exactly one (or zero, in
 * the ghost case) marked {@code current}.
 *
 * <p>{@code lastDoseDate} is the dose's {@code administeredDate} column — the SAME day authority
 * {@code cycleDay} is derived from, exposed so a consumer that needs the unclamped days-since-dose
 * can recompute it without re-deriving a local date from {@code lastDoseAt} in the server's zone.
 * Those two disagree whenever the server zone differs from the offset the dose was logged in (a
 * late-evening dose maps to a different local date), which silently shifts derived staleness by a
 * day. Null exactly when {@code lastDoseAt} is null.
 */
public record MedicationCycle(
    int cycleDay, String phaseKey, String phaseLabel, Instant lastDoseAt, LocalDate lastDoseDate,
    List<Cell> week) {

    /** One day-cell of the cycle strip: its 1-based {@code day}, its phase, and whether it is "now". */
    public record Cell(int day, String phaseKey, String label, boolean current) {}
}
