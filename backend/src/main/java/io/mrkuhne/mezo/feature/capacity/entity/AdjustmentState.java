package io.mrkuhne.mezo.feature.capacity.entity;

/**
 * Life of one {@code day_adjustment} row (Boop B7 K3, mezo-r36n9.17). Stored lowercase ({@link #wire()}).
 * {@code ACTIVE} = in effect; {@code WAITING} = a calendar to-do the owner still has to do; {@code DONE} = a move whose
 * session was done on its new day, or a to-do the calendar now shows; {@code UNDONE} = taken back by the owner;
 * {@code EXPIRED} = went stale (the target day gained a session, or the day passed without it).
 */
public enum AdjustmentState {
    ACTIVE, UNDONE, WAITING, DONE, EXPIRED;

    public String wire() {
        return name().toLowerCase();
    }

    public static AdjustmentState fromWire(String value) {
        return valueOf(value.toUpperCase());
    }

    /** Rows the readers honour: still in effect, or already carried out. */
    public boolean inEffect() {
        return this == ACTIVE || this == WAITING || this == DONE;
    }
}
