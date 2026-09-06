package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Round 2 S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)): does the user's EARLY-AFTERNOON energy track
 * WHEN — or whether — they ate that morning? The most cautious rule in the set, and the only one
 * that reports a CORRELATION rather than a state.
 *
 * <p>Over a {@code windowDays} window ending YESTERDAY, a day QUALIFIES when it carries both a
 * check-in with an energy value inside the {@code [afternoonFromHour, afternoonToHour]} band
 * (inclusive, matched on the {@code slot_time} wall clock) and at least one logged meal of any
 * kind. The day's afternoon energy is the MEDIAN of its in-band check-ins. Fewer than
 * {@code minQualifyingDays} such days ⇒ silence.
 *
 * <p>The qualifying days are then split in two, and the two groups' median energies compared:
 * <ul>
 *   <li><b>lunch_time</b> (primary) — days carrying a lunch row, split at the median lunch minute:
 *       group A is strictly before it, group B at or after. Usable only when BOTH groups reach
 *       {@code minGroupDays} AND their own median lunch times are at least
 *       {@code minLunchSplitSeparationMinutes} apart.</li>
 *   <li><b>breakfast_presence</b> (fallback, only when the lunch split is unusable — the spec's
 *       "when lunch times don't vary") — group A is the days with a logged {@code breakfast} row,
 *       group B the days without one. Usable when both reach {@code minGroupDays}.</li>
 * </ul>
 *
 * <p>It raises only when the two medians are at least {@code minEnergyDelta} apart AND the
 * separation is CONSISTENT: the Mann–Whitney probability of superiority (the share of cross-group
 * day pairs running the higher group's way, ties counting half, oriented to that higher group)
 * must reach {@code minSuperiority}. Two medians differing with n≈5 a side is a coincidence; this
 * is the direct analogue of {@code MealRhythmDriftRule}'s same-direction share.
 *
 * <p><b>Bound 1 — the card may only report, never explain.</b> The intervention copy and
 * {@code FlagFactRenderer}'s lines state what the two groups look like and how big they are. No
 * causal word appears anywhere in this feature, and the group sizes are always shown so the reader
 * can see how thin the sample is.
 *
 * <p><b>Bound 2 — the day gate is "the day has meal data", not "the day has a morning meal".</b>
 * The spec's §(15) wording says "AND a logged morning meal", but taken literally that empties the
 * spec's OWN breakfast-present/absent fallback: a day without breakfast could never enter the
 * sample. The gate's real job is adherence neutrality — proving the day's meal log is not simply
 * missing, so "no breakfast row" can honestly be read as "did not eat breakfast" rather than "did
 * not log". Hence: any logged meal qualifies the day, and each arm applies its own stricter need
 * (a lunch row with a time; a day with meal data at all).
 *
 * <p><b>Bound 3 — a median split can be degenerate.</b> If every lunch sits at 13:00 the "before
 * the median" side is empty, and a naive delta would read a 0-vs-N split as an enormous finding.
 * Both the per-group minimum and the lunch-time separation gate exist for that case, and failing
 * either is exactly what unlocks the fallback.
 *
 * <p><b>Bound 4 — nothing here crosses midnight.</b> An early-afternoon check-in and a lunch are
 * plain minutes-of-day; {@code MealRhythmDriftRule}'s circular difference and
 * {@code LateEatingRule}'s +24 shift are both deliberately absent, because neither problem exists
 * in this band. Times are wall clock in the system zone throughout, per the spec's timezone note.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class EnergyDipMealTimingRule implements FlagRule {

    static final String SPLIT_LUNCH_TIME = "lunch_time";
    static final String SPLIT_BREAKFAST_PRESENCE = "breakfast_presence";

    private static final String LABEL_EARLIER_LUNCH = "earlier_lunch";
    private static final String LABEL_LATER_LUNCH = "later_lunch";
    private static final String LABEL_WITH_BREAKFAST = "with_breakfast";
    private static final String LABEL_WITHOUT_BREAKFAST = "without_breakfast";
    private static final String GROUP_A = "A";
    private static final String GROUP_B = "B";
    private static final String SLOT_LUNCH = "lunch";
    private static final String SLOT_BREAKFAST = "breakfast";

    private final CheckInRepository checkInRepository;
    private final MealRepository mealRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.EnergyDipMealTiming cfg = properties.energyDipMealTiming();

        // The window ends YESTERDAY: today's afternoon may not have happened at sweep time.
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(cfg.windowDays() - 1L);

        Map<LocalDate, List<Integer>> afternoonEnergies = new HashMap<>();
        int fromMinute = cfg.afternoonFromHour() * 60;
        int toMinute = cfg.afternoonToHour() * 60;
        for (CheckInEntity c : checkInRepository
                .findByCreatedByAndDeletedFalseAndDateBetween(userId, from, to)) {
            if (c.getDate() == null || c.getEnergy() == null) {
                continue;
            }
            Integer minute = minuteOfDay(c.getSlotTime());
            if (minute == null || minute < fromMinute || minute > toMinute) {
                continue;
            }
            afternoonEnergies.computeIfAbsent(c.getDate(), d -> new ArrayList<>()).add(c.getEnergy());
        }

        Map<LocalDate, DayMeals> mealsByDay = new HashMap<>();
        for (MealEntity meal : mealRepository
                .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(userId, from, to)) {
            if (meal.getMealDate() == null) {
                continue;
            }
            DayMeals day = mealsByDay.computeIfAbsent(meal.getMealDate(), d -> new DayMeals());
            day.anyMeal = true;
            if (SLOT_BREAKFAST.equals(meal.getSlot())) {
                day.breakfast = true;
            }
            if (SLOT_LUNCH.equals(meal.getSlot()) && meal.getLoggedAt() != null) {
                LocalTime at = meal.getLoggedAt().atZone(ZoneId.systemDefault()).toLocalTime();
                int minute = at.getHour() * 60 + at.getMinute();
                // A plan slot names ONE eating event: the earliest lunch row is the day's lunch.
                day.lunchMinute = day.lunchMinute == null ? minute : Math.min(day.lunchMinute, minute);
            }
        }

        List<Day> days = new ArrayList<>();
        for (Map.Entry<LocalDate, List<Integer>> e : afternoonEnergies.entrySet()) {
            DayMeals meals = mealsByDay.get(e.getKey());
            if (meals == null || !meals.anyMeal) {
                continue; // no meal data ⇒ neither "ate late" nor "skipped breakfast", just unknown
            }
            days.add(new Day(median(e.getValue()), meals.lunchMinute, meals.breakfast));
        }
        if (days.size() < cfg.minQualifyingDays()) {
            return FlagVerdict.unavailable(FlagKey.ENERGY_DIP_MEAL_TIMING,
                UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
        }

        Split split = lunchTimeSplit(cfg, days);
        if (split == null) {
            split = breakfastPresenceSplit(cfg, days);
        }
        if (split == null) {
            return FlagVerdict.unavailable(FlagKey.ENERGY_DIP_MEAL_TIMING,
                UnavailableReason.NO_USABLE_SPLIT);
        }

        double medianA = median(split.groupA());
        double medianB = median(split.groupB());
        double delta = Math.abs(medianA - medianB);
        boolean aIsHigher = medianA >= medianB;
        double superiority = orientedSuperiority(split.groupA(), split.groupB(), aIsHigher);

        if (delta < cfg.minEnergyDelta() || superiority < cfg.minSuperiority()) {
            // Genuinely compared and found nothing — the honest number is the delta itself.
            return FlagVerdict.clear(FlagKey.ENERGY_DIP_MEAL_TIMING, new FlagVerdict.ClearEvidence(
                "energy_delta", delta, cfg.minEnergyDelta(), split.mode()));
        }
        return FlagVerdict.raised(FlagKey.ENERGY_DIP_MEAL_TIMING,
            FlagPayloadEnvelope.energyDipMealTiming(new FlagPayloadEnvelope.EnergyDipMealTiming(
                split.mode(), split.labelA(), split.labelB(),
                cfg.windowDays(), days.size(), cfg.minQualifyingDays(),
                split.groupA().size(), split.groupB().size(), cfg.minGroupDays(),
                medianA, medianB,
                delta, cfg.minEnergyDelta(),
                superiority, cfg.minSuperiority(),
                aIsHigher ? GROUP_A : GROUP_B,
                clock(split.medianLunchA()), clock(split.medianLunchB()))));
    }

    /** Primary split: the days with a lunch time, halved at their own median lunch minute. Null
     *  when either side is too small or the two halves sit closer than the separation floor —
     *  the spec's "lunch times don't vary", and the ONLY thing that unlocks the fallback. */
    private Split lunchTimeSplit(FlagProperties.EnergyDipMealTiming cfg, List<Day> days) {
        List<Day> withLunch = days.stream().filter(d -> d.lunchMinute() != null).toList();
        if (withLunch.size() < cfg.minGroupDays() * 2) {
            return null;
        }
        double medianLunch = median(withLunch.stream().map(d -> d.lunchMinute()).toList());
        List<Double> earlierEnergy = new ArrayList<>();
        List<Double> laterEnergy = new ArrayList<>();
        List<Integer> earlierLunch = new ArrayList<>();
        List<Integer> laterLunch = new ArrayList<>();
        for (Day d : withLunch) {
            if (d.lunchMinute() < medianLunch) {
                earlierEnergy.add(d.energy());
                earlierLunch.add(d.lunchMinute());
            } else {
                laterEnergy.add(d.energy());
                laterLunch.add(d.lunchMinute());
            }
        }
        if (earlierEnergy.size() < cfg.minGroupDays() || laterEnergy.size() < cfg.minGroupDays()) {
            return null;
        }
        double medianEarlier = median(earlierLunch);
        double medianLater = median(laterLunch);
        if (medianLater - medianEarlier < cfg.minLunchSplitSeparationMinutes()) {
            return null; // the two halves are the same lunch time wearing two hats
        }
        return new Split(SPLIT_LUNCH_TIME, LABEL_EARLIER_LUNCH, LABEL_LATER_LUNCH,
            earlierEnergy, laterEnergy, medianEarlier, medianLater);
    }

    /** Fallback split: breakfast logged that day, or not. No time is involved, so no separation
     *  gate — only the per-group minimum. */
    private Split breakfastPresenceSplit(FlagProperties.EnergyDipMealTiming cfg, List<Day> days) {
        List<Double> withBreakfast = days.stream().filter(d -> d.breakfast()).map(d -> d.energy()).toList();
        List<Double> withoutBreakfast = days.stream().filter(d -> !d.breakfast()).map(d -> d.energy()).toList();
        if (withBreakfast.size() < cfg.minGroupDays() || withoutBreakfast.size() < cfg.minGroupDays()) {
            return null;
        }
        return new Split(SPLIT_BREAKFAST_PRESENCE, LABEL_WITH_BREAKFAST, LABEL_WITHOUT_BREAKFAST,
            new ArrayList<>(withBreakfast), new ArrayList<>(withoutBreakfast), null, null);
    }

    /** The common-language effect size (Mann–Whitney probability of superiority): the share of all
     *  cross-group day pairs in which the HIGHER group's day really is higher, ties counting half.
     *  Oriented to that higher group, so the result always lands in {@code [0.5, 1.0]} and a value
     *  of 1.0 means every single day of one group beat every single day of the other. */
    static double orientedSuperiority(List<Double> groupA, List<Double> groupB, boolean aIsHigher) {
        double wins = 0.0;
        for (Double a : groupA) {
            for (Double b : groupB) {
                if (a > b) {
                    wins += 1.0;
                } else if (a.doubleValue() == b.doubleValue()) {
                    wins += 0.5;
                }
            }
        }
        double share = wins / (groupA.size() * (double) groupB.size());
        return aIsHigher ? share : 1.0 - share;
    }

    /** {@code check_in.slot_time} is an {@code HH:mm} wall-clock string; a malformed one is
     *  missing data, never a data point. */
    private static Integer minuteOfDay(String slotTime) {
        if (slotTime == null) {
            return null;
        }
        try {
            LocalTime at = LocalTime.parse(slotTime);
            return at.getHour() * 60 + at.getMinute();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Plain median (mean of the two middle values on an even count) — the chrononutrition
     *  quantile convention {@code MealRhythmDriftRule} already uses: one outlier day must not
     *  move a verdict. */
    private static double median(List<? extends Number> values) {
        List<Double> sorted = values.stream().map(Number::doubleValue)
            .sorted(Comparator.naturalOrder()).toList();
        int n = sorted.size();
        if (n == 0) {
            return 0.0;
        }
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private static String clock(Double minuteOfDay) {
        if (minuteOfDay == null) {
            return null;
        }
        int m = (int) Math.round(minuteOfDay);
        return "%02d:%02d".formatted((m / 60) % 24, m % 60);
    }

    /** One qualifying day, reduced to the three things the split needs. */
    private record Day(double energy, Integer lunchMinute, boolean breakfast) {
    }

    /** Per-day meal facts accumulated from the window's meal rows — mutable on purpose, it never
     *  leaves this class. */
    private static final class DayMeals {
        private boolean anyMeal;
        private boolean breakfast;
        private Integer lunchMinute;
    }

    /** A usable two-group split: the mode, the two group labels, the two energy samples and (in
     *  lunch mode only) the two groups' own median lunch minutes. */
    private record Split(String mode, String labelA, String labelB,
                         List<Double> groupA, List<Double> groupB,
                         Double medianLunchA, Double medianLunchB) {
    }
}
