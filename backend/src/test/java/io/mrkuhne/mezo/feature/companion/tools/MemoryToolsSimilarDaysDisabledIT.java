package io.mrkuhne.mezo.feature.companion.tools;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S10 (mezo-eq85.10, fix round 1 FIX 3): {@code SIMILAR_DAYS} disabled by config
 * ⇒ {@code find_similar_past_days} does NO fan-out and writes NO {@code memory_retrieval_run} row,
 * so the surface can be rolled back purely by config as {@code application.yml} promises. Separate
 * class because {@code @TestPropertySource} is class-level — the {@code MemoirGeneratorMemoryDisabledIT}
 * precedent.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.similar-days.enabled=false")
class MemoryToolsSimilarDaysDisabledIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryTools memoryTools;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testFindSimilarPastDays_shouldRenderNoDataAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(4);
        MemoryItemEntity item = memoryItemPopulator.item(owner, "daily_summary", UUID.randomUUID(),
                null, "Kemény leg-day volt, utána rossz alvás.", day, new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        memoryItemPopulator.vector(item, VERSION, axisVector(0));
        ToolCallAudit audit = new ToolCallAudit(6, 10);
        ToolContext context =
                new ToolContext(Map.of(ToolContexts.USER_ID, owner, ToolContexts.AUDIT, audit));

        String out = memoryTools.findSimilarPastDays(
                "[fake-embed:1] rossz alvás edzés után", 2, context);

        assertThat(out).isEqualTo("Hasonló korábbi napok: nincs adat");
        assertThat(runRepository.findAll()).noneMatch(run -> owner.equals(run.getCreatedBy()));
    }
}
