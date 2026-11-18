package io.mrkuhne.mezo.feature.train.service;

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
import java.util.TreeMap;
import java.util.UUID;

/**
 * The block, week by week: what the weekly engine would do to a plan if every signal stayed green
 * (volume engine v2 S2, spec §6.3). Pure, no Spring/DB. Mirrors {@code WeekProposalService.build}: a deload
 * week halves every exercise, the week after restores them first and then takes the normal step.
 */
public final class VolumePath {
    private VolumePath() {}

    private static final String DELOAD = "Deload";

    /** One counting exercise; {@code key} is a row id's string or {@code dayIndex:exerciseIndex}. */
    public record Exercise(String key, String group, int dayIndex, int sets) {}

    public record Group(PriorityTier tier, Band band) {}

    /**
     * {@code amounts} are the exercises as they stand in week {@code fromWeek}; {@code restoreTo} holds the
     * pre-deload amounts when {@code fromWeek} itself is a deload (else empty).
     */
    public record Input(int weeks, List<String> phaseCurve, int fromWeek, List<Exercise> amounts,
                        Map<String, Integer> restoreTo, Map<String, Group> groups, boolean deficit,
                        int stepEmphasize, int stepGrow, int stepDeficit, BigDecimal deloadFraction,
                        int exerciseCap, int sessionCap) {}

    public record Week(int week, String phase, int total, Map<String, Integer> sets) {}

    public static List<Week> project(Input in) {
        List<Exercise> pathed = in.amounts().stream().filter(e -> in.groups().containsKey(e.group())).toList();
        Map<String, Integer> current = new LinkedHashMap<>();
        pathed.forEach(e -> current.put(e.key(), e.sets()));
        Map<String, Integer> preDeload = new HashMap<>(in.restoreTo());

        List<Week> out = new ArrayList<>();
        out.add(week(in, in.fromWeek(), pathed, current));
        for (int w = in.fromWeek() + 1; w <= in.weeks(); w++) {
            if (isDeload(in, w)) {
                preDeload = new HashMap<>(current);
                current.replaceAll((k, sets) -> Math.max(1, BigDecimal.valueOf(sets).multiply(in.deloadFraction())
                    .setScale(0, RoundingMode.CEILING).intValue()));
            } else {
                if (isDeload(in, w - 1)) {
                    preDeload.forEach((k, v) -> current.computeIfPresent(k, (kk, sets) -> Math.max(sets, v)));
                    preDeload = new HashMap<>();
                }
                step(in, pathed, current);
            }
            out.add(week(in, w, pathed, current));
        }
        return out;
    }

    private static void step(Input in, List<Exercise> pathed, Map<String, Integer> current) {
        Map<String, List<Exercise>> byGroup = new TreeMap<>();
        pathed.forEach(e -> byGroup.computeIfAbsent(e.group(), k -> new ArrayList<>()).add(e));
        byGroup.forEach((group, rows) -> {
            Group g = in.groups().get(group);
            int sets = rows.stream().mapToInt(e -> current.get(e.key())).sum();
            if (g.tier() == PriorityTier.MAINTAIN || sets >= g.band().high()) {
                return;
            }
            int delta = Math.min(
                VolumeDecider.step(g.tier(), in.deficit(), in.stepEmphasize(), in.stepGrow(), in.stepDeficit()),
                g.band().high() - sets);
            Map<UUID, String> keyById = new HashMap<>();
            rows.forEach(e -> keyById.put(id(e.key()), e.key()));
            for (int i = 0; i < delta; i++) {
                List<SetSlots.Slot> slots = rows.stream()
                    .map(e -> new SetSlots.Slot(id(e.key()), e.dayIndex(), current.get(e.key()))).toList();
                Optional<UUID> pick = SetSlots.pickUp(slots, in.exerciseCap(), in.sessionCap());
                if (pick.isEmpty()) {
                    break;
                }
                current.merge(keyById.get(pick.get()), 1, Integer::sum);
            }
        });
    }

    private static Week week(Input in, int w, List<Exercise> pathed, Map<String, Integer> current) {
        Map<String, Integer> sets = new TreeMap<>();
        pathed.forEach(e -> sets.merge(e.group(), current.get(e.key()), Integer::sum));
        return new Week(w, phase(in, w), sets.values().stream().mapToInt(Integer::intValue).sum(), sets);
    }

    /** A week the phase curve does not cover reads as the first phase everywhere (path, arc, run evaluation). */
    static final String MISSING_PHASE = "MEV";

    private static String phase(Input in, int w) {
        return w >= 1 && w <= in.phaseCurve().size() ? in.phaseCurve().get(w - 1) : MISSING_PHASE;
    }

    private static boolean isDeload(Input in, int w) {
        return DELOAD.equalsIgnoreCase(phase(in, w));
    }

    private static UUID id(String key) {
        return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
    }
}
