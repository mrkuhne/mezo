package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
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

/**
 * S4 (bd mezo-d58h.4, spec 2026-09-03 §5): the {@code advice} kind is accepted by
 * {@code ck_companion_message_kind}, and an unknown kind is still rejected — the CHECK is pinned
 * from the DB side (native insert), not merely from the entity's annotations.
 */
class CompanionMessageAdvicePersistenceIT extends AbstractIntegrationTest {

    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;

    @Test
    void testKindCheck_shouldAcceptAdvice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate date = LocalDate.now();

        companionMessagePopulator.rawInsertKind(owner, date, CompanionMessageEntity.KIND_ADVICE);

        assertThat(companionMessageRepository
            .findByCreatedByAndMessageDateAndKind(owner, date, CompanionMessageEntity.KIND_ADVICE))
            .isPresent();
    }

    @Test
    void testKindCheck_shouldStillRejectAnUnknownKind() {
        UUID owner = userPopulator.createUser().getId();

        assertThatThrownBy(() ->
            companionMessagePopulator.rawInsertKind(owner, LocalDate.now(), "nonsense"))
            .hasStackTraceContaining("ck_companion_message_kind");
    }

    @Test
    void testEnvelope_shouldRoundTripTheAdvicePayload() {
        UUID owner = userPopulator.createUser().getId();

        CompanionMessageEntity saved = companionMessagePopulator.createAdvice(
            owner, LocalDate.now(), "sleep_debt", "sleep_recover_tonight",
            "Mezo · észrevétel", "Ma este feküdj le korábban.",
            List.of("Alvásadósság: 1,4 óra/éjszaka"), List.of("Told előre a villanyoltást."),
            Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(saved.getId()).orElseThrow().getContent();
        assertThat(content.adviceKey()).isEqualTo("sleep_debt");
        assertThat(content.interventionKey()).isEqualTo("sleep_recover_tonight");
        assertThat(content.setupKey()).isNull();
        assertThat(content.facts()).containsExactly("Alvásadósság: 1,4 óra/éjszaka");
        assertThat(content.suggestions()).containsExactly("Told előre a villanyoltást.");
    }

    /** Old rows have no advice components at all — jsonb deserializes the new trailing fields to
     *  null (no @JsonIgnoreProperties, no FAIL_ON_UNKNOWN_PROPERTIES override anywhere on this
     *  envelope). Adding a TRAILING component is safe; REMOVING one would not be. */
    @Test
    void testEnvelope_shouldDeserializeAPreS4RowWithNullAdviceFields() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity legacy = companionMessagePopulator.createIntervention(
            owner, LocalDate.now(), "stress_reset", "Régi kártya", Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(legacy.getId()).orElseThrow().getContent();
        assertThat(content.adviceKey()).isNull();
        assertThat(content.facts()).isNull();
        assertThat(content.suggestions()).isNull();
    }
}
