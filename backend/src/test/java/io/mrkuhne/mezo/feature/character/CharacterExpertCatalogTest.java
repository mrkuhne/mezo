package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.character.service.CharacterCoreCatalog;
import io.mrkuhne.mezo.feature.character.service.CharacterExpertCatalog;
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
                .isInstanceOf(IllegalArgumentException.class);
        CharacterExpertCatalog.EXPERTS.forEach(e -> {
            assertThat(e.systemPersona()).isNotBlank();
            assertThat(e.displayName()).isNotBlank();
        });
    }
}
