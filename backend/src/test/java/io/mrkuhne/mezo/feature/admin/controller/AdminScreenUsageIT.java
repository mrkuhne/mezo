package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminScreenUsageResponse;
import io.mrkuhne.mezo.api.dto.AdminScreenUsageRow;
import io.mrkuhne.mezo.feature.telemetry.entity.ScreenEventEntity;
import io.mrkuhne.mezo.feature.telemetry.repository.ScreenEventRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** GET /api/admin/usage/screens — the OWNER-only read side of the screen log (bd mezo-o5cz). */
class AdminScreenUsageIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/usage/screens";

    @Autowired private ScreenEventRepository repository;

    @Test
    void testScreenUsage_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class),
                "AUTH_FORBIDDEN");
    }

    @Test
    void testScreenUsage_shouldCoverTheRequestedWindowWithDenseSeries_whenPeriodGiven() {
        AdminScreenUsageResponse body =
                getForBody(URI + "?period=7d", ownerAuthHeaders(), HttpStatus.OK, AdminScreenUsageResponse.class);

        assertThat(body.getPeriod()).isEqualTo("7d");
        assertThat(body.getDays()).hasSize(7);
    }

    @Test
    void testScreenUsage_shouldCountViewsAndDistinctUsers_whenEventsExist() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Bela");
        repository.save(row(anna.id(), "/nap", Duration.ofHours(1)));
        repository.save(row(anna.id(), "/nap", Duration.ofHours(2)));
        repository.save(row(bela.id(), "/nap", Duration.ofHours(3)));
        repository.save(row(bela.id(), "/fuel", Duration.ofHours(4)));
        // Outside the 7d window — proves the window filter is real, not decorative.
        repository.save(row(anna.id(), "/nap", Duration.ofDays(30)));

        AdminScreenUsageResponse body =
                getForBody(URI + "?period=7d", ownerAuthHeaders(), HttpStatus.OK, AdminScreenUsageResponse.class);

        AdminScreenUsageRow nap = body.getScreens().stream()
                .filter(s -> "/nap".equals(s.getScreen())).findFirst().orElseThrow();
        assertThat(nap.getViews()).isEqualTo(3);
        // Three views, two people — uniqueUsers is a distinct count, never a sum of daily uniques.
        assertThat(nap.getUniqueUsers()).isEqualTo(2);
        assertThat(nap.getLastSeenAt()).isNotNull();
        assertThat(nap.getDays()).hasSize(7);
        // Sorted by views desc: the busier screen comes first.
        assertThat(body.getScreens().get(0).getScreen()).isEqualTo("/nap");
        assertThat(body.getScreens()).extracting(AdminScreenUsageRow::getScreen).contains("/fuel");
    }

    private static ScreenEventEntity row(UUID userId, String screen, Duration ago) {
        var row = new ScreenEventEntity();
        row.setCreatedBy(userId);
        row.setScreen(screen);
        row.setOccurredAt(Instant.now().minus(ago));
        return row;
    }
}
