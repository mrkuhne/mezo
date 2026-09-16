package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Plan done-criterion 4, as an executable guard (mezo-rj214.7): every one of the 42 tool-selection
 * eval questions is data-bearing by construction — each one exists precisely because it should make
 * the companion reach for a tool. So NONE of them may classify as {@code CHAT}, because a CHAT turn
 * carries no tools at all and would answer them out of thin air.
 *
 * <p>{@code UNSURE} (an empty Optional) is an acceptable outcome here: the cheap classifier or the
 * ANALYSIS fallback picks it up, and the turn still gets its tools. Only CHAT is a defect.
 *
 * <p>This corpus is the analyzer's coverage compass. The unit cases in {@code TurnGearAnalyzerTest}
 * are equally binding in the other direction — a general-knowledge question must STAY CHAT — so a
 * new stem that silences this test while breaking that one is not a fix.
 */
class TurnGearAnalyzerEvalCorpusTest {

    private static final String CASES_RESOURCE = "companion/tool-selection-cases.json";

    private final TurnGearAnalyzer analyzer = new TurnGearAnalyzer();

    @Test
    void testAnalyze_shouldNeverReturnChat_whenTheQuestionComesFromTheToolSelectionCorpus()
            throws IOException {
        List<String> offenders = new ArrayList<>();
        int total = 0;
        for (JsonNode testCase : readCases()) {
            total++;
            String question = testCase.get("question").asText();
            if (analyzer.analyze(question).filter(TurnGear.CHAT::equals).isPresent()) {
                offenders.add(testCase.get("id").asText() + " -> \"" + question + "\"");
            }
        }

        assertThat(total)
            .as("the tool-selection corpus should not have shrunk under this guard")
            .isGreaterThanOrEqualTo(42);
        assertThat(offenders)
            .as("every tool-selection case is a data-bearing question by construction; a CHAT gear "
                + "would strip its tools and answer it from nothing. Add the missing stem to "
                + "TurnGearAnalyzer (never a supplement or exercise NAME — those belong to "
                + "general-knowledge questions that must stay CHAT)")
            .isEmpty();
    }

    private static List<JsonNode> readCases() throws IOException {
        try (InputStream stream = TurnGearAnalyzerEvalCorpusTest.class.getClassLoader()
                .getResourceAsStream(CASES_RESOURCE)) {
            assertThat(stream).as("missing test resource %s", CASES_RESOURCE).isNotNull();
            JsonNode root = new ObjectMapper().readTree(stream);
            List<JsonNode> cases = new ArrayList<>();
            root.forEach(cases::add);
            return cases;
        }
    }
}
