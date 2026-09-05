package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * One member per honesty gate that already exists in the 13 rules — the reason a rule could not
 * judge, as opposed to judging and finding nothing wrong. Derived by reading every
 * {@code Optional.empty()} site in {@code service/rule/} on 2026-09-05; adding a gate without a
 * member is impossible, because the verdict is now a rule's only return type.
 */
public enum UnavailableReason {
    /** sleep_debt: fewer logged nights than {@code min-nights}. */
    NOT_ENOUGH_LOGGED_NIGHTS,
    /** load_fuel_mismatch: neither the kcal nor the sleep side reached {@code min-logged-days-per-side}. */
    NOT_ENOUGH_LOGGED_DAYS,
    /** acute_bad_day: fewer check-ins today than {@code min-check-ins} — one bad answer is a moment, not a day. */
    NOT_ENOUGH_CHECKINS,
    /** sustained_stress: no check-in stress value anywhere in the window. */
    NO_CHECKIN_DATA,
    /** all_healthy / recovery_needed: the window holds no observations at all. */
    NO_DATA_IN_WINDOW,
    /** momentum_at_risk: the baseline period is itself below {@code min-baseline} — nothing to fall from. */
    NO_HABIT_BASELINE,
    /** missed_workouts / momentum_at_risk: the user has no gym schedule slots. */
    NO_GYM_SCHEDULE,
    /** missed_workouts: the schedule is younger than the window, so no day in it could be a violation. */
    SCHEDULE_YOUNGER_THAN_WINDOW,
    /** rapid_weight_loss: the weight-trend extractor returned nothing for today. */
    NO_WEIGHT_TREND,
    /** rapid_weight_loss: no ACTIVE goal, so "trajectory ≠ cut" cannot be evaluated. */
    NO_ACTIVE_GOAL,
    /** joint_overuse: no shoulder-strain data points in the window — never average over an empty set. */
    NO_STRAIN_DATA,
    /** joint_overuse: no planned session for tomorrow to be shoulder-focused. */
    NO_PLANNED_SESSION,
    /** ignored_nudge / late_eating (bed arm): no sleep_goal row — the config default must not stand in. */
    NO_SLEEP_GOAL_ROW,
    /** ignored_nudge: the notification feature is off, so "was a nudge sent" is unknowable. */
    NOTIFICATIONS_OFF,
    /** ignored_nudge: a night in the run has no bedtime — neither compliant nor violating. */
    UNLOGGED_NIGHT,
    /** late_eating: no last-meal hour anywhere in the window. */
    NO_MEAL_DATA
}
