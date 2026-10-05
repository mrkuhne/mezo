package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;

/**
 * PlannedSkipPolicy — a pure read-time counting rule for planned skips (Kihagyás S1, mezo-q4xt2.1).
 * Produces verdicts from skip rows, applying free-pass logic based on ISO weeks.
 */
public final class PlannedSkipPolicy {

    private PlannedSkipPolicy() {
        // Private constructor for utility class
    }

    /** Source of a skip: user-declared, advice-driven, or a virtual row for a date a kímélő-mód
     *  period protects (Kihagyás S2, mezo-q4xt2.2 — never persisted, never listed over REST). */
    public enum Source {
        USER,
        ADVICE,
        RECOVERY
    }

    /**
     * One skip as the policy sees it (either table). {@code adviceBacked} marks a USER row that
     * has an ADVICE twin on the same occurrence (the coach's "skip tonight" the user then gave a
     * reason for): it stays excused like the advice it answers and never takes part in the
     * weekly free-pass race (Kihagyás S1, mezo-q4xt2.1, review I3). {@code recoveryBacked} is the
     * same for a USER row on a date a kímélő-mód period already protects: the protection excuses
     * it, so it must not spend the week's free pass (Kihagyás S2, mezo-q4xt2.2).
     */
    public record Row(
        UUID id,
        LocalDate date,
        PlannedSkipEntity.Kind kind,
        Integer dayOfWeek,
        String time,
        String sessionKey,
        PlannedSkipEntity.Reason reason,
        String reasonText,
        Source source,
        Instant createdAt,
        boolean adviceBacked,
        boolean recoveryBacked
    ) {
        /** A row with no advice twin — the common case. */
        public Row(UUID id, LocalDate date, PlannedSkipEntity.Kind kind, Integer dayOfWeek, String time,
                String sessionKey, PlannedSkipEntity.Reason reason, String reasonText, Source source,
                Instant createdAt) {
            this(id, date, kind, dayOfWeek, time, sessionKey, reason, reasonText, source, createdAt, false, false);
        }

        /** A row with an advice-twin flag but no recovery backing. */
        public Row(UUID id, LocalDate date, PlannedSkipEntity.Kind kind, Integer dayOfWeek, String time,
                String sessionKey, PlannedSkipEntity.Reason reason, String reasonText, Source source,
                Instant createdAt, boolean adviceBacked) {
            this(id, date, kind, dayOfWeek, time, sessionKey, reason, reasonText, source, createdAt,
                adviceBacked, false);
        }

        /** Excused without a pass and out of the pass race: advice twin or a recovery-protected date. */
        boolean backed() {
            return adviceBacked || recoveryBacked;
        }
    }

    /** A row plus its read-time verdict. */
    public record Verdict(
        Row row,
        boolean serious,
        boolean freePass,
        boolean excused
    ) {}

    /**
     * Determines if a reason is serious (cannot be excused via free pass).
     * Serious reasons: ILLNESS, STOMACH, INJURY, TRAVEL.
     */
    public static boolean isSerious(PlannedSkipEntity.Reason r) {
        return r == PlannedSkipEntity.Reason.ILLNESS
            || r == PlannedSkipEntity.Reason.STOMACH
            || r == PlannedSkipEntity.Reason.INJURY
            || r == PlannedSkipEntity.Reason.TRAVEL;
    }

    /**
     * Computes the ISO week key for a date: weekBasedYear*100 + weekOfWeekBasedYear.
     * Example: 2026-09-28 (week 40) → 202640L
     */
    public static long isoWeekKey(LocalDate d) {
        return d.get(IsoFields.WEEK_BASED_YEAR) * 100L + d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    }

    /**
     * Judges a list of skip rows, producing verdicts with read-time logic.
     *
     * <p>Rules:
     * <ul>
     *   <li>Serious reasons are always excused but never get a free pass.</li>
     *   <li>USER source soft rows (non-serious) get one free pass per ISO week, sorted by createdAt then id.</li>
     *   <li>ADVICE source rows are always excused but do not consume a free pass.</li>
     *   <li>RECOVERY source rows (kímélő mód) are judged like ADVICE: always excused, never a free
     *       pass, and out of the week's pass race.</li>
     *   <li>An advice-backed USER row ({@link Row#adviceBacked}) is judged like its ADVICE twin:
     *       always excused, never a free pass, and it does not consume the week's pass.</li>
     *   <li>Output order matches input order.</li>
     * </ul>
     *
     * @param rows the list of skip rows; MUST cover whole ISO weeks for correct free-pass verdicts
     * @return a list of verdicts in the same order as the input
     */
    public static List<Verdict> judge(List<Row> rows) {
        // Build a map of one soft USER row per ISO week, sorted by createdAt then id
        Map<Long, UUID> passByWeek = new HashMap<>();
        rows.stream()
            .filter(r -> r.source() == Source.USER && !r.backed() && !isSerious(r.reason()))
            .sorted(Comparator.comparing(Row::createdAt).thenComparing(Row::id))
            .forEach(r -> passByWeek.putIfAbsent(isoWeekKey(r.date()), r.id()));

        // Map each row to its verdict
        return rows.stream().map(r -> {
            boolean serious = isSerious(r.reason());
            boolean pass = r.source() == Source.USER && !r.backed() && !serious
                && r.id().equals(passByWeek.get(isoWeekKey(r.date())));
            return new Verdict(r, serious, pass,
                serious || pass || r.source() == Source.ADVICE || r.source() == Source.RECOVERY
                    || r.backed());
        }).toList();
    }
}
