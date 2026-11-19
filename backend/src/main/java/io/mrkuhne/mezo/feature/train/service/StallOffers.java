package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.json.RestoreEntryJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * The stall offers of the weekly proposal (mezo-r36n9.81, spec §6.7.4 / §11 Q5). Pure. For each stalled muscle
 * group, in group-name order, the FIRST offer that applies:
 *
 * <ol>
 *   <li><b>technique</b> — a planner pick already on the group this week answers it (its reason becomes
 *       {@code stalled}); else the group's latest rule-1-eligible row (by day, then exercise, from the end) with a
 *       default technique, while its day's allowance and the group's weekly cap have room, gets a planner pick with
 *       reason {@code stalled}. Any tier, Tartás included;</li>
 *   <li><b>rep range</b> — the group's latest counting row (same order) that is heavy, balanced or volume (never
 *       all-out) and carries no {@code repRange} override moves one step along heavy → balanced, volume → balanced,
 *       balanced → volume: a {@code rep_range} line with the style table's range for its class. A row already in
 *       that range (or one without a stored rep range) is skipped. The line's group is the landmark group, else
 *       the row's coarse group. Any tier;</li>
 *   <li><b>one-week reduction</b> — only for a HOLD / NONE decision outside Tartás, and not in a week whose restore
 *       gave the group sets back (no ratchet): {@link SetSlots#pickDown} over
 *       the group's rows without a technique or challenge (stored or picked this week) gives one set, with a
 *       {@link RestoreEntryJson} so next week's restore gives it back.</li>
 * </ol>
 * The caller turns the augmented week into technique lines ({@link TechniqueLines}) and applies the reductions as
 * set lines on its working copy.
 */
final class StallOffers {

    static final String REASON_STALLED = VolumeDecider.Reason.STALLED.name().toLowerCase(Locale.ROOT);
    private static final String OVERRIDE_REP_RANGE = "repRange";

    private StallOffers() {}

    /**
     * A stalled group's weekly set decision, its tier, and whether this week's restore gave sets back to it (then
     * no reduction: taking the given-back set again would cancel the restore and ratchet the group down).
     */
    record Decision(Lever lever, PriorityTier tier, boolean restoredThisWeek) {}

    /** One set given up for a week on {@code exerciseId}; {@code restore} is next week's give-back. */
    record Reduction(UUID exerciseId, int from, int to, RestoreEntryJson restore) {}

    /** The week with the technique offers added, the rep-range lines and the reductions. */
    record Result(TechniquePlanner.Week week, List<WeekProposalLineJson> repRangeLines, List<Reduction> reductions) {}

    private static final Comparator<TechniquePlanner.PlanRow> LATEST_FIRST =
        Comparator.comparingInt(TechniquePlanner.PlanRow::dayIndex).reversed()
            .thenComparing(Comparator.comparingInt(TechniquePlanner.PlanRow::exerciseIndex).reversed());

    /**
     * @param stalled the stalled groups (with a weekly decision) and their decision
     * @param plan    the run's counting template rows — only these get an offer
     * @param input   the planner input the week was planned from
     * @param week    the planned week
     * @param working the proposal's working copy of sets
     */
    static Result offers(Map<String, Decision> stalled, List<TemplatePlan.Row> plan, TechniquePlanner.Input input,
                         TechniquePlanner.Week week, Map<UUID, Integer> working, TrainStyleProperties props) {
        Map<UUID, TemplatePlan.Row> planById = new HashMap<>();
        plan.forEach(r -> planById.put(r.exercise().getId(), r));
        Map<UUID, TechniquePlanner.PlanDay> dayOf = new HashMap<>();
        Map<String, List<TechniquePlanner.PlanRow>> rowsByGroup = new HashMap<>();
        for (TechniquePlanner.PlanDay day : input.days()) {
            for (TechniquePlanner.PlanRow r : day.rows()) {
                if (!r.counts() || r.group() == null || !planById.containsKey(r.id())) continue;
                dayOf.put(r.id(), day);
                rowsByGroup.computeIfAbsent(r.group(), k -> new ArrayList<>()).add(r);
            }
        }
        rowsByGroup.values().forEach(rows -> rows.sort(LATEST_FIRST));

        List<TechniquePlanner.Pick> techniques = new ArrayList<>(week.techniques());
        Map<Integer, Integer> remaining = new TreeMap<>(week.remainingByDay());
        Map<String, Integer> perGroup = new TreeMap<>(week.perGroup());
        Set<UUID> challenged = new HashSet<>();
        week.challenges().forEach(p -> challenged.add(p.id()));
        List<WeekProposalLineJson> rangeLines = new ArrayList<>();
        List<Reduction> reductions = new ArrayList<>();

        for (Map.Entry<String, Decision> entry : new TreeMap<>(stalled).entrySet()) {
            String group = entry.getKey();
            List<TechniquePlanner.PlanRow> rows = rowsByGroup.getOrDefault(group, List.of());
            if (rows.isEmpty()) continue;
            if (techniqueOffer(group, rows, dayOf, input, techniques, remaining, perGroup, challenged)) continue;
            Optional<WeekProposalLineJson> range = rangeOffer(rows, planById, props);
            if (range.isPresent()) {
                rangeLines.add(range.get());
                continue;
            }
            Decision d = entry.getValue();
            if ((d.lever() == Lever.HOLD || d.lever() == Lever.NONE) && d.tier() != PriorityTier.MAINTAIN
                    && !d.restoredThisWeek()) {
                reductionOffer(rows, planById, working, techniques, challenged).ifPresent(reductions::add);
            }
        }

        techniques.sort(Comparator.comparingInt(TechniquePlanner.Pick::dayIndex)
            .thenComparingInt(TechniquePlanner.Pick::exerciseIndex));
        TechniquePlanner.Week augmented = new TechniquePlanner.Week(List.copyOf(techniques), week.challenges(),
            week.warnings(), unmodifiable(remaining), unmodifiable(perGroup));
        return new Result(augmented, List.copyOf(rangeLines), List.copyOf(reductions));
    }

    /** (a): relabel the group's latest planner pick, else add one where rule 1 and the allowance allow. */
    private static boolean techniqueOffer(String group, List<TechniquePlanner.PlanRow> rows,
                                          Map<UUID, TechniquePlanner.PlanDay> dayOf, TechniquePlanner.Input input,
                                          List<TechniquePlanner.Pick> techniques, Map<Integer, Integer> remaining,
                                          Map<String, Integer> perGroup, Set<UUID> challenged) {
        for (TechniquePlanner.PlanRow r : rows) {   // latest first
            for (int i = 0; i < techniques.size(); i++) {
                TechniquePlanner.Pick p = techniques.get(i);
                if (p.id().equals(r.id()) && TechniqueLines.machine(p.source())) {
                    techniques.set(i, new TechniquePlanner.Pick(p.dayIndex(), p.exerciseIndex(), p.id(),
                        p.technique(), p.source(), REASON_STALLED));
                    return true;
                }
            }
        }
        if (input.week() < input.cfg().startWeek()) return false;   // rule 2: no technique before the start week
        if (perGroup.getOrDefault(group, 0) >= input.cfg().maxPerMuscleWeek()) return false;
        for (TechniquePlanner.PlanRow r : rows) {
            if (!plannerMay(r) || challenged.contains(r.id())) continue;
            if (remaining.getOrDefault(r.dayIndex(), 0) <= 0) continue;
            if (!TechniquePlanner.eligible(r, dayOf.get(r.id()), input)) continue;
            Optional<Technique> technique = TechniquePlanner.defaultTechnique(r, input.cfg());
            if (technique.isEmpty()) continue;
            techniques.add(new TechniquePlanner.Pick(r.dayIndex(), r.exerciseIndex(), r.id(), technique.get(),
                TechniquePlanner.SOURCE_PLANNER, REASON_STALLED));
            remaining.merge(r.dayIndex(), -1, Integer::sum);
            perGroup.merge(group, 1, Integer::sum);
            return true;
        }
        return false;
    }

    /** (b): one step along heavy ↔ balanced ↔ volume on the group's latest row that can take it. */
    private static Optional<WeekProposalLineJson> rangeOffer(List<TechniquePlanner.PlanRow> rows,
                                                            Map<UUID, TemplatePlan.Row> planById,
                                                            TrainStyleProperties props) {
        for (TechniquePlanner.PlanRow r : rows) {
            TrainingStyle next = nextStyle(r.effectiveStyle());
            if (next == null) continue;
            TemplatePlan.Row planRow = planById.get(r.id());
            ExerciseEntity e = planRow.exercise();
            if (e.getOverrides() != null && e.getOverrides().contains(OVERRIDE_REP_RANGE)) continue;
            if (e.getRepMin() == null || e.getRepMax() == null) continue;   // the line's from range is required
            boolean stable = r.attrs().stable();
            ExerciseClass cls = ExerciseClass.of(r.type(), stable);
            if (cls == null) continue;
            StyleTable.Stamp stamp = StyleTable.stamp(next, cls, stable, StyleStamper.legs(cls, e.getMuscle()), props);
            if (Objects.equals(e.getRepMin(), stamp.repMin()) && Objects.equals(e.getRepMax(), stamp.repMax())) {
                continue;
            }
            return Optional.of(new WeekProposalLineJson(UUID.randomUUID().toString(), r.id(), e.getName(),
                planRow.dayIndex(), planRow.group() != null ? planRow.group() : r.group(),
                WeekProposalLineJson.KIND_REP_RANGE, e.getRepMax(),
                stamp.repMax(), List.of(REASON_STALLED), null, planRow.dayName(), null, null, null, null, null,
                e.getRepMin(), e.getRepMax(), stamp.repMin(), stamp.repMax()));
        }
        return Optional.empty();
    }

    /** Away from where it stalled: heavy → balanced, volume → balanced, balanced → volume; all-out / none → null. */
    private static TrainingStyle nextStyle(TrainingStyle style) {
        if (style == null) return null;
        return switch (style) {
            case HEAVY, VOLUME -> TrainingStyle.BALANCED;
            case BALANCED -> TrainingStyle.VOLUME;
            case ALLOUT -> null;
        };
    }

    /** (c): one set off the group's plain row with the most sets. */
    private static Optional<Reduction> reductionOffer(List<TechniquePlanner.PlanRow> rows,
                                                      Map<UUID, TemplatePlan.Row> planById, Map<UUID, Integer> working,
                                                      List<TechniquePlanner.Pick> techniques, Set<UUID> challenged) {
        Set<UUID> picked = new HashSet<>();
        techniques.forEach(p -> picked.add(p.id()));
        List<SetSlots.Slot> slots = rows.stream()
            .filter(r -> !hasTechnique(r) && !r.challenge() && !picked.contains(r.id()) && !challenged.contains(r.id()))
            .sorted(Comparator.comparingInt(TechniquePlanner.PlanRow::dayIndex)
                .thenComparingInt(TechniquePlanner.PlanRow::exerciseIndex))
            .map(r -> SetSlots.Slot.of(r.id(), r.dayIndex(), working.getOrDefault(r.id(), r.workingSets()),
                planById.get(r.id()).capExtra()))
            .toList();
        return SetSlots.pickDown(slots).map(id -> {
            TemplatePlan.Row row = planById.get(id);
            int from = working.getOrDefault(id, row.exercise().getWorkingSets());
            return new Reduction(id, from, from - 1, new RestoreEntryJson(id, row.exercise().getCatalogId(),
                row.exercise().getName(), row.dayIndex(), from, from - 1));
        });
    }

    /** The planner may place a technique here: no owner source, and anything it carries is the machine's (T4). */
    private static boolean plannerMay(TechniquePlanner.PlanRow r) {
        if ((hasTechnique(r) || r.challenge()) && !TechniqueLines.machine(r.source())) return false;
        return !TechniquePlanner.SOURCE_OWNER.equals(r.source());
    }

    private static boolean hasTechnique(TechniquePlanner.PlanRow r) {
        return r.technique() != null && r.technique() != Technique.NONE;
    }

    private static <K, V> Map<K, V> unmodifiable(Map<K, V> m) {
        return Collections.unmodifiableMap(new LinkedHashMap<>(m));
    }
}
