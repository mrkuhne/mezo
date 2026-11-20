package io.mrkuhne.mezo.feature.season.service;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * The season's sleep need from the weekly training load (Boop B6 Évad, spec §5.5) — pure, no I/O.
 *
 * <pre>
 *   base = the sleep goal's target minutes when he set one, else 450 (7 h 30)
 *   need = min(base + 6 × weekly gym sessions + 6 × weekly sport sessions, 510)
 * </pre>
 *
 * <p>Research note: the general adult recommendation is 7–9 hours a night, and sports-science guidance treats
 * athletes as sitting at the upper end of that range (around 8 hours or more), with a heavier training load raising
 * the need for recovery sleep. The constants here are Boop's starting rule — a small increment per weekly session
 * and a cap at 8 h 30 so the need stays reachable — not a measured value; the "miért?" copy labels it as Boop's
 * rule. No study was consulted for the exact numbers.
 */
public final class SleepNeedRule {

    /** Base when he has no sleep goal of his own (7 h 30). */
    public static final int DEFAULT_BASE_MIN = 450;
    /** Added per weekly gym or sport session. */
    public static final int PER_SESSION_MIN = 6;
    /** The need never goes above 8 h 30. */
    public static final int CAP_MIN = 510;
    /** Falling asleep: a WAKE-anchored bedtime is this much before the need starts. */
    public static final int FALL_ASLEEP_MIN = 15;

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private SleepNeedRule() {
    }

    /** {@code base} = his own sleep goal minutes when set, else {@link #DEFAULT_BASE_MIN}. */
    public static int base(Integer sleepGoalTargetMinutes) {
        return sleepGoalTargetMinutes != null ? sleepGoalTargetMinutes : DEFAULT_BASE_MIN;
    }

    public static int sleepNeedMinutes(int baseMinutes, int gymPerWeek, int sportPerWeek) {
        return Math.min(baseMinutes + PER_SESSION_MIN * gymPerWeek + PER_SESSION_MIN * sportPerWeek, CAP_MIN);
    }

    /**
     * The bedtime ({@code HH:mm}): WAKE → {@code anchorTime − need − 15 min} (falling asleep), wrapping past
     * midnight; BED → the anchor itself.
     */
    public static String bedtime(String anchor, String anchorTime, int needMin) {
        if ("BED".equals(anchor)) {
            return anchorTime;
        }
        return LocalTime.parse(anchorTime).minusMinutes((long) needMin + FALL_ASLEEP_MIN).format(HH_MM);
    }
}
