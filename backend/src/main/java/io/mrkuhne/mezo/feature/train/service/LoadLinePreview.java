package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.feature.train.HypertrophyDriveGate;
import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * The weight and rep lines of a weekly proposal (volume engine v2 S3, spec §6.4): a preview of what the
 * week's first session of each counting template-day exercise will prescribe — the same
 * {@link SetRecommendationService#prescribe} call {@code WorkoutService.getToday} makes, with the same
 * {@link StyleContext} ({@link ExerciseStyler#context}, at the proposal's week) and no session overlays
 * (no deload, no readiness / comeback hold, the row's own working sets). Load lines never write: the
 * session's read-time prescription already does it, and it may differ if he logs the exercise again
 * before that session.
 *
 * <p>Mapping from the prescription's progression signal against the reference top set (the one
 * {@code prescribe} judged):
 * <ul>
 *   <li>weight up → {@code weight} line {@code fromKg = reference top weight}, {@code toKg = target};
 *       reasons {@code top_of_rep_range}, + {@code reserve_left} when the reference set's RIR exceeded the
 *       exercise's target reserve, + {@code next_plate} when the step is exactly one plate step;</li>
 *   <li>reps up → {@code reps} line {@code from = reference reps}, {@code to = target reps}, {@code reserve_left};</li>
 *   <li>a down move (weight or reps) → its line with {@code grind};</li>
 *   <li>HOLD, no reference (first session / anchor), no net change (bodyweight at the range top) → none.</li>
 * </ul>
 * No load lines in a deload week or with the Hypertrophy Drive off. Failure-isolated per row: an exception
 * while previewing one exercise is logged and costs only that exercise's line (an outer catch covers the shared
 * setup — no load lines at all). Limit: a repository / database error marks the weekly transaction rollback-only
 * even when caught here, so the whole week's generation rolls back and is retried on the next open.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LoadLinePreview {

    static final String KIND_WEIGHT = "weight";
    static final String KIND_REPS = "reps";
    static final String REASON_TOP_OF_RANGE = "top_of_rep_range";
    static final String REASON_RESERVE_LEFT = "reserve_left";
    static final String REASON_NEXT_PLATE = "next_plate";
    static final String REASON_GRIND = "grind";

    private final SetRecommendationService setRecommendationService;
    private final ExerciseHistoryResolver historyResolver;
    private final ExerciseStyler exerciseStyler;
    private final HypertrophyProperties hypertrophyProps;
    private final TrainStyleProperties styleProps;
    private final ObjectProvider<HypertrophyDriveGate> hypertrophyGate;

    /**
     * The load lines of the run's week {@code calWeek}, in plan order, for the counting template-day rows
     * (those with a landmark group — the rows the set lines use). Empty in a deload week, with the gate
     * off, or on any failure.
     */
    List<WeekProposalLineJson> lines(UUID createdBy, MesocycleEntity run, int calWeek, List<TemplatePlan.Row> plan,
                                     boolean deloadPhase) {
        if (deloadPhase || hypertrophyGate.getIfAvailable() == null) {
            return List.of();
        }
        try {
            List<TemplatePlan.Row> rows = plan.stream().filter(r -> r.group() != null).toList();
            TrainingStyle runStyle = TrainingStyle.fromWire(run.getTrainingStyle());
            CatalogAttributes.Lookup stability = exerciseStyler.lookupRows(
                rows.stream().map(TemplatePlan.Row::exercise).toList(), runStyle != null);
            LocalDate today = LocalDate.now();
            List<WeekProposalLineJson> lines = new ArrayList<>();
            for (TemplatePlan.Row row : rows) {
                try {
                    WeekProposalLineJson line = lineFor(createdBy, run, calWeek, row, runStyle, stability, today);
                    if (line != null) {
                        lines.add(line);
                    }
                } catch (RuntimeException e) {
                    // One bad row costs only its own line, never the week's other load lines.
                    log.warn("Weekly proposal load preview failed for exercise {} (run {} week {}): no line",
                        row.exercise().getId(), run.getId(), calWeek, e);
                }
            }
            return lines;
        } catch (RuntimeException e) {
            log.warn("Weekly proposal load preview failed for run {} week {}: no weight/rep lines", run.getId(),
                calWeek, e);
            return List.of();
        }
    }

    /** One row's load line, or {@code null} (no reference to preview against, HOLD, no net change). */
    private WeekProposalLineJson lineFor(UUID createdBy, MesocycleEntity run, int calWeek, TemplatePlan.Row row,
                                         TrainingStyle runStyle, CatalogAttributes.Lookup stability, LocalDate today) {
        ExerciseEntity ex = row.exercise();
        StyleContext style = runStyle == null ? StyleContext.NONE
            : exerciseStyler.context(ex, runStyle, calWeek, run.getPhaseCurve(), stability);
        Prescription p = setRecommendationService.prescribe(createdBy, ex,
            new SetRecommendationService.PrescribeOptions(false, ex.getWorkingSets(), false, null, 0, style, today));
        ProgressionSignal signal = p.progression();
        if (signal == null || signal.getLever() == null) {
            return null; // first session / anchor: nothing to preview against
        }
        ExerciseSetEntity ref = topSet(historyResolver
            .reference(createdBy, ex, today, styleProps.sameRangeMaxAgeDays()).sets());
        if (ref == null) {
            return null;
        }
        Integer targetReserve = style.styled() ? Integer.valueOf(style.effectiveReserve()) : ex.getTargetRir();
        return line(row, signal, ref, targetReserve);
    }

    private WeekProposalLineJson line(TemplatePlan.Row row, ProgressionSignal signal, ExerciseSetEntity ref,
                                      Integer targetReserve) {
        switch (signal.getLever()) {
            case WEIGHT, DELOAD -> {
                BigDecimal delta = signal.getDeltaKg();
                if (delta == null || delta.signum() == 0 || ref.getWeightKg() == null
                        || signal.getTargetWeightKg() == null) {
                    return null;
                }
                List<String> reasons = new ArrayList<>();
                if (delta.signum() > 0) {
                    if (signal.getLever() != ProgressionSignal.LeverEnum.WEIGHT) {
                        return null; // a deload never moves up
                    }
                    reasons.add(REASON_TOP_OF_RANGE);
                    if (ref.getRir() != null && targetReserve != null && ref.getRir() > targetReserve) {
                        reasons.add(REASON_RESERVE_LEFT);
                    }
                    if (delta.compareTo(hypertrophyProps.plateStep()) == 0) {
                        reasons.add(REASON_NEXT_PLATE);
                    }
                } else {
                    reasons.add(REASON_GRIND);
                }
                return build(row, KIND_WEIGHT, null, null, reasons, ref.getWeightKg(), signal.getTargetWeightKg());
            }
            case REP -> {
                Integer to = signal.getTargetReps();
                Integer from = ref.getReps();
                if (to == null || from == null || to.equals(from)) {
                    return null; // e.g. bodyweight already at the top of its range: no net change
                }
                return build(row, KIND_REPS, from, to,
                    List.of(to > from ? REASON_RESERVE_LEFT : REASON_GRIND), null, null);
            }
            default -> {
                return null; // HOLD
            }
        }
    }

    private static WeekProposalLineJson build(TemplatePlan.Row row, String kind, Integer from, Integer to,
                                              List<String> reasons, BigDecimal fromKg, BigDecimal toKg) {
        ExerciseEntity ex = row.exercise();
        return new WeekProposalLineJson(UUID.randomUUID().toString(), ex.getId(), ex.getName(), row.dayIndex(),
            row.group(), kind, from, to, List.copyOf(reasons), null, row.dayName(), fromKg, toKg);
    }

    /** The reference's top working set, exactly as {@code SetRecommendationService} picks it (max weight, then reps). */
    private static ExerciseSetEntity topSet(List<ExerciseSetEntity> sets) {
        return sets.stream()
            .max(Comparator
                .comparing((ExerciseSetEntity s) -> s.getWeightKg() != null ? s.getWeightKg() : BigDecimal.valueOf(-1))
                .thenComparing(ExerciseSetEntity::getReps))
            .orElse(null);
    }
}
