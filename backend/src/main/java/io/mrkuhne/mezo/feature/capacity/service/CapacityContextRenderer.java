package io.mrkuhne.mezo.feature.capacity.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Pure wording of the capacity verdict for the AI contexts (Boop B7 K2): it formats what {@link CapacityDay} already
 * holds and never produces a number. The "ezen a héten áttettük" line arrives with K3.
 */
@Component
public class CapacityContextRenderer {

    static final String PREFIX = "[Kapacitás] ";

    /** {@code [Kapacitás] ma: szoros (rövid éjszaka, 4 megbeszélés délelőtt) · tanuló}; {@code ""} for no day. */
    public String today(CapacityDay day) {
        return day == null ? "" : PREFIX + "ma: " + body(day);
    }

    /** One line per day, Monday first: {@code [Kapacitás] hétfő (11-23): rendben (...)}. */
    public String week(List<CapacityDay> days) {
        if (days == null || days.isEmpty()) {
            return "";
        }
        return days.stream().map(d -> PREFIX + dayName(d.date()) + " (" + d.date().toString().substring(5) + "): "
            + body(d)).collect(Collectors.joining("\n"));
    }

    private static String body(CapacityDay d) {
        StringBuilder b = new StringBuilder(d.verdict());
        if (d.reasonFacts() != null && !d.reasonFacts().isBlank()) {
            b.append(" (").append(d.reasonFacts()).append(')');
        }
        if (!d.calendarKnown()) {
            b.append(" · naptár nélkül");
        }
        if (d.tanulo()) {
            b.append(" · tanuló");
        }
        return b.toString();
    }

    private static String dayName(LocalDate date) {
        return switch (date.getDayOfWeek()) {
            case MONDAY -> "hétfő";
            case TUESDAY -> "kedd";
            case WEDNESDAY -> "szerda";
            case THURSDAY -> "csütörtök";
            case FRIDAY -> "péntek";
            case SATURDAY -> "szombat";
            case SUNDAY -> "vasárnap";
        };
    }
}
