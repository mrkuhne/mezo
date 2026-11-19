package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.DiscomfortHistory;
import io.mrkuhne.mezo.feature.train.service.PainLevel;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The pure fold rule of the per-exercise discomfort level (mezo-r36n9.66, spec §6.1). Feedback newest first. */
class DiscomfortHistoryTest {

    private static final int WINDOW = 3;

    @Test
    void testFold_shouldBeNone_whenAllRecentAnswersAreNone() {
        assertThat(DiscomfortHistory.fold(List.of(1, 1, 1), 0, WINDOW)).isEqualTo(PainLevel.NONE);
    }

    @Test
    void testFold_shouldBeMild_whenAnyRecentAnswerIsMild() {
        assertThat(DiscomfortHistory.fold(List.of(1, 2, 1), 0, WINDOW)).isEqualTo(PainLevel.MILD);
    }

    @Test
    void testFold_shouldBeStrong_whenAnyRecentAnswerIsStrong() {
        assertThat(DiscomfortHistory.fold(List.of(3, 1, 1), 0, WINDOW)).isEqualTo(PainLevel.STRONG);
        assertThat(DiscomfortHistory.fold(List.of(2, 1, 3), 1, WINDOW)).isEqualTo(PainLevel.STRONG);
    }

    @Test
    void testFold_shouldIgnoreAnswersBeyondTheWindow() {
        assertThat(DiscomfortHistory.fold(List.of(1, 1, 1, 3), 0, WINDOW)).isEqualTo(PainLevel.NONE);
    }

    @Test
    void testFold_shouldBeMild_whenOnlyASwapTimeRecordExists() {
        assertThat(DiscomfortHistory.fold(List.of(), 1, WINDOW)).isEqualTo(PainLevel.MILD);
    }

    @Test
    void testFold_shouldBeNone_whenNothingIsKnown() {
        assertThat(DiscomfortHistory.fold(List.of(), 0, WINDOW)).isEqualTo(PainLevel.NONE);
    }
}
