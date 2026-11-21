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

    private static int i(LocalDate d) {
        return d.getDayOfWeek().getValue() - DayOfWeek.MONDAY.getValue();
    }
}
