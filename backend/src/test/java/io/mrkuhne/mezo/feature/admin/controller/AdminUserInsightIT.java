package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminUserInsightResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** GET /api/admin/users-insight — accounts enriched with footprint and cost (mezo-d5iy). */
class AdminUserInsightIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/users-insight";

    @Test
    void testListUserInsights_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
    }

    @Test
    void testListUserInsights_shouldIncludeEveryAccountWithFootprintFields_whenOwner() {
        RegisteredUser anna = registerUser("Anna");

        List<AdminUserInsightResponse> users =
                getForList(URI, ownerAuthHeaders(), HttpStatus.OK, AdminUserInsightResponse.class);

        assertThat(users).extracting(AdminUserInsightResponse::getId).contains(anna.id());
        assertThat(users).allSatisfy(u -> {
            assertThat(u.getRowCount()).isNotNegative();
            assertThat(u.getVectorCount()).isNotNegative();
            assertThat(u.getCost30dUsd()).isNotNull();
            assertThat(u.getActiveDays30d()).isNotNegative();
        });
    }

    @Test
    void testListUserInsights_shouldFilterByQuery_whenQGiven() {
        registerUser("Anna");
        registerUser("Bela");

        List<AdminUserInsightResponse> users =
                getForList(URI + "?q=Anna", ownerAuthHeaders(), HttpStatus.OK, AdminUserInsightResponse.class);

        assertThat(users).isNotEmpty();
        assertThat(users).allSatisfy(u ->
                assertThat(u.getName() + " " + u.getEmail()).containsIgnoringCase("anna"));
    }

    @Test
    void testListUserInsights_shouldSortByName_whenSortAndDirGiven() {
        registerUser("Anna");
        registerUser("Bela");

        List<AdminUserInsightResponse> users =
                getForList(URI + "?sort=name&dir=asc", ownerAuthHeaders(), HttpStatus.OK, AdminUserInsightResponse.class);

        assertThat(users).extracting(AdminUserInsightResponse::getName).isSorted();
    }

    @Test
    void testListUserInsights_shouldRejectUnknownSort_whenSortIsNotAllowed() {
        assertHasRequestError(
                getForBody(URI + "?sort=password_hash", ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class),
                "ADMIN_COLUMN_UNKNOWN");
    }
}
