package io.mrkuhne.mezo.feature.character.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Plain, Spring-free pin on {@link PortraitWriter}'s user-message rendering (mezo-1gim.5,
 * final-review finding I1): the system contract tells the model to phrase sensitive claims as a
 * mirror/question, but that instruction is only actionable if the rendered claim line actually
 * says WHICH claims are sensitive — mirrors {@link KonziliumVerdictRound}'s ", ÉRZÉKENY" marker.
 */
class PortraitWriterTest {

    private static CharacterDimensionEntity dimension() {
        CharacterDimensionEntity dimension = new CharacterDimensionEntity();
        dimension.setKey("discipline");
        dimension.setTitle("Fegyelem");
        dimension.setKind("CORE");
        dimension.setExpertKey("drill");
        return dimension;
    }

    private static CharacterClaimEntity claim(String text, String confidence, boolean sensitive) {
        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setText(text);
        claim.setConfidence(new BigDecimal(confidence));
        claim.setSensitive(sensitive);
        return claim;
    }

    @Test
    void userMessage_sensitiveClaim_carriesErzekenyMarker() {
        CharacterClaimEntity sensitive = claim("Ismétlődő kudarcmintázat étkezésnél.", "0.80", true);

        String rendered = PortraitWriter.userMessage(dimension(), List.of(sensitive));

        assertThat(rendered).contains("biztos: Ismétlődő kudarcmintázat étkezésnél., ÉRZÉKENY");
    }

    @Test
    void userMessage_nonSensitiveClaim_carriesNoMarker() {
        CharacterClaimEntity notSensitive = claim("3 napja nincs kaja-log.", "0.80", false);

        String rendered = PortraitWriter.userMessage(dimension(), List.of(notSensitive));

        assertThat(rendered).contains("biztos: 3 napja nincs kaja-log.").doesNotContain("ÉRZÉKENY");
    }

    @Test
    void userMessage_mixedClaims_marksOnlyTheSensitiveLine() {
        CharacterClaimEntity notSensitive = claim("3 napja nincs kaja-log.", "0.80", false);
        CharacterClaimEntity sensitive = claim("Ismétlődő kudarcmintázat étkezésnél.", "0.60", true);

        String rendered = PortraitWriter.userMessage(dimension(), List.of(notSensitive, sensitive));

        assertThat(rendered)
                .contains("biztos: 3 napja nincs kaja-log.\n")
                .contains("valószínű: Ismétlődő kudarcmintázat étkezésnél., ÉRZÉKENY");
    }
}
