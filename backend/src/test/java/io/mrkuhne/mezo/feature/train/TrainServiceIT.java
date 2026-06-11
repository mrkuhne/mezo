package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service/repository-level tests for the Train aggregate. Starts here by pinning the two
 * non-trivial column mappings on {@code mesocycle}: the {@code text[]} phase curve and the
 * typed-jsonb {@code volume_recompute} audit (grows with the service in Tasks 5–7).
 */
@Transactional
class TrainServiceIT extends AbstractIntegrationTest {

    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testSaveMesocycle_shouldRoundTripArrayAndRecomputeJson_whenPersisted() {
        UUID user = databasePopulator.populateUser("train@test.local");
        MesocycleEntity saved = trainPopulator.createMesocycle(user, "Hypertrophy 04", "active");

        // Force a REAL round-trip: drop the persistence context so findById must hydrate from the
        // DB row rather than return the still-managed L1-cache instance.
        entityManager.clear();

        MesocycleEntity reloaded = mesocycleRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getPhaseCurve()).containsExactly("MEV", "MAV", "Deload");
        assertThat(reloaded.getVolumeRecompute()).isNotNull();
        assertThat(reloaded.getVolumeRecompute().changes()).hasSize(1);
        assertThat(reloaded.getVolumeRecompute().changes().get(0).muscle()).isEqualTo("back");
    }
}
