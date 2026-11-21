package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.service.Effects.DayEffect;
import io.mrkuhne.mezo.feature.capacity.service.Effects.RestEffect;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * The "Minden hatása" compare lines of a proposal (Boop B7 K3, mezo-r36n9.17, spike screen 05 *Mi változik*): label,
 * Most, Utána and which way it tips. Pure; every figure is an {@link Effects} field — an unknown one reads "–".
 */
public final class ProposalCompareLines {

    /** One row; {@code favours} 1 = the change helps, -1 = it costs, 0 = neutral. */
    public record Line(String label, String before, String after, int favours) {

        public Map<String, Object> toMap() {
            return Map.of("label", label, "before", before, "after", after, "favours", favours);
        }

        public static Line fromMap(Map<?, ?> m) {
            Object f = m.get("favours");
            return new Line(String.valueOf(m.get("label")), String.valueOf(m.get("before")),
                String.valueOf(m.get("after")), f instanceof Number n ? n.intValue() : 0);
        }
    }

    static final String UNKNOWN = "–";
    private static final List<String> RANK = List.of("laza", "rendben", "szoros", "túl sok");
    private static final List<String> MONTH =
        List.of("jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec.");

    private ProposalCompareLines() {
    }

    public static List<Line> lines(Effects e) {
        List<Line> out = new ArrayList<>();
        for (DayEffect d : e.days()) {
            if (!Objects.equals(d.verdictBefore(), d.verdictAfter()) || d.ratioBefore() != d.ratioAfter()) {
                out.add(new Line(HuDays.cap(HuDays.name(d.date())) + " terhe", d.verdictBefore(), d.verdictAfter(),
                    verdictFavours(d.verdictBefore(), d.verdictAfter())));
            }
        }
        for (DayEffect d : e.days()) {
            if (!Objects.equals(d.expectedExtraBefore(), d.expectedExtraAfter())) {
                out.add(new Line(HuDays.cap(HuDays.adj(d.date())) + " edzésnapi többlet", kcal(d.expectedExtraBefore()),
                    kcal(d.expectedExtraAfter()), 0));
            }
        }
        for (RestEffect r : e.rest()) {
            out.add(new Line("Pihenő " + HuDays.the(r.label(), false) + " előtt", r.before() + " nap", r.after() + " nap",
                Integer.compare(r.after(), r.before())));
        }
        if (e.sleep() != null) {
            out.add(new Line("Lefekvés " + HuDays.on(e.sleep().night()), time(e.sleep().bedtimeBefore()),
                time(e.sleep().bedtimeAfter()), 0));
            out.add(new Line("Alvás aznap éjjel", HuDays.duration(e.sleep().needMin()),
                HuDays.duration(e.sleep().needMin()), 0));
        }
        out.add(new Line("Heti edzés", String.valueOf(e.before().sessions()), String.valueOf(e.after().sessions()),
            0));
        out.add(new Line("Heti kalória", kcalPlain(e.before().expectedKcal()), kcalPlain(e.after().expectedKcal()),
            0));
        String season = date(e.seasonTargetDate());
        out.add(new Line("Súlycél", season, season, 0));
        return List.copyOf(out);
    }

    /** Lighter is better; a heavier day is a cost only once it reaches szoros. */
    static int verdictFavours(String before, String after) {
        int b = RANK.indexOf(before);
        int a = RANK.indexOf(after);
        if (a < 0 || b < 0 || a == b) {
            return 0;
        }
        if (a < b) {
            return 1;
        }
        return a >= RANK.indexOf("szoros") ? -1 : 0;
    }

    private static String kcal(Integer v) {
        return v == null ? UNKNOWN : thousands(v) + " kcal";
    }

    private static String kcalPlain(Integer v) {
        return v == null ? UNKNOWN : thousands(v);
    }

    /** „17 920” — a no-break space between the thousands. */
    static String thousands(int v) {
        String s = Integer.toString(Math.abs(v));
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            if (i > 0 && (s.length() - i) % 3 == 0) {
                sb.append(' ');
            }
            sb.append(s.charAt(i));
        }
        return (v < 0 ? "-" : "") + sb;
    }

    private static String time(LocalTime t) {
        return t == null ? UNKNOWN : HuDays.time(t);
    }

    private static String date(LocalDate d) {
        return d == null ? UNKNOWN : MONTH.get(d.getMonthValue() - 1) + " " + d.getDayOfMonth() + ".";
    }
}
