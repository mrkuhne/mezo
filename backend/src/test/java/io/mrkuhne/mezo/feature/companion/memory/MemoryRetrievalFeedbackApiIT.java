package io.mrkuhne.mezo.feature.companion.memory;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemoryRetrievalFeedbackResponse;
import io.mrkuhne.mezo.api.dto.PutMemoryRetrievalFeedbackRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalFeedbackRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** HTTP ownership and state-transition contract for retrieval-result feedback (mezo-6dii.7). */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.companion.enabled=true")
class MemoryRetrievalFeedbackApiIT extends ApiIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";
    private static final LocalDate AS_OF = LocalDate.of(2026, 9, 5);

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalFeedbackRepository feedbackRepository;
    @Autowired private MemoryContextService contextService;

    @Test
    void testEndpoints_shouldReturn401_whenAuthenticationIsMissing() {
        Fixture fixture = fixture(ownerId(), "Névtelen próba");

        getForBody(feedbackListUri(fixture.result().getId()), null,
                HttpStatus.UNAUTHORIZED, String.class);
        putForBody(feedbackPutUri(fixture.run().getId(), fixture.result().getId()),
                request(MemoryRetrievalFeedbackEntity.ACTION_USEFUL), null,
                HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testPutMemoryRetrievalFeedback_shouldUpsertIdempotently_andSwitchAction() {
        UUID owner = ownerId();
        Fixture fixture = fixture(owner, "A futás után jobban aludtam");
        HttpHeaders auth = ownerAuthHeaders();
        String uri = feedbackPutUri(fixture.run().getId(), fixture.result().getId());

        MemoryRetrievalFeedbackResponse useful = putForBody(uri,
                request(MemoryRetrievalFeedbackEntity.ACTION_USEFUL), auth,
                HttpStatus.OK, MemoryRetrievalFeedbackResponse.class);
        UUID feedbackId = feedbackRepository.findByCreatedByAndResultId(owner, fixture.result().getId())
                .orElseThrow().getId();
        MemoryRetrievalFeedbackResponse repeated = putForBody(uri,
                request(MemoryRetrievalFeedbackEntity.ACTION_USEFUL), auth,
                HttpStatus.OK, MemoryRetrievalFeedbackResponse.class);
        MemoryRetrievalFeedbackResponse irrelevant = putForBody(uri,
                request(MemoryRetrievalFeedbackEntity.ACTION_IRRELEVANT), auth,
                HttpStatus.OK, MemoryRetrievalFeedbackResponse.class);

        assertThat(useful.getRunId()).isEqualTo(fixture.run().getId());
        assertThat(useful.getResultId()).isEqualTo(fixture.result().getId());
        assertThat(useful.getAction().getValue()).isEqualTo(MemoryRetrievalFeedbackEntity.ACTION_USEFUL);
        assertThat(useful.getUpdatedAt()).isNotNull();
        assertThat(repeated.getAction().getValue()).isEqualTo(MemoryRetrievalFeedbackEntity.ACTION_USEFUL);
        assertThat(irrelevant.getAction().getValue()).isEqualTo(MemoryRetrievalFeedbackEntity.ACTION_IRRELEVANT);
        assertThat(feedbackRepository.findByCreatedByAndResultId(owner, fixture.result().getId()))
                .get().extracting(MemoryRetrievalFeedbackEntity::getId).isEqualTo(feedbackId);
        assertThat(feedbackRepository.findAll()).filteredOn(row -> owner.equals(row.getCreatedBy()))
                .hasSize(1);
    }

    @Test
    void testPutMemoryRetrievalFeedback_shouldSerializeConcurrentFirstWrites() throws Exception {
        UUID owner = ownerId();
        Fixture fixture = fixture(owner, "Párhuzamos visszajelzés");
        HttpHeaders auth = ownerAuthHeaders();
        String uri = feedbackPutUri(fixture.run().getId(), fixture.result().getId());
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<ResponseEntity<String>> first = pool.submit(() -> concurrentPut(
                    ready, go, uri, request(MemoryRetrievalFeedbackEntity.ACTION_USEFUL), auth));
            Future<ResponseEntity<String>> second = pool.submit(() -> concurrentPut(
                    ready, go, uri, request(MemoryRetrievalFeedbackEntity.ACTION_IRRELEVANT), auth));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            go.countDown();

            assertThat(first.get(10, TimeUnit.SECONDS).getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(second.get(10, TimeUnit.SECONDS).getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(feedbackRepository.findAll()).filteredOn(row -> owner.equals(row.getCreatedBy()))
                    .hasSize(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void testListMemoryRetrievalFeedback_shouldReturnOnlyOwnedRequestedRows() {
        UUID owner = ownerId();
        Fixture first = fixture(owner, "Első emlék");
        Fixture second = fixture(owner, "Második emlék");
        RegisteredUser other = registerUser("Memory feedback B-user");
        Fixture foreign = fixture(other.id(), "Idegen emlék");
        memoryPopulator.feedback(owner, first.run(), first.result(), first.item(),
                MemoryRetrievalFeedbackEntity.ACTION_USEFUL);
        memoryPopulator.feedback(owner, second.run(), second.result(), second.item(),
                MemoryRetrievalFeedbackEntity.ACTION_IRRELEVANT);
        memoryPopulator.feedback(other.id(), foreign.run(), foreign.result(), foreign.item(),
                MemoryRetrievalFeedbackEntity.ACTION_USEFUL);

        List<MemoryRetrievalFeedbackResponse> found = getForList(
                feedbackListUri(first.result().getId(), second.result().getId(),
                        foreign.result().getId(), UUID.randomUUID()),
                ownerAuthHeaders(), HttpStatus.OK, MemoryRetrievalFeedbackResponse.class);

        assertThat(found).extracting(MemoryRetrievalFeedbackResponse::getResultId)
                .containsExactlyInAnyOrder(first.result().getId(), second.result().getId());
    }

    @Test
    void testPutMemoryRetrievalFeedback_shouldReturn404_whenResultIsForeignOrRunDoesNotMatch() {
        UUID owner = ownerId();
        RegisteredUser other = registerUser("Foreign retrieval owner");
        Fixture foreign = fixture(other.id(), "Más fiók emléke");
        Fixture first = fixture(owner, "Első futás");
        Fixture second = fixture(owner, "Második futás");

        String foreignBody = putForBody(
                feedbackPutUri(foreign.run().getId(), foreign.result().getId()),
                request(MemoryRetrievalFeedbackEntity.ACTION_USEFUL), ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);
        String mismatchBody = putForBody(
                feedbackPutUri(first.run().getId(), second.result().getId()),
                request(MemoryRetrievalFeedbackEntity.ACTION_USEFUL), ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(foreignBody, "RESOURCE_NOT_FOUND");
        assertHasRequestError(mismatchBody, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testPutMemoryRetrievalFeedback_shouldRejectSuppress_whenCandidateHasNoCanonicalMemoryItem() {
        UUID owner = ownerId();
        MemoryRetrievalRunEntity run = memoryPopulator.run(owner, UUID.randomUUID());
        MemoryRetrievalResultEntity result = memoryPopulator.result(owner, run,
                "knowledge_fact", UUID.randomUUID(), null, 1, true,
                "Boglárka a testvérem", AS_OF.minusDays(2), ScoreBreakdownEnvelope.empty());

        String body = putForBody(feedbackPutUri(run.getId(), result.getId()),
                request(MemoryRetrievalFeedbackEntity.ACTION_SUPPRESS), ownerAuthHeaders(),
                HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "MEMORY_RETRIEVAL_SUPPRESS_UNAVAILABLE");
        assertThat(feedbackRepository.findByCreatedByAndResultId(owner, result.getId())).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"useful", "irrelevant", "suppress"})
    void testPutMemoryRetrievalFeedback_shouldReturn404_whenOwnedResultWasNotSelected(String action) {
        UUID owner = ownerId();
        Fixture fixture = fixture(owner, "Nem kiválasztott jelölt", false);

        String body = putForBody(feedbackPutUri(fixture.run().getId(), fixture.result().getId()),
                request(action), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
        assertThat(feedbackRepository.findByCreatedByAndResultId(owner, fixture.result().getId()))
                .isEmpty();
    }

    @Test
    void testPutMemoryRetrievalFeedback_shouldSuppressCanonicalItem_andExcludeItFromNewRetrieval() {
        UUID owner = ownerId();
        Fixture fixture = fixture(owner, "Zöld borókafenyőt láttam a hegyi túrán [fake-embed:1]");
        memoryPopulator.vector(fixture.item(), VERSION, axisVector(0));
        String query = "Mikor láttam a zöld borókafenyőt? [fake-embed:1]";
        MemoryContext before = contextService.retrieve(memoryRequest(owner, query));
        assertThat(before.items()).anyMatch(item -> fixture.item().getId().equals(item.memoryItemId()));

        MemoryRetrievalFeedbackResponse response = putForBody(
                feedbackPutUri(fixture.run().getId(), fixture.result().getId()),
                request(MemoryRetrievalFeedbackEntity.ACTION_SUPPRESS), ownerAuthHeaders(),
                HttpStatus.OK, MemoryRetrievalFeedbackResponse.class);

        assertThat(response.getAction().getValue()).isEqualTo(MemoryRetrievalFeedbackEntity.ACTION_SUPPRESS);
        assertThat(itemRepository.findByIdAndCreatedByAndDeletedFalse(fixture.item().getId(), owner))
                .get().extracting(MemoryItemEntity::getState)
                .isEqualTo(MemoryItemEntity.STATE_SUPPRESSED);
        MemoryContext after = contextService.retrieve(memoryRequest(owner, query));
        assertThat(after.items()).noneMatch(item -> fixture.item().getId().equals(item.memoryItemId()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"useful", "irrelevant"})
    void testPutMemoryRetrievalFeedback_shouldRejectActionChange_afterSuppression(String action) {
        UUID owner = ownerId();
        Fixture fixture = fixture(owner, "Terminálisan tiltott emlék");
        String uri = feedbackPutUri(fixture.run().getId(), fixture.result().getId());
        HttpHeaders auth = ownerAuthHeaders();
        putForBody(uri, request(MemoryRetrievalFeedbackEntity.ACTION_SUPPRESS), auth,
                HttpStatus.OK, MemoryRetrievalFeedbackResponse.class);

        String body = putForBody(uri, request(action), auth,
                HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "MEMORY_RETRIEVAL_SUPPRESSION_FINAL");
        assertThat(feedbackRepository.findByCreatedByAndResultId(owner, fixture.result().getId()))
                .get().extracting(MemoryRetrievalFeedbackEntity::getAction)
                .isEqualTo(MemoryRetrievalFeedbackEntity.ACTION_SUPPRESS);
    }

    @Test
    void testListMemoryRetrievalFeedback_shouldReturn400_whenMoreThan100IdsAreRequested() {
        UUID[] ids = java.util.stream.Stream.generate(UUID::randomUUID)
                .limit(101)
                .toArray(UUID[]::new);

        getForBody(feedbackListUri(ids), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testPutMemoryRetrievalFeedback_shouldReturn400_whenActionIsUnknown() {
        Fixture fixture = fixture(ownerId(), "Érvénytelen művelet");

        String body = putForBody(feedbackPutUri(fixture.run().getId(), fixture.result().getId()),
                request("hide_forever"), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "action", "VALIDATION_INVALID_VALUE");
    }

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private Fixture fixture(UUID owner, String content) {
        return fixture(owner, content, true);
    }

    private Fixture fixture(UUID owner, String content, boolean selected) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                content, AS_OF.minusDays(3));
        MemoryRetrievalRunEntity run = memoryPopulator.run(owner, UUID.randomUUID());
        MemoryRetrievalResultEntity result = memoryPopulator.result(
                owner, run, item, 1, selected, ScoreBreakdownEnvelope.empty());
        return new Fixture(item, run, result);
    }

    private ResponseEntity<String> concurrentPut(
            CountDownLatch ready, CountDownLatch go, String uri,
            PutMemoryRetrievalFeedbackRequest request, HttpHeaders headers) {
        ready.countDown();
        try {
            if (!go.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Concurrent feedback start gate timed out");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Concurrent feedback write interrupted", e);
        }
        return rest.exchange(uri, HttpMethod.PUT, new HttpEntity<>(request, headers), String.class);
    }

    private static MemoryRequest memoryRequest(UUID owner, String query) {
        return new MemoryRequest(owner, ConsumerPolicy.CHAT_AMBIENT, query, List.of(),
                AS_OF, 1200, UUID.randomUUID(), false);
    }

    private static PutMemoryRetrievalFeedbackRequest request(String action) {
        return PutMemoryRetrievalFeedbackRequest.builder().action(action).build();
    }

    private static String feedbackPutUri(UUID runId, UUID resultId) {
        return "/api/companion/memory/retrieval/" + runId + "/result/" + resultId + "/feedback";
    }

    private static String feedbackListUri(UUID... resultIds) {
        return "/api/companion/memory/retrieval-feedback?resultIds="
                + String.join(",", java.util.Arrays.stream(resultIds).map(UUID::toString).toList());
    }

    private record Fixture(
            MemoryItemEntity item,
            MemoryRetrievalRunEntity run,
            MemoryRetrievalResultEntity result) {
    }
}
