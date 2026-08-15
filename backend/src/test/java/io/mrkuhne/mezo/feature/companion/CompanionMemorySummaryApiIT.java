package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemorySummaryItem;
import io.mrkuhne.mezo.api.dto.MemorySummaryListResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.UUID;

/** Az L1 napló-lista HTTP-kontraktusa (mezo-al1i) — rendezés, tartomány-szűrés, embed-jelző. */
class CompanionMemorySummaryApiIT extends ApiIntegrationTest {

    private static final LocalDate D = LocalDate.of(2026, 8, 1);

    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private MemorySummaryListResponse list(String query) {
        return getForBody("/api/companion/memory/summary" + query, ownerAuthHeaders(),
                HttpStatus.OK, MemorySummaryListResponse.class);
    }

    @Test
    void testListMemorySummaries_shouldOrderDateDescWithEmbedFlags_whenNoRangeGiven() {
        UUID owner = ownerId();
        dailySummaryPopulator.summary(owner, D, "első nap");
        DailySummaryEntity middle = dailySummaryPopulator.summary(owner, D.plusDays(5), "második nap");
        dailySummaryPopulator.summary(owner, D.plusDays(10), "harmadik nap");
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                middle.getId(), "második nap", D.plusDays(5), MemoryEmbeddingPopulator.axisVector(0));

        MemorySummaryListResponse response = list("");

        assertThat(response.getItems()).extracting(MemorySummaryItem::getDate)
                .containsExactly(D.plusDays(10), D.plusDays(5), D);
        assertThat(response.getItems()).extracting(MemorySummaryItem::getEmbedded)
                .containsExactly(false, true, false);
        assertThat(response.getItems().get(1).getNarrative()).isEqualTo("második nap");
    }

    @Test
    void testListMemorySummaries_shouldFilterInclusive_whenRangeGiven() {
        UUID owner = ownerId();
        dailySummaryPopulator.summary(owner, D, "kint");
        dailySummaryPopulator.summary(owner, D.plusDays(5), "bent");
        dailySummaryPopulator.summary(owner, D.plusDays(10), "kint");

        MemorySummaryListResponse response = list("?from=2026-08-02&to=2026-08-08");

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getDate()).isEqualTo(D.plusDays(5));
    }

    @Test
    void testListMemorySummaries_shouldIgnoreForeignRows_whenAnotherUserHasSummaries() {
        dailySummaryPopulator.summary(userPopulator.createUser().getId(), D, "idegen");

        assertThat(list("").getItems()).isEmpty();
    }
}
