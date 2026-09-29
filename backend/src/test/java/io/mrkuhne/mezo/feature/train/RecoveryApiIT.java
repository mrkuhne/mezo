package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.RecoveryCheckInRequest;
import io.mrkuhne.mezo.api.dto.RecoveryEstimate;
import io.mrkuhne.mezo.api.dto.RecoveryReleaseRequest;
import io.mrkuhne.mezo.api.dto.RecoveryReturnRule;
import io.mrkuhne.mezo.api.dto.RecoveryState;
import io.mrkuhne.mezo.api.dto.RecoveryUpsertRequest;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RecoveryPeriodRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

/** HTTP round-trip through the GENERATED recovery API (Kihagyás S2 "kímélő mód", mezo-q4xt2.2,
 *  api/feature/train/train-recovery.yml) — open, check-in, the return rule's meso shift, undo,
 *  released days and owner isolation. Every test uses a freshly registered user so the demodata
 *  owner's seeded meso never interferes. */
class RecoveryApiIT extends ApiIntegrationTest {

    private static final String URL = "/api/train/recovery";
    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");
    private static final List<String> CURVE = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired private TrainPopulator train;
    @Autowired private RecoveryPeriodPopulator recoveryPopulator;
    @Autowired private RecoveryPeriodRepository periodRepository;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private MuscleGroupVolumeLogRepository volumeRepository;

    /** Per test, never a class-load constant (midnight-fragile fixtures). */
    private static LocalDate today() {
        return LocalDate.now(TZ);
    }

    private static RecoveryUpsertRequest upsert(PlannedSkipReason category, RecoveryEstimate estimate) {
        return new RecoveryUpsertRequest().category(category).estimate(estimate);
    }

    private static RecoveryCheckInRequest answer(RecoveryCheckInRequest.AnswerEnum a) {
        return new RecoveryCheckInRequest().answer(a);
    }

    @Test
    void testUpsert_shouldOpenPeriodAndProtectDates_whenIllnessFewDays() {
        RegisteredUser u = registerUser("Recovery Open");
        LocalDate today = today();

        RecoveryState s = putForBody(URL, upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.FEW_DAYS),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(s.getPeriod()).isNotNull();
        assertThat(s.getPeriod().getStartDate()).isEqualTo(today);
        assertThat(s.getPeriod().getExpectedEnd()).isEqualTo(today.plusDays(2));
        assertThat(s.getPeriod().getDayIndex()).isEqualTo(1);
        assertThat(s.getPeriod().getEndedOn()).isNull();
        for (int i = 0; i <= 13; i++) {
            assertThat(s.getProtectedDates()).contains(today.plusDays(i));
        }
        assertThat(s.getProtectedDates()).doesNotContain(today.minusDays(1), today.plusDays(14));
    }

    @Test
    void testUpsert_shouldUpdateInPlace_whenPeriodAlreadyOpen() {
        RegisteredUser u = registerUser("Recovery Update");
        LocalDate start = today().minusDays(2);
        RecoveryState first = putForBody(URL,
            upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.FEW_DAYS).startDate(start),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        RecoveryState second = putForBody(URL, upsert(PlannedSkipReason.STOMACH, RecoveryEstimate.WEEK),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(second.getPeriod().getId()).isEqualTo(first.getPeriod().getId());
        assertThat(second.getPeriod().getStartDate()).isEqualTo(start);
        assertThat(second.getPeriod().getCategory()).isEqualTo(PlannedSkipReason.STOMACH);
        assertThat(second.getPeriod().getEstimate()).isEqualTo(RecoveryEstimate.WEEK);
        assertThat(second.getPeriod().getExpectedEnd()).isEqualTo(start.plusDays(6));
    }

    @Test
    void testUpsert_shouldReturn400_whenCategoryNotSerious() {
        RegisteredUser u = registerUser("Recovery Tired");

        String body = putForBody(URL, upsert(PlannedSkipReason.TIRED, RecoveryEstimate.FEW_DAYS),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_RECOVERY_CATEGORY_INVALID");
    }

    @Test
    void testCheckIn_shouldMarkCheckedInAndStayOpen_whenNotYet() {
        RegisteredUser u = registerUser("Recovery NotYet");
        putForBody(URL, upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.UNKNOWN).startDate(today().minusDays(1)),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        RecoveryState s = postForBody(URL + "/check-in", answer(RecoveryCheckInRequest.AnswerEnum.NOT_YET),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(s.getPeriod().getCheckedInToday()).isTrue();
        assertThat(s.getPeriod().getEndedOn()).isNull();
    }

    @Test
    void testCheckIn_shouldReturn400_whenBetterOnStartDay() {
        RegisteredUser u = registerUser("Recovery TooEarly");
        putForBody(URL, upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.TODAY),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        String body = postForBody(URL + "/check-in", answer(RecoveryCheckInRequest.AnswerEnum.BETTER),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_RECOVERY_TOO_EARLY");
    }

    @Test
    void testCheckIn_shouldReturn404_whenNoOpenPeriod() {
        RegisteredUser u = registerUser("Recovery None");

        String body = postForBody(URL + "/check-in", answer(RecoveryCheckInRequest.AnswerEnum.NOT_YET),
            u.headers(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "TRAIN_RECOVERY_NOT_FOUND");
    }

    @Test
    void testBetter_shouldResumeAndShiftMesoAWeek_thenUndoRestoresExactly() {
        RegisteredUser u = registerUser("Recovery Resume");
        LocalDate today = today();
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(u.id(), 3, 6, 4, CURVE);
        LocalDate origStart = meso.getStartDate();
        LocalDate origEnd = meso.getEndDate();
        putForBody(URL, upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.FEW_DAYS).startDate(today.minusDays(4)),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        RecoveryState better = postForBody(URL + "/check-in", answer(RecoveryCheckInRequest.AnswerEnum.BETTER),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(better.getPeriod().getEndedOn()).isEqualTo(today);
        assertThat(better.getPeriod().getReturn()).isNotNull();
        assertThat(better.getPeriod().getReturn().getRule()).isEqualTo(RecoveryReturnRule.RESUME);
        assertThat(better.getPeriod().getReturn().getDaysOut()).isEqualTo(4);
        assertThat(better.getPeriod().getReturn().getRampSessions()).isEqualTo(2);
        assertThat(better.getPeriod().getReturn().getShiftDays()).isEqualTo(7);
        assertThat(better.getPeriod().getReturn().getNewEndDate()).isEqualTo(origEnd.plusDays(7));
        assertThat(better.getComeback()).isNotNull();
        assertThat(better.getComeback().getTotal()).isEqualTo(2);
        assertThat(better.getComeback().getDone()).isZero();
        MesocycleEntity shifted = mesocycleRepository.findById(meso.getId()).orElseThrow();
        assertThat(shifted.getStartDate()).isEqualTo(origStart.plusDays(7));
        assertThat(shifted.getEndDate()).isEqualTo(origEnd.plusDays(7));
        assertThat(shifted.getCurrentWeek()).isEqualTo(3); // the week the illness started in

        RecoveryState undone = postForBody(URL + "/undo-better", null, u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(undone.getPeriod().getEndedOn()).isNull();
        assertThat(undone.getPeriod().getReturn()).isNull();
        assertThat(undone.getComeback()).isNull();
        MesocycleEntity restored = mesocycleRepository.findById(meso.getId()).orElseThrow();
        assertThat(restored.getStartDate()).isEqualTo(origStart);
        assertThat(restored.getEndDate()).isEqualTo(origEnd);
        assertThat(restored.getCurrentWeek()).isEqualTo(4);
    }

    @Test
    void testUndoBetter_shouldReturn409_whenNothingEndedToday() {
        RegisteredUser u = registerUser("Recovery UndoExpired");
        recoveryPopulator.ended(u.id(), Reason.ILLNESS, today().minusDays(6), today().minusDays(1));

        String body = postForBody(URL + "/undo-better", null, u.headers(), HttpStatus.CONFLICT, String.class);

        assertHasRequestError(body, "TRAIN_RECOVERY_UNDO_EXPIRED");
    }

    @Test
    void testBetter_shouldStepBackAndLowerSets_thenUndoRestoresSets() {
        RegisteredUser u = registerUser("Recovery StepBack");
        LocalDate today = today();
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(u.id(), 3, 6, 4, CURVE);
        train.createVolumeLog(u.id(), meso.getId(), "chest", 14); // mev 8
        recoveryPopulator.open(u.id(), Reason.INJURY, today.minusDays(12), Estimate.UNKNOWN);

        RecoveryState better = postForBody(URL + "/check-in", answer(RecoveryCheckInRequest.AnswerEnum.BETTER),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(better.getPeriod().getReturn().getRule()).isEqualTo(RecoveryReturnRule.STEP_BACK);
        // illness started in meso week 2 → target week 1 → today (week 4) moves back 3 weeks
        assertThat(better.getPeriod().getReturn().getShiftDays()).isEqualTo(21);
        MesocycleEntity shifted = mesocycleRepository.findById(meso.getId()).orElseThrow();
        assertThat(shifted.getCurrentWeek()).isEqualTo(1);
        assertThat(shifted.getVolumeRecompute().lastRun()).isEqualTo("W1");
        assertThat(chest(u, meso).getCurrentSets()).isEqualTo(12);

        postForBody(URL + "/undo-better", null, u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(chest(u, meso).getCurrentSets()).isEqualTo(14);
        MesocycleEntity restored = mesocycleRepository.findById(meso.getId()).orElseThrow();
        assertThat(restored.getCurrentWeek()).isEqualTo(4);
        assertThat(restored.getStartDate()).isEqualTo(meso.getStartDate());
    }

    @Test
    void testDelete_shouldRevertShiftAndHidePeriod_whenEndedToday() {
        RegisteredUser u = registerUser("Recovery Delete");
        LocalDate today = today();
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(u.id(), 3, 6, 4, CURVE);
        putForBody(URL, upsert(PlannedSkipReason.TRAVEL, RecoveryEstimate.WEEK).startDate(today.minusDays(4)),
            u.headers(), HttpStatus.OK, RecoveryState.class);
        postForBody(URL + "/check-in", answer(RecoveryCheckInRequest.AnswerEnum.BETTER),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        deleteAndExpect(URL, u.headers(), HttpStatus.NO_CONTENT);

        RecoveryState s = getForBody(URL, u.headers(), HttpStatus.OK, RecoveryState.class);
        assertThat(s.getPeriod()).isNull();
        assertThat(s.getProtectedDates()).isEmpty();
        MesocycleEntity restored = mesocycleRepository.findById(meso.getId()).orElseThrow();
        assertThat(restored.getStartDate()).isEqualTo(meso.getStartDate());
        assertThat(restored.getEndDate()).isEqualTo(meso.getEndDate());
        deleteAndExpect(URL, u.headers(), HttpStatus.NOT_FOUND);
    }

    @Test
    void testRelease_shouldUnprotectToday_thenUnreleaseProtectsAgain() {
        RegisteredUser u = registerUser("Recovery Release");
        LocalDate today = today();
        putForBody(URL, upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.FEW_DAYS),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        RecoveryState released = putForBody(URL + "/releases/" + today, new RecoveryReleaseRequest().lighten(false),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(released.getProtectedDates()).doesNotContain(today).contains(today.plusDays(1));
        assertThat(released.getPeriod().getReleasedDates()).containsExactly(today);
        assertThat(released.getPeriod().getReleasedUnlightened()).containsExactly(today);

        RecoveryState back = exchangeForBody(HttpMethod.DELETE, URL + "/releases/" + today, null,
            u.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(back.getProtectedDates()).contains(today);
        assertThat(back.getPeriod().getReleasedDates()).isEmpty();
    }

    @Test
    void testRelease_shouldReturn400_whenDateNotProtected() {
        RegisteredUser u = registerUser("Recovery ReleaseOutside");
        putForBody(URL, upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.FEW_DAYS),
            u.headers(), HttpStatus.OK, RecoveryState.class);

        String body = putForBody(URL + "/releases/" + today().minusDays(1), new RecoveryReleaseRequest(),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_RECOVERY_DATE_NOT_PROTECTED");
    }

    @Test
    void testUpsert_shouldKeepOneRow_whenTwoParallelOpens() throws Exception {
        RegisteredUser u = registerUser("Recovery Race");
        Callable<HttpStatusCode> call = () -> exchangeForResponse(HttpMethod.PUT, URL,
            upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.FEW_DAYS), u.headers()).getStatusCode();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<HttpStatusCode> a = pool.submit(call);
            Future<HttpStatusCode> b = pool.submit(call);
            assertThat(a.get()).isEqualTo(HttpStatus.OK);
            assertThat(b.get()).isEqualTo(HttpStatus.OK);
        } finally {
            pool.shutdown();
        }

        assertThat(periodRepository.findByCreatedByAndStartDateLessThanEqualAndDeletedFalse(u.id(), today()))
            .hasSize(1);
    }

    @Test
    void testGet_shouldNeverShowAnotherUsersPeriod() {
        RegisteredUser a = registerUser("Recovery OwnerA");
        RegisteredUser b = registerUser("Recovery OwnerB");
        putForBody(URL, upsert(PlannedSkipReason.ILLNESS, RecoveryEstimate.FEW_DAYS),
            a.headers(), HttpStatus.OK, RecoveryState.class);

        RecoveryState s = getForBody(URL, b.headers(), HttpStatus.OK, RecoveryState.class);

        assertThat(s.getPeriod()).isNull();
        assertThat(s.getProtectedDates()).isEmpty();
        assertThat(s.getComeback()).isNull();
        postForBody(URL + "/check-in", answer(RecoveryCheckInRequest.AnswerEnum.NOT_YET),
            b.headers(), HttpStatus.NOT_FOUND, String.class);
        deleteAndExpect(URL, b.headers(), HttpStatus.NOT_FOUND);
    }

    @Test
    void testRecovery_shouldReturn401_whenUnauthenticated() {
        getForBody(URL, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    private MuscleGroupVolumeLogEntity chest(RegisteredUser u, MesocycleEntity meso) {
        return volumeRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(u.id(), List.of(meso.getId()))
            .stream().filter(v -> v.getMuscle().equals("chest")).findFirst().orElseThrow();
    }
}
