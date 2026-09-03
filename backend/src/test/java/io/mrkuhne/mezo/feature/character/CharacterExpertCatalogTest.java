package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
}
