package io.mrkuhne.mezo.feature.journal;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Acceptance test for the W1.4 decision embed pipeline (bd mezo-b3pp.4, spec §5.4): a created
 * decision yields exactly ONE {@code memory_embedding(kind=decision)} row, and reviewing it
 * re-embeds the SAME row with the outcome folded in — the outcome is the valuable half.
 * {@code JournalEmbeddingEventIT}'s idiom: not {@code @Transactional}, Awaitility for the async hop.
 */
@ActiveProfiles("companion-fake")
class DecisionEmbeddingEventIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testCreateDecisionEntry_shouldProduceExactlyOneEmbedding_whenCommitted() {
        UUID owner = ownerId();

        DecisionEntryResponse created = postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder()
                .decisionText("Esti edzésre váltok a reggeli helyett.")
                .decidedOn(LocalDate.parse("2026-08-20"))
                .build(),
            ownerAuthHeaders(), HttpStatus.CREATED, DecisionEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            var rows = memoryEmbeddingRepository.findAll().stream()
                .filter(r -> r.getCreatedBy().equals(owner))
                .filter(r -> MemoryEmbeddingEntity.KIND_DECISION.equals(r.getKind()))
                .toList();
            assertThat(rows).hasSize(1);
            assertThat(rows.getFirst().getRefId()).isEqualTo(created.getId());
            assertThat(rows.getFirst().getContent()).isEqualTo("Esti edzésre váltok a reggeli helyett.");
            assertThat(rows.getFirst().getOccurredOn()).isEqualTo(LocalDate.parse("2026-08-20"));
        });
    }

    @Test
    void testReviewDecisionEntry_shouldReembedTheSameRowWithTheOutcome_whenReviewed() {
        UUID owner = ownerId();

        DecisionEntryResponse created = postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder()
                .decisionText("Esti edzésre váltok a reggeli helyett.")
                .decidedOn(LocalDate.parse("2026-08-20"))
                .build(),
            ownerAuthHeaders(), HttpStatus.CREATED, DecisionEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_DECISION, created.getId())).isPresent());
        UUID rowIdBefore = memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_DECISION, created.getId()).orElseThrow().getId();

        putForBody("/api/journal/decision/" + created.getId() + "/review",
            ReviewDecisionRequest.builder().outcomeRating(4).outcomeText("Jobban aludtam tőle.").build(),
            ownerAuthHeaders(), HttpStatus.OK, DecisionEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            var row = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_DECISION, created.getId()).orElseThrow();
            assertThat(row.getId()).isEqualTo(rowIdBefore);
            assertThat(row.getContent()).contains("Esti edzésre váltok a reggeli helyett.");
            assertThat(row.getContent()).contains("Jobban aludtam tőle.");
            assertThat(row.getContent()).contains("4/5");
        });
        assertThat(memoryEmbeddingRepository.findAll().stream()
            .filter(r -> r.getCreatedBy().equals(owner))
            .filter(r -> MemoryEmbeddingEntity.KIND_DECISION.equals(r.getKind()))).hasSize(1);
    }
}
