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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

    /** The entity's {@code @Pattern} short-circuits every JPA write, so the DB CHECK itself is only
     *  reachable by going around bean validation with a native insert (the
     *  {@code FeedbackRollupPersistenceIT} precedent). */
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
}
