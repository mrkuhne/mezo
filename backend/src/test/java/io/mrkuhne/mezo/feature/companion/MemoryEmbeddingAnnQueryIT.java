package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingAnnQuery;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingAnnQuery.Hit;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * W3.1 (mezo-b3pp.12): the kind-set ANN search behind the ambient {@code [Emlékek]} block, which
 * runs through JDBC ({@link MemoryEmbeddingAnnQuery}) rather than Hibernate.
 *
 * <p>Deliberately NOT {@code @Transactional} at class level: the savepoint test needs a REAL outer
 * transaction that actually COMMITS, which a test-managed (always rolled back) one cannot provide.
 * The populator writes commit on their own here and the per-test ResetDatabase cleans up.
 */
class MemoryEmbeddingAnnQueryIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MemoryEmbeddingAnnQuery annQuery;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TransactionTemplate transactionTemplate;

    private static String literal(int axis) {
        return MemoryEmbeddingRepository.toVectorLiteral(MemoryEmbeddingPopulator.axisVector(axis));
    }

    @Test
    void testNearestInKinds_shouldRestrictToGivenKindsAndOrderByDistance_whenMixedKindsSeeded() {
        UUID owner = userPopulator.createUser().getId();
        MemoryEmbeddingEntity journal = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(), "napló", DAY,
            MemoryEmbeddingPopulator.axisVector(0));
        MemoryEmbeddingEntity gratitude = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_GRATITUDE, UUID.randomUUID(), "hála", DAY.minusDays(1),
            MemoryEmbeddingPopulator.blendVector(0, 1));
        // same geometry, but a kind OUTSIDE the requested set — must not appear
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, DAY, 0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 0);

        List<Hit> hits = annQuery.nearestInKinds(owner,
            List.of(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, MemoryEmbeddingEntity.KIND_GRATITUDE,
                    MemoryEmbeddingEntity.KIND_REFLECTION, MemoryEmbeddingEntity.KIND_DECISION),
            literal(0), 10);

        assertThat(hits).extracting(Hit::id).containsExactly(journal.getId(), gratitude.getId());
        assertThat(hits.get(0).distance()).isCloseTo(0.0, within(1e-6));
        assertThat(hits.get(1).kind()).isEqualTo(MemoryEmbeddingEntity.KIND_GRATITUDE);
        // the JDBC row mapper carries the fields the assembler renders and refs on
        assertThat(hits.get(0).content()).isEqualTo("napló");
        assertThat(hits.get(0).occurredOn()).isEqualTo(DAY);
        assertThat(hits.get(0).refId()).isEqualTo(journal.getRefId());
    }

    @Test
    void testNearestInKinds_shouldLimitToKAndExcludeOtherUsers_whenManyRows() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        for (int i = 0; i < 2; i++) {
            memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY.minusDays(i), 0);
        }
        MemoryEmbeddingEntity strangerRow = memoryEmbeddingPopulator.embedding(
            stranger, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 0);

        List<Hit> hits = annQuery.nearestInKinds(owner,
            List.of(MemoryEmbeddingEntity.KIND_CHAT_TURN), literal(0), 3);

        assertThat(hits).hasSize(2);
        assertThat(hits).allSatisfy(h -> assertThat(h.kind()).isEqualTo(MemoryEmbeddingEntity.KIND_CHAT_TURN));
        assertThat(hits).extracting(Hit::id).doesNotContain(strangerRow.getId());
    }

    /**
     * The reason this query is JDBC + savepoint (review finding, W3.1). Three properties in one
     * real, committing transaction:
     * <ol>
     *   <li>it reads on the CALLER's connection — it sees the caller's still-uncommitted row (a
     *       second-connection design would not, and would block on a test TRUNCATE's lock);</li>
     *   <li>a failed statement rolls back to the savepoint only — the surrounding transaction is
     *       left neither Postgres-"aborted" nor rollback-only, so BOTH layers keep working: JPA
     *       writes and further ANN reads succeed after the failure;</li>
     *   <li>the transaction then COMMITS — which is what a real chat turn needs to do.</li>
     * </ol>
     */
    @Test
    void testNearestInKinds_shouldNotPoisonCallersTransaction_whenQueryFails() {
        UUID owner = userPopulator.createUser().getId();

        transactionTemplate.executeWithoutResult(status -> {
            memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 0);
            // (1) same connection: the caller's uncommitted row is visible to the ANN query
            assertThat(annQuery.nearestInKinds(owner,
                List.of(MemoryEmbeddingEntity.KIND_CHAT_TURN), literal(0), 3)).hasSize(1);

            // a 3-dimensional literal against the 768-dim column: PG raises "different vector dimensions"
            assertThatThrownBy(() -> annQuery.nearestInKinds(owner,
                    List.of(MemoryEmbeddingEntity.KIND_CHAT_TURN),
                    MemoryEmbeddingRepository.toVectorLiteral(new float[3]), 3))
                .isInstanceOf(DataAccessException.class);

            // (2) both layers still healthy after the savepoint rollback — JPA write…
            memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY.minusDays(1), 1);
            assertThat(status.isRollbackOnly()).isFalse();
            // …and another ANN read
            assertThat(annQuery.nearestInKinds(owner,
                List.of(MemoryEmbeddingEntity.KIND_CHAT_TURN), literal(0), 3)).hasSize(2);
        });

        // (3) …and the transaction COMMITTED: a poisoned one dies here with UnexpectedRollbackException
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN))
            .isEqualTo(2);
    }
}
