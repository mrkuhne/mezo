package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.service.VolumeBands.Band;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Measures a mesocycle plan against its muscle-group bands (volume engine v2 S2, spec §6.2/§6.3). Pure, no
 * Spring/DB, never writes. Exercise key everywhere = {@code dayIndex:exerciseIndex} (index in the day's full list).
 */
public final class PlanEvaluator {
    private PlanEvaluator() {}

    public enum Fit { BELOW, INSIDE, ABOVE }

    /**
     * {@code group} is the coarse muscle group (may be null); {@code counts} false = exempt from volume;
     * {@code capExtra} = the extra set-equivalents its technique set weighs against the caps
     * ({@link TechniqueRules#capExtra}; 0 for a plain row or a block with techniques off).
     */
    public record PlanExercise(String group, int workingSets, int warmupSets, boolean counts, int capExtra) {
        public PlanExercise(String group, int workingSets, int warmupSets, boolean counts) {
            this(group, workingSets, warmupSets, counts, 0);
        }

        /** What the row weighs against the exercise / session caps. */
        int capWeight() {
            return workingSets > 0 ? workingSets + capExtra : 0;
        }
    }

    /** {@code index}: the day's reported index; null = its position in the list (a run reports its orderIndex). */
    public record PlanDay(String day, List<PlanExercise> exercises, Integer index) {
        public PlanDay(String day, List<PlanExercise> exercises) {
            this(day, exercises, null);
        }
    }

    /** {@code sportWeekdays}: 0=Hét..6=Vas. */
    public record Input(int weeks, List<String> phaseCurve, List<PlanDay> days, Map<String, String> priorities,
                        Set<String> sportGroups, boolean deficit, Integer sessionMinutesTarget,
                        Set<Integer> sportWeekdays, VolumeProperties props) {}

    public record DaySets(int dayIndex, int sets) {}

    public record ProposalEdit(int dayIndex, int exerciseIndex, int delta) {}

    public record CapWarning(String muscle, int sets, int cap) {}

    public record ExerciseCapWarning(int exerciseIndex, int sets, int cap) {}

    public record MuscleResult(String muscle, PriorityTier tier, Band band, int weeklySets, Fit fit, int diff,
                               List<DaySets> spread, List<ProposalEdit> proposal, boolean proposalBlocked) {}

    public record DayResult(int dayIndex, String day, int minutesEstimate, Boolean overTarget,
                            List<CapWarning> sessionCapWarnings, List<ExerciseCapWarning> exerciseCapWarnings,
                            boolean sportSameDay) {}

    public record Result(List<MuscleResult> muscles, List<DayResult> days, List<VolumePath.Week> path) {}

    /** One counting exercise of a landmark group. */
    private record Row(String key, String group, int dayIndex, int exerciseIndex, int sets, int capExtra) {}

    public static Result evaluate(Input in) {
        VolumeProperties p = in.props();
        List<Row> rows = new ArrayList<>();
        for (int d = 0; d < in.days().size(); d++) {
            List<PlanExercise> list = in.days().get(d).exercises();
            for (int e = 0; e < list.size(); e++) {
                PlanExercise x = list.get(e);
                if (x.counts() && x.group() != null && p.baselines().containsKey(x.group())) {
                    rows.add(new Row(d + ":" + e, x.group(), reportedIndex(in, d), e, x.workingSets(), x.capExtra()));
                }
            }
        }

        List<MuscleResult> muscles = new ArrayList<>();
        Map<String, VolumePath.Group> judged = new LinkedHashMap<>();
        for (Map.Entry<String, VolumeProperties.Baseline> landmark : p.baselines().entrySet()) {
            String name = landmark.getKey();
            List<Row> mine = rows.stream().filter(r -> r.group().equals(name)).toList();
            int weekly = mine.stream().mapToInt(Row::sets).sum();
            boolean named = in.priorities() != null && in.priorities().containsKey(name);
            if (weekly == 0 && !named) {
                continue;
            }
            PriorityTier tier = PriorityTier.of(in.priorities(), name);
            Band band = VolumeBands.band(landmark.getValue(), tier,
                in.sportGroups() != null && in.sportGroups().contains(name), p.bands());
            judged.put(name, new VolumePath.Group(tier, band));
            muscles.add(muscle(in, name, tier, band, mine, weekly));
        }

        List<DayResult> days = new ArrayList<>();
        for (int d = 0; d < in.days().size(); d++) {
            days.add(day(in, d));
        }

        List<VolumePath.Exercise> amounts = rows.stream()
            .map(r -> new VolumePath.Exercise(r.key(), r.group(), r.dayIndex(), r.sets(), r.capExtra())).toList();
        List<VolumePath.Week> path = VolumePath.project(new VolumePath.Input(in.weeks(), in.phaseCurve(), 1,
            amounts, Map.of(), judged, in.deficit(), p.stepEmphasize(), p.stepGrow(), p.stepDeficit(),
            p.deloadFraction(), p.bands().exerciseCap(), p.bands().sessionCap()));
        return new Result(muscles, days, path);
    }

    private static MuscleResult muscle(Input in, String name, PriorityTier tier, Band band, List<Row> mine,
                                       int weekly) {
        Fit fit = weekly < band.low() ? Fit.BELOW : weekly > band.high() ? Fit.ABOVE : Fit.INSIDE;
        int diff = switch (fit) {
            case BELOW -> band.low() - weekly;
            case ABOVE -> band.high() - weekly;
            case INSIDE -> 0;
        };
        Map<Integer, Integer> perDay = new TreeMap<>();
        mine.forEach(r -> perDay.merge(r.dayIndex(), r.sets(), Integer::sum));
        List<DaySets> spread = perDay.entrySet().stream().filter(e -> e.getValue() > 0)
            .map(e -> new DaySets(e.getKey(), e.getValue())).toList();

        // one working copy per group; moves are single sets, merged into one net edit per exercise
        Map<UUID, Row> byId = new HashMap<>();
        Map<UUID, Integer> current = new LinkedHashMap<>();
        mine.forEach(r -> {
            UUID id = UUID.nameUUIDFromBytes(r.key().getBytes(StandardCharsets.UTF_8));
            byId.put(id, r);
            current.put(id, r.sets());
        });
        int total = weekly;
        boolean blocked = false;
        int exCap = in.props().bands().exerciseCap();
        int sessCap = in.props().bands().sessionCap();
        if (fit == Fit.BELOW) {
            while (total < band.low()) {
                Optional<UUID> pick = SetSlots.pickUp(slots(byId, current), exCap, sessCap);
                if (pick.isEmpty()) {
                    blocked = true;
                    break;
                }
                current.merge(pick.get(), 1, Integer::sum);
                total++;
            }
        } else if (fit == Fit.ABOVE) {
            while (total > band.high()) {
                Optional<UUID> pick = SetSlots.pickDown(slots(byId, current));
                if (pick.isEmpty()) {
                    break;
                }
                current.merge(pick.get(), -1, Integer::sum);
                total--;
            }
        }
        List<ProposalEdit> proposal = new ArrayList<>();
        current.forEach((id, sets) -> {
            Row r = byId.get(id);
            if (sets != r.sets()) {
                proposal.add(new ProposalEdit(r.dayIndex(), r.exerciseIndex(), sets - r.sets()));
            }
        });
        return new MuscleResult(name, tier, band, weekly, fit, diff, spread, proposal, blocked);
    }

    private static List<SetSlots.Slot> slots(Map<UUID, Row> byId, Map<UUID, Integer> current) {
        return current.entrySet().stream()
            .map(e -> SetSlots.Slot.of(e.getKey(), byId.get(e.getKey()).dayIndex(), e.getValue(),
                byId.get(e.getKey()).capExtra())).toList();
    }

    private static int reportedIndex(Input in, int d) {
        Integer index = in.days().get(d).index();
        return index == null ? d : index;
    }

    private static DayResult day(Input in, int d) {
        VolumeProperties p = in.props();
        PlanDay day = in.days().get(d);
        int minutes = 0;
        if (!day.exercises().isEmpty()) {
            int working = day.exercises().stream().mapToInt(PlanExercise::workingSets).sum();
            int warmups = day.exercises().stream().mapToInt(PlanExercise::warmupSets).sum();
            minutes = p.evaluator().minutesPerWorkingSet().multiply(BigDecimal.valueOf(working))
                .add(p.evaluator().minutesPerWarmupSet().multiply(BigDecimal.valueOf(warmups)))
                .add(BigDecimal.valueOf(p.evaluator().sessionOverheadMinutes()))
                .setScale(0, RoundingMode.HALF_UP).intValue();
        }
        Boolean over = in.sessionMinutesTarget() == null ? null : minutes > in.sessionMinutesTarget();

        int cap = p.bands().sessionCap();
        List<CapWarning> warnings = new ArrayList<>();
        for (String group : p.baselines().keySet()) {
            // by cap weight: a technique set weighs 2 (mezo-r36n9.80, spec §6.4)
            int sets = day.exercises().stream()
                .filter(x -> x.counts() && group.equals(x.group())).mapToInt(PlanExercise::capWeight).sum();
            if (sets > cap) {
                warnings.add(new CapWarning(group, sets, cap));
            }
        }
        int exCap = p.bands().exerciseCap();
        List<ExerciseCapWarning> exerciseWarnings = new ArrayList<>();
        for (int e = 0; e < day.exercises().size(); e++) {
            PlanExercise x = day.exercises().get(e);
            if (x.counts() && x.capWeight() > exCap) {
                exerciseWarnings.add(new ExerciseCapWarning(e, x.capWeight(), exCap));
            }
        }
        int weekday = MesoPlanSkeleton.DAY_ORDER.indexOf(day.day());
        boolean sportSameDay = weekday >= 0 && in.sportWeekdays() != null && in.sportWeekdays().contains(weekday);
        return new DayResult(reportedIndex(in, d), day.day(), minutes, over, warnings, exerciseWarnings, sportSameDay);
    }
}
