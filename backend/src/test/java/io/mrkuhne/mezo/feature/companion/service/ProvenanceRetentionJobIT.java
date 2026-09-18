package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * mezo-rj214.7: the nightly provenance scrub end-to-end — 90-day window from live config, scrub
 * through the bean. Mirrors {@code LlmLogRetentionJobIT}.
 */
@TestPropertySource(properties = {
    // The shared test profile disables this cron by default (kill-switch completeness) — this
    // IT drives the job directly, so it re-enables it on its own context.
    "mezo.techcore.cron.companion-provenance-retention-job.enabled=true"
})
class ProvenanceRetentionJobIT extends AbstractIntegrationTest {

    @Autowired private ProvenanceRetentionJob provenanceRetentionJob;
    @Autowired private AiMessageRepository aiMessageRepository;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PlatformTransactionManager txManager;

    @Test
    void testRun_shouldScrubOutcomesOnly_whenRowIsOlderThan90Days() {
        AiConversationEntity conversation = aiConversationPopulator.conversation(ownerId());
        ToolCallsEnvelope toolCalls = new ToolCallsEnvelope(
            List.of(new ToolCallsEnvelope.ToolCall("read", "get_weight_trend", "weeks=4", "trend kell a válaszhoz")));
        ToolOutcomesEnvelope toolOutcomes = new ToolOutcomesEnvelope(
            List.of(new ToolOutcomesEnvelope.Outcome("get_weight_trend", "csökkenő trend", false)));

        AiMessageEntity old = withEnvelopes(conversation, toolCalls, toolOutcomes);
        backdate(old.getId(), Instant.now().minus(91, ChronoUnit.DAYS));

        provenanceRetentionJob.run();

        AiMessageEntity scrubbed = aiMessageRepository.findById(old.getId()).orElseThrow();
        assertThat(scrubbed.getToolOutcomes()).isNull();
        assertThat(scrubbed.getToolCalls()).isEqualTo(toolCalls);
        assertThat(scrubbed.getToolCalls().calls().get(0).why()).isEqualTo("trend kell a válaszhoz");
    }

    @Test
    void testRun_shouldSpareFreshRow_whenInsideWindow() {
        AiConversationEntity conversation = aiConversationPopulator.conversation(ownerId());
        ToolCallsEnvelope toolCalls = new ToolCallsEnvelope(
            List.of(new ToolCallsEnvelope.ToolCall("read", "get_weight_trend", "weeks=4", "why")));
        ToolOutcomesEnvelope toolOutcomes = new ToolOutcomesEnvelope(
            List.of(new ToolOutcomesEnvelope.Outcome("get_weight_trend", "eredmény", false)));

        AiMessageEntity fresh = withEnvelopes(conversation, toolCalls, toolOutcomes);
        backdate(fresh.getId(), Instant.now().minus(89, ChronoUnit.DAYS));

        provenanceRetentionJob.run();

        assertThat(aiMessageRepository.findById(fresh.getId()).orElseThrow().getToolOutcomes())
            .isEqualTo(toolOutcomes);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testRun_shouldNotRecountAlreadyScrubbedRow() {
        AiConversationEntity conversation = aiConversationPopulator.conversation(ownerId());
        ToolCallsEnvelope toolCalls = new ToolCallsEnvelope(
            List.of(new ToolCallsEnvelope.ToolCall("read", "get_weight_trend", "weeks=4", "why")));

        AiMessageEntity alreadyScrubbed = withEnvelopes(conversation, toolCalls, null);
        backdate(alreadyScrubbed.getId(), Instant.now().minus(200, ChronoUnit.DAYS));

        int scrubbedCount = scrub(Instant.now().minus(90, ChronoUnit.DAYS));

        assertThat(scrubbedCount).isZero();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testRun_shouldReturnAccurateCount() {
        AiConversationEntity conversation = aiConversationPopulator.conversation(ownerId());
        ToolCallsEnvelope toolCalls = new ToolCallsEnvelope(
            List.of(new ToolCallsEnvelope.ToolCall("read", "get_weight_trend", "weeks=4", "why")));
        ToolOutcomesEnvelope toolOutcomes = new ToolOutcomesEnvelope(
            List.of(new ToolOutcomesEnvelope.Outcome("get_weight_trend", "eredmény", false)));

        AiMessageEntity old1 = withEnvelopes(conversation, toolCalls, toolOutcomes);
        backdate(old1.getId(), Instant.now().minus(91, ChronoUnit.DAYS));
        AiMessageEntity old2 = withEnvelopes(conversation, toolCalls, toolOutcomes);
        backdate(old2.getId(), Instant.now().minus(120, ChronoUnit.DAYS));
        AiMessageEntity fresh = withEnvelopes(conversation, toolCalls, toolOutcomes);
        backdate(fresh.getId(), Instant.now().minus(10, ChronoUnit.DAYS));

        int scrubbedCount = scrub(Instant.now().minus(90, ChronoUnit.DAYS));

        assertThat(scrubbedCount).isEqualTo(2);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testRun_shouldSpareRowAtExactCutoff() {
        AiConversationEntity conversation = aiConversationPopulator.conversation(ownerId());
        ToolCallsEnvelope toolCalls = new ToolCallsEnvelope(
            List.of(new ToolCallsEnvelope.ToolCall("read", "get_weight_trend", "weeks=4", "why")));
        ToolOutcomesEnvelope toolOutcomes = new ToolOutcomesEnvelope(
            List.of(new ToolOutcomesEnvelope.Outcome("get_weight_trend", "eredmény", false)));

        AiMessageEntity atCutoff = withEnvelopes(conversation, toolCalls, toolOutcomes);
        Instant cutoffInstant = Instant.now().minus(90, ChronoUnit.DAYS);
        backdate(atCutoff.getId(), cutoffInstant);

        // The predicate is createdAt < :cutoff, so equality is spared (not scrubbed)
        int scrubbedCount = scrub(cutoffInstant);

        assertThat(scrubbedCount).isZero();
        AiMessageEntity reloaded = aiMessageRepository.findById(atCutoff.getId()).orElseThrow();
        assertThat(reloaded.getToolOutcomes()).isEqualTo(toolOutcomes);
    }

    /** Runs the {@code @Modifying} query in its own transaction — mirroring
     *  {@code LlmLogRetentionScrubIT}, since the surrounding test method itself opts out of one
     *  (Propagation.NOT_SUPPORTED) to keep the backdating writes visible to the scrub's own tx. */
    private int scrub(Instant cutoff) {
        return new TransactionTemplate(txManager).execute(status ->
            aiMessageRepository.scrubToolOutcomesOlderThan(cutoff));
    }

    private AiMessageEntity withEnvelopes(AiConversationEntity conversation, ToolCallsEnvelope toolCalls,
            ToolOutcomesEnvelope toolOutcomes) {
        AiMessageEntity message = aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "válasz");
        message.setToolCalls(toolCalls);
        message.setToolOutcomes(toolOutcomes);
        return aiMessageRepository.saveAndFlush(message);
    }

    private void backdate(UUID messageId, Instant createdAt) {
        jdbcTemplate.update("update ai_message set created_at = ? where id = ?",
            Timestamp.from(createdAt), messageId);
    }

    private UUID ownerId() {
        return userPopulator.createUser("provenance-retention-job-test@test.hu").getId();
    }
}
