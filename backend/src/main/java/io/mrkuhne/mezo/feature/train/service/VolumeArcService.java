package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.api.dto.VolumeArcWeek;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only whole-mesocycle volume arc (Phase B, Task B2): per-muscle planned scaffold (DA7) laid
 * alongside the logged actuals bucketed to {@code startDate}-anchored meso-weeks, up to {@code
 * currentWeek} — future weeks carry only {@code planned} ({@code actual == null}). Never gated by
 * the volume-progression switch (harmless read); never mutates state.
 *
 * <p>A muscle with no {@link MuscleGroupVolumeLogEntity} row is simply absent from the response
 * (DA5, same rule as {@link VolumeProgressionService}) — never fabricated.
 */
@Service
@RequiredArgsConstructor
public class VolumeArcService {

    private static final String PHASE_DELOAD = "Deload";

    /** Coarse volume-group → color-family region key, matching the frontend's {@code muscleRegion}. */
    private static final Map<String, String> REGION_BY_GROUP = Map.ofEntries(
        Map.entry("chest", "coral"),
        Map.entry("back", "sky"),
        Map.entry("shoulder", "lav"),
        Map.entry("biceps", "rose"),
        Map.entry("triceps", "rose"),
        Map.entry("quad", "sage"),
        Map.entry("ham", "sage"),
        Map.entry("glute", "sage"),
        Map.entry("calf", "sage"),
        Map.entry("core", "amber"));

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final VolumeProperties props;

    @Transactional(readOnly = true)
    public MesocycleVolumeArcResponse arc(UUID createdBy, UUID mesoId) {
        return arc(createdBy, mesoId, null);
    }

    /**
     * Report-freeze overload (mezo-meyc.2): same arc, but the "how far has this run got" cutoff that
     * masks future weeks' {@code actual} to null comes from the caller instead of the stored
     * {@code currentWeek}.
     *
     * <p>Why it exists: {@code currentWeek} only advances on the weekly volume rollover, so a run
     * closed while that value is stale would freeze an internally CONTRADICTORY report — adherence
     * counting a week-2 session while the arc shows week 2 as "not reached yet" ({@code actual =
     * null}). {@code MesocycleReportService} passes {@code max(currentWeek, weeksElapsed)}; the
     * public {@link #arc(UUID, UUID)} passes {@code null} and behaves exactly as before.
     */
    @Transactional(readOnly = true)
    MesocycleVolumeArcResponse arc(UUID createdBy, UUID mesoId, Integer effectiveCurrentWeek) {
        MesocycleEntity meso = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), createdBy);
        int weeks = meso.getWeeks();
        int currentWeek = effectiveCurrentWeek == null
            ? meso.getCurrentWeek()
            : Math.min(weeks, effectiveCurrentWeek);
        LocalDate startDate = meso.getStartDate();
        List<String> phaseCurve = meso.getPhaseCurve();

        Map<String, Map<Integer, Integer>> actualByGroupWeek =
            aggregateActuals(createdBy, mesoId, startDate, weeks);

        List<MuscleVolumeArc> muscles = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(mesoId)).stream()
            .map(row -> buildMuscleArc(row, meso, phaseCurve, weeks, currentWeek, actualByGroupWeek))
            .toList();

        return MesocycleVolumeArcResponse.builder()
            .mesocycleId(meso.getId())
            .title(meso.getTitle())
            .currentWeek(currentWeek)
            .weeks(weeks)
            .startDate(startDate)
            .endDate(meso.getEndDate())
            .status(MesocycleVolumeArcResponse.StatusEnum.fromValue(meso.getStatus()))
            .phaseCurve(phaseCurve.stream().map(MesocycleVolumeArcResponse.PhaseCurveEnum::fromValue).toList())
            .muscles(muscles)
            .build();
    }

    /** {@code coarse group -> (1-based meso-week -> logged working-set count)}, over completed instances. */
    private Map<String, Map<Integer, Integer>> aggregateActuals(
            UUID createdBy, UUID mesoId, LocalDate startDate, int weeks) {
        Map<String, Map<Integer, Integer>> byGroupWeek = new HashMap<>();
        for (ExerciseSetRepository.MuscleWeekSetCount row
                : exerciseSetRepository.aggregateWorkingSetsByMuscleAndDate(createdBy, mesoId)) {
            String group = MuscleGroup.of(row.getMuscle());
            int week = MesoWeeks.weekOf(startDate, row.getDate(), weeks);
            byGroupWeek.computeIfAbsent(group, g -> new HashMap<>())
                .merge(week, (int) row.getSets(), Integer::sum);
        }
        return byGroupWeek;
    }

    private MuscleVolumeArc buildMuscleArc(MuscleGroupVolumeLogEntity row, MesocycleEntity meso,
            List<String> phaseCurve, int weeks, int currentWeek,
            Map<String, Map<Integer, Integer>> actualByGroupWeek) {
        String muscle = row.getMuscle(); // already the coarse volume-group key
        int mev = row.getMev();
        int mrv = row.getMrv();
        PriorityTier tier = PriorityTier.of(meso.getMusclePriorities(), muscle);
        int ceiling = tier.ceiling(mev, row.getMav(), mrv);
        Map<Integer, Integer> actuals = actualByGroupWeek.getOrDefault(muscle, Map.of());
        int[] planned = plannedScaffold(phaseCurve, weeks, mev, ceiling);

        List<VolumeArcWeek> weekList = new ArrayList<>(weeks);
        for (int w = 1; w <= weeks; w++) {
            weekList.add(VolumeArcWeek.builder()
                .week(w)
                .phase(VolumeArcWeek.PhaseEnum.fromValue(phaseAt(phaseCurve, w)))
                .planned(planned[w - 1])
                .actual(w <= currentWeek ? actuals.getOrDefault(w, 0) : null)
                .isCurrent(w == currentWeek)
                .build());
        }

        return MuscleVolumeArc.builder()
            .muscle(muscle)
            .region(REGION_BY_GROUP.getOrDefault(muscle, "neutral"))
            .mrv(mrv)
            .weeks(weekList)
            .build();
    }

    /**
     * Planned-set scaffold (spec DA7, GD4): week 1 starts at MEV, deload weeks drop to {@code
     * round(ceiling * deloadFraction)} (ramp untouched), every other week ramps by {@code step} up
     * to the muscle's tier {@code ceiling} (Emphasize MRV / Grow MAV / Maintain MEV — mezo-3m5m,
     * AD4). The arc RESPONSE still reports the row's raw {@code mrv} untouched (see {@link
     * MuscleVolumeArc#getMrv()}) — only this internal scaffold shifts with the tier.
     */
    private int[] plannedScaffold(List<String> phaseCurve, int weeks, int mev, int ceiling) {
        int[] planned = new int[weeks];
        int ramp = mev;
        for (int w = 1; w <= weeks; w++) {
            if (w == 1) {
                planned[w - 1] = mev;
                ramp = mev;
            } else if (PHASE_DELOAD.equalsIgnoreCase(phaseAt(phaseCurve, w))) {
                planned[w - 1] = round(ceiling, props.deloadFraction());
            } else {
                ramp = Math.min(ramp + props.step(), ceiling);
                planned[w - 1] = ramp;
            }
        }
        return planned;
    }

    /** DA1-style bounds-checked 1-based phaseCurve lookup; defensive fallback if lengths ever drift. */
    private String phaseAt(List<String> phaseCurve, int week) {
        int idx = week - 1;
        if (phaseCurve == null || idx < 0 || idx >= phaseCurve.size()) {
            return "MEV";
        }
        return phaseCurve.get(idx);
    }

    private static int round(int value, BigDecimal frac) {
        return BigDecimal.valueOf(value).multiply(frac).setScale(0, RoundingMode.HALF_UP).intValue();
    }
}
