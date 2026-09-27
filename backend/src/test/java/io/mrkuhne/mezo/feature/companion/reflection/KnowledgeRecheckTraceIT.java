package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.KnowledgeRecheckService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * S6 (mezo-d6ivw.6) Task A6: the recheck trace — {@code rechecked_at} is stamped on the SOURCE
 * row for every verdict the recheck actually evaluated ({@code holds} or {@code drift}), and the
 * drift row's title is the model's own {@code claim} (the new fact if confirmed), falling back to
 * the first sentence of the hedged {@code text} when the claim is missing or blank.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.reflection.notice.quiet-from=00:00",
        "mezo.companion.reflection.notice.quiet-to=00:00"})
class KnowledgeRecheckTraceIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeRecheckService recheckService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    private static final String DEFAULT_CLAIM = "Reggelente fél liter vizet iszol.";

    private PatternEntity confirmedPlanlessPromoted(UUID owner, String claimText) {
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        row.setMechanism(claimText);
        row = patternPopulator.save(row);
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText(claimText);
        fact.setCategory("life");
        fact.setSource(KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setIncludeInPrompt(true);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        fact = knowledgeFactRepository.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        return patternPopulator.save(row);
    }

    @Test
    void runFor_shouldStampRecheckedAt_whenHolds() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"holds\",\"text\":\"\"}]]" + DEFAULT_CLAIM);

        recheckService.runFor(owner);

        assertThat(patternRepository.findById(row.getId()).orElseThrow().getRecheckedAt()).isNotNull();
    }

    @Test
    void runFor_shouldStampRecheckedAtAndUseTheClaimAsDriftTitle_whenDrift() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"drift\",\"text\":\"Korábban megerősítetted, hogy X. Mostanában másképp.\","
                        + "\"claim\":\"Mostanában a randis napok estéje is feltölt.\"}]]" + DEFAULT_CLAIM);

        recheckService.runFor(owner);

        assertThat(patternRepository.findById(row.getId()).orElseThrow().getRecheckedAt()).isNotNull();
        PatternEntity drift = patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                owner, PatternEntity.KIND_REFLECTION, "drift-" + row.getId()).orElseThrow();
        assertThat(drift.getTitle()).isEqualTo("Mostanában a randis napok estéje is feltölt.");
    }

    @Test
    void runFor_shouldFallBackToFirstSentence_whenClaimMissing() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"drift\",\"text\":\"Első mondat. Második.\"}]]" + DEFAULT_CLAIM);

        recheckService.runFor(owner);

        PatternEntity drift = patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                owner, PatternEntity.KIND_REFLECTION, "drift-" + row.getId()).orElseThrow();
        assertThat(drift.getTitle()).isEqualTo("Első mondat.");
    }

    @Test
    void runFor_shouldNotStamp_whenUnknown() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"unknown\",\"text\":\"\"}]]" + DEFAULT_CLAIM);

        recheckService.runFor(owner);

        assertThat(patternRepository.findById(row.getId()).orElseThrow().getRecheckedAt()).isNull();
    }
}
