package io.mrkuhne.mezo.feature.penz.service.practice;

import io.mrkuhne.mezo.feature.penz.service.news.DigestFigures;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Mistake;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Setup;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Week;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The weekly review's Hungarian copy (Boop Pénz L7, mezo-r36n9.105, build notes calls 1 and 9) — deterministic
 * templates over the computed {@link Week}, no model call, so no sentence can carry a number that was not computed.
 * Modelled on the approved spike's Gyakorlás tab. Boundary (spec §6): it never urges, never promises a return, never
 * says sell — it states what happened. Forints are formatted the way the L6 digest does ({@link DigestFigures}),
 * R with one decimal and a decimal comma ("+0,8R"). {@code *…*} is the phone's emphasis.
 */
public final class PracticeCopy {

    /** Below this many tagged closed trades the figures are noise (research §5.5). */
    public static final int NOISE_THRESHOLD = 50;
    private static final char MINUS = '−';

    private PracticeCopy() {
    }

    public record Observation(String title, String body) {
    }

    /** The week's highlight (null/null without a closed trade) and 0–3 observations. */
    public record Copy(String headline, String sub, List<Observation> observations) {
    }

    /** {@code +0,8R} / {@code −1,7R} / {@code 0,0R}: one decimal HALF_UP, decimal comma, signed. */
    public static String rText(BigDecimal r) {
        BigDecimal one = r.setScale(1, RoundingMode.HALF_UP);
        String digits = one.abs().toPlainString().replace('.', ',');
        return (one.signum() > 0 ? "+" : one.signum() < 0 ? String.valueOf(MINUS) : "") + digits + "R";
    }

    /** The sample-size line under 50 tagged trades, else null. */
    public static String noiseLine(int taggedCount) {
        return taggedCount < NOISE_THRESHOLD
            ? NOISE_THRESHOLD + " jelölt kereskedés alatt ezek a számok még zajnak számítanak — most " + taggedCount
                + " van."
            : null;
    }

    public static Copy week(Week w) {
        if (w.closedCount() == 0) {
            return new Copy(null, null, List.of());
        }
        String limit = rText(WeeklyReview.LIMIT);
        String headline;
        String sub;
        Mistake m = w.commonMistake();
        if (m != null && m.costHufMinor() > 0) {
            String phrase = capitalize(m.tag().mistakePhrase());
            boolean tookTheWeek = w.netPnlHufMinor() < 0;
            headline = tookTheWeek ? phrase + " vitte el a hetet" : phrase + " volt a hét leggyakoribb hibája";
            String split = w.cleanCount() > 0
                ? w.closedCount() + " lezárt kereskedésből " + w.cleanCount() + " hiba nélkül ment — azok átlagban *"
                    + rText(w.cleanAvgR()) + "*-t hoztak. A hibának jelöltek átlaga *" + rText(w.mistakeAvgR())
                    + "* lett."
                : "A héten minden lezárt kereskedésedet hibának jelölted, az átlaguk *" + rText(w.mistakeAvgR())
                    + "* lett.";
            String cost = "*" + DigestFigures.hufMagnitude(m.costHufMinor()) + "-ba*";
            sub = split + (tookTheWeek
                ? " " + phrase + " a hét leggyakoribb hibája, és " + cost + " került."
                : " Ez összesen " + cost + " került.");
        } else if (m != null) {
            headline = capitalize(m.tag().mistakePhrase()) + " volt a hét leggyakoribb hibája";
            sub = closedLine(w) + " A hibának jelöltek ezúttal nem kerültek pénzbe — ettől még hibák maradnak.";
        } else if (w.distribution().healthy()) {
            headline = "Tiszta hét: egyik kereskedést sem jelölted hibának";
            boolean anyLoss = w.netPnlHufMinor() < 0 || w.bySetup().stream().anyMatch(s -> s.wins() < s.count());
            sub = closedLine(w) + " Egyik sem ment *" + limit + "* alá"
                + (anyLoss ? ", a veszteségek a terv szerint kicsik maradtak." : ".");
        } else {
            headline = "A héten " + w.distribution().worseThanLimit() + " kereskedés " + limit + " alatt zárt";
            sub = closedLine(w) + " A " + limit + " alatti zárás azt jelzi, hogy a veszteség nagyobb lett a "
                + "tervezettnél.";
        }
        return new Copy(headline, sub, observations(w));
    }

    private static List<Observation> observations(Week w) {
        List<Observation> out = new ArrayList<>();
        if (w.mistakeCount() > 0 && w.cleanCount() > 0 && w.mistakeAvgR() != null && w.cleanAvgR() != null) {
            out.add(new Observation("A hibák a döntők", "A hibának jelölt kereskedéseid átlaga "
                + rText(w.mistakeAvgR()) + ", a többié " + rText(w.cleanAvgR()) + ". " + w.closedCount()
                + " kereskedésnél ez még nem bizonyíték, csak feltűnő."));
        }
        if (w.stopBrokenCount() > 0) {
            out.add(new Observation("A kilépési szint nem mindig tartott", w.stopBrokenCount()
                + " kereskedés a kilépési szinteden túl zárt — ott a veszteség nagyobb lett a tervezettnél."));
        }
        w.bySetup().stream().filter(s -> s.count() >= 2 && s.wins() == 0).findFirst()
            .ifPresent(s -> out.add(new Observation("Gyenge pont: " + lowerFirst(s), "Ezzel a címkével "
                + s.count() + " kereskedést zártál a héten, és egyik sem lett nyereséges.")));
        w.bySetup().stream().filter(s -> s.count() >= 2 && s.wins() == s.count()).findFirst()
            .ifPresent(s -> out.add(new Observation("Erős pont: " + lowerFirst(s), "Ezzel a címkével "
                + s.count() + " kereskedést zártál a héten, és mind nyereséges lett. Ennyiből ez még nem szabály.")));
        if (w.earlyCloseWins() >= 2) {
            out.add(new Observation("A nyereséges kereskedéseket korán zárod",
                w.earlyCloseWins() + " nyereséges kereskedést zártál a tervezett szint előtt."));
        }
        return out.size() > 3 ? List.copyOf(out.subList(0, 3)) : List.copyOf(out);
    }

    private static String closedLine(Week w) {
        return w.closedCount() + " kereskedést zártál, átlagban *" + rText(w.avgR()) + "* eredménnyel.";
    }

    private static String capitalize(String s) {
        return s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }

    private static String lowerFirst(Setup s) {
        String label = s.tag().label();
        return label.substring(0, 1).toLowerCase(Locale.of("hu")) + label.substring(1);
    }
}
