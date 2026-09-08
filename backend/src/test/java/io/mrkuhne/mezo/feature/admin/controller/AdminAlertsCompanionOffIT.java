package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminAlertsResponse;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Degraded, not dead (mezo-kjwa, mirroring the {@code AdminMemoryHealthGraphOffIT} idiom): with
 * the companion switch off, {@code /api/admin/alerts} still answers 200 and simply never
 * evaluates the two companion-dependent rules (memory_stuck, job_missed) — the other rules keep
 * working regardless.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class AdminAlertsCompanionOffIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/alerts";

    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private LlmLogPopulator llmLogPopulator;

    @Test
    void testAlerts_shouldOmitCompanionRules_whenCompanionSwitchIsOff() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity item = memoryItemPopulator.item(anna.id(), "journal_entry", UUID.randomUUID(),
                "friss", LocalDate.of(2026, 6, 3));
        // Would fire memory_stuck if the companion switch were on (see AdminAlertsIT) — with it
        // off, the rule must never even run its query.
        memoryItemPopulator.vector(item, "gemini-embedding-001-768-v1", MemoryEmbeddingPopulator.axisVector(0),
                MemoryVectorEntity.STATUS_FAILED, "PROVIDER_ERROR", null);
        // Degraded, not dead: llm_errors is NOT companion-gated, so a firing feature must still
        // appear even while the two companion-dependent keys stay absent.
        for (int i = 0; i < 3; i++) {
            llmLogPopulator.log(null, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 10, 5);
        }
        llmLogPopulator.logError(null, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", "PROVIDER_ERROR");
        llmLogPopulator.logError(null, CallKind.CHAT, "companion_chat", "gemini-2.5-flash", "PROVIDER_ERROR");

        AdminAlertsResponse body = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, AdminAlertsResponse.class);

        assertThat(body.getGeneratedAt()).isNotNull();
        assertThat(body.getAlerts()).anyMatch(a -> "llm_errors".equals(a.getKey()));
        assertThat(body.getAlerts()).noneMatch(a -> "memory_stuck".equals(a.getKey()));
        assertThat(body.getAlerts()).noneMatch(a -> "job_missed".equals(a.getKey()));
    }
}
