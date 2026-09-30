package io.mrkuhne.mezo.feature.companion.service;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

/** „Most ne” (U9b, mezo-zpxv7): a snoozed candidate leaves the inbox for this long, then is re-offered. */
public final class CandidateSnooze {
    public static final Duration DURATION = Duration.ofDays(14);

    /** S9 (mezo-d6ivw.10): the weekly fact-merge sweep's slot — {@code FactMergeJob}'s cron
     *  ({@code mezo.companion.fact-merge.cron}, Monday 07:30) in this zone. */
    public static final ZoneId MERGE_SWEEP_ZONE = ZoneId.of("Europe/Budapest");
    private static final LocalTime MERGE_SWEEP_TIME = LocalTime.of(7, 30);

    private CandidateSnooze() {
    }

    /** „Később” on a merge proposal (final-review I3): it sleeps until the NEXT Monday sweep —
     *  the card promises „jövő hétfőn” — strictly after {@code now}. */
    public static Instant nextMergeSweep(Instant now) {
        ZonedDateTime local = now.atZone(MERGE_SWEEP_ZONE);
        ZonedDateTime slot = local.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY))
                .with(MERGE_SWEEP_TIME);
        if (!slot.isAfter(local)) {
            slot = slot.plusWeeks(1).with(MERGE_SWEEP_TIME);
        }
        return slot.toInstant();
    }
}
