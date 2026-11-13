package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.nutrition.service.NovaRule;
import io.mrkuhne.mezo.feature.nutrition.service.Sensitivity;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityLevel;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityService;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityVerdict;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The three-level sensitivity rules (spec §7.1) as pure logic — no Spring, no database. */
class SensitivityServiceTest {

    private static SensitivityProfile profile(String key, SensitivityLevel level) {
        return new SensitivityProfile(List.of(new Sensitivity(key, level, null)), new NovaRule(false, 2));
    }

    @Test
    void allergyBlocksTraces() {
        SensitivityVerdict v = SensitivityService.verdict(
            profile("peanuts", SensitivityLevel.ALLERGY), Map.of("peanuts", AllergenState.TRACES));

        assertThat(v.blocksSuggestion()).isTrue();
        assertThat(v.warnings()).hasSize(1);
        assertThat(v.warnings().get(0).key()).isEqualTo("peanuts");
    }

    @Test
    void intoleranceWarnsOnContainsOnly() {
        SensitivityProfile p = profile("milk", SensitivityLevel.INTOLERANCE);

        SensitivityVerdict traces = SensitivityService.verdict(p, Map.of("milk", AllergenState.TRACES));
        assertThat(traces.warnings()).isEmpty();
        assertThat(traces.blocksSuggestion()).isFalse();

        SensitivityVerdict contains = SensitivityService.verdict(p, Map.of("milk", AllergenState.CONTAINS));
        assertThat(contains.warnings()).hasSize(1);
        assertThat(contains.warnings().get(0).key()).isEqualTo("milk");
        assertThat(contains.blocksSuggestion()).isTrue();
    }

    @Test
    void unknownIsNeverSafe() {
        SensitivityVerdict v = SensitivityService.verdict(
            profile("peanuts", SensitivityLevel.ALLERGY), Map.of("peanuts", AllergenState.UNKNOWN));

        assertThat(v.blocksSuggestion()).isTrue();
        assertThat(v.warnings()).hasSize(1);
        assertThat(v.warnings().get(0).text()).isEqualTo("nincs adat");
    }

    @Test
    void absentEu14KeyCountsAsUnknownForAllergy() {
        SensitivityVerdict v = SensitivityService.verdict(profile("sesame", SensitivityLevel.ALLERGY), Map.of());

        assertThat(v.blocksSuggestion()).isTrue();
        assertThat(v.warnings().get(0).text()).isEqualTo("nincs adat");
    }

    @Test
    void freeTextKeyHasNoStructuredState() {
        SensitivityVerdict v = SensitivityService.verdict(
            profile("laktóz", SensitivityLevel.INTOLERANCE), Map.of("milk", AllergenState.CONTAINS));

        assertThat(v.blocksSuggestion()).isFalse();
        assertThat(v.warnings()).isEmpty();
    }

    @Test
    void avoidWarnsButDoesNotBlockLogging() {
        SensitivityVerdict v = SensitivityService.verdict(
            profile("gluten", SensitivityLevel.AVOID), Map.of("gluten", AllergenState.CONTAINS));

        // Nothing is ever blocked from being LOGGED: the verdict is advisory, it never throws.
        assertThat(v.blocksSuggestion()).isTrue();
        assertThat(v.warnings()).hasSize(1);
    }

    @Test
    void novaRuleBlocksLevelThreeAndFour() {
        SensitivityProfile p = new SensitivityProfile(List.of(), new NovaRule(true, 2));

        assertThat(SensitivityService.verdict(p, Map.of(), 3).blocksSuggestion()).isTrue();
        assertThat(SensitivityService.verdict(p, Map.of(), 4).blocksSuggestion()).isTrue();
        assertThat(SensitivityService.verdict(p, Map.of(), 2).blocksSuggestion()).isFalse();
        assertThat(SensitivityService.verdict(p, Map.of(), null).blocksSuggestion()).isFalse();
    }

    @Test
    void disabledNovaRuleBlocksNothing() {
        SensitivityProfile p = new SensitivityProfile(List.of(), new NovaRule(false, 2));

        assertThat(SensitivityService.verdict(p, Map.of(), 4).blocksSuggestion()).isFalse();
    }

    // --- lactose-free recognition (mezo-r36n9.48) -------------------------------------------

    @Test
    void lactoseFreeSilencesAnIntoleranceMilkWarning() {
        SensitivityVerdict v = SensitivityService.verdict(
            profile("milk", SensitivityLevel.INTOLERANCE), Map.of("milk", AllergenState.CONTAINS), null, true);

        assertThat(v.warnings()).isEmpty();
        assertThat(v.blocksSuggestion()).isFalse();
    }

    @Test
    void anUnrecognisedProductStillWarnsAnIntolerance() {
        SensitivityProfile p = profile("milk", SensitivityLevel.INTOLERANCE);

        // false and null both mean "not recognised as lactose-free": silence buys no pass.
        assertThat(SensitivityService.verdict(p, Map.of("milk", AllergenState.CONTAINS), null, false)
            .blocksSuggestion()).isTrue();
        assertThat(SensitivityService.verdict(p, Map.of("milk", AllergenState.CONTAINS), null, null)
            .blocksSuggestion()).isTrue();
    }

    @Test
    void lactoseFreeNeverWeakensAMilkAllergy() {
        // The EU-14 "milk" key is the protein, which a lactose-free product still carries.
        SensitivityVerdict v = SensitivityService.verdict(
            profile("milk", SensitivityLevel.ALLERGY), Map.of("milk", AllergenState.CONTAINS), null, true);

        assertThat(v.blocksSuggestion()).isTrue();
        assertThat(v.warnings()).hasSize(1);
    }

    @Test
    void lactoseFreeNeverWeakensAnAvoidRuleOrAnotherKey() {
        assertThat(SensitivityService.verdict(
            profile("milk", SensitivityLevel.AVOID), Map.of("milk", AllergenState.CONTAINS), null, true)
            .blocksSuggestion()).isTrue();
        assertThat(SensitivityService.verdict(
            profile("eggs", SensitivityLevel.INTOLERANCE), Map.of("eggs", AllergenState.CONTAINS), null, true)
            .blocksSuggestion()).isTrue();
    }
}
