package io.mrkuhne.mezo.feature.proactive.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S9 (mezo-eq85.9): {@code PREDICTION_EVIDENCE} disabled by config ⇒ the
 * fatigue diagnosis's gather ships with no {@code [Hosszú távú memória]} block and writes no
 * {@code memory_retrieval_run} row. Separate class — same precedent as {@code
 * PredictionGeneratorMemoryDisabledIT}.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.prediction-evidence.enabled=false")
class DiagnosisGeneratorMemoryDisabledIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private DiagnosisGenerator generator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    private void seedTwoDomains(UUID user) {
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("6.0"), 6);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 4, 7, null);
        }
        for (int i = 14; i < 42; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("7.5"), 8);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 8, 3, null);
        }
    }

    @Test
    void testGenerate_shouldShipWithNoMemoryBlockAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID user = userPopulator.createUser("diagnosis-memory-disabled@test.local").getId();
        seedTwoDomains(user);
        MemoryItemEntity item = memoryPopulator.item(user, "journal_entry", UUID.randomUUID(),
                "Napló", "Régen is hasonló fáradtságot éltél át.", TODAY.minusDays(3),
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        long before = runRepository.count();

        generator.generate(user, TODAY);

        assertThat(fakeLlm.lastUserMessage()).doesNotContain("[Hosszú távú memória]");
        assertThat(runRepository.count()).isEqualTo(before);
    }
}
