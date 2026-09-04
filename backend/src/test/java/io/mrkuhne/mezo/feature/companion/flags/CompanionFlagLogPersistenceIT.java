package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CompanionFlagLogPersistenceIT extends AbstractIntegrationTest {

    @Autowired private CompanionFlagLogRepository repository;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void persists_a_raise_with_its_typed_jsonb_payload() {
        UUID owner = ownerId();
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.sustainedStress(
            new FlagPayloadEnvelope.SustainedStress(7.0, 4, 3, 3, Map.of("2026-08-24", 8.0)));

        CompanionFlagLogEntity saved =
            flagLogPopulator.raise(owner, FlagKey.SUSTAINED_STRESS, FlagKey.SOURCE_WRITE, payload);

        CompanionFlagLogEntity reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getFlagKey()).isEqualTo(FlagKey.SUSTAINED_STRESS);
        assertThat(reloaded.getSource()).isEqualTo(FlagKey.SOURCE_WRITE);
        assertThat(reloaded.getPayload().sustainedStress().daysOverThreshold()).isEqualTo(3);
        assertThat(reloaded.getPayload().sustainedStress().stressByDay()).containsEntry("2026-08-24", 8.0);
        assertThat(reloaded.getCreatedAt()).isNotNull();
    }

    /** The entity's {@code @Pattern} fires first, in-JVM, on any normal JPA write (the
     *  {@code FeedbackRollupPersistenceIT} precedent). */
    @Test
    void rejects_an_unknown_flag_key_at_bean_validation() {
        assertThatThrownBy(() -> flagLogPopulator.raise(ownerId(), "vibes_off", FlagKey.SOURCE_SWEEP, null))
            .isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    void rejects_an_unknown_source_at_bean_validation() {
        assertThatThrownBy(() -> flagLogPopulator.raise(ownerId(), FlagKey.ALL_HEALTHY, "guess", null))
            .isInstanceOf(ConstraintViolationException.class);
    }

    /** The DB CHECK itself is only reachable by going around bean validation with a native insert
     *  — this is the case that proves the constraint really is in the schema and not just in the
     *  entity. */
    @Test
    void rejects_an_unknown_flag_key_at_the_db_check() {
        assertThatThrownBy(() -> flagLogPopulator.rawInsert(ownerId(), "vibes_off", FlagKey.SOURCE_SWEEP))
            .hasStackTraceContaining("ck_companion_flag_log_flag_key");
    }

    @Test
    void rejects_an_unknown_source_at_the_db_check() {
        assertThatThrownBy(() -> flagLogPopulator.rawInsert(ownerId(), FlagKey.ALL_HEALTHY, "guess"))
            .hasStackTraceContaining("ck_companion_flag_log_source");
    }

    /** Only {@code sustainedStress} was ever round-tripped above; this covers the other four
     *  shapes end to end, including {@code MomentumAtRisk}'s {@code List<String>} and
     *  {@code RecoveryNeeded}'s nullable boxed {@code Double}s (both left null here, as the
     *  envelope's type allows even though {@code FlagEvaluator} never raises that shape). */
    @Test
    void round_trips_every_payload_shape_through_jsonb() {
        UUID owner = ownerId();
        Map<String, FlagPayloadEnvelope> shapes = new LinkedHashMap<>();
        shapes.put(FlagKey.SUSTAINED_STRESS, FlagPayloadEnvelope.sustainedStress(
            new FlagPayloadEnvelope.SustainedStress(7.0, 4, 3, 3, Map.of("2026-08-24", 8.0))));
        shapes.put(FlagKey.SLEEP_DEBT, FlagPayloadEnvelope.sleepDebt(
            new FlagPayloadEnvelope.SleepDebt(8.0, 3, 2, 3.0, 5.0, Map.of("2026-08-24", 6.5))));
        shapes.put(FlagKey.MOMENTUM_AT_RISK, FlagPayloadEnvelope.momentumAtRisk(
            new FlagPayloadEnvelope.MomentumAtRisk(
                3, 14, 0.4, 1.2, 0.5, 1.0, List.of("2026-08-23", "2026-08-24"))));
        shapes.put(FlagKey.RECOVERY_NEEDED, FlagPayloadEnvelope.recoveryNeeded(
            new FlagPayloadEnvelope.RecoveryNeeded(
                2, 6.0, 7.0, 6.0, null, null, 8.0, "2026-08-23", 7.0, "2026-08-24")));
        shapes.put(FlagKey.ALL_HEALTHY, FlagPayloadEnvelope.allHealthy(
            new FlagPayloadEnvelope.AllHealthy(7, 5)));
        shapes.put(FlagKey.LOGGING_GAP, FlagPayloadEnvelope.loggingGap(
            new FlagPayloadEnvelope.LoggingGap(
                List.of("meal", "sleep"), 36, 40, 24, null, 2, 3, 3.0, 2.5, 1)));
        shapes.put(FlagKey.MISSED_WORKOUTS, FlagPayloadEnvelope.missedWorkouts(
            new FlagPayloadEnvelope.MissedWorkouts(
                14, 2, 3, List.of("2026-08-23", "2026-08-24", "2026-08-25"),
                List.of("2026-08-21", "2026-08-23", "2026-08-24", "2026-08-25"))));

        shapes.forEach((flagKey, payload) -> {
            CompanionFlagLogEntity saved = flagLogPopulator.raise(owner, flagKey, FlagKey.SOURCE_WRITE, payload);
            CompanionFlagLogEntity reloaded = repository.findById(saved.getId()).orElseThrow();
            assertThat(reloaded.getPayload()).isEqualTo(payload);
        });
    }

    @Test
    void exists_raise_since_sees_only_rows_inside_the_window() {
        UUID owner = ownerId();
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(30, ChronoUnit.HOURS));

        assertThat(repository.existsRaiseSince(owner, FlagKey.SLEEP_DEBT, Instant.now().minus(24, ChronoUnit.HOURS)))
            .isFalse();
        assertThat(repository.existsRaiseSince(owner, FlagKey.SLEEP_DEBT, Instant.now().minus(48, ChronoUnit.HOURS)))
            .isTrue();
    }

    /** S2 (mezo-d58h.2): {@code logging_gap} and {@code missed_workouts} widened the CHECK
     *  constraint before either rule exists to raise them — this proves the DB accepts both keys. */
    @Test
    void accepts_the_new_logging_gap_and_missed_workouts_keys() {
        UUID owner = ownerId();

        flagLogPopulator.rawInsert(owner, FlagKey.LOGGING_GAP, FlagKey.SOURCE_SWEEP);
        flagLogPopulator.rawInsert(owner, FlagKey.MISSED_WORKOUTS, FlagKey.SOURCE_WRITE);

        assertThat(repository.findAll())
            .extracting(CompanionFlagLogEntity::getFlagKey)
            .contains(FlagKey.LOGGING_GAP, FlagKey.MISSED_WORKOUTS);
    }

    /** S6 (mezo-d58h.6): the six batch-B keys widen the CHECK constraint before any of their
     *  rules exist to raise them — this proves the DB accepts all six, and still rejects nonsense. */
    @Test
    void accepts_the_six_s6_keys_and_still_rejects_nonsense() {
        UUID owner = ownerId();

        flagLogPopulator.rawInsert(owner, FlagKey.ACUTE_BAD_DAY, FlagKey.SOURCE_WRITE);
        flagLogPopulator.rawInsert(owner, FlagKey.LOAD_FUEL_MISMATCH, FlagKey.SOURCE_SWEEP);
        flagLogPopulator.rawInsert(owner, FlagKey.RAPID_WEIGHT_LOSS, FlagKey.SOURCE_SWEEP);
        flagLogPopulator.rawInsert(owner, FlagKey.JOINT_OVERUSE, FlagKey.SOURCE_SWEEP);
        flagLogPopulator.rawInsert(owner, FlagKey.IGNORED_NUDGE, FlagKey.SOURCE_SWEEP);
        flagLogPopulator.rawInsert(owner, FlagKey.LATE_EATING, FlagKey.SOURCE_WRITE);

        assertThat(repository.findAll())
            .extracting(CompanionFlagLogEntity::getFlagKey)
            .contains(FlagKey.ACUTE_BAD_DAY, FlagKey.LOAD_FUEL_MISMATCH, FlagKey.RAPID_WEIGHT_LOSS,
                FlagKey.JOINT_OVERUSE, FlagKey.IGNORED_NUDGE, FlagKey.LATE_EATING);

        assertThatThrownBy(() -> flagLogPopulator.rawInsert(owner, "vibes_off_s6", FlagKey.SOURCE_SWEEP))
            .hasStackTraceContaining("ck_companion_flag_log_flag_key");
    }

    /** S6: {@code ignored_nudge} joins {@code logging_gap} in the exclusion list — it names the
     *  app's own nudging failing to land, not a health/behavior problem, so it must not suppress
     *  {@code all_healthy} for a whole quiet window. {@code acute_bad_day} is a genuine problem
     *  and must still suppress it. */
    @Test
    void ignored_nudge_does_not_suppress_all_healthy_but_acute_bad_day_does() {
        UUID owner = ownerId();
        Instant since = Instant.now().minus(1, ChronoUnit.HOURS);

        flagLogPopulator.raise(owner, FlagKey.IGNORED_NUDGE, FlagKey.SOURCE_SWEEP, null);
        assertThat(repository.existsProblemRaiseSince(owner, since)).isFalse();

        flagLogPopulator.raise(owner, FlagKey.ACUTE_BAD_DAY, FlagKey.SOURCE_WRITE, null);
        assertThat(repository.existsProblemRaiseSince(owner, since)).isTrue();
    }
}
