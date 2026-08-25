package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure per-muscle weekly volume-target decision (spec §5.2, DA4). No Spring/DB. */
public final class VolumeDecider {
    private VolumeDecider() {}

    public enum Lever { START, RAMP, HOLD, DELOAD }

    public record Input(int week, int prevSets, int mev, int mav, int mrv, boolean deloadPhase,
                        int loggedLastWeek, boolean grind, int step, BigDecimal deloadFraction,
                        int rampCeiling, boolean rampEnabled) {}
    public record Result(int targetSets, Lever lever, String change) {}

    public static Result decide(Input in) {
        if (in.week() <= 1) {
            return new Result(in.mev(), Lever.START, "MEV start (" + in.mev() + ")");
        }
        boolean earlyDeload = in.prevSets() >= in.mrv() && in.grind();
        if (in.deloadPhase() || earlyDeload) {
            int floor = (int) Math.ceil(in.mev() / 2.0);
            int target = Math.max(floor, round(in.prevSets(), in.deloadFraction()));
            return new Result(target, Lever.DELOAD,
                (in.deloadPhase() ? "Deload " : "Korai deload ") + in.prevSets() + " → " + target);
        }
        boolean targetHit = in.loggedLastWeek() >= in.prevSets();
        if (in.rampEnabled() && targetHit && !in.grind() && in.prevSets() < in.rampCeiling()) {
            int target = Math.min(in.prevSets() + in.step(), in.rampCeiling());
            return new Result(target, Lever.RAMP, "+" + (target - in.prevSets())
                + " (" + in.prevSets() + " → " + target + ")");
        }
        return new Result(in.prevSets(), Lever.HOLD, "tart (" + in.prevSets() + ")");
    }

    private static int round(int prev, BigDecimal frac) {
        return BigDecimal.valueOf(prev).multiply(frac).setScale(0, RoundingMode.HALF_UP).intValue();
    }
}
