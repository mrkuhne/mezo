package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.ObservationText;
import org.junit.jupiter.api.Test;

class ObservationTextTest {

    @Test
    void stripClaimIdPrefix_removesALeadingUuidPrefix() {
        String text = "[ac2179ef-e74f-4532-8d5e-587fdc6e2a14] A felhasználó megerősítette: \"Alszol eleget.\"";

        assertThat(ObservationText.stripClaimIdPrefix(text))
                .isEqualTo("A felhasználó megerősítette: \"Alszol eleget.\"");
    }

    @Test
    void stripClaimIdPrefix_leavesOrdinaryTextAlone() {
        String text = "[fontos] A hétvégi fehérjebevitel elmarad.";

        assertThat(ObservationText.stripClaimIdPrefix(text)).isEqualTo(text);
    }

    @Test
    void stripClaimIdPrefix_nullSafe() {
        assertThat(ObservationText.stripClaimIdPrefix(null)).isNull();
    }
}
