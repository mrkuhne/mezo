package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Deterministic ranking of swap suggestions for an outgoing exercise (spec 2026-11-17 §6.2
 * „How suggestions are chosen", mezo-r36n9.66). Pure — catalogue rows, the user's feedback and
 * equipment come in as {@link Candidate}s. No exercise is "the best": the order only reflects how
 * well a candidate fits this slot, this goal and today's body.
 *
 * <p>Candidates: same primary muscle, not in today's workout, not the outgoing one; below three
 * survivors the pool widens to the same {@code pattern} within the same body region (widened rows
 * always rank after every same-muscle row). Left out
 * (labelled for the full list): unavailable equipment → {@link Label#NO_EQUIPMENT}, a recent
 * {@link PainLevel#STRONG} → {@link Label#HURT_BEFORE}; plyometrics unless the outgoing is plyo
 * (no label). Order is lexicographic over tiers: role → discomfort → goal → trackability, then
 * {@code lengthened}, then the candidate's position in the pool.
 */
public final class ExerciseSubstituteRanker {

    private ExerciseSubstituteRanker() {}

    public static final int MAX_SUGGESTIONS = 5;
    static final int WIDEN_BELOW = 3;
    private static final double MAX_RATIO = 99.0;

    /** A catalogue exercise with the user's state on it. Custom rows carry null attributes. */
    public record Candidate(UUID id, String muscle, String type, List<String> equipment, String pattern,
                            List<String> secondaryMuscles, List<String> joints, Boolean lengthened, String demand,
                            BigDecimal stim, BigDecimal fatigue, boolean custom,
                            boolean available, PainLevel pain, boolean doneBefore) {}

    /** The running block's goal preset (nullable), the swap's „nem esik jól", today's pain joints. */
    public record Context(String goalPreset, boolean soreNow, Set<String> painJointsToday, Set<UUID> inWorkout) {}

    /** Stable codes of what put a suggestion where it is; {@link SubstituteReason} renders them. */
    public enum Signal {
        SAME_ROLE, OTHER_TYPE, SPARES_JOINT, GUIDED, MILD_BEFORE, PAIN_TODAY, GOAL_HYPERTROPHY,
        GOAL_STRENGTH, GOAL_LOW_FATIGUE, LENGTHENED, DONE_BEFORE, NO_EQUIPMENT, HAS_EQUIPMENT, CUSTOM
    }

    /** The quiet label a left-out exercise carries in the full catalogue list. */
    public enum Label { NO_EQUIPMENT, HURT_BEFORE }

    public record Ranked(UUID id, List<Signal> signals) {}

    public record Result(List<Ranked> suggestions, Map<UUID, Label> labels) {}

    enum Goal { HYPERTROPHY, STRENGTH, LOW_FATIGUE }

    /** Lexicographic score; every field compares "higher is better" except {@code index}. */
    private record Scored(Candidate c, int index, int role, int discomfort, double goal, int track, int lengthened) {}

    private static final Comparator<Scored> ORDER = Comparator
        .comparingInt(Scored::role).reversed()
        .thenComparing(Comparator.comparingInt(Scored::discomfort).reversed())
        .thenComparing(Comparator.comparingDouble(Scored::goal).reversed())
        .thenComparing(Comparator.comparingInt(Scored::track).reversed())
        .thenComparing(Comparator.comparingInt(Scored::lengthened).reversed())
        .thenComparingInt(Scored::index);

    public static Result rank(Candidate out, List<Candidate> pool, Context ctx) {
        Set<UUID> inWorkout = ctx.inWorkout() == null ? Set.of() : ctx.inWorkout();
        Set<String> painJoints = ctx.painJointsToday() == null ? Set.of() : ctx.painJointsToday();
        Goal goal = goal(ctx.goalPreset());

        Map<UUID, Label> labels = new LinkedHashMap<>();
        for (Candidate c : pool) {
            if (!c.available()) {
                labels.put(c.id(), Label.NO_EQUIPMENT);
            } else if (c.pain() == PainLevel.STRONG) {
                labels.put(c.id(), Label.HURT_BEFORE);
            }
        }

        List<Scored> picked = new ArrayList<>();
        for (int i = 0; i < pool.size(); i++) {
            Candidate c = pool.get(i);
            if (Objects.equals(c.muscle(), out.muscle()) && eligible(out, c, inWorkout, labels)) {
                picked.add(score(out, c, i, ctx.soreNow(), painJoints, goal));
            }
        }
        if (picked.size() < WIDEN_BELOW && out.pattern() != null) {
            String region = region(out.muscle());
            for (int i = 0; i < pool.size(); i++) {
                Candidate c = pool.get(i);
                if (!Objects.equals(c.muscle(), out.muscle()) && out.pattern().equals(c.pattern())
                    && region != null && region.equals(region(c.muscle())) && eligible(out, c, inWorkout, labels)) {
                    picked.add(score(out, c, i, ctx.soreNow(), painJoints, goal));
                }
            }
        }

        // Today's pain only explains a place when some joint in play actually loads it.
        boolean painRelevant = hitsPainToday(out, painJoints)
            || picked.stream().anyMatch(s -> hitsPainToday(s.c(), painJoints));
        List<Ranked> suggestions = picked.stream().sorted(ORDER).limit(MAX_SUGGESTIONS)
            .map(s -> new Ranked(s.c().id(), signals(out, s.c(), ctx.soreNow(), painRelevant, painJoints, goal)))
            .toList();
        return new Result(suggestions, Map.copyOf(labels));
    }

    /** null / unknown / sport / erohipertrofia → hypertrophy; cut-prep and recovery → low fatigue. */
    static Goal goal(String preset) {
        if ("strength".equals(preset)) {
            return Goal.STRENGTH;
        }
        if ("cut-prep".equals(preset) || "recovery".equals(preset)) {
            return Goal.LOW_FATIGUE;
        }
        return Goal.HYPERTROPHY;
    }

    /** Body region = the muscle token before the first '-' (back-mid → back; quad → quad). */
    static String region(String muscle) {
        if (muscle == null) {
            return null;
        }
        int dash = muscle.indexOf('-');
        return dash < 0 ? muscle : muscle.substring(0, dash);
    }

    private static boolean eligible(Candidate out, Candidate c, Set<UUID> inWorkout, Map<UUID, Label> labels) {
        if (Objects.equals(c.id(), out.id()) || inWorkout.contains(c.id()) || labels.containsKey(c.id())) {
            return false;
        }
        return !"plyo".equals(c.type()) || "plyo".equals(out.type());
    }

    private static Scored score(Candidate out, Candidate c, int index, boolean soreNow, Set<String> painJoints,
                                Goal goal) {
        // Role: same muscle (widened rows only fill the list) ≫ same type ≫ attributed over custom
        // ≫ same pattern ≫ secondary-muscle overlap (≤9).
        int role = (Objects.equals(c.muscle(), out.muscle()) ? 10_000 : 0) + (sameType(out, c) ? 1000 : 0) + (c.custom() ? 0 : 100)
            + (samePattern(out, c) ? 10 : 0) + Math.min(9, overlap(out.secondaryMuscles(), c.secondaryMuscles()));

        // Discomfort: each hit costs 10; with a discomfort context gentleness (≤3) lifts.
        int hits = (c.pain() == PainLevel.MILD ? 1 : 0)
            + (hitsPainToday(c, painJoints) ? 1 : 0)
            + (soreNow && sharesJoint(out, c) ? 1 : 0);
        int discomfort = -10 * hits + (soreNow || !painJoints.isEmpty() ? gentleness(c) : 0);

        return new Scored(c, index, role, discomfort, goalScore(out, c, goal), c.doneBefore() ? 1 : 0,
            Boolean.TRUE.equals(c.lengthened()) ? 1 : 0);
    }

    /** Hypertrophy: stable/easy to load (0–3) ≫ stimulus per fatigue · strength: free-weight
     *  compound of the same pattern ≫ free weight · low fatigue: lower fatigue. */
    private static double goalScore(Candidate out, Candidate c, Goal goal) {
        return switch (goal) {
            case HYPERTROPHY -> 100.0 * gentleness(c) + ratio(c);
            case STRENGTH -> (strengthFit(out, c) ? 2 : 0) + (freeWeight(c) ? 1 : 0);
            case LOW_FATIGUE -> c.fatigue() == null ? -1.0 : -c.fatigue().doubleValue();
        };
    }

    /** Role signal first, then the one signal that best explains the place (see the spec §6.2 step 4). */
    private static List<Signal> signals(Candidate out, Candidate c, boolean soreNow, boolean painRelevant,
                                        Set<String> painJoints, Goal goal) {
        Signal role = sameType(out, c) ? Signal.SAME_ROLE : Signal.OTHER_TYPE;
        Signal second = secondSignal(out, c, soreNow, painRelevant, painJoints, goal);
        return second == null ? List.of(role) : List.of(role, second);
    }

    private static Signal secondSignal(Candidate out, Candidate c, boolean soreNow, boolean painRelevant,
                                       Set<String> painJoints, Goal goal) {
        if (c.custom()) {
            return Signal.CUSTOM;
        }
        if (c.pain() == PainLevel.MILD) {
            return Signal.MILD_BEFORE;
        }
        if (painRelevant && !hitsPainToday(c, painJoints)) {
            return Signal.PAIN_TODAY;
        }
        // Without the outgoing exercise's joints (custom) „spares" is a claim we cannot know.
        boolean outJointsKnown = out.joints() != null && !out.joints().isEmpty();
        if (soreNow && outJointsKnown && !sharesJoint(out, c)) {
            return Signal.SPARES_JOINT;
        }
        if ((soreNow || painRelevant) && guided(c)) {
            return Signal.GUIDED;
        }
        switch (goal) {
            case HYPERTROPHY -> {
                if (guided(c) || "low".equals(c.demand())) {
                    return Signal.GOAL_HYPERTROPHY;
                }
                if (Boolean.TRUE.equals(c.lengthened())) {
                    return Signal.LENGTHENED;
                }
            }
            case STRENGTH -> {
                if (strengthFit(out, c)) {
                    return Signal.GOAL_STRENGTH;
                }
            }
            case LOW_FATIGUE -> {
                if (lessTiring(out, c)) {
                    return Signal.GOAL_LOW_FATIGUE;
                }
            }
        }
        if (c.doneBefore()) {
            return Signal.DONE_BEFORE;
        }
        if (c.equipment() != null && !c.equipment().isEmpty()) {
            return c.equipment().stream().allMatch("bodyweight"::equals) ? Signal.NO_EQUIPMENT : Signal.HAS_EQUIPMENT;
        }
        return null;
    }

    private static boolean sameType(Candidate out, Candidate c) {
        return out.type() != null && out.type().equals(c.type());
    }

    private static boolean samePattern(Candidate out, Candidate c) {
        return out.pattern() != null && out.pattern().equals(c.pattern());
    }

    private static int overlap(Collection<String> a, Collection<String> b) {
        if (a == null || b == null) {
            return 0;
        }
        return (int) a.stream().distinct().filter(b::contains).count();
    }

    private static boolean hitsPainToday(Candidate c, Set<String> painJoints) {
        return overlap(painJoints, c.joints()) > 0;
    }

    private static boolean sharesJoint(Candidate out, Candidate c) {
        return overlap(out.joints(), c.joints()) > 0;
    }

    private static boolean has(Candidate c, String... kinds) {
        if (c.equipment() == null) {
            return false;
        }
        for (String k : kinds) {
            if (c.equipment().contains(k)) {
                return true;
            }
        }
        return false;
    }

    private static boolean guided(Candidate c) {
        return has(c, "machine", "cable", "smith");
    }

    private static boolean freeWeight(Candidate c) {
        return has(c, "barbell", "dumbbell", "kettlebell");
    }

    private static boolean strengthFit(Candidate out, Candidate c) {
        return freeWeight(c) && "compound".equals(c.type()) && samePattern(out, c);
    }

    /** Guided equipment +1, demand low +2 / medium +1 / high or unknown 0. */
    private static int gentleness(Candidate c) {
        int demand = "low".equals(c.demand()) ? 2 : "medium".equals(c.demand()) ? 1 : 0;
        return (guided(c) ? 1 : 0) + demand;
    }

    private static double ratio(Candidate c) {
        if (c.stim() == null || c.fatigue() == null || c.fatigue().signum() <= 0) {
            return 0.0;
        }
        // Clamped below one stability step, so a near-zero fatigue never outweighs stability.
        return Math.min(MAX_RATIO, c.stim().doubleValue() / c.fatigue().doubleValue());
    }

    private static boolean lessTiring(Candidate out, Candidate c) {
        if (c.fatigue() == null) {
            return false;
        }
        double ref = out.fatigue() == null ? 0.5 : out.fatigue().doubleValue();
        return c.fatigue().doubleValue() < ref;
    }
}
