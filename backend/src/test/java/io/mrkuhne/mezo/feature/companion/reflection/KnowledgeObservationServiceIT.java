package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.KnowledgeObservationResponse;
import io.mrkuhne.mezo.api.dto.ObservationEvidenceItem;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.KnowledgeObservationService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/** S6 (mezo-d6ivw.6) Task A9: the Tudástár's Észrevételek section and a fact's "Honnan tudom?". */
@ActiveProfiles("companion-fake")
class KnowledgeObservationServiceIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeObservationService service;
    @Autowired private PatternService patternService;
    @Autowired private PatternRepository patterns;
    @Autowired private KnowledgeFactRepository facts;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TransactionTemplate tx;

    private PatternEntity confirmedWithFact(UUID owner, String title) {
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        row.setTitle(title);
        KnowledgeFactEntity fact = factPopulator.fact(owner, title, "life", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        facts.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED,
                Instant.now().minus(1, ChronoUnit.DAYS));
        return patternPopulator.save(row);
    }

    private void confirmAsUser(UUID owner, UUID patternId) {
        tx.executeWithoutResult(s -> {
            PatternEntity row = patterns.findById(patternId).orElseThrow();
            patternService.applyUserConfirm(owner, row);
            patterns.saveAndFlush(row);
        });
    }

    private static KnowledgeObservationResponse byId(List<KnowledgeObservationResponse> list, UUID id) {
        return list.stream().filter(r -> r.getPatternId().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void list_shouldPairADriftWithItsOriginal_andCarryTheFactState() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity original = confirmedWithFact(owner, "Randi után estére lemerülsz.");
        PatternEntity drift = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        drift.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + original.getId());
        drift.setTitle("Mostanában a randis napok estéje is feltölt.");
        patternPopulator.save(drift);
        confirmAsUser(owner, drift.getId());

        List<KnowledgeObservationResponse> list = service.list(owner);

        KnowledgeObservationResponse newer = byId(list, drift.getId());
        KnowledgeObservationResponse older = byId(list, original.getId());
        assertThat(newer.getReplacesPatternId()).isEqualTo(original.getId());
        assertThat(older.getReplacedByPatternId()).isEqualTo(drift.getId());
        assertThat(older.getFactMutedReason().getValue()).isEqualTo("superseded");
        assertThat(older.getFactMutedAt()).isNotNull();
        assertThat(newer.getFactId()).isNotNull();
        assertThat(newer.getFactMutedReason()).isNull();
        assertThat(list).extracting(KnowledgeObservationResponse::getPatternId)
                .containsExactly(drift.getId(), original.getId());
    }

    @Test
    void list_shouldSkipForgottenStatisticalAndOpenRows() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity kept = confirmedWithFact(owner, "Megtartott");
        patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_FORGOTTEN);
        patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        patternPopulator.statistical(owner, "pair-s6", PatternEntity.STATUS_CONFIRMED);

        List<KnowledgeObservationResponse> list = service.list(owner);

        assertThat(list).extracting(KnowledgeObservationResponse::getPatternId).containsExactly(kept.getId());
    }

    @Test
    void list_shouldKeepARefutedRowThatLeftAFact_andCarryTheTopicKey() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity refuted = confirmedWithFact(owner, "Cáfolt, de tényt hagyott");
        refuted.setStatus(PatternEntity.STATUS_REFUTED);
        refuted.setEvidence(new io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope(
                List.of("observation-topic-key:randi")));
        patternPopulator.save(refuted);
        patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_REFUTED); // no fact → hidden

        List<KnowledgeObservationResponse> list = service.list(owner);

        assertThat(list).singleElement().satisfies(r -> {
            assertThat(r.getPatternId()).isEqualTo(refuted.getId());
            assertThat(r.getStatus().getValue()).isEqualTo("refuted");
            assertThat(r.getTopicKey()).isEqualTo("randi");
        });
    }

    @Test
    void factEvidence_shouldResolveTheChatTurn_forAChatFact() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        AiMessageEntity message = messagePopulator.message(conversation, "user",
                "Laktózérzékeny vagyok, csak laktózmentes jöhet.");
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Laktózérzékeny vagy.", "fuel", 1, true,
                KnowledgeFactEntity.SOURCE_CHAT);
        LearnedFactEntity candidate = learnedFactPopulator.candidate(owner, "Laktózérzékeny vagy.", message.getId());
        candidate.setUserDecision(LearnedFactEntity.DECISION_ACCEPT);
        candidate.setPromotedFactId(fact.getId());
        learnedFactRepository.saveAndFlush(candidate);

        List<ObservationEvidenceItem> items = service.factEvidence(owner, fact.getId());

        assertThat(items).singleElement().satisfies(item -> {
            assertThat(item.getType()).isEqualTo("record");
            assertThat(item.getSource()).isEqualTo("ai_message");
            assertThat(item.getRef()).isEqualTo("ai_message:" + message.getId());
        });
    }

    @Test
    void factEvidence_shouldBeEmpty_forAManualFact() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity manual = factPopulator.fact(owner, "Kézi", "life", 0);
        assertThat(service.factEvidence(owner, manual.getId())).isEmpty();
    }

    @Test
    void factEvidence_shouldReturnTheRowsEvidence_forAPatternFact() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = confirmedWithFact(owner, "Mintából tanult");
        List<ObservationEvidenceItem> items = service.factEvidence(owner, row.getPromotedFactId());
        assertThat(items).extracting(ObservationEvidenceItem::getType).containsExactly("tag");
    }

    @Test
    void factEvidence_shouldThrow_forAForeignFact() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Az enyém", "life", 0);
        assertThatThrownBy(() -> service.factEvidence(stranger, fact.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
