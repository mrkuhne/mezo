package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureStepPolicy.Confidence;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureStepPolicy.Input;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureStepPolicy.Status;
import org.junit.jupiter.api.Test;

class ExpenditureStepPolicyTest {

    static final GoalEngineProperties.Expenditure E = ExpenditureFilterTest.defaults();

    static Input in(int prevApplied, int prevDir, double post, double sd, int usable, int weighIns) {
        return new Input(prevApplied, prevDir, post, sd, 2700, 1900, usable, weighIns);
    }

    @Test
    void aNewDirectionMovesHalfFirst() {
        var r = ExpenditureStepPolicy.decide(in(2700, 0, 2300, 150, 6, 5), E);
        assertThat(r.step()).isEqualTo(-150);            // −400/2 = −200 → clamped to −150
        var small = ExpenditureStepPolicy.decide(in(2700, 0, 2600, 150, 6, 5), E);
        assertThat(small.step()).isEqualTo(-50);          // −100/2
        assertThat(small.direction()).isEqualTo(-1);
        assertThat(small.status()).isEqualTo(Status.UPDATED);
    }

    @Test
    void aConfirmedDirectionTakesTheFullStep() {
        var r = ExpenditureStepPolicy.decide(in(2650, -1, 2550, 150, 6, 5), E);
        assertThat(r.step()).isEqualTo(-100);
        assertThat(r.appliedBase()).isEqualTo(2550);
    }

    @Test
    void belowTheDeadBandNothingMoves() {
        var r = ExpenditureStepPolicy.decide(in(2700, -1, 2680, 90, 6, 5), E);
        assertThat(r.step()).isZero();
        assertThat(r.status()).isEqualTo(Status.STABLE);
        assertThat(r.confidence()).isEqualTo(Confidence.HIGH);
    }

    @Test
    void tooLittleDataHolds() {
        assertThat(ExpenditureStepPolicy.decide(in(2700, 0, 2300, 150, 3, 5), E).status()).isEqualTo(Status.HOLDING);
        assertThat(ExpenditureStepPolicy.decide(in(2700, 0, 2300, 150, 6, 1), E).step()).isZero();
    }

    @Test
    void lowConfidenceWithoutAStepIsLearning() {
        var r = ExpenditureStepPolicy.decide(in(2700, 0, 2710, 260, 6, 5), E);
        assertThat(r.status()).isEqualTo(Status.LEARNING);
        assertThat(r.confidence()).isEqualTo(Confidence.LOW);
    }

    @Test
    void railsHoldTheBaseInsideThePlausibleBand() {
        // formula 2700 → lo = max(1755, 1900 × 1.10 = 2090) = 2090, hi = 3645
        assertThat(ExpenditureStepPolicy.rails(2000, 2700, 1900, E)).isEqualTo(2090);
        assertThat(ExpenditureStepPolicy.rails(3800, 2700, 1900, E)).isEqualTo(3645);
        var r = ExpenditureStepPolicy.decide(new Input(2150, -1, 1500, 150, 2700, 1900, 6, 5), E);
        assertThat(r.appliedBase()).isEqualTo(2090);
        assertThat(r.step()).isEqualTo(-60);
    }
}
