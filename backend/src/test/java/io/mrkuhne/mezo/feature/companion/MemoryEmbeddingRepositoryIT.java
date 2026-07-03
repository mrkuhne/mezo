package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository.MemoryMatch;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * V2.1 vector layer proof: the pgvector extension is live, the entity round-trips through
 * hibernate-vector, and the ANN cosine query orders/filters correctly over hand-seeded
 * vectors (deterministic axis geometry — no embedding provider anywhere near these tests).
 */
@Transactional
class MemoryEmbeddingRepositoryIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testMigration_shouldHaveVectorExtension_whenChangelogApplied() {
        String version = jdbcTemplate.queryForObject(
            "select extversion from pg_extension where extname = 'vector'", String.class);
        assertThat(version).isNotBlank();
    }

    @Test
    void testSave_shouldRoundTripVector_whenPersistedViaJpa() {
        UUID owner = userPopulator.createUser().getId();
        float[] vector = MemoryEmbeddingPopulator.blendVector(3, 7);

        MemoryEmbeddingEntity saved = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, UUID.randomUUID(), "kemény leg-day volt", DAY, vector);

        MemoryEmbeddingEntity reloaded = memoryEmbeddingRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
        assertThat(reloaded.getEmbedding()[3]).isCloseTo(vector[3], within(1e-6f));
        assertThat(reloaded.getEmbedding()[7]).isCloseTo(vector[7], within(1e-6f));
        assertThat(reloaded.getOccurredOn()).isEqualTo(DAY);
    }

    @Test
    void testFindNearest_shouldOrderByCosineDistance_whenVectorsSeeded() {
        UUID owner = userPopulator.createUser().getId();
        MemoryEmbeddingEntity exact = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, UUID.randomUUID(), "exact", DAY,
            MemoryEmbeddingPopulator.axisVector(0));
        MemoryEmbeddingEntity near = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, UUID.randomUUID(), "near", DAY.minusDays(1),
            MemoryEmbeddingPopulator.blendVector(0, 1));
        MemoryEmbeddingEntity far = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, UUID.randomUUID(), "far", DAY.minusDays(2),
            MemoryEmbeddingPopulator.axisVector(1));

        List<MemoryMatch> matches = memoryEmbeddingRepository.findNearest(owner, null,
            MemoryEmbeddingRepository.toVectorLiteral(MemoryEmbeddingPopulator.axisVector(0)), 10);

        assertThat(matches).extracting(MemoryMatch::getId)
            .containsExactly(exact.getId(), near.getId(), far.getId());
        assertThat(matches.get(0).getDistance()).isCloseTo(0.0, within(1e-6));
        assertThat(matches.get(1).getDistance()).isCloseTo(1 - Math.sqrt(2) / 2, within(1e-6));
        assertThat(matches.get(2).getDistance()).isCloseTo(1.0, within(1e-6));
        assertThat(matches.get(1).getContent()).isEqualTo("near");
        assertThat(matches.get(1).getOccurredOn()).isEqualTo(DAY.minusDays(1));
    }

    @Test
    void testFindNearest_shouldFilterByKind_whenKindGiven() {
        UUID owner = userPopulator.createUser().getId();
        MemoryEmbeddingEntity summary = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, DAY, 0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 0);

        List<MemoryMatch> matches = memoryEmbeddingRepository.findNearest(owner,
            MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
            MemoryEmbeddingRepository.toVectorLiteral(MemoryEmbeddingPopulator.axisVector(0)), 10);

        assertThat(matches).extracting(MemoryMatch::getId).containsExactly(summary.getId());
        assertThat(matches.getFirst().getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_DAILY_SUMMARY);
    }

    @Test
    void testFindNearest_shouldLimitToK_whenMoreRowsExist() {
        UUID owner = userPopulator.createUser().getId();
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 1);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 2);

        List<MemoryMatch> matches = memoryEmbeddingRepository.findNearest(owner, null,
            MemoryEmbeddingRepository.toVectorLiteral(MemoryEmbeddingPopulator.axisVector(0)), 2);

        assertThat(matches).hasSize(2);
    }

    @Test
    void testFindNearest_shouldExcludeOtherUsersRows_whenTwoUsersHaveMemories() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        MemoryEmbeddingEntity own = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, DAY, 0);
        memoryEmbeddingPopulator.embedding(other, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, DAY, 0);

        List<MemoryMatch> matches = memoryEmbeddingRepository.findNearest(owner, null,
            MemoryEmbeddingRepository.toVectorLiteral(MemoryEmbeddingPopulator.axisVector(0)), 10);

        assertThat(matches).extracting(MemoryMatch::getId).containsExactly(own.getId());
    }

    @Test
    void testFindNearest_shouldExcludeSoftDeletedRows_whenRowDeleted() {
        UUID owner = userPopulator.createUser().getId();
        MemoryEmbeddingEntity kept = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, DAY, 0);
        MemoryEmbeddingEntity removed = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, DAY, 1);
        memoryEmbeddingRepository.delete(removed);
        memoryEmbeddingRepository.flush();

        List<MemoryMatch> matches = memoryEmbeddingRepository.findNearest(owner, null,
            MemoryEmbeddingRepository.toVectorLiteral(MemoryEmbeddingPopulator.axisVector(0)), 10);

        assertThat(matches).extracting(MemoryMatch::getId).containsExactly(kept.getId());
    }

    @Test
    void testSave_shouldRejectDuplicate_whenSameKindAndRefId() {
        UUID owner = userPopulator.createUser().getId();
        UUID refId = UUID.randomUUID();
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, refId, "első", DAY,
            MemoryEmbeddingPopulator.axisVector(0));

        assertThatThrownBy(() -> memoryEmbeddingPopulator.embedding(
                owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, refId, "második", DAY,
                MemoryEmbeddingPopulator.axisVector(1)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}
