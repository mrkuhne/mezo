package io.mrkuhne.mezo.feature.admin.controller;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Degraded, not dead — but a hard 404 here, unlike {@code AdminAlertsCompanionOffIT} (mezo-k5zy):
 * the install-wide health rollup goes through {@code require(healthQuery)} exactly like the
 * per-user memory ops (see {@code AdminMemoryHealthGraphOffIT}'s
 * {@code testGraph_shouldReturn404Disabled_whenGraphSwitchIsOff}), even though its actual counts
 * come from fixed-table SQL that needs no companion bean.
 */
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=false",
    "mezo.feature.admin-memory.enabled=true"
})
class AdminMemoryGlobalHealthCompanionOffIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/memory/health";

    @Test
    void testGlobalHealth_shouldReturn404Disabled_whenCompanionSwitchIsOff() {
        String body = getForBody(URI, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "ADMIN_MEMORY_DISABLED");
    }
}
