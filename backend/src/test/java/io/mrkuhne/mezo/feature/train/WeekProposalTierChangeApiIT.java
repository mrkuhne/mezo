package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.MusclePrioritiesUpdateRequest;
import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.api.dto.WeekProposalDecisionRequest;
import io.mrkuhne.mezo.api.dto.WeekProposalLine;
import io.mrkuhne.mezo.api.dto.WeekProposalMuscle;
import io.mrkuhne.mezo.api.dto.WeekProposalReason;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * A tier change on a running block in {@code manual} mode (volume engine v2 S3, spec §6.5): the
 * {@code tier_change} proposal waits ({@code pending}, nothing written), a newer change supersedes it, the
 * read returns it after the week's weekly proposal, and deciding it through the decisions endpoint applies it.
 */
@TestPropertySource(properties = "mezo.volume.weekly-review.mode=manual")
class WeekProposalTierChangeApiIT extends ApiIntegrationTest {

    private static final List<String> CURVE = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired private TrainPopulator train;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private MesoWeekProposalRepository proposalRepository;
    @Autowired private MuscleGroupVolumeLogRepository volumeRepository;

    @Test
    void aTierChangeWaitsIsSupersededByANewerOneAndIsAppliedWhenDecided() {
        RegisteredUser u = registerUser("Tier Change Manual");
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(u.id(), 1, 6, CURVE);
        WorkoutSessionEntity mon = train.createWorkoutSession(u.id(), meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(u.id(), meso.getId(), "Csütörtök", "gym", 3, "active");
        ExerciseEntity mon4 = exercise(u.id(), mon, "Evezés", "back-mid", 4);
        ExerciseEntity mon2 = exercise(u.id(), mon, "Lehúzás", "back-wide", 2);
        ExerciseEntity thu3 = exercise(u.id(), thu, "Kábeles evezés", "back-mid", 3);
        ExerciseEntity thu2 = exercise(u.id(), thu, "Húzódzkodás", "back-wide", 2);

        // Építés → Hangsúly: back 11 below 14 → a pending proposal, nothing written
        putPriorities(u, meso, Map.of("back", "emphasize"));
        MesoWeekProposalEntity first = onlyPending(meso);
        assertThat(first.getKind()).isEqualTo(MesoWeekProposalEntity.KIND_TIER_CHANGE);
        assertThat(first.getWeek()).isEqualTo(2);
        assertThat(first.getLines()).hasSize(3).allSatisfy(l -> assertThat(l.decision()).isNull());
        assertThat(List.of(sets(mon4), sets(mon2), sets(thu3), sets(thu2))).containsExactly(4, 2, 3, 2);

        // Hangsúly → Tartás: back 11 above 9 → the first is superseded, a new one pends
        putPriorities(u, meso, Map.of("back", "maintain"));
        MesoWeekProposalEntity superseded = proposalRepository.findById(first.getId()).orElseThrow();
        assertThat(superseded.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_SUPERSEDED);
        assertThat(superseded.getDecidedAt()).isNotNull();
        MesoWeekProposalEntity second = onlyPending(meso);
        assertThat(second.getId()).isNotEqualTo(first.getId());
        assertThat(List.of(sets(mon4), sets(mon2), sets(thu3), sets(thu2))).containsExactly(4, 2, 3, 2);

        // the read: the week's weekly proposal first, then the pending tier change
        List<WeekProposal> read = getForList(url(meso), u.headers(), HttpStatus.OK, WeekProposal.class);
        assertThat(read).extracting(WeekProposal::getKind)
            .containsExactly(WeekProposal.KindEnum.WEEKLY, WeekProposal.KindEnum.TIER_CHANGE);
        WeekProposal tier = read.get(1);
        assertThat(tier.getId()).isEqualTo(second.getId());
        assertThat(tier.getStatus()).isEqualTo(WeekProposal.StatusEnum.PENDING);
        assertThat(tier.getLines()).singleElement().satisfies(l -> {
            assertThat(l.getExerciseId()).isEqualTo(mon4.getId());
            assertThat(l.getFrom()).isEqualByComparingTo(BigDecimal.valueOf(4));
            assertThat(l.getTo()).isEqualByComparingTo(BigDecimal.valueOf(2));
            assertThat(l.getReasons()).extracting(WeekProposalReason::getValue).containsExactly("tier_change", "above_band");
        });
        WeekProposalMuscle back = tier.getMuscles().stream().filter(m -> "back".equals(m.getMuscle()))
            .findFirst().orElseThrow();
        assertThat(back.getSetsBefore()).isEqualTo(11);
        assertThat(back.getSetsAfter()).isEqualTo(9);
        assertThat(back.getTier()).isEqualTo(WeekProposalMuscle.TierEnum.MAINTAIN);

        // deciding it applies it
        WeekProposal decided = postForBody(url(meso) + "/" + tier.getId() + "/decisions",
            new WeekProposalDecisionRequest().acceptRest(true), u.headers(), HttpStatus.OK, WeekProposal.class);
        assertThat(decided.getStatus()).isEqualTo(WeekProposal.StatusEnum.APPLIED);
        assertThat(decided.getLines()).allSatisfy(l ->
            assertThat(l.getDecision()).isEqualTo(WeekProposalLine.DecisionEnum.ACCEPTED));
        assertThat(List.of(sets(mon4), sets(mon2), sets(thu3), sets(thu2))).containsExactly(2, 2, 3, 2);
        assertThat(volumeRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(u.id(), List.of(meso.getId()))
            .stream().filter(r -> "back".equals(r.getMuscle())).findFirst().orElseThrow().getCurrentSets())
            .isEqualTo(9);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    private void putPriorities(RegisteredUser u, MesocycleEntity meso, Map<String, String> priorities) {
        putForBody("/api/train/mesocycles/" + meso.getId() + "/muscle-priorities",
            MusclePrioritiesUpdateRequest.builder().musclePriorities(priorities).build(),
            u.headers(), HttpStatus.OK, MesocycleResponse.class);
    }

    private MesoWeekProposalEntity onlyPending(MesocycleEntity meso) {
        List<MesoWeekProposalEntity> pending = proposalRepository.findAll().stream()
            .filter(p -> p.getMesocycleId().equals(meso.getId()))
            .filter(p -> MesoWeekProposalEntity.STATUS_PENDING.equals(p.getStatus()))
            .sorted(Comparator.comparing(MesoWeekProposalEntity::getCreatedAt))
            .toList();
        assertThat(pending).hasSize(1);
        return pending.get(0);
    }

    private ExerciseEntity exercise(UUID owner, WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        return train.save(e);
    }

    private static String url(MesocycleEntity meso) {
        return "/api/train/mesocycles/" + meso.getId() + "/week-proposals";
    }

    private int sets(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow().getWorkingSets();
    }
}
