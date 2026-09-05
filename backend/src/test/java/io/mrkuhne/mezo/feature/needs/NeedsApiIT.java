package io.mrkuhne.mezo.feature.needs;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.NeedsCloseRequest;
import io.mrkuhne.mezo.api.dto.NeedsCloseResponse;
import io.mrkuhne.mezo.api.dto.NeedsRings;
import io.mrkuhne.mezo.api.dto.NeedsSummaryResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.NeedsPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class NeedsApiIT extends ApiIntegrationTest {

    @Autowired private NeedsPopulator needsPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private static NeedsRings rings(int energia, int hidratacio, int pihenes, int mozgas, int lelek, int rend) {
        return NeedsRings.builder()
            .energia(energia).hidratacio(hidratacio).pihenes(pihenes)
            .mozgas(mozgas).lelek(lelek).rend(rend).build();
    }

    @Test
    void testCloseNeedsDay_shouldAwardZeroXp_whenNoRingGreen() {
        var req = NeedsCloseRequest.builder().date(LocalDate.now())
            .rings(rings(10, 10, 10, 10, 10, 10)).build();
        NeedsCloseResponse res = postForBody("/api/needs/day-close", req,
            ownerAuthHeaders(), HttpStatus.OK, NeedsCloseResponse.class);
        assertThat(res.getXpAwarded()).isEqualTo(0);
        assertThat(res.getGreenCount()).isEqualTo(0);
        assertThat(res.getAllGreen()).isFalse();
        assertThat(res.getStreakDays()).isEqualTo(0);
    }

    @Test
    void testCloseNeedsDay_shouldAwardPerRingXp_whenThreeGreen() {
        var req = NeedsCloseRequest.builder().date(LocalDate.now())
            .rings(rings(70, 65, 60, 10, 20, 30)).build();
        NeedsCloseResponse res = postForBody("/api/needs/day-close", req,
            ownerAuthHeaders(), HttpStatus.OK, NeedsCloseResponse.class);
        assertThat(res.getXpAwarded()).isEqualTo(15);
        assertThat(res.getGreenCount()).isEqualTo(3);
        assertThat(res.getAllGreen()).isFalse();
    }

    @Test
    void testCloseNeedsDay_shouldAwardBonus_whenAllGreen() {
        var req = NeedsCloseRequest.builder().date(LocalDate.now())
            .rings(rings(60, 70, 80, 90, 100, 65)).build();
        NeedsCloseResponse res = postForBody("/api/needs/day-close", req,
            ownerAuthHeaders(), HttpStatus.OK, NeedsCloseResponse.class);
        assertThat(res.getXpAwarded()).isEqualTo(60);
        assertThat(res.getAllGreen()).isTrue();
        assertThat(res.getStreakDays()).isEqualTo(1);
    }

    @Test
    void testCloseNeedsDay_shouldContinueStreak_whenYesterdayAllGreen() {
        // one read of the clock for the whole fixture: the seeded "yesterday" and the closed day
        // must be consecutive, which two separate LocalDate.now() calls cannot guarantee
        LocalDate today = LocalDate.now();
        needsPopulator.needsDay(ownerId(), today.minusDays(1),
            new int[]{80, 80, 80, 80, 80, 80}, 6, true, 60, 4);
        var req = NeedsCloseRequest.builder().date(today)
            .rings(rings(60, 70, 80, 90, 100, 65)).build();
        NeedsCloseResponse res = postForBody("/api/needs/day-close", req,
            ownerAuthHeaders(), HttpStatus.OK, NeedsCloseResponse.class);
        assertThat(res.getAllGreen()).isTrue();
        assertThat(res.getStreakDays()).isEqualTo(5);
    }

    @Test
    void testCloseNeedsDay_shouldResetStreak_whenNotAllGreen() {
        // one read of the clock for the whole fixture — see the streak test above
        LocalDate today = LocalDate.now();
        needsPopulator.needsDay(ownerId(), today.minusDays(1),
            new int[]{80, 80, 80, 80, 80, 80}, 6, true, 60, 4);
        var req = NeedsCloseRequest.builder().date(today)
            .rings(rings(60, 70, 80, 90, 100, 10)).build();
        NeedsCloseResponse res = postForBody("/api/needs/day-close", req,
            ownerAuthHeaders(), HttpStatus.OK, NeedsCloseResponse.class);
        assertThat(res.getGreenCount()).isEqualTo(5);
        assertThat(res.getAllGreen()).isFalse();
        assertThat(res.getStreakDays()).isEqualTo(0);
    }

    @Test
    void testCloseNeedsDay_shouldBeIdempotent_whenCalledTwice() {
        var req = NeedsCloseRequest.builder().date(LocalDate.now())
            .rings(rings(60, 70, 80, 90, 100, 65)).build();
        NeedsCloseResponse first = postForBody("/api/needs/day-close", req,
            ownerAuthHeaders(), HttpStatus.OK, NeedsCloseResponse.class);
        NeedsCloseResponse second = postForBody("/api/needs/day-close", req,
            ownerAuthHeaders(), HttpStatus.OK, NeedsCloseResponse.class);
        assertThat(second).isEqualTo(first);
        NeedsSummaryResponse summary = getForBody("/api/needs/summary",
            ownerAuthHeaders(), HttpStatus.OK, NeedsSummaryResponse.class);
        assertThat(summary.getStreakDays()).isEqualTo(first.getStreakDays());
    }

    @Test
    void testCloseNeedsDay_shouldReject_whenNotToday() {
        var req = NeedsCloseRequest.builder().date(LocalDate.now().minusDays(1))
            .rings(rings(60, 70, 80, 90, 100, 65)).build();
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST, "/api/needs/day-close",
            req, ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertHasRequestError(res.getBody(), "NEEDS_NOT_TODAY");
    }

    @Test
    void testCloseNeedsDay_shouldReject_whenRingOutOfRange() {
        var req = NeedsCloseRequest.builder().date(LocalDate.now())
            .rings(rings(130, 70, 80, 90, 100, 65)).build();
        postForBody("/api/needs/day-close", req, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testGetNeedsSummary_shouldReturnZeros_whenNoClose() {
        NeedsSummaryResponse summary = getForBody("/api/needs/summary",
            ownerAuthHeaders(), HttpStatus.OK, NeedsSummaryResponse.class);
        assertThat(summary.getStreakDays()).isEqualTo(0);
        assertThat(summary.getLastCloseDate()).isNull();
        assertThat(summary.getLastAllGreen()).isNull();
    }

    @Test
    void testGetNeedsSummary_shouldReturnLatest_whenCloses() {
        // one read of the clock: the two seeded days AND the asserted lastCloseDate below all
        // derive from it, so a midnight mid-test can no longer make them disagree
        LocalDate today = LocalDate.now();
        needsPopulator.needsDay(ownerId(), today.minusDays(2),
            new int[]{80, 80, 80, 80, 80, 80}, 6, true, 60, 1);
        needsPopulator.needsDay(ownerId(), today.minusDays(1),
            new int[]{80, 80, 80, 80, 80, 80}, 6, true, 60, 2);
        NeedsSummaryResponse summary = getForBody("/api/needs/summary",
            ownerAuthHeaders(), HttpStatus.OK, NeedsSummaryResponse.class);
        assertThat(summary.getStreakDays()).isEqualTo(2);
        assertThat(summary.getLastCloseDate()).isEqualTo(today.minusDays(1));
        assertThat(summary.getLastAllGreen()).isTrue();
    }
}
