package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit.ToolOutcome;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * mezo-indo: the tool-output block the verdict judge gets. The judge runs on the cheap tier and
 * its payload already carries the system prompt + the whole history, so the digest's whole job is
 * to be HONEST inside a hard character budget: truncation must be visible, and a dropped output
 * must never look like an output that said nothing.
 */
class ToolOutcomeDigestTest {

    @Test
    void testRender_shouldSayNone_whenNoToolRan() {
        assertThat(ToolOutcomeDigest.render(List.of(), 100, 500)).isEqualTo(ToolOutcomeDigest.NONE);
    }

    @Test
    void testRender_shouldCarryNameArgsAndResultVerbatim_whenWithinBudget() {
        String block = ToolOutcomeDigest.render(
                List.of(new ToolOutcome("get_weight_trend", "weeks=4", "Súlytrend (4 hét): trendsúly 85,536 kg")),
                200, 500);

        assertThat(block).contains("get_weight_trend", "weeks=4", "Súlytrend (4 hét): trendsúly 85,536 kg");
        assertThat(block).doesNotContain(ToolOutcomeDigest.TRUNCATED, ToolOutcomeDigest.OMITTED);
    }

    @Test
    void testRender_shouldTruncateAndMarkIt_whenOneResultExceedsThePerResultCap() {
        String longResult = "x".repeat(50);

        String block = ToolOutcomeDigest.render(
                List.of(new ToolOutcome("get_weight_log", "days=30", longResult)), 10, 500);

        assertThat(block).contains("x".repeat(10) + ToolOutcomeDigest.TRUNCATED);
        assertThat(block).doesNotContain("x".repeat(11));
    }

    @Test
    void testRender_shouldKeepTheNameAndMarkTheOutputOmitted_whenTheTotalBudgetIsSpent() {
        // The second call's output does not fit. Dropping the CALL would hide that it ran; dropping
        // the output silently would read as "this tool returned nothing" — both mislead the judge.
        String block = ToolOutcomeDigest.render(
                List.of(new ToolOutcome("get_weight_trend", "weeks=4", "y".repeat(30)),
                        new ToolOutcome("get_sleep", "days=7", "z".repeat(30))),
                30, 30);

        assertThat(block).contains("y".repeat(30));
        assertThat(block).contains("get_sleep").contains(ToolOutcomeDigest.OMITTED);
        assertThat(block).doesNotContain("z");
    }

    @Test
    void testRender_shouldMarkTheOutputUnknown_whenNoResultWasRecorded() {
        String block = ToolOutcomeDigest.render(
                List.of(new ToolOutcome("get_sleep", "days=7", null)), 100, 500);

        assertThat(block).contains("get_sleep").contains(ToolOutcomeDigest.UNKNOWN);
    }
}
