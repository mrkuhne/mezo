package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.CaseOutcome;
import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.EvalReport;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class EvalReportWriterTest {

    @Test
    void testToMarkdown_shouldRenderEveryGateNumberAndTheMisses_whenTheReportHasThem() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("gpt-5.6-luna", List.of(
            new CaseOutcome("a", "Mit edzek ma?", List.of("get_training_plan"),
                List.of("get_training_plan"), 1200, new BigDecimal("0.0012"), true, false),
            new CaseOutcome("b", "Mit ettem?", List.of("get_fuel_log"),
                List.of("get_training_log"), 900, new BigDecimal("0.0009"), true, false)));

        String markdown = EvalReportWriter.toMarkdown(report);

        assertThat(markdown).contains("# Tool-selection eval — gpt-5.6-luna");
        assertThat(markdown).contains("| exact match |");
        assertThat(markdown).contains("50.0%");
        assertThat(markdown).contains("critical wrong tool");
        assertThat(markdown).contains("get_training_log");
        assertThat(markdown).contains("[b] \"Mit ettem?\"");
    }

    @Test
    void testToMarkdown_shouldStateZeroMissesExplicitly_whenEveryCaseHit() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("gemini-2.5-flash", List.of(
            new CaseOutcome("a", "q", List.of("get_training_plan"),
                List.of("get_training_plan"), 1000, new BigDecimal("0.001"), true, false)));

        assertThat(EvalReportWriter.toMarkdown(report)).contains("Zero misses.");
    }
}
