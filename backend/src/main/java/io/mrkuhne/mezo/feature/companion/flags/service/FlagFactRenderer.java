package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * The deterministic, numeric, rule-provided evidence lines for a RAISED flag, rendered from the
 * raise's own frozen {@code companion_flag_log.payload}. Nothing here re-derives a rule — the
 * payload already froze both the thresholds and the observed values at raise time, which is the
 * whole point of {@code FlagPayloadEnvelope}.
 *
 * <p>TWO consumers (spec 2026-09-05 §5): the advice card's {@code facts} ({@code
 * InterventionService}) and the coaching observer's RAISED evidence ({@code FlagTraceReadService}).
 * It lives here rather than in {@code proactive} because it renders companion's own payload
 * envelope AND because companion may not import proactive — see {@code AdviceRankPort}'s javadoc
 * for the cycle that forbids it. {@link FlagTraceCopy} renders the other two outcomes, CLEAR and
 * UNAVAILABLE, in the same family and the same locale.
 *
 * <p>An unmapped key or a null payload yields an EMPTY list, never a placeholder: the card is
 * still delivered (its prose falls back to the template text), it simply shows no evidence block.
 * That is the spec §7 honesty rule — never estimate.
 *
 * <p>Numbers are formatted with the Hungarian locale (decimal comma) because these strings are
 * shown verbatim on the card AND handed to the model as the only numbers it is allowed to echo;
 * {@code ProseNumberGuard} normalises the separator before comparing, so a model that answers
 * with a dot is not punished for it.
 */
public final class FlagFactRenderer {

    private static final Locale HU = Locale.of("hu");

    /** {@code MealRhythmDriftRule}'s frozen sub-type discriminator — the presence arm. */
    private static final String MEAL_RHYTHM_DEAD_SLOT = "dead_slot";

    /** {@code EnergyDipMealTimingRule}'s frozen fallback split mode. */
    private static final String ENERGY_DIP_BREAKFAST_PRESENCE = "breakfast_presence";

    private FlagFactRenderer() {
    }

    public static List<String> render(String flagKey, FlagPayloadEnvelope payload) {
        if (payload == null || flagKey == null) {
            return List.of();
        }
        return switch (flagKey) {
            case FlagKey.SLEEP_DEBT -> sleepDebt(payload.sleepDebt());
            case FlagKey.MISSED_WORKOUTS -> missedWorkouts(payload.missedWorkouts());
            case FlagKey.LOGGING_GAP -> loggingGap(payload.loggingGap());
            case FlagKey.SUSTAINED_STRESS -> sustainedStress(payload.sustainedStress());
            case FlagKey.MOMENTUM_AT_RISK -> momentumAtRisk(payload.momentumAtRisk());
            case FlagKey.RECOVERY_NEEDED -> recoveryNeeded(payload.recoveryNeeded());
            case FlagKey.ALL_HEALTHY -> allHealthy(payload.allHealthy());
            case FlagKey.ACUTE_BAD_DAY -> acuteBadDay(payload.acuteBadDay());
            case FlagKey.LOAD_FUEL_MISMATCH -> loadFuelMismatch(payload.loadFuelMismatch());
            case FlagKey.RAPID_WEIGHT_LOSS -> rapidWeightLoss(payload.rapidWeightLoss());
            case FlagKey.JOINT_OVERUSE -> jointOveruse(payload.jointOveruse());
            case FlagKey.IGNORED_NUDGE -> ignoredNudge(payload.ignoredNudge());
            case FlagKey.LATE_EATING -> lateEating(payload.lateEating());
            case FlagKey.PROTOCOL_LAPSE -> protocolLapse(payload.protocolLapse());
            case FlagKey.MEAL_RHYTHM_DRIFT -> mealRhythmDrift(payload.mealRhythmDrift());
            case FlagKey.ENERGY_DIP_MEAL_TIMING -> energyDipMealTiming(payload.energyDipMealTiming());
            default -> List.of();
        };
    }

    /** Morning-feed defect (bd mezo-btmc): {@code deficitHours} is the WINDOW TOTAL — {@code
     *  SleepDeficitCalculator.over} sums {@code max(0, goal - hours)} across the logged mornings,
     *  and {@code SleepDebtRule} compares it against a CUMULATIVE threshold — so the old
     *  "%s óra/éjszaka" unit made the headline fact false (4,5 hours over 2 nights was read as
     *  4,5 hours EVERY night), and the model amplified the mislabel into prose about nightly
     *  rest that contradicted the same minute's sleep card. Both quantities are now stated with
     *  their own unit. The per-night mean is derived HERE because the envelope froze only the
     *  total ({@code Deficit.deficitPerLoggedNight()} is not one of its components) — and it is
     *  the LOGGED nights that divide it, the same honest denominator the calculator uses. */
    private static List<String> sleepDebt(FlagPayloadEnvelope.SleepDebt p) {
        if (p == null) {
            return List.of();
        }
        String total = "Alvásadósság: összesen %s óra hiány a rögzített éjszakákon"
            .formatted(num(p.deficitHours()));
        // "a N közül", not "N-ből" (bd mezo-o6ah): the elative suffix follows Hungarian vowel
        // harmony on the numeral WORD, so három/hat/nyolc take -ból — and the DEFAULT window is 3
        // nights, so the old literal shipped "3-ből" on the card's headline fact every time. It
        // survived because the FE mock fixture uses a 7-night window, where "7-ből" is correct.
        // "közül" is invariant, which retires the whole class of bug instead of adding a digit→
        // suffix helper that would still have to key off the numeral's vowels (20 = húsz → -ból).
        String nights = "%d rögzített éjszaka a %d közül".formatted(p.loggedNights(), p.nights());
        if (p.loggedNights() <= 0) {
            // No logged night means no honest denominator, so the average clause is DROPPED
            // rather than printed as 0,0 (spec §7: never estimate). SleepDebtRule cannot raise
            // in that state (it gates on minNights), but the renderer is the last thing between
            // a malformed log row and the card — same reason protocolLapse tolerates nulls.
            return List.of("%s (cél %s óra/éjszaka, %s)"
                .formatted(total, num(p.goalHours()), nights));
        }
        return List.of("%s (átlagosan %s óra/éjszaka, cél %s óra/éjszaka, %s)".formatted(
            total, num(p.deficitHours() / p.loggedNights()), num(p.goalHours()), nights));
    }

    private static List<String> missedWorkouts(FlagPayloadEnvelope.MissedWorkouts p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        int plannedCount = p.plannedDays() == null ? 0 : p.plannedDays().size();
        int missedCount = p.missedDays() == null ? 0 : p.missedDays().size();
        facts.add("Kimaradt edzések: %d egymást követő tervezett nap (%d tervezett napból %d napon)"
            .formatted(p.longestMissedRun(), plannedCount, missedCount));
        if (p.missedDays() != null && !p.missedDays().isEmpty()) {
            facts.add("Kimaradt napok: " + String.join(", ", p.missedDays()));
        }
        return List.copyOf(facts);
    }

    private static List<String> loggingGap(FlagPayloadEnvelope.LoggingGap p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        if (p.mealHoursSince() != null) {
            facts.add("Utolsó étkezés-rögzítés: %d órája (küszöb %d óra)"
                .formatted(p.mealHoursSince(), p.mealStaleHours()));
        }
        if (p.checkinHoursSince() != null) {
            facts.add("Utolsó check-in: %d órája (küszöb %d óra)"
                .formatted(p.checkinHoursSince(), p.checkinStaleHours()));
        }
        if (p.sleepMorningsSince() != null) {
            facts.add("Rögzítetlen alvás: %d reggel (küszöb %d reggel)"
                .formatted(p.sleepMorningsSince(), p.sleepStaleMornings()));
        }
        if (p.observedDeficitPerLoggedNight() != null && p.loggedNights() != null) {
            facts.add("A rögzített éjszakák is rövidek: %s óra hiány/éjszaka %d éjszakán"
                .formatted(num(p.observedDeficitPerLoggedNight()), p.loggedNights()));
        }
        return List.copyOf(facts);
    }

    private static List<String> sustainedStress(FlagPayloadEnvelope.SustainedStress p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Magas stressz: %d nap a küszöb (%s) fölött %d napból"
            .formatted(p.daysOverThreshold(), num(p.threshold()), p.windowDays()));
    }

    private static List<String> momentumAtRisk(FlagPayloadEnvelope.MomentumAtRisk p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Lendület: napi %s teljesített szokás a korábbi %s helyett (%d nap alatt)"
            .formatted(num(p.recentDoneAvg()), num(p.baselineDoneAvg()), p.windowDays()));
    }

    private static List<String> recoveryNeeded(FlagPayloadEnvelope.RecoveryNeeded p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        if (p.sleepHours() != null) {
            facts.add("Alvás %s: %s óra (padló %s óra)"
                .formatted(p.sleepDay(), num(p.sleepHours()), num(p.sleepFloorHours())));
        }
        if (p.rpe() != null) {
            facts.add("Edzés-RPE %s: %s (küszöb %s)"
                .formatted(p.rpeDay(), num(p.rpe()), num(p.rpeThreshold())));
        }
        if (p.stress() != null) {
            facts.add("Stressz %s: %s (küszöb %s)"
                .formatted(p.stressDay(), num(p.stress()), num(p.stressThreshold())));
        }
        return List.copyOf(facts);
    }

    private static List<String> acuteBadDay(FlagPayloadEnvelope.AcuteBadDay p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("Ma %d check-in is jelzett nehéz napot (test vagy energia legfeljebb %d a 10-ből)"
            .formatted(p.qualifyingCount(), p.bodyOrEnergyAtMost()));
        if (p.qualifyingCheckIns() != null) {
            for (FlagPayloadEnvelope.QualifyingCheckIn c : p.qualifyingCheckIns()) {
                facts.add("%s: test %s, energia %s".formatted(
                    c.slotTime(), scoreOrDash(c.body()), scoreOrDash(c.energy())));
            }
        }
        return List.copyOf(facts);
    }

    private static List<String> loadFuelMismatch(FlagPayloadEnvelope.LoadFuelMismatch p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("Terhelés %d nap átlagban: %s perc-ekvivalens/nap (küszöb %s)"
            .formatted(p.windowDays(), num(p.loadAvg()), num(p.loadThreshold())));
        if (p.kcalAvg() != null && p.kcalTargetAvg() != null) {
            facts.add("Kalória %d nap átlagban: %s kcal a %s kcal cél %d%%-a (%d rögzített napból)"
                .formatted(p.windowDays(), num(p.kcalAvg()), num(p.kcalTargetAvg()),
                    Math.round(p.kcalFraction() * 100), p.kcalLoggedDays()));
        }
        if (p.sleepAvg() != null) {
            facts.add("Alvás %d nap átlagban: %s óra (padló %s óra, %d rögzített éjszakából)"
                .formatted(p.windowDays(), num(p.sleepAvg()), num(p.sleepFloorHours()),
                    p.sleepLoggedDays()));
        }
        if (p.weightTrendPctWk() != null) {
            facts.add("Súlytrend: %s%%/hét".formatted(num(p.weightTrendPctWk())));
        }
        return List.copyOf(facts);
    }

    private static List<String> rapidWeightLoss(FlagPayloadEnvelope.RapidWeightLoss p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Súlytrend: %s%%/hét (küszöb %s%%/hét, %d rögzített napból, cél: %s)"
            .formatted(num(p.weightTrendPctWk()), num(p.pctPerWeekAtMost()), p.weighInCount(),
                p.goalTrajectory()));
    }

    private static List<String> jointOveruse(FlagPayloadEnvelope.JointOveruse p) {
        if (p == null) {
            return List.of();
        }
        return List.of(
            "Váll-terhelés %d nap átlagban: %s (küszöb %s), holnap (%s) %s-fókuszú edzés"
                .formatted(p.windowDays(), num(p.strainAvg()), num(p.strainAvgAtLeast()),
                    p.tomorrowDate(), muscleHu(p.tomorrowMuscle())));
    }

    private static List<String> ignoredNudge(FlagPayloadEnvelope.IgnoredNudge p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add(("Az esti emlékeztető %d egymást követő nap ment ki, de a lefekvés minden "
                + "alkalommal több mint %d perccel később volt, mint a cél (%s)")
            .formatted(p.runLength(), p.nonComplianceMinutes(), clockFromShiftedHour(p.anchorBedTimeHour())));
        if (p.bedtimeHourByNight() != null) {
            for (Map.Entry<String, Double> e : p.bedtimeHourByNight().entrySet()) {
                facts.add("%s este: lefekvés %s".formatted(e.getKey(), clockFromShiftedHour(e.getValue())));
            }
        }
        return List.copyOf(facts);
    }

    private static List<String> lateEating(FlagPayloadEnvelope.LateEating p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("Késői étkezés: az utolsó %d nap közül %d napon volt későn az utolsó étkezés (küszöb: legalább %d nap)"
            .formatted(p.windowDays(), p.qualifyingDays(), p.minDaysOfLastThree()));
        facts.add(p.anchorBedTimeHour() != null
            ? "Lefekvés-horgony: %s (közelség-küszöb %d perc), abszolút küszöb: %s"
                .formatted(clockFromShiftedHour(p.anchorBedTimeHour()), p.minutesBeforeBed(),
                    plainClock(p.absoluteHour()))
            : "Nincs beállított alvási cél, ezért csak az abszolút óra (%s) számít"
                .formatted(plainClock(p.absoluteHour())));
        if (p.lastMealHourByDay() != null) {
            for (Map.Entry<String, Double> e : p.lastMealHourByDay().entrySet()) {
                String arm = p.qualifyingArmByDay() == null ? null : p.qualifyingArmByDay().get(e.getKey());
                facts.add("%s: utolsó étkezés %s (%s)"
                    .formatted(e.getKey(), clockFromShiftedHour(e.getValue()), lateEatingArmHu(arm)));
            }
        }
        return List.copyOf(facts);
    }

    /** Round 2 S1 (mezo-d58h.7.1): the facts name the item, the two missed days and the habit the
     *  user actually had — the card's copy leans on all three ("a sorozat nem veszett el"). */
    private static List<String> protocolLapse(FlagPayloadEnvelope.ProtocolLapse p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("Kiegészítő: %s%s".formatted(
            Objects.requireNonNullElse(p.itemName(), "ismeretlen kiegészítő"),
            p.slotKey() == null ? "" : " (%s zóna)".formatted(p.slotKey())));
        facts.add("Kimaradt %d egymást követő tervezett napon: %s"
            .formatted(p.consecutiveMissedDueDays(),
                p.missedDueDates() == null ? "" : String.join(", ", p.missedDueDates())));
        facts.add(p.lastTakenDate() == null
            ? "Az ablakon belül nincs rögzített bevétel"
            : "Utoljára ekkor volt bevéve: %s".formatted(p.lastTakenDate()));
        facts.add("Előtte %d tervezett napból %d teljesült (%s%%, küszöb: %s%%)"
            .formatted(p.historyDueDays(), p.historyTakenDays(),
                String.format(HU, "%.0f", p.historyAdherence() * 100),
                String.format(HU, "%.0f", p.minHistoryAdherence() * 100)));
        return facts;
    }

    /** Round 2 S4 (mezo-d58h.7.4): a NEUTRAL observation — the facts state what the plan says,
     *  what actually happened and over how many days, and never use an adherence verb. The two
     *  sub-types render different halves of the payload (see the envelope record's javadoc). */
    private static List<String> mealRhythmDrift(FlagPayloadEnvelope.MealRhythmDrift p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("Étkezési slot: %s (%s)".formatted(
            Objects.requireNonNullElse(p.slotLabel(), p.slotKind()), p.slotKind()));
        if (MEAL_RHYTHM_DEAD_SLOT.equals(p.subType())) {
            facts.add("A %d napból, amikorra be volt tervezve, %d napon volt rögzítve étkezés (%s%%)"
                .formatted(p.plannedDays(), p.observedDays(), pct(p.presenceRatio())));
            facts.add("A többi slot ugyanebben az ablakban átlagosan %s%%-on áll (küszöb: %s%%)"
                .formatted(pct(p.otherSlotsPresenceRatio()), pct(p.otherSlotsMinPresence())));
        } else {
            facts.add("Terv szerint %s, a valóságban jellemzően %s (%d perc %s)".formatted(
                p.plannedTime(), p.observedMedianTime(),
                Math.abs(p.medianDeviationMinutes() == null ? 0 : p.medianDeviationMinutes()),
                p.medianDeviationMinutes() != null && p.medianDeviationMinutes() < 0
                    ? "korábban" : "később"));
            facts.add("%d megfigyelt napból ennyi mozdult ugyanabba az irányba: %s%% (küszöb: %d perc)"
                .formatted(p.observedDays(), pct(p.sameDirectionShare()),
                    p.driftMinutes() == null ? 0 : p.driftMinutes()));
        }
        facts.add("Ablak: %d nap, ebből %d napon volt rögzített étkezés (minimum %d)"
            .formatted(p.windowDays(), p.daysWithMeals(), p.minDaysWithMeals()));
        return List.copyOf(facts);
    }

    /** Round 2 S6 (mezo-d58h.7.7): a CORRELATION, stated as one. Three lines: how the two groups
     *  were formed, what each one's median afternoon energy was, and how big the sample is. No
     *  causal word appears — the whole card's honesty rests on that. */
    private static List<String> energyDipMealTiming(FlagPayloadEnvelope.EnergyDipMealTiming p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        if (ENERGY_DIP_BREAKFAST_PRESENCE.equals(p.splitMode())) {
            facts.add("Két csoport: %d nap rögzített reggelivel, %d nap anélkül"
                .formatted(p.groupADays(), p.groupBDays()));
        } else {
            facts.add("Két csoport: korábbi ebéd (jellemzően %s, %d nap) és későbbi ebéd (%s, %d nap)"
                .formatted(p.groupAMedianLunchTime(), p.groupADays(),
                    p.groupBMedianLunchTime(), p.groupBDays()));
        }
        facts.add("Délutáni energia mediánja: %s, illetve %s (különbség %s pont, küszöb %s)"
            .formatted(num(p.groupAMedianEnergy()), num(p.groupBMedianEnergy()),
                num(p.energyDelta()), num(p.minEnergyDelta())));
        facts.add("Ablak: %d nap, ebből %d nap volt értékelhető; a napok %s%%-ában áll fenn ez a sorrend"
            .formatted(p.windowDays(), p.qualifyingDays(), pct(p.superiority())));
        return List.copyOf(facts);
    }

    /** A 0.0-1.0 arány egész százalékként — null-biztos, mert a fél-kitöltött payload a
     *  sub-type szerinti normális állapot, nem hiba. */
    private static String pct(Double ratio) {
        return ratio == null ? "-" : String.format(HU, "%.0f", ratio * 100);
    }

    /** {@code LateEatingRule}'s frozen arm token, in the Hungarian noun the per-day fact uses. */
    private static String lateEatingArmHu(String arm) {
        if (arm == null) {
            return "";
        }
        return switch (arm) {
            case "bed" -> "közel a lefekvéshez";
            case "absolute" -> "túl későn";
            case "both" -> "közel a lefekvéshez és túl későn";
            default -> arm;
        };
    }

    /** Inverts {@code MetricSeriesService.clockHour}'s +24-below-noon shift back to a clock
     *  string for display — the payload freezes the shifted value (the arithmetic space the rule
     *  compared in), this only formats it. */
    private static String clockFromShiftedHour(double shiftedHour) {
        double wallClockHour = shiftedHour >= 24 ? shiftedHour - 24 : shiftedHour;
        int hour = (int) wallClockHour;
        int minute = (int) Math.round((wallClockHour - hour) * 60);
        if (minute == 60) {
            minute = 0;
            hour = (hour + 1) % 24;
        }
        return "%02d:%02d".formatted(hour, minute);
    }

    /** {@code LateEating.absoluteHour} (whole-branch review fix, bd mezo-d58h.6): unlike
     *  {@code anchorBedTimeHour} and the per-day meal hours above, this field is the RAW config
     *  threshold compared directly against {@code LATE_MEAL_HOUR} in its own plain 0.0-23.99
     *  space — it was never put through the +24-below-noon shift, so running it back through
     *  {@code clockFromShiftedHour}'s "subtract 24 if ≥ 24" step is simply the wrong inverse for
     *  it. A plain clock format is the only one that fits. */
    private static String plainClock(double hour) {
        int wholeHour = (int) hour;
        int minute = (int) Math.round((hour - wholeHour) * 60);
        if (minute == 60) {
            minute = 0;
            wholeHour = (wholeHour + 1) % 24;
        }
        return "%02d:%02d".formatted(wholeHour, minute);
    }

    /** {@code MuscleGroup.of}'s coarse English tokens (the actual matched value, frozen in the
     *  payload), in the Hungarian noun this card's prose uses for the "X-fókuszú edzés" pattern.
     *  An unmapped token falls back to itself rather than fabricating a translation — the card
     *  never says more than the payload actually froze. */
    private static String muscleHu(String muscle) {
        if (muscle == null) {
            return "";
        }
        return switch (muscle) {
            case "shoulder" -> "váll";
            case "chest" -> "mell";
            case "back" -> "hát";
            case "biceps" -> "bicepsz";
            case "triceps" -> "tricepsz";
            case "quad" -> "comb";
            case "ham" -> "hajlítóizom";
            case "glute" -> "far";
            case "calf" -> "vádli";
            case "core" -> "törzs";
            default -> muscle;
        };
    }

    private static String scoreOrDash(Integer score) {
        return score == null ? "–" : score.toString();
    }

    private static List<String> allHealthy(FlagPayloadEnvelope.AllHealthy p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Csendes időszak: %d nap probléma-jelzés nélkül, %d megfigyelt napból"
            .formatted(p.quietDays(), p.observedDays()));
    }

    /** One decimal, Hungarian comma — the display form the model may echo verbatim. */
    public static String num(double value) {
        return String.format(HU, "%.1f", value);
    }
}
