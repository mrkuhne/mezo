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
    private static final LocalDate TODAY = LocalDate.now(TZ);
    private static final int TODAY_DOW = TODAY.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas

    @Test
    void testSkips_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/skips?from=" + TODAY + "&to=" + TODAY, null, HttpStatus.UNAUTHORIZED, Void.class);
        PlannedSkipRequest req = new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED);
        putForBody("/api/train/skips", req, null, HttpStatus.UNAUTHORIZED, Void.class);
        deleteAndExpect("/api/train/skips/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED);
    }

    @Test
    void testUpsert_shouldSkipTodayGymWithPass_whenFirstSoftOfWeek() {
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipRequest req = new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED);

        PlannedSkipResponse response = putForBody("/api/train/skips", req, auth, HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(response.getFreePass()).isTrue();
        assertThat(response.getExcused()).isTrue();
        assertThat(response.getSource()).isEqualTo(PlannedSkipResponse.SourceEnum.USER);
        assertThat(response.getSerious()).isFalse();
    }

    @Test
    void testUpsert_shouldCountSecondSoftSkip_whenPassUsed() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        PlannedSkipResponse second = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.SPORT).dayOfWeek(TODAY_DOW).time("18:00")
            .reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(second.getExcused()).isFalse();
        assertThat(second.getFreePass()).isFalse();
    }

    @Test
    void testUpsert_shouldMovePass_whenFirstUndone() {
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse gym = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        PlannedSkipResponse sport = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.SPORT).dayOfWeek(TODAY_DOW).time("18:00")
            .reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(sport.getFreePass()).isFalse();

        deleteAndExpect("/api/train/skips/" + gym.getId(), auth, HttpStatus.NO_CONTENT);

        List<PlannedSkipResponse> after = getForList(
            "/api/train/skips?from=" + TODAY + "&to=" + TODAY, auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(after).hasSize(1);
        assertThat(after.get(0).getId()).isEqualTo(sport.getId());
        assertThat(after.get(0).getFreePass()).isTrue();
        assertThat(after.get(0).getExcused()).isTrue();
    }

    @Test
    void testUpsert_shouldUpdateReason_whenSameTargetAgain() {
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse first = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.NONE),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        PlannedSkipResponse second = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.ILLNESS),
            auth, HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getSerious()).isTrue();

        List<PlannedSkipResponse> list = getForList(
            "/api/train/skips?from=" + TODAY + "&to=" + TODAY, auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(list).hasSize(1);
    }

    @Test
    void testUpsert_shouldDropReasonText_whenNotOther() {
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipResponse tired = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.TIRED).reasonText("x"),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(tired.getReasonText()).isNull();

        PlannedSkipResponse other = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.OTHER).reasonText("  családi program  "),
            auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(other.getReasonText()).isEqualTo("családi program");
    }

    @Test
    void testUpsert_shouldReturn400_whenDateOutsideWindow() {
        HttpHeaders auth = ownerAuthHeaders();

        String tooOld = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY.minusDays(8)).kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.TIRED),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(tooOld, "TRAIN_SKIP_DATE_OUT_OF_WINDOW");

        LocalDate nextMonday = TODAY.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        String tooFar = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(nextMonday).kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.TIRED),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(tooFar, "TRAIN_SKIP_DATE_OUT_OF_WINDOW");
    }

    @Test
    void testUpsert_shouldReturn400_whenSportTargetMismatch() {
        HttpHeaders auth = ownerAuthHeaders();
        int wrongDow = (TODAY_DOW + 1) % 7;

        String mismatch = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.SPORT).dayOfWeek(wrongDow).time("18:00")
            .reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(mismatch, "TRAIN_SKIP_TARGET_INVALID");

        String noSessionKey = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.RUN)
            .reasonCategory(PlannedSkipReason.NO_TIME),
            auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(noSessionKey, "TRAIN_SKIP_TARGET_INVALID");
    }

    @Test
    void testUndo_shouldReturn404_whenOtherUsersSkip() {
        RegisteredUser owner = registerUser("Skip Undo Owner");
        RegisteredUser other = registerUser("Skip Undo Other");
        PlannedSkipResponse skip = putForBody("/api/train/skips", new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED),
            owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        String body = exchangeForBody(org.springframework.http.HttpMethod.DELETE, "/api/train/skips/" + skip.getId(),
            null, other.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "TRAIN_SKIP_NOT_FOUND");
    }

    @Test
    void testList_shouldIncludeAdviceSkip_whenSportSlotSkipExists() {
        RegisteredUser owner = registerUser("Skip Advice Owner");
        sportSlotSkipPopulator.createSkip(owner.id(), TODAY_DOW, "18:00", TODAY);

        List<PlannedSkipResponse> list = getForList(
            "/api/train/skips?from=" + TODAY + "&to=" + TODAY, owner.headers(), HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getSource()).isEqualTo(PlannedSkipResponse.SourceEnum.ADVICE);
        assertThat(list.get(0).getExcused()).isTrue();

        deleteAndExpect("/api/train/skips/" + list.get(0).getId(), owner.headers(), HttpStatus.NO_CONTENT);
        assertThat(sportSlotSkipService.isSkipped(owner.id(), TODAY_DOW, "18:00", TODAY)).isFalse();
    }

    @Test
    void testList_shouldReturn400_whenFromAfterTo() {
        HttpHeaders auth = ownerAuthHeaders();
        String body = getForBody(
            "/api/train/skips?from=" + TODAY + "&to=" + TODAY.minusDays(1), auth, HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_INVALID_DATE_RANGE");
    }

    @Test
    void testUpsert_shouldReturnSameId_whenTwoQuickPutsOfSameTarget() {
        HttpHeaders auth = ownerAuthHeaders();
        PlannedSkipRequest req = new PlannedSkipRequest()
            .date(TODAY).kind(PlannedSkipKind.GYM).reasonCategory(PlannedSkipReason.TIRED);

        PlannedSkipResponse first = putForBody("/api/train/skips", req, auth, HttpStatus.OK, PlannedSkipResponse.class);
        PlannedSkipResponse second = putForBody("/api/train/skips", req, auth, HttpStatus.OK, PlannedSkipResponse.class);

        assertThat(second.getId()).isEqualTo(first.getId());
        List<PlannedSkipResponse> list = getForList(
            "/api/train/skips?from=" + TODAY + "&to=" + TODAY, auth, HttpStatus.OK, PlannedSkipResponse.class);
        assertThat(list).hasSize(1);
    }
}
