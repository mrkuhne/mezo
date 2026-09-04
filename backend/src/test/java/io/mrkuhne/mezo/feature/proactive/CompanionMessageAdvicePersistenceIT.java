package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
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

    @Test
    void testKindCheck_shouldAcceptAdvice() {
        UUID owner = userPopulator.createUser().getId();

        companionMessagePopulator.rawInsertKind(owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE);

        assertThat(CompanionMessageEntity.KIND_ADVICE).isEqualTo("advice");
    }

    @Test
    void testKindCheck_shouldStillRejectAnUnknownKind() {
        UUID owner = userPopulator.createUser().getId();

        assertThatThrownBy(() ->
            companionMessagePopulator.rawInsertKind(owner, LocalDate.now(), "nonsense"))
            .isInstanceOf(Exception.class);
    }
}
