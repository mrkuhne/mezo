package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** facts-always (mezo-d6ivw.8): the prompt-cap is a safety brake, not a working limit — this IT
 *  proves the trim only fires past the (lowered, test-only) cap and keeps the strongest facts. */
@Transactional
@TestPropertySource(properties = "mezo.companion.facts.prompt-cap=3")
class KnowledgeFactPromptCapIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeFactService knowledgeFactService;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testRenderPromptBlock_shouldKeepStrongestAndTrim_whenOverPromptCap() {
        UUID userId = databasePopulator.populateUser("fact-cap@test.local");
        for (int i = 1; i <= 5; i++) {
            factPopulator.fact(userId, "tény-%02d".formatted(i), "train", i);
        }

        String block = knowledgeFactService.renderPromptBlock(userId);

        assertThat(block).contains("tény-05").contains("tény-04").contains("tény-03");
        assertThat(block).doesNotContain("tény-02").doesNotContain("tény-01");
    }
}
