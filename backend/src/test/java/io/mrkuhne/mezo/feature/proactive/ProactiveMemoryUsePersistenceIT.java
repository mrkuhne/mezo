package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.ProactiveMemoryUseEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ProactiveMemoryUseRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** proactive_memory_use cooldown ledger round-trip + the lookback-window contract (S5, mezo-d6ivw.5). */
@Transactional
class ProactiveMemoryUsePersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 26);

    @Autowired private ProactiveMemoryUseRepository proactiveMemoryUseRepository;
    @Autowired private UserPopulator userPopulator;

    private ProactiveMemoryUseEntity newUse(UUID user, LocalDate usedOn, String topicKey, String kind) {
        ProactiveMemoryUseEntity use = new ProactiveMemoryUseEntity();
        use.setCreatedBy(user);
        use.setUsedOn(usedOn);
        use.setTopicKey(topicKey);
        use.setKind(kind);
        return proactiveMemoryUseRepository.save(use);
    }

    @Test
    void testFindByCreatedByAndUsedOnGreaterThanEqual_shouldReturnRecentRow_whenWithinWindow() {
        UUID user = userPopulator.createUser("proactive-memory-use-recent@test.local").getId();
        ProactiveMemoryUseEntity saved = newUse(
                user, TODAY, "person:anna", ProactiveMemoryUseEntity.KIND_MORNING);

        List<ProactiveMemoryUseEntity> found = proactiveMemoryUseRepository
                .findByCreatedByAndUsedOnGreaterThanEqual(user, TODAY.minusDays(3));

        assertThat(found).extracting(ProactiveMemoryUseEntity::getId).containsExactly(saved.getId());
    }

    @Test
    void testFindByCreatedByAndUsedOnGreaterThanEqual_shouldExcludeOldRow_whenOutsideWindow() {
        UUID user = userPopulator.createUser("proactive-memory-use-old@test.local").getId();
        newUse(user, TODAY.minusDays(4), "person:anna", ProactiveMemoryUseEntity.KIND_MORNING);

        List<ProactiveMemoryUseEntity> found = proactiveMemoryUseRepository
                .findByCreatedByAndUsedOnGreaterThanEqual(user, TODAY.minusDays(3));

        assertThat(found).isEmpty();
    }
}
