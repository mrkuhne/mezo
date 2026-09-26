package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;

/**
 * The weekly learned-base step (mezo-zz91i, spec §5.4, owner decisions L1 + L5): at most
 * ±maxStep a week; a new direction moves half first ("more likely the scale is slow than that
 * expenditure changed"), a confirmed one the full step; too little data holds. The applied base
 * always stays inside the plausibility rails. Pure.
 */
public final class ExpenditureStepPolicy {

    public enum Status { LEARNING, UPDATED, STABLE, HOLDING }

    public enum Confidence { LOW, MEDIUM, HIGH }

    public record Input(int prevApplied, int prevDirection, double posteriorBase, double posteriorSd,
                        int formulaBase, double bmr, int usableDays, int weighInDays) {
    }

    public record Result(int appliedBase, int step, int direction, Status status, Confidence confidence) {
    }

    private ExpenditureStepPolicy() {
    }

    public static Result decide(Input in, GoalEngineProperties.Expenditure e) {
        Confidence confidence = confidence(in.posteriorSd(), e);
        boolean holding = in.usableDays() < e.minUsableDaysPerWeek() || in.weighInDays() < e.minWeighInDaysPerWeek();
        double delta = in.posteriorBase() - in.prevApplied();
        int step = 0;
        if (!holding && Math.abs(delta) >= e.deadBandKcal()) {
            int dir = delta > 0 ? 1 : -1;
            double raw = dir == in.prevDirection() ? delta : delta / 2;
            step = (int) Math.round(Math.max(-e.maxStepKcal(), Math.min(e.maxStepKcal(), raw)));
        }
        int applied = rails(in.prevApplied() + step, in.formulaBase(), in.bmr(), e);
        int realStep = applied - in.prevApplied();
        int direction = realStep == 0 ? in.prevDirection() : Integer.signum(realStep);
        Status status = holding ? Status.HOLDING
            : realStep != 0 ? Status.UPDATED
            : confidence == Confidence.LOW ? Status.LEARNING
            : Status.STABLE;
        return new Result(applied, realStep, direction, status, confidence);
    }

    public static int rails(int value, int formulaBase, double bmr, GoalEngineProperties.Expenditure e) {
        double lo = Math.max(formulaBase * (1 - e.maxDeviation()), bmr * e.minBaseBmrRatio());
        double hi = formulaBase * (1 + e.maxDeviation());
        return (int) Math.round(Math.max(lo, Math.min(hi, value)));
    }

    public static Confidence confidence(double sd, GoalEngineProperties.Expenditure e) {
        return sd <= e.highConfidenceSdKcal() ? Confidence.HIGH
            : sd <= e.mediumConfidenceSdKcal() ? Confidence.MEDIUM
            : Confidence.LOW;
    }
}
