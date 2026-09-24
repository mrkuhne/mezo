package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
}
