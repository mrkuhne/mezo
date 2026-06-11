package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * THE designated risk item of Slice B: proves a typed Java record round-trips through a real
 * jsonb column via Hibernate's {@code @JdbcTypeCode(SqlTypes.JSON)} on Spring Boot 4 /
 * Hibernate 7 (Jackson 3). Fuel reuses this pattern for meal score, so it must be proven first.
 */
@Transactional
class ProvenanceRoundTripIT extends AbstractIntegrationTest {

    @Autowired private MuscleGroupVolumeLogRepository repository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testSave_shouldRoundTripProvenanceEnvelope_whenPersistedAsJsonb() {
        UUID user = databasePopulator.populateUser("a@test.local");
        ProvenanceEnvelope source = new ProvenanceEnvelope(
            new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", 8, 12, 18),
            List.of(
                new ProvenanceEnvelope.Adjustment("pattern", "Q1 retro: pumpa stabil", Map.of("mrv", 2), null),
                new ProvenanceEnvelope.Adjustment("niggle", "Jobb váll niggle", Map.of("mav", -2, "mrv", -2), true)),
            0.78,
            "Daniel-personalizált MRV.",
            null);

        MuscleGroupVolumeLogEntity e = new MuscleGroupVolumeLogEntity();
        e.setCreatedBy(user);
        // mesocycle FK is NOT NULL; MesocycleEntity doesn't exist yet (Task 4) -> insert the parent row directly:
        UUID mesoId = jdbcTemplate.queryForObject(
            "insert into mesocycle (created_by, title, short_title, status, start_date, end_date, weeks, split, style, phase_curve) "
                + "values (?, 't', 't', 'active', '2026-05-01', '2026-06-12', 6, 's', 's', '{MEV}') returning id",
            UUID.class, user);
        e.setMesocycleId(mesoId);
        e.setMuscle("chest");
        e.setMev(8); e.setMav(14); e.setMrv(20); e.setCurrentSets(14);
        e.setSource(source);
        repository.saveAndFlush(e);

        // Force a REAL round-trip: drop the persistence context so findById must hydrate from
        // the DB row rather than return the still-managed L1-cache instance.
        entityManager.clear();

        MuscleGroupVolumeLogEntity reloaded = repository.findById(e.getId()).orElseThrow();
        assertThat(reloaded.getSource()).isEqualTo(source); // records -> deep equality

        String jsonType = jdbcTemplate.queryForObject(
            "select jsonb_typeof(source) from muscle_group_volume_log where id = ?", String.class, e.getId());
        assertThat(jsonType).isEqualTo("object"); // stored as real jsonb, not text
    }
}
