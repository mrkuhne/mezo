package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.Test;

class TeamCharacterTest {

    @ParameterizedTest
    @CsvSource({"szomnologus,SZUNYA","edzo,MOCOR","drill,MOCOR","taplalkozo,FALAT","pszichologus,DERU",
            "doki,DERU","antropologus,MEZO","mezo,MEZO","szkeptikus,SZKEPTIKUS","ismeretlen,MEZO"})
    void persona(String key, TeamCharacter expected) { assertThat(TeamCharacter.forPersona(key)).isEqualTo(expected); }

    @ParameterizedTest
    @CsvSource({"sleep,SZUNYA","train,MOCOR","fuel,FALAT","mind,DERU","body,DERU","other,MEZO","xyz,MEZO"})
    void domain(String d, TeamCharacter expected) { assertThat(TeamCharacter.forMetricDomain(d)).isEqualTo(expected); }

    @Test void skepticNeverPosts() {
        assertThat(TeamCharacter.SZKEPTIKUS.postable()).isFalse();
        assertThat(TeamCharacter.postableOr(TeamCharacter.SZKEPTIKUS)).isEqualTo(TeamCharacter.MEZO);
        assertThat(TeamCharacter.SZUNYA.key()).isEqualTo("szunya");
    }

    /** H3 (mezo-a9bo7.14): a hang-adatok — a nevek a FE `logic/team.ts` TEAM-táblájának tükrei,
     *  az emoji-készlet a hangkönyvé (`docs/features/insights.md` §2.0a). */
    @Test void voiceData() {
        assertThat(TeamCharacter.SZUNYA.displayName()).isEqualTo("Szunya");
        assertThat(TeamCharacter.DERU.displayName()).isEqualTo("Derű");
        assertThat(TeamCharacter.FALAT.area()).isEqualTo("étkezés");
        assertThat(TeamCharacter.MEZO.area()).isEqualTo("a csapat");
        assertThat(TeamCharacter.SZUNYA.emoji()).containsExactlyInAnyOrder("🌙");
        assertThat(TeamCharacter.MOCOR.emoji()).containsExactlyInAnyOrder("⚡", "💪");
        assertThat(TeamCharacter.FALAT.emoji()).containsExactlyInAnyOrder("🍽", "🥦", "🍳");
        assertThat(TeamCharacter.SZKEPTIKUS.emoji()).isEmpty();
        assertThat(TeamCharacter.SZKEPTIKUS.area()).isEmpty();
    }

    /** Minden karakternek van hangja — ez a generátor-prompt bemenete, üresen néma lenne. */
    @ParameterizedTest
    @EnumSource(TeamCharacter.class)
    void everyCharacterHasAVoice(TeamCharacter character) {
        assertThat(character.voice()).isNotBlank();
        assertThat(character.displayName()).isNotBlank();
    }
}
