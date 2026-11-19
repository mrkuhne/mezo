package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.SetLegInput;
import io.mrkuhne.mezo.api.dto.SetLegKind;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SetUpdateRequest;
import io.mrkuhne.mezo.api.dto.Technique;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetLegRepository;
import io.mrkuhne.mezo.feature.train.service.MedalService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** Logging technique legs on a set through the API (mezo-r36n9.80, T2 Task 7). */
class SetLegLogIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ExerciseSetLegRepository legRepository;
    @MockitoSpyBean private MedalService medalService;
    @Autowired private io.mrkuhne.mezo.feature.train.service.PartialsBest partialsBest;
    @Autowired private io.mrkuhne.mezo.feature.train.repository.ExerciseRepository exerciseRepository;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private record Ctx(UUID owner, UUID templateId, UUID workoutId, UUID exerciseId, HttpHeaders headers) {}

    private Ctx ctx() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Leg meso", "active");
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(
            owner, meso.getId(), WorkoutServiceIT.todayLabel(), "Push", 0, "planned");
        ExerciseEntity ex = trainPopulator.createExercise(owner, day.getId(), "Press", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            WorkoutStartRequest.builder().templateSessionId(day.getId()).build(),
            headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);
        return new Ctx(owner, day.getId(), started.getId(), ex.getId(), headers);
    }

    /** Starting the same template again returns the open instance (the shared set-list builder). */
    private WorkoutInstanceResponse resume(Ctx c) {
        return postForBody("/api/train/workouts",
            WorkoutStartRequest.builder().templateSessionId(c.templateId()).build(),
            c.headers(), HttpStatus.CREATED, WorkoutInstanceResponse.class);
    }

    private static SetLegInput leg(SetLegKind kind, String weight, int reps) {
        return SetLegInput.builder().kind(kind).weightKg(new BigDecimal(weight)).reps(reps).restSec(15).build();
    }

    private SetLogRequest req(Ctx c, int index, Technique t, List<SetLegInput> legs) {
        return SetLogRequest.builder().exerciseId(c.exerciseId()).setIndex(index)
            .weightKg(new BigDecimal("80")).reps(10).rir(1).technique(t).legs(legs).build();
    }

    private ExerciseSetResponse log(Ctx c, SetLogRequest r) {
        return postForBody("/api/train/workouts/" + c.workoutId() + "/sets", r, c.headers(),
            HttpStatus.CREATED, ExerciseSetResponse.class);
    }

    private ResponseEntity<String> logRaw(Ctx c, SetLogRequest r) {
        return exchangeForResponse(HttpMethod.POST, "/api/train/workouts/" + c.workoutId() + "/sets", r, c.headers());
    }

    private String setUrl(Ctx c, UUID setId) {
        return "/api/train/workouts/" + c.workoutId() + "/sets/" + setId;
    }

    private ExerciseSetResponse update(Ctx c, UUID setId, List<SetLegInput> legs) {
        SetUpdateRequest u = SetUpdateRequest.builder().weightKg(new BigDecimal("80")).reps(10).rir(1).build();
        u.setLegs(legs);
        return putForBody(setUrl(c, setId), u, c.headers(), HttpStatus.OK, ExerciseSetResponse.class);
    }

    @Test
    void logsTechniqueWithLegs() {
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, Technique.DROP,
            List.of(leg(SetLegKind.DROP, "60", 8), leg(SetLegKind.DROP, "45", 6))));
        assertThat(r.getTechnique()).isEqualTo(Technique.DROP);
        assertThat(r.getLegs()).hasSize(2);
        assertThat(r.getLegs().get(1).getLegIndex()).isEqualTo(1);
        assertThat(r.getLegs().get(1).getWeightKg()).isEqualByComparingTo("45");
        assertThat(r.getLegs().get(0).getKind()).isEqualTo(SetLegKind.DROP);
    }

    @Test
    void legsWithoutTechniqueRejected() {
        Ctx c = ctx();
        ResponseEntity<String> res = logRaw(c, req(c, 0, null, List.of(leg(SetLegKind.DROP, "60", 8))));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(res.getBody(), "TRAIN_SET_LEGS_NEED_TECHNIQUE");
    }

    @Test
    void wrongLegKindRejected() {
        Ctx c = ctx();
        ResponseEntity<String> res = logRaw(c, req(c, 0, Technique.MYO, List.of(leg(SetLegKind.DROP, "60", 8))));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(res.getBody(), "TRAIN_SET_LEG_KIND_MISMATCH");
    }

    @Test
    void techniqueLegsThenChallengePartials_shouldLog() {
        // mezo-r36n9.98: a drop / myo set of the day's challenge ends in the half reps
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, Technique.REST_DROP,
            List.of(leg(SetLegKind.DROP, "56", 10), leg(SetLegKind.PARTIALS, "56", 7))));
        assertThat(r.getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(r.getLegs()).extracting(l -> l.getKind()).containsExactly(SetLegKind.DROP, SetLegKind.PARTIALS);

        // the challenge's number to beat reads that partials leg, in the rest-drop setup only (once completed)
        jdbcTemplate.update("update workout_session set status = 'completed' where id = ?", c.workoutId());
        ExerciseEntity press = exerciseRepository.findById(c.exerciseId()).orElseThrow();
        assertThat(partialsBest.at(c.owner(), press, new BigDecimal("80"),
            io.mrkuhne.mezo.feature.train.service.Technique.REST_DROP)).isEqualTo(7);
        assertThat(partialsBest.at(c.owner(), press, new BigDecimal("80"),
            io.mrkuhne.mezo.feature.train.service.Technique.NONE)).isNull();
        jdbcTemplate.update("update workout_session set status = 'active' where id = ?", c.workoutId());

        // the half reps only as the last leg
        ResponseEntity<String> res = logRaw(c, req(c, 1, Technique.REST_DROP,
            List.of(leg(SetLegKind.PARTIALS, "56", 7), leg(SetLegKind.DROP, "56", 10))));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(res.getBody(), "TRAIN_SET_LEG_KIND_MISMATCH");
    }

    @Test
    void tooManyLegsRejected() {
        Ctx c = ctx();
        List<SetLegInput> seven = new ArrayList<>();
        for (int i = 0; i < 7; i++) seven.add(leg(SetLegKind.MINI, "80", 3));
        ResponseEntity<String> res = logRaw(c, req(c, 0, Technique.MYO, seven));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        // the contract's maxItems (6) stops it at the door; the service re-checks as defence in depth
        assertHasFieldError(res.getBody(), "legs", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void updateWithoutLegsKeepsThem() {
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, Technique.MYO, List.of(leg(SetLegKind.MINI, "80", 4))));
        ExerciseSetResponse u = update(c, r.getId(), null);
        assertThat(u.getLegs()).hasSize(1);
        assertThat(legRepository.findByExerciseSetIdIn(List.of(r.getId()))).hasSize(1);
    }

    @Test
    void updateWithEmptyLegsClears() {
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, Technique.MYO, List.of(leg(SetLegKind.MINI, "80", 4))));
        ExerciseSetResponse u = update(c, r.getId(), List.of());
        assertThat(u.getLegs()).isEmpty();
        assertThat(legRepository.findByExerciseSetIdIn(List.of(r.getId()))).isEmpty();
    }

    @Test
    void updateReplacesLegs() {
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, Technique.DROP,
            List.of(leg(SetLegKind.DROP, "60", 8), leg(SetLegKind.DROP, "45", 6))));
        ExerciseSetResponse u = update(c, r.getId(), List.of(leg(SetLegKind.DROP, "50", 9)));
        assertThat(u.getLegs()).hasSize(1);
        assertThat(u.getLegs().get(0).getLegIndex()).isZero();
        assertThat(u.getLegs().get(0).getWeightKg()).isEqualByComparingTo("50");
        assertThat(legRepository.findByExerciseSetIdIn(List.of(r.getId()))).hasSize(1);
    }

    @Test
    void techniqueImmutableOnUpdate() {
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, Technique.MYO, List.of(leg(SetLegKind.MINI, "80", 4))));
        // the update contract has no technique; a drop leg on a myo set is judged by the LOGGED technique
        SetUpdateRequest u = SetUpdateRequest.builder().weightKg(new BigDecimal("80")).reps(10).build();
        u.setLegs(List.of(leg(SetLegKind.DROP, "60", 8)));
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.PUT, setUrl(c, r.getId()), u, c.headers());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(res.getBody(), "TRAIN_SET_LEG_KIND_MISMATCH");
        assertThat(update(c, r.getId(), null).getTechnique()).isEqualTo(Technique.MYO);
    }

    @Test
    void instanceResponseCarriesLegs() {
        Ctx c = ctx();
        log(c, req(c, 0, Technique.DROP, List.of(leg(SetLegKind.DROP, "60", 8))));
        log(c, req(c, 1, Technique.MYO, List.of(leg(SetLegKind.MINI, "80", 4), leg(SetLegKind.MINI, "80", 3))));
        log(c, req(c, 2, null, List.of()));
        WorkoutInstanceResponse w = resume(c);
        assertThat(w.getSets()).hasSize(3);
        assertThat(w.getSets().stream().mapToInt(s -> s.getLegs().size()).sum()).isEqualTo(3);
        assertThat(w.getSets().get(2).getLegs()).isEmpty();
    }

    @Test
    void deletedSetHidesLegs() {
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, Technique.DROP, List.of(leg(SetLegKind.DROP, "60", 8))));
        deleteAndExpect(setUrl(c, r.getId()), c.headers(), HttpStatus.NO_CONTENT);
        assertThat(resume(c).getSets()).isEmpty();
    }

    @Test
    void legsAreSavedBeforeTheMedalReplay() {
        Ctx c = ctx();
        AtomicInteger legsSeen = new AtomicInteger(-1);
        doAnswer(inv -> {
            UUID setId = inv.getArgument(1);
            legsSeen.set(legRepository.findByExerciseSetIdIn(List.of(setId)).size());
            return inv.callRealMethod();
        }).when(medalService).forSet(any(), any());
        log(c, req(c, 0, Technique.DROP, List.of(leg(SetLegKind.DROP, "60", 8), leg(SetLegKind.DROP, "45", 6))));
        assertThat(legsSeen.get()).isEqualTo(2);
    }

    @Test
    void explicitNullLegsOnLogAreNoLegs() {
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, null, null));
        assertThat(r.getLegs()).isEmpty();
        assertThat(legRepository.findByExerciseSetIdIn(List.of(r.getId()))).isEmpty();
    }

    @Test
    void updateLegsOnTechniquelessSetRejected() {
        Ctx c = ctx();
        ExerciseSetResponse r = log(c, req(c, 0, null, List.of()));
        SetUpdateRequest u = SetUpdateRequest.builder().weightKg(new BigDecimal("80")).reps(10).build();
        u.setLegs(List.of(leg(SetLegKind.DROP, "60", 8)));
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.PUT, setUrl(c, r.getId()), u, c.headers());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(res.getBody(), "TRAIN_SET_LEGS_NEED_TECHNIQUE");
    }

    @Test
    void warmupSetWithTechniqueIsRejected() {
        Ctx c = ctx();
        SetLogRequest r = req(c, 0, Technique.DROP, List.of(leg(SetLegKind.DROP, "60", 8)));
        r.setKind("warmup");

        ResponseEntity<String> res = logRaw(c, r);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody()).contains("TRAIN_SET_TECHNIQUE_ON_WARMUP");
    }
}
