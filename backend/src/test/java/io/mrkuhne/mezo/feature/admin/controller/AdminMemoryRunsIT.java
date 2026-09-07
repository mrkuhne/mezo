package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminMemoryCandidate;
import io.mrkuhne.mezo.api.dto.AdminMemoryReplayRequest;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunPageResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunSummary;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.CreatedAtBackdater;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The RAG explorer's read surface (mezo-4qyt.1): owner-only, user-scoped, honest about what a null
 * means. Not transactional — the controller runs in the server's own transactions.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.admin-memory.enabled=true"
})
class AdminMemoryRunsIT extends ApiIntegrationTest {

    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private CreatedAtBackdater backdater;

    // ==== ownership ====

    @Test
    void testRuns_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody(runsUri(anna.id()), anna.headers(), HttpStatus.FORBIDDEN, String.class);

        assertHasRequestError(body, "AUTH_FORBIDDEN");
    }

    @Test
    void testRunDetail_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody("/api/admin/users/" + anna.id() + "/memory/runs/" + UUID.randomUUID(),
                anna.headers(), HttpStatus.FORBIDDEN, String.class);

        assertHasRequestError(body, "AUTH_FORBIDDEN");
    }

    @Test
    void testReplay_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        AdminMemoryReplayRequest request = new AdminMemoryReplayRequest();
        request.setQuery("mit tudsz a futásaimról?");

        String body = postForBody("/api/admin/users/" + anna.id() + "/memory/replay",
                request, anna.headers(), HttpStatus.FORBIDDEN, String.class);

        assertHasRequestError(body, "AUTH_FORBIDDEN");
    }

    // ==== run list ====

    @Test
    void testRuns_shouldPageNewestFirst_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        MemoryRetrievalRunEntity oldest = memoryPopulator.run(anna.id(), UUID.randomUUID());
        MemoryRetrievalRunEntity middle = memoryPopulator.run(anna.id(), UUID.randomUUID());
        MemoryRetrievalRunEntity newest = memoryPopulator.run(anna.id(), UUID.randomUUID());
        Instant now = Instant.now();
        backdate(oldest, now.minus(3, ChronoUnit.HOURS));
        backdate(middle, now.minus(2, ChronoUnit.HOURS));
        backdate(newest, now.minus(1, ChronoUnit.HOURS));

        AdminMemoryRunPageResponse response = getForBody(runsUri(anna.id()) + "?page=0&size=2",
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryRunPageResponse.class);

        assertThat(response.getTotal()).isEqualTo(3L);
        assertThat(response.getPage()).isZero();
        assertThat(response.getSize()).isEqualTo(2);
        assertThat(response.getRetentionDays()).isEqualTo(30);
        assertThat(response.getItems()).extracting(AdminMemoryRunSummary::getId)
                .containsExactly(newest.getId(), middle.getId());
    }

    @Test
    void testRuns_shouldClampOversizedSize_whenRequested() {
        RegisteredUser anna = registerUser("Anna");
        memoryPopulator.run(anna.id(), UUID.randomUUID());

        AdminMemoryRunPageResponse response = getForBody(runsUri(anna.id()) + "?size=9999",
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryRunPageResponse.class);

        // Clamped, never rejected: an oversized page request is a client mistake, not a 400.
        assertThat(response.getSize()).isEqualTo(100);
    }

    @Test
    void testRuns_shouldCarryCandidateAndSelectedCounts_whenRunHasResults() {
        RegisteredUser anna = registerUser("Anna");
        MemoryRetrievalRunEntity run = memoryPopulator.run(anna.id(), UUID.randomUUID());
        MemoryItemEntity item = item(anna.id(), "futás");
        memoryPopulator.result(anna.id(), run, item, 1, true, breakdown(0.9, null));
        memoryPopulator.result(anna.id(), run, "memory_item", UUID.randomUUID(), item, 2, false,
                "alvás", LocalDate.of(2026, 6, 2), breakdown(0.5, null));

        AdminMemoryRunPageResponse response = getForBody(runsUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryRunPageResponse.class);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getCandidateCount()).isEqualTo(2);
        assertThat(response.getItems().getFirst().getSelectedCount()).isEqualTo(1);
    }

    @Test
    void testRuns_shouldNeverLeakAnotherUsersRuns_whenBothHaveRuns() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bea = registerUser("Bea");
        MemoryRetrievalRunEntity annasRun = memoryPopulator.run(anna.id(), UUID.randomUUID());
        memoryPopulator.run(bea.id(), UUID.randomUUID());
        memoryPopulator.run(bea.id(), UUID.randomUUID());

        AdminMemoryRunPageResponse response = getForBody(runsUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryRunPageResponse.class);

        assertThat(response.getTotal()).isEqualTo(1L);
        assertThat(response.getItems()).extracting(AdminMemoryRunSummary::getId)
                .containsExactly(annasRun.getId());
    }

    // ==== run detail ====

    @Test
    void testRunDetail_shouldDecomposeScoresAndDeriveFusionRank_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        MemoryRetrievalRunEntity run = memoryPopulator.run(anna.id(), UUID.randomUUID());
        MemoryItemEntity item = item(anna.id(), "futás");
        // Stored rank order (1,2,3) deliberately differs from the finalScore order (0.4,0.9,0.6):
        // the fusion order is 2 > 3 > 1, which is exactly what a rerank produces.
        memoryPopulator.result(anna.id(), run, "memory_item", UUID.randomUUID(), item, 1, true,
                "a", LocalDate.of(2026, 6, 1), breakdown(0.4, 1.0));
        memoryPopulator.result(anna.id(), run, "memory_item", UUID.randomUUID(), item, 2, true,
                "b", LocalDate.of(2026, 6, 2), breakdown(0.9, 0.5));
        memoryPopulator.result(anna.id(), run, "memory_item", UUID.randomUUID(), item, 3, false,
                "c", LocalDate.of(2026, 6, 3), breakdown(0.6, 1.0 / 3.0));

        AdminMemoryRunDetailResponse detail = getForBody(runDetailUri(anna.id(), run.getId()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryRunDetailResponse.class);

        assertThat(detail.getDryRun()).isFalse();
        assertThat(detail.getRun().getId()).isEqualTo(run.getId());
        assertThat(detail.getCandidates()).extracting(AdminMemoryCandidate::getRank)
                .containsExactly(1, 2, 3);
        assertThat(detail.getCandidates()).extracting(AdminMemoryCandidate::getFusionRank)
                .containsExactly(3, 1, 2);
        assertThat(detail.getCandidates()).extracting(AdminMemoryCandidate::getRerankDelta)
                .containsExactly(2, -1, -1);
        // An absent retriever key stays absent — "did not return it" is not "ranked it 0th".
        assertThat(detail.getCandidates().getFirst().getScoreBreakdown().getRetrieverRanks())
                .containsOnlyKeys("dense")
                .doesNotContainKey("graph");
        assertThat(detail.getFusion().getRrfK()).isEqualTo(60);
        assertThat(detail.getFusion().getRetrieverWeights())
                .containsEntry("dense", 1.0)
                .containsEntry("lexical", 1.0)
                .containsEntry("graph", 1.0)
                .containsEntry("facts", 1.0);
    }

    @Test
    void testRunDetail_shouldReturn404_whenRunWasHardDeletedByRetention() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody(runDetailUri(anna.id(), UUID.randomUUID()),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "ADMIN_MEMORY_RUN_NOT_FOUND");
    }

    @Test
    void testRunDetail_shouldNeverLeakAnotherUsersRun_whenAskedUnderTheWrongUser() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bea = registerUser("Bea");
        MemoryRetrievalRunEntity beasRun = memoryPopulator.run(bea.id(), UUID.randomUUID());

        String body = getForBody(runDetailUri(anna.id(), beasRun.getId()),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "ADMIN_MEMORY_RUN_NOT_FOUND");
    }

    @Test
    void testRunDetail_shouldCarryPromptTrace_whenNewModeMessageReferencesTheRun() {
        RegisteredUser anna = registerUser("Anna");
        MemoryRetrievalRunEntity run = memoryPopulator.run(anna.id(), UUID.randomUUID());
        MemoryItemEntity item = item(anna.id(), "futás");
        memoryPopulator.result(anna.id(), run, item, 1, true, breakdown(0.9, null));
        AiConversationEntity conversation = conversationPopulator.conversation(anna.id());
        messagePopulator.messageWithRecalledMemories(conversation, "assistant", "Emlékszem.",
                new RecalledMemoriesEnvelope(List.of(
                        new RecalledMemoriesEnvelope.Item("memory_item", item.getSourceId(),
                                item.getOccurredOn(), "Futás", "10 km", 0.82,
                                run.getId(), null, item.getId(), "friss"),
                        new RecalledMemoriesEnvelope.Item("memory_item", UUID.randomUUID(),
                                item.getOccurredOn(), "Alvás", "7 óra", 0.61,
                                run.getId(), null, null, null))));

        AdminMemoryRunDetailResponse detail = getForBody(runDetailUri(anna.id(), run.getId()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryRunDetailResponse.class);

        assertThat(detail.getPromptTraceReason()).isNull();
        assertThat(detail.getPromptTrace()).hasSize(2);
        // In prompt order, not re-sorted: the block's order is what the model read.
        assertThat(detail.getPromptTrace().getFirst().getLabel()).isEqualTo("Futás");
        assertThat(detail.getPromptTrace().get(1).getLabel()).isEqualTo("Alvás");
    }

    @Test
    void testRunDetail_shouldExplainNullPromptTrace_whenRunIsShadow() {
        RegisteredUser anna = registerUser("Anna");
        MemoryRetrievalRunEntity run = memoryPopulator.run(anna.id(), UUID.randomUUID(), "SHADOW",
                "árnyékfutás", Map.of("dense", Map.of("durationMs", 9, "candidateCount", 3)));

        AdminMemoryRunDetailResponse detail = getForBody(runDetailUri(anna.id(), run.getId()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryRunDetailResponse.class);

        // A SHADOW run never reached the model by construction: the null is a fact, not a gap.
        assertThat(detail.getPromptTrace()).isNull();
        assertThat(detail.getPromptTraceReason()).isEqualTo("SHADOW_RUN");
        assertThat(detail.getRun().getServingMode()).isEqualTo("SHADOW");
        assertThat(detail.getRun().getRetrieverTrace()).hasSize(1);
        assertThat(detail.getRun().getRetrieverTrace().getFirst().getRetriever()).isEqualTo("dense");
        assertThat(detail.getRun().getShadowEmbeddingVersion()).isNull();
    }

    @Test
    void testRunDetail_shouldExplainNullPromptTrace_whenNewRunHasNoImprint() {
        RegisteredUser anna = registerUser("Anna");
        MemoryRetrievalRunEntity run = memoryPopulator.run(anna.id(), UUID.randomUUID());

        AdminMemoryRunDetailResponse detail = getForBody(runDetailUri(anna.id(), run.getId()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryRunDetailResponse.class);

        assertThat(detail.getPromptTrace()).isNull();
        assertThat(detail.getPromptTraceReason()).isEqualTo("NO_PROMPT_IMPRINT");
    }

    // ==== helpers ====

    private void backdate(MemoryRetrievalRunEntity run, Instant createdAt) {
        backdater.backdate("memory_retrieval_run", run.getId(), createdAt);
    }

    private MemoryItemEntity item(UUID owner, String content) {
        return memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(), content,
                LocalDate.of(2026, 6, 1));
    }

    private static ScoreBreakdownEnvelope breakdown(double finalScore, Double rerankerScore) {
        return new ScoreBreakdownEnvelope(Map.of("dense", 1), 0.02, 0.0, 0.0, 0.0, 0.0, 0.0,
                rerankerScore, finalScore);
    }

    private static String runsUri(UUID userId) {
        return "/api/admin/users/" + userId + "/memory/runs";
    }

    private static String runDetailUri(UUID userId, UUID runId) {
        return runsUri(userId) + "/" + runId;
    }
}
