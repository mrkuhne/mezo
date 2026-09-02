package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.TimingObservation;
import io.mrkuhne.mezo.feature.train.service.TimingObservationExtractor;
import io.mrkuhne.mezo.feature.train.service.TimingObservationExtractor.SetStamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TimingObservationExtractorTest {

    private static final Instant T = Instant.parse("2026-09-02T17:00:00Z");
    private static final UUID A = UUID.randomUUID();
    private static final UUID B = UUID.randomUUID();
    private static final int GAP = 300;
    private static final int LEAD = 900;

    private static SetStamp s(UUID ex, String type, int offsetSeconds) {
        return new SetStamp(ex, type, T.plusSeconds(offsetSeconds));
    }

    @Test
    void testExtract_shouldEmitLeadIn_whenStartedAtIsKnown() {
        var r = TimingObservationExtractor.extract(T, List.of(s(A, "compound", 400)), GAP, LEAD);
        assertThat(r.observations()).containsExactly(new TimingObservation("lead_in", 400));
    }

    @Test
    void testExtract_shouldEmitSetCycle_whenTwoSetsShareAnExercise() {
        var r = TimingObservationExtractor.extract(
            null, List.of(s(A, "compound", 100), s(A, "compound", 280)), GAP, LEAD);
        assertThat(r.observations()).containsExactly(new TimingObservation("set_cycle_compound", 180));
    }

    @Test
    void testExtract_shouldBucketNonCompoundAsIsolation_whenTheExerciseIsPlyo() {
        var r = TimingObservationExtractor.extract(
            null, List.of(s(A, "plyo", 100), s(A, "plyo", 200)), GAP, LEAD);
        assertThat(r.observations()).containsExactly(new TimingObservation("set_cycle_isolation", 100));
    }

    @Test
    void testExtract_shouldEmitTransition_whenTheIntervalCrossesAnExerciseBoundary() {
        var r = TimingObservationExtractor.extract(
            null, List.of(s(A, "compound", 100), s(B, "isolation", 340)), GAP, LEAD);
        assertThat(r.observations()).containsExactly(new TimingObservation("transition", 240));
    }

    @Test
    void testExtract_shouldDropTheInterval_whenItExceedsTheGapCap() {
        var r = TimingObservationExtractor.extract(
            null, List.of(s(A, "compound", 100), s(A, "compound", 1000)), GAP, LEAD);
        assertThat(r.observations()).isEmpty();
        assertThat(r.clipped()).isEqualTo(1);
        assertThat(r.total()).isEqualTo(1);
    }

    @Test
    void testTooNoisy_shouldBeTrue_whenClippedIntervalsExceedTheRatio() {
        var r = TimingObservationExtractor.extract(
            null,
            List.of(s(A, "compound", 0), s(A, "compound", 100), s(A, "compound", 2000)),
            GAP, LEAD);
        assertThat(r.tooNoisy(0.25)).isTrue();   // 1 of 2 intervals clipped
    }

    @Test
    void testExtract_shouldReturnNothing_whenNoSetsWereLogged() {
        var r = TimingObservationExtractor.extract(T, List.of(), GAP, LEAD);
        assertThat(r.observations()).isEmpty();
        assertThat(r.total()).isZero();
    }
}
