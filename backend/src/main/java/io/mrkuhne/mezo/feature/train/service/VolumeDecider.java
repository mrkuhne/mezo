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
        JOINT_PAIN, SORENESS, TIER_MAINTAIN, DELOAD, NO_SLOT, AT_CEILING, DELOAD_RESTORE
    }

    public record Input(int week, PriorityTier tier, Band band, int plannedSets, int loggedLastWeek,
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
        if (in.loggedLastWeek() < in.plannedSets()) {
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
        int step = in.deficit() ? in.stepDeficit()
            : (in.tier() == PriorityTier.EMPHASIZE ? in.stepEmphasize() : in.stepGrow());
        int delta = Math.min(step, top - in.plannedSets());
        List<Reason> why = new ArrayList<>(List.of(Reason.ALL_SETS_DONE, Reason.ROOM_IN_BAND));
        if (in.deficit()) {
            why.add(Reason.DEFICIT_PACE);
        }
        return new Result(Lever.UP, delta, why);
    }
}
