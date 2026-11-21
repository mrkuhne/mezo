package io.mrkuhne.mezo.feature.capacity.entity;

/** What a day adjustment / proposal step does (Boop B7 K1, mezo-r36n9.17). Stored as its name. */
public enum AdjustmentKind {
    MOVE_SESSION_DAY,
    SHIFT_SESSION_TIME,
    SHORTEN_SESSION,
    LIGHTEN_SESSION,
    SWAP_SESSION_KIND,
    SKIP_SESSION,
    SHIFT_BEDTIME,
    MOVE_MEAL_ENERGY,
    CALENDAR_TODO
}
