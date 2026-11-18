package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedLeg;
import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.SetLegKind;
import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TechniquePrescriberTest {
    private static final TrainTechniqueProperties CFG = new TrainTechniqueProperties(
        new TrainTechniqueProperties.Drop(0, 30, 30), new TrainTechniqueProperties.Drop(0, 20, 0),
        new TrainTechniqueProperties.Myo(1, 5, 3, 20, 4), new TrainTechniqueProperties.Partials(0), 2);
    private static final Set<BigDecimal> REAL = Set.of(bd("20"), bd("25"), bd("27.5"), bd("30"), bd("32"), bd("40"));

    private static BigDecimal bd(String s) { return new BigDecimal(s); }

    private static PrescribedSet working(String w, Integer reps) {
        return new PrescribedSet().kind(PrescribedSet.KindEnum.WORKING)
            .targetWeightKg(w == null ? null : bd(w)).targetReps(reps).targetRIR(2).restSec(120);
    }

    private static PrescribedSet warmup() {
        return new PrescribedSet().kind(PrescribedSet.KindEnum.WARMUP).targetWeightKg(bd("20")).targetReps(8);
    }

    private static Prescription rx(PrescribedSet... sets) {
        return new Prescription(List.of(sets), "r", null);
    }

    @Test
    void testRestDrop_isThirtyPercentLighterSameReps() {
        Prescription out = TechniquePrescriber.apply(rx(warmup(), working("40", 10), working("40", 10)),
            Technique.REST_DROP, false, false, REAL, CFG);
        PrescribedSet last = out.sets().get(2);
        assertThat(last.getTechnique().getValue()).isEqualTo("rest_drop");
        assertThat(last.getTargetRIR()).isEqualTo(0);
        PrescribedLeg leg = last.getLegs().get(0);
        assertThat(leg.getKind()).isEqualTo(SetLegKind.DROP);
        assertThat(leg.getWeightKg()).isEqualByComparingTo("27.5");   // 28 snapped down
        assertThat(leg.getReps()).isEqualTo(10);
        assertThat(leg.getRestBeforeSec()).isEqualTo(30);
        assertThat(leg.getDropPercent()).isEqualTo(30);
        assertThat(leg.getToFailure()).isFalse();
        // other sets untouched
        assertThat(out.sets().get(1).getTechnique()).isNull();
        assertThat(out.sets().get(1).getLegs()).isEmpty();
        assertThat(out.sets().get(1).getTargetRIR()).isEqualTo(2);
        assertThat(out.sets().get(0).getKind()).isEqualTo(PrescribedSet.KindEnum.WARMUP);
    }

    @Test
    void testDrop_isToFailureNoRest() {
        PrescribedLeg leg = TechniquePrescriber.apply(rx(working("40", 10)), Technique.DROP, false, false, REAL, CFG)
            .sets().get(0).getLegs().get(0);
        assertThat(leg.getWeightKg()).isEqualByComparingTo("32");
        assertThat(leg.getToFailure()).isTrue();
        assertThat(leg.getReps()).isNull();
        assertThat(leg.getRestBeforeSec()).isZero();
        assertThat(leg.getDropPercent()).isEqualTo(20);
    }

    @Test
    void testDrop_snapsDownToARealWeight() {
        PrescribedLeg leg = TechniquePrescriber.apply(rx(working("50", 8)), Technique.REST_DROP, false, false,
            Set.of(bd("30"), bd("40"), bd("36")), CFG).sets().get(0).getLegs().get(0);
        assertThat(leg.getWeightKg()).isEqualByComparingTo("30");   // target 35, nearest at-or-below
    }

    @Test
    void testDrop_noCandidateAtOrBelow_shouldBeNullWeightKeepPercent() {
        PrescribedLeg leg = TechniquePrescriber.apply(rx(working("10", 8)), Technique.REST_DROP, false, false,
            Set.of(bd("20")), CFG).sets().get(0).getLegs().get(0);
        assertThat(leg.getWeightKg()).isNull();
        assertThat(leg.getDropPercent()).isEqualTo(30);
    }

    @Test
    void testNoWeight_shouldGiveNullWeightAndPercent() {
        PrescribedLeg leg = TechniquePrescriber.apply(rx(working(null, 12)), Technique.DROP, false, false, REAL, CFG)
            .sets().get(0).getLegs().get(0);
        assertThat(leg.getWeightKg()).isNull();
        assertThat(leg.getDropPercent()).isEqualTo(20);
        PrescribedLeg empty = TechniquePrescriber.apply(rx(working("40", 12)), Technique.DROP, false, false, Set.of(), CFG)
            .sets().get(0).getLegs().get(0);
        assertThat(empty.getWeightKg()).isNull();
    }

    @Test
    void testRestDrop_mainWithoutReps_shouldHaveNullLegReps() {
        PrescribedLeg leg = TechniquePrescriber.apply(rx(working("40", null)), Technique.REST_DROP, false, false, REAL, CFG)
            .sets().get(0).getLegs().get(0);
        assertThat(leg.getReps()).isNull();
    }

    @Test
    void testMyo_hasFourMiniSets() {
        PrescribedSet s = TechniquePrescriber.apply(rx(working("40", 12)), Technique.MYO, false, false, REAL, CFG)
            .sets().get(0);
        assertThat(s.getTargetRIR()).isEqualTo(1);
        assertThat(s.getLegs()).hasSize(4).allSatisfy(l -> {
            assertThat(l.getKind()).isEqualTo(SetLegKind.MINI);
            assertThat(l.getWeightKg()).isEqualByComparingTo("40");
            assertThat(l.getReps()).isEqualTo(5);
            assertThat(l.getMinReps()).isEqualTo(3);
            assertThat(l.getRestBeforeSec()).isEqualTo(20);
        });
    }

    @Test
    void testPartials_toFailureNoRest() {
        PrescribedSet s = TechniquePrescriber.apply(rx(working("40", 10)), Technique.PARTIALS, false, false, REAL, CFG)
            .sets().get(0);
        assertThat(s.getTargetRIR()).isZero();
        assertThat(s.getLegs()).singleElement().satisfies(l -> {
            assertThat(l.getKind()).isEqualTo(SetLegKind.PARTIALS);
            assertThat(l.getToFailure()).isTrue();
            assertThat(l.getRestBeforeSec()).isZero();
        });
    }

    @Test
    void testChallengeWinsAndIsPartials() {
        PrescribedSet s = TechniquePrescriber.apply(rx(working("40", 10)), Technique.MYO, true, false, REAL, CFG)
            .sets().get(0);
        assertThat(s.getTechnique().getValue()).isEqualTo("partials");
        assertThat(s.getLegs()).singleElement().extracting(PrescribedLeg::getKind).isEqualTo(SetLegKind.PARTIALS);
    }

    @Test
    void testDeloadIsPlain() {
        Prescription in = rx(working("40", 10));
        assertThat(TechniquePrescriber.apply(in, Technique.DROP, false, true, REAL, CFG)).isSameAs(in);
        assertThat(TechniquePrescriber.apply(in, Technique.NONE, true, true, REAL, CFG)).isSameAs(in);
    }

    @Test
    void testNoneWithoutChallenge_isNoOp() {
        Prescription in = rx(working("40", 10));
        assertThat(TechniquePrescriber.apply(in, Technique.NONE, false, false, REAL, CFG)).isSameAs(in);
    }

    @Test
    void testSingleSetIsTheTechniqueSet() {
        Prescription out = TechniquePrescriber.apply(rx(working("40", 10)), Technique.DROP, false, false, REAL, CFG);
        assertThat(out.sets()).hasSize(1);
        assertThat(out.sets().get(0).getTechnique().getValue()).isEqualTo("drop");
    }

    @Test
    void testInputIsNotMutated() {
        PrescribedSet main = working("40", 10);
        Prescription in = rx(main);
        TechniquePrescriber.apply(in, Technique.MYO, false, false, REAL, CFG);
        assertThat(main.getTechnique()).isNull();
        assertThat(main.getLegs()).isEmpty();
        assertThat(main.getTargetRIR()).isEqualTo(2);
    }

    @Test
    void testOnlyWarmups_isNoOp() {
        Prescription in = rx(warmup());
        assertThat(TechniquePrescriber.apply(in, Technique.DROP, false, false, REAL, CFG)).isSameAs(in);
    }
}
