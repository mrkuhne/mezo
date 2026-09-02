package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Deterministic core of the hypertrophy plan generator (mesocycle wizard redesign, spec §The
 * training model). Pure: day tokens + weeks + sparse priorities + the RP landmark table in,
 * a 7-day frame out. Split is derived from the day COUNT only (2–3 Full · 4 Upper/Lower ·
 * 5 Upper/Lower/Push/Pull/Legs · 6 PPL×2), which by construction trains every coarse group
 * ≥2×/week. Week-1 sets per group come from {@link PriorityTier#weekOneStart}, ceilings from
 * {@link PriorityTier#ceiling}; the weekly amount is spread over the days that contain the
 * group, remainder on the earliest day. Groups absent from the landmark table (core, traps)
 * are never framed (DA5).
 */
public final class MesoPlanSkeleton {

    private MesoPlanSkeleton() {}

    public static final List<String> DAY_ORDER = List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas");

    public record MuscleFrame(String group, int sets) {}

    public record DayFrame(String day, String type, List<MuscleFrame> muscles) {}

    public record Skeleton(String splitLabel, List<DayFrame> days, Map<String, Integer> weekOneSets,
                           Map<String, Integer> ceilings, List<String> phaseCurve) {}

    private static final Map<Integer, List<String>> SPLIT_DAYS = Map.of(
        2, List.of("Full", "Full"),
        3, List.of("Full", "Full", "Full"),
        4, List.of("Upper", "Lower", "Upper", "Lower"),
        5, List.of("Upper", "Lower", "Push", "Pull", "Legs"),
        6, List.of("Push", "Pull", "Legs", "Push", "Pull", "Legs"));

    private static final Map<Integer, String> SPLIT_LABEL = Map.of(
        2, "Full body", 3, "Full body", 4, "Upper / Lower",
        5, "Upper / Lower / Push / Pull / Legs", 6, "Push / Pull / Legs ×2");

    /** Group order inside a day = the order exercises will be emitted (big movers first). */
    private static final Map<String, List<String>> TYPE_GROUPS = Map.of(
        "Full", List.of("quad", "chest", "back", "ham", "shoulder", "glute", "biceps", "triceps", "calf"),
        "Upper", List.of("chest", "back", "shoulder", "biceps", "triceps"),
        "Lower", List.of("quad", "ham", "glute", "calf"),
        "Push", List.of("chest", "shoulder", "triceps"),
        "Pull", List.of("back", "biceps"),
        "Legs", List.of("quad", "ham", "glute", "calf"));

    public static Skeleton build(List<String> daysOfWeek, int weeks, Map<String, String> priorities,
                                 Map<String, VolumeProperties.Baseline> baselines) {
        List<String> training = daysOfWeek.stream().sorted((a, b) -> DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).toList();
        int n = Math.max(2, Math.min(6, training.size()));
        List<String> types = SPLIT_DAYS.get(n);

        Map<String, Integer> weekOne = new LinkedHashMap<>();
        Map<String, Integer> ceilings = new LinkedHashMap<>();
        baselines.forEach((group, b) -> {
            PriorityTier tier = PriorityTier.of(priorities, group);
            weekOne.put(group, tier.weekOneStart(b.mev(), b.mav(), b.mrv()));
            ceilings.put(group, tier.ceiling(b.mev(), b.mav(), b.mrv()));
        });

        // frequency per group over the chosen split
        Map<String, Integer> freq = new LinkedHashMap<>();
        for (String t : types) {
            for (String g : TYPE_GROUPS.get(t)) {
                if (baselines.containsKey(g)) freq.merge(g, 1, Integer::sum);
            }
        }
        Map<String, Integer> handed = new LinkedHashMap<>();

        List<DayFrame> days = new ArrayList<>(7);
        for (String day : DAY_ORDER) {
            int idx = training.indexOf(day);
            if (idx < 0) {
                days.add(new DayFrame(day, "Rest", List.of()));
                continue;
            }
            String type = types.get(idx);
            List<MuscleFrame> muscles = new ArrayList<>();
            for (String g : TYPE_GROUPS.get(type)) {
                if (!baselines.containsKey(g)) continue;
                int total = weekOne.get(g);
                int f = freq.get(g);
                int base = total / f;
                int remainder = total % f;
                int done = handed.getOrDefault(g, 0);
                int sets = base + (done < remainder ? 1 : 0);
                handed.put(g, done + 1);
                if (sets > 0) muscles.add(new MuscleFrame(g, sets));
            }
            days.add(new DayFrame(day, type, List.copyOf(muscles)));
        }
        return new Skeleton(SPLIT_LABEL.get(n) + " · " + training.size() + "×/hét",
            List.copyOf(days), weekOne, ceilings, phaseCurve(weeks));
    }

    /** weeks-1 ramp weeks then a Deload: the first one or two ramp weeks sit at MEV (two once
     *  the ramp is long enough to need it), the last ramp week peaks at MRV, everything between
     *  holds at MAV. */
    public static List<String> phaseCurve(int weeks) {
        int ramp = Math.max(1, weeks - 1);
        List<String> out = new ArrayList<>(weeks);
        int mevWeeks = ramp >= 4 ? 2 : 1;
        for (int i = 0; i < ramp; i++) {
            if (i == ramp - 1 && ramp > 1) out.add("MRV");
            else if (i < mevWeeks) out.add("MEV");
            else out.add("MAV");
        }
        out.add("Deload");
        return List.copyOf(out);
    }

    public static int frequencyOf(Skeleton s, String group) {
        return (int) s.days().stream().filter(d -> d.muscles().stream().anyMatch(m -> m.group().equals(group))).count();
    }
}
