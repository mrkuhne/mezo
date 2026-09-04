package io.mrkuhne.mezo.feature.companion.memory;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalFeedbackRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalResultRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class MemoryPlatformPersistenceIT extends AbstractIntegrationTest {

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private MemoryItemPopulator memoryItemPopulator;

    @Autowired
    private MemoryItemRepository memoryItemRepository;

    @Autowired
    private MemoryVectorRepository memoryVectorRepository;

    @Autowired
    private MemoryRetrievalRunRepository memoryRetrievalRunRepository;

    @Autowired
    private MemoryRetrievalResultRepository memoryRetrievalResultRepository;

    @Autowired
    private MemoryRetrievalFeedbackRepository memoryRetrievalFeedbackRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Test
    void testPersist_shouldRoundTripArraysAndTypedJson_whenCanonicalItemAndAuditAreReloaded() {
        UUID owner = userPopulator.createUser().getId();
        UUID conversationId = UUID.randomUUID();
        MemoryProvenanceEnvelope provenance = new MemoryProvenanceEnvelope(
                "journal_entry", Instant.parse("2026-08-29T19:05:00Z"), "projection-v1", conversationId);
        MemoryItemEntity item = memoryItemPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Esti futás", "Futás után jobban aludtam", LocalDate.of(2026, 8, 29),
                new String[]{"futás", "alvás"}, new String[]{"Anna"}, provenance);
        MemoryRetrievalRunEntity run = memoryItemPopulator.run(owner, UUID.randomUUID());
        ScoreBreakdownEnvelope scores = new ScoreBreakdownEnvelope(
                Map.of("dense", 1, "lexical", 2), 0.032, 0.004, 0.003, 0.002, 0.001, 0.003, null, 0.045);
        MemoryRetrievalResultEntity result = memoryItemPopulator.result(owner, run, item, 1, true, scores);

        entityManager.flush();
        entityManager.clear();

        MemoryItemEntity reloadedItem = memoryItemRepository
                .findByIdAndCreatedByAndDeletedFalse(item.getId(), owner).orElseThrow();
        MemoryRetrievalResultEntity reloadedResult = memoryRetrievalResultRepository
                .findByIdAndRunIdAndCreatedBy(result.getId(), run.getId(), owner).orElseThrow();

        assertThat(reloadedItem.getTopics()).containsExactly("futás", "alvás");
        assertThat(reloadedItem.getPeople()).containsExactly("Anna");
        assertThat(reloadedItem.getProvenance()).isEqualTo(provenance);
        assertThat(reloadedResult.getScoreBreakdown()).isEqualTo(scores);
        assertThat(memoryRetrievalRunRepository.findByTraceIdAndCreatedBy(run.getTraceId(), owner)).isPresent();
    }

    @Test
    void testPersist_shouldKeepTwoVectorGenerations_whenVersionsDiffer() {
        UUID owner = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Futás után jobban aludtam", LocalDate.of(2026, 8, 29));

        memoryItemPopulator.vector(item, "gemini-embedding-001-768-v1", axisVector(0));
        memoryItemPopulator.vector(item, "gemini-embedding-001-768-v2", axisVector(1));

        assertThat(memoryVectorRepository.findByCreatedByAndMemoryItemIdOrderByEmbeddingVersion(owner, item.getId()))
                .extracting(MemoryVectorEntity::getEmbeddingVersion)
                .containsExactly("gemini-embedding-001-768-v1", "gemini-embedding-001-768-v2");
    }

    @Test
    void testPersist_shouldRejectDuplicateVectorGeneration_whenItemAndVersionMatch() {
        UUID owner = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Futás után jobban aludtam", LocalDate.of(2026, 8, 29));
        memoryItemPopulator.vector(item, "gemini-embedding-001-768-v1", axisVector(0));

        assertThatThrownBy(() -> memoryItemPopulator.vector(
                item, "gemini-embedding-001-768-v1", axisVector(1)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testFind_shouldReturnEmpty_whenMemoryBelongsToAnotherUser() {
        UUID ownerA = userPopulator.createUser().getId();
        UUID ownerB = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(ownerA, "journal_entry", UUID.randomUUID(),
                "Csak az A felhasználó emléke", LocalDate.of(2026, 8, 29));

        assertThat(memoryItemRepository.findByIdAndCreatedByAndDeletedFalse(item.getId(), ownerB)).isEmpty();
        assertThat(memoryItemRepository.findByCreatedByAndSourceKindAndSourceId(
                ownerB, item.getSourceKind(), item.getSourceId())).isEmpty();
    }

    @Test
    void testHardDelete_shouldCascadeResultsAndFeedback_whenAuditRunIsPurged() {
        UUID owner = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Futás után jobban aludtam", LocalDate.of(2026, 8, 29));
        MemoryRetrievalRunEntity run = memoryItemPopulator.run(owner, UUID.randomUUID());
        MemoryRetrievalResultEntity result = memoryItemPopulator.result(
                owner, run, item, 1, true, ScoreBreakdownEnvelope.empty());
        MemoryRetrievalFeedbackEntity feedback = memoryItemPopulator.feedback(owner, run, result, item, "useful");

        entityManager.createNativeQuery("delete from memory_retrieval_run where id = :id")
                .setParameter("id", run.getId())
                .executeUpdate();
        entityManager.flush();
        entityManager.clear();

        assertThat(memoryRetrievalRunRepository.findById(run.getId())).isEmpty();
        assertThat(memoryRetrievalResultRepository.findById(result.getId())).isEmpty();
        assertThat(memoryRetrievalFeedbackRepository.findById(feedback.getId())).isEmpty();
    }

    @Test
    void testBackfill_shouldHaveCanonicalReadyVectorForEveryLiveLegacyEmbedding() {
        Number missingItems = (Number) entityManager.createNativeQuery("""
                select count(*) from memory_embedding m
                left join memory_item i on i.id = m.id and i.created_by = m.created_by
                where m.is_deleted = false and i.id is null
                """).getSingleResult();
        Number missingVectors = (Number) entityManager.createNativeQuery("""
                select count(*) from memory_item i
                left join memory_vector v on v.memory_item_id = i.id
                  and v.embedding_version = 'gemini-embedding-001-768-v1' and v.status = 'ready'
                where i.is_deleted = false and i.provenance ->> 'sourceTable' = 'memory_embedding'
                  and v.id is null
                """).getSingleResult();

        assertThat(missingItems.longValue()).isZero();
        assertThat(missingVectors.longValue()).isZero();
    }
}
