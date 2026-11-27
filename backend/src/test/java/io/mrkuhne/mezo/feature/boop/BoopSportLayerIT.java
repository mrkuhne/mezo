package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.boop.service.BoopDay;
import io.mrkuhne.mezo.feature.boop.service.BoopDayAssembler;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WearableWorkoutPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Boop Sport S1 (mezo-r36n9.201): gym and sport are two layers on the same day — logging one never ticks the
 * other. The day: a gym session at 07:00 and a volleyball slot at 18:00 (a Tuesday).
 */
@Transactional
class BoopSportLayerIT extends AbstractIntegrationTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
    /** A Tuesday ("Kedd", schedule dayOfWeek 1). */
    private static final LocalDate DAY = LocalDate.parse("2026-11-10");

    @Autowired private BoopDayAssembler assembler;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator train;
    @Autowired private WearableWorkoutPopulator workoutPopulator;
    @Autowired private WearableWorkoutRepository wearableWorkouts;
    @Autowired private WorkoutSessionRepository workoutSessions;

    @Test
    void plannedDayCarriesBothLayersNotDone() {
        UUID user = gymAndVolleyballDay("layer0@test.local");

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.session()).isNotNull();
        assertThat(day.session().done()).isFalse();
        assertThat(day.sport()).singleElement().satisfies(s -> {
            assertThat(s.sport()).isEqualTo("volleyball");
            assertThat(s.time()).isEqualTo(LocalTime.of(18, 0));
            assertThat(s.minutes()).isEqualTo(90);
            assertThat(s.done()).isFalse();
        });
    }

    @Test
    void loggedVolleyballTicksTheSportNotTheGym() {
        UUID user = gymAndVolleyballDay("layer1@test.local");
        train.createSportSession(user, DAY, "volleyball", 4, null, "7"); // 18:00, 60 min

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.session().done()).isFalse();
        assertThat(day.sport()).singleElement().satisfies(s -> {
            assertThat(s.done()).isTrue();
            assertThat(s.doneMinutes()).isEqualTo(60);
        });
    }

    @Test
    void finishedGymTicksTheGymNotTheSport() {
        UUID user = gymAndVolleyballDay("layer2@test.local");
        var instance = train.createWorkoutInstance(user, kedd, DAY, "completed");
        instance.setStartedAt(local(7, 0));
        instance.setFinishedAt(local(8, 10));
        workoutSessions.saveAndFlush(instance);

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.session().done()).isTrue();
        assertThat(day.sport()).singleElement().satisfies(s -> assertThat(s.done()).isFalse());
    }

    @Test
    void volleyballHealthWorkoutTicksTheSportNotTheGym() {
        UUID user = gymAndVolleyballDay("layer3@test.local");
        var w = workoutPopulator.createWorkout(user, "hk-v1", DAY, "volleyball", local(18, 5), local(19, 35));
        w.setAvgHr(141);
        wearableWorkouts.saveAndFlush(w);

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.session().done()).isFalse();
        assertThat(day.sport()).singleElement().satisfies(s -> {
            assertThat(s.done()).isTrue();
            assertThat(s.doneMinutes()).isEqualTo(90);
            assertThat(s.avgHr()).isEqualTo(141);
        });
    }

    @Test
    void strengthHealthWorkoutTicksTheGymNotTheSport() {
        UUID user = gymAndVolleyballDay("layer4@test.local");
        workoutPopulator.createWorkout(user, "hk-s1", DAY, "strength", local(7, 0), local(8, 10));

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.session().done()).isTrue();
        assertThat(day.session().doneMinutes()).isEqualTo(70);
        assertThat(day.sport()).singleElement().satisfies(s -> assertThat(s.done()).isFalse());
    }

    @Test
    void lateGymAndVolleyballCloseTogetherStayApart() {
        // gym 17:00 and volleyball 18:00 — the volleyball workout overlaps the gym's ±2 h window but is not gym.
        UUID user = databasePopulator.populateUser("layer5@test.local");
        plannedKedd(user, "17:00");
        volleyballSlot(user);
        workoutPopulator.createWorkout(user, "hk-v2", DAY, "volleyball", local(18, 0), local(19, 30));

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.session().done()).isFalse();
        assertThat(day.sport()).singleElement().satisfies(s -> assertThat(s.done()).isTrue());
    }

    @Test
    void sportOnlyDayHasNoGymSession() {
        UUID user = databasePopulator.populateUser("layer6@test.local");
        volleyballSlot(user);

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.session()).isNull();
        assertThat(day.sport()).hasSize(1);
    }

    @Test
    void oneRunWorkoutTicksOnlyOneOfTwoRuns() {
        // review finding: a logged run must claim its Health workout, so a later unlogged run is not ticked by it.
        UUID user = databasePopulator.populateUser("layer7@test.local");
        var early = train.createScheduleSlot(user, 1, "07:00", 45, "training");
        early.setSport("running");
        var late = train.createScheduleSlot(user, 1, "08:30", 45, "training");
        late.setSport("running");
        train.createSportSession(user, DAY, "running", null, null, "6").setTime("07:00");
        var w = workoutPopulator.createWorkout(user, "hk-r1", DAY, "running", local(7, 0), local(7, 45));
        w.setAvgHr(150);
        wearableWorkouts.saveAndFlush(w);

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.sport()).hasSize(2);
        assertThat(day.sport().get(0).done()).isTrue();
        assertThat(day.sport().get(0).avgHr()).isEqualTo(150);
        assertThat(day.sport().get(1).done()).isFalse();
    }

    @Test
    void oneIntervalWorkoutBehindTheGymLogDoesNotTickCross() {
        UUID user = databasePopulator.populateUser("layer8@test.local");
        var session = plannedKedd(user, "17:00");
        var cross = train.createScheduleSlot(user, 1, "19:00", 60, "training");
        cross.setSport("cross");
        var instance = train.createWorkoutInstance(user, session, DAY, "completed");
        instance.setStartedAt(local(17, 0));
        instance.setFinishedAt(local(18, 0));
        workoutSessions.saveAndFlush(instance);
        workoutPopulator.createWorkout(user, "hk-h1", DAY, "hiit", local(17, 0), local(18, 0));

        BoopDay day = assembler.assemble(user, DAY);

        assertThat(day.session().done()).isTrue();
        assertThat(day.sport()).singleElement().satisfies(s -> assertThat(s.done()).isFalse());
    }

    @Test
    void lateSlotCrossingMidnightKeepsPositiveMinutes() {
        UUID user = databasePopulator.populateUser("layer9@test.local");
        train.createScheduleSlot(user, 1, "22:30", 90, "training");

        assertThat(assembler.assemble(user, DAY).sport()).singleElement()
            .satisfies(s -> assertThat(s.minutes()).isEqualTo(90));
    }

    private io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity kedd;

    private UUID gymAndVolleyballDay(String email) {
        UUID user = databasePopulator.populateUser(email);
        kedd = plannedKedd(user, "07:00");
        volleyballSlot(user);
        return user;
    }

    private io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity plannedKedd(UUID user, String time) {
        var meso = train.createActiveMeso(user);
        var session = train.createWorkoutSession(user, meso.getId(), "Kedd", "Legs 1", 1, "active");
        train.createExercise(user, session.getId(), "Guggolás", 0);
        train.createGymSlot(user, 1, time);
        return session;
    }

    private void volleyballSlot(UUID user) {
        train.createScheduleSlot(user, 1, "18:00", 90, "training"); // sport defaults to volleyball
    }

    private static Instant local(int hour, int minute) {
        return LocalDateTime.of(DAY, LocalTime.of(hour, minute)).atZone(BUDAPEST).toInstant();
    }
}
