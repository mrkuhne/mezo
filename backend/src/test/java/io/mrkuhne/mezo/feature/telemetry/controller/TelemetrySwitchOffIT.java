package io.mrkuhne.mezo.feature.telemetry.controller;

import io.mrkuhne.mezo.api.dto.ScreenEventBatchRequest;
import io.mrkuhne.mezo.api.dto.ScreenEventInput;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * With the screen-telemetry switch OFF — the SHIPPED default (spec T2) — the
 * {@code @ConditionalOnProperty} controller and service beans are absent, so the ingest path
 * is a plain 404. The frontend client swallows exactly this.
 */
@TestPropertySource(properties = "mezo.feature.screen-telemetry.enabled=false")
class TelemetrySwitchOffIT extends ApiIntegrationTest {

    @Test
    void testIngest_shouldReturn404_whenSwitchedOff() {
        var body = ScreenEventBatchRequest.builder()
                .events(List.of(ScreenEventInput.builder()
                        .screen("/nap")
                        .occurredAt(OffsetDateTime.now(ZoneOffset.UTC))
                        .build()))
                .build();

        postForBody("/api/telemetry/screen-events", body, ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }

    /**
     * The admin READ side is deliberately NOT gated by this switch (it rides ADMIN_INSIGHTS like
     * every other admin panel): with telemetry off it answers an honest empty 200, so the admin
     * UI never has to special-case a second 404.
     */
    @Test
    void testAdminScreenUsage_shouldStillAnswer200_whenTelemetryIsSwitchedOff() {
        getForBody("/api/admin/usage/screens?period=7d", ownerAuthHeaders(), HttpStatus.OK, String.class);
    }
}
