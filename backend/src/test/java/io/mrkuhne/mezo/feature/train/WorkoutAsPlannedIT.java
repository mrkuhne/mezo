package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.WorkoutAsPlannedOverride;
import io.mrkuhne.mezo.api.dto.WorkoutAsPlannedRequest;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

/**
 * The gym catch-up (Boop, mezo-r36n9.161): a past template day booked as completed with the plan's prescribed
 * sets — dated the given day, the sets done at the given start, no invented duration; idempotent on the client
 * ref; the week guard judged in the GIVEN date's Mon–Sun week.
 */
@Transactional
class WorkoutAsPlannedIT extends AbstractIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");
    /** Read once, like {@code CrossDayWorkoutIT}: every date below derives from it. */
    private static final LocalDate TODAY = LocalDate.now(ZONE);

    @Autowired private WorkoutService workoutService;
    @Autowired private TrainPopulator train;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private WorkoutSessionRepository workoutSessions;
    @Autowired private ExerciseSetRepository exerciseSets;
    @Autowired private MesocycleRepository mesocycles;

    private static LocalDate monday() {
        return TODAY.minusDays(TODAY.getDayOfWeek().getValue() - 1L);
    }

    /** A day of the current Mon–Sun week inside the window: yesterday, or today itself on a Monday. */
    private static LocalDate bookDate() {
        return TODAY.getDayOfWeek() == DayOfWeek.MONDAY ? TODAY : TODAY.minusDays(1);
    }

    private static OffsetDateTime at(LocalDate day, int hour) {
        return day.atTime(hour, 0).atZone(ZONE).toOffsetDateTime();
    }

    private static String label(LocalDate day) {
        return WorkoutService.HU_DAY_LABELS.get(day.getDayOfWeek().getValue() - 1);
    }

    /** The fixture: an active block, a template day with two prescribed exercises (history last week) and one without. */
    private record Fixture(UUID user, WorkoutSessionEntity day, ExerciseEntity row, ExerciseEntity curl, ExerciseEntity facePull) {}

    private Fixture fixture() {
        UUID user = databasePopulator.populateUser("asplanned@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        WorkoutSessionEntity day = train.createWorkoutSession(user, meso.getId(), label(bookDate()), "Pull Day", 0, "planned");
        ExerciseEntity row = train.createExercise(user, day.getId(), "Evezés", 0);
        ExerciseEntity curl = train.createExercise(user, day.getId(), "Bicepsz", 1);
        ExerciseEntity facePull = train.createExercise(user, day.getId(), "Face pull", 2);
        // Last week's completed instance gives the row and the curl a prescription; the face pull has no history.
        WorkoutSessionEntity history = train.completedInstanceWithWorkingSet(user, day.getId(), row.getId(), new BigDecimal("60"), 8, 1);
        train.createLoggedSet(user, curl.getId(), history.getId(), 0, "14", 12, 1);
        history.setDate(monday().minusDays(7));
        train.save(history);
        return new Fixture(user, day, row, curl, facePull);
    }

    private static WorkoutAsPlannedRequest request(Fixture f, LocalDate date, List<WorkoutAsPlannedOverride> overrides) {
        return WorkoutAsPlannedRequest.builder()
            .templateSessionId(f.day().getId()).date(date).startedAt(at(date, 18))
            .clientRef(UUID.randomUUID()).overrides(overrides).build();
    }

    private static List<ExerciseSetResponse> setsOf(WorkoutInstanceResponse r, UUID exerciseId) {
        return r.getSets().stream().filter(s -> s.getExerciseId().equals(exerciseId)).toList();
    }

    @Test
    void booksThePastDayAsPlanned() {
        Fixture f = fixture();
        LocalDate date = bookDate();

        WorkoutInstanceResponse r = workoutService.completeAsPlanned(f.user(), request(f, date, List.of()));

        assertThat(r.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        assertThat(r.getDate()).isEqualTo(date);
        assertThat(r.getStartedAt().toInstant()).isEqualTo(at(date, 18).toInstant());
        assertThat(r.getFinishedAt().toInstant()).isEqualTo(at(date, 18).toInstant());
        List<ExerciseSetResponse> rowSets = setsOf(r, f.row().getId());
        assertThat(rowSets).hasSize(3);
        assertThat(rowSets).allSatisfy(s -> {
            assertThat(s.getKind()).isEqualTo(ExerciseSetResponse.KindEnum.WORKING);
            assertThat(s.getWeightKg()).isNotNull();
            assertThat(s.getReps()).isNotNull();
            assertThat(s.getSkipped()).isFalse();
            assertThat(s.getDoneAt().toInstant()).isEqualTo(at(date, 18).toInstant());
        });
        assertThat(setsOf(r, f.curl().getId())).hasSize(3);
        // No prescription, no typed weight: one skip marker, no working set, never a zero weight.
        List<ExerciseSetEntity> facePull = exerciseSets
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(f.user(), r.getId()).stream()
            .filter(s -> s.getExerciseId().equals(f.facePull().getId())).toList();
        assertThat(facePull).hasSize(1);
        assertThat(facePull.get(0).isSkipped()).isTrue();
        WorkoutSessionEntity saved = workoutSessions.findById(r.getId()).orElseThrow();
        assertThat(saved.getActiveSeconds()).isNull();
        assertThat(saved.getStatus()).isEqualTo("completed");
    }

    @Test
    void anOverrideReplacesTheWeightOfEverySetOfThatExercise() {
        Fixture f = fixture();
        WorkoutAsPlannedOverride override = WorkoutAsPlannedOverride.builder()
            .exerciseId(f.row().getId()).weightKg(new BigDecimal("62.5")).build();

        WorkoutInstanceResponse r = workoutService.completeAsPlanned(f.user(), request(f, bookDate(), List.of(override)));

        assertThat(setsOf(r, f.row().getId())).hasSize(3)
            .allSatisfy(s -> assertThat(s.getWeightKg()).isEqualByComparingTo("62.5"));
    }

    @Test
    void aTypedWeightBooksAnUnprescribedExercise() {
        Fixture f = fixture();
        WorkoutAsPlannedOverride override = WorkoutAsPlannedOverride.builder()
            .exerciseId(f.facePull().getId()).weightKg(new BigDecimal("20")).build();

        WorkoutInstanceResponse r = workoutService.completeAsPlanned(f.user(), request(f, bookDate(), List.of(override)));

        List<ExerciseSetResponse> sets = setsOf(r, f.facePull().getId());
        assertThat(sets).hasSize(3).allSatisfy(s -> {
            assertThat(s.getWeightKg()).isEqualByComparingTo("20");
            // The prescription still names the reps (the plan's range) even with no weight to anchor to.
            assertThat(s.getReps()).isBetween(6, 8);
            assertThat(s.getSkipped()).isFalse();
        });
    }

    @Test
    void aRetryWithTheSameClientRefReturnsTheSameInstance() {
        Fixture f = fixture();
        WorkoutAsPlannedRequest req = request(f, bookDate(), List.of());

        WorkoutInstanceResponse first = workoutService.completeAsPlanned(f.user(), req);
        WorkoutInstanceResponse again = workoutService.completeAsPlanned(f.user(), req);

        assertThat(again.getId()).isEqualTo(first.getId());
        assertThat(workoutSessions.findByCreatedByAndDateOrderByCreatedAtAsc(f.user(), bookDate())).hasSize(1);
    }

    @Test
    void theWindowIsTodayMinusSevenToToday() {
        Fixture f = fixture();

        assertThatThrownBy(() -> workoutService.completeAsPlanned(f.user(), request(f, TODAY.minusDays(8), List.of())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_AS_PLANNED_DATE_OUT_OF_WINDOW");
        assertThatThrownBy(() -> workoutService.completeAsPlanned(f.user(), request(f, TODAY.plusDays(1), List.of())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_AS_PLANNED_DATE_OUT_OF_WINDOW");
    }

    @Test
    void aLiveWorkoutBlocksTheBooking() {
        Fixture f = fixture();
        workoutService.startWorkout(f.user(), WorkoutStartRequest.builder().templateSessionId(f.day().getId()).build());

        assertThatThrownBy(() -> workoutService.completeAsPlanned(f.user(), request(f, bookDate(), List.of())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_WORKOUT_OPEN_ELSEWHERE");
    }

    @Test
    void theWeekIsJudgedByTheDate() {
        Fixture f = fixture();
        // Last week already holds a completed instance of this day (the history fixture): booking another day of
        // LAST week is refused, booking this week is fine.
        LocalDate lastSunday = monday().minusDays(1);

        assertThatThrownBy(() -> workoutService.completeAsPlanned(f.user(), request(f, lastSunday, List.of())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_DAY_DONE_THIS_WEEK");
        assertThat(workoutService.completeAsPlanned(f.user(), request(f, bookDate(), List.of())).getDate()).isEqualTo(bookDate());
    }

    @Test
    void aTemplateOutsideTheOwnersBlockIsNotFound() {
        Fixture f = fixture();
        WorkoutAsPlannedRequest req = WorkoutAsPlannedRequest.builder()
            .templateSessionId(UUID.randomUUID()).date(bookDate()).startedAt(at(bookDate(), 18))
            .clientRef(UUID.randomUUID()).overrides(List.of()).build();

        assertThatThrownBy(() -> workoutService.completeAsPlanned(f.user(), req))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    /** Review Focus 4: a template day of a block that is no longer active (rotated, ended) is not bookable — 404. */
    @Test
    void aTemplateDayOfAnArchivedBlockIsNotFound() {
        Fixture f = fixture();
        MesocycleEntity meso = mesocycles.findByCreatedByAndStatusAndDeletedFalse(f.user(), "active").get(0);
        meso.setStatus("archived");
        mesocycles.save(meso);

        assertThatThrownBy(() -> workoutService.completeAsPlanned(f.user(), request(f, bookDate(), List.of())))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }
}
