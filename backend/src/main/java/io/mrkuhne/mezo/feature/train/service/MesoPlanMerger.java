package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Validates an LLM {@link MesoPlanLlm.Suggestion} against the frames and merges it over the
 *  deterministic fill. Pure. The LLM decides WHICH exercises; the frame decides HOW MANY sets. */
public final class MesoPlanMerger {

    private MesoPlanMerger() {}

    public static List<MesoPlanFiller.FilledDay> merge(MesoPlanSkeleton.Skeleton skeleton,
                                                       List<MesoPlanFiller.FilledDay> deterministic,
                                                       MesoPlanLlm.Suggestion suggestion,
                                                       List<MesoPlanFiller.Candidate> candidates,
                                                       MesoPlanProperties props) {
        if (suggestion == null || suggestion.days() == null || suggestion.days().isEmpty()) {
            return deterministic;
        }
        Map<UUID, MesoPlanFiller.Candidate> byId = candidates.stream()
            .collect(Collectors.toMap(MesoPlanFiller.Candidate::id, c -> c, (a, b) -> a));
        Map<String, List<MesoPlanLlm.ExercisePick>> picksByDay = new LinkedHashMap<>();
        for (MesoPlanLlm.DayPick d : suggestion.days()) {
            if (d == null || d.day() == null || d.exercises() == null) continue;
            picksByDay.merge(d.day(), new ArrayList<>(d.exercises()), (a, b) -> { a.addAll(b); return a; });
        }

        List<MesoPlanFiller.FilledDay> out = new ArrayList<>(deterministic.size());
        for (int i = 0; i < skeleton.days().size(); i++) {
            MesoPlanSkeleton.DayFrame frame = skeleton.days().get(i);
            MesoPlanFiller.FilledDay det = deterministic.get(i);
            List<MesoPlanLlm.ExercisePick> llm = picksByDay.getOrDefault(frame.day(), List.of());
            if (llm.isEmpty() || frame.muscles().isEmpty()) {
                out.add(det);
                continue;
            }
            List<MesoPlanFiller.Pick> picks = new ArrayList<>();
            for (MesoPlanSkeleton.MuscleFrame m : frame.muscles()) {
                List<MesoPlanFiller.Candidate> chosen = new ArrayList<>();
                for (MesoPlanLlm.ExercisePick p : llm) {
                    MesoPlanFiller.Candidate c = p == null || p.catalogId() == null ? null : byId.get(p.catalogId());
                    if (c != null && m.group().equals(c.group()) && !chosen.contains(c)) {
                        chosen.add(c);
                    }
                }
                if (chosen.isEmpty()) {
                    picks.addAll(det.picks().stream().filter(p -> p.candidate().group().equals(m.group())).toList());
                    continue;
                }
                int count = Math.min(chosen.size(), Math.min(props.maxExercisesPerGroupPerDay(), Math.max(1, m.sets())));
                int base = m.sets() / count;
                int remainder = m.sets() % count;
                for (int k = 0; k < count; k++) {
                    picks.add(new MesoPlanFiller.Pick(chosen.get(k), base + (k < remainder ? 1 : 0)));
                }
            }
            out.add(new MesoPlanFiller.FilledDay(frame.day(), frame.type(), List.copyOf(picks)));
        }
        return List.copyOf(out);
    }
}
