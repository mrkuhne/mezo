package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S3 (bd mezo-d58h.3, spec 2026-09-03 §4 setup table): the {@code setup} companion_message kind
 *  + its envelope {@code setupKey} — the {@code CompanionMessageInterventionPersistenceIT} precedent. */
class CompanionMessageSetupPersistenceIT extends AbstractIntegrationTest {

    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void setupRowRoundTripsWithKey() {
        UUID owner = ownerId();
        CompanionMessageEntity row = companionMessagePopulator.createSetup(
            owner, LocalDate.parse("2026-08-24"), "missing_sleep_goal", "Mezo",
            List.of("Nincs alvási céled."), Instant.now());

        CompanionMessageEntity reloaded = companionMessageRepository.findById(row.getId()).orElseThrow();
        assertThat(reloaded.getKind()).isEqualTo(CompanionMessageEntity.KIND_SETUP);
        assertThat(reloaded.getContent().setupKey()).isEqualTo("missing_sleep_goal");

        // old-shape rows stay readable: a kind written through the 3-arg envelope ctor has a null key.
        CompanionMessageEntity morning = companionMessagePopulator.createMessage(
            owner, LocalDate.parse("2026-08-24"), CompanionMessageEntity.KIND_MORNING, "Mezo", List.of("Szia"));
        assertThat(companionMessageRepository.findById(morning.getId()).orElseThrow()
            .getContent().setupKey()).isNull();
    }

    /** S3 (mezo-d58h.3) widened the CHECK constraint before any check exists to raise it — this
     *  proves the DB itself accepts {@code setup}, independent of Bean Validation and the entity's
     *  own guards (the {@code CompanionFlagLogPersistenceIT.accepts_the_new_logging_gap_and_missed_workouts_keys}
     *  precedent for a widened CHECK). */
    @Test
    void theDatabaseAcceptsTheSetupKind() {
        UUID owner = ownerId();

        companionMessagePopulator.rawInsertKind(owner, LocalDate.parse("2026-08-24"), CompanionMessageEntity.KIND_SETUP);

        assertThat(companionMessageRepository.findAll())
            .extracting(CompanionMessageEntity::getKind)
            .contains(CompanionMessageEntity.KIND_SETUP);
    }
}
