package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.YearNext;
import io.mrkuhne.mezo.api.dto.YearPlan;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The year plan's next block when nothing runs (mezo-r36n9.113): a block that is due — its Monday has come, within the
 * 3-day tolerance, so the layout keeps its day — starts today, which is what the phone's intake offers („Ma"). The
 * clock is pinned to Wednesday 2026-11-25; block 1 was due Monday 2026-11-23. All values invented.
 */
@Import(YearPlanNextDueIT.WednesdayClockConfig.class)
class YearPlanNextDueIT extends ApiIntegrationTest {

    private static final String PLANS = "/api/train/year-plans";
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 25);
    private static final LocalDate DUE = LocalDate.of(2026, 11, 23);
    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @TestConfiguration
    static class WednesdayClockConfig {
        @Bean
        Clock yearPlanTestClock() {
            return Clock.fixed(TODAY.atTime(9, 0).atZone(BUD).toInstant(), BUD);
        }
    }

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void dueBlockStartsToday() {
        databasePopulator.populateUser(ownerProperties.ownerEmail());
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan created = postForBody(PLANS, Map.of("startDate", LocalDate.of(2026, 11, 30).toString()), auth,
            HttpStatus.CREATED, YearPlan.class);
        // A new plan never starts in the past: the plan is moved back a week behind the service.
        jdbc.update("update training_year_plan set start_date = ? where id = ?", DUE, created.getId());

        YearPlan plan = getForBody(PLANS + "/active", auth, HttpStatus.OK, YearPlan.class);

        assertThat(plan.getBlocks().getFirst().getPlannedStart()).isEqualTo(DUE);
        YearNext next = plan.getNext();
        assertThat(next).isNotNull();
        assertThat(next.getReason()).isEqualTo(YearNext.ReasonEnum.NO_BLOCK);
        assertThat(next.getBlockId()).isEqualTo(plan.getBlocks().getFirst().getId());
        assertThat(next.getStartsOn()).isEqualTo(TODAY);
    }
}
