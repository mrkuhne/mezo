package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import java.util.ArrayList;
import java.util.Collections;
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
 * isolation gets myo, a machine / cable exercise rest-drop, anything else none; (7) owner picks are kept as they
 * are and consume allowance first. Candidates are taken by tier, then latest day first, then latest exercise first —
 * so a muscle trained three times gets its technique on its two last days.
 *
 * <p>An accepted AI pick (source {@code ai}, T4 {@code mezo-r36n9.82}, owner decision 2026-11-19 "marad, amíg
 * szabályos") is kept like the owner's — after the owner's picks, before the planner's — but only while it is still
 * valid: eligible (rule 1), from the start week, within the day's and the muscle's allowance. An AI challenge is kept
 * while its row is still a challenge candidate. An AI pick that is no longer valid is simply not kept, so the
 * proposal's lines remove (or replace) it; the planner never flips a valid one back to its default.
 *
 * <p>The planner itself never puts a technique on the day's challenge row, but an owner / AI row carrying both
 * (allowed since mezo-r36n9.98) is kept as it is: its challenge is the day's challenge, its technique a pick that
 * consumes allowance.
 */
public final class TechniquePlanner {

    public static final String SOURCE_PLANNER = "planner";
    public static final String SOURCE_OWNER = "owner";
    public static final String SOURCE_AI = "ai";
    public static final String REASON_EMPHASIS = "emphasis";
    public static final String REASON_TECHNIQUE_WEEK = "technique_week";
    public static final String REASON_CHALLENGE = "challenge";
    public static final String REASON_AI_SUGGESTED = "ai_suggested";
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

    public static Week plan(Input input) {
        Input in = ordered(input);
        if (in.deloadWeek()) {
            return new Week(List.of(), List.of(), List.of(), zeroAllowance(in), Map.of());
        }
        List<Pick> challenges = new ArrayList<>();
        List<Warning> warnings = new ArrayList<>();
        Set<UUID> challengeIds = new HashSet<>();
        for (PlanDay day : in.days()) {
            List<Pick> ownerChallenges = day.rows().stream()
                .filter(r -> ownerChallenge(r) || (aiChallenge(r) && challengeValid(r, day, in)))
                .map(r -> new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), Technique.PARTIALS,
                    r.source() == null ? SOURCE_OWNER : r.source(), null))
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
                techniques.add(new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), r.technique(),
                    r.source() == null ? SOURCE_OWNER : r.source(), null));
                boolean groupFull = r.group() != null
                    && perGroup.getOrDefault(r.group(), 0) >= in.cfg().maxPerMuscleWeek();
                if (r.group() != null) perGroup.merge(r.group(), 1, Integer::sum);
                boolean dayFull = left <= 0;
                if (!dayFull) left--;
                if (dayFull || groupFull) {
                    warnings.add(new Warning(WARN_OWNER_OVER_ALLOWANCE, day.dayIndex(), r.exerciseIndex()));
                }
            }
            remaining.put(day.dayIndex(), left);
        }

        // T4: accepted AI picks, kept while still valid (after the owner's, before the planner's)
        Set<UUID> keptAi = new HashSet<>();
        if (in.week() >= in.cfg().startWeek()) {
            for (PlanDay day : in.days()) {
                for (PlanRow r : day.rows()) {
                    if (!aiHeld(r) || r.group() == null || tier(in, r.group()) == PriorityTier.MAINTAIN) continue;
                    if (!eligible(r, day, in, challengeIds.contains(r.id()), challengeIds)) continue;
                    if (remaining.get(day.dayIndex()) <= 0) continue;
                    if (perGroup.getOrDefault(r.group(), 0) >= in.cfg().maxPerMuscleWeek()) continue;
                    techniques.add(new Pick(r.dayIndex(), r.exerciseIndex(), r.id(), r.technique(), SOURCE_AI, null));
                    keptAi.add(r.id());
                    remaining.merge(day.dayIndex(), -1, Integer::sum);
                    perGroup.merge(r.group(), 1, Integer::sum);
                }
            }
        }

        if (in.week() >= in.cfg().startWeek()) {
            record Candidate(PlanRow row, PriorityTier tier, Technique technique) {}
            List<Candidate> candidates = new ArrayList<>();
            for (PlanDay day : in.days()) {
                for (PlanRow r : day.rows()) {
                    if (owned(r) || keptAi.contains(r.id())
                            || !eligible(r, day, in, challengeIds.contains(r.id()), challengeIds)) continue;
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

    /** Rule 1 against a given set of the day's challenge rows (the AI merger's moved challenges, T4). */
    static boolean eligible(PlanRow row, PlanDay day, Input in, Set<UUID> challengeIds) {
        return eligible(row, day, in, challengeIds.contains(row.id()), challengeIds);
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
            if (last == null || r.exerciseIndex() > last.exerciseIndex()) last = r;   // order-independent
            groupWeight += capWeightOf(r, challengeIds.contains(r.id()), in);
        }
        if (last == null || !last.id().equals(row.id())) return false;
        int withTechnique = plain - 1 + in.capWeight() - 1;   // one set given back, the technique set weighs capWeight
        int after = groupWeight - capWeightOf(row, false, in) + withTechnique;
        return withTechnique <= in.exerciseCap() && after <= in.sessionCap();
    }

    /** The row's set count without a machine technique: a planner- or AI-held row gave one set back for it. */
    private static int plainSets(PlanRow row) {
        return plannerHeld(row) || aiHeld(row) ? row.workingSets() + 1 : row.workingSets();
    }

    /**
     * What the row weighs against the caps as it stands: {@link TechniqueRules#capExtra} — its technique and its
     * challenge each add {@code capWeight - 1} (an owner row may carry both, mezo-r36n9.98).
     */
    private static int capWeightOf(PlanRow row, boolean isChallenge, Input in) {
        return row.workingSets() + TechniqueRules.capExtra(row.technique(), isChallenge, true, in.capWeight());
    }

    /** §6.6: the day's first stable + lengthened-friendly counting row, Hangsúly first, then Építés, then the rest. */
    private static Optional<PlanRow> challengeCandidate(PlanDay day, Input in) {
        return day.rows().stream()
            .filter(r -> challengeValid(r, day, in))
            .filter(r -> !owned(r))
            .min(Comparator.comparing((PlanRow r) -> tier(in, r.group()))
                .thenComparingInt(PlanRow::exerciseIndex));
    }

    /**
     * §6.6 on one row: it counts, it is stable and lengthened-friendly, and it is not a sport-loaded group on a
     * sport day. The AI may move the challenge only onto such a row (T4).
     */
    public static boolean challengeValid(PlanRow r, PlanDay day, Input in) {
        return r.counts() && r.attrs().stable() && r.attrs().lengthenedFriendly()
            && !(day.sportDay() && r.group() != null && in.sportGroups().contains(r.group()));
    }

    /** A row without a coarse group ranks with the rest (Tartás) and never gets a technique. */
    private static PriorityTier tier(Input in, String group) {
        return group == null ? PriorityTier.MAINTAIN : PriorityTier.of(in.priorities(), group);
    }

    static int allowance(PlanDay day, Input in) {
        return in.deficit() || day.sportDay() ? in.cfg().maxPerDayReduced() : in.cfg().maxPerDay();
    }

    private static Map<Integer, Integer> zeroAllowance(Input in) {
        Map<Integer, Integer> zero = new TreeMap<>();
        in.days().forEach(d -> zero.put(d.dayIndex(), 0));
        return unmodifiable(zero);
    }

    /**
     * An owner pick: never moved by the planner. A row carrying a technique or a challenge without any source counts
     * as owned too (only the machine's own picks are the machine's), as {@link TechniqueLines} reads it.
     */
    static boolean owned(PlanRow r) {
        if (SOURCE_OWNER.equals(r.source())) return true;
        return r.source() == null && (hasTechnique(r) || r.challenge());
    }

    /** A stored challenge the owner placed (owner or no source): it wins, the planner only moves the machine's. */
    private static boolean ownerChallenge(PlanRow r) {
        return r.challenge() && (r.source() == null || SOURCE_OWNER.equals(r.source()));
    }

    /** A stored challenge an accepted AI line placed (T4). */
    private static boolean aiChallenge(PlanRow r) {
        return r.challenge() && SOURCE_AI.equals(r.source());
    }

    /** A technique an accepted AI line placed (T4). */
    static boolean aiHeld(PlanRow r) {
        return SOURCE_AI.equals(r.source()) && hasTechnique(r);
    }

    /** Days by dayIndex, each day's rows by exerciseIndex — the rules never depend on the caller's order. */
    private static Input ordered(Input in) {
        List<PlanDay> days = in.days().stream()
            .sorted(Comparator.comparingInt(PlanDay::dayIndex))
            .map(d -> new PlanDay(d.dayIndex(), d.sportDay(),
                d.rows().stream().sorted(Comparator.comparingInt(PlanRow::exerciseIndex)).toList()))
            .toList();
        return new Input(in.week(), in.deloadWeek(), days, in.priorities(), in.sportGroups(), in.deficit(),
            in.exerciseCap(), in.sessionCap(), in.capWeight(), in.cfg());
    }

    private static boolean plannerHeld(PlanRow r) {
        return SOURCE_PLANNER.equals(r.source()) && hasTechnique(r);
    }

    private static boolean hasTechnique(PlanRow r) {
        return r.technique() != null && r.technique() != Technique.NONE;
    }

    private static <K, V> Map<K, V> unmodifiable(Map<K, V> m) {
        return Collections.unmodifiableMap(new LinkedHashMap<>(m));
    }
}
