package io.mrkuhne.mezo.feature.companion.advisor;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit test — pins the corrective-retry block's rules text so it cannot silently
 * regress back into licensing hedged/marked guessing under correction (mezo-rj214.7).
 */
class AdvisorRetryTest {

    @Test
    void testBlock_shouldStateTheActionClaimRule() {
        String block = AdvisorRetry.block(List.of(new AdvisorViolation("action_claim", "x")));

        assertThat(block).contains("ne állítsd, hogy elvégeztél olyan műveletet, amit nem tudsz");
    }

    @Test
    void testBlock_shouldStateTheUnmarkedFactRule() {
        String block = AdvisorRetry.block(List.of(new AdvisorViolation("clinical", "x")));

        assertThat(block)
                .contains("konkrét adatot csak a kontextusból, az eszközhívásokból vagy a felhasználó üzenetéből állíts");
    }

    @Test
    void testBlock_shouldStateTheRxDoseRule() {
        String block = AdvisorRetry.block(List.of(new AdvisorViolation("clinical", "x")));

        assertThat(block).contains("Rx gyógyszer adagolásának módosítását soha ne javasold");
    }

    @Test
    void testBlock_shouldNotLicenseMarkedGuessing() {
        String block = AdvisorRetry.block(List.of(new AdvisorViolation("clinical", "x")));

        assertThat(block).doesNotContain("jelölt sejtés viszont igen");
    }

    @Test
    void testBlock_shouldDropTheRedundantQuestionRule() {
        String block = AdvisorRetry.block(List.of(new AdvisorViolation("clinical", "x")));

        assertThat(block).doesNotContain("ne kérdezz rá már megerősített tényre");
    }

    @Test
    void testBlock_shouldKeepTheTonePreservationCloserVerbatim() {
        String block = AdvisorRetry.block(List.of(new AdvisorViolation("clinical", "x")));

        assertThat(block).contains(
                "A hangnem NE változzon — ugyanaz az élő, beszélgetős stílus; a javítás kizárólag a "
                        + "fent megjelölt problémára vonatkozzon.");
    }
}
