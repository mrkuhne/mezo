package io.mrkuhne.mezo.feature.companion.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SimilarDayItem;
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

/**
 * Memória mindenhol S10 (bd mezo-eq85.10): {@code MemoryObservatoryService.similarDays} moved off
 * the retired V2.3 {@code MemoryRecallService} onto {@code MemoryContextService} under the
 * {@code SIMILAR_DAYS} policy — the "Kereső" segment's endpoint, exercised the same way
 * {@link io.mrkuhne.mezo.feature.companion.tools.MemoryToolsSimilarDaysIT} exercises the tool
 * (same seeding shape, same daily_summary filter). Deliberately NOT class-level
 * {@code @Transactional} — the service's own javadoc explains why (no DB connection held across
 * the embed network hop), and it is also what the S7/S8 retriever-fan-out hazard note requires.
 */
@ActiveProfiles("companion-fake")
class MemoryObservatorySimilarDaysIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryObservatoryService observatoryService;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSimilarDays_shouldReturnRankedDailySummaries_whenMemoryItemAndVectorAreSeeded() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(4);
        MemoryItemEntity daily = item(owner, "daily_summary",
                "Kemény leg-day volt, utána rossz alvás.", day, axisVector(0));
        // Same vector, but not a daily_summary — must be filtered out of the response entirely.
        item(owner, "journal_entry", "IDEGEN-NAPLO-SZOVEG", day.minusDays(1), axisVector(0));

        SimilarDaysResponse response =
                observatoryService.similarDays(owner, "[fake-embed:1] rossz alvás edzés után", 3);

        assertThat(response.getItems()).hasSize(1);
        SimilarDayItem hit = response.getItems().getFirst();
        assertThat(hit.getDate()).isEqualTo(day);
        assertThat(hit.getExcerpt()).contains("Kemény leg-day volt, utána rossz alvás.");
        assertThat(hit.getRank()).isEqualTo(1);
        assertThat(hit.getMemoryItemId()).isEqualTo(daily.getId());
        assertThat(response.getItems()).extracting(SimilarDayItem::getExcerpt)
                .noneMatch(excerpt -> excerpt.contains("IDEGEN-NAPLO-SZOVEG"));
        assertThat(response.getRetrievalRunId()).isNotNull();
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("SIMILAR_DAYS"));
    }

    @Test
    void testSimilarDays_shouldReturnEmpty_whenNothingMatches() {
        UUID owner = userPopulator.createUser().getId();

        SimilarDaysResponse response = observatoryService.similarDays(owner, "[fake-embed:1] bármi", null);

        assertThat(response.getItems()).isEmpty();
    }

    private MemoryItemEntity item(UUID owner, String sourceKind, String content, LocalDate occurredOn,
                                  float[] vector) {
        MemoryItemEntity entity = memoryItemPopulator.item(owner, sourceKind, UUID.randomUUID(),
                null, content, occurredOn, new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        memoryItemPopulator.vector(entity, VERSION, vector);
        return entity;
    }
}
