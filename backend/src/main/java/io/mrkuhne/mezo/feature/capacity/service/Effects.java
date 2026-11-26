package io.mrkuhne.mezo.feature.capacity.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

/**
 * Every cross-effect of one proposal, each figure from a real engine (Boop B7 K3, mezo-r36n9.17, spec §5.5): the load
 * model's verdict before → after per touched day, the fuel day service's expected extra of the day's unlogged sessions
 * ({@code pendingMovementKcal} — it joins the target only once the session is logged), the rest days before a sport
 * slot that change, the night's bedtime and the {@code SleepNeedRule} need, the week totals and the season's target
 * date (read, never recomputed). A figure the engines cannot give is {@code null} ("–" on the card).
 *
 * @param sessionKcal the expected net kcal of the session the bundle moves, shortens or skips (null when none)
 */
public record Effects(List<DayEffect> days, List<RestEffect> rest, SleepEffect sleep, WeekTotals before,
                      WeekTotals after, LocalDate seasonTargetDate, Integer sessionKcal) {

    /** One touched day: verdict and expected extra before → after. */
    public record DayEffect(LocalDate date, String verdictBefore, String verdictAfter, double ratioBefore,
                            double ratioAfter, Integer expectedExtraBefore, Integer expectedExtraAfter) {
    }

    /** A sport slot whose rest days before it change. */
    public record RestEffect(LocalDate sportDate, String label, int before, int after) {
    }

    /** One night's bedtime before → after, and his nightly need. */
    public record SleepEffect(LocalDate night, LocalTime bedtimeBefore, LocalTime bedtimeAfter, int needMin) {
    }

    /** The week: gym sessions, expected kcal (served targets + expected extras), planned sleep hours. */
    public record WeekTotals(int sessions, Integer expectedKcal, Double sleepHours) {
    }

    public Optional<DayEffect> day(LocalDate date) {
        return days.stream().filter(d -> d.date().equals(date)).findFirst();
    }
}
