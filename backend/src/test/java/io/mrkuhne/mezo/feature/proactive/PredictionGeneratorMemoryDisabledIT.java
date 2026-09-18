package io.mrkuhne.mezo.feature.proactive;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.proactive.service.PredictionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S9 (mezo-eq85.9): {@code PREDICTION_EVIDENCE} disabled by config ⇒ the
 * prediction generator's gather ships with no {@code [Hosszú távú memória]} block and writes no
 * {@code memory_retrieval_run} row. Separate class — the {@code
 * WeeklySuggestionGeneratorMemoryDisabledIT}/{@code ChatServicePipelineSwitchOffIT} precedent
 * ({@code @TestPropertySource} is class-level in Spring, so a per-test override isn't possible).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.prediction-evidence.enabled=false")
class PredictionGeneratorMemoryDisabledIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private PredictionGenerator generator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testGenerate_shouldShipWithNoMemoryBlockAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID user = userPopulator.createUser("prediction-memory-disabled@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        MemoryItemEntity item = memoryPopulator.item(user, "journal_entry", UUID.randomUUID(),
                "Napló", "Régen is hasonló mintát figyeltél meg.", WEEK_START.minusDays(3),
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        long before = runRepository.count();

        generator.generate(user, WEEK_START);

        assertThat(fakeLlm.lastUserMessage()).doesNotContain("[Hosszú távú memória]");
        assertThat(runRepository.count()).isEqualTo(before);
    }
}
