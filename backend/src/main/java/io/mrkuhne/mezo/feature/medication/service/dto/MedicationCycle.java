package io.mrkuhne.mezo.feature.medication.service.dto;

import java.time.Instant;
import java.util.List;

/**
 * The internal derived view of where the owner sits in their medication cycle on a given day —
 * the heart of the Fuel "Gyógyszer" slice. NOT a boundary DTO (those are contract-generated under
 * {@code api.dto}); this is the service-layer intermediate the mapper/controller projects from.
 *
 * <p>{@code retaDay} is the 1-based day within the cycle ({@code 0} when there is no dose to anchor
 * from — an honest zero, never a fabricated day). {@code phaseKey}/{@code phaseLabel} name the phase
 * that day falls into; {@code lastDoseAt} is the precise instant of the most recent intake (null when
 * none). {@code week} renders the whole cycle period as labelled cells with exactly one (or zero, in
 * the ghost case) marked {@code current}.
 */
public record MedicationCycle(
    int retaDay, String phaseKey, String phaseLabel, Instant lastDoseAt, List<Cell> week) {

    /** One day-cell of the cycle strip: its 1-based {@code day}, its phase, and whether it is "now". */
    public record Cell(int day, String phaseKey, String label, boolean current) {}
}
