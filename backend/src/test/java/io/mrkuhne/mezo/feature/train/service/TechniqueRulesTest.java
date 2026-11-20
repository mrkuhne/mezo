package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetLegKind;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class TechniqueRulesTest {
    private static final CatalogAttributes.Attrs STABLE = new CatalogAttributes.Attrs(true, false, "machine");
    private static final CatalogAttributes.Attrs LENGTHENED = new CatalogAttributes.Attrs(true, true, "machine");

    @Test
    void testAttrs_nullOrUnknownEquipment_shouldReadAsOther() {
        assertThat(new CatalogAttributes.Attrs(true, false, null).equipment()).isEqualTo("other");
        assertThat(new CatalogAttributes.Attrs(true, false, "rope").equipment()).isEqualTo("other");
        assertThat(new CatalogAttributes.Attrs(true, false, "cable").equipment()).isEqualTo("cable");
        assertThat(CatalogAttributes.Attrs.FREE.equipment()).isEqualTo("other");
    }

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
    void testCheck_challengeWithTechnique_shouldPass() {
        // mezo-r36n9.98: a technique and the day's challenge may share a row
        assertThat(TechniqueRules.check(Technique.MYO, true, LENGTHENED)).isEmpty();
        assertThat(TechniqueRules.check(Technique.REST_DROP, true, LENGTHENED)).isEmpty();
        assertThat(TechniqueRules.check(Technique.DROP, true, LENGTHENED)).isEmpty();
        assertThat(TechniqueRules.check(Technique.PARTIALS, true, LENGTHENED)).isEmpty();
    }

    @Test
    void testCheck_challengeWithTechnique_stillNeedsLengthenedAndStable() {
        assertThat(TechniqueRules.check(Technique.REST_DROP, true, STABLE)).contains("TRAIN_TECHNIQUE_NOT_LENGTHENED");
        assertThat(TechniqueRules.check(Technique.MYO, true, CatalogAttributes.Attrs.FREE))
            .contains("TRAIN_TECHNIQUE_NOT_STABLE");
    }

    @Test
    void testLegsFit_techniqueLegsThenOneChallengePartials() {
        assertThat(TechniqueRules.legsFit(Technique.REST_DROP, List.of(SetLegKind.DROP))).isTrue();
        assertThat(TechniqueRules.legsFit(Technique.REST_DROP, List.of(SetLegKind.DROP, SetLegKind.PARTIALS))).isTrue();
        assertThat(TechniqueRules.legsFit(Technique.MYO,
            List.of(SetLegKind.MINI, SetLegKind.MINI, SetLegKind.PARTIALS))).isTrue();
        assertThat(TechniqueRules.legsFit(Technique.PARTIALS, List.of(SetLegKind.PARTIALS))).isTrue();
        // the half reps come last, once; a foreign kind never fits
        assertThat(TechniqueRules.legsFit(Technique.DROP, List.of(SetLegKind.PARTIALS, SetLegKind.DROP))).isFalse();
        assertThat(TechniqueRules.legsFit(Technique.DROP,
            List.of(SetLegKind.DROP, SetLegKind.PARTIALS, SetLegKind.PARTIALS))).isFalse();
        assertThat(TechniqueRules.legsFit(Technique.DROP, List.of(SetLegKind.MINI))).isFalse();
        assertThat(TechniqueRules.legsFit(Technique.NONE, List.of(SetLegKind.PARTIALS))).isFalse();
        assertThat(TechniqueRules.legsFit(Technique.NONE, List.of())).isTrue();
    }

    @Test
    void testChallengeSetup() {
        assertThat(TechniqueRules.challengeSetup(Technique.NONE)).isEqualTo("none");
        assertThat(TechniqueRules.challengeSetup(null)).isEqualTo("none");
        assertThat(TechniqueRules.challengeSetup(Technique.PARTIALS)).isEqualTo("none");
        assertThat(TechniqueRules.challengeSetup(Technique.REST_DROP)).isEqualTo("rest_drop");
        assertThat(TechniqueRules.challengeSetup(Technique.MYO)).isEqualTo("myo");
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
        assertThat(TechniqueRules.allowedLegKinds(Technique.REST_PAUSE)).containsExactly(SetLegKind.MINI);
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
        // mezo-r36n9.98: technique and challenge each add one; partials on the challenge row is the challenge
        assertThat(TechniqueRules.capExtra(Technique.REST_DROP, true, true, 2)).isEqualTo(2);
        assertThat(TechniqueRules.capExtra(Technique.MYO, true, true, 3)).isEqualTo(4);
        assertThat(TechniqueRules.capExtra(Technique.PARTIALS, true, true, 2)).isEqualTo(1);
        assertThat(TechniqueRules.capExtra(Technique.REST_DROP, true, false, 2)).isZero();
    }

    @Test
    void testWire_roundTrips() {
        assertThat(Technique.REST_DROP.wire()).isEqualTo("rest_drop");
        assertThat(Technique.fromWire("rest_drop")).isEqualTo(Technique.REST_DROP);
        assertThat(Technique.fromWire(null)).isEqualTo(Technique.NONE);
        assertThat(Technique.MYO.toApi().getValue()).isEqualTo("myo");
    }
}
