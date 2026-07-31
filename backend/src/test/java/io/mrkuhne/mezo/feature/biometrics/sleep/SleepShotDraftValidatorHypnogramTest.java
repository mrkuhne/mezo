package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Extracted;
import org.junit.jupiter.api.Test;

/** V1-V3 of the hypnogram gate (mezo-fk9a, spec section 4). Plain unit test: the validator
 *  is deterministic and has no collaborators. */
class SleepShotDraftValidatorHypnogramTest {

    private final SleepShotDraftValidator validator = new SleepShotDraftValidator();

    /**
     * The canonical screenshot: 0:42 -> 9:03 = a 501-minute span. Two DIFFERENT lengths matter
     * here and must not be conflated (conflating them is what hid a boundary bug once):
     * <ul>
     *   <li>{@code GOOD.length()} is <b>34</b> — the literal sequence below;</li>
     *   <li>the length V2 compares against is the SPAN-derived {@code round(501 / 15f)} = <b>33</b>.</li>
     * </ul>
     * So GOOD itself sits at a drift of |34 - 33| = 1, comfortably inside the ±2 tolerance.
     * Every drift figure in this class is measured against 33, never against 34.
     * Composition (D=8, L=12, R=12, A=2 buckets) is within V3 tolerance of 100/206/144/52 min.
     */
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

    /* --- V2's +/-2 bucket boundary, pinned from both sides against the SPAN-derived 33. --- */

    /** 31 chars -> drift |31 - 33| = 2, the inclusive edge below. Composition still passes
     *  (D=8, L=12, R=9, A=2), so length is the only thing under test. */
    @Test
    void testAcceptedHypnogram_shouldReturnTheSequence_whenTwoBucketsShorterThanTheSpan() {
        String shorter = GOOD.substring(0, 31);
        assertThat(shorter).hasSize(31);
        assertThat(validator.acceptedHypnogram(with(shorter))).isEqualTo(shorter);
    }

    /** 35 chars -> drift |35 - 33| = 2, the inclusive edge above. The extra bucket is an 'L'
     *  on purpose: an extra 'R' would tip R to 195 vs 144 min and fail V3 for the wrong reason. */
    @Test
    void testAcceptedHypnogram_shouldReturnTheSequence_whenTwoBucketsLongerThanTheSpan() {
        String longer = GOOD + "L";
        assertThat(longer).hasSize(35);
        assertThat(validator.acceptedHypnogram(with(longer))).isEqualTo(longer);
    }

    /** 30 chars -> drift |30 - 33| = 3, just outside. This one's composition (D=8, L=11, R=9,
     *  A=2) passes V3 cleanly, so a null here can ONLY be V2 rejecting the length. */
    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenThreeBucketsShorterThanTheSpan() {
        String tooShort = GOOD.substring(0, 30);
        assertThat(tooShort).hasSize(30);
        assertThat(validator.acceptedHypnogram(with(tooShort))).isNull();
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

    /**
     * Regression: 'A' used to be exempt from the V3 precondition, so a missing awakeMin meant the
     * awake stage faced NO cross-check while its letters still spent V2's length budget. This
     * sequence is built to exploit exactly that — 34 chars (drift 1, V2 ok) whose D/L/R counts all
     * sit inside tolerance (90 vs 100, 165 vs 206, 180 vs 144), leaving a fabricated 5-bucket /
     * 75-minute awake stretch to reach the user unchallenged. awakeMin is now part of the same
     * all-or-nothing precondition, so the whole drawing is dropped instead.
     */
    @Test
    void testAcceptedHypnogram_shouldReturnNull_whenAwakeMinutesAreMissing() {
        String fabricatedAwake = "A".repeat(5) + "D".repeat(6) + "L".repeat(11) + "R".repeat(12);
        assertThat(fabricatedAwake).hasSize(34); // passes V2 against the span-derived 33
        Extracted noAwake =
            new Extracted("00:42", "09:03", 449, 501, null, 206, 144, 100, 95, fabricatedAwake);

        assertThat(validator.acceptedHypnogram(noAwake)).isNull();
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
