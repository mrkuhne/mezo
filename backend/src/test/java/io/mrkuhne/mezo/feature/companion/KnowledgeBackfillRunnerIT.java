package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S6 (mezo-d6ivw.6) folds in mezo-4rh4r: stuck pre-S2 "Igen, ez igaz rám" rows are promoted once. */
class KnowledgeBackfillRunnerIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeBackfillRunner runner;
    @Autowired private PatternRepository patterns;
    @Autowired private KnowledgeFactRepository facts;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator eventPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void backfill_shouldPromoteAStuckWatchedRowExactlyOnce() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity stuck = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);
        eventPopulator.userReply(owner, stuck.getId(), "chip", "watch", null);

        runner.backfill();
        UUID factId = patterns.findById(stuck.getId()).orElseThrow().getPromotedFactId();
        runner.backfill(); // idempotent

        PatternEntity reread = patterns.findById(stuck.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
        assertThat(factId).isNotNull();
        assertThat(reread.getPromotedFactId()).isEqualTo(factId);
        assertThat(facts.findByCreatedByAndSourceAndDeletedFalse(owner, "pattern")).hasSize(1);
    }

    @Test
    void backfill_shouldLeaveRowsWhoseNewestReplyIsNotWatch() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);
        eventPopulator.userReply(owner, row.getId(), "chip", "watch", null, Instant.now().minusSeconds(60));
        eventPopulator.userReply(owner, row.getId(), "chip", "reject", null, Instant.now());

        runner.backfill();

        assertThat(patterns.findById(row.getId()).orElseThrow().getPromotedFactId()).isNull();
    }

    @Test
    void backfill_shouldLeaveDriftAndPlannedRows() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity drift = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);
        drift.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + UUID.randomUUID());
        patternPopulator.save(drift);
        eventPopulator.userReply(owner, drift.getId(), "chip", "watch", null);

        runner.backfill();

        assertThat(patterns.findById(drift.getId()).orElseThrow().getPromotedFactId()).isNull();
    }
}
