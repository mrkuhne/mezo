package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Extracted;
import org.junit.jupiter.api.Test;

/** V1-V3 of the hypnogram gate (mezo-fk9a, spec section 4). Plain unit test: the validator
 *  is deterministic and has no collaborators. */
class SleepShotDraftValidatorHypnogramTest {

    private final SleepShotDraftValidator validator = new SleepShotDraftValidator();

    /** The canonical screenshot: 0:42 -> 9:03 (501 min span), 34 buckets, phases within tolerance. */
    private static final String GOOD = "ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR";

    private static Extracted with(String hypnogram) {
        return new Extracted("00:42", "09:03", 449, 501, 52, 206, 144, 100, 95, hypnogram);
    }

    @Test
    void testAcceptedHypnogram_shouldReturnTheSequence_whenAllChecksPass() {
        assertThat(validator.acceptedHypnogram(with(GOOD))).isEqualTo(GOOD);
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenAlphabetIsViolated() {
        assertThat(validator.acceptedHypnogram(with("ALDDXRRL"))).isNull();
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenLengthIsMoreThanTwoBucketsOff() {
        assertThat(validator.acceptedHypnogram(with("ALDDLRRL"))).isNull();
    }

    @Test
    void testAcceptedHypnogram_shouldTolerateTwoBucketsOfLengthDrift() {
        assertThat(validator.acceptedHypnogram(with(GOOD.substring(0, 32)))).isNotNull();
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenCompositionContradictsTheMinuteTotals() {
        // Right length (34), but almost all deep — the minute totals say deep is only 100 min.
        String allDeep = "D".repeat(32) + "LR";
        assertThat(validator.acceptedHypnogram(with(allDeep))).isNull();
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenPhaseMinutesAreMissing() {
        Extracted noPhases = new Extracted("00:42", "09:03", 449, 501, 52, null, 144, 100, 95, GOOD);
        assertThat(validator.acceptedHypnogram(noPhases)).isNull();
    }

    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenAbsent() {
        assertThat(validator.acceptedHypnogram(with(null))).isNull();
    }

    /** The whole point of keeping the two verdicts separate (spec section 4). */
    @Test
    void testScore_shouldBeUnaffected_whenTheHypnogramIsRejected() {
        var good = validator.score(with(GOOD), 0.6);
        var bad = validator.score(with("ALDDXRRL"), 0.6);
        assertThat(bad.confidence()).isEqualByComparingTo(good.confidence());
        assertThat(bad.needsReview()).isEqualTo(good.needsReview());
    }
}
