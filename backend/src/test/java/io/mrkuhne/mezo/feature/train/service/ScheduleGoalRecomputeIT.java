package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.api.dto.GymScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotInput;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the train-owned {@link GoalRecomputePort} seam (ADR 0012, mezo-3g5w): every schedule
 * mutation trigger site ({@code SportService.replaceSchedule}, {@code GymScheduleService.replaceSchedule},
 * {@code RunningService.activateBlock}/{@code closeBlock}/{@code deleteBlock}) recomputes the owner's
 * ACTIVE goal prescription, since the weekly EAT is schedule-derived and would otherwise go stale.
 * Must stay graceful when no goal is active — a schedule edit never depends on having a goal.
 */
@Transactional
class ScheduleGoalRecomputeIT extends AbstractIntegrationTest {

    @Autowired private SportService sportService;
    @Autowired private GymScheduleService gymScheduleService;
    @Autowired private RunningService runningService;
    @Autowired private GoalEngineService goalEngineService;
    @Autowired private GoalRepository goalRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private RunningPopulator runningPopulator;

    private UUID owner;
    private UUID goalId;

    @BeforeEach
    void seedOwnerWithActiveGoal() {
        owner = databasePopulator.populateUser("schedule-recompute@test.local");
        profilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.of(2026, 6, 1), new BigDecimal("84.00"));
        goalId = goalPopulator.createGoal(owner, "active").getId();
    }

    private OffsetDateTime prescriptionGeneratedAt() {
        return goalRepository.findById(goalId).orElseThrow().getPrescription().generatedAt();
    }

    private UUID seedOwnerWithoutGoal() {
        return databasePopulator.populateUser("schedule-lonely@test.local");
    }

    private UUID seedRunningBlock(UUID user) {
        return runningPopulator.createBlock(user, "Alapozó blokk", "planned").getId();
    }

    @Test
    void testReplaceSportSchedule_shouldRecomputeActiveGoalPrescription_whenScheduleChanges() {
        // given an evaluated active goal (prescription generated at T0)
        goalEngineService.evaluate(owner, goalId);
        OffsetDateTime before = prescriptionGeneratedAt();

        // when the weekly sport schedule gains a 90-minute slot (weekly EAT changes)
        SportScheduleSlotInput slot = new SportScheduleSlotInput();
        slot.setDayOfWeek(2);
        slot.setTime("18:00");
        slot.setDurationMin(90);
        slot.setKind("training");
        sportService.replaceSchedule(owner, List.of(slot));

        // then the prescription was regenerated (newer generatedAt) — the EAT is no longer stale
        OffsetDateTime after = prescriptionGeneratedAt();
        assertThat(after).isAfter(before);
    }

    @Test
    void testReplaceSportSchedule_shouldNotThrow_whenNoActiveGoal() {
        // a schedule edit must never depend on having a goal (mirrors the weigh-in rule)
        UUID lonely = seedOwnerWithoutGoal();
        SportScheduleSlotInput slot = new SportScheduleSlotInput();
        slot.setDayOfWeek(3);
        slot.setTime("07:00");
        slot.setDurationMin(60);
        slot.setKind("training");

        assertThatCode(() -> sportService.replaceSchedule(lonely, List.of(slot)))
            .doesNotThrowAnyException();
    }

    @Test
    void testGymScheduleAndRunningLifecycle_shouldRecompute_whenMutated() {
        goalEngineService.evaluate(owner, goalId);
        OffsetDateTime t0 = prescriptionGeneratedAt();

        GymScheduleSlotInput gym = new GymScheduleSlotInput();
        gym.setDayOfWeek(1);
        gym.setTime("17:00");
        gymScheduleService.replaceSchedule(owner, List.of(gym));
        OffsetDateTime t1 = prescriptionGeneratedAt();
        assertThat(t1).isAfter(t0);

        UUID blockId = seedRunningBlock(owner); // planned block, copy the running IT seeding idiom
        runningService.activateBlock(owner, blockId);
        OffsetDateTime t2 = prescriptionGeneratedAt();
        assertThat(t2).isAfter(t1);

        runningService.closeBlock(owner, blockId);
        OffsetDateTime t3 = prescriptionGeneratedAt();
        assertThat(t3).isAfter(t2);
    }
}
