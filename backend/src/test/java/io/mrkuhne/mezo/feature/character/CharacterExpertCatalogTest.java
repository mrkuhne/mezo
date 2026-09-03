package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.service.PersonaContext;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.service.CharacterCoreCatalog;
import io.mrkuhne.mezo.feature.character.service.CharacterExpertCatalog;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;

class CharacterExpertCatalogTest {

    @Test
    void experts_coverExactlyTheCoreCatalogExpertKeys_inOrder() {
        assertThat(CharacterExpertCatalog.EXPERTS)
                .extracting(CharacterExpertCatalog.Expert::key)
                .containsExactly("doki", "edzo", "taplalkozo", "szomnologus",
                        "pszichologus", "drill", "antropologus");
        // each expert's primary dimension is the CORE dimension that names it as expert
        CharacterCoreCatalog.CORE.forEach(core -> assertThat(
                CharacterExpertCatalog.byKey(core.expertKey()).primaryDimensionKey())
                .isEqualTo(core.key()));
    }

    @Test
    void byKey_unknown_throws_andPersonasAreNonBlankHungarian() {
        assertThatThrownBy(() -> CharacterExpertCatalog.byKey("nonsense"))
                .isInstanceOf(SystemRuntimeErrorException.class);
        CharacterExpertCatalog.EXPERTS.forEach(e -> {
            assertThat(e.systemPersona()).isNotBlank();
            assertThat(e.displayName()).isNotBlank();
        });
    }

    @Test
    void skeptic_isNotAnExpertCatalogEntry_butResolvesByKey_andOwnsTheMetaDimension() {
        assertThat(CharacterExpertCatalog.EXPERTS).extracting(CharacterExpertCatalog.Expert::key)
                .doesNotContain("szkeptikus");
        CharacterExpertCatalog.Expert skeptic = CharacterExpertCatalog.byKey("szkeptikus");
        assertThat(skeptic).isSameAs(CharacterExpertCatalog.SKEPTIC);
        assertThat(skeptic.primaryDimensionKey()).isEqualTo("self-audit");
        assertThat(skeptic.systemPersona()).contains("rendszerről");
        assertThat(CharacterCoreCatalog.META).singleElement().satisfies(m -> {
            assertThat(m.key()).isEqualTo("self-audit");
            assertThat(m.title()).isEqualTo("A társ önvizsgálata");
            assertThat(m.expertKey()).isEqualTo("szkeptikus");
        });
        assertThat(CharacterCoreCatalog.SEEDED).hasSize(8);
        assertThat(CharacterCoreCatalog.kindOf("self-audit")).isEqualTo("META");
        assertThat(CharacterCoreCatalog.kindOf("physical")).isEqualTo("CORE");
    }

    /**
     * Every expert persona (the 7 {@link CharacterExpertCatalog#EXPERTS} plus
     * {@link CharacterExpertCatalog#SKEPTIC}) must carry {@link PromptPersona#NAME_TOKEN} — the
     * ONLY substitution point for the user's name (S6, mezo-qw37.6) — and {@link PromptPersona#fill}
     * must actually resolve it to the seeded name with no token left behind. A persona text still
     * hard-wiring "Daniel" fails the first assertion (no token to find); a broken
     * {@code fill}/render pipeline fails the second (the real name never lands, or the token
     * survives).
     */
    @Test
    void everyExpertPersona_carriesTheNameToken_andRendersTheRealName() {
        String realName = "Teszt Elemér";
        PersonaContext persona = PersonaContext.of(realName);

        java.util.stream.Stream.concat(
                CharacterExpertCatalog.EXPERTS.stream(), java.util.stream.Stream.of(CharacterExpertCatalog.SKEPTIC))
                .forEach(expert -> {
                    assertThat(expert.systemPersona()).as("persona of %s", expert.key())
                            .contains(PromptPersona.NAME_TOKEN);
                    String rendered = PromptPersona.fill(persona, expert.systemPersona());
                    assertThat(rendered).as("rendered persona of %s", expert.key())
                            .contains(realName)
                            .doesNotContain(PromptPersona.NAME_TOKEN)
                            .doesNotContain("Daniel");
                });
    }
}
