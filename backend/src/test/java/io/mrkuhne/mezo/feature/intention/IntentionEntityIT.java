package io.mrkuhne.mezo.feature.intention;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** intention_focus DDL + owner-scoped finder + soft-delete round-trip (mezo-a686). */
class IntentionEntityIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private IntentionFocusRepository focusRepository;

    @Test
    void testSaveFocus_shouldRoundTripOwnerScoped_whenPersisted() {
        UUID owner = userPopulator.createUser("intent-a@test.hu").getId();
        IntentionFocusEntity e = new IntentionFocusEntity();
        e.setCreatedBy(owner);
        e.setFocusDate(LocalDate.now());
        e.setText("Jelen lenni minden beszélgetésben.");
        focusRepository.saveAndFlush(e);

        var found = focusRepository
            .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(owner, LocalDate.now());
        assertThat(found).hasSize(1);
        assertThat(found.getFirst().getText()).startsWith("Jelen lenni");
    }
}
