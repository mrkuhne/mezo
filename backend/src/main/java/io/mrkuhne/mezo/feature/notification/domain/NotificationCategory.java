package io.mrkuhne.mezo.feature.notification.domain;

import java.util.Arrays;
import java.util.Optional;

/**
 * The 14 push-notification categories (bd mezo-h4wp.6.2, mezo-gst9). This enum is the single source of truth
 * for which categories exist, which default ON, which carry a notification-side lead offset, and
 * which are FE-written — see spec §6 (`docs/superpowers/specs/2026-07-29-push-notifications-design.md`)
 * for the authoritative catalog table (key, anchor, source of truth, v1 default).
 *
 * <p>Only {@link #GYM} carries a non-zero {@link #defaultLeadMinutes()}. The ritual-family
 * categories ({@link #RITUAL}, {@link #LIGHTS_OUT}, {@link #WIND_DOWN}) resolve their windows
 * through {@code RitualService}, which already owns {@code mezo.ritual.lead-min} /
 * {@code mezo.ritual.prep-lead-min} — duplicating those offsets here would create a second source
 * of truth for the same minute (spec §9), so their {@code defaultLeadMinutes()} is 0.
 */
public enum NotificationCategory {

    /** Anchor: {@code SleepAnchorPort.resolve(user).wake()}. */
    BRIEFING("briefing", true, 0, false),

    /** Anchor: slot minus lead (30 min); source {@code gym_schedule_slot.time} / {@code sport_schedule.time}. */
    GYM("gym", true, 30, false),

    /** Anchor: {@code mezo.notification.medication-time} (08:00) on a cycle day; source {@code medication.cadence} + jsonb cycle envelope. */
    MEDICATION("medication", true, 0, false),

    /** Anchor: ritual {@code opensAt}; source {@code RitualService} (RitualService.java:72). */
    RITUAL("ritual", true, 0, false),

    /** Anchor: {@code sleep_goal.anchor_time}; source {@code RitualService} {@code bedTime} (RitualService.java:71). */
    LIGHTS_OUT("lights_out", true, 0, false),

    /** Anchor: Monday, wake anchor; source {@code weekly_suggestion} row exists. */
    WEEKLY("weekly", true, 0, false),

    /** Anchor: Sunday 19:00; source {@code memoir} row exists. */
    MEMOIR("memoir", true, 0, false),

    /**
     * Anchor: ritual {@code prepStartsAt} (bed minus {@code mezo.ritual.prep-lead-min}, 45 min);
     * source {@code RitualService} (RitualService.java:73). Not a notification lead — see class
     * javadoc; {@link #defaultLeadMinutes()} is 0.
     */
    WIND_DOWN("wind_down", false, 0, false),

    /** Anchor: 12:30, generation-graced; source {@code companion_message} midday row
     *  (companion-feed, mezo-gst9). */
    MIDDAY("midday", false, 0, false),

    /** Anchor: 4x daily; FE-written — source FE snapshot ({@code data/today/checkins.ts}). */
    CHECKIN("checkin", false, 0, true),

    /** Anchor: 6 slots/day; FE-written — source FE snapshot ({@code buildProtocol}). */
    FUEL_SLOT("fuel_slot", false, 0, true),

    /** Anchor: 20:30, generation-graced; source {@code companion_message} evening row
     *  (companion-feed, mezo-gst9). */
    EVENING("evening", true, 0, false),

    /** Anchor: the row's own generation minute; source {@code companion_message} sleep row
     *  (companion-feed, mezo-gst9). */
    SLEEP_REACTION("sleep_reaction", true, 0, false),

    /** Anchor: the row's own generation minute; source {@code companion_message} weight row
     *  (companion-feed, mezo-gst9). */
    WEIGHT_REACTION("weight_reaction", true, 0, false);

    private final String key;
    private final boolean defaultEnabled;
    private final int defaultLeadMinutes;
    private final boolean feWritten;

    NotificationCategory(String key, boolean defaultEnabled, int defaultLeadMinutes, boolean feWritten) {
        this.key = key;
        this.defaultEnabled = defaultEnabled;
        this.defaultLeadMinutes = defaultLeadMinutes;
        this.feWritten = feWritten;
    }

    /** The stable wire key persisted in {@code notification_pref} / {@code notification_schedule} rows. */
    public String key() {
        return key;
    }

    /** Whether v1 ships this category switched ON by default (spec §6, "v1 default" column). */
    public boolean defaultEnabled() {
        return defaultEnabled;
    }

    /**
     * The notification-side lead, in minutes, subtracted from the anchor to compute the fire time.
     * Zero for every category except {@link #GYM}; the ritual-family categories resolve their own
     * offsets through {@code RitualService} instead (see class javadoc).
     */
    public int defaultLeadMinutes() {
        return defaultLeadMinutes;
    }

    /**
     * Whether this category's schedule times are only known to the frontend (no backend anchor),
     * so a later slice must reject a client attempting to write a backend-native category's
     * schedule through this flag.
     */
    public boolean feWritten() {
        return feWritten;
    }

    /** Looks up a category by its wire {@link #key()}, or empty if unknown. */
    public static Optional<NotificationCategory> fromKey(String key) {
        return Arrays.stream(values()).filter(c -> c.key.equals(key)).findFirst();
    }
}
