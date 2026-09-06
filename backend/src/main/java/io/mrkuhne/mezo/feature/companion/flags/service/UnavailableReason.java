package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * One member per honesty gate that already exists in the 13 rules — the reason a rule could not
 * judge, as opposed to judging and finding nothing wrong. Derived by reading every
 * {@code Optional.empty()} site in {@code service/rule/} on 2026-09-05; adding a gate without a
 * member is impossible, because the verdict is now a rule's only return type. Widened again by
 * Round 2 S1 (bd mezo-d58h.7.1) for {@code ProtocolLapseRule}'s own honesty gates.
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
    NO_MEAL_DATA,
    /** protocol_lapse: no active protocol row for this user. */
    NO_ACTIVE_PROTOCOL,
    /** protocol_lapse: the active protocol has no items. */
    NO_PROTOCOL_ITEMS,
    /** protocol_lapse: an item's miss run qualified, but not enough due-day history existed
     *  behind it (either the item is too new, or too few historical due days survived the
     *  {@code startedOn} clamp) to judge whether a real habit existed before the miss. */
    NOT_ENOUGH_PROTOCOL_HISTORY,
    /** meal_rhythm_drift: the user has no meal_slot_template row at all — there is no plan for
     *  reality to drift away from (that is slot-template setup territory, not this rule's). */
    NO_SLOT_TEMPLATE,
    /** meal_rhythm_drift: fewer days with ANY logged meal inside the window than
     *  {@code min-days-with-meals}. A logging holiday is not a rhythm change. */
    NOT_ENOUGH_MEAL_DAYS,
    /** meal_rhythm_drift: no slot survived the trackability gates (every day unresolvable or
     *  without a matching template, every slot a snack, or an ambiguous duplicate slotKind), so
     *  nothing could be measured — as opposed to measuring and finding no drift. */
    NO_COMPARABLE_SLOTS,
    /** energy_dip_meal_timing: fewer days carrying BOTH an early-afternoon check-in energy value
     *  and any logged meal than {@code min-qualifying-days}. A day with an afternoon check-in but
     *  no meal data at all is neither "ate late" nor "skipped breakfast" — it is unknown. */
    NOT_ENOUGH_ENERGY_MEAL_DAYS,
    /** energy_dip_meal_timing: neither split produced two groups of at least {@code min-group-days}
     *  (the lunch arm additionally needs the two groups' median lunch times to be
     *  {@code min-lunch-split-separation-minutes} apart) — nothing could be compared, as opposed to
     *  comparing and finding no difference. */
    NO_USABLE_SPLIT
}
