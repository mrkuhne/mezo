package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PlannedSkipKind;
import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse.StateEnum;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.quest.QuestCatalog;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.service.QuestSelector;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** Kihagyás S1 (mezo-q4xt2.1) — gym "planned" reads honour a gym skip: readiness, quest
 *  day-typing and the proactive/companion planning reads all resolve via {@code
 *  WorkoutService#findPlannedTemplateForDateUnlessSkipped}, while {@code getToday} (the undo
 *  path) keeps resolving the day regardless of the skip. */
class PlannedSkipConsumersIT extends ApiIntegrationTest {

    @Autowired private CheckInPopulator checkIns;
    @Autowired private TrainPopulator train;
    @Autowired private QuestSelector questSelector;
    @Autowired private QuestCatalog questCatalog;

    private void soreGymMorning(UUID user) {
        var meso = train.createActiveMeso(user);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(user, meso.getId(), todayLabel);
        train.createExercise(user, day.getId(), "Guggolás", "quad", "compound");
        checkIns.createCheckIn(user, LocalDate.now(), "06:30", c -> c.setSoreness(8));
    }

    @Test
    void testReadiness_shouldBeNone_whenTodayGymSkipped() {
        RegisteredUser user = registerUser("Skip Readiness Owner");
        soreGymMorning(user.id());
        LocalDate today = LocalDate.now();

        PlannedSkipResponse skip = putForBody("/api/train/skips", new PlannedSkipRequest()
                .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            user.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        ReadinessTodayResponse afterSkip = getForBody(
            "/api/train/readiness/today", user.headers(), HttpStatus.OK, ReadinessTodayResponse.class);
        assertThat(afterSkip.getState()).isEqualTo(StateEnum.NONE);

        deleteAndExpect("/api/train/skips/" + skip.getId(), user.headers(), HttpStatus.NO_CONTENT);

        ReadinessTodayResponse afterUndo = getForBody(
            "/api/train/readiness/today", user.headers(), HttpStatus.OK, ReadinessTodayResponse.class);
        assertThat(afterUndo.getState()).isEqualTo(StateEnum.OFFER);
    }

    @Test
    void testWorkoutToday_shouldStillResolve_whenTodayGymSkipped() {
        RegisteredUser user = registerUser("Skip Workout Undo Owner");
        soreGymMorning(user.id());
        LocalDate today = LocalDate.now();

        putForBody("/api/train/skips", new PlannedSkipRequest()
                .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            user.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        WorkoutTodayResponse todayWorkout = getForBody(
            "/api/train/workouts/today", user.headers(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(todayWorkout.getDayLabel()).isNotNull();
        assertThat(todayWorkout.getExercises()).isNotEmpty();
    }

    @Test
    void testQuest_shouldUseRestDayType_whenGymSkipped() {
        RegisteredUser user = registerUser("Skip Quest Owner");
        soreGymMorning(user.id());
        LocalDate today = LocalDate.now();

        putForBody("/api/train/skips", new PlannedSkipRequest()
                .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            user.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        List<DailyQuestEntity> quests = questSelector.generate(user.id(), today);

        assertThat(quests).isNotEmpty();
        for (DailyQuestEntity quest : quests) {
            QuestCatalog.QuestDef def = questCatalog.all().stream()
                .filter(d -> d.key().equals(quest.getCatalogKey()))
                .findFirst().orElseThrow();
            assertThat(def.dayTypes()).anyMatch(t -> t.equals("REST") || t.equals("ANY"));
        }
    }
}
