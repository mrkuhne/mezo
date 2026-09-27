package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ForgetService;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S6 (mezo-d6ivw.6) Task A4: "Elfelejtem" on a fact is permanent and vetoed. */
class ForgetServiceIT extends AbstractIntegrationTest {

    @Autowired private ForgetService forgetService;
    @Autowired private KnowledgeFactService knowledgeFactService;
    @Autowired private KnowledgeFactRepository facts;
    @Autowired private PatternRepository patterns;
    @Autowired private MemoryForgetVetoRepository vetoes;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void forgetFact_shouldSoftDeleteAndVetoItsText() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "  Mázli a  macskád ", "life", 2, true,
                KnowledgeFactEntity.SOURCE_CHAT);

        forgetService.forgetFact(owner, fact.getId());

        assertThat(facts.findByIdAndCreatedByAndDeletedFalse(fact.getId(), owner)).isEmpty();
        assertThat(knowledgeFactService.list(owner)).noneMatch(f -> f.getId().equals(fact.getId()));
        assertThat(knowledgeFactService.renderPromptBlock(owner)).doesNotContain("Mázli");
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, "mázli a macskád")).isTrue();
    }

    @Test
    void forgetFact_shouldAlsoForgetItsObservation_whenPatternSourced() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fact = factPopulator.fact(owner, row.getTitle(), "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        facts.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        patternPopulator.save(row);

        forgetService.forgetFact(owner, fact.getId());

        assertThat(patterns.findById(row.getId()).orElseThrow().isForgotten()).isTrue();
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_PATTERN, row.getId().toString())).isTrue();
    }

    @Test
    void forgetFact_shouldReturn404_forForeignFact() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Az enyém", "life", 0);

        assertThatThrownBy(() -> forgetService.forgetFact(stranger, fact.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(facts.findById(fact.getId())).isPresent();
    }

    @Test
    void forgetObservation_shouldForgetTheRowAndItsFact_andNeverRepromote() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fact = factPopulator.fact(owner, row.getTitle(), "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        row.setPromotedFactId(fact.getId());
        patternPopulator.save(row);

        forgetService.forgetObservation(owner, row.getId());

        PatternEntity reread = patterns.findById(row.getId()).orElseThrow();
        assertThat(reread.isForgotten()).isTrue();
        assertThat(facts.findByIdAndCreatedByAndDeletedFalse(fact.getId(), owner)).isEmpty();
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_PATTERN, row.getId().toString())).isTrue();
        // final review Minor 15: the learned fact's text is vetoed too, not only the row
        assertThat(vetoes.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(
                owner, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT,
                MemoryForgetVetoEntity.factTextVetoKey(row.getTitle()))).isTrue();
    }

    @Test
    void forgetObservation_shouldReturn404_forAStatisticalRow() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity stat = patternPopulator.statistical(owner);
        assertThatThrownBy(() -> forgetService.forgetObservation(owner, stat.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void forgetObservation_shouldReturn404_forAForeignRow() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        assertThatThrownBy(() -> forgetService.forgetObservation(stranger, row.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(patterns.findById(row.getId()).orElseThrow().isForgotten()).isFalse();
    }
}
