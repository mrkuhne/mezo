package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import java.math.BigDecimal;
import java.util.Optional;

/**
 * A ha–akkor triggerek zárt szabálykészlete (mezo-iizd.7, spec §.7). A három forrás — pontosan
 * az, amit a {@code LifeGoalProposeLlmAdapter.TRIGGER_SOURCES} beenged — EGYETLEN alakra képződik
 * le: „egy metrika-jel adott napi értéke kielégít-e egy predikátumot". Ettől az azonnali
 * (esemény-listener) és a késleltetett (éjjeli job) ág UGYANAZT a döntést hozza, és a jel a
 * meglévő {@code SignalSource} diszpécseren jön — a lifegoal nem szerez új függőséget.
 *
 * <p>Tiszta, állapotmentes osztály: a {@code LifeGoalTriggerRulesTest} teljesen lefedi.
 */
public final class LifeGoalTriggerRules {

    public static final String SPORT_SESSION_LOGGED = "sport_session_logged";
    public static final String CHECKIN_ENERGY_LTE = "checkin_energy_lte";
    public static final String RITUAL_MISSED = "ritual_missed";

    /** A {@code checkin_energy_lte} küszöbe, ha a terv nem mond sajátot (1–10 skála alsó harmada). */
    static final int DEFAULT_ENERGY_THRESHOLD = 4;

    private LifeGoalTriggerRules() {}

    /** A trigger metrika-jele — ezt adjuk a SignalSource diszpécsernek. Ismeretlen forrás: üres. */
    public static Optional<PillarSourceJson> sourceFor(String triggerSource) {
        if (triggerSource == null) {
            return Optional.empty();
        }
        return switch (triggerSource) {
            case SPORT_SESSION_LOGGED -> Optional.of(metric("SPORT_LOAD_MIN"));
            case CHECKIN_ENERGY_LTE -> Optional.of(metric("CHECKIN_ENERGY"));
            case RITUAL_MISSED -> Optional.of(metric("RITUAL_CLOSED"));
            default -> Optional.empty();
        };
    }

    /**
     * Kiváltja-e a nap értéke a tervet? {@code dayValue == null} = aznap nincs adat.
     * A {@code ritual_missed} az EGYETLEN hiány-alapú szabály: ott a hiányzó nap maga a jel.
     */
    public static boolean matches(String triggerSource, String condition, BigDecimal dayValue) {
        if (triggerSource == null) {
            return false;
        }
        return switch (triggerSource) {
            case SPORT_SESSION_LOGGED -> dayValue != null && dayValue.signum() > 0;
            case CHECKIN_ENERGY_LTE ->
                dayValue != null && dayValue.compareTo(BigDecimal.valueOf(threshold(condition))) <= 0;
            case RITUAL_MISSED -> dayValue == null || dayValue.signum() == 0;
            default -> false;
        };
    }

    private static int threshold(String condition) {
        if (condition == null) {
            return DEFAULT_ENERGY_THRESHOLD;
        }
        try {
            return Integer.parseInt(condition.trim());
        } catch (NumberFormatException e) {
            // Az LLM szabad szöveget is adhat conditionnek; a nem-szám sosem lazíthat a küszöbön.
            return DEFAULT_ENERGY_THRESHOLD;
        }
    }

    private static PillarSourceJson metric(String key) {
        return new PillarSourceJson("metric", key, null, null, null, null);
    }
}
