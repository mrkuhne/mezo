package io.mrkuhne.mezo.feature.medication.service;

import io.mrkuhne.mezo.feature.medication.entity.MedicationCycleJson;
import io.mrkuhne.mezo.feature.medication.entity.MedicationCycleJson.Phase;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle.Cell;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Derives where the owner sits in their medication cycle on a given day — the retaDay/phase logic at
 * the heart of the Fuel "Gyógyszer" slice. Pure read: given the active {@link MedicationEntity} and a
 * date, it finds the most recent intake at-or-before that date and projects it onto the cycle config.
 *
 * <p>retaDay is {@code days-since-last-dose + 1}, 1-based, then CLAMPED to {@code cycleLengthDays} so a
 * dose older than one full cycle simply holds at the last cycle day (no separate "too old" state). With
 * no dose at all the result is an honest zero ({@code retaDay 0}, null {@code lastDoseAt}, ghost week) —
 * never a fabricated day.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MedicationCycleService {

    private final MedicationDoseRepository doseRepo;

    public MedicationCycle derive(UUID userId, MedicationEntity med, LocalDate onDate) {
        MedicationCycleJson cfg = med.getCycle();
        var last = doseRepo
            .findFirstByCreatedByAndMedicationIdAndDeletedFalseAndAdministeredDateLessThanEqualOrderByAdministeredDateDesc(
                userId, med.getId(), onDate);
        if (last.isEmpty()) {
            return new MedicationCycle(0, null, null, null, ghostWeek(cfg)); // honest-zero
        }
        LocalDate lastDate = last.get().getAdministeredDate();
        long since = ChronoUnit.DAYS.between(lastDate, onDate);
        int day = (int) Math.min(since + 1, cfg.cycleLengthDays()); // clamp past cycle length
        Phase phase = phaseOf(cfg, day);
        return new MedicationCycle(
            day, phase.key(), phase.label(), last.get().getAdministeredAt(), buildWeek(cfg, day));
    }

    /** The phases[] entry whose fromDay..toDay (inclusive) contains {@code day}; the last phase if none. */
    private Phase phaseOf(MedicationCycleJson cfg, int day) {
        List<Phase> phases = cfg.phases();
        for (Phase p : phases) {
            if (day >= p.fromDay() && day <= p.toDay()) {
                return p;
            }
        }
        return phases.get(phases.size() - 1); // defensive: a clamped day past the last range
    }

    /** Cells 1..cycleLengthDays, the cell at {@code currentDay} marked current. */
    private List<Cell> buildWeek(MedicationCycleJson cfg, int currentDay) {
        List<Cell> cells = new ArrayList<>(cfg.cycleLengthDays());
        for (int d = 1; d <= cfg.cycleLengthDays(); d++) {
            Phase p = phaseOf(cfg, d);
            cells.add(new Cell(d, p.key(), p.label(), d == currentDay));
        }
        return cells;
    }

    /** Same cells as {@link #buildWeek} but with no current marker (no dose to anchor "now"). */
    private List<Cell> ghostWeek(MedicationCycleJson cfg) {
        return buildWeek(cfg, 0); // day 0 never matches a 1-based cell → all current=false
    }
}
