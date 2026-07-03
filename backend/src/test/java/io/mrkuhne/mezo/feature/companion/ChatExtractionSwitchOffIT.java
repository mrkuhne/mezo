package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.service.FactExtractionListener;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/** Extraction off ⇒ the listener bean does not exist — no post-turn LLM call can ever happen. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.extraction.enabled=false")
class ChatExtractionSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testListener_shouldNotExist_whenExtractionDisabled() {
        assertThat(context.getBeanProvider(FactExtractionListener.class).getIfAvailable()).isNull();
    }
}
