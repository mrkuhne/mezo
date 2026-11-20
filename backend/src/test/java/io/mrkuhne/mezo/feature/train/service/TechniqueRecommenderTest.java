package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanDay;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner.PlanRow;
import io.mrkuhne.mezo.feature.train.service.TechniqueRecommender.Recommendation;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The per-exercise technique recommendation (mezo-r36n9.98): one test per reason code. */
class TechniqueRecommenderTest {
    private static final TrainTechniqueProperties.Planner CFG = new TrainTechniqueProperties.Planner(3, 2, 1, 2, 15);

    private static PlanRow row(String type, Integer repMax, CatalogAttributes.Attrs attrs, TrainingStyle style) {
        return new PlanRow(0, 0, UUID.randomUUID(), "chest", true, 3, type, repMax, attrs, style, Technique.NONE,
            null, false);
    }

    private static Recommendation rec(PlanRow r) {
        return TechniqueRecommender.recommend(r, CFG).orElseThrow();
    }

    @Test
    void highRepStableIsolation_isMyo_isolationPump() {
        Recommendation r = rec(row("isolation", 20, new CatalogAttributes.Attrs(true, true, "machine", true),
            TrainingStyle.VOLUME));
        assertThat(r.technique()).isEqualTo(Technique.MYO);
        assertThat(r.reason()).isEqualTo("isolation_pump");
        assertThat(r.challengeFit()).isTrue();
    }

    @Test
    void machineOrCable_isRestDrop_stableMachine() {
        Recommendation machine = rec(row("compound", 10, new CatalogAttributes.Attrs(true, false, "machine", true),
            TrainingStyle.BALANCED));
        assertThat(machine.technique()).isEqualTo(Technique.REST_DROP);
        assertThat(machine.reason()).isEqualTo("stable_machine");
        // owner decision #61: the challenge follows the challenge rule, not lengthened-friendliness
        assertThat(machine.challengeFit()).isTrue();
        Recommendation refused = rec(row("compound", 10, new CatalogAttributes.Attrs(true, false, "machine", false),
            TrainingStyle.BALANCED));
        assertThat(refused.challengeFit()).isFalse();
        Recommendation cable = rec(row("isolation", 12, new CatalogAttributes.Attrs(true, true, "cable", true),
            TrainingStyle.BALANCED));
        assertThat(cable.technique()).isEqualTo(Technique.REST_DROP);
        assertThat(cable.challengeFit()).isTrue();
    }

    @Test
    void stableLengthenedFreeEquipment_isPartials_lengthenedSafe() {
        Recommendation r = rec(row("isolation", 12, new CatalogAttributes.Attrs(true, true, "dumbbell", true),
            TrainingStyle.BALANCED));
        assertThat(r.technique()).isEqualTo(Technique.PARTIALS);
        assertThat(r.reason()).isEqualTo("lengthened_safe");
        assertThat(r.challengeFit()).isTrue();
    }

    @Test
    void allOut_isNone_allOut() {
        Recommendation r = rec(row("isolation", 20, new CatalogAttributes.Attrs(true, true, "machine", true),
            TrainingStyle.ALLOUT));
        assertThat(r.technique()).isEqualTo(Technique.NONE);
        assertThat(r.reason()).isEqualTo("all_out");
        assertThat(r.challengeFit()).isTrue();
    }

    @Test
    void stableButNothingFits_isNone_noSafeTechnique() {
        Recommendation r = rec(row("compound", 10, new CatalogAttributes.Attrs(true, false, "dumbbell", false),
            TrainingStyle.BALANCED));
        assertThat(r.technique()).isEqualTo(Technique.NONE);
        assertThat(r.reason()).isEqualTo("no_safe_technique");
        assertThat(r.challengeFit()).isFalse();
    }

    @Test
    void freeExercise_getsNoRecommendation() {
        assertThat(TechniqueRecommender.recommend(row("compound", 10, CatalogAttributes.Attrs.FREE,
            TrainingStyle.BALANCED), CFG)).isEmpty();
    }

    @Test
    void sameTechniqueAsThePlannerPicks() {
        PlanRow r = row("isolation", 20, new CatalogAttributes.Attrs(true, false, "cable", false), TrainingStyle.BALANCED);
        assertThat(rec(r).technique()).isEqualTo(TechniquePlanner.defaultTechnique(r, CFG).orElseThrow());
    }

    @Test
    void blockRecommendations_byDayThenPosition() {
        CatalogAttributes.Attrs machine = new CatalogAttributes.Attrs(true, false, "machine", false);
        PlanRow a = new PlanRow(1, 1, UUID.randomUUID(), "chest", true, 3, "compound", 10, machine,
            TrainingStyle.BALANCED, Technique.NONE, null, false);
        PlanRow free = new PlanRow(1, 0, UUID.randomUUID(), "chest", true, 3, "compound", 10,
            CatalogAttributes.Attrs.FREE, TrainingStyle.BALANCED, Technique.NONE, null, false);
        PlanRow b = new PlanRow(0, 2, UUID.randomUUID(), "chest", true, 3, "compound", 10, machine,
            TrainingStyle.BALANCED, Technique.NONE, null, false);
        List<Recommendation> recs = TechniqueRecommender.recommend(
            List.of(new PlanDay(1, false, List.of(free, a)), new PlanDay(0, false, List.of(b))), CFG);
        assertThat(recs).extracting(Recommendation::dayIndex).containsExactly(0, 1);
        assertThat(recs).extracting(Recommendation::exerciseIndex).containsExactly(2, 1);
    }
}
