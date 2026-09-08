package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * The two shared render helpers the 2026-09-08 morning-feed defect sweep introduced.
 *
 * <p>Both exist because a value was being rendered by five (quality) and by two (numbers)
 * independent call sites that had silently drifted apart — so these tests pin the CONTRACT the
 * call sites must not restate: the sleep-quality denominator is the contract's own bound
 * (mezo-b6zt), and a user-destined figure carries a Hungarian decimal comma (mezo-a64t).
 */
class ToolTextTest {

    @Test
    void testSleepQuality_shouldRenderAgainstTheContractCeiling() {
        assertThat(ToolText.sleepQuality(8)).isEqualTo("8/10");
    }

    /** The reported regression verbatim: an 8 must never render as the impossible "8/5". */
    @Test
    void testSleepQuality_shouldNeverRenderAnImpossibleFraction() {
        assertThat(ToolText.sleepQuality(8)).doesNotContain("/5");
    }

    /** A manual sleep row may carry no quality — "null/10" must never reach a prompt. */
    @Test
    void testSleepQuality_shouldReturnNullWhenUnrated() {
        assertThat(ToolText.sleepQuality(null)).isNull();
    }

    @Test
    void testHuNum_shouldUseAHungarianDecimalComma() {
        assertThat(ToolText.huNum(new BigDecimal("83.3"), 1)).isEqualTo("83,3");
    }

    /** The weight card quoted the raw EWMA at gram precision; a display figure rounds. */
    @Test
    void testHuNum_shouldRoundToTheRequestedPrecision() {
        assertThat(ToolText.huNum(new BigDecimal("83.694"), 1)).isEqualTo("83,7");
        assertThat(ToolText.huNum(new BigDecimal("-0.244"), 2)).isEqualTo("-0,24");
    }

    @Test
    void testHuNum_shouldKeepTrailingZerosSoOneQuantityRendersOneWay() {
        assertThat(ToolText.huNum(new BigDecimal("83"), 1)).isEqualTo("83,0");
    }

    @Test
    void testHuNum_shouldRenderAQuestionMarkWhenAbsent() {
        assertThat(ToolText.huNum(null, 1)).isEqualTo("?");
    }

    /** num() must stay locale-INDEPENDENT and unrounded: it feeds payloads the model PARSES, and
     *  changing it to match huNum would corrupt every tool argument round-trip. */
    @Test
    void testNum_shouldRemainLocaleIndependentAndUnrounded() {
        assertThat(ToolText.num(new BigDecimal("83.694"))).isEqualTo("83.694");
    }

    /**
     * The ceiling every 1..10 self-rating shares — sleep quality, check-in energy/stress/body/
     * mental, sport intensity. Each was ALSO rendered against a literal "/5" in at least one
     * renderer; the worst shape was the day narrative saying "energia 8/5" while the context
     * snapshot said "energia 8/10", so two prompts feeding one model contradicted each other.
     *
     * <p>NOTE what this does NOT do, so nobody reads more into it: it pins the literal 10, not the
     * contracts. Widening {@code sleep.yml}'s bound or {@code ck_sport_session_intensity} would
     * leave it green. Verifying against the sources of truth would mean parsing YAML and SQL from
     * a unit test; the guard that actually catches drift is that ONE constant now feeds every
     * renderer, so a mismatch cannot be local any more.
     */
    @Test
    void testRatingMax_shouldStayTenUntilEveryContractBoundMovesTogether() {
        assertThat(ToolText.RATING_MAX).isEqualTo(10);
    }

    @Test
    void testRating_shouldRenderAgainstTheSharedCeiling() {
        assertThat(ToolText.rating(8)).isEqualTo("8/10");
    }

    /** An unanswered slider must render NOTHING, so callers keep their omit-branch. Returning "0/10"
     *  or the literal "null/10" is the failure this pins — the latter really did reach prompts. */
    @Test
    void testRating_shouldReturnNullWhenUnanswered() {
        assertThat(ToolText.rating(null)).isNull();
    }

    /** sleepQuality is the same seam under a name its call sites read better — never a second one. */
    @Test
    void testSleepQuality_shouldBeTheSameSeamAsRating() {
        assertThat(ToolText.sleepQuality(7)).isEqualTo(ToolText.rating(7));
        assertThat(ToolText.sleepQuality(null)).isEqualTo(ToolText.rating(null));
    }

    /*
     * The three named helpers are the ONLY place a quantity's precision is decided (mezo-a64t).
     * Pinning them here matters more than it looks: the renderer ITs assert whole sentences, so a
     * changed precision would fail them with a diff about Hungarian prose rather than about the
     * number — and the refactor that introduced these helpers claimed byte-identical output
     * "by construction", which is exactly the kind of claim that needs a test under it.
     */
    @Test
    void testHuWeight_shouldRenderABodyWeightToOneDecimal() {
        assertThat(ToolText.huWeight(new BigDecimal("83.694"))).isEqualTo("83,7");
        assertThat(ToolText.huWeight(new BigDecimal("83"))).isEqualTo("83,0");
    }

    /** A weekly rate is finer than a weight on purpose: at one decimal, -0,244 kg/week would
     *  render as "-0,2" and a slow drift would read as a rounder number than it is. */
    @Test
    void testHuRate_shouldRenderAWeeklyRateToTwoDecimals() {
        assertThat(ToolText.huRate(new BigDecimal("-0.244"))).isEqualTo("-0,24");
    }

    @Test
    void testHuHours_shouldRenderADurationToOneDecimal() {
        assertThat(ToolText.huHours(new BigDecimal("6.62"))).isEqualTo("6,6");
    }

    /** Every helper inherits huNum's absent-value rendering — none may emit "null" or "0,0". */
    @Test
    void testNamedHelpers_shouldRenderAQuestionMarkWhenAbsent() {
        assertThat(ToolText.huWeight(null)).isEqualTo("?");
        assertThat(ToolText.huRate(null)).isEqualTo("?");
        assertThat(ToolText.huHours(null)).isEqualTo("?");
    }

    @Test
    void testHuTrajectory_shouldTranslateTheRawDbValues() {
        assertThat(ToolText.huTrajectory("cut")).isEqualTo("fogyás");
        assertThat(ToolText.huTrajectory("bulk")).isEqualTo("tömegelés");
    }

    /**
     * The repo owner's own definition: "Lean Gain" is a RECOMP — hold body weight, gain strength
     * and muscle, add no fat. A bare "súlytartás" reads as "do nothing", the opposite of the
     * prescription, and that reading is exactly what shipped ("ami a súlyod fenntartását célozza").
     */
    @Test
    void testHuTrajectory_shouldSpellOutRecomp_whenTheGoalIsMaintain() {
        assertThat(ToolText.huTrajectory("maintain"))
            .startsWith("súlytartás")
            .contains("recomp")
            .contains("izomgyarapodás")
            .contains("hízás nélkül");
    }

    /** A widened DB CHECK must degrade to an untranslated label, never take a whole snapshot down. */
    @Test
    void testHuTrajectory_shouldFallThroughVerbatim_whenTheValueIsUnknown() {
        assertThat(ToolText.huTrajectory("recomp_v2")).isEqualTo("recomp_v2");
    }

    @Test
    void testHuTrajectory_shouldRenderHonestAbsence_whenNoTrajectoryIsSet() {
        assertThat(ToolText.huTrajectory(null)).isEqualTo(ToolText.NO_DATA);
    }
}
