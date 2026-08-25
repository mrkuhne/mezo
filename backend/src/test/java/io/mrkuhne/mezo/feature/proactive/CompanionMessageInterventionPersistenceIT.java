package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

/** W5.2 (bd mezo-b3pp.19): the {@code intervention} companion_message kind + its envelope
 *  {@code interventionKey} — the {@code CompanionFlagLogPersistenceIT} precedent. */
class CompanionMessageInterventionPersistenceIT extends AbstractIntegrationTest {

    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void interventionRowRoundTripsWithKey() {
        UUID owner = ownerId();
        CompanionMessageEntity row = companionMessagePopulator.createIntervention(
            owner, LocalDate.parse("2026-08-24"), "stress_reset", "Tarts szünetet.", Instant.now());

        CompanionMessageEntity reloaded = companionMessageRepository.findById(row.getId()).orElseThrow();
        assertThat(reloaded.getKind()).isEqualTo(CompanionMessageEntity.KIND_INTERVENTION);
        assertThat(reloaded.getContent().interventionKey()).isEqualTo("stress_reset");

        // old-shape rows stay readable: a kind written through the 3-arg envelope ctor has a null key.
        CompanionMessageEntity morning = companionMessagePopulator.createMessage(
            owner, LocalDate.parse("2026-08-24"), CompanionMessageEntity.KIND_MORNING, "Mezo", List.of("Szia"));
        assertThat(companionMessageRepository.findById(morning.getId()).orElseThrow()
            .getContent().interventionKey()).isNull();
    }

    /** The DB CHECK itself is only reachable by going around the entity with a native insert —
     *  this is the case that proves the constraint really is in the schema, not just in Java. */
    @Test
    void unknownKindStillTripsTheCheck() {
        assertThatThrownBy(() -> companionMessagePopulator.rawInsertKind(
                ownerId(), LocalDate.parse("2026-08-24"), "nonsense"))
            .hasStackTraceContaining("ck_companion_message_kind");
    }
}
