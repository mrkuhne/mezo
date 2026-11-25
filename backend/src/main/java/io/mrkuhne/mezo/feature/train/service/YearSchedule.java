package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Re-dating of an Éves terv (mezo-r36n9.113, spec §7a). Pure: walks the loading blocks in ordinal order with a
 * cursor, letting reality (linked mesocycles, skips, today) move the dates, then fits the consolidation at the end.
 *
 * <p>A block is late when its mesocycle started more than {@code lateToleranceDays} after it was due; then everything
 * after it moves. A delay first eats the buffer (leftover weeks before the consolidation — the generator places
 * none, so a year whose blocks do not fill {@code yearWeeks − consolidation} always gets one here), then shortens
 * the consolidation to 1 week, and only then pushes the end past {@code yearWeeks}. The consolidation is always last;
 * like any planned block it re-dates from today when it has not started more than the tolerance after it was due.
 * A block followed by a mesocycle reports the weeks it actually took.
 */
public final class YearSchedule {

    private YearSchedule() {}

    /** A block's planned shape plus reality. {@code meso} is null when no mesocycle is linked. */
    public record Slot(UUID id, int ordinal, int weeks, int gapWeeks, String status, MesoFacts meso) {}

    /** The linked mesocycle's start, length, and close date (null while it runs). */
    public record MesoFacts(LocalDate start, int weeks, LocalDate closedOn) {}

    /** {@code bufferStart} is null when {@code bufferWeeks} is 0; {@code end} is the day after the consolidation. */
    public record Layout(List<Placed> blocks, Placed consolidation, int consolidationWeeks, int bufferWeeks,
                         LocalDate bufferStart, int overrunWeeks, LocalDate end) {}

    /** {@code occupies} is false for a skipped block (its weeks are free). */
    public record Placed(UUID id, LocalDate start, int weeks, boolean occupies) {}

    public static Layout layout(LocalDate planStart, List<Slot> loading, Slot consolidation,
                                int plannedConsolidationWeeks, LocalDate today, YearPlanProperties p) {
        int tol = p.lateToleranceDays();
        LocalDate cursor = planStart;
        List<Placed> placed = new ArrayList<>();
        List<Slot> ordered = loading.stream().sorted(Comparator.comparingInt(Slot::ordinal)).toList();
        for (Slot s : ordered) {
            LocalDate due = cursor.plusWeeks(Math.max(0, s.gapWeeks()));
            if (YearGenerator.SKIPPED.equals(s.status())) {
                placed.add(new Placed(s.id(), due, s.weeks(), false));
                continue;
            }
            if (s.meso() != null) {
                Span span = follow(s.meso(), due, tol);
                placed.add(new Placed(s.id(), span.start(), span.weeks(), true));
                cursor = mondayOnOrAfter(span.end());
            } else {
                LocalDate start = due;
                if (YearGenerator.PLANNED.equals(s.status()) && today.isAfter(due.plusDays(tol))) {
                    start = mondayOnOrAfter(today);
                }
                placed.add(new Placed(s.id(), start, s.weeks(), true));
                cursor = start.plusWeeks(s.weeks());
            }
        }

        cursor = cursor.plusWeeks(Math.max(0, consolidation.gapWeeks()));
        LocalDate yearEnd = planStart.plusWeeks(p.yearWeeks());
        int planned = Math.max(1, plannedConsolidationWeeks);
        long room = weeksBetween(cursor, yearEnd);
        LocalDate consStart;
        int consWeeks;
        if (room >= planned) {
            consWeeks = planned;
            consStart = yearEnd.minusWeeks(planned);
        } else if (room >= 1) {
            consWeeks = 1;
            consStart = yearEnd.minusWeeks(1);
        } else {
            consWeeks = 1;
            consStart = cursor;
        }
        LocalDate consEnd = consStart.plusWeeks(consWeeks);
        if (consolidation.meso() != null) {
            Span span = follow(consolidation.meso(), consStart, tol);
            consStart = span.start();
            consEnd = span.end();
            consWeeks = span.weeks();
        } else if (YearGenerator.PLANNED.equals(consolidation.status()) && today.isAfter(consStart.plusDays(tol))) {
            consStart = mondayOnOrAfter(today);
            consEnd = consStart.plusWeeks(consWeeks);
        }
        int buffer = (int) Math.max(0, weeksBetween(cursor, consStart));
        int overrun = (int) Math.max(0, Math.ceilDiv(ChronoUnit.DAYS.between(yearEnd, consEnd), 7));
        Placed cons = new Placed(consolidation.id(), consStart, consWeeks, true);
        return new Layout(List.copyOf(placed), cons, consWeeks, buffer, buffer > 0 ? cursor : null, overrun, consEnd);
    }

    private record Span(LocalDate start, LocalDate end) {
        /** The weeks the block actually took (an early close or a different-length meso changes it). */
        int weeks() {
            return (int) Math.max(1, Math.ceilDiv(ChronoUnit.DAYS.between(start, end), 7));
        }
    }

    /** On time (within tolerance) keeps the due date; late uses the meso's own; an early close ends it there. */
    private static Span follow(MesoFacts m, LocalDate due, int tol) {
        LocalDate start = Math.abs(ChronoUnit.DAYS.between(due, m.start())) <= tol ? due : m.start();
        LocalDate end = start.plusWeeks(m.weeks());
        if (m.closedOn() != null && m.closedOn().isBefore(end.minusDays(tol))) {
            end = mondayOnOrAfter(m.closedOn());
        }
        return new Span(start, end);
    }

    private static LocalDate mondayOnOrAfter(LocalDate d) {
        return d.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
    }

    private static long weeksBetween(LocalDate from, LocalDate to) {
        return Math.floorDiv(ChronoUnit.DAYS.between(from, to), 7);
    }
}
