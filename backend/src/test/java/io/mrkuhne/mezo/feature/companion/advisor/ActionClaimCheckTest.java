package io.mrkuhne.mezo.feature.companion.advisor;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure-logic unit test — the check is deterministic, no Spring context needed (mirrors ClinicalOutputCheckTest). */
class ActionClaimCheckTest {

    private final ActionClaimCheck check = new ActionClaimCheck(List.of(
            "felírtam", "elmentettem", "naplóztam", "rögzítettem",
            "hozzáadtam", "beírtam", "módosítottam", "töröltem", "beállítottam"));

    @Test
    void testCheck_shouldViolate_whenAnswerClaimsFelirtam_theProductionBug() {
        assertThat(check.check("Felírtam: taco, fehérjeszelet, banán.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenAnswerClaimsElmentettem() {
        assertThat(check.check("Elmentettem a súlyodat.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenAnswerClaimsNaploztam() {
        assertThat(check.check("Naplóztam a reggelit.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenAnswerClaimsRogzitettem() {
        assertThat(check.check("Rögzítettem.")).isPresent();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsAnInstructionToTheUser() {
        assertThat(check.check("Ezt te tudod felírni a Napló fülön.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsAnOffer() {
        assertThat(check.check("Ha szeretnéd, felírhatod.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsANegationInSecondPerson() {
        assertThat(check.check("Nem tudom naplózni helyetted.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsANegatedFirstPersonClaim() {
        assertThat(check.check("Nem írtam fel semmit.")).isEmpty();
    }

    @Test
    void testCheck_shouldViolate_whenAccentsAreStripped() {
        assertThat(check.check("felirtam a taco-t.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenAnswerIsUpperCase() {
        assertThat(check.check("FELÍRTAM a taco-t.")).isPresent();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsBlank() {
        assertThat(check.check("")).isEmpty();
        assertThat(check.check("   ")).isEmpty();
    }
}
