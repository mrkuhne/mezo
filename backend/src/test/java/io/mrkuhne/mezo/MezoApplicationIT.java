package io.mrkuhne.mezo;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class MezoApplicationIT extends AbstractIntegrationTest {

    @Autowired
    private DatabasePopulator databasePopulator;

    @Test
    void testContext_shouldLoad_whenStarted() {
        assertThat(databasePopulator).isNotNull();
    }
}
