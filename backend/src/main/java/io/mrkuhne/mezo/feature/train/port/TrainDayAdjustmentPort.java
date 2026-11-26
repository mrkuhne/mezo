package io.mrkuhne.mezo.feature.train.port;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Train-owned seam to the day-adjustment ledger (Boop B7 K3, mezo-r36n9.17): the changes the owner accepted for a
 * day's gym session, read beside the plan (the plan itself is never rewritten). The capacity feature supplies the
 * adapter, so train never imports capacity. Only rows in effect count; an undone or expired change is invisible.
 */
public interface TrainDayAdjustmentPort {

    /** The accepted changes to {@code date}'s session; empty when there are none. */
    Optional<EffectiveSession> effectiveSession(UUID owner, LocalDate date);

    /** {@link #effectiveSession} for every date of {@code from..to} that has a change (one read for the range). */
    Map<LocalDate, EffectiveSession> effectiveSessions(UUID owner, LocalDate from, LocalDate to);

    /**
     * One day's accepted changes; every field is null when that kind of change is absent.
     *
     * @param movedInTemplateId the template session moved onto this day ({@code MOVE_SESSION_DAY} target)
     * @param movedInFrom       the plan day that session came from (its weekday's gym slot times travel along)
     * @param movedAwayTo       this day's planned session was moved to that day — the day has no gym session now
     * @param time              {@code SHIFT_SESSION_TIME}: the session starts at this clock time
     * @param minutes           {@code SHORTEN_SESSION}: the session is cut to this many minutes
     * @param setsFactor        {@code LIGHTEN_SESSION}: the session keeps this share of its working sets
     */
    record EffectiveSession(UUID movedInTemplateId, LocalDate movedInFrom, LocalDate movedAwayTo, LocalTime time,
                            Integer minutes, Double setsFactor) {

        public boolean movedAway() {
            return movedAwayTo != null;
        }

        public boolean movedIn() {
            return movedInTemplateId != null;
        }

        /** {@code sets} lightened by {@link #setsFactor} (never below 1); unchanged without a lighten. */
        public int lightened(int sets) {
            return setsFactor == null ? sets : Math.max(1, (int) Math.round(sets * setsFactor));
        }
    }
}
