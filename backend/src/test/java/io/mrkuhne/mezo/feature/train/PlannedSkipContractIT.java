package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PlannedSkipKind;
import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
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
}
