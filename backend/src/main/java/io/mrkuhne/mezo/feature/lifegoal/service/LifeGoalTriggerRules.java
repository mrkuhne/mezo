package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
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

    /** A {@code checkin_energy_lte} küszöbe, ha a terv NEM mond sajátot (1–10 skála alsó harmada). */
    static final int DEFAULT_ENERGY_THRESHOLD = 4;

    /** A {@code planKey} hossza BÁJTBAN — 6 bájt = 12 hex, egy cél terv-listájához bőven elég. */
    private static final int PLAN_KEY_BYTES = 6;

    /** A {@code ritual_missed} adopciós ablaka: hány napra visszamenőleg kell EGY lezárt nap. */
    public static final int RITUAL_ADOPTION_WINDOW_DAYS = 14;

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
     * Egy terv TARTALMI azonosítója a dedup-kulcshoz (mezo-iizd.7 review, F2): az
     * {@code IfThenPlanJson}-nak nincs identitása, és a {@code LifeGoalService} minden PUT-nál a
     * TELJES listát cseréli — a lista-index tehát egy terv törlésekor/beszúrásakor elcsúszik, és
     * vagy elnémít egy másik tervet aznapra, vagy enged egy másodszori megszólalást. A kulcs ezért
     * a terv tartalmának SHA-256 lenyomata (első {@value #PLAN_KEY_BYTES} bájtja hexben, 12 karakter):
     * {@code ha + " " + akkor + " " + triggerSource}, {@code null} komponens = üres sztring.
     * Migráció-mentes és nem érint contractet.
     *
     * <p>Vállalt csere-üzlet: egy ÁTFOGALMAZOTT terv új kulcsot kap, tehát aznap újra
     * megszólalhat — ezt szándékosan új tervnek tekintjük, nem duplikátumnak.
     */
    public static String planKey(String ha, String akkor, String triggerSource) {
        String raw = nullToEmpty(ha) + " " + nullToEmpty(akkor) + " " + nullToEmpty(triggerSource);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, PLAN_KEY_BYTES);
        } catch (Exception e) {
            // unreachable — SHA-256 is JDK-guaranteed; error_handling.md forbids raw runtime types
            // (the HypothesisPipelineService.hypothesisKey precedent).
            throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR").build());
        }
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    /**
     * Kiváltja-e a nap értéke a tervet? {@code dayValue == null} = aznap nincs adat.
     * A {@code ritual_missed} az EGYETLEN hiány-alapú szabály: ott a hiányzó nap maga a jel.
     *
     * <p>FONTOS: a „nincs adat" NEM azonos azzal, hogy „a jel alszik" (nincs a forrást kiszolgáló
     * {@code SignalSource} bean). Az utóbbit a hívó ({@code LifeGoalTriggerService}) szűri ki még a
     * predikátum előtt — ide már csak valóban hiányzó nap érkezhet {@code null}-ként.
     */
    public static boolean matches(String triggerSource, String condition, BigDecimal dayValue) {
        if (triggerSource == null) {
            return false;
        }
        return switch (triggerSource) {
            case SPORT_SESSION_LOGGED -> dayValue != null && dayValue.signum() > 0;
            case CHECKIN_ENERGY_LTE -> matchesEnergy(condition, dayValue);
            case RITUAL_MISSED -> dayValue == null || dayValue.signum() == 0;
            default -> false;
        };
    }

    /**
     * A küszöb, vagy {@code null}, ha a terv mondott valamit, de az nem szám.
     *
     * <p>NINCS condition → a dokumentált 4-es alapérték (nincs vélemény, ez a józan default).
     * VAN condition, de értelmezhetetlen (az LLM szabad szöveget is adhat) → NEM tüzelünk:
     * a fallback ugyanis LAZÍTHAT a felhasználó szándékán (egy „&lt;=2" 4-re esne vissza,
     * kétszer lazábbra), ezért néma maradunk, nem tippelünk.
     */
    private static Integer threshold(String condition) {
        if (condition == null) {
            return DEFAULT_ENERGY_THRESHOLD;
        }
        try {
            return Integer.parseInt(condition.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static boolean matchesEnergy(String condition, BigDecimal dayValue) {
        Integer threshold = threshold(condition);
        return dayValue != null && threshold != null
            && dayValue.compareTo(BigDecimal.valueOf(threshold)) <= 0;
    }

    private static PillarSourceJson metric(String key) {
        return new PillarSourceJson("metric", key, null, null, null, null);
    }
}
