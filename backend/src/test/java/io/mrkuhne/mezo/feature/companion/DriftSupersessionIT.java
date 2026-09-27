package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

/** S6 (mezo-d6ivw.6) Task A7: confirming a drift card replaces the old knowledge, visibly. */
class DriftSupersessionIT extends AbstractIntegrationTest {

    @Autowired private PatternService patternService;
    @Autowired private PatternRepository patterns;
    @Autowired private KnowledgeFactRepository facts;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TransactionTemplate tx;

    private PatternEntity original(UUID owner) {
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Randi után estére lemerülsz.", "life", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        facts.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        return patternPopulator.save(row);
    }

    private PatternEntity drift(UUID owner, UUID originalId) {
        PatternEntity drift = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        drift.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + originalId);
        drift.setTitle("Mostanában a randis napok estéje is feltölt.");
        return patternPopulator.save(drift);
    }

    private void confirm(UUID owner, UUID patternId) {
        tx.executeWithoutResult(s -> {
            PatternEntity row = patterns.findById(patternId).orElseThrow();
            patternService.applyUserConfirm(owner, row);
            patterns.saveAndFlush(row);
        });
    }

    @Test
    void confirmDrift_shouldMintNewFactAndMuteTheOriginalAsSuperseded() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity original = original(owner);
        PatternEntity drift = drift(owner, original.getId());

        confirm(owner, drift.getId());

        PatternEntity confirmedDrift = patterns.findById(drift.getId()).orElseThrow();
        assertThat(confirmedDrift.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fresh = facts.findById(confirmedDrift.getPromotedFactId()).orElseThrow();
        assertThat(fresh.getFactText()).isEqualTo("Mostanában a randis napok estéje is feltölt.");
        assertThat(fresh.isIncludeInPrompt()).isTrue();
        assertThat(fresh.getProvenance().patternId()).isEqualTo(drift.getId());

        KnowledgeFactEntity old = facts.findById(original.getPromotedFactId()).orElseThrow();
        assertThat(old.isIncludeInPrompt()).isFalse();
        assertThat(old.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_SUPERSEDED);
        assertThat(old.getSupersededBy()).isEqualTo(fresh.getId());
        assertThat(old.getMutedAt()).isNotNull();
    }

    @Test
    void confirmDrift_shouldPromoteOnly_whenOriginalFactIsGone() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity original = original(owner);
        facts.deleteById(original.getPromotedFactId()); // soft delete
        PatternEntity drift = drift(owner, original.getId());

        confirm(owner, drift.getId());

        assertThat(patterns.findById(drift.getId()).orElseThrow().getPromotedFactId()).isNotNull();
    }

    @Test
    void confirmDrift_shouldPromoteOnly_whenPairKeyIsNotAUuid() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity drift = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        drift.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + "not-a-uuid");
        patternPopulator.save(drift);

        confirm(owner, drift.getId());

        assertThat(patterns.findById(drift.getId()).orElseThrow().getPromotedFactId()).isNotNull();
    }
}
