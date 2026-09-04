package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The advice card's FACTS (spec §5): deterministic, numeric, rule-provided lines rendered from the
 * raise's own frozen {@code companion_flag_log.payload}. Nothing here re-derives a rule — the
 * payload already froze both the thresholds and the observed values at raise time, which is the
 * whole point of {@code FlagPayloadEnvelope}.
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
public final class AdviceFactRenderer {

    private static final Locale HU = Locale.of("hu");

    private AdviceFactRenderer() {
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
            default -> List.of();
        };
    }

    private static List<String> sleepDebt(FlagPayloadEnvelope.SleepDebt p) {
        if (p == null) {
            return List.of();
        }
        return List.of("Alvásadósság: %s óra/éjszaka (cél %s óra, %d rögzített éjszaka %d-ből)"
            .formatted(num(p.deficitHours()), num(p.goalHours()), p.loggedNights(), p.nights()));
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
    private static String num(double value) {
        return String.format(HU, "%.1f", value);
    }
}
