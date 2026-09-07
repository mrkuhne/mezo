package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminOverviewResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** GET /api/admin/overview — owner-only installation counters (mezo-d5iy). */
class AdminOverviewIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/overview";

    @Test
    void testOverview_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
    }

    @Test
    void testOverview_shouldCountTheRegisteredUsers_whenOwner() {
        // Deviation from the brief (mezo-d5iy.3): registration itself does NOT stamp
        // last_seen_at (AuthService.register never touches it; only CurrentUser.load(), which
        // runs on an authenticated request, does — see its javadoc). So each new account makes
        // one authenticated call (/api/auth/me) to become "active today", matching the real
        // system instead of the brief's incorrect assumption that registering alone counts.
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Bela");
        getForBody("/api/auth/me", anna.headers(), HttpStatus.OK, String.class);
        getForBody("/api/auth/me", bela.headers(), HttpStatus.OK, String.class);

        AdminOverviewResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminOverviewResponse.class);

        assertThat(body.getUserCount()).isEqualTo(3L); // owner + two
        assertThat(body.getActiveToday()).isGreaterThanOrEqualTo(2L); // Anna + Bela seen via /me
    }

    @Test
    void testOverview_shouldReturnThirtyDaySeries_whenOwner() {
        AdminOverviewResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminOverviewResponse.class);

        assertThat(body.getActiveUserSeries()).hasSize(30);
        assertThat(body.getCostSeries()).hasSize(30);
        assertThat(body.getDomainSeries()).extracting("key")
                .contains("train", "food", "sleep", "journal", "habits", "water", "weight");
        body.getDomainSeries().forEach(series -> assertThat(series.getDays()).hasSize(30));
    }

    @Test
    void testOverview_shouldReportLoggedTodayPerDomain_whenOwner() {
        AdminOverviewResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminOverviewResponse.class);

        assertThat(body.getLoggedToday()).containsKeys("train", "food", "sleep", "journal", "habits");
        assertThat(body.getLoggedToday().values()).allSatisfy(v -> assertThat(v).isNotNegative());
        assertThat(body.getMemoryItemCount()).isNotNegative();
        assertThat(body.getVectorCount()).isNotNegative();
    }
}
