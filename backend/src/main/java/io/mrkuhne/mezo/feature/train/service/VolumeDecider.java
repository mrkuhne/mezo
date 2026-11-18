package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.service.VolumeBands.Band;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure weekly per-muscle-group set decision (volume engine v2, spec §6.4 as amended by §11). No Spring/DB.
 *
 * <p>Rule order: week 1 → deload → maintain → step down at the top → holds → at the top → step up.
 */
public final class VolumeDecider {
    private VolumeDecider() {}

    public enum Lever { NONE, UP, DOWN, HOLD, DELOAD }

    /**
     * The one reason vocabulary. FELT_EASY, SORENESS_CLEARED, NO_SLOT and DELOAD_RESTORE are produced
     * outside {@link #decide} (later tasks, or the weekly proposal itself), never by it.
     */
    public enum Reason {
        ALL_SETS_DONE, FELT_EASY, DEFICIT_PACE, ROOM_IN_BAND, SORENESS_CLEARED, GRIND, TOO_MUCH, SETS_MISSED,
        JOINT_PAIN, SORENESS, TIER_MAINTAIN, DELOAD, NO_SLOT, AT_CEILING, DELOAD_RESTORE, STALLED
    }

    /**
     * {@code plannedSets} is this week's starting amount (after a post-deload restore) — the top check and the
     * step use it; {@code plannedLastWeek} is what last week prescribed — {@code SETS_MISSED} is judged against
     * it, so a fully done deload week does not read as missed sets the week after (.75 #2).
     */
    public record Input(int week, PriorityTier tier, Band band, int plannedSets, int plannedLastWeek,
                        int loggedLastWeek,
                        boolean grind, boolean tooMuch, boolean jointPain, boolean sorenessHigh,
                        boolean deficit, boolean deloadPhase,
                        int stepEmphasize, int stepGrow, int stepDeficit) {}

    /** {@code delta} is the wanted change in the group's weekly sets; DELOAD carries 0 (caller halves per exercise). */
    public record Result(Lever lever, int delta, List<Reason> reasons) {}

    public static Result decide(Input in) {
        if (in.week() <= 1) {
            return new Result(Lever.NONE, 0, List.of());
        }
        if (in.deloadPhase()) {
            return new Result(Lever.DELOAD, 0, List.of(Reason.DELOAD));
        }
        if (in.tier() == PriorityTier.MAINTAIN) {
            return new Result(Lever.HOLD, 0, List.of(Reason.TIER_MAINTAIN));
        }
        int top = in.band().high();
        boolean atTop = in.plannedSets() >= top;
        if (atTop && (in.grind() || in.tooMuch())) {
            List<Reason> why = new ArrayList<>();
            if (in.grind()) {
                why.add(Reason.GRIND);
            }
            if (in.tooMuch()) {
                why.add(Reason.TOO_MUCH);
            }
            return new Result(Lever.DOWN, -1, why);
        }
        List<Reason> holds = new ArrayList<>();
        if (in.loggedLastWeek() < in.plannedLastWeek()) {
            holds.add(Reason.SETS_MISSED);
        }
        if (in.grind()) {
            holds.add(Reason.GRIND);
        }
        if (in.tooMuch()) {
            holds.add(Reason.TOO_MUCH);
        }
        if (in.jointPain()) {
            holds.add(Reason.JOINT_PAIN);
        }
        if (in.sorenessHigh()) {
            holds.add(Reason.SORENESS);
        }
        if (!holds.isEmpty()) {
            return new Result(Lever.HOLD, 0, holds);
        }
        if (atTop) {
            return new Result(Lever.HOLD, 0, List.of(Reason.AT_CEILING));
        }
        int step = step(in.tier(), in.deficit(), in.stepEmphasize(), in.stepGrow(), in.stepDeficit());
        int delta = Math.min(step, top - in.plannedSets());
        List<Reason> why = new ArrayList<>(List.of(Reason.ALL_SETS_DONE, Reason.ROOM_IN_BAND));
        if (in.deficit()) {
            why.add(Reason.DEFICIT_PACE);
        }
        return new Result(Lever.UP, delta, why);
    }

    /** The one weekly step rule (shared with {@link VolumePath}): Tartás 0, a deficit its own step, Hangsúly vs Építés. */
    public static int step(PriorityTier tier, boolean deficit, int stepEmphasize, int stepGrow, int stepDeficit) {
        if (tier == PriorityTier.MAINTAIN) {
            return 0;
        }
        return deficit ? stepDeficit : (tier == PriorityTier.EMPHASIZE ? stepEmphasize : stepGrow);
    }
}
