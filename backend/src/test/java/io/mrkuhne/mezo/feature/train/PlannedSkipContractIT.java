package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PlannedSkipKind;
import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.feature.train.service.SportSlotSkipService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.SportSlotSkipPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trip through the GENERATED planned-skips API (Kihagyás S1, mezo-q4xt2.1,
 *  api/feature/train/train-skip.yml) — upsert, undo and the read-time verdict list. */
class PlannedSkipContractIT extends ApiIntegrationTest {

    @Autowired private SportSlotSkipPopulator sportSlotSkipPopulator;
    @Autowired private SportSlotSkipService sportSlotSkipService;
    @Autowired private PlannedSkipService plannedSkipService;

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    /** Computed per test (not a static final field) so a test never anchors to a calendar day
     *  captured at class-load time — the "midnight-fragile relative fixtures" trap this repo has
     *  hit before. */
    private static LocalDate today() {
        return LocalDate.now(TZ);
    }

    private static int todayDow(LocalDate today) {
        return today.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas
    }

    @Test
    void testSkips_shouldReturn401_whenUnauthenticated() {
        LocalDate today = today();
        getForBody("/api/train/skips?from=" + today + "&to=" + today, null, HttpStatus.UNAUTHORIZED, Void.class);
        PlannedSkipRequest req = new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED);
        putForBody("/api/train/skips", req, null, HttpStatus.UNAUTHORIZED, Void.class);
        deleteAndExpect("/api/train/skips/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED);
    }

    @Test
    void testUpsert_shouldSkipTodayGymWithPass_whenFirstSoftOfWeek() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipRequest req = new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED);

        PlannedSkipResponse response = putForBody("/api/train/skips", req, auth, HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(response.getFreePass()).isTrue();
        assertThat(response.getExcused()).isTrue();
        assertThat(response.getSource()).isEqualTo(PlannedSkipResponse.SourceEnum.USER);
        assertThat(response.getSerious()).isFalse();
    }

    @Test
    void testUpsert_shouldCountSecondSoftSkip_whenPassUsed() {
        LocalDate today = today();
        int todayDow = todayDow(today);
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        PlannedSkipResponse second = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.SPORT).dayOfWeek(todayDow).time("18:00")
            .reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(second.getExcused()).isFalse();
        assertThat(second.getFreePass()).isFalse();
    }

    @Test
    void testUpsert_shouldMovePass_whenFirstUndone() {
        LocalDate today = today();
        int todayDow = todayDow(today);
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse gym = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        PlannedSkipResponse sport = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.SPORT).dayOfWeek(todayDow).time("18:00")
            .reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(sport.getFreePass()).isFalse();

        deleteAndExpect("/api/train/skips/" + gym.getId(), auth, HttpStatus.NO_CONTENT);

        List<PlannedSkipResponse> after = getForList(
            "/api/train/skips?from=" + today + "&to=" + today, auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(after).hasSize(1);
        assertThat(after.get(0).getId()).isEqualTo(sport.getId());
        assertThat(after.get(0).getFreePass()).isTrue();
        assertThat(after.get(0).getExcused()).isTrue();
    }

    @Test
    void testUpsert_shouldUpdateReason_whenSameTargetAgain() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse first = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.NONE),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        PlannedSkipResponse second = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.ILLNESS),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getSerious()).isTrue();

        List<PlannedSkipResponse> list = getForList(
            "/api/train/skips?from=" + today + "&to=" + today, auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(list).hasSize(1);
    }

    @Test
    void testUpsert_shouldDropReasonText_whenNotOther() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse tired = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.TIRED).reasonText("x"),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(tired.getReasonText()).isNull();

        PlannedSkipResponse other = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.OTHER).reasonText("  családi program  "),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(other.getReasonText()).isEqualTo("családi program");
    }

    @Test
    void testUpsert_shouldReturn400_whenDateOutsideWindow() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();

        String tooOld = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today.minusDays(8)).kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.TIRED),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(tooOld, "TRAIN_SKIP_DATE_OUT_OF_WINDOW");

        LocalDate nextMonday = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        String tooFar = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(nextMonday).kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.TIRED),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(tooFar, "TRAIN_SKIP_DATE_OUT_OF_WINDOW");
    }

    @Test
    void testUpsert_shouldReturn400_whenSportTargetMismatch() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();
        int wrongDow = (todayDow(today) + 1) % 7;

        String mismatch = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.SPORT).dayOfWeek(wrongDow).time("18:00")
            .reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(mismatch, "TRAIN_SKIP_TARGET_INVALID");

        String noSessionKey = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.RUN)
            .reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(noSessionKey, "TRAIN_SKIP_TARGET_INVALID");
    }

    @Test
    void testUndo_shouldReturn404_whenOtherUsersSkip() {
        LocalDate today = today();
        RegisteredUser owner = registerUser("Skip Undo Owner");
        RegisteredUser other = registerUser("Skip Undo Other");
        PlannedSkipResponse skip = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        String body = exchangeForBody(org.springframework.http.HttpMethod.DELETE, "/api/train/skips/" + skip.getId(),
            null, other.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "TRAIN_SKIP_NOT_FOUND");
    }

    @Test
    void testList_shouldIncludeAdviceSkip_whenSportSlotSkipExists() {
        LocalDate today = today();
        int todayDow = todayDow(today);
        RegisteredUser owner = registerUser("Skip Advice Owner");
        sportSlotSkipPopulator.createSkip(owner.id(), todayDow, "18:00", today);

        List<PlannedSkipResponse> list = getForList(
            "/api/train/skips?from=" + today + "&to=" + today, owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getSource()).isEqualTo(PlannedSkipResponse.SourceEnum.ADVICE);
        assertThat(list.get(0).getExcused()).isTrue();

        deleteAndExpect("/api/train/skips/" + list.get(0).getId(), owner.headers(), HttpStatus.NO_CONTENT);
        assertThat(sportSlotSkipService.isSkipped(owner.id(), todayDow, "18:00", today)).isFalse();
    }

    @Test
    void testList_shouldReturnOneUserRow_whenUserSkipsSameSlotAsAdviceSkip() {
        LocalDate today = today();
        int todayDow = todayDow(today);
        RegisteredUser owner = registerUser("Skip Twin Owner");
        sportSlotSkipPopulator.createSkip(owner.id(), todayDow, "18:00", today);

        PlannedSkipResponse userSkip = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.SPORT).dayOfWeek(todayDow).time("18:00")
            .reasonCategory(PlannedSkipReason.TIRED),
            owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        List<PlannedSkipResponse> list = getForList(
            "/api/train/skips?from=" + today + "&to=" + today, owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getId()).isEqualTo(userSkip.getId());
        assertThat(list.get(0).getSource()).isEqualTo(PlannedSkipResponse.SourceEnum.USER);
    }

    @Test
    void testUpsert_shouldStayExcusedWithoutPass_whenReasonGivenToAnAdviceSkip() {
        // Kihagyás S1 (mezo-q4xt2.1, review I3): giving a soft reason to the coach's skip must not
        // turn it into a counted miss, and must not burn the week's free pass either.
        LocalDate today = today();
        int todayDow = todayDow(today);
        RegisteredUser owner = registerUser("Skip Advice Reason Owner");
        sportSlotSkipPopulator.createSkip(owner.id(), todayDow, "18:00", today);

        PlannedSkipResponse reasoned = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.SPORT).dayOfWeek(todayDow).time("18:00")
            .reasonCategory(PlannedSkipReason.TIRED),
            owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(reasoned.getSource()).isEqualTo(PlannedSkipResponse.SourceEnum.USER);
        assertThat(reasoned.getReasonCategory()).isEqualTo(PlannedSkipReason.TIRED);
        assertThat(reasoned.getExcused()).isTrue();
        assertThat(reasoned.getFreePass()).isFalse();

        PlannedSkipResponse gym = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(gym.getFreePass()).as("the week's pass is still available for another soft skip").isTrue();
        assertThat(gym.getExcused()).isTrue();
    }

    @Test
    void testUndo_shouldRestoreSlot_whenUserSkipHadAnAdviceTwin() {
        LocalDate today = today();
        int todayDow = todayDow(today);
        RegisteredUser owner = registerUser("Skip Twin Undo Owner");
        sportSlotSkipPopulator.createSkip(owner.id(), todayDow, "18:00", today);
        PlannedSkipResponse userSkip = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.SPORT).dayOfWeek(todayDow).time("18:00")
            .reasonCategory(PlannedSkipReason.TIRED),
            owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        deleteAndExpect("/api/train/skips/" + userSkip.getId(), owner.headers(), HttpStatus.NO_CONTENT);

        List<PlannedSkipResponse> after = getForList(
            "/api/train/skips?from=" + today + "&to=" + today, owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(after).isEmpty();
        assertThat(sportSlotSkipService.isSkipped(owner.id(), todayDow, "18:00", today)).isFalse();
    }

    @Test
    void testUndo_shouldReturn404_whenOtherUserDeletesOwnersAdviceSkip() {
        LocalDate today = today();
        int todayDow = todayDow(today);
        RegisteredUser owner = registerUser("Advice Undo Owner");
        RegisteredUser other = registerUser("Advice Undo Other");
        sportSlotSkipPopulator.createSkip(owner.id(), todayDow, "18:00", today);
        List<PlannedSkipResponse> ownerList = getForList(
            "/api/train/skips?from=" + today + "&to=" + today, owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(ownerList).hasSize(1);
        UUID adviceId = ownerList.get(0).getId();

        String body = exchangeForBody(org.springframework.http.HttpMethod.DELETE, "/api/train/skips/" + adviceId,
            null, other.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "TRAIN_SKIP_NOT_FOUND");

        assertThat(sportSlotSkipService.isSkipped(owner.id(), todayDow, "18:00", today)).isTrue();
    }

    @Test
    void testList_shouldReturn400_whenFromAfterTo() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();
        String body = getForBody(
            "/api/train/skips?from=" + today + "&to=" + today.minusDays(1), auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_INVALID_DATE_RANGE");
    }

    @Test
    void testUpsert_shouldReturnSameId_whenTwoQuickPutsOfSameTarget() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipRequest req = new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED);

        PlannedSkipResponse first = putForBody("/api/train/skips", req, auth, HttpStatus.OK, PlannedSkipResponse.class);
        PlannedSkipResponse second = putForBody("/api/train/skips", req, auth, HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(second.getId()).isEqualTo(first.getId());
        List<PlannedSkipResponse> list = getForList(
            "/api/train/skips?from=" + today + "&to=" + today, auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(list).hasSize(1);
    }

    private PlannedSkipRequest mealReq(LocalDate date, String key, PlannedSkipReason reason, Integer kcal) {
        return new PlannedSkipRequest().date(date).kind(PlannedSkipKind.MEAL).sessionKey(key)
            .reasonCategory(reason).plannedKcal(kcal);
    }

    @Test
    void testUpsert_shouldExcuseMealWithoutPass_whenMealSkipped() {
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse r = putForBody("/api/train/skips",
            mealReq(today(), "lunch#1", PlannedSkipReason.NONE, 900), auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(r.getExcused()).isTrue();
        assertThat(r.getFreePass()).isFalse();
        assertThat(r.getPlannedKcal()).isEqualTo(900);
    }

    @Test
    void testUpsert_shouldUpdateMealReason_whenSameSlotAgain() {
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse first = putForBody("/api/train/skips",
            mealReq(today(), "lunch#1", PlannedSkipReason.NONE, 900), auth, HttpStatus.OK, PlannedSkipResponse.class);
        PlannedSkipResponse second = putForBody("/api/train/skips",
            mealReq(today(), "lunch#1", PlannedSkipReason.NOT_HUNGRY, 900), auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getReasonCategory()).isEqualTo(PlannedSkipReason.NOT_HUNGRY);
    }

    @Test
    void testUpsert_shouldReturn400_whenMealSlotKindUnknown() {
        String body = putForBody("/api/train/skips", mealReq(today(), "brunch#1", PlannedSkipReason.NONE, null),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_SKIP_TARGET_INVALID");
    }

    @Test
    void testUpsert_shouldReturn400_whenMealDateInFuture() {
        String body = putForBody("/api/train/skips", mealReq(today().plusDays(1), "lunch#1", PlannedSkipReason.NONE, null),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_SKIP_DATE_OUT_OF_WINDOW");
    }

    @Test
    void testUpsert_shouldReturn400_whenReasonDoesNotFitKind() {
        HttpHeaders auth = ownerAuthHeaders();
        String meal = putForBody("/api/train/skips", mealReq(today(), "lunch#1", PlannedSkipReason.TIRED, null),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(meal, "TRAIN_SKIP_REASON_INVALID");
        String gym = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today()).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.NOT_HUNGRY),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(gym, "TRAIN_SKIP_REASON_INVALID");
    }

    @Test
    void testUpsert_shouldKeepGymPass_whenMealSkippedFirstInSameWeek() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/train/skips", mealReq(today, "lunch#1", PlannedSkipReason.NONE, null),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(today).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        List<PlannedSkipResponse> list = getForList(
            "/api/train/skips?from=" + today + "&to=" + today, auth, HttpStatus.OK, PlannedSkipResponse.class);
        PlannedSkipResponse gym = list.stream().filter(r -> r.getKind() == PlannedSkipKind.GYM).findFirst().orElseThrow();
        assertThat(gym.getFreePass()).isTrue();
    }

    @Test
    void testUndo_shouldRemoveMealSkip() {
        LocalDate today = today();
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse meal = putForBody("/api/train/skips",
            mealReq(today, "dinner#1", PlannedSkipReason.NONE, 700), auth, HttpStatus.OK, PlannedSkipResponse.class);
        deleteAndExpect("/api/train/skips/" + meal.getId(), auth, HttpStatus.NO_CONTENT);
        assertThat(getForList("/api/train/skips?from=" + today + "&to=" + today, auth, HttpStatus.OK,
            PlannedSkipResponse.class)).isEmpty();
    }

    @Test
    void testBridgedWeeks_shouldIgnoreMealSkip_andMealSkipsOnReadsItBack() {
        LocalDate today = today();
        RegisteredUser user = registerUser("Meal Skip Owner");
        putForBody("/api/train/skips", mealReq(today, "snack#1", PlannedSkipReason.NOT_HUNGRY, 200),
            user.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(plannedSkipService.bridgedWeeks(user.id(), today, today)).isEmpty();
        List<PlannedSkipPolicy.Row> rows = plannedSkipService.mealSkipsOn(user.id(), today);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).plannedKcal()).isEqualTo(200);
        assertThat(plannedSkipService.mealSkipsBetween(user.id(), today, today)).containsOnlyKeys(today);
    }
}
