package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** Turn-embedding toggle off ⇒ the listener bean does not exist (no post-turn embedding ever). */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.embedding.embed-chat-turns=false")
class TurnEmbeddingSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoListenerBean_whenEmbedTurnsOff() {
        assertThat(context.getBeanProvider(TurnEmbeddingListener.class).getIfAvailable()).isNull();
    }
}
