package io.mrkuhne.mezo.feature.capacity.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Hungarian weekday forms for the proposal words (Boop B7 K3): „csütörtök”, „csütörtöki”, „csütörtökön”, „csütörtökre”. */
final class HuDays {

    private static final List<String> NAME =
        List.of("hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat", "vasárnap");
    private static final List<String> ADJ =
        List.of("hétfői", "keddi", "szerdai", "csütörtöki", "pénteki", "szombati", "vasárnapi");
    private static final List<String> ON =
        List.of("hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton", "vasárnap");
    private static final List<String> ONTO =
        List.of("hétfőre", "keddre", "szerdára", "csütörtökre", "péntekre", "szombatra", "vasárnapra");

    private HuDays() {
    }

    static String name(LocalDate d) {
        return NAME.get(i(d));
    }

    static String adj(LocalDate d) {
        return ADJ.get(i(d));
    }

    static String on(LocalDate d) {
        return ON.get(i(d));
    }

    static String onto(LocalDate d) {
        return ONTO.get(i(d));
    }

    static String cap(String s) {
        return s == null || s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** {@code H:mm} — the way the cards write a clock time („6:45”, „18:00”). */
    static String time(LocalTime t) {
        return t.getHour() + ":" + String.format("%02d", t.getMinute());
    }

    /** „7 óra 30 perc” / „7 óra”. */
    static String duration(int minutes) {
        int h = minutes / 60;
        int m = minutes % 60;
        return m == 0 ? h + " óra" : h + " óra " + m + " perc";
    }

    private static final String VOWELS = "aáeéiíoóöőuúüű";

    /**
     * The definite article before {@code next} as it is read aloud: „az” before a vowel and before a number read
     * with one („5” öt, „1:15” egy óra, „1000” ezer), „a” otherwise („10” tíz, „150” százötven, „7 óra”).
     */
    static String article(String next) {
        if (next == null || next.isBlank()) {
            return "a";
        }
        String t = next.strip();
        char c = Character.toLowerCase(t.charAt(0));
        if (Character.isDigit(c)) {
            int end = 0;
            while (end < t.length() && Character.isDigit(t.charAt(end))) {
                end++;
            }
            String digits = t.substring(0, end);
            if (c == '5') {
                return "az";
            }
            // a leading 1 reads „egy…” / „ezer…” / „egymillió…” only when it starts a group of three
            return c == '1' && digits.length() % 3 == 1 ? "az" : "a";
        }
        return VOWELS.indexOf(c) >= 0 ? "az" : "a";
    }

    /** {@code article(next) + " " + next}, capitalised when {@code cap}. */
    static String the(String next, boolean cap) {
        String a = article(next);
        return (cap ? cap(a) : a) + " " + next;
    }

    /**
     * The vetted accusative forms of common session labels (lower-cased label → the title's object). A label is never
     * suffixed by rule — Hungarian stems are too irregular („hát” → „hátat”, not „hátot”) — so anything missing here
     * takes the caller's always-grammatical fallback.
     */
    private static final java.util.Map<String, String> SESSION_ACCUSATIVE = java.util.Map.of(
        "lábnap", "lábnapot",
        "láb", "lábedzést",
        "hát", "hátedzést",
        "kar", "karedzést",
        "váll", "válledzést",
        "mell", "melledzést",
        "has", "hasedzést");

    /** The vetted accusative of a session label („Lábnap” → „lábnapot”, „Hát” → „hátedzést”); empty otherwise. */
    static java.util.Optional<String> accusative(String label) {
        if (label == null) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.ofNullable(
            SESSION_ACCUSATIVE.get(label.strip().toLowerCase(java.util.Locale.ROOT)));
    }

    private static int i(LocalDate d) {
        return d.getDayOfWeek().getValue() - DayOfWeek.MONDAY.getValue();
    }
}
