package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService.Critique;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService.Hypothesis;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * mezo-renhu — the night's critiques judge DIFFERENT hypotheses against the SAME weekly context.
 * GPT-5.6 caches only at message boundaries, so the shared context must travel as the closing
 * half of the leading instructions (the {@code turnContext}) and the per-hypothesis text as the
 * user message. Production measured 0 cached tokens on 45 calls while the hypothesis block sat IN
 * FRONT of the context inside one user message.
 */
class HypothesisCritiquePrefixTest {

    private static final String CONTEXT = "NAPI ÖSSZEFOGLALÓK:\n2026-09-22: edzés, 162 g fehérje.";

    @Test
    void testCritiqueContext_shouldBeIdentical_whenTwoHypothesesShareTheWeek() {
        assertThat(HypothesisPipelineService.sharedContext(CONTEXT))
                .isEqualTo(HypothesisPipelineService.sharedContext(CONTEXT))
                .contains(CONTEXT)
                .doesNotContain("HIPOTÉZIS:");
    }

    @Test
    void testCritiqueQuestion_shouldCarryOnlyTheHypothesis_whenBuilt() {
        String first = HypothesisPipelineService.critiqueQuestion(hypothesis("Első sejtés"));
        String second = HypothesisPipelineService.critiqueQuestion(hypothesis("Második sejtés"));

        assertThat(first).startsWith("HIPOTÉZIS: Első sejtés").doesNotContain(CONTEXT).doesNotContain("KONTEXTUS:");
        assertThat(second).startsWith("HIPOTÉZIS: Második sejtés");
    }

    @Test
    void testReviseQuestion_shouldCarryOnlyTheHypothesisAndCritique_whenBuilt() {
        String question = HypothesisPipelineService.reviseQuestion(hypothesis("Sejtés"),
                new Critique(0.5, 0.5, 0.5, 0.5, "túl tág", null, null, null));

        assertThat(question).startsWith("HIPOTÉZIS: Sejtés").contains("KRITIKA: túl tág")
                .doesNotContain("KONTEXTUS:");
    }

    private static Hypothesis hypothesis(String title) {
        return new Hypothesis(title, "mechanizmus", "trigger", null, null, null,
                "megfigyelés", "kérdés?", List.of("journal_entry:1"), "topic");
    }
}
