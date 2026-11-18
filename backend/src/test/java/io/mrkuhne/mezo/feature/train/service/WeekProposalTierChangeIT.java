package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalGroupJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * A tier or sport change on a running block (volume engine v2 S3, spec §6.5, defect 9) in the default
 * {@code auto} mode: every group whose band moved in the request and whose plan now sits outside it gets the
 * evaluator's cap-respecting edits as a {@code tier_change} proposal of the calendar week, applied at once
 * ({@code auto_applied}), the ledger re-synced. A group he did not touch is never pulled back.
 */
class WeekProposalTierChangeIT extends AbstractIntegrationTest {

    private static final List<String> CURVE = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired TrainService trainService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;

    private UUID owner;
    private MesocycleEntity meso;
    private WorkoutSessionEntity mon;
    private WorkoutSessionEntity thu;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-tier-change@test.local");
    }

    private void run(Map<String, String> priorities, List<String> sportGroups) {
        meso = train.activeMesoStartedWeeksAgo(owner, 1, 6, CURVE);
        meso.setMusclePriorities(priorities);
        meso.setSportGroups(sportGroups);
        meso = mesocycleRepository.saveAndFlush(meso);
        mon = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        thu = train.createWorkoutSession(owner, meso.getId(), "Csütörtök", "gym", 3, "active");
    }

    /** Építés (10–16) → Hangsúly (14–22) with back at 11: raised to the new band's low, 14. */
    @Test
    void growToEmphasizeBelowTheNewBandRaisesToItsLow() {
        run(null, null);
        ExerciseEntity mon4 = ex(mon, "Evezés", "back-mid", 4);
        ExerciseEntity mon2 = ex(mon, "Lehúzás", "back-wide", 2);
        ExerciseEntity thu3 = ex(thu, "Kábeles evezés", "back-mid", 3);
        ExerciseEntity thu2 = ex(thu, "Húzódzkodás", "back-wide", 2);

        trainService.updateMusclePriorities(owner, meso.getId(), Map.of("back", "emphasize"), null);

        // fewest sets first, then the lighter day: Thu 2→3, Mon 2→3, Thu 3→4
        assertThat(List.of(sets(mon4), sets(mon2), sets(thu3), sets(thu2))).containsExactly(4, 3, 4, 3);
        MesoWeekProposalEntity p = onlyProposal();
        assertThat(p.getKind()).isEqualTo(MesoWeekProposalEntity.KIND_TIER_CHANGE);
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(p.getWeek()).isEqualTo(2);
        assertThat(p.getDecidedAt()).isNotNull();
        assertThat(p.getLines()).extracting(WeekProposalLineJson::exerciseId)
            .containsExactly(mon2.getId(), thu3.getId(), thu2.getId());
        assertThat(p.getLines()).allSatisfy(l -> {
            assertThat(l.kind()).isEqualTo(WeekProposalLineJson.KIND_SETS);
            assertThat(l.to() - l.from()).isEqualTo(1);
            assertThat(l.reasons()).containsExactly("tier_change", "room_in_band");
            assertThat(l.decision()).isEqualTo(WeekProposalLineJson.DECISION_ACCEPTED);
            assertThat(l.muscleGroup()).isEqualTo("back");
        });
        assertThat(p.getLines().get(1).dayName()).isEqualTo("Csütörtök");
        assertThat(p.getLines().get(1).dayIndex()).isEqualTo(3);
        assertThat(p.getGroups()).singleElement().isEqualTo(new WeekProposalGroupJson(
            "back", "emphasize", 14, 22, false, 11, 14, List.of("tier_change", "room_in_band")));
        assertThat(p.getPlanAfter()).containsEntry(thu3.getId().toString(), 4);
        MuscleGroupVolumeLogEntity ledger = ledger("back");
        assertThat(ledger.getCurrentSets()).isEqualTo(14);
        assertThat(ledger.getSource().adjustments()).last().satisfies(a -> {
            assertThat(a.kind()).isEqualTo("pattern");
            assertThat(a.label()).isEqualTo("prioritás-váltás: 11 → 14");
        });
        // the weekly audit is left alone
        assertThat(mesocycleRepository.findById(meso.getId()).orElseThrow().getVolumeRecompute()).isNull();
    }

    /** Hangsúly → Tartás (4–9) with back at 11: cut to the band's high, from the biggest exercise. */
    @Test
    void emphasizeToMaintainAboveTheNewBandCutsToItsHigh() {
        run(Map.of("back", "emphasize"), null);
        ExerciseEntity mon4 = ex(mon, "Evezés", "back-mid", 4);
        ExerciseEntity mon2 = ex(mon, "Lehúzás", "back-wide", 2);
        ExerciseEntity thu3 = ex(thu, "Kábeles evezés", "back-mid", 3);
        ExerciseEntity thu2 = ex(thu, "Húzódzkodás", "back-wide", 2);

        trainService.updateMusclePriorities(owner, meso.getId(), Map.of("back", "maintain"), null);

        assertThat(List.of(sets(mon4), sets(mon2), sets(thu3), sets(thu2))).containsExactly(2, 2, 3, 2);
        MesoWeekProposalEntity p = onlyProposal();
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(p.getLines()).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(mon4.getId());
            assertThat(l.from()).isEqualTo(4);
            assertThat(l.to()).isEqualTo(2);
            assertThat(l.reasons()).containsExactly("tier_change", "above_band");
        });
        assertThat(p.getGroups()).singleElement().isEqualTo(new WeekProposalGroupJson(
            "back", "maintain", 4, 9, false, 11, 9, List.of("tier_change", "above_band")));
        assertThat(ledger("back").getCurrentSets()).isEqualTo(9);
    }

    /** Biceps sits at 11 above its Építés band (6–10) by his own choice: a back change never touches it. */
    @Test
    void anUntouchedGroupAboveItsBandIsNeverTouched() {
        run(null, null);
        ExerciseEntity back1 = ex(mon, "Evezés", "back-mid", 3);
        ExerciseEntity back2 = ex(mon, "Lehúzás", "back-wide", 2);
        ExerciseEntity back3 = ex(thu, "Kábeles evezés", "back-mid", 3);
        ExerciseEntity back4 = ex(thu, "Húzódzkodás", "back-wide", 2);
        ExerciseEntity biceps = ex(mon, "Bicepsz", "biceps", 5);
        ExerciseEntity biceps2 = ex(thu, "Kalapács", "biceps", 5);
        ExerciseEntity biceps3 = ex(thu, "Koncentrált", "biceps", 1);

        // no band changes at all → no proposal, biceps stays above its band
        trainService.updateMusclePriorities(owner, meso.getId(), Map.of(), null);
        assertThat(proposals()).isEmpty();

        // back changes (10 → Hangsúly low 14): only back moves
        trainService.updateMusclePriorities(owner, meso.getId(), Map.of("back", "emphasize"), null);

        assertThat(List.of(sets(biceps), sets(biceps2), sets(biceps3))).containsExactly(5, 5, 1);
        assertThat(List.of(sets(back1), sets(back2), sets(back3), sets(back4))).containsExactly(4, 3, 4, 3);
        MesoWeekProposalEntity p = onlyProposal();
        assertThat(p.getLines()).allSatisfy(l -> assertThat(l.muscleGroup()).isEqualTo("back"));
        assertThat(p.getGroups()).extracting(WeekProposalGroupJson::muscle).containsExactly("back");
        assertThat(ledger("biceps").getCurrentSets()).isEqualTo(11);
    }

    /** A band that changed but still holds the plan: no line, no proposal. */
    @Test
    void aChangedBandThatStillHoldsThePlanRaisesNothing() {
        run(null, null);
        ex(mon, "Evezés", "back-mid", 4);
        ex(thu, "Kábeles evezés", "back-mid", 4);
        ex(thu, "Húzódzkodás", "back-wide", 6);

        trainService.updateMusclePriorities(owner, meso.getId(), Map.of("back", "emphasize"), null);

        assertThat(proposals()).isEmpty();
    }

    /** A sport change lowers the leg bands (Építés quad 8–12 → 7–10 sport-loaded): quad at 12 is cut to 10. */
    @Test
    void aSportGroupsChangeThatLowersALegBandCutsIt() {
        run(null, null);
        ExerciseEntity monSquat = ex(mon, "Guggolás", "quad", 4);
        ExerciseEntity monExt = ex(mon, "Lábnyújtás", "quad", 2);
        ExerciseEntity thuSquat = ex(thu, "Lábtolás", "quad", 4);
        ExerciseEntity thuExt = ex(thu, "Kitörés", "quad", 2);
        ExerciseEntity ham = ex(mon, "Lábhajlítás", "ham", 6);

        trainService.updateMusclePriorities(owner, meso.getId(), null, List.of("quad", "ham"));

        assertThat(List.of(sets(monSquat), sets(monExt), sets(thuSquat), sets(thuExt))).containsExactly(3, 2, 3, 2);
        assertThat(sets(ham)).isEqualTo(6); // ham 5–8 sport-loaded: 6 still inside
        MesoWeekProposalEntity p = onlyProposal();
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(p.getLines()).extracting(WeekProposalLineJson::exerciseId)
            .containsExactly(monSquat.getId(), thuSquat.getId());
        assertThat(p.getLines()).allSatisfy(l -> assertThat(l.reasons()).containsExactly("tier_change", "above_band"));
        assertThat(p.getGroups()).singleElement().isEqualTo(new WeekProposalGroupJson(
            "quad", "grow", 7, 10, true, 12, 10, List.of("tier_change", "above_band")));
        assertThat(ledger("quad").getCurrentSets()).isEqualTo(10);
        assertThat(ledger("quad").getSource().adjustments()).last()
            .satisfies(a -> assertThat(a.label()).isEqualTo("sport-terhelés: 12 → 10"));
    }

    /**
     * The caps stop the raise short of the band: what fits is proposed. A group where nothing fits gets no
     * line and is listed with {@code no_slot}.
     */
    @Test
    void theCapsLimitTheRaise() {
        run(null, null);
        ExerciseEntity a = ex(mon, "Evezés", "back-mid", 5);
        ExerciseEntity b = ex(mon, "Lehúzás", "back-wide", 2);
        ExerciseEntity c = ex(thu, "Kábeles evezés", "back-mid", 5);
        ExerciseEntity chest1 = ex(mon, "Fekvenyomás", "chest-mid", 5);
        ExerciseEntity chest2 = ex(thu, "Tárogatás", "chest-mid", 5);

        trainService.updateMusclePriorities(owner, meso.getId(), Map.of("back", "emphasize", "chest", "emphasize"),
            null);

        // back 12 → 14 wanted; exercise cap 5 and Monday's session cap 8 leave one set: Lehúzás 2 → 3
        assertThat(List.of(sets(a), sets(b), sets(c))).containsExactly(5, 3, 5);
        // chest 10 → 12 wanted; both exercises sit at the exercise cap: nothing fits
        assertThat(List.of(sets(chest1), sets(chest2))).containsExactly(5, 5);
        MesoWeekProposalEntity p = onlyProposal();
        assertThat(p.getLines()).singleElement().satisfies(l -> assertThat(l.exerciseId()).isEqualTo(b.getId()));
        assertThat(p.getGroups()).containsExactly(
            new WeekProposalGroupJson("chest", "emphasize", 12, 20, false, 10, 10,
                List.of("tier_change", "room_in_band", "no_slot")),
            new WeekProposalGroupJson("back", "emphasize", 14, 22, false, 12, 13,
                List.of("tier_change", "room_in_band")));
    }

    @Test
    void aModelOneRunOrANonActiveRunRaisesNothing() {
        run(null, null);
        ExerciseEntity row = ex(mon, "Evezés", "back-mid", 4);
        meso.setVolumeModel((short) 1);
        meso = mesocycleRepository.saveAndFlush(meso);

        trainService.updateMusclePriorities(owner, meso.getId(), Map.of("back", "emphasize"), null);
        assertThat(proposals()).isEmpty();

        meso = mesocycleRepository.findById(meso.getId()).orElseThrow();
        meso.setVolumeModel((short) 2);
        meso.setStatus("planned");
        meso = mesocycleRepository.saveAndFlush(meso);
        trainService.updateMusclePriorities(owner, meso.getId(), Map.of("back", "maintain"), null);

        assertThat(proposals()).isEmpty();
        assertThat(sets(row)).isEqualTo(4);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    private ExerciseEntity ex(WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        return train.save(e);
    }

    private int sets(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow().getWorkingSets();
    }

    private List<MesoWeekProposalEntity> proposals() {
        return proposalRepository.findAll().stream().filter(p -> p.getMesocycleId().equals(meso.getId())).toList();
    }

    private MesoWeekProposalEntity onlyProposal() {
        List<MesoWeekProposalEntity> all = proposals();
        assertThat(all).hasSize(1);
        return all.get(0);
    }

    private MuscleGroupVolumeLogEntity ledger(String group) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(meso.getId())).stream()
            .filter(r -> r.getMuscle().equals(group)).findFirst().orElseThrow();
    }
}
