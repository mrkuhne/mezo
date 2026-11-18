package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetLegKind;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class TechniqueRulesTest {
    private static final CatalogAttributes.Attrs STABLE = new CatalogAttributes.Attrs(true, false);
    private static final CatalogAttributes.Attrs LENGTHENED = new CatalogAttributes.Attrs(true, true);

    @Test
    void testCheck_freeExercise_shouldReject() {
        assertThat(TechniqueRules.check(Technique.DROP, false, CatalogAttributes.Attrs.FREE))
            .contains("TRAIN_TECHNIQUE_NOT_STABLE");
        assertThat(TechniqueRules.check(Technique.NONE, true, CatalogAttributes.Attrs.FREE))
            .contains("TRAIN_TECHNIQUE_NOT_STABLE");
    }

    @Test
    void testCheck_partialsNeedsLengthened() {
        assertThat(TechniqueRules.check(Technique.PARTIALS, false, STABLE)).contains("TRAIN_TECHNIQUE_NOT_LENGTHENED");
        assertThat(TechniqueRules.check(Technique.NONE, true, STABLE)).contains("TRAIN_TECHNIQUE_NOT_LENGTHENED");
        assertThat(TechniqueRules.check(Technique.PARTIALS, false, LENGTHENED)).isEmpty();
        assertThat(TechniqueRules.check(Technique.NONE, true, LENGTHENED)).isEmpty();
    }

    @Test
    void testCheck_challengeWithTechnique_shouldReject() {
        assertThat(TechniqueRules.check(Technique.MYO, true, LENGTHENED)).contains("TRAIN_TECHNIQUE_ON_CHALLENGE");
    }

    @Test
    void testCheck_plainRowAndStableTechnique_shouldPass() {
        assertThat(TechniqueRules.check(Technique.NONE, false, CatalogAttributes.Attrs.FREE)).isEqualTo(Optional.empty());
        assertThat(TechniqueRules.check(Technique.REST_DROP, false, STABLE)).isEmpty();
    }

    @Test
    void testAllowedLegKinds() {
        assertThat(TechniqueRules.allowedLegKinds(Technique.REST_DROP)).containsExactly(SetLegKind.DROP);
        assertThat(TechniqueRules.allowedLegKinds(Technique.DROP)).containsExactly(SetLegKind.DROP);
        assertThat(TechniqueRules.allowedLegKinds(Technique.MYO)).containsExactly(SetLegKind.MINI);
        assertThat(TechniqueRules.allowedLegKinds(Technique.PARTIALS)).containsExactly(SetLegKind.PARTIALS);
        assertThat(TechniqueRules.allowedLegKinds(Technique.NONE)).isEmpty();
    }

    @Test
    void testCapWeight_onlyWhenEnabled() {
        // cfg 2 = the technique set weighs two: one extra over the plain count (owner decision 2026-11-18)
        assertThat(TechniqueRules.capExtra(Technique.DROP, false, true, 2)).isEqualTo(1);
        assertThat(TechniqueRules.capExtra(Technique.NONE, true, true, 2)).isEqualTo(1);
        assertThat(TechniqueRules.capExtra(Technique.MYO, false, true, 2)).isEqualTo(1);
        assertThat(TechniqueRules.capExtra(Technique.MYO, false, false, 2)).isZero();
        assertThat(TechniqueRules.capExtra(Technique.DROP, false, false, 2)).isZero();
        assertThat(TechniqueRules.capExtra(Technique.NONE, false, true, 2)).isZero();
    }

    @Test
    void testWire_roundTrips() {
        assertThat(Technique.REST_DROP.wire()).isEqualTo("rest_drop");
        assertThat(Technique.fromWire("rest_drop")).isEqualTo(Technique.REST_DROP);
        assertThat(Technique.fromWire(null)).isEqualTo(Technique.NONE);
        assertThat(Technique.MYO.toApi().getValue()).isEqualTo("myo");
    }
}
