package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.AmbientRecall;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Ambient recall off ⇒ no block even with a perfect match on disk (the pre-embed short-circuit itself is by construction — see PromptMemoryAssembler.recall — not observable here). */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.ambient-recall.enabled=false")
class PromptMemoryAssemblerSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRecall_shouldReturnEmpty_whenAmbientRecallDisabled() {
        UUID owner = userPopulator.createUser().getId();
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "tökéletes találat", LocalDate.now().minusDays(1), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), "[fake-embed:1] alvás", LocalDate.now());

        assertThat(recalled).isSameAs(AmbientRecall.EMPTY);
    }
}
