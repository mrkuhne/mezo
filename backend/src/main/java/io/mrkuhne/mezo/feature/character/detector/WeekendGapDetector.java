package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Weekend gap (round 4, spec §5.3): two deterministic halves of "how much does the week split in
 * two". (a) Social jetlag in Roenneberg's definition — |midsleep on free nights − midsleep on work
 * nights| from the sleep log's own bedtime/wakeup clocks, 1 h / 2 h bands; free night = a sleep
 * row dated Saturday or Sunday (the row's date is the wake-up day). (b) A logging-coverage gap:
 * the share of weekend days with ANY log (meal, check-in, water) vs. the weekday share.
 *
 * <p>Weekend is Saturday/Sunday in the server zone — the system holds no obligation schedule and
 * no timezone (an accepted, stated limitation). No new-data pre-filter (spec §4.3). State =
 * {@code <jetlag band>|<gap flag>}, never null: the coverage half is always computable.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class WeekendGapDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 49;
    static final int MIN_FREE_NIGHTS = 6;
    static final int MIN_WORK_NIGHTS = 15;
    static final int JETLAG_MODERATE_MIN = 60;
    static final int JETLAG_HIGH_MIN = 120;
    static final double COVERAGE_GAP_MIN = 0.25;
    private static final int MINUTES_PER_DAY = 1440;

    @Override
    public String key() {
        return "weekend-gap";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today.key().equals(yesterday.key())) {
            return List.of();
        }
        String sleepPart;
        if ("keves".equals(today.jetlagBand())) {
            sleepPart = "Az alvásközép-eltoláshoz még kevés a hétvégi alvásnapló (" + today.freeNights()
                    + " szabad-éjszaka; legalább " + MIN_FREE_NIGHTS + " szabad és " + MIN_WORK_NIGHTS
                    + " munkaéjszaka kell).";
        } else {
            String bandHu = switch (today.jetlagBand()) {
                case "jelentos" -> "jelentős";
                case "mersekelt" -> "mérsékelt";
                default -> "nincs érdemi";
            };
            sleepPart = "Hétvégén az alvásközéped átlag " + Math.abs(today.jetlagMinutes()) + " perccel "
                    + (today.jetlagMinutes() >= 0 ? "később" : "korábban") + " esik, mint hétköznap — " + bandHu
                    + " social jetlag a Roenneberg-sávok szerint, " + today.freeNights() + " szabad- és "
                    + today.workNights() + " munkaéjszakából.";
        }
        String gapPart = " A logolás hétvégén a napok " + TrailingWindow.pct(today.weekendCoverage()) + "%-án történt, hétköznap "
                + TrailingWindow.pct(today.weekdayCoverage()) + "%-án"
                + ("res".equals(today.gapFlag()) ? " — hétvégi rés." : ", nincs érdemi rés.")
                + " Hétvége itt szombat–vasárnap.";
        boolean loud = "jelentos".equals(today.jetlagBand()) || "res".equals(today.gapFlag());
        return List.of(new DetectorSignal(key(), "antropologus", sleepPart + gapPart, loud ? 4 : 3));
    }

    /** Midsleep as minutes after midnight, wrapping a wake-up on the next calendar day. */
    static int midsleepMinutes(LocalTime bedtime, LocalTime wakeup) {
        int bed = bedtime.toSecondOfDay() / 60;
        int wake = wakeup.toSecondOfDay() / 60;
        if (wake <= bed) {
            wake += MINUTES_PER_DAY;
        }
        return ((bed + wake) / 2) % MINUTES_PER_DAY;
    }

    private static boolean weekend(LocalDate d) {
        return d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY;
    }

    record State(String key, String jetlagBand, int jetlagMinutes, int freeNights, int workNights,
                 String gapFlag, double weekendCoverage, double weekdayCoverage) {}

    static State state(DetectorInput in, LocalDate asOf) {
        List<Integer> free = new ArrayList<>();
        List<Integer> work = new ArrayList<>();
        for (DetectorInput.SleepPoint s : in.trend().sleepEightWeeks()) {
            if (s.bedtime() == null || s.wakeup() == null || !TrailingWindow.inWindow(s.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            (weekend(s.date()) ? free : work).add(midsleepMinutes(s.bedtime(), s.wakeup()));
        }
        String jetlagBand = "keves";
        int jetlagMinutes = 0;
        if (free.size() >= MIN_FREE_NIGHTS && work.size() >= MIN_WORK_NIGHTS) {
            jetlagMinutes = (int) Math.round(mean(free) - mean(work));
            int abs = Math.abs(jetlagMinutes);
            jetlagBand = abs >= JETLAG_HIGH_MIN ? "jelentos" : abs >= JETLAG_MODERATE_MIN ? "mersekelt" : "nincs";
        }

        Set<LocalDate> logged = new HashSet<>();
        in.trend().mealDays().forEach(m -> logged.add(m.date()));
        in.trend().checkinDays().forEach(c -> logged.add(c.date()));
        in.trend().waterDays().forEach(w -> logged.add(w.date()));
        int weekendDays = 0;
        int weekendLogged = 0;
        int weekdayDays = 0;
        int weekdayLogged = 0;
        for (LocalDate d = asOf.minusDays(WINDOW_DAYS - 1L); !d.isAfter(asOf); d = d.plusDays(1)) {
            boolean isLogged = logged.contains(d);
            if (weekend(d)) {
                weekendDays++;
                weekendLogged += isLogged ? 1 : 0;
            } else {
                weekdayDays++;
                weekdayLogged += isLogged ? 1 : 0;
            }
        }
        double weekendCoverage = weekendDays == 0 ? 0 : (double) weekendLogged / weekendDays;
        double weekdayCoverage = weekdayDays == 0 ? 0 : (double) weekdayLogged / weekdayDays;
        String gapFlag = weekdayCoverage - weekendCoverage >= COVERAGE_GAP_MIN ? "res" : "nincs-res";
        return new State(jetlagBand + "|" + gapFlag, jetlagBand, jetlagMinutes, free.size(), work.size(),
                gapFlag, weekendCoverage, weekdayCoverage);
    }

    private static double mean(List<Integer> values) {
        double sum = 0;
        for (int v : values) {
            sum += v;
        }
        return sum / values.size();
    }
}
