package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotJson;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotTemplateEntity;
import io.mrkuhne.mezo.feature.fuel.repository.MealSlotTemplateRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Round 2 S4 (mezo-d58h.7.4, spec 2026-09-05 §(13)): the meal-slot PLAN and the logged REALITY
 * have drifted apart. Two sub-triggers under one flag key, both measured over a rolling
 * {@code windowDays} window ending YESTERDAY:
 *
 * <ul>
 *   <li><b>slot_drift</b> — a planned slot's actual logged time deviates from its planned time by
 *       a median of more than {@code driftMinutes}, and at least {@code minSameDirectionShare} of
 *       the observed days drift the SAME way.</li>
 *   <li><b>dead_slot</b> — a planned slot has a logged meal on at most
 *       {@code deadSlotMaxPresence} of the days it was planned, while the OTHER tracked slots
 *       average at least {@code otherSlotsMinPresence}. The user logs — just not that slot.</li>
 * </ul>
 *
 * <p>The card phrases both as a neutral observation and offers to adjust the PLAN. This rule never
 * speaks about adherence: a plan that stopped matching a life is the plan's problem.
 *
 * <p><b>Trap 1 — only a {@code fixed} anchor has a time.</b> {@link MealSlotJson} flattens the
 * anchor, and {@code wake}/{@code bed}/{@code training_start}/{@code training_end} slots carry an
 * {@code offsetMin} that is resolved in the FRONTEND only ({@code compileTemplate.ts}), against
 * that day's wake/bed/training blocks. Resolving them here would mean inventing a wake time for
 * every past day, so the drift arm reads {@code fixed}-anchor slots exclusively. The dead-slot arm
 * needs no time and covers every non-snack slot.
 *
 * <p><b>Trap 2 — the day type is derived, never stored.</b> {@code meal_slot_template} has one row
 * per {@code (owner, dayType)}, and the derivation is copied from
 * {@code frontend/src/features/fuel/logic/resolveDayType.ts}: no completed gym instance ⇒
 * {@code rest}; otherwise the EARLIEST instance start before noon ⇒ {@code training_am}, at/after
 * noon ⇒ {@code training_pm}. A training day whose instances ALL lack {@code startedAt} is
 * unresolvable and skipped entirely — never bucketed by guess — and so is a day whose resolved
 * type has no template row. A skipped day enters no numerator and no denominator.
 *
 * <p><b>Trap 3 — clock arithmetic wraps.</b> Deviation is the SIGNED CIRCULAR difference
 * ({@link #circularDeltaMinutes}), always in {@code (-720, 720]}: a 19:00 dinner logged at 00:30
 * is +330 minutes late, not −1110, and a 07:00 breakfast logged at 13:00 is +360, not −1080.
 * {@code LateEatingRule}'s {@code +24-below-noon} shift is deliberately NOT used — that shift
 * exists to put several values on one number line against a single anchor, and applied to a
 * per-slot difference it produces exactly the −18-hour breakfast this helper avoids.
 *
 * <p><b>Ambiguity is silence.</b> {@code snack} is excluded (a template may hold several snack
 * slots, all of which collapse onto the same {@code meal.slot = 'snack'} rows), and any day whose
 * template holds TWO slots of the same non-snack kind contributes nothing for that kind.
 *
 * <p><b>An unlogged day is neither compliant nor violating.</b> Presence ratios count only days
 * that had at least one logged meal of ANY kind — otherwise a logging holiday would read as
 * "your dinner slot died", which is the exact adherence-negative reading the spec forbids.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MealRhythmDriftRule implements FlagRule {

    static final String SUB_TYPE_SLOT_DRIFT = "slot_drift";
    static final String SUB_TYPE_DEAD_SLOT = "dead_slot";

    private static final String SNACK = "snack";
    private static final String ANCHOR_FIXED = "fixed";
    private static final String DAY_TYPE_REST = "rest";
    private static final String DAY_TYPE_TRAINING_AM = "training_am";
    private static final String DAY_TYPE_TRAINING_PM = "training_pm";
    private static final int NOON_MINUTES = 720;
    private static final int DAY_MINUTES = 1440;

    private final MealSlotTemplateRepository mealSlotTemplateRepository;
    private final MealRepository mealRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.MealRhythmDrift cfg = properties.mealRhythmDrift();

        Map<String, List<MealSlotJson>> templates = new HashMap<>();
        for (MealSlotTemplateEntity t : mealSlotTemplateRepository.findAllByCreatedByAndDeletedFalse(userId)) {
            if (t.getSlots() != null && !t.getSlots().isEmpty()) {
                templates.put(t.getDayType(), t.getSlots());
            }
        }
        if (templates.isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.MEAL_RHYTHM_DRIFT, UnavailableReason.NO_SLOT_TEMPLATE);
        }

        // The window ends YESTERDAY: today's dinner has not happened at sweep time (the same
        // reasoning as MissedWorkoutsRule's and ProtocolLapseRule's windows).
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(cfg.windowDays() - 1L);

        Map<LocalDate, Map<String, LocalTime>> earliestByDayAndKind = new HashMap<>();
        for (MealEntity meal : mealRepository
                .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(userId, from, to)) {
            if (meal.getLoggedAt() == null || meal.getSlot() == null) {
                continue;
            }
            LocalTime at = meal.getLoggedAt().atZone(ZoneId.systemDefault()).toLocalTime();
            Map<String, LocalTime> byKind =
                earliestByDayAndKind.computeIfAbsent(meal.getMealDate(), d -> new HashMap<>());
            // A plan slot names ONE eating event: the earliest row of that kind is the one the
            // plan is about (a second dinner is a second helping, not a second dinner slot).
            byKind.merge(meal.getSlot(), at, (a, b) -> a.isBefore(b) ? a : b);
        }
        if (earliestByDayAndKind.size() < cfg.minDaysWithMeals()) {
            return FlagVerdict.unavailable(FlagKey.MEAL_RHYTHM_DRIFT,
                UnavailableReason.NOT_ENOUGH_MEAL_DAYS);
        }

        Map<LocalDate, String> dayTypes = resolveDayTypes(userId, from, to);

        Map<String, SlotStats> statsByKind = new LinkedHashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Map<String, LocalTime> logged = earliestByDayAndKind.get(day);
            if (logged == null) {
                continue; // an unlogged day is neither compliant nor violating — it is skipped
            }
            String dayType = dayTypes.get(day);
            if (dayType == null) {
                continue; // unresolvable training day (Trap 2)
            }
            List<MealSlotJson> slots = templates.get(dayType);
            if (slots == null) {
                continue; // no template for this day type — nothing was planned to drift from
            }
            for (MealSlotJson slot : slots) {
                String kind = slot.slotKind();
                if (kind == null || SNACK.equals(kind) || duplicateKind(slots, kind)) {
                    continue; // ambiguity is silence
                }
                SlotStats stats = statsByKind.computeIfAbsent(kind, k -> new SlotStats());
                stats.label = slot.label() == null ? kind : slot.label();
                stats.plannedDays++;
                LocalTime actual = logged.get(kind);
                if (actual != null) {
                    stats.presentDays++;
                }
                LocalTime planned = plannedTime(slot);
                if (planned != null && actual != null) {
                    stats.plannedTime = planned;
                    stats.deviations.add(circularDeltaMinutes(
                        actual.getHour() * 60 + actual.getMinute(),
                        planned.getHour() * 60 + planned.getMinute()));
                    stats.actualMinutes.add(actual.getHour() * 60 + actual.getMinute());
                }
            }
        }
        if (statsByKind.isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.MEAL_RHYTHM_DRIFT,
                UnavailableReason.NO_COMPARABLE_SLOTS);
        }

        int daysWithMeals = earliestByDayAndKind.size();
        FlagPayloadEnvelope.MealRhythmDrift dead = deadSlot(cfg, statsByKind, daysWithMeals);
        if (dead != null) {
            return FlagVerdict.raised(FlagKey.MEAL_RHYTHM_DRIFT,
                FlagPayloadEnvelope.mealRhythmDrift(dead));
        }
        FlagPayloadEnvelope.MealRhythmDrift drift = slotDrift(cfg, statsByKind, daysWithMeals);
        if (drift != null) {
            return FlagVerdict.raised(FlagKey.MEAL_RHYTHM_DRIFT,
                FlagPayloadEnvelope.mealRhythmDrift(drift));
        }

        // Genuinely judged and found nothing: the largest median deviation seen is the honest
        // "how close did it get" number, 0 when no slot had enough paired days to measure.
        double largestMedian = statsByKind.values().stream()
            .filter(s -> s.deviations.size() >= cfg.minSlotDays())
            .mapToDouble(s -> Math.abs(median(s.deviations)))
            .max().orElse(0.0);
        return FlagVerdict.clear(FlagKey.MEAL_RHYTHM_DRIFT, new FlagVerdict.ClearEvidence(
            "drift_minutes", largestMedian, (double) cfg.driftMinutes(), null));
    }

    /** Dead slot: the emptiest qualifying slot, provided the OTHER tracked slots really are being
     *  logged. Checked before drift — an empty slot is a bigger plan mismatch than a late one. */
    private FlagPayloadEnvelope.MealRhythmDrift deadSlot(
        FlagProperties.MealRhythmDrift cfg, Map<String, SlotStats> statsByKind, int daysWithMeals) {
        String worstKind = null;
        double worstRatio = Double.MAX_VALUE;
        double othersRatio = 0.0;
        for (Map.Entry<String, SlotStats> e : statsByKind.entrySet()) {
            SlotStats s = e.getValue();
            if (s.plannedDays < cfg.minSlotPlannedDays()) {
                continue;
            }
            double ratio = (double) s.presentDays / s.plannedDays;
            if (ratio > cfg.deadSlotMaxPresence()) {
                continue;
            }
            List<Double> others = new ArrayList<>();
            for (Map.Entry<String, SlotStats> other : statsByKind.entrySet()) {
                SlotStats o = other.getValue();
                if (!other.getKey().equals(e.getKey()) && o.plannedDays >= cfg.minSlotPlannedDays()) {
                    others.add((double) o.presentDays / o.plannedDays);
                }
            }
            if (others.isEmpty()) {
                continue; // nothing to compare against — "empty" and "not logging" are the same claim
            }
            double othersMean = others.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
            if (othersMean < cfg.otherSlotsMinPresence()) {
                continue;
            }
            if (ratio < worstRatio) {
                worstKind = e.getKey();
                worstRatio = ratio;
                othersRatio = othersMean;
            }
        }
        if (worstKind == null) {
            return null;
        }
        SlotStats s = statsByKind.get(worstKind);
        return new FlagPayloadEnvelope.MealRhythmDrift(
            SUB_TYPE_DEAD_SLOT, worstKind, s.label,
            cfg.windowDays(), daysWithMeals, cfg.minDaysWithMeals(),
            s.plannedDays, s.presentDays,
            s.plannedTime == null ? null : s.plannedTime.toString(), null,
            null, null, null,
            worstRatio, cfg.deadSlotMaxPresence(),
            othersRatio, cfg.otherSlotsMinPresence());
    }

    /** Slot drift: the slot whose median deviation is largest, provided it also drifts
     *  CONSISTENTLY (a week of chaos is not a drift). */
    private FlagPayloadEnvelope.MealRhythmDrift slotDrift(
        FlagProperties.MealRhythmDrift cfg, Map<String, SlotStats> statsByKind, int daysWithMeals) {
        String worstKind = null;
        double worstMedian = 0.0;
        double worstShare = 0.0;
        for (Map.Entry<String, SlotStats> e : statsByKind.entrySet()) {
            SlotStats s = e.getValue();
            if (s.deviations.size() < cfg.minSlotDays() || s.plannedTime == null) {
                continue;
            }
            double med = median(s.deviations);
            if (Math.abs(med) <= cfg.driftMinutes()) {
                continue;
            }
            long sameDirection = s.deviations.stream()
                .filter(d -> Math.abs(d) > cfg.driftMinutes() && Math.signum(d) == Math.signum(med))
                .count();
            double share = (double) sameDirection / s.deviations.size();
            if (share < cfg.minSameDirectionShare()) {
                continue;
            }
            if (Math.abs(med) > Math.abs(worstMedian)) {
                worstKind = e.getKey();
                worstMedian = med;
                worstShare = share;
            }
        }
        if (worstKind == null) {
            return null;
        }
        SlotStats s = statsByKind.get(worstKind);
        int medianActual = (int) Math.round(median(s.actualMinutes));
        return new FlagPayloadEnvelope.MealRhythmDrift(
            SUB_TYPE_SLOT_DRIFT, worstKind, s.label,
            cfg.windowDays(), daysWithMeals, cfg.minDaysWithMeals(),
            s.plannedDays, s.deviations.size(),
            s.plannedTime.toString(), clock(medianActual),
            (int) Math.round(worstMedian), cfg.driftMinutes(), worstShare,
            null, null, null, null);
    }

    /** {@code resolveDayType.ts}, ported (Trap 2): no completed instance ⇒ rest; otherwise the
     *  EARLIEST start before noon ⇒ training_am, at/after noon ⇒ training_pm. A training day with
     *  no start time at all is absent from the map, i.e. unresolvable and skipped. */
    private Map<LocalDate, String> resolveDayTypes(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Integer> earliestStart = new HashMap<>();
        Set<LocalDate> trainingDays = new HashSet<>();
        for (WorkoutSessionEntity s : workoutSessionRepository.findDoneInstancesBetween(userId, from, to)) {
            if (s.getDate() == null) {
                continue;
            }
            trainingDays.add(s.getDate());
            if (s.getStartedAt() != null) {
                LocalTime start = s.getStartedAt().atZone(ZoneId.systemDefault()).toLocalTime();
                earliestStart.merge(s.getDate(), start.getHour() * 60 + start.getMinute(), Math::min);
            }
        }
        Map<LocalDate, String> dayTypes = new HashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (!trainingDays.contains(d)) {
                dayTypes.put(d, DAY_TYPE_REST);
                continue;
            }
            Integer earliest = earliestStart.get(d);
            if (earliest == null) {
                continue; // trained, but WHEN is unknown — never guess a type
            }
            dayTypes.put(d, earliest < NOON_MINUTES ? DAY_TYPE_TRAINING_AM : DAY_TYPE_TRAINING_PM);
        }
        return dayTypes;
    }

    /** Two slots of the same non-snack kind in one template make "which one was this meal" —
     *  and therefore both arms — unanswerable for that kind on that day. */
    private static boolean duplicateKind(List<MealSlotJson> slots, String kind) {
        return slots.stream().filter(s -> kind.equals(s.slotKind())).count() > 1;
    }

    /** Only a {@code fixed} anchor carries a wall-clock time (Trap 1). */
    private static LocalTime plannedTime(MealSlotJson slot) {
        if (!ANCHOR_FIXED.equals(slot.anchorType()) || slot.time() == null) {
            return null;
        }
        try {
            return LocalTime.parse(slot.time());
        } catch (java.time.format.DateTimeParseException e) {
            return null; // a malformed stored time is missing data, never a drift
        }
    }

    /** Signed circular difference in {@code (-720, 720]} (Trap 3): positive = later than planned. */
    static int circularDeltaMinutes(int actualMinutes, int plannedMinutes) {
        int delta = Math.floorMod(actualMinutes - plannedMinutes, DAY_MINUTES);
        return delta > NOON_MINUTES ? delta - DAY_MINUTES : delta;
    }

    /** Plain median (mean of the two middle values on an even count) — the chrononutrition
     *  quantile convention: a single outlier day must not move the verdict. */
    private static double median(List<Integer> values) {
        List<Double> sorted = values.stream().map(Integer::doubleValue)
            .sorted(Comparator.naturalOrder()).toList();
        int n = sorted.size();
        if (n == 0) {
            return 0.0;
        }
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private static String clock(int minuteOfDay) {
        int m = Math.floorMod(minuteOfDay, DAY_MINUTES);
        return "%02d:%02d".formatted(m / 60, m % 60);
    }

    /** Per-slotKind accumulator over the window — mutable on purpose, it never leaves this class. */
    private static final class SlotStats {
        private String label;
        private LocalTime plannedTime;
        private int plannedDays;
        private int presentDays;
        private final List<Integer> deviations = new ArrayList<>();
        private final List<Integer> actualMinutes = new ArrayList<>();
    }
}
