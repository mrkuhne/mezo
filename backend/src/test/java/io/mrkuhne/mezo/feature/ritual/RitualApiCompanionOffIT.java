package io.mrkuhne.mezo.feature.ritual;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RitualCloseRequest;
import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.api.dto.RitualReflectionRequest;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The companion-off / ritual-on quadrant (bd mezo-b3pp.2, spec §5.2's "both switches honest when
 * off"), the {@code JournalApiCompanionOffIT} idiom. With the companion switch off {@code
 * ReflectionEmbeddingListener} does not exist — it is {@code @ConditionalOnProperty} array-AND'ed
 * on BOTH the companion and the ritual switch — so the Napzárás ritual must not depend on
 * companion at all: reflection + close answer 2xx and produce ZERO {@code memory_embedding} rows.
 *
 * <p>Companion is enabled by default (see {@code RitualSwitchOffIT} for the ritual-off mirror),
 * so only the companion switch needs overriding here.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class RitualApiCompanionOffIT extends ApiIntegrationTest {

    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

    @Test
    void testRitualCloseWithReflection_shouldSucceedWithNoEmbeddings_whenCompanionSwitchedOff() {
        HttpHeaders auth = ownerAuthHeaders();

        RitualDayResponse reflected = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now())
                .text("Companion nélkül is leírom.").build(),
            auth, HttpStatus.OK, RitualDayResponse.class);
        assertThat(reflected.getReflectionText()).isEqualTo("Companion nélkül is leírom.");

        RitualDayResponse closed = postForBody("/api/ritual/close",
            RitualCloseRequest.builder().date(LocalDate.now()).build(),
            auth, HttpStatus.OK, RitualDayResponse.class);
        assertThat(closed.getClosed()).isTrue();

        // a post-close edit is the other publication site — also silent with the listener gone
        putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("Utólag.").build(),
            auth, HttpStatus.OK, RitualDayResponse.class);

        // the listener bean is entirely absent (both-switches @ConditionalOnProperty), so no async
        // hop is even in flight — a plain synchronous read settles this, no Awaitility needed.
        assertThat(memoryEmbeddingRepository.findAll()).isEmpty();
    }
}
