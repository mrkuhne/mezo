package io.mrkuhne.mezo.feature.llmlog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** The mezo-1y3p scrub primitive: payload leaves, cost metadata stays, the stamp is honest. */
class LlmLogRetentionScrubIT extends AbstractIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-08-18T02:40:00Z");
    private static final Instant CUTOFF = NOW.minus(90, ChronoUnit.DAYS);

    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PlatformTransactionManager txManager;

    private UUID ownerId() {
        return userPopulator.createUser("scrub-test@test.hu").getId();
    }

    private int scrubPayloads(Instant cutoff, Instant now) {
        return new TransactionTemplate(txManager).execute(status ->
            llmLogRepository.scrubPayloadsOlderThan(cutoff, now));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldNullPayloadAndKeepCost_whenRowOlderThanCutoff() {
        UUID owner = ownerId();
        LlmLogEntity old = llmLogPopulator.logPayloadAt(CUTOFF.minus(1, ChronoUnit.DAYS), owner,
            "companion_chat", "sys", "user", "resp");

        int scrubbed = scrubPayloads(CUTOFF, NOW);

        assertThat(scrubbed).isEqualTo(1);
        LlmLogEntity reloaded = llmLogRepository.findById(old.getId()).orElseThrow();
        assertThat(reloaded.getSystemPrompt()).isNull();
        assertThat(reloaded.getConversationHistory()).isNull();
        assertThat(reloaded.getUserMessage()).isNull();
        assertThat(reloaded.getResponseText()).isNull();
        assertThat(reloaded.getPayloadScrubbedAt()).isEqualTo(NOW);
        // the founding purpose survives: cost/token metadata is forever
        assertThat(reloaded.getCostUsd()).isEqualByComparingTo(new BigDecimal("0.000123"));
        assertThat(reloaded.getPromptTokens()).isEqualTo(10);
        assertThat(reloaded.getTotalTokens()).isEqualTo(15);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldLeaveRowUntouched_whenInsideWindow() {
        LlmLogEntity fresh = llmLogPopulator.logPayloadAt(CUTOFF.plus(1, ChronoUnit.DAYS), ownerId(),
            "companion_chat", "sys", "user", "resp");

        int scrubbed = scrubPayloads(CUTOFF, NOW);

        assertThat(scrubbed).isZero();
        LlmLogEntity reloaded = llmLogRepository.findById(fresh.getId()).orElseThrow();
        assertThat(reloaded.getSystemPrompt()).isEqualTo("sys");
        assertThat(reloaded.getPayloadScrubbedAt()).isNull();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldNotRestamp_whenRowAlreadyScrubbed() {
        LlmLogEntity old = llmLogPopulator.logPayloadAt(CUTOFF.minus(2, ChronoUnit.DAYS), ownerId(),
            "companion_chat", "sys", "user", "resp");
        scrubPayloads(CUTOFF, NOW);

        Instant later = NOW.plus(1, ChronoUnit.DAYS);
        int second = scrubPayloads(CUTOFF, later);

        assertThat(second).isZero();
        assertThat(llmLogRepository.findById(old.getId()).orElseThrow().getPayloadScrubbedAt())
            .isEqualTo(NOW); // the first stamp is stable — idempotence
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldSkipRow_whenNoPayloadEverExisted() {
        // an embed-style row: no payload columns were ever written
        LlmLogEntity embed = llmLogPopulator.logAt(CUTOFF.minus(3, ChronoUnit.DAYS), ownerId(),
            CallKind.EMBED_DOC, "memory_embedding", "gemini-embedding-001", 0, 0, null, null);

        int scrubbed = scrubPayloads(CUTOFF, NOW);

        assertThat(scrubbed).isZero();
        assertThat(llmLogRepository.findById(embed.getId()).orElseThrow().getPayloadScrubbedAt())
            .isNull(); // the stamp means "something was removed here" — never set vacuously
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void testScrub_shouldScrubErrorRow_whenOlderThanCutoff() {
        LlmLogEntity error = llmLogPopulator.logError(ownerId(), CallKind.CHAT, "companion_chat",
            "gemini-2.5-flash", "429");
        // logError has no payload — write one, then back-date, mirroring a failed call whose
        // request-side prompt WAS captured (ADR 0014: request facts survive on ERROR rows)
        jdbcTemplate.update(
            "update llm_log_history set user_message = 'lost prompt', created_at = ? where id = ?",
            java.sql.Timestamp.from(CUTOFF.minus(1, ChronoUnit.DAYS)), error.getId());

        int scrubbed = scrubPayloads(CUTOFF, NOW);

        assertThat(scrubbed).isEqualTo(1);
        assertThat(llmLogRepository.findById(error.getId()).orElseThrow().getUserMessage()).isNull();
    }
}
