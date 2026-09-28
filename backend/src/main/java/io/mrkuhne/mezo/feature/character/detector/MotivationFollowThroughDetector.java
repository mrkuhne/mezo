package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Motivation × follow-through (Check-in 2.0, mezo-ck2, spec §3.7) — does the MORNING motivation
 * answer predict what actually got done that day? Drill's promise–delivery lens, without shame.
 *
 * <p>Morning motivation = the mean of the day's check-in ROWS before {@link #MORNING_END} that
 * answered motivation. Follow-through = done / planned over the day's planned items:
 * <ul>
 *   <li>the planned gym workout — a weekday in the active meso's schedule, counted only from the
 *       first gym session of the 8-week series on (before that the user was not training on this
 *       plan, so an empty weekday is not a miss); done = a completed gym session that day;
 *   <li>every habit row of the day; done = done as of the observed day.
 * </ul>
 * A day with no planned item or no morning motivation is not paired.
 *
 * <p>Whoop guard: low-motivation days ({@code <= }{@link #LOW_MAX}) and high-motivation days
 * ({@code >= }{@link #HIGH_MIN}) each need {@link #MIN_DAYS_PER_GROUP} paired days. State: the
 * band — {@code kovet} (high days deliver ≥ {@link #BAND_GAP} more), {@code fuggetlen} (within
 * {@link #FLAT_GAP}: you deliver regardless of mood — worth saying too), {@code forditott} (low days
 * deliver more), or null in between. State-change gate over the 8-week series.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MotivationFollowThroughDetector implements CharacterDetector {

    static final String MORNING_END = "12:00";
    static final int LOW_MAX = 4;
    static final int HIGH_MIN = 7;
    static final int MIN_DAYS_PER_GROUP = 5;
    static final double BAND_GAP = 0.2;
    static final double FLAT_GAP = 0.1;

    @Override
    public String key() {
        return "motivation-follow-through";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || (yesterday != null && today.band().equals(yesterday.band()))) {
            return List.of();
        }
        String head = "Az alacsony reggeli motivációjú napjaidon (4 vagy alatta, " + today.lowDays()
                + " nap) a tervezett edzés és szokások " + TrailingWindow.pct(today.lowRate())
                + "%-a teljesült, a magas motivációjú napokon (7 vagy fölötte, " + today.highDays() + " nap) "
                + TrailingWindow.pct(today.highRate()) + "%-a.";
        String tail = switch (today.band()) {
            case "kovet" -> " A reggeli kedved előre jelzi, mennyit teljesítesz — a gyenge reggeleken egy kisebb, "
                    + "biztos lépés többet ér a teljes tervnél.";
            case "fuggetlen" -> " A kedvedtől függetlenül hozod a tervet — a motiváció nálad nem feltétel.";
            default -> " A gyengébb kedvű reggeleken többet teljesítesz — a motiváció nálad nem feltétel.";
        };
        return List.of(new DetectorSignal(key(), "drill", head + tail, "kovet".equals(today.band()) ? 4 : 3));
    }

    record State(String band, int lowDays, int highDays, double lowRate, double highRate) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, double[]> motivation = new HashMap<>(); // sum, n
        for (DetectorInput.CheckinSlotPoint s : in.trend().checkinSlots()) {
            if (s.motivation() == null || s.date().isAfter(asOf) || s.slotTime() == null
                    || s.slotTime().compareTo(MORNING_END) >= 0) {
                continue;
            }
            double[] acc = motivation.computeIfAbsent(s.date(), k -> new double[2]);
            acc[0] += s.motivation();
            acc[1]++;
        }
        if (motivation.isEmpty()) {
            return null;
        }
        Set<LocalDate> gymDates = new HashSet<>();
        LocalDate firstGym = null;
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            if (g.date().isAfter(asOf)) {
                continue;
            }
            gymDates.add(g.date());
            if (firstGym == null || g.date().isBefore(firstGym)) {
                firstGym = g.date();
            }
        }
        Map<LocalDate, DetectorInput.HabitDayPoint> habits = new HashMap<>();
        for (DetectorInput.HabitDayPoint h : in.trend().habitDays()) {
            habits.put(h.date(), h);
        }
        double lowSum = 0;
        double highSum = 0;
        int lowDays = 0;
        int highDays = 0;
        for (Map.Entry<LocalDate, double[]> e : motivation.entrySet()) {
            LocalDate d = e.getKey();
            int planned = 0;
            int done = 0;
            if (in.meso() != null && firstGym != null && !d.isBefore(firstGym)
                    && in.meso().plannedDays().contains(d.getDayOfWeek())) {
                planned++;
                if (gymDates.contains(d)) {
                    done++;
                }
            }
            DetectorInput.HabitDayPoint h = habits.get(d);
            if (h != null) {
                planned += h.planned();
                done += h.done();
            }
            if (planned == 0) {
                continue;
            }
            double m = e.getValue()[0] / e.getValue()[1];
            double rate = (double) done / planned;
            if (m <= LOW_MAX) {
                lowDays++;
                lowSum += rate;
            } else if (m >= HIGH_MIN) {
                highDays++;
                highSum += rate;
            }
        }
        if (lowDays < MIN_DAYS_PER_GROUP || highDays < MIN_DAYS_PER_GROUP) {
            return null;
        }
        double lowRate = lowSum / lowDays;
        double highRate = highSum / highDays;
        double gap = highRate - lowRate;
        String band;
        if (gap >= BAND_GAP) {
            band = "kovet";
        } else if (Math.abs(gap) <= FLAT_GAP) {
            band = "fuggetlen";
        } else if (gap <= -BAND_GAP) {
            band = "forditott";
        } else {
            return null;
        }
        return new State(band, lowDays, highDays, lowRate, highRate);
    }
}
