package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Deterministic exercise fill of a {@link MesoPlanSkeleton.Skeleton}: the fallback the generator
 * ALWAYS has (LLM absent / failed / partial). Pure — catalog rows come in as {@link Candidate}s.
 * Per (day, group): 2 exercises when the frame has ≥6 sets else 1, compound-first, stim-desc,
 * rotating the start offset on the group's later occurrences in the week so Upper A ≠ Upper B
 * when the catalog is deep enough. Never fabricates: a group with no candidate yields nothing.
 */
public final class MesoPlanFiller {

    private MesoPlanFiller() {}

    public record Candidate(UUID id, String name, String muscle, String group, String type, double stim, double fatigue) {}

    public record Pick(Candidate candidate, int workingSets) {}

    public record FilledDay(String day, String type, List<Pick> picks) {}

    private static final Comparator<Candidate> ORDER = Comparator
        .comparing((Candidate c) -> "compound".equals(c.type()) ? 0 : 1)
        .thenComparing(Comparator.comparingDouble(Candidate::stim).reversed())
        .thenComparing(Candidate::name);

    public static List<FilledDay> fill(MesoPlanSkeleton.Skeleton skeleton, List<Candidate> candidates,
                                       MesoPlanProperties props) {
        Map<String, Integer> occurrence = new HashMap<>();
        List<FilledDay> out = new ArrayList<>(skeleton.days().size());
        for (MesoPlanSkeleton.DayFrame day : skeleton.days()) {
            List<Pick> picks = new ArrayList<>();
            for (MesoPlanSkeleton.MuscleFrame m : day.muscles()) {
                int rotation = occurrence.merge(m.group(), 1, Integer::sum) - 1;
                picks.addAll(fillGroup(m.group(), m.sets(), candidates, rotation, props));
            }
            out.add(new FilledDay(day.day(), day.type(), List.copyOf(picks)));
        }
        return List.copyOf(out);
    }

    public static List<Pick> fillGroup(String group, int sets, List<Candidate> candidates, int rotation,
                                       MesoPlanProperties props) {
        List<Candidate> pool = candidates.stream().filter(c -> group.equals(c.group())).sorted(ORDER).toList();
        if (pool.isEmpty() || sets <= 0) {
            return List.of();
        }
        int count = Math.min(pool.size(), sets >= 6 ? Math.min(2, props.maxExercisesPerGroupPerDay()) : 1);
        int offset = (rotation * count) % pool.size();
        List<Pick> picks = new ArrayList<>(count);
        int base = sets / count;
        int remainder = sets % count;
        for (int i = 0; i < count; i++) {
            Candidate c = pool.get((offset + i) % pool.size());
            picks.add(new Pick(c, base + (i < remainder ? 1 : 0)));
        }
        return List.copyOf(picks);
    }
}
