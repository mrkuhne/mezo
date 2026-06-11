package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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

    @Test
    void testSave_shouldRoundTripUserOverrideWithTimestamp_whenOverridePresent() {
        UUID user = databasePopulator.populateUser("override@test.local");
        // Non-UTC offset on purpose: the temporal field is where jsonb round-trips surprise you.
        // OBSERVED CONTRACT (Hibernate 7.1.8 + jackson-databind 2.20.1 + jackson-datatype-jsr310,
        // the FormatMapper's auto-discovered ObjectMapper, no Spring customizations):
        //   1. OffsetDateTime is stored as a NUMERIC epoch-seconds timestamp in the jsonb
        //      (e.g. 1778785200.000000000), NOT an ISO-8601 string — WRITE_DATES_AS_TIMESTAMPS is
        //      left ON in Hibernate's bare mapper.
        //   2. The original +02:00 offset is therefore LOST; the value reloads as UTC
        //      (2026-05-14T21:00+02:00 -> 2026-05-14T19:00Z). Same instant, different offset, so
        //      whole-record equality FAILS.
        // => Fuel's timestamped meal-score envelopes must compare temporals by INSTANT (isEqual),
        //    never by ProvenanceEnvelope.equals(), and must not rely on the stored offset.
        OffsetDateTime overrideAt = OffsetDateTime.parse("2026-05-14T21:00:00+02:00");
        ProvenanceEnvelope source = new ProvenanceEnvelope(
            new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", 8, 12, 18),
            List.of(new ProvenanceEnvelope.Adjustment("recovery", "Deload hét", Map.of("mav", -4), null)),
            0.81,
            "Manuális MRV override.",
            new ProvenanceEnvelope.UserOverride(10, 16, 22, overrideAt));

        MuscleGroupVolumeLogEntity e = new MuscleGroupVolumeLogEntity();
        e.setCreatedBy(user);
        UUID mesoId = jdbcTemplate.queryForObject(
            "insert into mesocycle (created_by, title, short_title, status, start_date, end_date, weeks, split, style, phase_curve) "
                + "values (?, 't', 't', 'active', '2026-05-01', '2026-06-12', 6, 's', 's', '{MEV}') returning id",
            UUID.class, user);
        e.setMesocycleId(mesoId);
        e.setMuscle("back");
        e.setMev(10); e.setMav(16); e.setMrv(22); e.setCurrentSets(16);
        e.setSource(source);
        repository.saveAndFlush(e);

        entityManager.clear();

        MuscleGroupVolumeLogEntity reloaded = repository.findById(e.getId()).orElseThrow();
        ProvenanceEnvelope.UserOverride reloadedOverride = reloaded.getSource().userOverride();

        // Non-temporal fields survive exactly.
        assertThat(reloadedOverride.mev()).isEqualTo(10);
        assertThat(reloadedOverride.mav()).isEqualTo(16);
        assertThat(reloadedOverride.mrv()).isEqualTo(22);
        // Same instant survives the round-trip...
        assertThat(reloadedOverride.at()).isEqualTo(overrideAt.toInstant().atOffset(ZoneOffset.UTC));
        assertThat(reloadedOverride.at().isEqual(overrideAt)).isTrue();
        // ...but the offset is normalized to UTC, so whole-record equality FAILS (pins the contract).
        assertThat(reloadedOverride.at().getOffset()).isEqualTo(ZoneOffset.UTC);
        assertThat(reloaded.getSource()).isNotEqualTo(source);
        // The rest of the envelope (no temporal fields) round-trips by record equality.
        assertThat(reloaded.getSource().baseline()).isEqualTo(source.baseline());
        assertThat(reloaded.getSource().adjustments()).isEqualTo(source.adjustments());
        assertThat(reloaded.getSource().confidence()).isEqualTo(source.confidence());
        assertThat(reloaded.getSource().note()).isEqualTo(source.note());

        String jsonType = jdbcTemplate.queryForObject(
            "select jsonb_typeof(source) from muscle_group_volume_log where id = ?", String.class, e.getId());
        assertThat(jsonType).isEqualTo("object");
    }
}
