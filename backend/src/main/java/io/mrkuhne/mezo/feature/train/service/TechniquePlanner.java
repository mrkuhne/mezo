package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * The default technique planner (mezo-r36n9.81, spec §6.5 / §6.6). Pure and deterministic: one block week in,
 * which exercise carries which technique, each day's challenge and the evaluator warnings out.
 *
 * <p>Rules: (1) eligible = stable, counts, the last counting exercise of its group that day, at least 2 working
 * sets, not the day's challenge, not all-out, not already over a cap, not a sport-loaded group on a sport day;
 * (2) techniques from {@code startWeek} on, nothing at all in a deload week (challenges every other week);
 * (3) Hangsúly groups first, then Építés, Tartás never; (4) per day {@code maxPerDay}, {@code maxPerDayReduced} in a
 * deficit or on a sport day, and {@code maxPerMuscleWeek} technique exercises per group a week; (5) a high-rep
 * isolation gets myo, a machine / cable exercise rest-drop, anything else none; (7) owner / AI picks are kept as
 * they are and consume allowance first. Candidates are taken by tier, then latest day first, then latest exercise
 * first — so a muscle trained three times gets its technique on its two last days.
 */
public final class TechniquePlanner {

    public static final String SOURCE_PLANNER = "planner";
    public static final String REASON_EMPHASIS = "emphasis";
    public static final String REASON_TECHNIQUE_WEEK = "technique_week";
    public static final String REASON_CHALLENGE = "challenge";
    public static final String WARN_OWNER_OVER_ALLOWANCE = "owner_over_allowance";
    public static final String WARN_NO_CHALLENGE_CANDIDATE = "no_challenge_candidate";

    private TechniquePlanner() {}

    /**
     * One exercise row of the plan week. {@code workingSets} is the row's current count — for a row that already
     * carries a planner technique it is the reduced count (the set it gave back is added back for rule 1).
     * {@code source} is the stored technique source ({@code owner}, {@code ai}, {@code planner} or null).
     */
    public record PlanRow(int dayIndex, int exerciseIndex, UUID id, String group, boolean counts, int workingSets,
                          String type, Integer repMax, CatalogAttributes.Attrs attrs, TrainingStyle effectiveStyle,
                          Technique technique, String source, boolean challenge) {}

    /** One training day of the week; {@code sportDay} = its weekday has a sport slot. */
    public record PlanDay(int dayIndex, boolean sportDay, List<PlanRow> rows) {}

    /** The week to plan: the caps are the exercise / session caps, {@code capWeight} a technique set's weight. */
    public record Input(int week, boolean deloadWeek, List<PlanDay> days, Map<String, String> priorities,
                        Set<String> sportGroups, boolean deficit, int exerciseCap, int sessionCap, int capWeight,
                        TrainTechniqueProperties.Planner cfg) {}

    /** A technique or challenge on one row; {@code source} planner / owner / ai, {@code reason} null for owner picks. */
    public record Pick(int dayIndex, int exerciseIndex, UUID id, Technique technique, String source, String reason) {}

    /** An evaluator warning; {@code exerciseIndex} null for a day-level warning. */
    public record Warning(String code, int dayIndex, Integer exerciseIndex) {}

    /**
     * The planned week. {@code remainingByDay}: technique allowance left per day index after every pick (0 before
     * the start week); {@code perGroup}: technique exercises per group this week (owner + planner).
     */
    public record Week(List<Pick> techniques, List<Pick> challenges, List<Warning> warnings,
                       Map<Integer, Integer> remainingByDay, Map<String, Integer> perGroup) {}

    private static final Comparator<Pick> BY_POSITION =
        Comparator.comparingInt(Pick::dayIndex).thenComparingInt(Pick::exerciseIndex);

    public static Week plan(Input in) {
        if (in.deloadWeek()) {
            return new Week(List.of(), List.of(), List.of(), zeroAllowance(in), Map.of());
        }
        List<Pick> challenges = new ArrayList<>();
        List<Warning> warnings = new ArrayList<>();
        Set<UUID> challengeIds = new HashSet<>();
        for (PlanDay day : in.days()) {
            List<Pick> ownerChallenges = day.rows().stream().filter(r -> r.challenge() && owned(r))
                .map(r -> new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), Technique.PARTIALS, r.source(), null))
                .toList();
            if (!ownerChallenges.isEmpty()) {
                challenges.addAll(ownerChallenges);
                ownerChallenges.forEach(p -> challengeIds.add(p.id()));
                continue;
            }
            Optional<PlanRow> candidate = challengeCandidate(day, in);
            if (candidate.isPresent()) {
                PlanRow r = candidate.get();
                challenges.add(new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), Technique.PARTIALS, SOURCE_PLANNER,
                    REASON_CHALLENGE));
                challengeIds.add(r.id());
            } else if (day.rows().stream().anyMatch(PlanRow::counts)) {
                warnings.add(new Warning(WARN_NO_CHALLENGE_CANDIDATE, day.dayIndex(), null));
            }
        }

        List<Pick> techniques = new ArrayList<>();
        Map<Integer, Integer> remaining = new TreeMap<>();
        Map<String, Integer> perGroup = new TreeMap<>();
        for (PlanDay day : in.days()) {
            int left = allowance(day, in);
            for (PlanRow r : day.rows()) {
                if (!owned(r) || !hasTechnique(r)) continue;
                techniques.add(new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), r.technique(), r.source(), null));
                if (r.group() != null) perGroup.merge(r.group(), 1, Integer::sum);
                if (left > 0) {
                    left--;
                } else {
                    warnings.add(new Warning(WARN_OWNER_OVER_ALLOWANCE, day.dayIndex(), r.exerciseIndex()));
                }
            }
            remaining.put(day.dayIndex(), left);
        }

        if (in.week() >= in.cfg().startWeek()) {
            record Candidate(PlanRow row, PriorityTier tier, Technique technique) {}
            List<Candidate> candidates = new ArrayList<>();
            for (PlanDay day : in.days()) {
                for (PlanRow r : day.rows()) {
                    if (owned(r) || !eligible(r, day, in, challengeIds.contains(r.id()), challengeIds)) continue;
                    PriorityTier tier = tier(in, r.group());
                    if (tier == PriorityTier.MAINTAIN) continue;
                    defaultTechnique(r, in.cfg()).ifPresent(t -> candidates.add(new Candidate(r, tier, t)));
                }
            }
            candidates.sort(Comparator.comparing((Candidate c) -> c.tier())
                .thenComparing(c -> c.row().dayIndex(), Comparator.reverseOrder())
                .thenComparing(c -> c.row().exerciseIndex(), Comparator.reverseOrder()));
            for (Candidate c : candidates) {
                PlanRow r = c.row();
                if (remaining.get(r.dayIndex()) <= 0) continue;
                if (perGroup.getOrDefault(r.group(), 0) >= in.cfg().maxPerMuscleWeek()) continue;
                techniques.add(new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), c.technique(), SOURCE_PLANNER,
                    c.tier() == PriorityTier.EMPHASIZE ? REASON_EMPHASIS : REASON_TECHNIQUE_WEEK));
                remaining.merge(r.dayIndex(), -1, Integer::sum);
                perGroup.merge(r.group(), 1, Integer::sum);
            }
        } else {
            remaining.replaceAll((d, n) -> 0);
        }

        techniques.sort(BY_POSITION);
        challenges.sort(BY_POSITION);
        return new Week(List.copyOf(techniques), List.copyOf(challenges), List.copyOf(warnings),
            unmodifiable(remaining), unmodifiable(perGroup));
    }

    /**
     * Rule 5 + the kind part of rules 1 and 6: myo for a stable isolation whose rep max reaches {@code myoRepTop},
     * otherwise rest-drop for a stable machine / cable exercise; empty for a free or all-out row or anything else
     * (e.g. a stable dumbbell compound). {@code drop} and {@code partials} are never the planner's choice.
     */
    public static Optional<Technique> defaultTechnique(PlanRow row, TrainTechniqueProperties.Planner cfg) {
        if (!row.attrs().stable() || row.effectiveStyle() == TrainingStyle.ALLOUT) return Optional.empty();
        if ("isolation".equals(row.type()) && row.repMax() != null && row.repMax() >= cfg.myoRepTop()) {
            return Optional.of(Technique.MYO);
        }
        String equipment = row.attrs().equipment();
        if ("machine".equals(equipment) || "cable".equals(equipment)) return Optional.of(Technique.REST_DROP);
        return Optional.empty();
    }

    /**
     * Rule 1 against the stored rows: the row's own {@code challenge} flag marks the day's challenge. The day's cap
     * check weighs every row that carries a technique or challenge at {@code capWeight}.
     */
    public static boolean eligible(PlanRow row, PlanDay day, Input in) {
        Set<UUID> challengeIds = new HashSet<>();
        day.rows().stream().filter(PlanRow::challenge).forEach(r -> challengeIds.add(r.id()));
        return eligible(row, day, in, row.challenge(), challengeIds);
    }

    private static boolean eligible(PlanRow row, PlanDay day, Input in, boolean isChallenge, Set<UUID> challengeIds) {
        if (!row.counts() || row.group() == null || isChallenge || !row.attrs().stable()) return false;
        if (row.effectiveStyle() == TrainingStyle.ALLOUT) return false;
        if (day.sportDay() && in.sportGroups().contains(row.group())) return false;
        int plain = plainSets(row);
        if (plain < 2) return false;
        PlanRow last = null;
        int groupWeight = 0;
        for (PlanRow r : day.rows()) {
            if (!r.counts() || !row.group().equals(r.group())) continue;
            last = r;
            groupWeight += capWeightOf(r, challengeIds.contains(r.id()), in);
        }
        if (last == null || !last.id().equals(row.id())) return false;
        int withTechnique = plain - 1 + in.capWeight() - 1;   // one set given back, the technique set weighs capWeight
        int after = groupWeight - capWeightOf(row, false, in) + withTechnique;
        return withTechnique <= in.exerciseCap() && after <= in.sessionCap();
    }

    /** The row's set count without a planner technique: a planner-held row gave one set back for it. */
    private static int plainSets(PlanRow row) {
        return plannerHeld(row) ? row.workingSets() + 1 : row.workingSets();
    }

    /** What the row weighs against the caps as it stands (a technique or challenge set weighs capWeight). */
    private static int capWeightOf(PlanRow row, boolean isChallenge, Input in) {
        boolean extra = hasTechnique(row) || isChallenge;
        return row.workingSets() + (extra ? Math.max(0, in.capWeight() - 1) : 0);
    }

    /** §6.6: the day's first stable + lengthened-friendly counting row, Hangsúly first, then Építés, then the rest. */
    private static Optional<PlanRow> challengeCandidate(PlanDay day, Input in) {
        return day.rows().stream()
            .filter(r -> r.counts() && r.attrs().stable() && r.attrs().lengthenedFriendly())
            .filter(r -> !(owned(r) && hasTechnique(r)))
            .filter(r -> !(day.sportDay() && r.group() != null && in.sportGroups().contains(r.group())))
            .min(Comparator.comparing((PlanRow r) -> tier(in, r.group()))
                .thenComparingInt(PlanRow::exerciseIndex));
    }

    /** A row without a coarse group ranks with the rest (Tartás) and never gets a technique. */
    private static PriorityTier tier(Input in, String group) {
        return group == null ? PriorityTier.MAINTAIN : PriorityTier.of(in.priorities(), group);
    }

    private static int allowance(PlanDay day, Input in) {
        return in.deficit() || day.sportDay() ? in.cfg().maxPerDayReduced() : in.cfg().maxPerDay();
    }

    private static Map<Integer, Integer> zeroAllowance(Input in) {
        Map<Integer, Integer> zero = new TreeMap<>();
        in.days().forEach(d -> zero.put(d.dayIndex(), 0));
        return unmodifiable(zero);
    }

    private static boolean owned(PlanRow r) {
        return "owner".equals(r.source()) || "ai".equals(r.source());
    }

    private static boolean plannerHeld(PlanRow r) {
        return SOURCE_PLANNER.equals(r.source()) && hasTechnique(r);
    }

    private static boolean hasTechnique(PlanRow r) {
        return r.technique() != null && r.technique() != Technique.NONE;
    }

    private static <K, V> Map<K, V> unmodifiable(Map<K, V> m) {
        return java.util.Collections.unmodifiableMap(new LinkedHashMap<>(m));
    }
}
