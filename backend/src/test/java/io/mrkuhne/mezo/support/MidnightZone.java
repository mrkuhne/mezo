package io.mrkuhne.mezo.support;

import java.time.LocalTime;
import java.time.ZoneOffset;

/**
 * The zone the midnight-simulating ITs pin their report clock to (mezo-7qpy, mezo-pk63): an offset
 * in which the current wall time is ALWAYS 00:00-00:30, so the day boundary that used to bite only
 * CI runs in the first minutes after local midnight is crossed on EVERY run.
 *
 * <p>The value is a single class-loader-wide constant on purpose. Each midnight IT used to compute
 * its own, which made every {@code @DynamicPropertySource} resolve to a DIFFERENT zone id and cost
 * Spring one extra cached application context per class; sharing one value collapses them back into
 * a single context. It is also computed once rather than per property resolution, because Spring
 * may query the supplier repeatedly and the zone must not drift as wall-clock time passes.
 */
public final class MidnightZone {

    /** An offset zone whose "now" is ~00:05. {@code ZoneOffset} supports ±18h, so this always resolves. */
    public static final String JUST_PAST_MIDNIGHT_ZONE_ID = computeJustPastMidnightZoneId();

    private MidnightZone() {
    }

    private static String computeJustPastMidnightZoneId() {
        LocalTime utcNow = LocalTime.now(ZoneOffset.UTC);
        int targetSeconds = 5 * 60;
        int offsetSeconds = targetSeconds - utcNow.toSecondOfDay();
        if (offsetSeconds < -18 * 3600) {
            offsetSeconds += 24 * 3600;
        }
        return ZoneOffset.ofTotalSeconds(offsetSeconds).getId();
    }
}
