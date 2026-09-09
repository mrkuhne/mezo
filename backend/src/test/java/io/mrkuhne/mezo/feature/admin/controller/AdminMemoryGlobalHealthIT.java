package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminMemoryGlobalHealthResponse;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * GET /api/admin/memory/health — installation-wide memory health rollup (mezo-k5zy), sourced from
 * {@code AdminAlertQuery} — the same counts the memory_stuck/job_missed owner alerts already read
 * — NOT a client-side aggregation over every user's per-user {@code /health}.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.admin-memory.enabled=true"
})
class AdminMemoryGlobalHealthIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/memory/health";
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;

    @Test
    void testGlobalHealth_shouldReturn403_whenCallerIsNotOwner() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(
                getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
    }

    @Test
    void testGlobalHealth_shouldRollUpCountsAcrossEveryUser_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Bela");

        MemoryItemEntity annaReady = item(anna.id(), "friss", LocalDate.of(2026, 6, 3));
        memoryPopulator.vector(annaReady, VERSION, MemoryEmbeddingPopulator.axisVector(0));
        MemoryItemEntity belaReady = item(bela.id(), "friss2", LocalDate.of(2026, 6, 2));
        memoryPopulator.vector(belaReady, VERSION, MemoryEmbeddingPopulator.axisVector(1));

        MemoryItemEntity failed = item(anna.id(), "hibás", LocalDate.of(2026, 6, 1));
        memoryPopulator.vector(failed, VERSION, null, MemoryVectorEntity.STATUS_FAILED, "QUOTA", null);

        MemoryItemEntity stale = item(bela.id(), "elavult", LocalDate.of(2026, 5, 30));
        memoryPopulator.vector(stale, VERSION, MemoryEmbeddingPopulator.axisVector(2),
                MemoryVectorEntity.STATUS_READY, null, "b".repeat(64));

        var summary = dailySummaryPopulator.summary(anna.id(), LocalDate.of(2026, 6, 3));

        AdminMemoryGlobalHealthResponse response =
                getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGlobalHealthResponse.class);

        // ready: annaReady + belaReady + stale (stale is status='ready', just hash-mismatched).
        assertThat(response.getVectorsReady()).isEqualTo(3L);
        assertThat(response.getVectorsFailed()).isEqualTo(1L);
        assertThat(response.getVectorsStale()).isEqualTo(1L);
        assertThat(response.getItemsTotal()).isEqualTo(4L);
        assertThat(response.getNewestDailySummaryAt()).isNotNull();
        assertThat(response.getNewestDailySummaryAt().toLocalDate())
                .isEqualTo(summary.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate());
    }

    @Test
    void testGlobalHealth_shouldReportNullNewestDailySummary_whenNoneEverWritten() {
        AdminMemoryGlobalHealthResponse response =
                getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGlobalHealthResponse.class);

        assertThat(response.getVectorsReady()).isZero();
        assertThat(response.getVectorsFailed()).isZero();
        assertThat(response.getVectorsStale()).isZero();
        assertThat(response.getItemsTotal()).isZero();
        assertThat(response.getNewestDailySummaryAt()).isNull();
    }

    private MemoryItemEntity item(UUID owner, String content, LocalDate occurredOn) {
        return memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(), content, occurredOn);
    }
}
