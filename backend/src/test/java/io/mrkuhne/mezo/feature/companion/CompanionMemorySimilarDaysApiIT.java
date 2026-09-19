package io.mrkuhne.mezo.feature.companion;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.blendVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SimilarDayItem;
import io.mrkuhne.mezo.api.dto.SimilarDaysResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A hasonló-nap kereső HTTP-kontraktusa (mezo-al1i; mezo-eq85.10-től a memória-platformot hívja
 * SIMILAR_DAYS policy-vel, {@code memory_item}/{@code memory_vector} felett — nincs többé
 * {@code similarity}/{@code finalScore} a válaszban, csak rangsor + kivonat-vágás + validáció).
 */
@ActiveProfiles("companion-fake")
class CompanionMemorySimilarDaysApiIT extends ApiIntegrationTest {

    /** A query fake-embeddingje pontosan a 0. tengely — a koszinusz kézzel számolható. */
    private static final String AXIS0_QUERY = "[fake-embed:1] rossz alvás edzés után";
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private SimilarDaysResponse search(String q, String kQuery) {
        return getForBody("/api/companion/memory/similar-days?q=" + q + kQuery,
                ownerAuthHeaders(), HttpStatus.OK, SimilarDaysResponse.class);
    }

    private MemoryItemEntity item(UUID owner, String sourceKind, String content, LocalDate occurredOn,
                                  float[] vector) {
        MemoryItemEntity entity = memoryItemPopulator.item(owner, sourceKind, UUID.randomUUID(),
                null, content, occurredOn, new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        memoryItemPopulator.vector(entity, VERSION, vector);
        return entity;
    }

    @Test
    void testSearchSimilarDays_shouldRankExactMatchFirst_whenVectorsSeeded() {
        UUID owner = ownerId();
        LocalDate exact = LocalDate.now().minusDays(1);
        LocalDate blend = LocalDate.now().minusDays(3);
        MemoryItemEntity exactItem = item(owner, "daily_summary", "pontos nap", exact, axisVector(0));
        MemoryItemEntity blendItem = item(owner, "daily_summary", "kevert nap", blend, blendVector(0, 1));

        SimilarDaysResponse response = search(AXIS0_QUERY, "&k=5");

        assertThat(response.getItems()).hasSize(2);
        SimilarDayItem first = response.getItems().getFirst();
        assertThat(first.getDate()).isEqualTo(exact);
        assertThat(first.getRank()).isEqualTo(1);
        assertThat(first.getMemoryItemId()).isEqualTo(exactItem.getId());
        SimilarDayItem second = response.getItems().get(1);
        assertThat(second.getDate()).isEqualTo(blend);
        assertThat(second.getRank()).isEqualTo(2);
        assertThat(second.getMemoryItemId()).isEqualTo(blendItem.getId());
        assertThat(response.getRetrievalRunId()).isNotNull();
    }

    @Test
    void testSearchSimilarDays_shouldExcludeNonDailySummaryItems_whenOnlyOtherKindsExist() {
        item(ownerId(), "journal_entry", "napló, nem nap", LocalDate.now().minusDays(2), axisVector(0));

        assertThat(search(AXIS0_QUERY, "").getItems()).isEmpty();
    }

    /**
     * mezo-eq85.10 fix round 1, FIX 2 — the restored
     * {@code testSearchSimilarDays_shouldReturnEmptyList_whenNothingAboveFloor} the swap deleted.
     * The retired engine's own words: an honest "nincs adat" beats a fabricated resemblance, and
     * {@code companion.yml} still promises this surface an "őszinte üres lista". The day's text
     * shares no trigram with the query, so the lexical retriever's own {@code score > 0} floor
     * already excludes it — the raw cosine (0.20, under {@code recall.min-similarity} = 0.25) is
     * the only thing deciding here.
     */
    @Test
    void testSearchSimilarDays_shouldReturnEmptyList_whenNothingAboveFloor() {
        item(ownerId(), "daily_summary", "Qxwj zvbk pmhg tdfl kryn.",
                LocalDate.now().minusDays(2), cosineVector(0.20f));

        assertThat(search(AXIS0_QUERY, "").getItems()).isEmpty();
    }

    /** The control: the same lexically unreachable day, just above the floor, still comes back. */
    @Test
    void testSearchSimilarDays_shouldReturnTheDay_whenItIsAboveTheFloor() {
        item(ownerId(), "daily_summary", "Qxwj zvbk pmhg tdfl kryn.",
                LocalDate.now().minusDays(2), cosineVector(0.40f));

        assertThat(search(AXIS0_QUERY, "").getItems())
                .extracting(SimilarDayItem::getExcerpt).containsExactly("Qxwj zvbk pmhg tdfl kryn.");
    }

    /** A unit vector whose cosine to the 0. axis (the query's fake embedding) is {@code cosine}. */
    private static float[] cosineVector(float cosine) {
        float[] vector = axisVector(1);
        vector[0] = cosine;
        vector[1] = (float) Math.sqrt(1.0 - (double) cosine * cosine);
        return vector;
    }

    @Test
    void testSearchSimilarDays_shouldCapExcerpt_whenNarrativeLongerThanRenderMax() {
        String longContent = "x".repeat(400);
        item(ownerId(), "daily_summary", longContent, LocalDate.now().minusDays(1), axisVector(0));

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
