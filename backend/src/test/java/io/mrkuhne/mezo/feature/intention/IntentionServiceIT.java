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

class IntentionServiceIT extends AbstractIntegrationTest {

    @Autowired private IntentionService service;
    @Autowired private UserPopulator userPopulator;

    private UUID owner() { return userPopulator.createUser("intent-svc@test.hu").getId(); }

    @Test
    void testSetCreed_shouldUpsertSingleRow_whenCalledTwice() {
        UUID owner = owner();
        service.setCreed(owner, "Első vezérelv.");
        var second = service.setCreed(owner, "Szándékkal élek.");
        assertThat(second.getText()).isEqualTo("Szándékkal élek.");
        assertThat(service.getDay(owner, LocalDate.now()).getCreed()).isEqualTo("Szándékkal élek.");
    }

    @Test
    void testAddFocus_shouldCapAtThree_whenFourthAdded() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        service.addFocus(owner, d, "Egy.");
        service.addFocus(owner, d, "Kettő.");
        service.addFocus(owner, d, "Három.");
        assertThat(service.getDay(owner, d).getFoci()).hasSize(3);
        assertThatThrownBy(() -> service.addFocus(owner, d, "Négy."))
            .isInstanceOf(SystemRuntimeErrorException.class); // INTENTION_FOCUS_CAP
        assertThatThrownBy(() -> service.addFocus(owner, d, "  "))
            .isInstanceOf(SystemRuntimeErrorException.class); // INTENTION_TEXT_REQUIRED
    }

    @Test
    void testRemoveFocus_shouldFreeCapacity_whenDeleted() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        var f = service.addFocus(owner, d, "Egy.");
        service.removeFocus(owner, f.getId());
        assertThat(service.getDay(owner, d).getFoci()).isEmpty();
    }

    @Test
    void testReflect_shouldUpsertReflection_whenSet() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        service.reflect(owner, d, "yes");
        assertThat(service.getDay(owner, d).getReflection().getValue()).isEqualTo("yes");
        service.reflect(owner, d, "partial");
        assertThat(service.getDay(owner, d).getReflection().getValue()).isEqualTo("partial");
        assertThatThrownBy(() -> service.reflect(owner, d, "maybe"))
            .isInstanceOf(SystemRuntimeErrorException.class); // INTENTION_REFLECTION_INVALID
    }

    @Test
    void testGetDay_shouldExposeFocusCap_always() {
        assertThat(service.getDay(owner(), LocalDate.now()).getFocusCap()).isEqualTo(3);
    }
}
