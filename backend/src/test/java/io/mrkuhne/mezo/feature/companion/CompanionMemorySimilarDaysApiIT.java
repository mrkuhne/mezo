package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.SimilarDayItem;
import io.mrkuhne.mezo.api.dto.SimilarDaysResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.UUID;

/** A hasonló-nap kereső HTTP-kontraktusa (mezo-al1i) — rangsor, floor, kivonat-vágás, validáció. */
@ActiveProfiles("companion-fake")
class CompanionMemorySimilarDaysApiIT extends ApiIntegrationTest {

    /** A query fake-embeddingje pontosan a 0. tengely — a koszinusz kézzel számolható. */
    private static final String AXIS0_QUERY = "[fake-embed:1] rossz alvás edzés után";

    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private SimilarDaysResponse search(String q, String kQuery) {
        return getForBody("/api/companion/memory/similar-days?q=" + q + kQuery,
                ownerAuthHeaders(), HttpStatus.OK, SimilarDaysResponse.class);
    }

    @Test
    void testSearchSimilarDays_shouldRankBySimilarityAndDropOrthogonal_whenVectorsSeeded() {
        UUID owner = ownerId();
        LocalDate exact = LocalDate.now().minusDays(1);
        LocalDate blend = LocalDate.now().minusDays(3);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, exact, 0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "kevert nap", blend, MemoryEmbeddingPopulator.blendVector(0, 1));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                LocalDate.now().minusDays(5), 1); // ortogonális — a floor kiejti

        SimilarDaysResponse response = search(AXIS0_QUERY, "&k=5");

        assertThat(response.getItems()).hasSize(2);
        SimilarDayItem first = response.getItems().getFirst();
        assertThat(first.getDate()).isEqualTo(exact);
        assertThat(first.getSimilarity()).isCloseTo(1.0, within(1e-6));
        assertThat(first.getFinalScore()).isLessThanOrEqualTo(first.getSimilarity());
        SimilarDayItem second = response.getItems().get(1);
        assertThat(second.getDate()).isEqualTo(blend);
        assertThat(second.getSimilarity()).isCloseTo(0.7071, within(1e-3));
    }

    @Test
    void testSearchSimilarDays_shouldReturnEmptyList_whenNothingAboveFloor() {
        memoryEmbeddingPopulator.embedding(ownerId(), MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                LocalDate.now().minusDays(2), 1);

        assertThat(search(AXIS0_QUERY, "").getItems()).isEmpty();
    }

    @Test
    void testSearchSimilarDays_shouldCapExcerpt_whenNarrativeLongerThanRenderMax() {
        String longContent = "x".repeat(400);
        memoryEmbeddingPopulator.embedding(ownerId(), MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), longContent, LocalDate.now().minusDays(1),
                MemoryEmbeddingPopulator.axisVector(0));

        SimilarDayItem item = search(AXIS0_QUERY, "").getItems().getFirst();

        assertThat(item.getExcerpt()).hasSize(301).endsWith("…");
    }

    @Test
    void testSearchSimilarDays_shouldReturn400_whenQBlankOrKOutOfBounds() {
        exchangeForResponse(org.springframework.http.HttpMethod.GET,
                "/api/companion/memory/similar-days?q=", null, ownerAuthHeaders());
        // a státusz-asszertekhez a nyers exchange kell — mindkét ág 400
        assertThat(exchangeForResponse(org.springframework.http.HttpMethod.GET,
                "/api/companion/memory/similar-days?q=", null, ownerAuthHeaders())
                .getStatusCode().value()).isEqualTo(400);
        assertThat(exchangeForResponse(org.springframework.http.HttpMethod.GET,
                "/api/companion/memory/similar-days?q=valami&k=9", null, ownerAuthHeaders())
                .getStatusCode().value()).isEqualTo(400);
    }
}
