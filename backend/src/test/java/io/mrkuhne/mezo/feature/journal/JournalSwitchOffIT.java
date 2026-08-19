package io.mrkuhne.mezo.feature.journal;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the journal switch OFF, the @ConditionalOnProperty controller (and service) are absent -> 404. */
@TestPropertySource(properties = "mezo.feature.journal.enabled=false")
class JournalSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testJournalSurface_shouldReturn404_whenSwitchedOff() {
        getForBody("/api/journal?from=2026-08-01&to=2026-08-18", ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, Void.class);
        postForBody("/api/journal",
            CreateJournalEntryRequest.builder().text("Bármi.").source("quickinput").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
