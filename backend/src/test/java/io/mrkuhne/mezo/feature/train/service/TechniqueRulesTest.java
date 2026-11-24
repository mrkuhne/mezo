package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetLegKind;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TechniqueRulesTest {

    @Test
    void testCheck_shouldUseExercisePalette_forFreeWeightMovements() {
        var hammer = new CatalogAttributes.Attrs(false, false, "dumbbell", true,
            Set.of(Technique.MYO, Technique.REST_DROP, Technique.DROP));
        var hip = new CatalogAttributes.Attrs(false, false, "barbell", false, Set.of(Technique.TOP_PAUSE));
        var overhead = new CatalogAttributes.Attrs(false, false, "barbell", false, Set.of());
        for (Technique allowed : List.of(Technique.MYO, Technique.REST_DROP, Technique.DROP)) {
            assertThat(TechniqueRules.check(allowed, false, hammer)).isEmpty();
        }
        assertThat(TechniqueRules.check(Technique.REST_PAUSE, false, hammer)).contains("TRAIN_TECHNIQUE_NOT_ALLOWED");
        assertThat(TechniqueRules.check(Technique.TOP_PAUSE, false, hip)).isEmpty();
        assertThat(TechniqueRules.check(Technique.DROP, false, hip)).contains("TRAIN_TECHNIQUE_NOT_ALLOWED");
        assertThat(TechniqueRules.check(Technique.TOP_PAUSE, false, overhead))
            .contains("TRAIN_TECHNIQUE_NOT_ALLOWED");
        assertThat(TechniqueRules.check(Technique.NONE, true, hammer)).isEmpty();
    }
    private static final CatalogAttributes.Attrs STABLE = new CatalogAttributes.Attrs(true, false, "machine", true);
    private static final CatalogAttributes.Attrs LENGTHENED = new CatalogAttributes.Attrs(true, true, "machine", true);
    /** A free-weight compound (barbell bench): the challenge rule refuses it (owner decision #72). */
    private static final CatalogAttributes.Attrs FREE_COMPOUND = new CatalogAttributes.Attrs(false, false, "barbell", false);
    /** A free-weight isolation (dumbbell curl): not stable, but the challenge is fine on it. */
    private static final CatalogAttributes.Attrs FREE_ISOLATION = new CatalogAttributes.Attrs(false, false, "dumbbell", true);

    @Test
    void testAttrs_nullOrUnknownEquipment_shouldReadAsOther() {
        assertThat(new CatalogAttributes.Attrs(true, false, null, true).equipment()).isEqualTo("other");
        assertThat(new CatalogAttributes.Attrs(true, false, "rope", true).equipment()).isEqualTo("other");
        assertThat(new CatalogAttributes.Attrs(true, false, "cable", true).equipment()).isEqualTo("cable");
        assertThat(CatalogAttributes.Attrs.FREE.equipment()).isEqualTo("other");
    }

    @Test
    void testCheck_freeExercise_shouldReject() {
        assertThat(TechniqueRules.check(Technique.DROP, false, CatalogAttributes.Attrs.FREE))
            .contains("TRAIN_TECHNIQUE_NOT_ALLOWED");
        // no catalogue link: unknown kit, no challenge either (owner decision #72)
        assertThat(TechniqueRules.check(Technique.NONE, true, CatalogAttributes.Attrs.FREE))
            .contains("TRAIN_CHALLENGE_FREE_WEIGHT_COMPOUND");
    }

    @Test
    void testCheck_partialsNeedsLengthened() {
        assertThat(TechniqueRules.check(Technique.PARTIALS, false, STABLE)).contains("TRAIN_TECHNIQUE_NOT_LENGTHENED");
        assertThat(TechniqueRules.check(Technique.PARTIALS, false, LENGTHENED)).isEmpty();
        assertThat(TechniqueRules.check(Technique.NONE, true, LENGTHENED)).isEmpty();
    }

    @Test
    void testCheck_challenge_followsTheChallengeRuleNotLengthenedOrStable() {
        // owner decision #72: the challenge no longer needs a lengthened-friendly or a stable exercise
        assertThat(TechniqueRules.check(Technique.NONE, true, STABLE)).isEmpty();
        assertThat(TechniqueRules.check(Technique.NONE, true, FREE_ISOLATION)).isEmpty();
        assertThat(TechniqueRules.check(Technique.NONE, true, FREE_COMPOUND))
            .contains("TRAIN_CHALLENGE_FREE_WEIGHT_COMPOUND");
        // a technique still needs a stable exercise, challenge or not
        assertThat(TechniqueRules.check(Technique.MYO, true, FREE_ISOLATION)).contains("TRAIN_TECHNIQUE_NOT_ALLOWED");
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
        "cable curl          | isolation | cable          | cable      | true",
        "triceps pushdown    | isolation | cable          | cable      | true",
        "leg extension       | isolation | machine        | machine    | true",
        "machine chest press | compound  | machine        | machine    | true",
        "lat pulldown        | compound  | cable          | cable      | true",
        "barbell bench       | compound  | barbell;bench  | barbell    | false",
        "back squat          | compound  | barbell        | barbell    | false",
        "conventional dead   | compound  | barbell        | barbell    | false",
        "DB bench            | compound  | dumbbell;bench | dumbbell   | false",
        "KB goblet squat     | compound  | kettlebell     | kettlebell | false",
        "DB curl             | isolation | dumbbell       | dumbbell   | true",
        "pull-up             | compound  | pullup-bar     | bodyweight | true",
        "smith squat         | compound  | smith          | machine    | true",
        "jump squat (plyo)   | plyo      | bodyweight     | bodyweight | false",
    })
    void testChallengeAllowed_table(String label, String type, String gear, String equipment, boolean expected) {
        assertThat(TechniqueRules.challengeAllowed(type, List.of(gear.split(";")), equipment)).isEqualTo(expected);
    }

    @Test
    void testChallengeAllowed_unknownKit_shouldRefuse() {
        // no catalogue link at all
        assertThat(CatalogAttributes.Attrs.FREE.challengeAllowed()).isFalse();
        // a user-authored row without gear falls back to its equipment; neither known = unknown kit
        assertThat(TechniqueRules.challengeAllowed("isolation", null, "cable")).isTrue();
        assertThat(TechniqueRules.challengeAllowed("compound", null, "barbell")).isFalse();
        assertThat(TechniqueRules.challengeAllowed("compound", null, null)).isFalse();
        assertThat(TechniqueRules.challengeAllowed("compound", List.of(), "other")).isFalse();
        assertThat(TechniqueRules.challengeAllowed(null, List.of("cable"), "cable")).isFalse();
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
    void testCheck_challengeWithTechnique_stillNeedsTheChallengeRuleAndStable() {
        assertThat(TechniqueRules.check(Technique.REST_DROP, true, STABLE)).isEmpty();
        assertThat(TechniqueRules.check(Technique.PARTIALS, true, STABLE)).contains("TRAIN_TECHNIQUE_NOT_LENGTHENED");
        assertThat(TechniqueRules.check(Technique.MYO, true, CatalogAttributes.Attrs.FREE))
            .contains("TRAIN_TECHNIQUE_NOT_ALLOWED");
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
        assertThat(TechniqueRules.allowedLegKinds(Technique.TOP_PAUSE)).isEmpty();
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
