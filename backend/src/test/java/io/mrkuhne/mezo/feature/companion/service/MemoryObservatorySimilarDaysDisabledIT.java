package io.mrkuhne.mezo.feature.companion.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SimilarDaysResponse;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S10 (mezo-eq85.10, fix round 1 FIX 3): the "Kereső" endpoint honours the same
 * per-policy kill switch as the tool — disabled ⇒ an empty list, a NULL {@code retrievalRunId} (no
 * run exists to point at) and no {@code memory_retrieval_run} row at all. Twin of
 * {@link io.mrkuhne.mezo.feature.companion.tools.MemoryToolsSimilarDaysDisabledIT}.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.similar-days.enabled=false")
class MemoryObservatorySimilarDaysDisabledIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryObservatoryService observatoryService;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSimilarDays_shouldReturnEmptyWithNoRunId_whenThePolicyIsDisabled() {
        UUID owner = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(owner, "daily_summary", UUID.randomUUID(),
                null, "Kemény leg-day volt, utána rossz alvás.", LocalDate.now().minusDays(4),
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        memoryItemPopulator.vector(item, VERSION, axisVector(0));

        SimilarDaysResponse response =
                observatoryService.similarDays(owner, "[fake-embed:1] rossz alvás edzés után", 3);

        assertThat(response.getItems()).isEmpty();
        assertThat(response.getRetrievalRunId()).isNull();
        assertThat(runRepository.findAll()).noneMatch(run -> owner.equals(run.getCreatedBy()));
    }
}
