package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminAlert;
import io.mrkuhne.mezo.api.dto.AdminAlertsResponse;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/** GET /api/admin/alerts — owner status-band rule evaluation (mezo-kjwa). */
class AdminAlertsIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/alerts";
    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testAlerts_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
    }

    @Test
    void testAlerts_shouldReturnEmpty_whenEverythingIsQuiet() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Bela");
        getForBody("/api/auth/me", anna.headers(), HttpStatus.OK, String.class);
        getForBody("/api/auth/me", bela.headers(), HttpStatus.OK, String.class);

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getGeneratedAt()).isNotNull();
        assertThat(body.getAlerts()).isEmpty();
    }

    @Test
    void testAlerts_shouldFireCostSpike_whenYesterdayFarExceedsThePriorWeek() {
        LocalDate today = LocalDate.now(ZONE);
        LocalDate yesterday = today.minusDays(1);
        for (int i = 2; i <= 8; i++) {
            seedCost(today.minusDays(i), new BigDecimal("0.10"));
        }
        seedCost(yesterday, new BigDecimal("1.00"));

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).filteredOn(a -> "cost_spike".equals(a.getKey()))
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.getSeverity()).isEqualTo(AdminAlert.SeverityEnum.WARN);
                    assertThat(a.getLink()).contains("/admin/cost?day=" + yesterday);
                });
    }

    @Test
    void testAlerts_shouldNotFireCostSpike_whenYesterdayIsBelowTheMinFloor() {
        LocalDate today = LocalDate.now(ZONE);
        LocalDate yesterday = today.minusDays(1);
        for (int i = 2; i <= 8; i++) {
            seedCost(today.minusDays(i), new BigDecimal("0.05"));
        }
        seedCost(yesterday, new BigDecimal("0.30"));

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).noneMatch(a -> "cost_spike".equals(a.getKey()));
    }

    @Test
    void testAlerts_shouldFireCostSpike_whenThePriorWeekAverageIsZero() {
        // No cost rows at all on the prior 7 days — the zero-average branch (avg == 0 &&
        // yesterday >= floor) rather than the ratio branch.
        LocalDate today = LocalDate.now(ZONE);
        LocalDate yesterday = today.minusDays(1);
        seedCost(yesterday, new BigDecimal("0.60"));

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).filteredOn(a -> "cost_spike".equals(a.getKey()))
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.getSeverity()).isEqualTo(AdminAlert.SeverityEnum.WARN);
                    assertThat(a.getLink()).contains("/admin/cost?day=" + yesterday);
                });
    }

    @Test
    void testAlerts_shouldAverageThePriorWeekOverSevenDays_whenMostOfTheWeekHasNoCostRows() {
        // Only 3 of the 7 prior days have any spend ($1.00 each, sum $3.00); the other 4 are
        // empty. Averaging over 7 gives ~0.43 (factor*avg ~0.857) — $1.50 clears that and fires.
        // Averaging over only the 3 seeded days would give 1.00 (factor*avg 2.00) — $1.50 would
        // NOT clear that. A green result here proves the divisor is 7, not "however many days
        // actually had rows".
        LocalDate today = LocalDate.now(ZONE);
        LocalDate yesterday = today.minusDays(1);
        seedCost(today.minusDays(2), new BigDecimal("1.00"));
        seedCost(today.minusDays(4), new BigDecimal("1.00"));
        seedCost(today.minusDays(6), new BigDecimal("1.00"));
        seedCost(yesterday, new BigDecimal("1.50"));

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).filteredOn(a -> "cost_spike".equals(a.getKey()))
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.getSeverity()).isEqualTo(AdminAlert.SeverityEnum.WARN);
                    assertThat(a.getDetail()).contains("$0.43");
                });
    }

    @Test
    void testAlerts_shouldFireLlmErrors_whenAFeatureErrorRateExceedsThreshold() {
        Instant now = Instant.now();
        llmLogPopulator.logAt(now.minus(1, ChronoUnit.HOURS), null, CallKind.CHAT, "companion_chat",
                "gemini-2.5-flash", 10, 5, null, new BigDecimal("0.01"));
        for (int i = 0; i < 2; i++) {
            llmLogPopulator.logAt(now.minus(1, ChronoUnit.HOURS), null, CallKind.CHAT, "companion_chat",
                    "gemini-2.5-flash", 10, 5, null, new BigDecimal("0.01"));
        }
        errorAt(now, "companion_chat", 2);

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).filteredOn(a -> "llm_errors".equals(a.getKey()))
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.getSeverity()).isEqualTo(AdminAlert.SeverityEnum.BAD);
                    assertThat(a.getSubject()).isEqualTo("companion_chat");
                    assertThat(a.getDetail()).doesNotContain("companion_chat");
                });
    }

    @Test
    void testAlerts_shouldNotFireLlmErrors_whenCallCountIsBelowTheMinimum() {
        Instant now = Instant.now();
        llmLogPopulator.logAt(now.minus(1, ChronoUnit.HOURS), null, CallKind.CHAT, "companion_chat",
                "gemini-2.5-flash", 10, 5, null, new BigDecimal("0.01"));
        errorAt(now, "companion_chat", 2);

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).noneMatch(a -> "llm_errors".equals(a.getKey()));
    }

    @Test
    void testAlerts_shouldFireMemoryStuck_whenAVectorEmbeddingFailed() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity item = memoryItemPopulator.item(anna.id(), "journal_entry", UUID.randomUUID(),
                "friss", LocalDate.of(2026, 6, 3));
        memoryItemPopulator.vector(item, "gemini-embedding-001-768-v1", MemoryEmbeddingPopulator.axisVector(0),
                MemoryVectorEntity.STATUS_FAILED, "PROVIDER_ERROR", null);

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).filteredOn(a -> "memory_stuck".equals(a.getKey()))
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.getSeverity()).isEqualTo(AdminAlert.SeverityEnum.BAD);
                    assertThat(a.getLink()).contains("/admin/users");
                });
    }

    @Test
    void testAlerts_shouldFireMemoryStuckAsWarn_whenAVectorIsStaleButNotFailed() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity item = memoryItemPopulator.item(anna.id(), "journal_entry", UUID.randomUUID(),
                "friss", LocalDate.of(2026, 6, 3));
        // ready + a deliberately mismatched embedded_content_hash: the item's content moved on
        // but nothing re-embedded it yet — present, but ANN-ineligible. No failed rows anywhere.
        memoryItemPopulator.vector(item, "gemini-embedding-001-768-v1", MemoryEmbeddingPopulator.axisVector(0),
                MemoryVectorEntity.STATUS_READY, null, "0".repeat(64));

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).filteredOn(a -> "memory_stuck".equals(a.getKey()))
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.getSeverity()).isEqualTo(AdminAlert.SeverityEnum.WARN);
                    assertThat(a.getLink()).contains("/admin/users");
                });
    }

    @Test
    void testAlerts_shouldFireJobMissed_whenTheNewestDailySummaryIsOlderThanTheThreshold() {
        RegisteredUser anna = registerUser("Anna");
        var summary = dailySummaryPopulator.summary(anna.id(), LocalDate.now(ZONE).minusDays(2));
        // jobMissedAfterHours defaults to 26 (mezo.admin.alerts.job-missed-after-hours) — 30h
        // back is comfortably past it.
        Instant staleAt = Instant.now().minus(30, ChronoUnit.HOURS);
        jdbcTemplate.update("update daily_summary set created_at = ? where id = ?",
                java.sql.Timestamp.from(staleAt), summary.getId());

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).filteredOn(a -> "job_missed".equals(a.getKey()))
                .singleElement()
                .satisfies(a -> assertThat(a.getSeverity()).isEqualTo(AdminAlert.SeverityEnum.WARN));
    }

    @Test
    void testAlerts_shouldFireTesterQuiet_whenANonOwnerHasNotBeenSeenInDays() {
        RegisteredUser anna = registerUser("Anna");
        getForBody("/api/auth/me", anna.headers(), HttpStatus.OK, String.class);
        Instant eightDaysAgo = ZonedDateTime.now(ZONE).minusDays(8).toInstant();
        jdbcTemplate.update("update app_user set last_seen_at = ? where id = ?",
                java.sql.Timestamp.from(eightDaysAgo), anna.id());

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).filteredOn(a -> "tester_quiet".equals(a.getKey()))
                .singleElement()
                .satisfies(a -> {
                    assertThat(a.getSeverity()).isEqualTo(AdminAlert.SeverityEnum.INFO);
                    assertThat(a.getDetail()).contains("Anna");
                });
    }

    @Test
    void testAlerts_shouldNotFireTesterQuiet_whenTheQuietAccountIsDisabled() {
        RegisteredUser anna = registerUser("Anna");
        getForBody("/api/auth/me", anna.headers(), HttpStatus.OK, String.class);
        Instant eightDaysAgo = ZonedDateTime.now(ZONE).minusDays(8).toInstant();
        jdbcTemplate.update("update app_user set last_seen_at = ?, status = 'DISABLED' where id = ?",
                java.sql.Timestamp.from(eightDaysAgo), anna.id());

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).noneMatch(a -> "tester_quiet".equals(a.getKey()));
    }

    @Test
    void testAlerts_shouldStaySilentOnJobMissed_whenNoDailySummaryRowsExistYet() {
        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getAlerts()).noneMatch(a -> "job_missed".equals(a.getKey()));
    }

    private void seedCost(LocalDate day, BigDecimal amount) {
        Instant at = day.atStartOfDay(ZONE).plusHours(10).toInstant();
        llmLogPopulator.logAt(at, null, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 10, 5, null, amount);
    }

    private void errorAt(Instant at, String feature, int count) {
        for (int i = 0; i < count; i++) {
            var entity = llmLogPopulator.logError(null, CallKind.CHAT, feature, "gemini-2.5-flash", "PROVIDER_ERROR");
            jdbcTemplate.update("update llm_log_history set created_at = ? where id = ?",
                    java.sql.Timestamp.from(at.minusSeconds(i + 1)), entity.getId());
        }
    }
}
