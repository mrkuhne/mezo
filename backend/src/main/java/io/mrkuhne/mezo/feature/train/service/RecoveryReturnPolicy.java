package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Pure policy for recovery period decision logic: what to do when a recovery period ends
 * (Kihagyás S2, "kímélő mód", mezo-q4xt2.2).
 *
 * <p>Produces decision rules (CONTINUE, RESUME, STEP_BACK), expected end dates, and meso-week
 * shift calculations for the comeback ramp.
 */
public final class RecoveryReturnPolicy {

    private RecoveryReturnPolicy() {}

    public enum Rule {
        CONTINUE,
        RESUME,
        STEP_BACK
    }

    public record Decision(Rule rule, int daysOut, int rampSessions) {}

    /**
     * Decide the comeback rule based on how long the recovery period lasted.
     *
     * <p>Logic: daysOut = max(1, days between start and endedOn).
     *
     * <ul>
     *   <li>daysOut 1–2: CONTINUE, rampSessions 1
     *   <li>daysOut 3–9: RESUME, rampSessions 2
     *   <li>daysOut ≥10: STEP_BACK, rampSessions 2
     * </ul>
     */
    public static Decision decide(LocalDate start, LocalDate endedOn) {
        int daysOut = (int) Math.max(1, ChronoUnit.DAYS.between(start, endedOn));

        Rule rule;
        int rampSessions;

        if (daysOut <= 2) {
            rule = Rule.CONTINUE;
            rampSessions = 1;
        } else if (daysOut <= 9) {
            rule = Rule.RESUME;
            rampSessions = 2;
        } else {
            rule = Rule.STEP_BACK;
            rampSessions = 2;
        }

        return new Decision(rule, daysOut, rampSessions);
    }

    /**
     * Calculate the expected end date given the start date and recovery estimate.
     *
     * <ul>
     *   <li>TODAY: start
     *   <li>FEW_DAYS: start + 2
     *   <li>WEEK: start + 6
     *   <li>UNKNOWN: null
     * </ul>
     */
    public static LocalDate expectedEnd(LocalDate start, RecoveryPeriodEntity.Estimate estimate) {
        return switch (estimate) {
            case TODAY -> start;
            case FEW_DAYS -> start.plusDays(2);
            case WEEK -> start.plusDays(6);
            case UNKNOWN -> null;
        };
    }

    /**
     * Compute the whole-week shift (in days, multiple of 7, ≥ 0) so that
     * {@code MesoWeeks.weekOf(newStart, today, weeks)} equals {@code targetWeek}.
     *
     * <p>Uses {@code MesoWeeks.weekOf(mesoStart, today, Integer.MAX_VALUE)} to compute the
     * current meso-week, then returns {@code Math.max(0, cur - target) * 7}.
     */
    public static int shiftDays(LocalDate mesoStart, LocalDate today, int targetWeek) {
        int currentWeek = MesoWeeks.weekOf(mesoStart, today, Integer.MAX_VALUE);
        return Math.max(0, currentWeek - targetWeek) * 7;
    }

    /**
     * Determine the target meso-week for the comeback ramp based on the decision rule and the
     * week at recovery start.
     *
     * <ul>
     *   <li>CONTINUE: -1 (no shift)
     *   <li>RESUME: weekAtStart (return to the same week)
     *   <li>STEP_BACK: max(1, weekAtStart - 1) (step back one week)
     * </ul>
     */
    public static int targetWeek(Rule rule, int weekAtStart) {
        return switch (rule) {
            case CONTINUE -> -1;
            case RESUME -> weekAtStart;
            case STEP_BACK -> Math.max(1, weekAtStart - 1);
        };
    }
}
