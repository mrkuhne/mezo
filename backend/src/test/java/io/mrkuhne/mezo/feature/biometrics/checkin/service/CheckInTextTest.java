package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CravingKind;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Pure unit test of the shared Check-in 2.0 renderer (mezo-ck2, spec §3.1). */
class CheckInTextTest {

    private static CheckInEntity full() {
        CheckInEntity c = new CheckInEntity();
        c.setEnergy(7);
        c.setMood(8);
        c.setStress(3);
        c.setBody(6);
        c.setMental(7);
        c.setRested(6);
        c.setSoreness(5);
        c.setPain(true);
        c.setPainRegions(List.of(PainRegion.TERD, PainRegion.DEREK));
        c.setPainIntensity(5);
        c.setMotivation(8);
        c.setHunger(5);
        c.setCraving(7);
        c.setCravingKinds(List.of(CravingKind.EDES));
        c.setDigestion(4);
        c.setConnection(8);
        c.setDayRating(7);
        return c;
    }

    @Test
    void testRender_shouldRenderEveryAnsweredItemInFixedOrder_whenAllAnswered() {
        assertThat(CheckInText.render(full())).isEqualTo(
            "energia 7/10, hangulat 8/10, stressz 3/10, testi érzés 6/10, fejtisztaság 7/10, "
                + "kipihentség 6/10, izomláz 5/10, fáj: térd, derék 5/10, motiváció 8/10, éhség 5/10, "
                + "sóvárgás 7/10 (édes), emésztés 4/10, kapcsolódás 8/10, a nap: 7/10");
    }

    @Test
    void testRender_shouldOmitNullItems_whenNotAnswered() {
        CheckInEntity c = new CheckInEntity();
        c.setEnergy(4);
        c.setHunger(8);

        assertThat(CheckInText.render(c)).isEqualTo("energia 4/10, éhség 8/10");
    }

    @Test
    void testRender_shouldReturnEmpty_whenNothingAnswered() {
        CheckInEntity c = new CheckInEntity();
        c.setAskedItems(List.of("energy", "mood"));

        assertThat(CheckInText.render(c)).isEmpty();
    }

    @Test
    void testRender_shouldSayNemFaj_whenPainAnsweredNo() {
        CheckInEntity c = new CheckInEntity();
        c.setPain(false);

        assertThat(CheckInText.render(c)).isEqualTo("nem fáj semmi");
    }

    @Test
    void testRender_shouldRenderPainWithoutIntensity_whenIntensitySkipped() {
        CheckInEntity c = new CheckInEntity();
        c.setPain(true);
        c.setPainRegions(List.of(PainRegion.CSUKLO_KEZ));

        assertThat(CheckInText.render(c)).isEqualTo("fáj: csukló, kéz");
    }

    @Test
    void testRender_shouldRenderCravingWithoutKinds_whenKindsNotAnswered() {
        CheckInEntity c = new CheckInEntity();
        c.setCraving(3);

        assertThat(CheckInText.render(c)).isEqualTo("sóvárgás 3/10");
    }

    @Test
    void testRender_shouldMarkQuickExit_whenSavedViaMostCsakEnnyi() {
        CheckInEntity c = new CheckInEntity();
        c.setEnergy(6);
        c.setMood(5);
        c.setQuickExit(true);

        assertThat(CheckInText.render(c)).isEqualTo("energia 6/10, hangulat 5/10 (gyors kitöltés)");
    }

    @Test
    void testRender_shouldNotRenderAskedButSkippedItems_whenAskedItemsListed() {
        CheckInEntity c = new CheckInEntity();
        c.setAskedItems(List.of("energy", "mood", "stress"));
        c.setEnergy(6);

        assertThat(CheckInText.render(c)).isEqualTo("energia 6/10");
    }

    /** The ceiling has one meaning across every prompt renderer (mezo-b6zt). */
    @Test
    void testScaleMax_shouldEqualTheToolTextCeiling() {
        assertThat(CheckInText.SCALE_MAX).isEqualTo(ToolText.RATING_MAX);
    }
}
