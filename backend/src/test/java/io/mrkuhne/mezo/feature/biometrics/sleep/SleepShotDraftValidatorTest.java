package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Extracted;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Score;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** Pure D6 consistency scoring — the one spot unit tests beat ITs (no Spring, no DB). */
class SleepShotDraftValidatorTest {

    private final SleepShotDraftValidator validator = new SleepShotDraftValidator();
    private static final double THRESHOLD = 0.6;

    private static Extracted canonical() {
        // Daniel's Sleep Cycle example: span 00:42->09:03 = 501 = inBed; phases sum 502 (~inBed); asleep 449.
        return new Extracted("00:42", "09:03", 449, 501, 52, 206, 144, 100, 95);
    }

    @Test
    void testScore_shouldBeFullConfidence_whenAllChecksPass() {
        Score s = validator.score(canonical(), THRESHOLD);

        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(s.needsReview()).isFalse();
    }

    @Test
    void testScore_shouldFailAsleepCheck_whenAsleepExceedsInBed() {
        Extracted e = new Extracted("00:42", "09:03", 550, 501, 52, 206, 144, 100, 95);

        Score s = validator.score(e, THRESHOLD);

        // 3 of 4 applicable checks pass -> 0.75, above threshold.
        assertThat(s.confidence()).isEqualByComparingTo(new BigDecimal("0.75"));
        assertThat(s.needsReview()).isFalse();
    }

    @Test
    void testScore_shouldNeedReview_whenConfidenceBelowThreshold() {
        // Phases sum way off (200 vs 501) AND span mismatch via bedtime shift -> 2/4 = 0.5 < 0.6.
        Extracted e = new Extracted("02:00", "09:03", 400, 501, 50, 50, 50, 50, 95);

        Score s = validator.score(e, THRESHOLD);

        assertThat(s.confidence()).isEqualByComparingTo(new BigDecimal("0.5"));
        assertThat(s.needsReview()).isTrue();
    }

    @Test
    void testScore_shouldNeedReview_whenConfidenceEqualsThreshold() {
        // Same 2/4 = 0.50 extraction, but the caller's threshold is exactly 0.50: the boundary-inclusive
        // <= must still force review. All key fields present, so review is driven purely by the threshold
        // comparison — this test fails if <= is ever weakened to <.
        Extracted e = new Extracted("02:00", "09:03", 400, 501, 50, 50, 50, 50, 95);

        Score s = validator.score(e, 0.5);

        assertThat(s.confidence()).isEqualByComparingTo(new BigDecimal("0.5"));
        assertThat(s.needsReview()).isTrue();
    }

    @Test
    void testScore_shouldSkipPhaseCheck_whenAnyPhaseMissing() {
        Extracted e = new Extracted("00:42", "09:03", 449, 501, null, 206, 144, 100, 95);

        Score s = validator.score(e, THRESHOLD);

        // Applicable: asleep<=inBed, span~inBed, times parse -> 3/3.
        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(s.needsReview()).isFalse();
    }

    @Test
    void testScore_shouldNeedReview_whenKeyFieldMissing() {
        Extracted e = new Extracted(null, "09:03", 449, 501, 52, 206, 144, 100, 95);

        Score s = validator.score(e, THRESHOLD);

        assertThat(s.needsReview()).isTrue(); // bedtime missing forces review regardless of score
    }

    @Test
    void testScore_shouldWrapMidnight_whenSpanCrossesIt() {
        // 23:00 -> 07:21 = 501 min across midnight; inBed 501 -> span check passes.
        Extracted e = new Extracted("23:00", "07:21", 449, 501, null, null, null, null, null);

        Score s = validator.score(e, THRESHOLD);

        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void testScore_shouldFailTimeParse_whenNotHHmm() {
        Extracted e = new Extracted("25:99", "09:03", 449, null, null, null, null, null, null);

        Score s = validator.score(e, THRESHOLD);

        // Applicable: times-parse only (no inBed -> no span/asleep/phase checks) -> 0/1.
        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(s.needsReview()).isTrue();
    }

    @Test
    void testScore_shouldBeZeroConfidenceAndReview_whenNothingExtracted() {
        Score s = validator.score(new Extracted(null, null, null, null, null, null, null, null, null), THRESHOLD);

        assertThat(s.confidence()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(s.needsReview()).isTrue();
    }
}
