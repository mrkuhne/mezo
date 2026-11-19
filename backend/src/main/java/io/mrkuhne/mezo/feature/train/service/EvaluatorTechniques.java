package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PlannedChallenge;
import io.mrkuhne.mezo.api.dto.PlannedTechnique;
import io.mrkuhne.mezo.api.dto.TechniqueSource;
import io.mrkuhne.mezo.api.dto.TechniqueWarning;
import io.mrkuhne.mezo.api.dto.VolumePathWeek;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Maps the planner's weeks (and a run's stored picks) onto the evaluator response (mezo-r36n9.81): per path week
 * {@code techniques[]} / {@code challenges[]}, plus the block-level {@code techniqueWarnings[]}. Pure.
 */
final class EvaluatorTechniques {

    /** Per-week lists, index 0 = week 1, and the block's distinct warnings. */
    record Shown(List<List<PlannedTechnique>> techniques, List<List<PlannedChallenge>> challenges,
                 List<TechniqueWarning> warnings) {

        /** Fills the path weeks (week {@code w} gets index {@code w - 1}); a short list leaves the week empty. */
        void applyTo(List<VolumePathWeek> path) {
            for (int i = 0; i < path.size(); i++) {
                path.get(i).setTechniques(i < techniques.size() ? techniques.get(i) : List.of());
                path.get(i).setChallenges(i < challenges.size() ? challenges.get(i) : List.of());
            }
        }
    }

    private EvaluatorTechniques() {}

    /** Every week is the planner's projection (a draft). */
    static Shown ofProjection(List<TechniquePlanner.Week> weeks) {
        return new Shown(weeks.stream().map(w -> techniques(w.techniques())).toList(),
            weeks.stream().map(w -> challenges(w.challenges())).toList(), warnings(weeks));
    }

    /**
     * A run: weeks before {@code currentWeek} empty, the current week the STORED picks, later weeks the planner's
     * projection; warnings only from the weeks still to come (the current one included).
     */
    static Shown ofRun(List<TechniquePlanner.Week> projection, int currentWeek, List<PlannedTechnique> storedTechniques,
                       List<PlannedChallenge> storedChallenges) {
        List<List<PlannedTechnique>> techniques = new ArrayList<>();
        List<List<PlannedChallenge>> challenges = new ArrayList<>();
        for (int w = 1; w <= projection.size(); w++) {
            if (w < currentWeek) {
                techniques.add(List.of());
                challenges.add(List.of());
            } else if (w == currentWeek) {
                techniques.add(storedTechniques);
                challenges.add(storedChallenges);
            } else {
                techniques.add(techniques(projection.get(w - 1).techniques()));
                challenges.add(challenges(projection.get(w - 1).challenges()));
            }
        }
        List<TechniquePlanner.Week> ahead = projection.stream().skip(Math.max(0, currentWeek - 1)).toList();
        return new Shown(techniques, challenges, warnings(ahead));
    }

    /** A run row's stored technique, if any (null source = the owner's). */
    static PlannedTechnique storedTechnique(int dayIndex, int exerciseIndex, ExerciseEntity e) {
        Technique technique = Technique.fromWire(e.getTechnique());
        if (technique == Technique.NONE) {
            return null;
        }
        String source = e.getTechniqueSource() == null ? TechniquePlanner.SOURCE_OWNER : e.getTechniqueSource();
        return PlannedTechnique.builder().dayIndex(dayIndex).exerciseIndex(exerciseIndex)
            .technique(technique.toApi()).source(TechniqueSource.fromValue(source)).build();
    }

    static PlannedChallenge challenge(int dayIndex, int exerciseIndex) {
        return PlannedChallenge.builder().dayIndex(dayIndex).exerciseIndex(exerciseIndex).build();
    }

    private static List<PlannedTechnique> techniques(List<TechniquePlanner.Pick> picks) {
        return picks.stream().map(p -> PlannedTechnique.builder().dayIndex(p.dayIndex())
            .exerciseIndex(p.exerciseIndex()).technique(p.technique().toApi())
            .source(TechniqueSource.fromValue(p.source())).build()).toList();
    }

    private static List<PlannedChallenge> challenges(List<TechniquePlanner.Pick> picks) {
        return picks.stream().map(p -> challenge(p.dayIndex(), p.exerciseIndex())).toList();
    }

    private static List<TechniqueWarning> warnings(List<TechniquePlanner.Week> weeks) {
        Set<TechniquePlanner.Warning> distinct = new LinkedHashSet<>();
        weeks.forEach(w -> distinct.addAll(w.warnings()));
        return distinct.stream().map(w -> TechniqueWarning.builder()
            .code(TechniqueWarning.CodeEnum.fromValue(w.code())).dayIndex(w.dayIndex())
            .exerciseIndex(w.exerciseIndex()).build()).toList();
    }
}
