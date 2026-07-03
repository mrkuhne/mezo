package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * V2.3 recall tool render (the CompanionToolsRenderIT idiom): direct call with a hand-built
 * ToolContext, the query embedding scripted via the fake embedder's {@code [fake-embed:…]}
 * sentinel, refs asserted on the audit.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MemoryToolsRenderIT extends AbstractIntegrationTest {

    @Autowired private MemoryTools memoryTools;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    private ToolCallAudit audit;

    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testFindSimilarPastDays_shouldRenderDatesAndDigests_whenSummariesMatch() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(4);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "Kemény leg-day volt, utána rossz alvás.", day,
                MemoryEmbeddingPopulator.axisVector(0));

        String out = memoryTools.findSimilarPastDays("[fake-embed:1] rossz alvás edzés után", 2, ctx(owner));

        assertThat(out).contains("Hasonló korábbi napok")
                .contains(day.toString())
                .contains("Kemény leg-day volt, utána rossz alvás.")
                .contains("egyezés 100%");
        assertThat(audit.toRefsEnvelope().refs())
                .anySatisfy(ref -> {
                    assertThat(ref.kind()).isEqualTo("Memory");
                    assertThat(ref.id()).isEqualTo(day.toString());
                });
    }

    @Test
    void testFindSimilarPastDays_shouldRenderNoData_whenNothingMatches() {
        UUID owner = userPopulator.createUser().getId();

        String out = memoryTools.findSimilarPastDays("[fake-embed:1] bármi", null, ctx(owner));

        assertThat(out).isEqualTo("Hasonló korábbi napok: nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }
}
