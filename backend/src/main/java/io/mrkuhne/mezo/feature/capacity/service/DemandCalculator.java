package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * The pure day-demand model (Boop B7 K1). Unit = minutes x (mental+social+physical)/3 / 60. Back-to-back meetings
 * cost more, real gaps between meetings give a small credit, restoring items give load back.
 */
public final class DemandCalculator {

    static final double GAP_CREDIT_UNITS = 0.1;
    static final double RESTORE_SHARE = 0.5;
    static final int FIRST_HOUR = 6;
    static final int HOURLY_SLOTS = 19; // hours 06..24

    private DemandCalculator() {
    }

    /**
     * One thing with a start and an end that loads the day. {@code eventKey}: the calendar event's feedback key
     * (external id without the occurrence part), {@code null} for a training session. {@code feedback}: the owner's
     * own label of the event (drains | neutral | feeds), {@code null} when unlabelled.
     */
    public record TimedDemand(Instant start, Instant end, int mental, int social, int physical, boolean restores,
                              String label, String kind, String eventKey, String feedback) {
        public TimedDemand(Instant start, Instant end, int mental, int social, int physical, boolean restores,
                           String label, String kind) {
            this(start, end, mental, social, physical, restores, label, kind, null, null);
        }
    }

    /**
     * One item's contribution to the day, after the sequence factor; {@code eventKey} and {@code feedback} as on
     * {@link TimedDemand}.
     */
    public record DemandItem(String label, String kind, Instant start, Instant end, double units, boolean restores,
                             String eventKey, String feedback) {
    }

    public record Demand(double units, double mental, double social, double physical, List<DemandItem> items,
                         double[] hourly19) {
    }

    /** A training session as a demand item: planned physical 2 (heavy compound day 3); logged RPE >= 8 means 3. */
    public static TimedDemand training(Instant start, int durationMin, boolean heavyCompound, Integer loggedRpe,
                                       Integer loggedDurationMin, String label) {
        int minutes = loggedDurationMin != null ? loggedDurationMin : durationMin;
        int physical = loggedRpe != null ? (loggedRpe >= 8 ? 3 : 2) : (heavyCompound ? 3 : 2);
        return new TimedDemand(start, start.plus(Duration.ofMinutes(minutes)), 0, 0, physical, false, label,
                "training");
    }

    public static Demand day(List<TimedDemand> items, CapacityProperties p) {
        return day(items, p, ZoneOffset.UTC);
    }

    /**
     * One calendar day's demand: every item is first clipped to {@code [date 00:00, date+1 00:00)} in {@code zone}, so
     * an event crossing midnight (or spanning days) counts only the hours it has on this day; nothing left, no item.
     */
    public static Demand day(List<TimedDemand> items, CapacityProperties p, ZoneId zone, LocalDate date) {
        Instant from = date.atStartOfDay(zone).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(zone).toInstant();
        List<TimedDemand> clipped = new ArrayList<>();
        for (TimedDemand t : items) {
            Instant s = t.start().isBefore(from) ? from : t.start();
            Instant e = t.end().isAfter(to) ? to : t.end();
            if (e.isAfter(s)) {
                clipped.add(new TimedDemand(s, e, t.mental(), t.social(), t.physical(), t.restores(), t.label(),
                    t.kind(), t.eventKey(), t.feedback()));
            }
        }
        return day(clipped, p, zone);
    }

    public static Demand day(List<TimedDemand> items, CapacityProperties p, ZoneId zone) {
        List<TimedDemand> sorted = items.stream().sorted(Comparator.comparing(TimedDemand::start)).toList();
        double[] factor = new double[sorted.size()];
        java.util.Arrays.fill(factor, 1.0);
        double credit = markSequences(sorted, factor, p);

        double total = 0, mental = 0, social = 0, physical = 0;
        double[] hourly = new double[HOURLY_SLOTS];
        List<DemandItem> out = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            TimedDemand t = sorted.get(i);
            double hours = minutes(t) / 60.0;
            double f = factor[i] * (t.restores() ? -RESTORE_SHARE : 1.0);
            double units = hours * (t.mental() + t.social() + t.physical()) / 3.0 * f;
            total += units;
            mental += hours * t.mental() / 3.0 * f;
            social += hours * t.social() / 3.0 * f;
            physical += hours * t.physical() / 3.0 * f;
            spread(hourly, t, units, zone);
            out.add(new DemandItem(t.label(), t.kind(), t.start(), t.end(), units, t.restores(), t.eventKey(),
                t.feedback()));
        }
        total = Math.max(0, total - credit);
        return new Demand(total, mental, social, physical, List.copyOf(out), hourly);
    }

    private static boolean meeting(TimedDemand t) {
        return "meeting".equals(t.kind()) || "call".equals(t.kind());
    }

    private static long minutes(TimedDemand t) {
        return Math.max(0, Duration.between(t.start(), t.end()).toMinutes());
    }

    /**
     * Fills the sequence factor of meetings in unbroken long runs; returns the summed gap credit. Overlapping meetings
     * count once: a run's length is the union of its meetings, a gap is measured from the latest end so far.
     */
    private static double markSequences(List<TimedDemand> sorted, double[] factor, CapacityProperties p) {
        List<Integer> meetings = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            if (meeting(sorted.get(i))) {
                meetings.add(i);
            }
        }
        double credit = 0;
        int runStart = 0;
        Instant runEnd = null;
        long runMin = 0;
        for (int k = 0; k < meetings.size(); k++) {
            TimedDemand cur = sorted.get(meetings.get(k));
            // union length: only the part past the run's latest end adds minutes
            if (runEnd == null || !cur.start().isBefore(runEnd)) {
                runMin += minutes(cur);
                runEnd = cur.end();
            } else if (cur.end().isAfter(runEnd)) {
                runMin += Duration.between(runEnd, cur.end()).toMinutes();
                runEnd = cur.end();
            }
            boolean last = k == meetings.size() - 1;
            boolean breaks = last;
            if (!last) {
                TimedDemand next = sorted.get(meetings.get(k + 1));
                long gap = Duration.between(runEnd, next.start()).toMinutes();
                if (gap >= p.gapCreditMin()) {
                    credit += GAP_CREDIT_UNITS;
                    breaks = true;
                }
            }
            if (breaks) {
                if (runMin >= p.sequenceBlockMin()) {
                    for (int j = runStart; j <= k; j++) {
                        factor[meetings.get(j)] = p.sequenceFactor();
                    }
                }
                runStart = k + 1;
                runEnd = null;
                runMin = 0;
            }
        }
        return credit;
    }

    private static void spread(double[] hourly, TimedDemand t, double units, ZoneId zone) {
        long total = minutes(t);
        if (total == 0) {
            return;
        }
        var cursor = t.start().atZone(zone);
        var end = t.end().atZone(zone);
        while (cursor.isBefore(end)) {
            var nextHour = cursor.truncatedTo(java.time.temporal.ChronoUnit.HOURS).plusHours(1);
            var segEnd = nextHour.isBefore(end) ? nextHour : end;
            long seg = Duration.between(cursor, segEnd).toMinutes();
            int slot = cursor.getHour() - FIRST_HOUR;
            if (slot >= 0 && slot < HOURLY_SLOTS) {
                hourly[slot] += units * seg / total;
            }
            cursor = segEnd;
        }
    }
}
