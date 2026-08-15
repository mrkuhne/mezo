package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemoryLlmUsageResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** llm-log switch OFF (a teszt-default) ⇒ enabled:false + üres sorok, akkor is, ha a tábla nem üres. */
class CompanionMemoryLlmUsageDisabledIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testGetMemoryLlmUsage_shouldReportDisabledAndEmpty_whenLlmLogSwitchOff() {
        llmLogPopulator.log(
                appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId(),
                CallKind.CHAT, "companion", "gemini-2.5-flash", 100, 40);

        MemoryLlmUsageResponse response = getForBody("/api/companion/memory/llm-usage",
                ownerAuthHeaders(), HttpStatus.OK, MemoryLlmUsageResponse.class);

        assertThat(response.getEnabled()).isFalse();
        assertThat(response.getPerDay()).isEmpty();
        assertThat(response.getTotals().getCalls()).isZero();
        assertThat(response.getTotals().getCostUsd()).isNull();
    }
}
