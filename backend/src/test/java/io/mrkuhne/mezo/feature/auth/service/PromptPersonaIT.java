package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PromptPersonaIT extends AbstractIntegrationTest {

    @Autowired private PromptPersona promptPersona;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRender_shouldUseTheUsersName_whenUserExists() {
        AppUserEntity user = userPopulator.createUser("persona@test.local");
        user.setName("Anna");
        userPopulator.save(user);

        assertThat(promptPersona.render(user.getId(), "Elemezd {{NÉV}} hetét."))
                .isEqualTo("Elemezd Anna hetét.");
    }

    @Test
    void testRender_shouldFallBack_whenUserUnknown() {
        assertThat(promptPersona.render(UUID.randomUUID(), "Te vagy a mezo, {{NÉV}} társa."))
                .isEqualTo("Te vagy a mezo, a felhasználó társa.");
    }
}
