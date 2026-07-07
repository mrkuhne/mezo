package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.Prescription;
import io.mrkuhne.mezo.feature.train.service.SetRecommendationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class SetRecommendationServiceIT extends AbstractIntegrationTest {

    @Autowired SetRecommendationService svc;
    @Autowired TrainPopulator train;

    @Test
    void testPrescribe_shouldSeedFromAnchor_whenNoHistory() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        ex.setAnchorWeightKg(BigDecimal.valueOf(60));
        train.save(ex);

        Prescription p = svc.prescribe(owner, ex, day.getId());

        // 2 warmup + 3 working; working weight = anchor 60
        assertThat(p.sets()).hasSize(5);
        assertThat(p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP)).hasSize(2);
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work).hasSize(3);
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(60));
        assertThat(work.get(0).getTargetReps()).isEqualTo(8);        // repMax
        assertThat(work.get(0).getTargetRIR()).isEqualTo(0);
        // warmups ramp off 60: 50% -> 30, 75% -> 45
        var warm = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP).toList();
        assertThat(warm.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(30));
        assertThat(warm.get(1).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(45));
    }

    @Test
    void testPrescribe_shouldLeaveWeightNull_whenNoHistoryAndNoAnchor() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");

        Prescription p = svc.prescribe(owner, ex, day.getId());

        assertThat(p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING))
            .allSatisfy(s -> assertThat(s.getTargetWeightKg()).isNull());
    }

    @Test
    void testPrescribe_shouldAddIncrement_whenLastTopSetHitRepMax() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // completed instance with a working top set 8 × 77.5 (repMax=8 → +5 for compound)
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(77.5), 8, 0);

        Prescription p = svc.prescribe(owner, ex, day.getId());

        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(82.5)); // 77.5 + 5
        assertThat(p.rationale()).contains("+5");
    }

    @Test
    void testPrescribe_shouldHoldWeight_whenLastRepsInRange() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(80), 7, 0); // 7 in [6,8) → hold

        Prescription p = svc.prescribe(owner, ex, day.getId());
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(80));
    }

    @Test
    void testPrescribe_shouldReduceWeight_whenLastRepsBelowRepMin() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        train.completedInstanceWithWorkingSet(owner, day.getId(), ex.getId(),
            BigDecimal.valueOf(80), 4, 0); // 4 < 6 → -5

        Prescription p = svc.prescribe(owner, ex, day.getId());
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(75));
    }

    @Test
    void testPrescribe_shouldIgnoreWarmupHistory_whenComputingBase() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // a heavier WARMUP row (100kg) must not become the reference; only working (80×8) counts
        train.completedInstanceWithSets(owner, day.getId(), ex.getId(), sets -> {
            sets.add(train.set("warmup", BigDecimal.valueOf(100), 8, 4));
            sets.add(train.set("working", BigDecimal.valueOf(80), 8, 0));
        });

        Prescription p = svc.prescribe(owner, ex, day.getId());
        var work = p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(85)); // 80 + 5
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
