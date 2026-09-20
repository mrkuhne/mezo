package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterReplyEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterPortraitRevisionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterReplyRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterPromptAssembler;
import io.mrkuhne.mezo.feature.character.service.CharacterReplyEvaluation;
import io.mrkuhne.mezo.feature.character.service.CharacterReplyProcessing;
import io.mrkuhne.mezo.feature.character.service.ClaimLifecycle;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@ActiveProfiles("companion-fake")
@Import(CharacterReplyPopulator.class)
class CharacterReplyApiIT extends ApiIntegrationTest {
    @Autowired private CharacterReplyPopulator data;
    @Autowired private OwnerProperties owner;

    private UUID ownerId() {
        return databasePopulator.populateUser(owner.ownerEmail());
    }

    @Test
    void testCreate_shouldRejectUnknownSource_whenAuthenticated() {
        String result =
                postForBody(
                        "/api/character/replies",
                        Map.of(
                                "sourceType",
                                "OBSERVATION",
                                "sourceId",
                                UUID.randomUUID(),
                                "clientRequestId",
                                UUID.randomUUID(),
                                "text",
                                "Pontosítás"),
                        ownerAuthHeaders(),
                        HttpStatus.NOT_FOUND,
                        String.class);
        assertHasRequestError(result, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testCreate_shouldSaveSnapshotAndDeduplicate_whenRetried() {
        var claim = data.claim(ownerId());
        var headers = ownerAuthHeaders();
        var request =
                Map.of(
                        "sourceType",
                        "CLAIM",
                        "sourceId",
                        claim.getId(),
                        "clientRequestId",
                        UUID.randomUUID(),
                        "text",
                        "Csak hétvégén edzek.");
        var first =
                postForBody("/api/character/replies", request, headers, HttpStatus.OK, Map.class);
        var second =
                postForBody("/api/character/replies", request, headers, HttpStatus.OK, Map.class);
        assertThat(first.get("id")).isEqualTo(second.get("id"));
        assertThat(first.get("sourceText")).isEqualTo(claim.getText());
        var thread =
                getForList(
                        "/api/character/replies?sourceType=CLAIM&sourceId=" + claim.getId(),
                        headers,
                        HttpStatus.OK,
                        Map.class);
        assertThat(thread).hasSize(1);
    }

    @Test
    void testEndpoints_shouldHideOwnedResources_whenOtherUserCalls() {
        var claim = data.claim(ownerId());
        var own = ownerAuthHeaders();
        var other = registerUser("reply-other").headers();
        var request =
                Map.of(
                        "sourceType",
                        "CLAIM",
                        "sourceId",
                        claim.getId(),
                        "clientRequestId",
                        UUID.randomUUID(),
                        "text",
                        "Válasz");
        var reply = postForBody("/api/character/replies", request, own, HttpStatus.OK, Map.class);
        postForBody("/api/character/replies", request, other, HttpStatus.NOT_FOUND, String.class);
        getForBody(
                "/api/character/replies?sourceType=CLAIM&sourceId=" + claim.getId(),
                other,
                HttpStatus.NOT_FOUND,
                String.class);
        postForBody(
                "/api/character/replies/" + reply.get("id") + "/retry",
                null,
                other,
                HttpStatus.NOT_FOUND,
                String.class);
        postForBody("/api/character/replies", request, null, HttpStatus.UNAUTHORIZED, String.class);
        getForBody(
                "/api/character/replies?sourceType=CLAIM&sourceId=" + claim.getId(),
                null,
                HttpStatus.UNAUTHORIZED,
                String.class);
        postForBody(
                "/api/character/replies/" + reply.get("id") + "/retry",
                null,
                null,
                HttpStatus.UNAUTHORIZED,
                String.class);
    }

    @Autowired private CharacterClaimRepository claims;
    @Autowired private CharacterReplyRepository replies;
    @Autowired private CharacterObservationRepository observations;
    @Autowired private CharacterPortraitRevisionRepository portraits;

    @Test
    void testProcessing_shouldUpdateClaimPortraitAndMemoryExactlyOnce_whenSuccessful()
            throws Exception {
        var claim = data.claim(ownerId());
        var headers = ownerAuthHeaders();
        var request =
                Map.of(
                        "sourceType",
                        "CLAIM",
                        "sourceId",
                        claim.getId(),
                        "clientRequestId",
                        UUID.randomUUID(),
                        "text",
                        "Csak hétvégén edzek.");
        var response =
                postForBody("/api/character/replies", request, headers, HttpStatus.OK, Map.class);
        UUID id = UUID.fromString((String) response.get("id"));
        var reply = awaitFinished(id);
        assertThat(reply.getStatus()).isEqualTo("COMPLETED");
        assertThat(reply.getOutcome()).isEqualTo("UPDATED");
        var updated = claims.findById(claim.getId()).orElseThrow();
        assertThat(updated.getText()).startsWith("Saját beszámolód szerint");
        assertThat(updated.getEvidence().refs())
                .singleElement()
                .satisfies(r -> assertThat(r.id()).isEqualTo(id.toString()));
        assertThat(portraits.findAll()).hasSize(1);
        postForBody(
                "/api/character/replies/" + id + "/retry", null, headers, HttpStatus.OK, Map.class);
        assertThat(portraits.findAll()).hasSize(1);
        assertThat(observations.findAll()).hasSize(1);
    }

    private CharacterReplyEntity awaitFinished(UUID id) throws Exception {
        for (int n = 0; n < 100; n++) {
            var r = replies.findById(id).orElseThrow();
            if (!List.of("SAVED", "PROCESSING").contains(r.getStatus())) return r;
            Thread.sleep(50);
        }
        throw new AssertionError("Reply did not finish");
    }

    @Autowired private CharacterReplyProcessing processing;
    @Autowired private CharacterReplyEvaluation evaluation;
    @Autowired private CharacterPromptAssembler prompts;
    @Autowired private FakeCompanionLlm fake;
    @Autowired private MemoryEmbeddingRepository memory;
    @Autowired private MemoryItemRepository canonical;

    @Test
    void testSources_shouldExposeStableIdentityAndHideOtherOwner_whenObservationOrConference() {
        UUID ownerId = ownerId();
        var claim = data.claim(ownerId);
        var observation = data.observation(ownerId);
        var conference = data.conference(ownerId, claim);
        var own = ownerAuthHeaders();
        var other = registerUser("reply-sources").headers();
        for (var source :
                List.of(
                        Map.of("sourceType", "OBSERVATION", "sourceId", observation.getId()),
                        Map.of(
                                "sourceType",
                                "CONFERENCE_CHANGE",
                                "sourceId",
                                conference.getId()))) {
            var body = new HashMap<String, Object>(source);
            body.put("clientRequestId", UUID.randomUUID());
            body.put("text", "[fake-reply-clarify]");
            postForBody("/api/character/replies", body, own, HttpStatus.OK, Map.class);
            postForBody("/api/character/replies", body, other, HttpStatus.NOT_FOUND, String.class);
            getForBody(
                    "/api/character/replies?sourceType="
                            + source.get("sourceType")
                            + "&sourceId="
                            + source.get("sourceId"),
                    other,
                    HttpStatus.NOT_FOUND,
                    String.class);
            body.put("sourceIndex", 1);
            postForBody("/api/character/replies", body, own, HttpStatus.NOT_FOUND, String.class);
        }
        var feed = getForList("/api/character/feed", own, HttpStatus.OK, Map.class);
        assertThat(feed)
                .allSatisfy(
                        item ->
                                assertThat(item)
                                        .containsKeys("sourceType", "sourceId", "sourceIndex"));
    }

    @Test
    void testCreate_shouldRejectChangedContent_whenClientKeyReused() {
        var c = data.claim(ownerId());
        var key = UUID.randomUUID();
        var h = ownerAuthHeaders();
        var body =
                new HashMap<String, Object>(
                        Map.of(
                                "sourceType",
                                "CLAIM",
                                "sourceId",
                                c.getId(),
                                "clientRequestId",
                                key,
                                "text",
                                "Első válasz"));
        postForBody("/api/character/replies", body, h, HttpStatus.OK, Map.class);
        body.put("text", "Másik válasz");
        postForBody("/api/character/replies", body, h, HttpStatus.CONFLICT, String.class);
        body.put("clientRequestId", UUID.randomUUID());
        body.put("text", "   ");
        postForBody("/api/character/replies", body, h, HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testFailure_shouldKeepSelfReportAndRetryWithoutDuplication_whenModelUnavailable()
            throws Exception {
        UUID own = ownerId();
        var c = data.claim(own);
        var h = ownerAuthHeaders();
        var body =
                Map.of(
                        "sourceType",
                        "CLAIM",
                        "sourceId",
                        c.getId(),
                        "clientRequestId",
                        UUID.randomUUID(),
                        "text",
                        "[fake-fail] Csak hétvégén.");
        var response = postForBody("/api/character/replies", body, h, HttpStatus.OK, Map.class);
        UUID id = UUID.fromString((String) response.get("id"));
        assertThat(awaitFinished(id).getStatus()).isEqualTo("FAILED");
        postForBody("/api/character/replies/" + id + "/retry", null, h, HttpStatus.OK, Map.class);
        assertThat(awaitFinished(id).getStatus()).isEqualTo("FAILED");
        assertThat(replies.findAll()).hasSize(1);
        assertThat(observations.findAll()).hasSize(1);
        assertThat(claims.findById(c.getId()).orElseThrow().getText()).isEqualTo(c.getText());
        assertThat(memory.findByKindAndRefId("character_reply", id)).isPresent();
        assertThat(
                        canonical.findByCreatedByAndSourceKindAndSourceIdOrderByChunkIndex(
                                own, "character_reply", id))
                .hasSize(1);
        assertThat(prompts.render(own)).contains("Felhasználói önbeszámoló", "Csak hétvégén");
    }

    @Test
    void testEvaluation_shouldIncludePriorThreadAndRejectStaleClaim_whenClaimChangesDuringCall() {
        UUID own = ownerId();
        var c = data.claim(own);
        var first = data.savedReply(own, c, "Az előző hozzászólásom.");
        first.setStatus("NEEDS_CLARIFICATION");
        first.setOutcome("NEEDS_CLARIFICATION");
        first.setOutcomeText("Melyik napokon?");
        replies.saveAndFlush(first);
        var second = data.savedReply(own, c, "Szombaton.");
        var lease = processing.claim(own, second.getId());
        var verdict = evaluation.evaluate(lease);
        assertThat(fake.lastUserMessage())
                .contains(
                        "Az előző hozzászólásom.",
                        "Melyik napokon?",
                        "sourceEvidence",
                        "currentClaim");
        c.setText("A konferencia közben módosította.");
        claims.saveAndFlush(c);
        Assertions.assertThatThrownBy(() -> processing.complete(lease, verdict))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(claims.findById(c.getId()).orElseThrow().getText())
                .isEqualTo("A konferencia közben módosította.");
    }

    @Test
    void testRetry_shouldFenceOldWorker_whenProcessingLeaseExpired() throws Exception {
        UUID own = ownerId();
        var c = data.claim(own);
        var r = data.savedReply(own, c, "Hétvégén.");
        var old = processing.claim(own, r.getId());
        var verdict = evaluation.evaluate(old);
        var current = replies.findById(r.getId()).orElseThrow();
        current.setProcessingStartedAt(Instant.now().minusSeconds(600));
        replies.saveAndFlush(current);
        postForBody(
                "/api/character/replies/" + r.getId() + "/retry",
                null,
                ownerAuthHeaders(),
                HttpStatus.OK,
                Map.class);
        assertThat(awaitFinished(r.getId()).getStatus()).isEqualTo("COMPLETED");
        processing.complete(old, verdict);
        assertThat(claims.findById(c.getId()).orElseThrow().getEvidence().refs()).hasSize(1);
        assertThat(portraits.findAll()).hasSize(1);
    }

    @Test
    void testProcessing_shouldExposeHonestOutcome_whenWithdrawnUnchangedOrClarification()
            throws Exception {
        var h = ownerAuthHeaders();
        for (String outcome : List.of("WITHDRAWN", "UNCHANGED", "NEEDS_CLARIFICATION")) {
            var c = data.claim(ownerId());
            String marker =
                    switch (outcome) {
                        case "WITHDRAWN" -> "[fake-reply-withdraw]";
                        case "UNCHANGED" -> "[fake-reply-unchanged]";
                        default -> "[fake-reply-clarify]";
                    };
            var response =
                    postForBody(
                            "/api/character/replies",
                            Map.of(
                                    "sourceType",
                                    "CLAIM",
                                    "sourceId",
                                    c.getId(),
                                    "clientRequestId",
                                    UUID.randomUUID(),
                                    "text",
                                    marker),
                            h,
                            HttpStatus.OK,
                            Map.class);
            var r = awaitFinished(UUID.fromString((String) response.get("id")));
            assertThat(r.getOutcome()).isEqualTo(outcome);
            assertThat(r.getStatus())
                    .isEqualTo("NEEDS_CLARIFICATION".equals(outcome) ? outcome : "COMPLETED");
            assertThat(claims.findById(c.getId()).orElseThrow().getStatus())
                    .isEqualTo("WITHDRAWN".equals(outcome) ? "RETIRED" : "ACTIVE");
        }
    }

    @Test
    void testCreate_shouldDeduplicateConcurrentRequests_whenSameClientKey() throws Exception {
        var c = data.claim(ownerId());
        var h = ownerAuthHeaders();
        var request =
                Map.of(
                        "sourceType",
                        "CLAIM",
                        "sourceId",
                        c.getId(),
                        "clientRequestId",
                        UUID.randomUUID(),
                        "text",
                        "[fake-reply-unchanged]");
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a =
                    executor.submit(
                            () ->
                                    postForBody(
                                            "/api/character/replies",
                                            request,
                                            h,
                                            HttpStatus.OK,
                                            Map.class));
            var b =
                    executor.submit(
                            () ->
                                    postForBody(
                                            "/api/character/replies",
                                            request,
                                            h,
                                            HttpStatus.OK,
                                            Map.class));
            assertThat(a.get().get("id")).isEqualTo(b.get().get("id"));
        }
        assertThat(replies.findAll()).hasSize(1);
        assertThat(observations.findAll()).hasSize(1);
    }

    @Test
    void testFollowUp_shouldUpdateSameGeneratedClaim_whenSourceIsObservation() throws Exception {
        UUID own = ownerId();
        data.claim(own);
        var source = data.observation(own);
        var h = ownerAuthHeaders();
        var first =
                postForBody(
                        "/api/character/replies",
                        Map.of(
                                "sourceType",
                                "OBSERVATION",
                                "sourceId",
                                source.getId(),
                                "clientRequestId",
                                UUID.randomUUID(),
                                "text",
                                "Hétvégén."),
                        h,
                        HttpStatus.OK,
                        Map.class);
        var firstReply = awaitFinished(UUID.fromString((String) first.get("id")));
        assertThat(firstReply.getStatus()).isEqualTo("COMPLETED");
        assertThat(firstReply.getClaimId()).isNotNull();
        var second =
                postForBody(
                        "/api/character/replies",
                        Map.of(
                                "sourceType",
                                "OBSERVATION",
                                "sourceId",
                                source.getId(),
                                "clientRequestId",
                                UUID.randomUUID(),
                                "text",
                                "[fake-reply-withdraw]"),
                        h,
                        HttpStatus.OK,
                        Map.class);
        var secondReply = awaitFinished(UUID.fromString((String) second.get("id")));
        assertThat(secondReply.getOutcome()).isEqualTo("WITHDRAWN");
        assertThat(secondReply.getClaimId()).isEqualTo(firstReply.getClaimId());
        assertThat(claims.findAll()).hasSize(2);
        assertThat(claims.findById(firstReply.getClaimId()).orElseThrow().getStatus())
                .isEqualTo("RETIRED");
    }

    @Autowired private PlatformTransactionManager transactions;
    @Autowired private ClaimLifecycle lifecycle;

    @Test
    void testWeeklyWriter_shouldPreserveCorrection_whenItLoadedClaimBeforeReply() throws Exception {
        UUID own = ownerId();
        var c = data.claim(own);
        var h = ownerAuthHeaders();
        var loaded = new CountDownLatch(1);
        var corrected = new CountDownLatch(1);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var weekly =
                    executor.submit(
                            () ->
                                    new TransactionTemplate(transactions)
                                            .execute(
                                                    status -> {
                                                        var cached =
                                                                claims.findById(c.getId())
                                                                        .orElseThrow();
                                                        loaded.countDown();
                                                        try {
                                                            if (!corrected.await(
                                                                    10, TimeUnit.SECONDS))
                                                                throw new AssertionError(
                                                                        "reply timeout");
                                                        } catch (InterruptedException e) {
                                                            throw new IllegalStateException(e);
                                                        }
                                                        var proposal =
                                                                new io.mrkuhne.mezo.feature
                                                                        .character.service
                                                                        .ClaimProposal(
                                                                        "drill",
                                                                        "UP",
                                                                        "discipline",
                                                                        c.getId(),
                                                                        cached.getText(),
                                                                        new java.math.BigDecimal(
                                                                                "0.60"),
                                                                        false,
                                                                        "new evidence");
                                                        lifecycle.apply(
                                                                own,
                                                                UUID.randomUUID(),
                                                                List.of(
                                                                        new io.mrkuhne.mezo.feature
                                                                                .character.service
                                                                                .ClaimRuling(
                                                                                proposal,
                                                                                true,
                                                                                new java.math
                                                                                        .BigDecimal(
                                                                                        "0.60"),
                                                                                "weekly")));
                                                        return null;
                                                    }));
            assertThat(loaded.await(5, TimeUnit.SECONDS)).isTrue();
            try {
                var response =
                        postForBody(
                                "/api/character/replies",
                                Map.of(
                                        "sourceType",
                                        "CLAIM",
                                        "sourceId",
                                        c.getId(),
                                        "clientRequestId",
                                        UUID.randomUUID(),
                                        "text",
                                        "Hétvégén."),
                                h,
                                HttpStatus.OK,
                                Map.class);
                assertThat(awaitFinished(UUID.fromString((String) response.get("id"))).getStatus())
                        .isEqualTo("COMPLETED");
            } finally {
                corrected.countDown();
            }
            weekly.get();
        }
        var current = claims.findById(c.getId()).orElseThrow();
        assertThat(current.getText()).startsWith("Saját beszámolód szerint");
        assertThat(current.getEvidence().refs()).hasSize(1);
    }

    @Test
    void testPortrait_shouldSerializeVersions_whenTwoClaimsCorrectedConcurrently()
            throws Exception {
        UUID own = ownerId();
        var a = data.claim(own);
        var b = data.claim(own);
        var h = ownerAuthHeaders();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var ids =
                    executor.invokeAll(
                            List.of(
                                    () ->
                                            postForBody(
                                                    "/api/character/replies",
                                                    Map.of(
                                                            "sourceType",
                                                            "CLAIM",
                                                            "sourceId",
                                                            a.getId(),
                                                            "clientRequestId",
                                                            UUID.randomUUID(),
                                                            "text",
                                                            "Hétvégén."),
                                                    h,
                                                    HttpStatus.OK,
                                                    Map.class),
                                    () ->
                                            postForBody(
                                                    "/api/character/replies",
                                                    Map.of(
                                                            "sourceType",
                                                            "CLAIM",
                                                            "sourceId",
                                                            b.getId(),
                                                            "clientRequestId",
                                                            UUID.randomUUID(),
                                                            "text",
                                                            "Szombaton."),
                                                    h,
                                                    HttpStatus.OK,
                                                    Map.class)));
            for (var id : ids)
                assertThat(
                                awaitFinished(
                                                UUID.fromString(
                                                        (String) ((Map<?, ?>) id.get()).get("id")))
                                        .getStatus())
                        .isEqualTo("COMPLETED");
        }
        assertThat(portraits.findAll())
                .extracting(p -> p.getVersion())
                .containsExactlyInAnyOrder(1, 2);
        assertThat(claims.findById(a.getId()).orElseThrow().getEvidence().refs()).hasSize(1);
        assertThat(claims.findById(b.getId()).orElseThrow().getEvidence().refs()).hasSize(1);
    }

    @Test
    void testFeed_shouldKeepRepliesInsideTheirThread_whenLimitWouldOtherwiseHideSource()
            throws Exception {
        UUID own = ownerId();
        data.claim(own);
        var source = data.observation(own);
        var h = ownerAuthHeaders();
        var response =
                postForBody(
                        "/api/character/replies",
                        Map.of(
                                "sourceType",
                                "OBSERVATION",
                                "sourceId",
                                source.getId(),
                                "clientRequestId",
                                UUID.randomUUID(),
                                "text",
                                "Hétvégén."),
                        h,
                        HttpStatus.OK,
                        Map.class);
        awaitFinished(UUID.fromString((String) response.get("id")));
        var feed = getForList("/api/character/feed?limit=1", h, HttpStatus.OK, Map.class);
        assertThat(feed)
                .singleElement()
                .satisfies(
                        item ->
                                assertThat(item.get("sourceId"))
                                        .isEqualTo(source.getId().toString()));
        assertThat(observations.findAll()).hasSize(2);
    }
}
