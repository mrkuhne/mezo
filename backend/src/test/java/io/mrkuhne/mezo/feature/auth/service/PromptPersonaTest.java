package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PromptPersonaTest {

    @Test
    void testFill_shouldSubstituteEveryToken_whenTemplateCarriesSeveral() {
        String out = PromptPersona.fill(PersonaContext.of("Anna"),
                "Te vagy a mezo, {{NÉV}} társa. Elemezd {{NÉV}} hetét.");
        assertThat(out).isEqualTo("Te vagy a mezo, Anna társa. Elemezd Anna hetét.");
    }

    @Test
    void testFill_shouldLeaveTemplateUntouched_whenNoToken() {
        assertThat(PromptPersona.fill(PersonaContext.of("Anna"), "nincs token")).isEqualTo("nincs token");
    }

    @Test
    void testOf_shouldTrimAndFallBack_whenNameBlank() {
        assertThat(PersonaContext.of("  Béla  ").userName()).isEqualTo("Béla");
        assertThat(PersonaContext.of("   ")).isEqualTo(PersonaContext.FALLBACK);
        assertThat(PersonaContext.of(null)).isEqualTo(PersonaContext.FALLBACK);
    }

    @Test
    void testUserTurnLabel_shouldBeNeutral() {
        assertThat(PromptPersona.USER_TURN_LABEL).isEqualTo("Felhasználó: ");
    }
}
