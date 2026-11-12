package io.mrkuhne.mezo.feature.intention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Boop B3 (mezo-r36n9.13): a retried focus write carrying the same clientRef never duplicates. */
class IntentionFocusClientRefIT extends AbstractIntegrationTest {

    @Autowired private IntentionService service;
    @Autowired private UserPopulator userPopulator;

    @Test
    void repeatedClientRefReturnsSameFocus() {
        UUID owner = userPopulator.createUser("focus-ref@test.hu").getId();
        LocalDate d = LocalDate.now();
        UUID ref = UUID.randomUUID();
        var first = service.addFocus(owner, d, "Séta ebéd után.", ref);
        var second = service.addFocus(owner, d, "Séta ebéd után.", ref);
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(service.getDay(owner, d).getFoci()).hasSize(1);
    }

    @Test
    void repeatedClientRefBypassesCapOnlyForTheSameRef() {
        UUID owner = userPopulator.createUser("focus-ref-cap@test.hu").getId();
        LocalDate d = LocalDate.now();
        UUID ref = UUID.randomUUID();
        var first = service.addFocus(owner, d, "Egy.", ref);
        service.addFocus(owner, d, "Kettő.");
        service.addFocus(owner, d, "Három.");
        assertThat(service.addFocus(owner, d, "Egy.", ref).getId()).isEqualTo(first.getId());
        assertThat(service.getDay(owner, d).getFoci()).hasSize(3);
    }

    @Test
    void clientRefBypassesNothingElse() {
        UUID owner = userPopulator.createUser("focus-ref-nocap@test.hu").getId();
        LocalDate d = LocalDate.now();
        service.addFocus(owner, d, "Egy.", UUID.randomUUID());
        service.addFocus(owner, d, "Kettő.");
        service.addFocus(owner, d, "Három.");
        assertThatThrownBy(() -> service.addFocus(owner, d, "Négy."))
            .isInstanceOf(SystemRuntimeErrorException.class); // INTENTION_FOCUS_CAP
        assertThatThrownBy(() -> service.addFocus(owner, d, "Négy új ref.", UUID.randomUUID()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
