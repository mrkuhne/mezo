package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.feature.companion.embedding.DecisionEmbeddingListener;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The companion-off / journal-on quadrant for the W1.4 decision surface (bd mezo-b3pp.4,
 * assigned in Task 2 review), mirroring {@link JournalApiCompanionOffIT}: with the companion
 * switch off, {@link DecisionEmbeddingListener} does not exist — it is {@code
 * @ConditionalOnProperty} array-AND'ed on BOTH the companion and journal switches — so recording a
 * decision must not depend on companion at all. {@code DecisionService.captureSnapshot} degrades
 * honestly (empty {@code snapshotText}, never fabricated — IDENT-3) instead of failing the write,
 * and no {@code memory_embedding} row is produced.
 *
 * <p>Companion is enabled by default (see the journal-off mirror for the other switch), so only
 * the companion switch needs overriding here.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class DecisionApiCompanionOffIT extends ApiIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private DecisionEntryRepository decisionEntryRepository;

    @Test
    void testContext_shouldHaveNoDecisionEmbeddingListenerBean_whenCompanionSwitchedOff() {
        assertThat(context.getBeanProvider(DecisionEmbeddingListener.class).getIfAvailable()).isNull();
    }

    @Test
    void testCreateDecisionEntry_shouldSucceedWithEmptySnapshotAndNoEmbedding_whenCompanionSwitchedOff() {
        HttpHeaders auth = ownerAuthHeaders();

        DecisionEntryResponse created = postForBody("/api/journal/decision",
                CreateDecisionEntryRequest.builder()
                        .decisionText("Companion nélkül is rögzíthető döntés.")
                        .decidedOn(LocalDate.parse("2026-08-20"))
                        .build(),
                auth, HttpStatus.CREATED, DecisionEntryResponse.class);

        // Honest degraded state (IDENT-3): with no ContextSnapshotAssembler bean, the service
        // stores an EMPTY snapshotText rather than fabricating or failing the write.
        DecisionEntryEntity stored = decisionEntryRepository.findById(created.getId()).orElseThrow();
        assertThat(stored.getContextSnapshot().snapshotText()).isEmpty();

        // The listener bean is entirely absent (both-switches @ConditionalOnProperty), so no async
        // hop is even in flight — a plain synchronous read settles this, no Awaitility needed.
        assertThat(memoryEmbeddingRepository.findAll()).isEmpty();
    }
}
