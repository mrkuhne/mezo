package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemoryLlmUsageDay;
import io.mrkuhne.mezo.api.dto.MemoryLlmUsageResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/** A napi LLM-rollup HTTP-kontraktusa (mezo-al1i) — napi bontás, null-költség becsülete, ablak. */
@TestPropertySource(properties = "mezo.feature.llm-log.enabled=true")
class CompanionMemoryLlmUsageApiIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private LlmLogProperties llmLogProperties;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private Instant at(LocalDate day, int hour) {
        return day.atTime(hour, 0).atZone(llmLogProperties.reportZone()).toInstant();
    }

    private MemoryLlmUsageResponse usage(String query) {
        return getForBody("/api/companion/memory/llm-usage" + query, ownerAuthHeaders(),
                HttpStatus.OK, MemoryLlmUsageResponse.class);
    }

    @Test
    void testGetMemoryLlmUsage_shouldRollUpPerCalendarDay_whenRowsLogged() {
        ZoneId zone = llmLogProperties.reportZone();
        LocalDate today = LocalDate.now(zone);
        UUID owner = ownerId();
        llmLogPopulator.logAt(at(today, 10), owner, CallKind.CHAT, "companion", "gemini-2.5-flash",
                100, 40, null, null);
        llmLogPopulator.logAt(at(today, 11), owner, CallKind.CHAT, "companion", "gemini-2.5-flash",
                200, 60, null, new BigDecimal("0.010000"));
        llmLogPopulator.logAt(at(today.minusDays(1), 9), owner, CallKind.SMART, "companion",
                "gemini-2.5-pro", 500, 100, null, new BigDecimal("0.020000"));
        llmLogPopulator.logAt(at(today.minusDays(40), 9), owner, CallKind.CHAT, "companion",
                "gemini-2.5-flash", 999, 999, null, new BigDecimal("9.000000"));
        // Cross-account leak regression (mezo-qw37.7): a null-owner row (pre-S6 cron traffic) and
        // another account's row must NOT bleed into the owner's own rollup below.
        llmLogPopulator.logAt(at(today.minusDays(1), 12), null, CallKind.SMART, "companion",
                "gemini-2.5-pro", 5_000_000, 5_000_000, null, new BigDecimal("500.000000"));
        UUID otherUser = registerUser("Other Account").id();
        llmLogPopulator.logAt(at(today, 13), otherUser, CallKind.CHAT, "companion",
                "gemini-2.5-flash", 7_000_000, 7_000_000, null, new BigDecimal("700.000000"));

        MemoryLlmUsageResponse response = usage("?days=30");

        assertThat(response.getEnabled()).isTrue();
        assertThat(response.getPerDay()).hasSize(2); // a 40 napos sor az ablakon kívül
        MemoryLlmUsageDay yesterday = response.getPerDay().getFirst(); // date-asc
        assertThat(yesterday.getDate()).isEqualTo(today.minusDays(1));
        assertThat(yesterday.getCalls()).isEqualTo(1L);
        assertThat(yesterday.getInputTokens()).isEqualTo(500L);
        assertThat(yesterday.getOutputTokens()).isEqualTo(100L);
        assertThat(yesterday.getCostUsd()).isEqualTo(0.02);
        MemoryLlmUsageDay todayRow = response.getPerDay().get(1);
        assertThat(todayRow.getCalls()).isEqualTo(2L);
        assertThat(todayRow.getInputTokens()).isEqualTo(300L);
        assertThat(todayRow.getOutputTokens()).isEqualTo(100L);
        assertThat(todayRow.getCostUsd()).isEqualTo(0.01); // a null-költségű sor nem nulláz le
        assertThat(response.getTotals().getCalls()).isEqualTo(3L);
        assertThat(response.getTotals().getInputTokens()).isEqualTo(800L);
        assertThat(response.getTotals().getOutputTokens()).isEqualTo(200L);
        assertThat(response.getTotals().getCostUsd()).isEqualTo(0.03);
    }

    @Test
    void testGetMemoryLlmUsage_shouldKeepCostNull_whenNoPricedRowExists() {
        LocalDate today = LocalDate.now(llmLogProperties.reportZone());
        llmLogPopulator.logAt(at(today, 10), ownerId(), CallKind.EMBED_DOC, "companion",
                "gemini-embedding-001", 0, 0, null, null);

        MemoryLlmUsageResponse response = usage("");

        assertThat(response.getPerDay().getFirst().getCostUsd()).isNull();
        assertThat(response.getTotals().getCostUsd()).isNull();
    }
}
