package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The weekly proposal's technique lines (mezo-r36n9.81, T3): the run's stored rows against a planned week. Pure.
 * The caller plans the week (and may add picks of its own, e.g. a stall offer) and passes it in; this only turns
 * the difference into {@code technique} lines on the proposal's working copy of sets.
 *
 * <ul>
 *   <li><b>add</b> — a planner pick on a row without a technique: {@code none → X}, sets {@code s → s − 1};</li>
 *   <li><b>change</b> — a planner technique replaced by another pick: {@code Y → X}, sets unchanged;</li>
 *   <li><b>remove</b> — a planner technique no longer picked: {@code Y → none}, sets {@code s → s + 1} only while
 *       the exercise cap and the group's day session cap (cap weight, the technique set's extra gone) allow and
 *       the exercise is not all-out;</li>
 *   <li><b>challenge</b> — a planner challenge placed or taken away: {@code none ⇄ partials}, sets unchanged
 *       ({@code challenge = true}); a technique on the new challenge row is removed first.</li>
 * </ul>
 * A row holding an owner / AI pick, or a technique / challenge without the planner as its source, never gets a line.
 * A row with no muscle group at all (no landmark group and no coarse group) gets no line. Lines come by day,
 * removals first on each day (they free allowance), then by exercise position.
 */
final class TechniqueLines {

    static final String REASON_DEFICIT_ALLOWANCE = "deficit_allowance";
    static final String REASON_SPORT_DAY = "sport_day";

    private TechniqueLines() {}

    /** The lines in order and the working copy after them (a new map; the caller's is not touched). */
    record Result(List<WeekProposalLineJson> lines, Map<UUID, Integer> working) {}

    private enum Move {
        ADD, CHANGE, REMOVE, CHALLENGE_ON, CHALLENGE_OFF;

        boolean removal() {
            return this == REMOVE || this == CHALLENGE_OFF;
        }
    }

    private record Step(TechniquePlanner.PlanRow row, Move move, Technique to, String reason, int seq) {}

    /**
     * @param plan    the run's counting template rows (names, day labels, landmark groups) — only these get lines
     * @param input   the planner input the week was planned from (stored technique / source / challenge per row,
     *                sport days, caps, deficit)
     * @param week    the planned week (planner picks; only picks with source {@code planner} are acted on)
     * @param working the proposal's working copy of sets after its set decisions
     */
    static Result lines(List<TemplatePlan.Row> plan, TechniquePlanner.Input input, TechniquePlanner.Week week,
                        Map<UUID, Integer> working) {
        Map<UUID, TemplatePlan.Row> planById = new HashMap<>();
        plan.forEach(r -> planById.put(r.exercise().getId(), r));
        Map<UUID, Technique> picked = new HashMap<>();
        Map<UUID, String> pickReason = new HashMap<>();
        week.techniques().stream().filter(p -> TechniquePlanner.SOURCE_PLANNER.equals(p.source())).forEach(p -> {
            picked.put(p.id(), p.technique());
            pickReason.put(p.id(), p.reason());
        });
        Set<UUID> challenged = new HashSet<>();
        week.challenges().stream().filter(p -> TechniquePlanner.SOURCE_PLANNER.equals(p.source()))
            .forEach(p -> challenged.add(p.id()));

        Map<Integer, Boolean> sportDay = new HashMap<>();
        List<TechniquePlanner.PlanRow> allRows = new ArrayList<>();
        Map<UUID, Integer> sets = new HashMap<>();
        Map<UUID, Boolean> extra = new HashMap<>();   // carries a technique or a challenge (weighs capWeight)
        Map<UUID, Technique> technique = new HashMap<>();
        Map<UUID, Boolean> challenge = new HashMap<>();
        for (TechniquePlanner.PlanDay day : input.days()) {
            sportDay.put(day.dayIndex(), day.sportDay());
            for (TechniquePlanner.PlanRow r : day.rows()) {
                allRows.add(r);
                sets.put(r.id(), working.getOrDefault(r.id(), r.workingSets()));
                technique.put(r.id(), r.technique() == null ? Technique.NONE : r.technique());
                challenge.put(r.id(), r.challenge());
                extra.put(r.id(), hasTechnique(r) || r.challenge());
            }
        }

        List<Step> steps = new ArrayList<>();
        int seq = 0;
        for (TechniquePlanner.PlanRow r : allRows) {
            if (!planById.containsKey(r.id()) || !plannerMay(r) || lineGroup(planById.get(r.id()), r) == null) {
                continue;   // a line always names a muscle group
            }
            Technique want = picked.getOrDefault(r.id(), Technique.NONE);
            boolean has = hasTechnique(r);
            if (!has && want != Technique.NONE) {
                steps.add(new Step(r, Move.ADD, want, pickReason.get(r.id()), seq++));
            } else if (has && want != Technique.NONE && want != r.technique()) {
                steps.add(new Step(r, Move.CHANGE, want, pickReason.get(r.id()), seq++));
            } else if (has && want == Technique.NONE) {
                steps.add(new Step(r, Move.REMOVE, Technique.NONE, removalReason(r, input, sportDay), seq++));
            }
            boolean wantChallenge = challenged.contains(r.id());
            if (wantChallenge && !r.challenge()) {
                steps.add(new Step(r, Move.CHALLENGE_ON, Technique.PARTIALS, TechniquePlanner.REASON_CHALLENGE,
                    seq++));
            } else if (!wantChallenge && r.challenge()) {
                steps.add(new Step(r, Move.CHALLENGE_OFF, Technique.NONE, TechniquePlanner.REASON_CHALLENGE, seq++));
            }
        }
        steps.sort(Comparator.comparingInt((Step s) -> s.row().dayIndex())
            .thenComparing(s -> !s.move().removal())
            .thenComparingInt(s -> s.row().exerciseIndex())
            .thenComparingInt(Step::seq));

        int capExtra = Math.max(0, input.capWeight() - 1);
        List<WeekProposalLineJson> lines = new ArrayList<>();
        for (Step step : steps) {
            TechniquePlanner.PlanRow r = step.row();
            UUID id = r.id();
            int from = sets.get(id);
            if (step.move() == Move.ADD && from < 2) continue;   // nothing to give back (never picked so)
            int to = from;
            Technique fromTechnique = switch (step.move()) {
                case ADD, CHANGE, REMOVE -> technique.get(id);
                case CHALLENGE_ON -> Technique.NONE;
                case CHALLENGE_OFF -> Technique.PARTIALS;
            };
            boolean challengeLine = step.move() == Move.CHALLENGE_ON || step.move() == Move.CHALLENGE_OFF;
            switch (step.move()) {
                case ADD -> {
                    to = from - 1;
                    technique.put(id, step.to());
                }
                case CHANGE -> technique.put(id, step.to());
                case REMOVE -> {
                    technique.put(id, Technique.NONE);
                    // weighed with the row's FINAL challenge state: it may become this week's challenge next
                    boolean challengeAfter = challenged.contains(id);
                    int weightAfter = from + 1 + (challengeAfter ? capExtra : 0);
                    if (r.effectiveStyle() != TrainingStyle.ALLOUT
                            && fitsOneMore(r, weightAfter, input, allRows, sets, extra, capExtra)) {
                        to = from + 1;
                    }
                }
                case CHALLENGE_ON -> challenge.put(id, true);
                case CHALLENGE_OFF -> challenge.put(id, false);
            }
            extra.put(id, technique.get(id) != Technique.NONE || challenge.get(id));
            sets.put(id, to);
            TemplatePlan.Row planRow = planById.get(id);
            lines.add(new WeekProposalLineJson(UUID.randomUUID().toString(), id, planRow.exercise().getName(),
                planRow.dayIndex(), lineGroup(planRow, r), WeekProposalLineJson.KIND_TECHNIQUE, from, to,
                step.reason() == null ? List.of() : List.of(step.reason()), null, planRow.dayName(), null, null,
                fromTechnique.wire(), step.to().wire(), challengeLine, null, null, null, null));
        }

        Map<UUID, Integer> after = new LinkedHashMap<>(working);
        planById.keySet().forEach(id -> {
            if (sets.containsKey(id)) after.put(id, sets.get(id));
        });
        return new Result(List.copyOf(lines), after);
    }

    /**
     * One more set on {@code row}, its cap weight then {@code rowWeightAfter}: within the exercise cap and, with the
     * other counting rows of its group that day, within the session cap.
     */
    private static boolean fitsOneMore(TechniquePlanner.PlanRow row, int rowWeightAfter, TechniquePlanner.Input in,
                                       List<TechniquePlanner.PlanRow> allRows, Map<UUID, Integer> sets,
                                       Map<UUID, Boolean> extra, int capExtra) {
        if (rowWeightAfter > in.exerciseCap()) return false;   // by cap weight, as SetSlots.pickUp
        if (row.group() == null) return true;
        int dayWeight = rowWeightAfter;
        for (TechniquePlanner.PlanRow r : allRows) {
            if (r.id().equals(row.id()) || r.dayIndex() != row.dayIndex() || !r.counts()
                    || !row.group().equals(r.group())) continue;
            dayWeight += sets.get(r.id()) + (extra.get(r.id()) ? capExtra : 0);
        }
        return dayWeight <= in.sessionCap();
    }

    /** The line's muscle group: the landmark group, else the planner's coarse group; null only without a muscle. */
    private static String lineGroup(TemplatePlan.Row planRow, TechniquePlanner.PlanRow r) {
        return planRow.group() != null ? planRow.group() : r.group();
    }

    /** Why a planner technique goes: the deficit's smaller allowance, else a sport day's, else emphasis moved. */
    private static String removalReason(TechniquePlanner.PlanRow r, TechniquePlanner.Input in,
                                        Map<Integer, Boolean> sportDay) {
        if (in.deficit()) return REASON_DEFICIT_ALLOWANCE;
        if (Boolean.TRUE.equals(sportDay.get(r.dayIndex()))) return REASON_SPORT_DAY;
        return TechniquePlanner.REASON_EMPHASIS;
    }

    /** The planner may write this row: no owner / AI source, and whatever it carries is the planner's own. */
    private static boolean plannerMay(TechniquePlanner.PlanRow r) {
        if ((hasTechnique(r) || r.challenge()) && !TechniquePlanner.SOURCE_PLANNER.equals(r.source())) return false;
        return !TechniquePlanner.SOURCE_OWNER.equals(r.source()) && !"ai".equals(r.source());
    }

    private static boolean hasTechnique(TechniquePlanner.PlanRow r) {
        return r.technique() != null && r.technique() != Technique.NONE;
    }
}
