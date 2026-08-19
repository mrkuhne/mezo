package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.api.dto.UpdateJournalEntryRequest;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The companion-off / journal-on quadrant (whole-branch review Finding 4, bd mezo-b3pp.1, spec
 * §5.1's "both switches honest when off"). With the companion switch off, {@code
 * JournalEmbeddingListener} does not exist — it is {@code @ConditionalOnProperty} array-AND'ed on
 * BOTH the companion and journal switches — so journaling itself must not depend on companion at
 * all: the full CRUD surface answers 2xx and produces ZERO {@code memory_embedding} rows. The
 * {@code ProactiveApiCompanionOffIT} idiom: the context booting with 2xx responses on every verb
 * IS the assertion that no companion-only bean is wired into the journal request path.
 *
 * <p>Companion is enabled by default (see {@code JournalSwitchOffIT} for the journal-off mirror),
 * so only the companion switch needs overriding here.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class JournalApiCompanionOffIT extends ApiIntegrationTest {

    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

    @Test
    void testJournalCrud_shouldSucceedWithNoEmbeddings_whenCompanionSwitchedOff() {
        HttpHeaders auth = ownerAuthHeaders();

        JournalEntryResponse created = postForBody("/api/journal",
                CreateJournalEntryRequest.builder()
                        .text("Companion nélkül is működik.")
                        .occurredOn(LocalDate.parse("2026-08-15"))
                        .source("quickinput")
                        .build(),
                auth, HttpStatus.CREATED, JournalEntryResponse.class);

        List<JournalEntryResponse> afterCreate = getForList(
                "/api/journal?from=2026-08-15&to=2026-08-15", auth, HttpStatus.OK,
                JournalEntryResponse.class);
        assertThat(afterCreate).extracting(JournalEntryResponse::getId).contains(created.getId());

        putForBody("/api/journal/" + created.getId(),
                UpdateJournalEntryRequest.builder().text("Módosítva companion nélkül.").build(),
                auth, HttpStatus.OK, JournalEntryResponse.class);

        deleteAndExpect("/api/journal/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        List<JournalEntryResponse> afterDelete = getForList(
                "/api/journal?from=2026-08-15&to=2026-08-15", auth, HttpStatus.OK,
                JournalEntryResponse.class);
        assertThat(afterDelete).extracting(JournalEntryResponse::getId).doesNotContain(created.getId());

        // The listener bean is entirely absent (both-switches @ConditionalOnProperty), so no async
        // hop is even in flight — a plain synchronous read settles this, no Awaitility needed.
        assertThat(memoryEmbeddingRepository.findAll()).isEmpty();
    }
}
