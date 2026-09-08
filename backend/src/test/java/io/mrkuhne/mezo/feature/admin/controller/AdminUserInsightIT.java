package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminUserInsightResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** GET /api/admin/users-insight — accounts enriched with footprint and cost (mezo-d5iy),
 *  activity/feedback totals (mezo-zde2). */
class AdminUserInsightIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/users-insight";

    @Autowired private AdminProperties adminProperties;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private FeedbackPopulator feedbackPopulator;

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

    @Test
    void testListUserInsights_shouldReturnNinetyDayActivityByDay_whenOwner() {
        RegisteredUser anna = registerUser("Anna");

        List<AdminUserInsightResponse> users =
                getForList(URI, ownerAuthHeaders(), HttpStatus.OK, AdminUserInsightResponse.class);

        AdminUserInsightResponse row = rowFor(users, anna.id());
        assertThat(row.getActivityByDay()).hasSize(90);
        assertThat(row.getFeedbackUp()).isNotNegative();
        assertThat(row.getFeedbackDown()).isNotNegative();
    }

    /** reportZone edge (mezo-zde2): a domain row logged at 23:45 LOCAL time on a known day must
     *  land at that day's index in the dense 90-day array — never off-by-one from a UTC-day
     *  reading of the same instant. */
    @Test
    void testListUserInsights_shouldPlaceASeededDomainRowAtItsReportZoneDayIndex_whenRowExists() {
        RegisteredUser anna = registerUser("Anna");
        ZoneId zone = adminProperties.reportZone();
        LocalDate today = LocalDate.now(zone);
        LocalDate seedDate = today.minusDays(10);
        LocalDate from90 = today.minusDays(89);
        int expectedIndex = (int) ChronoUnit.DAYS.between(from90, seedDate);
        mealPopulator.createBareMealAt(anna.id(), seedDate, "breakfast", LocalTime.of(23, 45));

        List<AdminUserInsightResponse> users =
                getForList(URI, ownerAuthHeaders(), HttpStatus.OK, AdminUserInsightResponse.class);

        AdminUserInsightResponse row = rowFor(users, anna.id());
        assertThat(row.getActivityByDay()).hasSize(90);
        assertThat(row.getActivityByDay().get(expectedIndex)).isGreaterThanOrEqualTo(1);
        int sumElsewhere = IntStream.range(0, 90)
                .filter(i -> i != expectedIndex)
                .map(i -> row.getActivityByDay().get(i))
                .sum();
        assertThat(sumElsewhere).isZero();
    }

    @Test
    void testListUserInsights_shouldIsolateThirtyDayFeedbackTotalsPerUser_whenMultipleUsersVoted() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Bela");
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
                "down", MessageFeedbackEntity.REASON_INACCURATE);
        feedbackPopulator.createVerdict(bela.id(), MessageFeedbackEntity.KIND_FEED_MESSAGE, UUID.randomUUID(), "up", null);

        List<AdminUserInsightResponse> users =
                getForList(URI, ownerAuthHeaders(), HttpStatus.OK, AdminUserInsightResponse.class);

        AdminUserInsightResponse annaRow = rowFor(users, anna.id());
        AdminUserInsightResponse belaRow = rowFor(users, bela.id());
        assertThat(annaRow.getFeedbackUp()).isEqualTo(2);
        assertThat(annaRow.getFeedbackDown()).isEqualTo(1);
        assertThat(belaRow.getFeedbackUp()).isEqualTo(1);
        assertThat(belaRow.getFeedbackDown()).isEqualTo(0);
    }

    private static AdminUserInsightResponse rowFor(List<AdminUserInsightResponse> users, UUID id) {
        return users.stream().filter(u -> u.getId().equals(id)).findFirst().orElseThrow();
    }
}
