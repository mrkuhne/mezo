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

    // Fix round (mezo-rj214.7, mezo-q0p5a): the four terms with no separable verb prefix negate
    // with a plain "nem" in front, which left the substring intact and fired on the exact
    // sentence shape this check exists to reward — an honest refusal.

    @Test
    void testCheck_shouldPass_whenAnswerIsAPlainNegatedNaploztam() {
        assertThat(check.check("Nem naplóztam ezt, ezt neked kell megtenned a Napló fülön.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsAPlainNegatedRogzitettem() {
        assertThat(check.check("Nem rögzítettem semmit.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsAPlainNegatedModosítottam() {
        assertThat(check.check("Nem módosítottam semmit.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsAPlainNegatedToroltem() {
        assertThat(check.check("Nem töröltem semmit.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenAnswerIsAPlainNegatedNaploztam_andFolded() {
        assertThat(check.check("nem naploztam")).isEmpty();
    }

    @Test
    void testCheck_shouldViolate_whenAnswerClaimsNaploztamAffirmatively() {
        assertThat(check.check("Naplóztam ezt neked.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenAnswerClaimsRogzitettemAffirmatively() {
        assertThat(check.check("Rögzítettem a mai edzést.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenAnswerClaimsModositottamAffirmatively() {
        assertThat(check.check("Módosítottam a tervedet.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenAnswerClaimsToroltemAffirmatively() {
        assertThat(check.check("Töröltem a bejegyzést.")).isPresent();
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
