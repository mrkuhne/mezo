package io.mrkuhne.mezo.techcore.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * mezo-ibxy: actuator lives on a SEPARATE management port (cluster-internal, no JWT).
 * health + prometheus are open there; on the app port they are not mapped at all, so the
 * JWT chain answers 401 like for any unknown path.
 */
class ManagementPortIT extends ApiIntegrationTest {

    @LocalManagementPort
    int managementPort;

    @Test
    void prometheusIsOpenOnManagementPort() {
        ResponseEntity<String> r = rest.getRestTemplate()
            .getForEntity("http://localhost:" + managementPort + "/actuator/prometheus", String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(r.getBody()).contains("jvm_memory_used_bytes");
        assertThat(r.getBody()).contains("application=\"mezo-backend\"");
    }

    @Test
    void healthIsOpenOnManagementPort() {
        ResponseEntity<String> r = rest.getRestTemplate()
            .getForEntity("http://localhost:" + managementPort + "/actuator/health", String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void prometheusIsNotServedOnAppPort() {
        ResponseEntity<String> r = rest.getForEntity("/actuator/prometheus", String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
