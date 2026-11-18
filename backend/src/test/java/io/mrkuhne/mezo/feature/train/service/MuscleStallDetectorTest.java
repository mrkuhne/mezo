package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.MuscleStallDetector.TopSet;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MuscleStallDetectorTest {

    private static TopSet t(int week, String kg, int reps) {
        return new TopSet(week, new BigDecimal(kg), reps);
    }

    @Test
    void everyExerciseHeldTwoWeeksIsStalled() {
        Map<String, List<TopSet>> s = Map.of(
            "a", List.of(t(1, "60", 8), t(2, "60", 8), t(3, "60", 8)),
            "b", List.of(t(1, "40", 10), t(2, "40", 10), t(3, "40", 10)));
        assertThat(MuscleStallDetector.stalled(s, 2)).isTrue();
    }

    @Test
    void oneExerciseMovedIsNotStalled() {
        Map<String, List<TopSet>> s = Map.of(
            "a", List.of(t(1, "60", 8), t(2, "60", 8), t(3, "60", 8)),
            "b", List.of(t(1, "40", 10), t(2, "40", 10), t(3, "40", 11)));
        assertThat(MuscleStallDetector.stalled(s, 2)).isFalse();
    }

    @Test
    void weightUpIsMovedEvenWithFewerReps() {
        Map<String, List<TopSet>> s = Map.of(
            "a", List.of(t(1, "60", 8), t(2, "60", 8), t(3, "62.5", 6)));
        assertThat(MuscleStallDetector.stalled(s, 2)).isFalse();
    }

    @Test
    void lighterTopSetIsAHoldNotAMove() {
        // weight down, reps up: not moved
        Map<String, List<TopSet>> s = Map.of(
            "a", List.of(t(1, "60", 8), t(2, "60", 8), t(3, "55", 12)));
        assertThat(MuscleStallDetector.stalled(s, 2)).isTrue();
    }

    @Test
    void absentWeekIsNotAHold() {
        Map<String, List<TopSet>> s = Map.of(
            "a", List.of(t(1, "60", 8), t(3, "60", 8)));
        assertThat(MuscleStallDetector.stalled(s, 2)).isFalse();
    }

    @Test
    void tooLittleDataIsNotStalled() {
        Map<String, List<TopSet>> s = Map.of(
            "a", List.of(t(2, "60", 8), t(3, "60", 8)));
        assertThat(MuscleStallDetector.stalled(s, 2)).isFalse();
        assertThat(MuscleStallDetector.stalled(Map.of(), 2)).isFalse();
    }

    @Test
    void staleSeriesIsNotAStallOfThisWeek() {
        Map<String, List<TopSet>> s = Map.of(
            "a", List.of(t(1, "60", 8), t(2, "60", 8), t(3, "60", 8)));
        assertThat(MuscleStallDetector.stalled(s, 2, 5)).isFalse();
        assertThat(MuscleStallDetector.stalled(s, 2, 3)).isTrue();
    }
}
